'use strict';

const MongoClient = require('mongodb').MongoClient;
const MONGO_URL = require('./config/db-config');
const DB_NAME = 'LPD';
const DB_OPTIONS = {
	'useNewUrlParser': true
};

if (process.argv.length <= 3) {
    console.log('Insufficient Arguments...');
    process.exit(0);
}

const src = process.argv[2], dst = process.argv[3];
console.log(`Backing up collection ${src} into collection ${dst}...`);

MongoClient.connect(MONGO_URL, DB_OPTIONS, (err, db) => {
    if (err) throw err;
    const srcCollection = db.db(DB_NAME).collection(src);
    const dstCollection = db.db(DB_NAME).collection(dst);

    dstCollection.drop(err => {
        if (err) console.error(err.errmsg);

        let item = 0;

        const cursor = srcCollection.find();

        cursor.count().then(count => {
            console.log(`Found ${count} documents.`);

            cursor.forEach((data) => {
                dstCollection.insertOne(data, r => {
                    if (!(++item%10000)) console.log(item);
                });
            }).then(process.exit.bind({}, 0));
        });
    });
});