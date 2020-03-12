'use strict';

const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const MONGO_URL = require('./config/db-config');
const DB_NAME = 'LPD', DB_OPTIONS = { 'useNewUrlParser': true };

const FS = require('fs'), READLINE = require('readline');

if (process.argv.length <= 3) {
    console.log('Insufficient arguments.');
    process.exit(0);
}

const dropFields = [
    'Title',
    'District-Election',
    'District-Municipality DO NOT USE',
    'District-Congressional',
    'Res Addr-State',
    'Res Addr-Carrier Route',
    'Res Addr-Military Ind',
    'Mail Addr-Carrier Route',
    'Mail Addr-Military Ind',
    'Mail Addr-Foreign Ind'
], droppedIndices = [];

const flaggedIndices = {};

const mixedFields = [
    {
        'fieldName': 'HISTORY',
        'matcher': /Voting History \d{1,2}/,
        'indices': {},
        'xformer': (record, indices) => {
            const ret = [];
            Object.values(indices).forEach(idx => {
                if (record[idx]) ret.push(record[idx]);
            });
            return ret;
        }
    }, {
        'fieldName': 'PHONE',
        'matcher': /Phone-.*/,
        'indices': {},
        'xformer': (record, indices) => {
            return record[indices['Phone-Area Code']].padStart(3, '0')
                    +record[indices['Phone-Exchange']].padStart(3, '0')
                    +record[indices['Phone-Last Four']].padStart(4, '0');
        }
    }, {
        'fieldName': 'HOME-NO',
        'matcher': /Res Addr-House No.*/,
        'indices': {},
        'xformer': (record, indices) => {
            return record[indices['Res Addr-House No']]
                    +record[indices['Res Addr-House No Suffix']];
        }
    }, {
        'fieldName': 'HOME-APT',
        'matcher': /Res Addr-Unit .*|Res Addr-Non-Standard/,
        'indices': {},
        'xformer': (record, indices) => {
            return (record[indices['Res Addr-Unit Type']]
                    +record[indices['Res Addr-Unit Number']])
                    || record[indices['Res Addr-Non-Standard']];
        }
    }, {
        'fieldName': 'HOME-STREET',
        'matcher': /Res Addr-Street .*/,
        'indices': {},
        'xformer': (record, indices) => {
            return [ record[indices['Res Addr-Street Direction Prefix']],
                    record[indices['Res Addr-Street Name']],
                    record[indices['Res Addr-Street Type']],
                    record[indices['Res Addr-Street Direction Suffix']]].join(' ').trim();
        }
    }, {
        'fieldName': 'HOME-ZIPCODE',
        'matcher': /Res Addr-Zip .*/,
        'indices': {},
        'xformer': (record, indices) => {
            let plus4 = record[indices['Res Addr-Zip 4']];
            plus4 = plus4?`-${plus4}`:'';
            return record[indices['Res Addr-Zip Code']]+plus4
        }
    }, {
        'fieldName': 'MAIL-ZIP',
        'matcher': /Mail Addr-Zip .*/,
        'indices': {},
        'xformer': (record, indices) => {
            let plus4 = record[indices['Mail Addr-Zip 4']];
            plus4 = plus4?`-${plus4}`:'';
            return record[indices['Mail Addr-Zip Code']]+plus4
        }
    }, {
        'fieldName': 'COUNTY-COUNCIL',
        'matcher': /District-County Council|District-Levy Court/,
        'indices': {},
        'xformer': (record, indices) => {
            return record[flaggedIndices['County']][0]
                    +(record[indices['District-County Council']] || record[indices['District-Levy Court']])
        }
    }, {
        'fieldName': 'PRECINCT',
        'matcher': /Precinct/,
        'indices': {},
        'xformer': (record, indices) => {
            const padded = record[indices['Precinct']].padStart(4, '0');
            return padded.substr(0,2)+'-'+padded.substr(2,2);
        }
    }, {
        'fieldName': 'DATE-REG',
        'matcher': /Registration Date/,
        'indices': {},
        'xformer': (record, indices) => {
            return new Date(record[indices['Registration Date']]);
        }
    }, {
        'fieldName': 'DATE-PARTY',
        'matcher': /Party Affiliation Date/,
        'indices': {},
        'xformer': (record, indices) => {
            let dateValue = record[indices['Party Affiliation Date']];
            if (!dateValue) dateValue = record[flaggedIndices['Last Registration Update Date']];
            if (!dateValue) dateValue = record[flaggedIndices['Registration Date']];
            return new Date(dateValue);
        }
    }, {
        'fieldName': 'DATE-UPDATE',
        'matcher': /Last Registration Update Date/,
        'indices': {},
        'xformer': (record, indices) => {
            let dateValue = record[indices['Last Registration Update Date']];
            if (!dateValue) dateValue = record[flaggedIndices['Party Affiliation Date']];
            if (!dateValue) dateValue = record[flaggedIndices['Registration Date']];
            return new Date(dateValue);
        }
    }
];

const fieldMappings = {
    'District-City Council': 'WILM-CC',
    'District-Municipality': 'MUNI-CC',
    'District-Representative': 'RD',
    'District-Senate': 'SD',
    'District-School': 'SCH-DIST',
    'Political Party': 'PARTY',
    'Res Addr-City': 'HOME-CITY',
    'Res Addr-Development Name': 'HOME-DEV',
    'Name-First': 'FIRST-NAME',
    'Name-Last': 'LAST-NAME',
    'Name-Middle': 'MID-NAME',
    'Name-Suffix': 'SUFFIX',
    'Year of Birth': 'BIRTH-YEAR',
    'Mail Addr-Line1': 'MAIL-1',
    'Mail Addr-Line2': 'MAIL-2',
    'Mail Addr-Line3': 'MAIL-3',
    'Mail Addr-Line4': 'MAIL-4',
    'Mail Addr-City': 'MAIL-CITY',
    'Mail Addr-State': 'MAIL-STATE',
    'default': (fieldName) => { return fieldName.toUpperCase(); }
};

const rewriteFields = {
    'DATE-LAST-CHG': function(record) {
        const newField = 'DATE-UPDATE',
                oldField = 'DATE-LAST-CHG';
        if (!record[oldField]) return record;
        const newDate = record[newField];
        const datePieces = record[oldField].match(/(\d{4})(\d{2})(\d{2})/);
        delete record[oldField];
        if (!datePieces || datePieces.length !== 4) return record;
        const oldDate = new Date(datePieces.slice(1,4));
        if (newDate < oldDate)
            record[newField] = oldDate;
        return record;
    },
    'DATE-OF-BIRTH': function(record) {
        const field = 'DATE-OF-BIRTH'
        if (!record[field] || typeof record[field] !== 'string') return record;
        const datePieces = record[field].match(/(\d{4})(\d{2})(\d{2})/);
        if (datePieces && datePieces.length === 4) record[field] = new Date(datePieces.slice(1,4));
        return record;
    },
    'HOME-ZIPCODE': function(record) {
        const field = 'HOME-ZIPCODE';
        if (!record[field] || typeof record[field] !== 'string') return record;
        record['HOME-ZIP+FOUR'] = record[field];
        record[field] = record[field].split('-')[0];
        return record;
    },
    'MAIL-ZIP': function(record) {
        const field = 'MAIL-ZIP';
        if (!record[field] || typeof record[field] !== 'string') return record;
        record['MAIL-ZIP+FOUR'] = record[field];
        record[field] = record[field].split('-')[0];
        return record;
    }
}

const customDbFields = [
    'DATE-LAST-CHG', 'DATE-OF-BIRTH', 'email',
    'comments', 'verified', 'updatedBy', 'updatedAt'
]

const timestamp = Date.now(), fields = [];
let indexName;

let upsertedRecords = 0, modifiedRecords = 0, customRecords = 0;
let removedRecords = 0, fixedRecords = 0, deletedRecords = 0;

console.log('Opening DB connection...');
MongoClient.connect(MONGO_URL, DB_OPTIONS, (err, db) => {
    if (err) throw err;
    const voterCollection = db.db(DB_NAME).collection(process.argv[3]);

    console.log(`Transforming records from ${process.argv[2]} into collection ${process.argv[3]}...`);
    const fileStream = FS.createReadStream(process.argv[2]);
    const fileInterface = READLINE.createInterface({ 'input': fileStream });

    let lineCounter = 0, batchCounter = 0, batchRecords = [];
    fileInterface.on('line', (line) => {
        if (!fields.length) return loadFields(line, voterCollection);
        ++lineCounter; ++batchCounter;
        batchRecords.push(processLine(line));
        if (lineCounter === 1) console.log(batchRecords);
        if (batchCounter === 10000) {
            fileStream.pause();
            console.log(`Batch parsed: ${lineCounter} records parsed.`);
            const batch = batchRecords, currentLines = lineCounter;
            batchRecords = []; batchCounter = 0;
            processBatch(batch, voterCollection).then(() => {
                console.log(`Batch processed: ${currentLines} records processed.`);
                fileStream.resume();
            });
        }
    });
    fileInterface.on('close', () => {
        console.log(`Last batch of ${batchCounter} records processing.`);
        processBatch(batchRecords, voterCollection).then(() => {
            console.log(`Parsing ${lineCounter} records complete.`);
            
            const removeRecords = { 'updatedBy': 'SYSTEM', 'timestamp': { '$lt': timestamp } };
            const update = { '$set': { 'deleted': true } };
            voterCollection.updateMany(removeRecords, update, (err, removedRecordsRes) => {
                if (err) throw err;
                console.log(`Soft deleted ${removedRecordsRes.modifiedCount} removed records.`);
                removedRecords += removedRecordsRes.modifiedCount;
    
                voterCollection.dropIndexes().then(dropRes => {
                    console.log(`Dropped indexes.`);
                    const indexSpecs = fields.map(field => {
                        let mappedField;
                        const mixedField = mixedFields.filter(mixedField => mixedField.matcher.test(field))[0];
                        if (!mixedField && !fieldMappings[field]) mappedField = fieldMappings['default'](field);
                        else mappedField = fieldMappings[field]?fieldMappings[field]:mixedField.fieldName;
                        const index = { 'key': {}, 'name': `${mappedField}_INDEX` }; index['key'][mappedField] = 1;
                        return index;
                    });
                    voterCollection.createIndexes(indexSpecs, (err, reIndexRes) => {
                        if (err) throw err;

                        console.log('Created new indices:\n', reIndexRes);
                        console.log('\nRESULTS:\n=================================');
                        console.log(`Upserted Records:\t${upsertedRecords}`);
                        console.log(`Modified Records:\t${modifiedRecords}`);
                        console.log(`Total Records:\t\t${lineCounter}`);
                        console.log('=================================');
                        console.log(`Custom Records:\t\t${customRecords}`);
                        console.log(`Fixed Records:\t\t${fixedRecords}`);
                        console.log(`Removed Records:\t${removedRecords}`);
                        console.log(`Deleted Records:\t${deletedRecords}`);
                        console.log('=================================');
                        console.log(`Time Elapsed:\t\t${Date.now()-timestamp}ms`);
    
                        process.exit(0);
                    });
                }).catch(err => { throw err });
            });
        });
    });
});

function loadFields(line, collection) {
    line.split(',').forEach((field, idx) => {
        field = field.replace(/\(.*\)/, '').trim();
        if (dropFields.includes(field)) return droppedIndices.push(idx);
        const mixedField = mixedFields.filter(mixedField => mixedField.matcher.test(field))[0];
        flaggedIndices[field] = idx;
        if (mixedField) {
            if (!Object.keys(mixedField.indices).length) fields.push(mixedField.fieldName);
            droppedIndices.push(mixedField.indices[field] = idx);
            return;
        }
        fields.push(field);
    });
    collection.createIndex({'$**': 1}, (err, indexRes) => {
        if (err) throw err;
        console.log('Wildcard Update Index created.');
        indexName = indexRes;
    });
}

function processLine(line) {
    const record = line.split(',').map(field => field.trim());
    let recordIndex = 0;
    const parsedRecord = {};
    fields.forEach((field, idx) => {
        const xformer = mixedFields.filter(mixedField => field === mixedField.fieldName)[0];
        const mappedField = fieldMappings[field]?fieldMappings[field]:fieldMappings['default'](field);
        while (droppedIndices.includes(recordIndex) && !xformer) recordIndex++;
        if (xformer) parsedRecord[mappedField] = xformer.xformer(record, xformer.indices);
        else parsedRecord[mappedField] = record[recordIndex++];
    });
    parsedRecord['updatedAt'] = new Date(timestamp);
    parsedRecord['updatedBy'] = 'SYSTEM';
    parsedRecord['timestamp'] = timestamp;
    return parsedRecord;
}

function processBatch(batch, collection) {
    return new Promise((resolve, reject) => {
        const oldFields = [
            'VOTERID', 'MID-INIT', 'BIRTH YEAR', 'ADDR', 'ED', 'CNLEVY', 'WILM', 'CODE-HOME-CITY',
            'PP-HIST-1', 'PP-HIST-2', 'PR-HIST-1', 'PR-HIST-2', 'PR-HIST-3',
            'GEN-HIST-1', 'GEN-HIST-2', 'GEN-HIST-3', 'GEN-HIST-4', 'GEN-HIST-5',
            'SCHL-HIST-1', 'SCHL-HIST-2', 'SCHL-HIST-3', 'SCHL-HIST-4', 'SCHL-HIST-5',
            'REF-HIST-1', 'REF-HIST-2', 'REF-HIST-3', 'REF-HIST-4', 'REF-HIST-5',
            'SP-HIST-1', 'SP-HIST-2', 'SP-HIST-3', 'MAIL-NO', 'MAIL-APT', 'MAIL-STR', 'CODE-CHANGE'
        ], unsetOperation = {};
        oldFields.forEach(field => unsetOperation[field] = '');
        
        function createOrFilter(item) {
            return [ { 'VOTERID': item['VOTER ID'] }, { 'VOTER ID': item['VOTER ID'] } ];
        }
    
        const updateSystemRecords = [], updateCustomRecords = [];
        batch.forEach(item => {
            updateSystemRecords.push({
                'updateOne': {
                    'filter': { '$or': createOrFilter(item), 'updatedBy': 'SYSTEM' },
                    'update': { '$unset': unsetOperation, '$set': item },
                    'upsert': true
                }
            });
    
            const customItem = Object.assign({}, item);
            delete customItem['updatedBy']; delete customItem['updatedAt'];
            updateCustomRecords.push({
                'updateMany': {
                    'filter': { '$or': createOrFilter(customItem), 'updatedBy': { '$ne': 'SYSTEM' } },
                    'update': { '$unset': unsetOperation, '$set': customItem }
                }
            });
        });
        
        collection.bulkWrite(updateSystemRecords, { 'ordered': false }, (err, upsertRes) => {
            if (err) reject(err.writeErrors);
            console.log(`${upsertRes.nModified} original documents modified.`);
            console.log(`${upsertRes.nUpserted} original documents upserted.`);
            modifiedRecords += upsertRes.nModified;
            upsertedRecords += upsertRes.nUpserted;
    
            collection.bulkWrite(updateCustomRecords, { 'ordered': false }, (err, updateRes) => {
                if (err) reject(err);
                console.log(`${updateRes.nModified} custom documents modified.`);
                customRecords += updateRes.nModified;
    
                deleteExtraSystemRecords(collection, batch).then(() => {
                    fixBatchRecords(collection, batch).then(resolve, reject);
                }, reject);
            });
        });
    });
}

function deleteExtraSystemRecords(collection, batch) {
    return new Promise((resolve, reject) => {
        const findUpdatedCustomRecords = {
            'VOTER ID': { '$in': batch.map(record => record['VOTER ID']) },
            'updatedBy': { '$ne': 'SYSTEM' },
            'timestamp': timestamp
        };
        collection.find(findUpdatedCustomRecords).toArray((err, updatedCustomRes) => {
            if (err) reject(err);

            const updatedCustomVoterIds = updatedCustomRes.map(item => item['VOTER ID']);
            const deleteQuery = {
                'VOTER ID': { '$in': updatedCustomVoterIds },
                'updatedBy': 'SYSTEM',
                'timestamp': timestamp
            };
            collection.deleteMany(deleteQuery, (err, deleteRes) => {
                if (err) reject(err);
                console.log(`${deleteRes.deletedCount} extra SYSTEM records removed.`);
                deletedRecords += deleteRes.deletedCount;

                resolve();
            });
        });
    });
}

function fixBatchRecords(collection, batch) {
    return new Promise((resolve, reject) => {
        const findCurrentBatchRecords = {
            'VOTER ID': { '$in': batch.map(item => item['VOTER ID']) },
            '$or': [ { 'deleted': false }, { 'deleted': { '$exists': false } } ]
        };
        collection.find(findCurrentBatchRecords).toArray((err, currentBatchRes) => {
            if (err) reject(err);

            const rewrites = Object.values(rewriteFields);
            currentBatchRes.forEach(item => rewrites.forEach(rewrite => rewrite(item)));
            const fixBatch = currentBatchRes.map(item => {
                return {
                    'replaceOne': {
                        'filter': { '_id': ObjectID(item['_id']) },
                        'replacement': item
                    }
                };
            });

            collection.bulkWrite(fixBatch, { 'ordered': 'false' }, (err, updateBatchRes) => {
                if (err) reject(err);

                console.log(`${updateBatchRes.nModified} records fixed...`);
                fixedRecords += updateBatchRes.nModified;

                resolve();
            });
        });
    });
}