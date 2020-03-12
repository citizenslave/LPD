const EXPRESS = require('express');
const APP = new EXPRESS();
const HTTP = require('http');
const HTTPS = require('https');
const FS = require('fs');

const httpsOptions = {
	'key': FS.readFileSync('./ssl/privkey1.pem'),
	'cert': FS.readFileSync('./ssl/cert1.pem')
};

APP.get('*.*', EXPRESS.static(__dirname+'/lpd-app/dist/lpd-app'));
APP.all('*', (req, res) => {
	res.status(200).sendFile('/', { 'root': __dirname+'/lpd-app/dist/lpd-app' });
});

const HTTPApp = new EXPRESS();
HTTPApp.all('*', (req, res) => { res.redirect(301, `https://${req.hostname+req.originalUrl}`) });
HTTPApp.listen(80, () => { console.log('Redirecting port 80...') });

HTTPS.createServer(httpsOptions, APP)
		.listen(443, () => { console.log('Listening for HTTPS on 443...') });