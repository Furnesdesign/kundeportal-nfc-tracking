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
  '0100': 'https://www.vg.no/',
  '0101': 'https://www.smp.no/',
  '0102': 'https://www.db.no/'
};

// Google Sheets webhook (Apps Script web app URL)
const webhookUrl = 'https://script.google.com/macros/s/AKfycbxUTIx2Pyhj2C4HSTucFfgP3cAyVJ8heihpwyqAMYUx3PObs7p0SLyqctiQC26sk5Rx/exec';

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
    organization: null
  };

  // 3) Geo lookup (non-blocking), then send to Sheets
  fetchGeo(ip)
    .then(geo => {
      if (geo) {
        logData.country = geo.country;
        logData.region = geo.region;
        logData.city = geo.city;
        logData.isp = geo.isp;
        logData.organization = geo.organization;
      }
    })
    .catch(() => {})
    .finally(() => {
      fetch(webhookUrl, {
        method: 'POST',
        body: JSON.stringify(logData),
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(1200),
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
  const raw = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString();
  let ip = raw.split(',')[0].trim();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  return ip;
}

async function fetchGeo(ip) {
  if (isPrivateIp(ip)) return null;

  const url = `https://ipapi.co/${encodeURIComponent(ip)}/json/`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(900) });
    if (!res.ok) return null;
    const j = await res.json();
    return {
      country: j.country_name || j.country || null,
      region:  j.region || j.region_code || null,
      city:    j.city || null,
      isp:     j.org || null,     // ISP/owner
      organization: j.asn || null // ASN + org
    };
  } catch {
    return null;
  }
}

function isPrivateIp(ip) {
  return (
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) ||
    ip === '127.0.0.1' || ip === '::1'
  );
}
