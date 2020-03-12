'use strict';

const ENCRYPTION = require('../utils/encryption');

module.exports = class PermissionService {
	static #db;

	static #permissions;

	static connect(_db) {
		PermissionService.#db = _db;

		if (_db) PermissionService.getPermissions();
	}

	static getPermissions(req, res) {
		if (res && !PermissionService.#db) return res.status(500).send('DB not ready');
		if (res && !PermissionService.#permissions) return res.status(500).send('Permissions not ready');
		if (res && !req.session.sessionKey) return res.status(401).send('No user logged in');

		PermissionService.#db.collection('permissions').find({}).toArray((err, results) => {
			if (err) return console.log('Error retrieving permissions:', err);
			PermissionService.#permissions = {};
			results.forEach(permission =>
				PermissionService.#permissions[permission.label] = { 'mask': permission.mask, 'aor': permission.aor });

			console.log(`Retrieving permissions:`, PermissionService.#permissions);

			if (res) res.json(ENCRYPTION.encryptResponse(req, PermissionService.#permissions));
		});
	}

	static isForbidden(permissions, mask) {
		var masks = mask.split('|');
		var maskMix = PermissionService.#permissions['NOOP'].mask;
		masks.forEach(item => maskMix |= PermissionService.#permissions[item].mask);
		return ((permissions & maskMix) !== maskMix) && !(permissions & PermissionService.#permissions['SYSADMIN'].mask);
	}

	static getMask(permission) {
		return PermissionService.#permissions[permission].mask;
	}
}