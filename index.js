const express = require('express');
const fetch = require('node-fetch'); // Husk: node-fetch@2 installert via package.json
const app = express();
const PORT = process.env.PORT || 3000;

// === Mapping av subdomener til Google Review-lenker ===
const reviewLinks = {
  kunde1: 'https://g.page/r/xxxxxxxx',     // ← bytt ut disse med faktiske lenker
  kunde2: 'https://g.page/r/yyyyyyyy'
};

// === Google Sheets webhook-URL ===
const webhookUrl = 'https://script.google.com/macros/s/AKfycbxUTIx2Pyhj2C4HSTucFfgP3cAyVJ8heihpwyqAMYUx3PObs7p0SLyqctiQC26sk5Rx/exec';

// === Kun logg hoved-GET-forespørsel (unngå favicon, HEAD osv) ===
app.get('/', async (req, res) => {
  const host = req.headers.host || '';
  const subdomain = host.split('.')[0];

  // Juster til norsk tid (CEST = UTC+2)
  const timestampUTC = new Date();
  const timestampLocal = new Date(timestampUTC.getTime() + 2 * 60 * 60 * 1000);
  const formattedTime = timestampLocal.toISOString().replace('T', ' ').substring(0, 19);

  const ipRaw = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
  const ip = ipRaw.split(',')[0].trim();

  const userAgent = req.headers['user-agent'] || '';

  const logData = {
    brikke: subdomain,
    tidspunkt: formattedTime,
    ip: ip,
    enhet: userAgent
  };

  // Send logg til Google Sheets
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      body: JSON.stringify(logData),
      headers: { 'Content-Type': 'application/json' }
    });
    console.log(`✅ Logget til Google Sheets for brikke: ${subdomain}`);
  } catch (err) {
    console.error('❌ Feil ved logging til Sheets:', err);
  }

  // Redirect til riktig kunde eller fallback
  const target = reviewLinks[subdomain] || 'https://kunda.no';
  res.redirect(302, target);
});

// === Start server ===
app.listen(PORT, () => {
  console.log(`🚀 NFC redirect app kjører på port ${PORT}`);
});
