const express = require('express');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3000;

// === WHITELIST: Mapping av godkjente brikker ===
const reviewLinks = {
  kunde1: 'https://g.page/r/xxxxxxxx',
  kunde2: 'https://g.page/r/yyyyyyyy',
  kunde3: 'https://g.page/r/zzzzzzzz'
};

// === Google Sheets webhook-URL ===
const webhookUrl = 'https://script.google.com/macros/s/AKfycbxUTIx2Pyhj2C4HSTucFfgP3cAyVJ8heihpwyqAMYUx3PObs7p0SLyqctiQC26sk5Rx/exec';

app.get('/', async (req, res) => {
  const host = req.headers.host || '';
  const subdomain = host.split('.')[0];

  // 🚫 Hopp over hvis brikken ikke finnes i whitelist
  if (!reviewLinks.hasOwnProperty(subdomain)) {
    return res.status(204).end();
  }

  // ✅ Logg og redirect for godkjent brikke
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

  const target = reviewLinks[subdomain];
  res.redirect(302, target);
});

app.listen(PORT, () => {
  console.log(`🚀 NFC redirect app kjører på port ${PORT}`);
});
