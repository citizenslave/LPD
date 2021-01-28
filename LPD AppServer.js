'use strict';

const MongoClient = require('mongodb').MongoClient;
const MONGO_URL = require('./config/db-config');
const DB_NAME = 'LPD';
const DB_OPTIONS = {
	'useNewUrlParser': true
};

const Express = require('express');
const HTTPS = require('https');
const FS = require('fs');
const App = new Express();
const PORT = 443;
const httpsOptions = {
	'key': FS.readFileSync('./ssl/privkey.pem'),
	'cert': FS.readFileSync('./ssl/fullchain.pem')
};

const UI_URL = require('./config/ui-config');
const CORS = require('cors');
const CORS_OPTIONS = {
	'origin': UI_URL,
	'optionsSuccessStatus': 200,
	'credentials': true
};

const SESSION = require('express-session');
const MONGO_STORE = require('connect-mongo')(SESSION);

const GMailer = require('./utils/gmailer');
const ENCRYPTION = require('./utils/encryption');

const yargs = require('yargs');
const passphrase = yargs.argv._[0];
const doSync = yargs.argv._[1] === 'doSync';

App.use(Express.json());
App.use(Express.urlencoded({ 'extended': true }));
App.use(CORS(CORS_OPTIONS));
App.use(SESSION({
	'secret': 'LPD',
	'store': new MONGO_STORE({ 'url': MONGO_URL }),
	'saveUninitialized': false,
	'resave': false
}));

const defCon = console;
console = new console.Console(
		require('fs').createWriteStream(__dirname+'/logs/appserver.log', { 'flags': 'a' }),
		process.stderr);

App.get('/api', (req, res) => {
	res.send('OK');
});
const PermissionService = require('./services/permissions');
App.get('/api/permissions/get', PermissionService.getPermissions);

const VoterFieldService = require('./services/voter-fields');
App.get('/api/voterFields/getViews', VoterFieldService.getVoterFieldViews);
App.get('/api/voterFields/getTypes', VoterFieldService.getVoterFieldTypes);
App.get('/api/voterFields/get', VoterFieldService.getVoterFields);
App.get('/api/voterFields/getValues', VoterFieldService.getVoterFieldValues);
App.post('/api/voterFields/getValues', VoterFieldService.getVoterSearchValues);

const UsersService = require('./services/users');
UsersService.initMailer();
UsersService.setPassphrase(passphrase);
App.get('/api/users/logout', UsersService.logout);
App.get('/api/users/key', UsersService.getPublicKey);
App.post('/api/users/session', UsersService.session);
App.post('/api/users/login', UsersService.login);
App.post('/api/users/register', UsersService.register);
App.post('/api/users/lookupToken/:token', UsersService.lookupToken);
App.post('/api/users/password/:token', UsersService.setPassword);
App.get('/api/users/permissions', UsersService.permissions);
App.get('/api/users/getAor/:permission', UsersService.getAor);
App.get('/api/users/getCallSheetLink', UsersService.getCallSheetLink);
App.put('/api/users/setCallSheetLink', UsersService.setCallSheetLink);
App.get('/api/users/getAllUsers', UsersService.getAllUsers);
App.post('/api/users/loadUserAor', UsersService.loadUserAor);
App.post('/api/users/setPermissions', UsersService.setPermissions);
App.post('/api/users/setAor', UsersService.setAor);

const VotersService = require('./services/voters');
App.post('/api/voters/search', VotersService.find);
App.put('/api/voters/update', VotersService.update);

const LegislativeService = require('./services/legislative');
App.get('/api/legis/startLegSync', LegislativeService.startLegSync);
App.get('/api/legis/checkSync', LegislativeService.checkSync);
App.post('/api/legis/getLegislation', LegislativeService.getLegislation);
App.get('/api/legis/getCommitteeDetails/:committeeId', LegislativeService.getCommitteeDetails);
App.get('/api/legis/getLegislatorInfo/:shortName', LegislativeService.getLegislatorInfo);
App.get('/api/legis/cacheLegislatorImage/:personId', LegislativeService.cacheLegislatorImage);
App.post('/api/legis/saveRating', LegislativeService.saveRating);
App.post('/api/legis/saveComment', LegislativeService.saveComment);
App.get('/api/legis/getRatings/:legislationId/:filter', LegislativeService.getRatings);
App.get('/api/legis/getComments/:legislationId/:filter', LegislativeService.getComments);
App.post('/api/legis/deleteComment', LegislativeService.deleteComment);

App.post('/api/legis/aggregationTest', LegislativeService.aggregationTest);

App.get('*.*', Express.static(__dirname+'/lpd-app/dist/lpd-app'));
App.all('*', (req, res) => {
	res.status(200).sendFile('/', { 'root': __dirname+'/lpd-app/dist/lpd-app' });
});

const HTTPApp = new Express();
HTTPApp.all('*', (req, res) => { res.redirect(301, `https://${req.hostname+req.originalUrl}`) });
HTTPApp.listen(80, () => { defCon.log('Redirecting port 80...') });

MongoClient.connect(MONGO_URL, DB_OPTIONS, (err, db) => {
	if (err) throw err;
	var dbConnection = db.db(DB_NAME);
	PermissionService.connect(dbConnection);
	VoterFieldService.connect(dbConnection);
	UsersService.connect(dbConnection);
	VotersService.connect(dbConnection);
	LegislativeService.connect(dbConnection);
	if (doSync)
		LegislativeService.doLegSync().then(json => {
			console.log(`${json.legislation.length} bills refreshed.\n`,
					`${json.legislators.length} legislators refreshed.\n`,
					`${json.committees.length} committees refreshed.`)
		});
	defCon.log(`DB ${DB_NAME} connected at:\nmongodb://${MONGO_URL.split('@')[1]}`);
	HTTPS.createServer(httpsOptions, App).listen(PORT, () => { defCon.log(`Servicing port ${PORT}...`) });
	syncCheck();
});

function syncCheck() {
	console.log('Sync time check. (2.00a - 2.30a?)');
	const now = new Date();
	if (now.getHours() !== 2) return setTimeout(syncCheck, 15*60000);;
	if (now.getMinutes() > 30) return setTimeout(syncCheck, 15*60000);;
	console.log('Time to sync. (Sync in progress?)');
	if (LegislativeService.getSyncStatus() !== '') return setTimeout(syncCheck, 15*60000);;
	const lastSync = new Date(LegislativeService.getLastSync());
	const elapsedSync = new Date(now - lastSync);
	console.log(`Last sync ${elapsedSync.getTime()}ms ago. (>1hr?)`)
	if (elapsedSync.getTime()/(60*1000) < 60) return setTimeout(syncCheck, 15*60000);;
	console.log('Starting sync.');
	LegislativeService.doLegSync().then(json => {
		console.log('Scheduled sync complete.');
		console.log(`${json.legislation.length} bills refreshed.\n`,
				`${json.legislators.length} legislators refreshed.\n`,
				`${json.committees.length} committees refreshed.`)
	});
	setTimeout(syncCheck, 15*60000);
}
