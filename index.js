const express = require('express');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', true);

// ✅ Brikkene som er gyldige
const reviewLinks = {
  '100': 'https://www.vg.no/',
  '101': 'https://www.smp.no/',
  '102': 'https://www.db.no/'
};

// Google Sheets webhook
const webhookUrl = 'https://script.google.com/macros/s/AKfycbxUTIx2Pyhj2C4HSTucFfgP3cAyVJ8heihpwyqAMYUx3PObs7p0SLyqctiQC26sk5Rx/exec';

app.get('/', async (req, res) => {
  const host = req.headers.host || '';
  const subdomain = (host.split('.')[0] || '').toString();

  console.log('Host:', host, 'Subdomain:', subdomain);

  // ❌ STOPP hvis subdomenet ikke finnes i whitelist
  if (!reviewLinks.hasOwnProperty(subdomain)) {
    console.log('Subdomain not whitelisted:', subdomain);
    return res.status(204).end();
  }

  // 🕒 Norsk tid
  const now = new Date();
  const formattedTime = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Oslo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).format(now).replace('T', ' ').replace(/\./g, '-');

  const ipRaw = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
  const ip = ipRaw.split(',')[0].trim();
  const userAgent = req.headers['user-agent'] || '';

  // 🚀 Send logg til Google Sheets
  const logData = { brikke: subdomain, tidspunkt: formattedTime, ip, enhet: userAgent };

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

  // ➡️ Redirect
  res.redirect(302, reviewLinks[subdomain]);
});

app.listen(PORT, () => {
  console.log(`🚀 NFC redirect app kjører på port ${PORT}`);
});
