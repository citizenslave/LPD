'use strict';

const ObjectID = require('mongodb').ObjectID;

const ENCRYPTION = require('../utils/encryption');

const PermissionService = require('./permissions');
const VoterFieldService = require('./voter-fields');
const UsersService = require('./users');

const _fieldLookup = Symbol('fieldLookup');
const _serviceError = Symbol('serviceError');

module.exports = class VotersService {
	static #db;

	static connect(_db) {
		VotersService.#db = _db;
	}

	static find(req, res) {
		if (!VotersService.#db) return res.status(500).send('DB not ready');
		if (!req.session.sessionKey) return res.status(401).send('No user logged in');
		if (PermissionService.isForbidden(req.session.permissions, 'VOTER_SEARCH'))
			return res.status(403).send('Unauthorized operation for user');

		if (!req.body) return res.status(400).send('No query');
		if (!req.body.iv) return res.status(400).send('No encrypted query');

		var decryptedPayload = ENCRYPTION.decryptRequest(req);
		console.log(`Decrypted payload to ${req.url}:\n${JSON.stringify(decryptedPayload)}`);

		var first = decryptedPayload.first;
		var rows = decryptedPayload.rows;
		decryptedPayload = decryptedPayload.query;

		Object.getOwnPropertyNames(decryptedPayload).forEach(key => {
			var field = VotersService[_fieldLookup](key);
			if (!field || field.type === VoterFieldService.voterFieldTypes.DEFAULT) return;
			var comparisons = ['<', '>'];
			if (comparisons.includes(decryptedPayload[key][0]) && field.type === VoterFieldService.voterFieldTypes.FUZZY) {
				var textIndex = 1;
				var equals = '';
				var queryText = {};
				if (decryptedPayload[key][1] === '=') textIndex = 2;
				if (textIndex > 1) equals = 'e';
				if (decryptedPayload[key][0] === '<') queryText['$lt'+equals] = decryptedPayload[key].substr(textIndex);
				else queryText['$gt'+equals] = decryptedPayload[key].substr(textIndex);
				decryptedPayload[key] = queryText;
			} else if (field.type === VoterFieldService.voterFieldTypes.FUZZY) {
				decryptedPayload[key] = new RegExp(`.*${decryptedPayload[key]}.*`, 'i');
			} else if (field.type === VoterFieldService.voterFieldTypes.CALENDAR) {
				if (!decryptedPayload[key] instanceof Object) decryptedPayload[key] = new Date(decryptedPayload[key]);
				else Object.keys(decryptedPayload[key])
						.forEach(subKey => decryptedPayload[key][subKey] = new Date(decryptedPayload[key][subKey]));
			} else if (field.type === VoterFieldService.voterFieldTypes.ARRAY) {
				decryptedPayload[key] = { '$all': decryptedPayload[key] };
			}
		});
		console.log('Mapped query:', decryptedPayload);
		decryptedPayload['$or'] = [ { 'deleted': false }, { 'deleted': { '$exists': false } } ];

		let aorQueryReq = {
			'session': req.session,
			'params': {
				'permission': PermissionService.getMask('VOTER_SEARCH')
			}
		};
		let aorQueryRes = {
			'status': res.status,
			'json': function(data) {
				console.log('AOR Query:', req.session.aorQuery);

				if (PermissionService.isForbidden(req.session.permissions, 'SYSADMIN')) {
					if (!decryptedPayload) decryptedPayload = req.session.aorQuery;
					else if (!decryptedPayload['$or']) decryptedPayload['$or'] = req.session.aorQuery['$or'];
					else if (decryptedPayload['$and']) decryptedPayload['$and'].push(req.session.aorQuery);
					else {
						console.log('existing $or:\n%j', decryptedPayload['$or']);
						console.log('aor $or:\n%j', req.session.aorQuery['$or']);
						decryptedPayload['$and'] = [
							{ '$or': decryptedPayload['$or'] },
							req.session.aorQuery
						];
						delete decryptedPayload['$or'];
					}
				}

				console.log('Mapped AOR Query:\n%j', decryptedPayload);

				var cursor = VotersService.#db.collection('voters').find(decryptedPayload, { 'allowDiskUse': true });
				cursor.count().then(count => {
					console.log(`Found ${count} results`);
					cursor.skip(first).limit(rows).toArray((err, results) => {
						if (err) return VotersService[_serviceError](req, res, err);
						let aorCheckReq = {
							'session': req.session,
							'params': {
								'permission': PermissionService.getMask('VOTER_EDIT')
							}
						};
						let aorCheckRes = {
							'status': res.status,
							'json': function(data) {
								console.log('Retrieved edit AOR:\n%j', req.session.aorQuery);
								let resultIds = results.map(item => ObjectID(item['_id']));
								let editQuery = {
									'_id': { '$in': resultIds },
									'$or': req.session.aorQuery['$or']
								};
								console.log('Edit AOR query:\n%j', editQuery);
								VotersService.#db.collection('voters').find(editQuery, { 'allowDiskUse': true })
										.skip(first).limit(rows).toArray((err, editResults) => {
									let editIds = editResults.map(item => item['_id'].toString());
									let editable = 0;
									results.map(item => {
										if (editIds.includes(item['_id'].toString()) || 
												!PermissionService.isForbidden(req.session.permissions, 'SYSADMIN')) {
											item['canEdit'] = true;
											editable++;
										}
									});
									console.log(`${editable} editable records`);
									var response = {
										'count': count,
										'results': results
									};
									res.json(ENCRYPTION.encryptResponse(req, response));
								});
							}
						};
						UsersService.getAor(aorCheckReq, aorCheckRes);
					});
				});
			}
		}
		UsersService.getAor(aorQueryReq, aorQueryRes);
	}

	static update(req, res) {
		if (!VotersService.#db) return res.status(500).send('DB not ready');
		if (!req.session.sessionKey) return res.status(401).send('No user');
		if (PermissionService.isForbidden(req.session.permissions, 'VOTER_SEARCH|VOTER_EDIT'))
			return res.status(403).send('Unauthorized operation for user');

		if (!req.body) return res.status(400).send('No query');
		if (!req.body.iv) return res.status(400).send('No encrypted query');

		var decryptedPayload = ENCRYPTION.decryptRequest(req);
		let aorQueryReq = {
			'session': req.session,
			'params': {
				'permission': PermissionService.getMask('VOTER_EDIT')
			}
		};
		let aorQueryRes = {
			'status': res.status,
			'json': function(data) {
				console.log('AOR query:%j', req.session.aorQuery);

				let aorQuery = {
					'_id': new ObjectID.createFromHexString(decryptedPayload['_id']),
					'$or': req.session.aorQuery['$or']
				};
				if (!PermissionService.isForbidden(req.session.permissions, 'SYSADMIN')) {
					aorQuery['$or'].push({ '_id': { '$exists': true } });
					console.log('SYSADMIN permission:%j', aorQuery);
				}

				VotersService.#db.collection('voters').find(aorQuery).count().then(count => {
					if (!count) return res.status(403).send('Unauthorized operation for user/record');

					console.log(`Updating voter record: ${decryptedPayload['VOTER ID']}`);

					decryptedPayload['timestamp'] = Date.now();
					decryptedPayload['updatedAt'] = new Date();
					decryptedPayload['updatedBy'] = req.session.username;
					delete decryptedPayload['_id'];

					VotersService.#db.collection('voters').updateMany({ 'VOTER ID': decryptedPayload['VOTER ID'] },
							{ '$set': { 'deleted': true } }, (err, deleteResult) => {
						VotersService.#db.collection('voters').insertOne(decryptedPayload, (err, results) => {
							if (err) return VotersService[_serviceError](req, res, err);
							res.json(ENCRYPTION.encryptResponse(req, decryptedPayload));
						});
					});
				});
			}
		}
		UsersService.getAor(aorQueryReq, aorQueryRes);
	}

	static [_fieldLookup](fieldName) {
		return VoterFieldService.voterFields?VoterFieldService.voterFields.filter(field => field.field === fieldName)[0]:false;
	}

	static [_serviceError](req, res, err) {
		console.log(`Error servicing request to ${req.url}:`, err);
		return res.status(500).send('Error running query');
	}
}
