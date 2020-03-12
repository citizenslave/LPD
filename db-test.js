'use strict';

const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const MONGO_URL = require('./config/db-config');
const DB_NAME = 'LPD', DB_OPTIONS = { 'useNewUrlParser': true };

const READLINE = require('readline');

if (process.argv.length <= 2) {
    console.log('Insufficient arguments.');
    process.exit(0);
}

const rl = READLINE.createInterface(process.stdin, process.stdout);
MongoClient.connect(MONGO_URL, DB_OPTIONS, (err, db) => {
    const collection = db.db(DB_NAME).collection(process.argv[2]);

    rl.prompt(true);
    rl.on('line', data => {
        if (data === 'exit') process.exit(0);
        let query;
        try {
            query = JSON.parse(data);
        } catch (e) {
            console.log('Invalid JSON\n',data);
            return;
        }
        collection.find(query).toArray((err, result) => {
            console.log(result);
            console.log(`${result.length} records found.`);
            rl.prompt(true);
        });
    });
});