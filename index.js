const express = require('express');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;
app.set('trust proxy', true);

// Reuse TLS connections for a small speed bump
const keepAliveAgent = new https.Agent({ keepAlive: true });

// ✅ Whitelisted tags → redirect URLs
const reviewLinks = {
  '100': 'https://www.vg.no/',
  '101': 'https://www.smp.no/',
  '102': 'https://www.db.no/'
};

// Google Sheets webhook (Apps Script Web App "Deploy as web app")
const webhookUrl = 'https://script.google.com/macros/s/AKfycbxUTIx2Pyhj2C4HSTucFfgP3cAyVJ8heihpwyqAMYUx3PObs7p0SLyqctiQC26sk5Rx/exec';

app.get('/', (req, res) => {
  const host = req.headers.host || '';
  const subdomain = (host.split('.')[0] || '').toString();
  const target = reviewLinks[subdomain];

  if (!target) {
    // Unknown tag → no content (or change to a fallback redirect if you prefer)
    return res.status(204).end();
  }

  // 1) Redirect immediately (never wait for logging)
  res.redirect(302, target);

  // 2) Build the log payload
  const ip = clientIp(req);
  const logData = {
    brikke: subdomain,
    redirect: target,
    tidspunkt: formatOsloTime(new Date()),
    ip,                                        // Consider anonymizing; see GDPR note below.
    enhet: req.headers['user-agent'] || '',
    country: null,
    region: null,
    city: null,
    isp: null,
    organization: null
  };

  // 3) Geo lookup, then post to Sheets (both with strict timeouts)
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
    .catch(() => { /* ignore geo errors */ })
    .finally(() => {
      fetch(webhookUrl, {
        method: 'POST',
        body: JSON.stringify(logData),
        headers: { 'Content-Type': 'application/json' },
        // Abort if Apps Script takes too long; never block the server
        signal: AbortSignal.timeout(1200),
        agent: keepAliveAgent
      }).catch(err => console.error('Sheets log failed:', err?.name || err));
    });
});

app.listen(PORT, () => {
  console.log(`🚀 NFC redirect app listening on ${PORT}`);
});

// ---------- utils ----------

function formatOsloTime(d) {
