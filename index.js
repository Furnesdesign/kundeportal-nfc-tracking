const express = require('express');
const fetch = require('node-fetch'); // Husk: installer med "npm install node-fetch@2"
const app = express();
const PORT = process.env.PORT || 3000;

// === Mapping av brikker til Google Review-lenker ===
const reviewLinks = {
  kunde1: 'https://g.page/r/xxxxxxxx', // <-- bytt ut disse med riktige lenker
  kunde2: 'https://g.page/r/yyyyyyyy',
  kunde3: 'https://g.page/r/zzzzzzzz',
};

// === Google Sheets webhook-URL ===
const webhookUrl = 'https://script.google.com/macros/s/AKfycbxUTIx2Pyhj2C4HSTucFfgP3cAyVJ8heihpwyqAMYUx3PObs7p0SLyqctiQC26sk5Rx/exec';

app.use(async (req, res) => {
  const host = req.headers.host || '';
  const subdomain = host.split('.')[0]; // f.eks. "kunde2"

  // Juster til norsk tid (CEST = UTC+2)
  const timestampUTC = new Date();
  const timestampLocal = new Date(timestampUTC.getTime() + 2 * 60 * 60 * 1000);
  const formattedTime = timestampLocal.toISOString().replace('T', ' ').substring(0, 19);

  const ipRaw = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
  const ip = ipRaw.split(',')[0].trim(); // bare første IP-adresse

  const userAgent = req.headers['user-agent'] || '';

  // === Logg til Google Sheets via webhook ===
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

  // === Redirect til riktig Google Review-link eller fallback ===
  const target = reviewLinks[subdomain] || 'https://kunda.no';
  res.redirect(302, target);
});

app.listen(PORT, () => {
  console.log(`🚀 NFC redirect app kjører på port ${PORT}`);
});

