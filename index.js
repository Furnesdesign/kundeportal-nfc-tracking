const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Juster mapping her
const reviewLinks = {
  kunde1: 'https://g.page/r/xxxxxxxx',
  kunde2: 'https://g.page/r/yyyyyyyy',
  kunde3: 'https://g.page/r/zzzzzzzz',
};

app.use((req, res) => {
  const host = req.headers.host || '';
  const subdomain = host.split('.')[0];

  // Juster til norsk tid (UTC+2 om sommeren)
  const timestampUTC = new Date();
  const timestampLocal = new Date(timestampUTC.getTime() + 2 * 60 * 60 * 1000);
  const formattedTime = timestampLocal.toISOString().replace('T', ' ').substring(0, 19);

  const ipRaw = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
  const ip = ipRaw.split(',')[0].trim(); // bare første IP

  const userAgent = req.headers['user-agent'] || '';

  console.log(
    `\n--- Bruk av NFC-brikke ---\n` +
    `Brikke: ${subdomain}\n` +
    `Tidspunkt: ${formattedTime} (Norsk tid)\n` +
    `IP-adresse: ${ip}\n` +
    `Enhet: ${userAgent}\n`
  );

  const target = reviewLinks[subdomain] || 'https://kunda.no';
  res.redirect(302, target);
});

app.listen(PORT, () => {
  console.log(`Redirect app running on port ${PORT}`);
});
