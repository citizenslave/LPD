'use strict';

const MongoClient = require('mongodb').MongoClient;
const MONGO_URL = require('./config/db-config');
const DB_NAME = 'LPD',
        DB_OPTIONS = { 'useNewUrlParser': true, 'useUnifiedTopology': true };

const FS = require('fs'), READLINE = require('readline');

// Save file fields
const FIELDS = [];
const TIMESTAMP = Date.now();
/**
 * Transform CoE File Fields to merge with the DB fields.
 * - const: Set to a constant value
 * - map: Map to a field in the CoE file
 * - concat: Concat an array of fields together
 * - join: Join an array of fields together divided by a 'joiner', defaulting
 *      to a <space> character
 * - stack: Push an array of fields onto a stack
 * - alt: Map to an array of alternate fields if other types/alt mappings fail
 * 
 * - key: Prefix another field type with the first letter of another field
 * - pad: Pad the field to be a specified length with 0s
 * - template: Split a single field according to a RegEx capture, rejoin with a
 *      'joiner' or <space>
 * - type: Convert the field to a provided type:
 *      - DATE
 */
const FIELD_XFORM = {
    'updatedAt': { 'const': new Date(TIMESTAMP) },
    'updatedBy': { 'const': 'SYSTEM' },
    'timestamp': { 'const': TIMESTAMP },
    'VOTER ID': { 'map': 'Voter ID' },
    'FIRST-NAME': { 'map': 'Name-First' },
    'MID-NAME': { 'map': 'Name-Middle' },
    'LAST-NAME': { 'map': 'Name-Last' },
    'SUFFIX': { 'map': 'Name-Suffix' },
    'DATE-OF-BIRTH': { 'map': null, 'type': 'DATE' },
    'BIRTH-YEAR': { 'map': 'Year of Birth' },
    'PHONE': { 'concat': [ 'Phone-Area Code', 'Phone-Exchange', 'Phone-Last Four' ] },
    'HOME-NO': { 'concat': [ 'Res Addr-House No', 'Res Addr-House No Suffix' ] },
    'HOME-APT': { 'concat': [ 'Res Addr-Unit Type', 'Res Addr-Unit Number' ], 'alt': [ 'Res Addr-Non-Standard' ] },
    'HOME-STREET': { 'join': [
        'Res Addr-Street Direction Prefix',
        'Res Addr-Street Name',
        'Res Addr-Street Type',
        'Res Addr-Street Direction Suffix'
    ] },
    'HOME-DEV': { 'map': 'Res Addr-Development Name' },
    'HOME-CITY': { 'map': 'Res Addr-City'},
    'HOME-ZIPCODE': { 'map': 'Res Addr-Zip Code' },
    'HOME-ZIP+FOUR': { 'join': ['Res Addr-Zip Code', 'Res Addr-Zip 4'], 'joiner': '-' },
    'COUNTY': { 'map': 'County' },
    'COUNTY-COUNCIL': {
        'map': 'District-County Council (New Castle and Sussex Only)',
        'alt': ['District-Levy Court (Kent Only)'],
        'key': 'County'
    },
    'MUNI-CC': { 'map': 'District-Municipality' },
    'WILM-CC': { 'map': 'District-City Council (Wilmington Only)' },
    'RD': { 'map': 'District-Representative' },
    'SD': { 'map': 'District-Senate' },
    'PRECINCT': { 'map': 'Precinct (RDED)', 'template': '(.{2})(.{2})', 'pad': 4, 'joiner': '-' },
    'SCH-DIST': { 'map': 'District-School' },
    'PARTY': { 'map': 'Political Party' },
    'STATUS': { 'map': 'Status' },
    'DATE-REG': { 'map': 'Registration Date', 'type': 'DATE' },
    'DATE-UPDATE': {
        'map': 'Last Registration Update Date',
        'type': 'DATE',
        'alt': [
            'Party Affiliation Date',
            'Registration Date'
        ]
    },
    'DATE-PARTY': { 'map': 'Party Affiliation Date', 'type': 'DATE' },
    'MAIL-1': { 'map': 'Mail Addr-Line1' },
    'MAIL-2': { 'map': 'Mail Addr-Line2' },
    'MAIL-3': { 'map': 'Mail Addr-Line3' },
    'MAIL-4': { 'map': 'Mail Addr-Line4' },
    'MAIL-CITY': { 'map': 'Mail Addr-City' },
    'MAIL-STATE': { 'map': 'Mail Addr-State' },
    'MAIL-ZIP': { 'map': 'Mail Addr-Zip Code' },
    'HISTORY': {
        'stack': [
            'Voting History 1', 'Voting History 2',
            'Voting History 3', 'Voting History 4',
            'Voting History 5', 'Voting History 6',
            'Voting History 7', 'Voting History 8',
            'Voting History 9', 'Voting History 10',
        ]
    }
};

if (process.argv.length > 3) {
    MongoClient.connect(MONGO_URL, DB_OPTIONS, (err, db) => {
        db = db.db(DB_NAME);

        const collection = db.collection(process.argv[3]);
        console.log(`Connected to collection ${process.argv[3]}.`);

        console.log(`Indexing ${Object.keys(FIELD_XFORM).length} fields.`);
        const indexSpecs = Object.keys(FIELD_XFORM).map(field => {
            const index = { 'key': {}, 'name': `${field}_INDEX` }; index['key'][field] = 1;
            return index;
        });
        collection.createIndexes(indexSpecs, (err, res) => {
            if (err) throw err;

            const newIndexes = res.numIndexesAfter - res.numIndexesBefore;
            console.log(`${newIndexes} indexes created: ${res.note || 'done'}`);

            console.log(`Parsing voter records from ${process.argv[2]} into ${process.argv[3]}`);
            readFile(process.argv[2], collection).then((result) => {
                process.exit(0);
            }, err => {
                throw err;
            });
        });
    });
} else {
    console.log(`Missing parameters: {filename} {collection}`);
}

function mapVoter(voter) {
    // Fix busted lines
    let fixedData = voter.match(/(.*)"(.*),(.*)"(.*)/);
    if (fixedData) fixedData = fixedData.splice(1).join('');
    else fixedData = voter;
    // Split line into fields
    const voterData = fixedData.split(',');
    // Check record
    // TODO
    const voterObj = {};
    // Populate fields, ignore empty/secondary values
    FIELDS.forEach((field, idx) => {
        voterObj[field] = voterObj[field] || voterData[idx];
    });
    return voterObj;
}

function xFormVoter(voterObj) {
    const xFormedVoter = {};
    Object.keys(FIELD_XFORM).forEach(field => {
        // Save transform
        const xform = FIELD_XFORM[field];
        // Perform transform
        if (xform.const) xFormedVoter[field] = xform.const;
        if (xform.map) xFormedVoter[field] = voterObj[xform.map].trim();
        if (xform.concat) xFormedVoter[field] = xform.concat.map(cField => voterObj[cField].trim())
                .join('').trim();
        if (xform.join) xFormedVoter[field] = xform.join.map(jField => voterObj[jField].trim())
                .filter(v => v).join(xform.joiner || ' ').trim();
        if (xform.stack) xFormedVoter[field] = xform.stack.map(sField => voterObj[sField].trim());
        if (!xFormedVoter[field] && xform.alt) {
            for (var altIdx = 0; !xFormedVoter[field] && altIdx < xform.alt.length; altIdx++) {
                xFormedVoter[field] = voterObj[xform.alt[altIdx]].trim();
            }
        }

        if (xform.key) xFormedVoter[field] = voterObj[xform.key].substr(0, 1) + xFormedVoter[field];
        if (xform.pad) xFormedVoter[field] = xFormedVoter[field].padStart(xform.pad, 0);
        if (xform.template) xFormedVoter[field] = xFormedVoter[field].match(new RegExp(xform.template))
                .splice(1).join(xform.joiner || ' ');
        if (xform.type && xFormedVoter[field]) {
            switch (xform.type) {
                case 'DATE':
                    xFormedVoter[field] = new Date(xFormedVoter[field]);
                    break;
            }
        }
    });
    // Validate record
    // TODO
    return xFormedVoter;
}

function readFile(filename, collection) {
    return new Promise((resolve, reject) => {
        console.log(`Read file: ${filename}`)

        const fileStream = FS.createReadStream(__dirname + '/' + filename);
        const fileInterface = READLINE.createInterface({ 'input': fileStream });

        let batch = [];
        let lineCounter = 0;
        let batchCounter = 0;
        // Status
        const totals = {
            'modified': 0,
            'upserted': 0,
            'custom': 0,
            'backdated': 0,
            'deleted': 0
        }
        
        fileInterface.on('line', (line) => {
            if (!FIELDS.length) {
                var fields = line.split(',');
                fields.forEach(field => FIELDS.push(field.trim()));
                console.log(`Found ${FIELDS.length} fields`);
                return;
            }

            lineCounter++;
            batchCounter++;
            batch.push(xFormVoter(mapVoter(line)));

            if (lineCounter === 1) {
                console.log(batch[0]);
                collection.find({ 'VOTER ID': batch[0]['VOTER ID'] }).limit(1).toArray((err, res) => {
                    if (err) reject(err);
                    console.log(res[0]);
                });
            }

            if (batchCounter === 10000) {
                fileStream.pause();

                const records = batch, processedCount = lineCounter;
                batchCounter = 0;
                batch = [];

                mergeRecords(records, collection).then(mergeResult => {
                    totals.modified += mergeResult.modified;
                    totals.upserted += mergeResult.upserted;
                    totals.custom += mergeResult.custom;
                    totals.backdated += mergeResult.backdated;

                    console.log(`${processedCount} voters processed\n`);
                    console.log(`${totals.modified} total records modified`);
                    console.log(`${totals.upserted} total records upserted\n`);
                    console.log(`${totals.custom} custom records updated`);
                    console.log(`${totals.modified-totals.custom} SYSTEM records modified`);
                    console.log(`${(totals.modified+totals.upserted)-totals.custom} SYSTEM records processed\n`)
                    console.log(`${totals.backdated} SYSTEM records backdated\n`);

                    fileStream.resume();
                }, reject);
            }
        });

        fileInterface.on('close', () => {
            mergeRecords(batch, collection).then(mergeResult => {
                totals.modified += mergeResult.modified;
                totals.upserted += mergeResult.upserted;
                totals.custom += mergeResult.custom;
                totals.backdated += mergeResult.backdated;
                console.log(`${lineCounter} total voters processed\n`);

                // All SYSTEM records from before TIMESTAMP-1 were not updated because they are
                // missing from the latest COE dump and are therefore no longer valid.
                const deleteQuery = { 'updatedBy': 'SYSTEM', 'timestamp': { '$lt': TIMESTAMP-1 } };
                const updateQuery = { '$set': { 'deleted': true } };
                collection.updateMany(deleteQuery, updateQuery, (err, deleteRes) => {
                    if (err) reject(err);

                    totals.deleted = deleteRes.modifiedCount;
                    console.log(`${totals.modified} total records modified`);
                    console.log(`${totals.upserted} total records upserted\n`);
                    console.log(`${totals.custom} custom records updated`);
                    console.log(`${totals.modified - totals.custom} SYSTEM records modified`);
                    console.log(`${(totals.modified + totals.upserted) - totals.custom} SYSTEM records processed\n`)
                    console.log(`${totals.backdated} SYSTEM records backdated\n`);
                    console.log(`${totals.deleted} missing records soft deleted`);

                    // Drop and recreate indexes
                    collection.dropIndexes().then(dropRes => {
                        console.log(`Dropped old indexes: ${dropRes}`);

                        const indexSpecs = Object.keys(FIELD_XFORM).map(field => {
                            const index = { 'key': {}, 'name': `${field}_INDEX` }; index['key'][field] = 1;
                            return index;
                        });
                        collection.createIndexes(indexSpecs, (err, res) => {
                            if (err) reject(err);

                            const newIndexes = res.numIndexesAfter - res.numIndexesBefore;
                            console.log(`${newIndexes} indexes created: ${res.note || 'done'}`);

                            resolve(lineCounter);
                        });
                    }, reject);
                });
            }, reject);
        });
    });
}

function mergeRecords(records, collection) {
    return new Promise((resolve, reject) => {
        const upsertSystemRecords = [], updateCustomRecords = [];

        records.forEach(record => {
            // Upsert new SYSTEM records to overwrite the previous merge's records
            upsertSystemRecords.push({
                'updateOne': {
                    'filter': { 'VOTER ID': record['VOTER ID'], 'updatedBy': 'SYSTEM' },
                    'update': { '$set': record, '$unset': { 'deleted': '' } },
                    'upsert': true
                }
            });

            // Preserve the existing update attributes on custom records
            const customRecord = Object.assign({}, record);
            delete customRecord['updatedBy']; delete customRecord['updatedAt']; delete customRecord['timestamp'];

            // Update the remaining values on custom records
            // TODO: Preserve phone number if custom record is newer than update fields
            updateCustomRecords.push({
                'updateMany': {
                    'filter': { 'VOTER ID': customRecord['VOTER ID'], 'updatedBy': { '$ne': 'SYSTEM' } },
                    'update': { '$set': customRecord }
                }
            });
        });

        const writeOps = upsertSystemRecords.concat(updateCustomRecords);
        collection.bulkWrite(writeOps, { 'ordered': false }, (err, res) => {
            if (err) reject(err);

            const customRecordsModified = (res.matchedCount + res.upsertedCount) - upsertSystemRecords.length;

            backdateExtraSystemRecords(collection, records).then(backdateRes => {
                resolve({
                    'modified': res.modifiedCount,
                    'upserted': res.upsertedCount,
                    'custom': customRecordsModified,
                    'backdated': backdateRes
                });
            }, reject);
        });
    });
}

function backdateExtraSystemRecords(collection, records) {
    return new Promise((resolve, reject) => {
        // Find custom records that were updated by this batch
        const findUpdatedCustomRecords = {
            'VOTER ID': { '$in': records.map(record => record['VOTER ID']) },
            'updatedBy': { '$ne': 'SYSTEM' }
        };

        collection.find(findUpdatedCustomRecords).toArray((err, updatedCustomRes) => {
            if (err) reject(err);

            // Push back the timestamp of the SYSTEM records corresponding to those custom records
            const updatedCustomVoterIds = updatedCustomRes.map(item => item['VOTER ID']);
            const filterQuery = {
                'VOTER ID': { '$in': updatedCustomVoterIds },
                'updatedBy': 'SYSTEM',
                'timestamp': TIMESTAMP
            };
            const updateQuery = {
                '$set': {
                    'timestamp': TIMESTAMP - 1,
                    'deleted': true
                }
            };
            collection.updateMany(filterQuery, updateQuery, (err, backdateRes) => {
                if (err) reject(err);

                resolve(backdateRes.modifiedCount);
            });
        });
    });
}