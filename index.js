const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

const reviewLinks = {
  kunde1: 'https://g.page/r/xxxxxxxx',
  kunde2: 'https://g.page/r/yyyyyyyy',
  kunde3: 'https://g.page/r/zzzzzzzz',
};

app.use((req, res) => {
  const host = req.headers.host || '';
  const subdomain = host.split('.')[0];
  const timestamp = new Date().toISOString();
  const userAgent = req.headers['user-agent'];
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  console.log(`[${timestamp}] Brikke: ${subdomain}, IP: ${ip}, UA: ${userAgent}`);

  const target = reviewLinks[subdomain] || 'https://kunda.no';
  res.redirect(302, target);
});

app.listen(PORT, () => {
  console.log(`Redirect app running on port ${PORT}`);
});
