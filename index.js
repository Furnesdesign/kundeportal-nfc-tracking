// index.js
const express = require('express');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;
app.set('trust proxy', true);

// Reuse TLS connections
const keepAliveAgent = new https.Agent({ keepAlive: true });

// ✅ Whitelisted tags → redirect URLs
const reviewLinks = {
  '100': 'https://www.vg.no/',
  '101': 'https://www.smp.no/',
  '102': 'https://www.db.no/'
};

// Google Sheets webhook (NEW)
const webhookUrl = 'https://script.google.com/macros/s/AKfycbycQkNKjSSz0g1B9q6kvq7RzHmOO2xg2MU3lHUKs3QreSoqW02c3XNGVamrrG8XnNH2Qw/exec';

app.get('/', (req, res) => {
  const host = req.headers.host || '';
  const subdomain = (host.split('.')[0] || '').toString();
  const target = reviewLinks[subdomain];

  if (!target) {
    return res.status(204).end();
  }

  // 1) Redirect immediately
  res.redirect(302, target);

  // 2) Build payload
  const ip = clientIp(req);
  const logData = {
    brikke: subdomain,
    redirect: target,
    tidspunkt: formatOsloTime(new Date()),
    ip, // consider truncate/hash for GDPR
    enhet: req.headers['user-agent'] || '',
    country: null,
    region: null,
    city: null,
    isp: null,
    organization: null,
    webhook_version: 'v2-geo-fallback'
  };

  // 3) Geo lookup (non-blocking, with fallback), then send to Sheets
  fetchGeoWithFallback(ip)
    .then(geo => {
      if (geo) {
        logData.country = geo.country ?? null;
        logData.region = geo.region ?? null;
        logData.city = geo.city ?? null;
        logData.isp = geo.isp ?? null;
        logData.organization = geo.organization ?? null;
      }
    })
    .catch(err => {
      console.error('Geo lookup failed:', err?.name || err, 'IP:', ip);
    })
    .finally(() => {
      fetch(webhookUrl, {
        method: 'POST',
        body: JSON.stringify(logData),
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(2500), // allow a bit more time to reach Apps Script
        agent: keepAliveAgent
      }).catch(err => {
        console.error('Sheets log failed:', err?.name || err);
      });
    });
});

app.listen(PORT, () => {
  console.log(`🚀 NFC redirect app listening on ${PORT}`);
});

// ---------- utils ----------

function formatOsloTime(d) {
  // "YYYY-MM-DD HH:mm:ss" in Europe/Oslo
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Oslo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).format(d);
}

function clientIp(req) {
  // Prefer explicit client IP headers if present
  const candidates = [
    req.headers['cf-connecting-ip'],
    req.headers['x-forwarded-for'],
    req.headers['x-real-ip'],
    req.socket?.remoteAddress
  ].filter(Boolean);

  let raw = candidates[0].toString();
  // x-forwarded-for may have a list
  let ip = raw.split(',')[0].trim();

  // strip IPv4-mapped IPv6 prefix
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  return ip;
}

async function fetchGeoWithFallback(ip) {
  if (isPrivateOrReservedIp(ip)) {
    console.log('Skipping geo for private/reserved IP:', ip);
    return null;
  }

  // PRIMARY: ipapi.co (fast, no key for light usage)
  const a = await geoFromIpApiCo(ip, 1600);
  if (a) return a;

  // FALLBACK: ipwho.is (also fast, generous free)
  const b = await geoFromIpWhoIs(ip, 1600);
  if (b) return b;

  return null;
}

async function geoFromIpApiCo(ip, timeoutMs) {
  const url = `https://ipapi.co/${encodeURIComponent(ip)}/json/`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const j = await res.json();
    // ipapi.co returns "org" (ISP/owner) and "asn" (ASN + org)
    return {
      country: j.country_name || j.country || null,
      region: j.region || j.region_code || null,
      city: j.city || null,
      isp: j.org || null,
      organization: j.asn || null
    };
  } catch {
    return null;
  }
}

async function geoFromIpWhoIs(ip, timeoutMs) {
  const url = `https://ipwho.is/${encodeURIComponent(ip)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const j = await res.json();
    if (j && j.success === false) return null;

    // ipwho.is structure: { country, region, city, connection: { isp, org, asn, domain } }
    return {
      country: j.country || null,
      region: j.region || null,
      city: j.city || null,
      isp: j.connection && j.connection.isp ? j.connection.isp : (j.connection && j.connection.org) || null,
      organization: j.connection && (j.connection.org || j.connection.asn) || null
    };
  } catch {
    return null;
  }
}

function isPrivateOrReservedIp(ip) {
  // IPv6 loopback / link-local / ULA
  const lower = ip.toLowerCase();
  if (lower === '::1') return true;
  if (lower.startsWith('fe80:')) return true; // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local (ULA)

  // IPv4 checks
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    const [a, b] = ip.split('.').map(n => parseInt(n, 10));
    const first = a, second = b;

    // RFC1918
    if (first === 10) return true;
    if (first === 192 && second === 168) return true;
    if (first === 172 && second >= 16 && second <= 31) return true;

    // Loopback
    if (first === 127) return true;

    // Link-local
    if (first === 169 && second === 254) return true;

    // CGNAT 100.64.0.0/10
    if (first === 100 && second >= 64 && second <= 127) return true;

    // Benchmarking 198.18.0.0/15
    if (first === 198 && (second === 18 || second === 19)) return true;
  }

  return false;
}
