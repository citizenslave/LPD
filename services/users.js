'use strict';

const GMailer = require('../utils/gmailer');
const ENCRYPTION = require('../utils/encryption');

const PermissionService = require('./permissions');
const UI_URL = require('../config/ui-config');

const _processAor = Symbol('processAor');
const _sendToken = Symbol('sendToken');
const _serviceError = Symbol('serviceError');

const DEFAULT_LINK = 'https://hangouts.google.com/?action=chat&pn=';
const SET_DEFAULT_LINK = { '$set': { 'callSheetTemplate': DEFAULT_LINK } };

module.exports = class UsersService {
	static #db;
	static #mailer;
	static #passphrase;

	static initMailer() {
		this.#mailer = new GMailer();
	}

	static connect(_db) {
		UsersService.#db = _db;
	}

	static setPassphrase(passphrase) {
		UsersService.#passphrase = passphrase;
	}

	static logout(req, res) {
		if (!req.session) return res.json({ 'response': 'OK' });

		console.log(`Logout user: ${req.session.username}`);

		req.session.destroy();
		res.json({ 'response': 'OK' });
	}

	static getPublicKey(req, res) {
		console.log('Getting keys...');
		if (req.session.publicKey && req.session.privateKey) {
			console.log(`Session keys exist:\n${req.session.publicKey}\n${req.session.privateKey}`);
			return res.json({ 'publicKey': req.session.publicKey });
		}
		ENCRYPTION.generateKeys(UsersService.#passphrase).then(keys => {
			console.log(`Generated new keys:\n${keys.publicKey}\n${keys.privateKey}`);
			req.session.publicKey = keys.publicKey;
			req.session.privateKey = keys.privateKey;
			res.json({ 'publicKey': keys.publicKey });
		});
	}

	static session(req, res) {
		if (!UsersService.#db) return res.status(500).send('DB not ready');

		/**
		 * TODO: Invalid users will never establish a session key, will
		 * always be logged out, and then will generate new public keys
		 * when they retry, telegraphing that the username doesn't exist.
		 */
		if (!(req.session.sessionKey && req.session.username)) {
			if (req.session) req.session.destroy();
			return res.status(401).send('No session');
		}

		console.log('Retrieving session:', req.session.username);

		UsersService.#db.collection('users').find({
			'username': new RegExp(req.session.username, 'i')
		}).toArray((err, results) => {
			if (err) return UsersService[_serviceError](req, res, err);

			/**
			 * TODO: Even if we give them a bogus session key or don't
			 * check for one, there will be no user here and the session
			 * will again be destroyed, generating a new public key and
			 * telegraphing that the user doesn't exist.  If we don't
			 * destroy the session, then there is no way to correct an
			 * incorrect username.
			 */
			if (results.length !== 1) {
				req.session.destroy();
				return res.status(409).send('Invalid session');
			}

			/**
			 * Session has been compromised.  Someone has sniffed out the
			 * session ID and is trying to spoof it without a valid session
			 * password.  The session password is stored client-side in
			 * localStorage, but is never transmitted in the clear.
			 */
		 	var sessionPassword = ENCRYPTION.rsaDecrypt(req.session.privateKey, UsersService.#passphrase, req.body.esp);
			if (sessionPassword !== req.session.sessionPassword) {
				req.session.destroy();
				return res.status(401).send('Invalid session');
			}
			var publicKey = ENCRYPTION.rsaDecrypt(req.session.privateKey, UsersService.#passphrase, req.body.publicKey);

			req.session.permissions = results[0].permissions;
			var profileInfo = { 'username': results[0].username, 'permissions': results[0].permissions };
			res.json({
				'encryptedHash': ENCRYPTION.rsaEncrypt(publicKey, req.session.sessionKey),
				'encryptedProfile': ENCRYPTION.rsaEncrypt(publicKey, JSON.stringify(profileInfo))
			});
		});
	}

	static login(req, res) {
		if (!UsersService.#db) return res.status(500).send('DB not ready');
		if (!req.body.username) return res.status(400).send('No username');
		var username = ENCRYPTION.rsaDecrypt(req.session.privateKey, UsersService.#passphrase, req.body.username);

		UsersService.#db.collection('users').find({ 'username': new RegExp(username, 'i') }).toArray((err, results) => {
			if (err) return UsersService[_serviceError](req, res, err);
			if (results.length > 1) return res.status(409).send('Multiple users found');

			if (!req.body.hash) {
				console.log(`Find user: ${username}`);

				if (results.length === 1) return res.json({
					'publicKey': results[0].publicKey
				});

				/**
				 * TODO: This will never happen since sessions are getting
				 * destroyed when the page is reloaded, which is the only way
				 * to find another username once a bogus username generates a
				 * public key.  LoLWUT?
				 */
				if (req.body.username === req.session.username) {
					if (req.session.publicKey) return res.json({
						'publicKey': req.session.publicKey
					});
				}

				/**
				 * Generate a bogus key for an unknown username.  TODO: store
				 * the public key and return it anyway so there's no indication
				 * the username is bogus since now a new public key is returned
				 * on each attempt.
				 */
				ENCRYPTION.generateKeys(UsersService.#passphrase).then(keys => {
					req.session.publicKey = keys.publicKey;
					req.session.username = username;
					res.json({ 'publicKey': keys.publicKey });
				});
			} else {
				if (!results.length) return res.status(401).send('Invalid username/password');
				if (!req.body.sessionSalt) return res.status(400).send('No session salt');

				console.log(`Login user: ${username}`);

				var hash = ENCRYPTION.rsaDecrypt(results[0].privateKey, UsersService.#passphrase, req.body.hash);

				var pwHash = ENCRYPTION.saltPassword(hash, results[0].pwSalt).hash;
				if (pwHash !== results[0].hash) {
					req.session.destroy();
					return res.status(401).send('Invalid username/password');
				}
				var sessionSalt = ENCRYPTION.rsaDecrypt(results[0].privateKey, UsersService.#passphrase, req.body.sessionSalt);

				req.session.username = username;
				req.session.sessionKey = ENCRYPTION.saltPassword(hash, sessionSalt, 128/8).hash;
				req.session.permissions = results[0].permissions;
				req.session.sessionPassword = ENCRYPTION.saltPassword('').hash;
				var encryptedSessionPassword = ENCRYPTION.encryptResponse(req, { 'sessionPassword': req.session.sessionPassword });

				res.json({ 'response': 'OK', 'esp': encryptedSessionPassword });
			}
		});
	}

	static register(req, res) {
		if (!UsersService.#db) return res.status(500).send('DB not ready');
		if (!req.body.username) return res.status(400).send('No username');

		var username = ENCRYPTION.rsaDecrypt(req.session.privateKey, UsersService.#passphrase, req.body.username);
		UsersService.#db.collection('users').find({ 'username': new RegExp(username, 'i') }).toArray((err, results) => {
			if (err) return UsersService[_serviceError](req, res, err);

			ENCRYPTION.generateKeys(UsersService.#passphrase).then(keys => {
				var token = ENCRYPTION.signToken(keys.privateKey, UsersService.#passphrase, 'TAXATION IS THEFT');

				UsersService.#db.collection('users').updateOne({ 'username': new RegExp(username, 'i') }, {
					'$set': {
						'username': username,
						'publicKey': keys.publicKey,
						'privateKey': keys.privateKey,
						'token': token,
						'tokenTimestamp': (new Date()).getTime(),
						'permissions': results.length === 1?results[0].permissions:16,
						'callSheetTemplate': results.length === 1?results[0].callSheetTemplate:
								'https://hangouts.google.com/?action=chat&pn='
					}
				}, { 'upsert': true }, (err, result) => {
					if (err) return UsersService[_serviceError](req, res, err);

					UsersService[_sendToken](username, token).then(info => {
						console.log(`Email sent: ${info.statusText}`);
						res.json({ 'response': 'OK' });
					},
					err => {
						console.log(`Email not sent:\n${err}`);
						res.status(500).send('Error sending registration email');
					});
				});
			}, err => console.log(err));
		});
	}

	static lookupToken(req, res) {
		if (!UsersService.#db) return res.status(500).send('DB not ready');
		if (!(req.params && req.params.token)) return res.status(400).send('No token');

		UsersService.#db.collection('users').find({ 'token': req.params.token }).toArray((err, results) => {
			if (err) return UsersService[_serviceError](req, res, err);

			if (!results.length) return res.status(404).send('Invalid token (not found)');
			if (results.length !== 1) return res.status(409).send('Multiple users found');
			if (results[0]['tokenTimestamp'] < ((new Date()).getTime()) - 86400000)
				return res.status(401).send('Invalid token (expired)');

			console.log(`Token lookup: ${results[0].username}`);
			console.log('Client Public Key\n', req.body.publicKey);

			var clientPublicKey = ENCRYPTION.rsaDecrypt(req.session.privateKey, UsersService.#passphrase, req.body.publicKey);
			var username = ENCRYPTION.rsaEncrypt(clientPublicKey, results[0].username);
			var publicKey = results[0].publicKey;
			res.json({
				'username': username,
				'publicKey': publicKey
			});
		});
	}

	static setPassword(req, res) {
		if (!UsersService.#db) return res.status(500).send('DB not ready');
		if (!req.params.token) return res.status(400).send('No token');
		if (!req.body || !req.body.hash) return res.status(400).send('No hash');

		UsersService.#db.collection('users').find({ 'token': req.params.token }).toArray((err, results) => {
			if (err) return UsersService[_serviceError](req, res, err);

			if (!results.length) return res.status(404).send('Invalid token (not found)');
			if (results.length !== 1) return res.status(409).send('Multiple users found');
			if (results[0]['tokenTimestamp'] < ((new Date()).getTime()) - 86400000)
				return res.status(401).send('Invalid token (expired)');

			if (!ENCRYPTION.verifyToken(results[0]['publicKey'], req.params.token))
				return res.status(400).send('Invalid token (token cannot be verified');

			console.log(`Setting password: ${results[0].username}`);

			var hash = ENCRYPTION.rsaDecrypt(results[0].privateKey, UsersService.#passphrase, req.body.hash);
			var setInstructions = ENCRYPTION.saltPassword(hash);
			setInstructions['tokenTimestamp'] = (new Date()).getTime() - 86400000;
			var updateInstructions = { '$set': setInstructions };
			var updateSearch = { '_id': results[0]['_id'] };

			UsersService.#db.collection('users').updateOne(updateSearch, updateInstructions, (err, result) => {
				if (err) return UsersService[_serviceError](req, res, err);

				res.json({ 'response': 'OK' });
			});
		});
	}

	static permissions(req, res) {
		if (!UsersService.#db) return res.status(500).send('DB not ready');
		if (!req.session.username || !req.session.sessionKey) return res.status(401).send('No user logged in');

		console.log(`Get user permissions for: ${req.session.username}`);

		UsersService.#db.collection('users').find({ 'username': new RegExp(req.session.username, 'i') }).toArray((err, results) => {
			if (err) return UsersService[_serviceError](req, res, err);
			if (typeof results[0].permissions === 'undefined') return res.status(404).send('No permissions found');
			var response = ENCRYPTION.encryptResponse(req, { 'permissions': results[0].permissions });
			res.json(response);
		});
	}

	static getAor(req, res) {
		if (!UsersService.#db) return res.status(500).send('DB not ready');
		if (!req.session.username || !req.session.sessionKey) return res.status(401).send('No user logged in');

		console.log(`Get user ${req.params.permission} AOR for: ${req.session.username}`);
		var query = {
			'username': new RegExp(req.session.username, 'i'),
			'permission': Number(req.params.permission)
		};

		if (PermissionService.isForbidden(req.session.permissions, 'SYSADMIN')) {
			console.log('not sysadmin', req.session.permissions, query.permission, req.session.permissions & query.permission);
			if (!(req.session.permissions & query.permission)) {
				console.log('no edit permission');
				req.session.aorQuery = { '$or': [{ '_id': { '$exists': false } }] };
				return res.json({});
			}
		}

		UsersService.#db.collection('voterAor').find(query).toArray((err, results) => {
			if (err) return UsersService[_serviceError](req, res, err);
			console.log(results);
			UsersService[_processAor](req.session, results.length?results[0].aorValues:{});
			var response = ENCRYPTION.encryptResponse(req, results.length?results[0]:{});
			res.json(response);
		});
	}

	static loadUserAor(req, res) {
		if (!UsersService.#db) return res.status(500).send('DB not ready');
		if (!req.session.username || !req.session.sessionKey) return res.status(401).send('No user logged in');

		var request = ENCRYPTION.decryptRequest(req);
		console.log(`Load user ${request.permission} AOR for: ${request.username}`);
		var query = {
			'username': new RegExp(request.username, 'i'),
			'permission': request.permission
		};

		UsersService.#db.collection('voterAor').find(query).toArray((err, results) => {
			if (err) return UsersService[_serviceError](req, res, err);
			console.log(results);
			var response = ENCRYPTION.encryptResponse(req, results.length?results[0]:{});
			res.json(response);
		});
	}

	static getCallSheetLink(req, res) {
		if (!UsersService.#db) return res.status(500).send('DB not ready');
		if (!req.session.username || !req.session.sessionKey) return res.status(401).send('No user logged in');
		if (PermissionService.isForbidden(req.session.permissions, 'VOTER_SEARCH'))
			return res.status(403).send('Unauthorized operation for user');

		UsersService.#db.collection('users').find({ 'username': new RegExp(req.session.username, 'i') }).toArray((err, results) => {
			if (err) return UsersService[_serviceError](req, res, err);
			if (typeof results[0]['callSheetTemplate'] === 'undefined') {
				UsersService.#db.collection('users').updateOne(
						{ 'username': new RegExp(req.session.username, 'i') },
						SET_DEFAULT_LINK,
						(err, response) => {
							console.log(`No link configured for user ${req.session.username}.  Setting default.`);
							res.json(ENCRYPTION.encryptResponse(req, { 'callSheetTemplate': DEFAULT_LINK }));
						});
			} else {
				console.log(`Getting call sheet link template for ${req.session.username}:`,
						results[0]['callSheetTemplate']);
				res.json(ENCRYPTION.encryptResponse(req,
						{ 'callSheetTemplate': results[0]['callSheetTemplate'] }));
			}
		});
	}

	static setCallSheetLink(req, res) {
		if (!UsersService.#db) return res.status(500).send('DB not ready');
		if (!req.session.username || !req.session.sessionKey) return res.status(401).send('No user logged in');
		if (PermissionService.isForbidden(req.session.permissions, 'VOTER_SEARCH'))
			return res.status(403).send('Unauthorized operation for user');

		console.log(`Updating call sheet link template for user ${req.session.username}`);

		UsersService.#db.collection('users').updateOne(
				{ 'username': new RegExp(req.session.username, 'i') },
				{ '$set': ENCRYPTION.decryptRequest(req) },
				(err, result) => {
					if (err) UsersService[_serviceError](req, res, err);
					res.json(ENCRYPTION.encryptResponse(req, { 'response': 'OK' }));
				});
	}

	static getAllUsers(req, res) {
		if (!UsersService.#db) return res.status(500).send('DB not ready');
		if (!req.session.username || !req.session.sessionKey) return res.status(401).send('No user logged in');
		if (PermissionService.isForbidden(req.session.permissions, 'USRMGMT'))
			return res.status(403).send('Unauthorized operation for user');

		console.log(`Getting all users list`);

		UsersService.#db.collection('users').find().toArray((err, results) => {
			var response = results.map(user => {
				return { 'username': user.username, 'permissions': user.permissions };
			});
			res.json(ENCRYPTION.encryptResponse(req, response));
		});
	}

	static setPermissions(req, res) {
		if (!UsersService.#db) return res.status(500).send('DB not ready');
		if (!req.session.username || !req.session.sessionKey) return res.status(401).send('No user logged in');
		if (PermissionService.isForbidden(req.session.permissions, 'USRMGMT'))
			return res.status(403).send('Unauthorized operation for user');

		var request = ENCRYPTION.decryptRequest(req);
		console.log(`Setting permissions ${request.permissions} for user ${request.username}`);

		UsersService.#db.collection('users').updateOne(
				{ 'username': new RegExp(request.username, 'i') },
				{ '$set': { 'permissions': request.permissions } },
				(err, results) => {
					if (err) return UsersService[_serviceError](req, res, err);
					res.json({ 'response': 'OK' });
				});
	}

	static setAor(req, res) {
		if (!UsersService.#db) return res.status(500).send('DB not ready');
		if (!req.session.username || !req.session.sessionKey) return res.status(401).send('No user logged in');
		if (PermissionService.isForbidden(req.session.permissions, 'USRMGMT'))
			return res.status(403).send('Unauthorized operation for user');

		var request = ENCRYPTION.decryptRequest(req);
		console.log(`Setting user ${request.permission} AOR:`);
		console.log(request);
		var query = {
			'username': new RegExp(request.username, 'i'),
			'permission': request.permission
		};

		var newAorObj = {
			'username': request.username,
			'permission': request.permission,
			'aorValues': []
		};

		newAorObj.aorValues = request.aorValues.map(aorValue => {
			var newValue = {};
			var aorKeys = Object.keys(aorValue);
			console.log('AOR keys:', aorKeys);
			aorKeys.forEach(key => {
				if (aorValue[key].length) newValue[key] = aorValue[key];
			});
			return newValue;
		});
		console.log('New AOR obj:%j', newAorObj);

		UsersService.#db.collection('voterAor').replaceOne(query, newAorObj, { 'upsert': true }, (err, result) => {
			if (err) return UsersService[_serviceError](req, res, err);
			res.json({ 'response': 'OK' });
		});
	}

	static [_processAor](session, aorValues) {
		let sessionQuery = [];
		if (!(aorValues instanceof Array)) aorValues = [aorValues];
		aorValues.forEach(aorItem => {
			let itemQuery = [];
			Object.keys(aorItem).forEach(field => {
				let fieldQuery = []
				aorItem[field].forEach(aor => {
					let termQuery = [];
					aor.split('/').forEach(condition => {
						let query = condition.split(':');
						let term = {};
						term[query[0]] = query[1];
						termQuery.push(term);
					});
					termQuery = { '$and': termQuery };
					fieldQuery.push(termQuery);
				});
				fieldQuery = { '$or': fieldQuery };
				itemQuery.push(fieldQuery);
			});
			if (!itemQuery.length) itemQuery.push({ '_id': { '$exists': true } });
			itemQuery = { '$and': itemQuery };
			sessionQuery.push(itemQuery);
		});
		sessionQuery = { '$or': sessionQuery };
		session.aorQuery = sessionQuery;
	}

	static [_sendToken](username, token) {
		var htmlText = `<a href='${UI_URL}/password/${token}'>Click here</a> to set your password within 24 hours.`;
		return this.#mailer.sendMail(username, 'Password Link', htmlText);
	}

	static [_serviceError](req, res, err) {
		console.log(`Error servicing request to ${req.url}:`, err);
		return res.status(500).send('Error running query');
	}
}
