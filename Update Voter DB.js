'use strict';

const MongoClient = require('mongodb').MongoClient;
const MONGO_URL = require('./config/db-config');
const DB_NAME = 'LPD';
const DB_OPTIONS = {
	'useNewUrlParser': true
};

const FS = require('fs');

var voterTimestamp = (new Date()).getTime();

if (process.argv.length > 2) {
	console.log(`Parsing records from ${process.argv[2]}`);
	deleteAllRecords().then(() => {
		readFile(process.argv[2]).then((result) => {
			parseRecords(result.voters, result.fields, 0, result.filename);
		});
	});
}

function deleteAllRecords() {
	return new Promise((resolve, reject) => {
		MongoClient.connect(MONGO_URL, DB_OPTIONS, (err, db) => {
			if (err) throw err;
			var connection = db.db(DB_NAME);
			console.log(`DB ${DB_NAME} connected at:\nmongodb://${MONGO_URL.split('@')[1]}`);
			console.log('Mark existing records deleted');
			connection.collection('voters').updateMany(
					{ '$or': [ { 'deleted': false }, { 'deleted': { '$exists': false } } ] },
					{ '$set': { 'deleted': true } }, (err, res) => {
				if (err) throw err;
				console.log(`${res.modifiedCount} existing records marked deleted`);
				db.close();
				resolve();
			});
		});
	});
}

function readFile(filename) {
	return new Promise((resolve, reject) => {
		console.log(`Read file: ${filename}`)
		FS.readFile(__dirname + '/' + filename, (err, data) => {
			if (err) throw err;
			var voters = data.toString().split('\r\n');
			var fields = voters[0].split(',');
			console.log(`Found ${fields.length} fields`);
			voters = voters.slice(1);
			console.log(`Found ${voters.length} voters`);
			resolve({ 'voters': voters, 'fields': fields, 'filename': filename });
		});
	});
}

async function createIndexes(fields, conn) {
	console.log('Creating indexes...');
	var indexDefs = fields.map(field => {
		var index = { 'key': {}, 'name': `${field}_1` };
		index['key'][field] = 1;
		console.log(index);
		return index;
	});
	indexDefs.push({
		'key': { 'updatedBy': 1 }, 'name': 'updatedBy_1'
	});
	console.log(indexDefs);
	await conn.collection('voters').createIndexes(indexDefs);
}

function parseRecords(voters, fields, startIndex, filename) {
	console.log(`Starting batch from ${startIndex}/${voters.length}`);
	if (startIndex > voters.length) return process.exit(0);

	var dbConnection;
	var votersCollection = [];

	// parse voters from csv to json and add application fields
	for (var i=startIndex; i<(startIndex+10000) && i<voters.length; i++) {
		var voterData = voters[i].split(',');
		var voterObj = {};
		for (var j=0; j<fields.length; j++) voterObj[fields[j]] = voterData[j];
		votersCollection[i-startIndex] = voterObj;
		votersCollection[i-startIndex]['updatedAt'] = (new Date(voterTimestamp)).toISOString();
		votersCollection[i-startIndex]['updatedBy'] = 'SYSTEM';
		votersCollection[i-startIndex].timestamp = voterTimestamp;
	}
	console.log(`${votersCollection.length} records parsed`);
	console.log('PROCESSING SPOT-CHECK:', votersCollection[0]['FIRST-NAME'], votersCollection[0]['LAST-NAME']);

	MongoClient.connect(MONGO_URL, DB_OPTIONS, (err, db) => {
		if (err) throw err;
		dbConnection = db.db(DB_NAME);
		console.log(`DB ${DB_NAME} connected at:\nmongodb://${MONGO_URL.split('@')[1]}`);
		// create indexes during first batch processing
		if (!startIndex) createIndexes(fields, dbConnection);
		if (votersCollection.length) console.log(`${votersCollection.length} records to insert from ${filename}`);
		if (votersCollection.length) dbConnection.collection('voters').insertMany(votersCollection, (err, res) => {
			if (err) throw err;
			if (!res) return;
			console.log(`${res.insertedCount} records inserted from ${filename}`);

			// records have been inserted, now search for older identical records,
			// records added by previous csv dumps.  records edited through the app
			// will not have been updated by 'SYSTEM'.  records updated by COE will
			// have a different 'DATE-LAST-CHG' value.  the records just added will
			// have an identical timestamp.  returned will be an array of objects
			// with promises attached to them for each delete operation
			var voterDbCollection = dbConnection.collection('voters');
			console.log(`${votersCollection.length} records to search for deletion`);
			var queries = votersCollection.map(voter => {
				var query = {
					'VOTERID': voter['VOTERID'],
					'DATE-LAST-CHG': voter['DATE-LAST-CHG'],
					'updatedBy': 'SYSTEM',
					'timestamp': { '$ne': voterTimestamp }
				};
				return { 'id': query['VOTERID'], 'p': voterDbCollection.deleteMany(query) };
			});
			console.log(`${queries.length} delete queries generated`);

			// resolve all promises
			queries.reduce((chain, task) => {
				return chain.then(results =>
					task['p'].then(result => {
						if (!(results instanceof Array)) return [ result ];
						results.push(result);
						return results;
					}));
				}, Promise.resolve([]))
			.then(values => {
				var totalDeleted = values.reduce((total, val) => {
					return total += val.result.n;
				}, 0);
				console.log(`${totalDeleted} records deleted`);
				db.close();
				updateCustomRecords(votersCollection, voters, fields, startIndex, filename);
			});
		});
		else console.log('No voters to update');
	});
}

function updateCustomRecords(votersCollection, voters, fields, startIndex, filename) {
	MongoClient.connect(MONGO_URL, DB_OPTIONS, (err, db) => {
		if (err) throw err;
		var dbConnection = db.db(DB_NAME);
		console.log(`DB ${DB_NAME} reconnected to update custom records`);
		// gets the newest custom record for each voter with a custom record
		dbConnection.collection('voters').aggregate([
			{ '$sort': { 'timestamp': -1 } },
			{ '$match': { 'updatedBy': { '$ne': 'SYSTEM' } } },
			{ '$group': { '_id': '$VOTERID', 'doc': { '$first': '$$ROOT' } } },
			{ '$replaceRoot': { 'newRoot': '$doc' } },
			{ '$sort': { '_id': 1 } }
		], { 'allowDiskUse': true }).toArray((err, results) => {
			if (err) throw err;
			if (!results || !results.length) {
				console.log(`No custom records found`);
				return nextBatch(0, db, voters, fields, startIndex, filename);
			}
			console.log(`${results.length} custom records found`);
			var updatedRecords = [];
			// splits the custom records into records that COE has updated and records COE has
			// not updated.  updated records will save application custom fields and set all
			// other fields to the values supplied by COE.  this will preserve data we've added
			// and continue to mark the record out as a custom record.  custom records that haven't
			// been updated will have their timestamps refreshed to keep them newer than the just-added
			// COE records, and will be un-deleted.
			results = results.filter(result => {
				delete result['_id'];
				// find the COE record we just added
				var coeRecord = votersCollection.filter(voter => voter['VOTERID'] === result['VOTERID'])[0];
				// we didn't add this voter from COE, COE removed them.  keep them deleted and out of the
				// custom records that are preserved below by reseting their 'deleted' flags
				if (!coeRecord) return false;
				// convert the 'DATE-LAST-CHG' field into a Date object
				var coeDate = new Date(coeRecord['DATE-LAST-CHG'].match(/(\d{4})(\d{2})(\d{2})/).slice(1,4));
				// convert the custom record's timestamp into a date object
				var customDate = new Date(result['timestamp']);
				// the custom date is before COE's date.  COE updated this record
				if (customDate < coeDate) {
					console.log(`${coeRecord['VOTERID']} updated by COE, copying custom keys`);
					// custom keys won't exist on the COE record
					var customKeys = Object.keys(result).filter(key => !coeRecord.hasOwnProperty(key));
					console.log(`${customKeys.length} custom keys found`);
					if (customKeys.length) {
						// copy the custom fields to the new COE record, update application metadata
						customKeys.forEach(key => coeRecord[key] = result[key]);
						coeRecord['updatedAt'] = result['updatedAt'];
						coeRecord['updatedBy'] = result['updatedBy'];
						coeRecord['timestamp'] = (new Date()).getTime();
						coeRecord['deleted'] = false;
						delete coeRecord['_id'];
						// stack it to be updated
						updatedRecords.push(coeRecord);
					}
					// do NOT stack it to be preserved
					return false;
				}
				// COE date is older than custom record date.  preserve our copy with a fresh timestamp
				console.log(`No updates from COE on ${coeRecord['VOTERID']}, refreshing timestamp`);
				result['timestamp'] = (new Date()).getTime();
				result['deleted'] = false;
				return true;
			});

			// count db calls pending
			var pendingCalls = 0;
			console.log(`${updatedRecords.length} updated custom records to copy`);
			// set all records (including the one we just made) to deleted for each updated voter
			if (updatedRecords.length) dbConnection.collection('voters').updateMany(
					{ 'VOTERID': { '$in': updatedRecords.map(r => r['VOTERID']) } },
					{ '$set': { 'deleted': true } }, (err, updatedStaleResults) => {
				// insert the updated COE records with the custom data we saved
				dbConnection.collection('voters').insertMany(updatedRecords, (err, updatedResults) => {
					if (err) throw err;
					if (updatedResults) console.log(`${updatedResults.insertedCount} updated custom records copied`);
					// try to start the next batch.  NOOP if there's another pending call to refresh custom records
					nextBatch(--pendingCalls, db, voters, fields, startIndex, filename);
				});
			});
			console.log(`${results.length} custom records to preserve`);
			// set all records (primarily the one we just created) to deleted for each preserved voter
			if (results.length) dbConnection.collection('voters').updateMany(
					{ 'VOTERID': { '$in': results.map(r => r['VOTERID']) } },
					{ '$set': { 'deleted': true } }, (err, insertStaleResults) => {
				// insert the refreshed record
				dbConnection.collection('voters').insertMany(results, (err, insertResults) => {
					if (err) throw err;
					if (insertResults) console.log(`${insertResults.insertedCount} custom records preserved`);
					// try to start the next batch.  NOOP if there's another pending call to update custom records
					nextBatch(--pendingCalls, db, voters, fields, startIndex, filename);
				});
			});
			// no custom records
			if (!(updatedRecords.length + results.length)) console.log(`Custom records not in batch`);
			// custom records to update
			if (updatedRecords.length) pendingCalls++;
			// custom records to preserve
			if (results.length) pendingCalls++;
			// try to start next batch.  NOOP if we found custom records, waiting for previous calls to complete
			nextBatch(pendingCalls, db, voters, fields, startIndex, filename);
		});
	});
}

function nextBatch(pendingCalls, db, voters, fields, startIndex, filename) {
	if (!pendingCalls) {
		db.close();
		parseRecords(voters, fields, startIndex + 10000, filename);
	}
}
