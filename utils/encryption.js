'use strict';

const CRYPTO = require('crypto');

function decryptRequest(req) {
	var iv = Buffer.from(req.body.iv, 'hex');
	var decryptor = CRYPTO.createDecipheriv('aes-256-cbc', req.session.sessionKey, iv);
	return JSON.parse(decryptor.update(req.body.payload, 'base64') + decryptor.final());
}

function encryptResponse(req, json) {
	var iv = CRYPTO.randomBytes(128/8);
	var encryptor = CRYPTO.createCipheriv('aes-256-cbc', req.session.sessionKey, iv);
	return {
		'iv': iv.toString('hex'),
		'encryptedPayload': encryptor.update(JSON.stringify(json), 'utf-8', 'base64') + encryptor.final('base64')
	};
}

function signToken(key, passphrase, token) {
	var signToken = CRYPTO.createSign('SHA256');
	signToken.write(token);
	signToken.end();
	return signToken.sign({ 'key': key, 'passphrase': passphrase }, 'hex');
}

function verifyToken(key, token) {
	var verifyToken = CRYPTO.createVerify('SHA256');
	verifyToken.write('TAXATION IS THEFT');
	verifyToken.end();
	return verifyToken.verify(key, token, 'hex');
}

function generateKeys(passphrase) {
	return new Promise((resolve, reject) => {
		CRYPTO.generateKeyPair('rsa', {
			'modulusLength': 4096,
			'publicKeyEncoding': {
				'type': 'spki',
				'format': 'pem'
			},
			'privateKeyEncoding': {
				'type': 'pkcs8',
				'format': 'pem',
				'cipher': 'aes-256-cbc',
				'passphrase': passphrase
			}
		}, (err, publicKey, privateKey) => {
			if (err) reject(err);
			else resolve({ 'publicKey': publicKey, 'privateKey': privateKey });
		});
	});
}

function rsaEncrypt(key, payload) {
	var payloadBuffer = Buffer.from(payload);
	var publicKey = CRYPTO.createPublicKey({
		'key': key,
		'format': 'pem',
		'type': 'pkcs1'
	});
	return CRYPTO.publicEncrypt({
		'key': publicKey,
		'padding': CRYPTO.constants.RSA_PKCS1_PADDING
	}, payloadBuffer).toString('base64');
}

function rsaDecrypt(key, passphrase, payload) {
	var payloadBuffer = Buffer.from(payload, 'base64');
	var privateKey = CRYPTO.createPrivateKey({
		'key': key,
		'format': 'pem',
		'type': 'pkcs8',
		'cipher': 'aes-256-cbc',
		'passphrase': passphrase
	});
	return CRYPTO.privateDecrypt({
		'key': privateKey,
		'padding': CRYPTO.constants.RSA_PKCS1_PADDING,
		'cipher': 'aes-256-cbc',
		'passphrase': passphrase
	}, payloadBuffer).toString();
}

function saltPassword(hash, pwSalt = '', length = 1024/8) {
	pwSalt = pwSalt.length ? pwSalt : CRYPTO.randomBytes(1024/8).toString('hex');
	var saltedHash = CRYPTO.pbkdf2Sync(hash, pwSalt, 1, length, 'sha1').toString('hex');
	return { 'hash': saltedHash, 'pwSalt': pwSalt };
}

exports.decryptRequest = decryptRequest;
exports.encryptResponse = encryptResponse;
exports.signToken = signToken;
exports.verifyToken = verifyToken;
exports.generateKeys = generateKeys;
exports.rsaEncrypt = rsaEncrypt;
exports.rsaDecrypt = rsaDecrypt;
exports.saltPassword = saltPassword;