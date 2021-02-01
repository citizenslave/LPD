'use strict';

const MongoClient = require('mongodb').MongoClient;
const MONGO_URL = require('../config/db-config');
const DB_NAME = 'LPD';
const DB_OPTS = {
	'useNewUrlParser': true
};

const permissions = {
	'collection': 'permissions',
	'values': [
		{ 'label': 'NOOP', 'mask': 0x00, 'aor': false },
		{ 'label': 'SYSADMIN', 'mask': 0x01, 'aor': false },
		{ 'label': 'USRMGMT', 'mask': 0x02, 'aor': false },
		{ 'label': 'VOTER_SEARCH', 'mask': 0x04, 'aor': true },
		{ 'label': 'VOTER_EDIT', 'mask': 0x08, 'aor': true },
		{ 'label': 'LEG', 'mask': 0x10, 'aor': false }
	]
};

const voterFieldViews = {
	'collection': 'voterFieldViews',
	'values': [
		{ 'label': 'NONE', 'mask': 0x00 },
		{ 'label': 'SEARCH', 'mask': 0x01 },
		{ 'label': 'RESULT', 'mask': 0x02 },
		{ 'label': 'VIEWER', 'mask': 0x04 }
	]
};

const voterFieldTypes = {
	'collection': 'voterFieldTypes',
	'values': [
		{ 'label': 'DEFAULT', 'typeId': 0x00 },
		{ 'label': 'BOOLEAN', 'typeId': 0x01 },
		{ 'label': 'MULTISELECT', 'typeId': 0x02 },
		{ 'label': 'FUZZY', 'typeId': 0x03 },
		{ 'label': 'TEXT', 'typeId': 0x04 },
		{ 'label': 'CALENDAR', 'typeId': 0x05 },
		{ 'label': 'ARRAY', 'typeId': 0x06}
	]
};

function parseMask(collection, maskTags) {
	var mask = 0;
	var tags = maskTags.split('|');
	collection.values.forEach(value => {
		if (tags.includes(value.label) || maskTags === 'ALL') mask |= value.mask;
	});
	return mask;
}

function parseType(collection, tag) {
	return collection.values.filter(value => value.label === tag)[0].typeId;
}

const voterFields = {
	'collection': 'voterFields',
	'values': [
		{ 'label': 'Verified', 'field': 'verified', 'clear': false, 'order': 0,
				'display': parseMask(voterFieldViews, 'ALL'), 'canEdit': true,
				'type': parseType(voterFieldTypes, 'BOOLEAN') },
		{ 'label': 'Updated By', 'field': 'updatedBy', 'clear': false, 'order': 1,
				'display': parseMask(voterFieldViews, 'SEARCH|VIEWER'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'MULTISELECT') },
		{ 'label': 'Updated At', 'field': 'updatedAt', 'clear': false, 'order': 2,
				'display': parseMask(voterFieldViews, 'SEARCH|VIEWER'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'CALENDAR') },
		{ 'label': 'Voter ID', 'field': 'VOTER ID', 'clear': false, 'order': 3,
				'display': parseMask(voterFieldViews, 'SEARCH|VIEWER'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'DEFAULT') },

		{ 'label': 'Last Name', 'field': 'LAST-NAME', 'clear': true, 'order': 4,
				'display': parseMask(voterFieldViews, 'ALL'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'FUZZY') },
		{ 'label': 'First Name', 'field': 'FIRST-NAME', 'clear': false, 'order': 5,
				'display': parseMask(voterFieldViews, 'ALL'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'FUZZY') },
		{ 'label': 'Middle Name', 'field': 'MID-NAME', 'clear': false, 'order': 6,
				'display': parseMask(voterFieldViews, 'SEARCH|VIEWER'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'FUZZY') },
		{ 'label': 'Suffix', 'field': 'SUFFIX', 'clear': false, 'order': 7,
				'display': parseMask(voterFieldViews, 'SEARCH|VIEWER'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'FUZZY') },

		{ 'label': 'Date of Birth', 'field': 'DATE-OF-BIRTH', 'clear': true, 'order': 8,
				'display': parseMask(voterFieldViews, 'SEARCH|VIEWER'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'CALENDAR') },
		{ 'label': 'Birth Year', 'field': 'BIRTH-YEAR', 'clear': false, 'order': 9,
				'display': parseMask(voterFieldViews, 'ALL'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'MULTISELECT') },

		{ 'label': 'Phone Number', 'field': 'PHONE', 'clear': true, 'order': 10,
				'display': parseMask(voterFieldViews, 'SEARCH|VIEWER'), 'canEdit': true,
				'type': parseType(voterFieldTypes, 'DEFAULT') },
		{ 'label': 'Email Address', 'field': 'email', 'clear': false, 'order': 11,
				'display': parseMask(voterFieldViews, 'SEARCH|VIEWER'), 'canEdit': true,
				'type': parseType(voterFieldTypes, 'FUZZY') },

		{ 'label': 'Home Number', 'field': 'HOME-NO', 'clear': true, 'order': 12,
				'display': parseMask(voterFieldViews, 'SEARCH|VIEWER'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'FUZZY') },
		{ 'label': 'Home Apt', 'field': 'HOME-APT', 'clear': false, 'order': 13,
				'display': parseMask(voterFieldViews, 'SEARCH|VIEWER'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'FUZZY') },
		{ 'label': 'Home Street', 'field': 'HOME-STREET', 'clear': false, 'order': 14,
				'display': parseMask(voterFieldViews, 'SEARCH|VIEWER'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'FUZZY') },
		{ 'label': 'Home Development', 'field': 'HOME-DEV', 'clear': false, 'order': 15,
				'display': parseMask(voterFieldViews, 'SEARCH|VIEWER'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'FUZZY') },
		{ 'label': 'Home City', 'field': 'HOME-CITY', 'clear': false, 'order': 16,
				'display': parseMask(voterFieldViews, 'SEARCH|VIEWER'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'MULTISELECT'), 'aor': '5/City' },
		{ 'label': 'Home Zip', 'field': 'HOME-ZIPCODE', 'clear': false, 'order': 17,
				'display': parseMask(voterFieldViews, 'SEARCH'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'MULTISELECT'), 'aor': '6/Zip Code' },
		{ 'label': 'Home Zip', 'field': 'HOME-ZIP+FOUR', 'clear': false, 'order': 17,
				'display': parseMask(voterFieldViews, 'VIEWER'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'MULTISELECT'), 'aor': '6/Zip Code' },

		{ 'label': 'County', 'field': 'COUNTY', 'clear': true, 'order': 18,
				'display': parseMask(voterFieldViews, 'SEARCH|VIEWER'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'MULTISELECT'), 'aor': '0/County' },
		{ 'label': 'Election Precinct', 'field': 'PRECINCT', 'clear': false, 'order': 19,
				'display': parseMask(voterFieldViews, 'SEARCH|VIEWER'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'MULTISELECT'), 'aor': '4/Election District' },
		{ 'label': 'Representative District', 'field': 'RD', 'clear': false, 'order': 20,
				'display': parseMask(voterFieldViews, 'SEARCH|VIEWER'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'MULTISELECT'), 'aor': '3/Representative District' },
		{ 'label': 'Senate District', 'field': 'SD', 'clear': false, 'order': 21,
				'display': parseMask(voterFieldViews, 'SEARCH|VIEWER'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'MULTISELECT'), 'aor': '2/Senate District' },
		{ 'label': 'County District', 'field': 'COUNTY-COUNCIL', 'clear': false, 'order': 22,
				'display': parseMask(voterFieldViews, 'SEARCH|VIEWER'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'MULTISELECT'), 'aor': '1/County Council' },

		{ 'label': 'Wilmington District', 'field': 'WILM-CC', 'clear': true, 'order': 23,
				'display': parseMask(voterFieldViews, 'SEARCH|VIEWER'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'MULTISELECT'), 'aor': '7/HOME-CITY/Council' },
		{ 'label': 'Municipal District', 'field': 'MUNI-CC', 'clear': false, 'order': 24,
				'display': parseMask(voterFieldViews, 'SEARCH|VIEWER'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'MULTISELECT'), 'aor': '7/HOME-CITY/Council' },
		{ 'label': 'School District', 'field': 'SCH-DIST', 'clear': false, 'order': 25,
				'display': parseMask(voterFieldViews, 'SEARCH|VIEWER'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'MULTISELECT'), 'aor': '8/School District' },

		{ 'label': 'Registration Date', 'field': 'DATE-REG', 'clear': true, 'order': 26,
				'display': parseMask(voterFieldViews, 'SEARCH|VIEWER'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'CALENDAR') },
		{ 'label': 'Last Change Date', 'field': 'DATE-UPDATE', 'clear': false, 'order': 27,
				'display': parseMask(voterFieldViews, 'SEARCH|VIEWER'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'CALENDAR') },
		{ 'label': 'Status', 'field': 'STATUS', 'clear': false, 'order': 28,
				'display': parseMask(voterFieldViews, 'SEARCH|VIEWER'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'MULTISELECT') },
		{ 'label': 'Party', 'field': 'PARTY', 'clear': false, 'order': 29,
				'display': parseMask(voterFieldViews, 'ALL'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'MULTISELECT'), 'aor': '9/Party' },
		{ 'label': 'Affiliation Date', 'field': 'DATE-PARTY', 'clear': false, 'order': 30,
				'display': parseMask(voterFieldViews, 'SEARCH|VIEWER'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'CALENDAR') },

		{ 'label': 'Mail Line 1', 'field': 'MAIL-1', 'clear': true, 'order': 31,
				'display': parseMask(voterFieldViews, 'SEARCH|VIEWER'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'FUZZY') },
		{ 'label': 'Mail Line 2', 'field': 'MAIL-2', 'clear': false, 'order': 32,
				'display': parseMask(voterFieldViews, 'SEARCH|VIEWER'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'FUZZY') },
		{ 'label': 'Mail Line 3', 'field': 'MAIL-3', 'clear': false, 'order': 33,
				'display': parseMask(voterFieldViews, 'SEARCH|VIEWER'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'FUZZY') },
		{ 'label': 'Mail Line 4', 'field': 'MAIL-4', 'clear': false, 'order': 34,
				'display': parseMask(voterFieldViews, 'SEARCH|VIEWER'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'FUZZY') },
		{ 'label': 'Mail City', 'field': 'MAIL-CITY', 'clear': true, 'order': 35,
				'display': parseMask(voterFieldViews, 'SEARCH|VIEWER'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'MULTISELECT') },
		{ 'label': 'Mail State', 'field': 'MAIL-STATE', 'clear': false, 'order': 36,
				'display': parseMask(voterFieldViews, 'SEARCH|VIEWER'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'MULTISELECT') },
		{ 'label': 'Mail Zip', 'field': 'MAIL-ZIP', 'clear': false, 'order': 37,
				'display': parseMask(voterFieldViews, 'SEARCH|VIEWER'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'MULTISELECT') },

		{ 'label': 'Voting History', 'field': 'HISTORY', 'clear': true, 'order': 38,
				'display': parseMask(voterFieldViews, 'SEARCH|VIEWER'), 'canEdit': false,
				'type': parseType(voterFieldTypes, 'ARRAY') },

		{ 'label': 'Comments', 'field': 'comments', 'clear': true, 'order': 39,
				'display': parseMask(voterFieldViews, 'SEARCH|VIEWER'), 'canEdit': true,
				'type': parseType(voterFieldTypes, 'TEXT') }
	]
};

const saveInstructions = [ permissions, voterFieldViews, voterFieldTypes, voterFields ];

MongoClient.connect(MONGO_URL, DB_OPTS, (err, db) => {
	if (err) throw err;
	const connection = db.db(DB_NAME);
	console.log(`Connected to ${DB_NAME} at:\nmongodb://${MONGO_URL.split('@')[1]}`);

	var instructionCount = saveInstructions.length;
	saveInstructions.forEach(instruction => {
		connection.collection(instruction.collection).drop((err, res) => {
			if (err && err.code !== 26) console.error(err);
			connection.collection(instruction.collection).insertMany(instruction.values, (err, res) => {
				if (err) console.error(err);
				console.log(`${instruction.collection}: ${res.insertedCount}/${instruction.values.length} values inserted`);
				if (!--instructionCount) process.exit(0);
			});
		});
	});
});