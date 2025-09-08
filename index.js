const express = require('express');
const fetch = require('node-fetch');
const { AbortController } = require('abort-controller');
const http = require('http');

const app = express();
app.set('trust proxy', true);

// hold forbindelser varme mot Apps Script (litt raskere)
const keepAliveAgent = new http.Agent({ keepAlive: true });

const reviewLinks = {
  '100': 'https://www.vg.no/',
  '101': 'https://www.smp.no/',
  '102': 'https://www.db.no/'
};

const webhookUrl = 'https://script.google.com/macros/s/AKfycbxUTIx2Pyhj2C4HSTucFfgP3cAyVJ8heihpwyqAMYUx3PObs7p0SLyqctiQC26sk5Rx/exec';

app.get('/', (req, res) => {
  const host = req.headers.host || '';
  const subdomain = (host.split('.')[0] || '').toString();
  const target = reviewLinks[subdomain];

  if (!target) return res.status(204).end();

  // --- 1) Send redirect med én gang (ikke vent på logging) ---
  res.redirect(302, target);

  // --- 2) Logg i bakgrunnen (fire-and-forget) ---
  const now = new Date();
  const tidspunkt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).format(now).replace(' ', ' ').replace(/\./g, '-');

  const ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress || '').split(',')[0].trim();
  const enhet = req.headers['user-agent'] || '';

  const logData = { brikke: subdomain, tidspunkt, ip, enhet };

  // Sett en kort timeout slik at logging aldri henger
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1000); // 1s

  fetch(webhookUrl, {
    method: 'POST',
    body: JSON.stringify(logData),
    headers: { 'Content-Type': 'application/json' },
    agent: keepAliveAgent,
    signal: controller.signal
  }).catch(err => {
    console.error('Sheets log failed:', err?.name || err);
  }).finally(() => clearTimeout(timeout));
});
