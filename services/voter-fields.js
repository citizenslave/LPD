'use strict';

const EventEmitter = require('events');
class VoterFieldsEmitter extends EventEmitter {}
const fieldsEmitter = new VoterFieldsEmitter();

const UsersService = require('./users');
const PermissionService = require('./permissions');
const ENCRYPTION = require('../utils/encryption');

module.exports = class VoterFieldService {
	static #db;

	static voterFieldViews;
	static voterFieldTypes;
	static voterFields;
	static voterFieldValues;

	static connect(_db) {
		VoterFieldService.#db = _db;

		if (!_db) return;

		VoterFieldService.getVoterFieldViews();
		VoterFieldService.getVoterFieldTypes();
		VoterFieldService.getVoterFields();
		// VoterFieldService.getVoterFieldValues();
	}

	static getVoterFieldViews(req, res) {
		if (res && !VoterFieldService.#db) return res.status(500).send('DB not ready');
		if (res && !req.session.sessionKey) return res.status(401).send('No user logged in');

		VoterFieldService.#db.collection('voterFieldViews').find({}).toArray((err, results) => {
			if (err) return console.log('Error retrieving voter field views:', err);
			VoterFieldService.voterFieldViews = {};
			results.forEach(view => VoterFieldService.voterFieldViews[view.label] = view.mask);

			console.log('Retrieving voter field views:', VoterFieldService.voterFieldViews);

			if (res) res.json(ENCRYPTION.encryptResponse(req, VoterFieldService.voterFieldViews));
		});
	}

	static getVoterFieldTypes(req, res) {
		if (res && !VoterFieldService.#db) return res.status(500).send('DB not ready');
		if (res && !req.session.sessionKey) return res.status(401).send('No user logged in');

		VoterFieldService.#db.collection('voterFieldTypes').find({}).toArray((err, results) => {
			if (err) return console.log('Error retrieving voter field types:', err);
			VoterFieldService.voterFieldTypes = {};
			results.forEach(type => VoterFieldService.voterFieldTypes[type.label] = type.typeId);

			console.log('Retrieving voter field types:', VoterFieldService.voterFieldTypes);

			if (res) res.json(ENCRYPTION.encryptResponse(req, VoterFieldService.voterFieldTypes));
			fieldsEmitter.emit('voterFieldTypes');
		});
	}

	static getVoterFields(req, res) {
		if (res && !VoterFieldService.#db) return res.status(500).send('DB not ready');
		if (res && !req.session.sessionKey) return res.status(401).send('No user logged in');

		VoterFieldService.#db.collection('voterFields').find({}).toArray((err, results) => {
			if (err) return console.log('Error retrieving voter fields:', err);
			VoterFieldService.voterFields = results;
			VoterFieldService.voterFields.forEach(field => delete field['_id']);

			console.log('Retrieving voter fields:', VoterFieldService.voterFields.length);

			if (res) res.json(ENCRYPTION.encryptResponse(req, VoterFieldService.voterFields));
			fieldsEmitter.emit('voterFields');
		});
	}

	static getVoterFieldValues(req, res) {
		if (res && !VoterFieldService.#db) return res.status(500).send('DB not ready');
		if (res && !req.session.sessionKey) return res.status(401).send('No user logged in');

		if (res && VoterFieldService.voterFieldValues) return res.json(ENCRYPTION.encryptResponse(req, VoterFieldService.voterFieldValues));

		console.log('Getting field values...');
		if (!VoterFieldService.voterFieldTypes || !Object.keys(VoterFieldService.voterFieldTypes).length) {
			console.log('Field types not ready...');
			fieldsEmitter.once('voterFieldTypes', () => {
				VoterFieldService.getVoterFieldValues(req, res);
			});
			return;
		}
		if (!VoterFieldService.voterFields || !VoterFieldService.voterFields.length) {
			console.log('Fields not ready...');
			fieldsEmitter.once('voterFields', () => {
				VoterFieldService.getVoterFieldValues(req, res);
			});
			return;
		}

		console.log('Fields ready, getting values...');
		var multiSelectFields = VoterFieldService.voterFields
				.filter(field => field.type === VoterFieldService.voterFieldTypes.MULTISELECT)
				.map(field => field.field);

		console.log('Fields sorted, getting values for fields:', multiSelectFields);
		var voterFieldValues = {};
		VoterFieldService.getFieldValues(req, res, multiSelectFields, voterFieldValues);
	}

	static getFieldValues(req, res, fields, values) {
		if (res && !fields.length) return res.json(ENCRYPTION.encryptResponse(req, VoterFieldService.voterFieldValues = values));
		if (!res && !fields.length) return console.log(VoterFieldService.voterFieldValues = values, '\nField values retrieved');

		var field = fields.pop();
		console.log(`Getting field values for ${field}`);
		VoterFieldService.#db.collection('voters').distinct(field, (err, results) => {
			values[field] = results.sort().map(value => {
				return { 'label': value, 'value': value };
			});
			console.log(`Values returned for ${field}:`, results);
			VoterFieldService.getFieldValues(req, res, fields, values);
		});
	}

	static getVoterSearchValues(req, res) {
		if (!VoterFieldService.#db) return res.status(500).send('DB not ready');
		if (!req.session.sessionKey) return res.status(500).send('No user logged in');

		var decryptedPayload = ENCRYPTION.decryptRequest(req);
		if (!decryptedPayload.field) return res.status(400).send('No field requested');

		let aorQueryReq = {
			'session': req.session,
			'params': {
				'permission': PermissionService.getMask('VOTER_SEARCH')
			}
		};
		let aorQueryRes = {
			'status': res.status,
			'json': function(data) {
				console.log(req.session.aorQuery);

				console.log(`Requesting field values for ${decryptedPayload.field}`);
				console.log(`Limiting Query:\n`,decryptedPayload.query);

				if (!decryptedPayload.query['$and']) decryptedPayload.query['$and'] = [];
				decryptedPayload.query['$and'].push({
					'$or': [ { 'deleted': false }, { 'deleted': { '$exists': false } } ]
				});

				if (PermissionService.isForbidden(req.session.permissions, 'SYSADMIN') &&
						PermissionService.isForbidden(req.session.permissions, 'USRMGMT')) {
					if (!decryptedPayload.query) decryptedPayload.query = req.session.aorQuery;
					else if (!decryptedPayload.query['$or']) decryptedPayload.query['$or'] = req.session.aorQuery['$or'];
					else if (decryptedPayload.query['$and']) decryptedPayload.query['$and'].push(req.session.aorQuery);
					else {
						decryptedPayload.query['$and'] = [
							{ '$or': decryptedPayload.query['$or'] },
							req.session.aorQuery
						];
						delete decryptedPayload.query['$or'];
					}
				}

				console.log('AOR limiting query:\n', decryptedPayload.query);

				VoterFieldService.#db.collection('voters').distinct(decryptedPayload.field, decryptedPayload.query, (err, results) => {
					var response = {};
					response[decryptedPayload.field] = results.sort()
							.filter(value => value !== null && value !== undefined && (value.length || value === false))
							.map(value => {
						return { 'label': value, 'value': value };
					});
					console.log(response);
					res.json(ENCRYPTION.encryptResponse(req, response));
				});
			}
		}

		UsersService.getAor(aorQueryReq, aorQueryRes);
	}
}