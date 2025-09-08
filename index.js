const express = require('express');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;
app.set('trust proxy', true);

// Hold forbindelsen varm mot Google (litt raskere)
const keepAliveAgent = new https.Agent({ keepAlive: true });

// ✅ Gyldige brikker
const reviewLinks = {
  '0100': 'https://www.vg.no/',
  '0101': 'https://www.smp.no/',
  '0102': 'https://www.db.no/'
};

// Google Sheets webhook
const webhookUrl = 'https://script.google.com/macros/s/AKfycbxUTIx2Pyhj2C4HSTucFfgP3cAyVJ8heihpwyqAMYUx3PObs7p0SLyqctiQC26sk5Rx/exec';

app.get('/', (req, res) => {
  const host = req.headers.host || '';
  const subdomain = (host.split('.')[0] || '').toString();
  const target = reviewLinks[subdomain];

  if (!target) return res.status(204).end();

  // 1) Redirect umiddelbart (ingen venting på logging)
  res.redirect(302, target);

  // 2) Logg i bakgrunnen (fire-and-forget) med 1s timeout
  const now = new Date();
  const tidspunkt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Oslo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).format(now); // typisk "YYYY-MM-DD HH:mm:ss"

  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
    .split(',')[0].trim();
  const enhet = req.headers['user-agent'] || '';
  const logData = { brikke: subdomain, tidspunkt, ip, enhet };

  fetch(webhookUrl, {
    method: 'POST',
    body: JSON.stringify(logData),
    headers: { 'Content-Type': 'application/json' },
    // Node 18+: innebygd timeout via AbortSignal
    signal: AbortSignal.timeout(1000),
    agent: keepAliveAgent
  }).catch(err => {
    console.error('Sheets log failed:', err?.name || err);
  });
});

app.listen(PORT, () => {
  console.log(`🚀 NFC redirect app kjører på port ${PORT}`);
});
