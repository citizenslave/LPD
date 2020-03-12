const express = require('express');
const fs = require('fs');
const https = require('https');
const app = new express();

const httpsOptions = {
    'key': fs.readFileSync('./ssl/privkey1.pem'),
    'cert': fs.readFileSync('./ssl/cert1.pem')
};
app.get('*',(req, res) => res.send('Server updating.  Please check back later.'));
app.listen(80);
https.createServer(httpsOptions, app).listen(443);