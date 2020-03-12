'use strict';

const { google } = require('googleapis');
const fs = require('fs');
const readline = require('readline');

const scopes = [
	'https://mail.google.com',
	'https://www.googleapis.com/auth/gmail.send',
	'https://www.googleapis.com/auth/gmail.compose',
	'https://www.googleapis.com/auth/gmail.modify',
	'https://www.googleapis.com/auth/gmail.readonly'
];

module.exports = class GMailer {
	mailer;

	constructor() {
		fs.readFile(process.cwd()+'/credentials.json', (error, credentials) => {
			if (error) console.error(process.cwd()+'/', error);
			const { client_secret, client_id, redirect_uris } = JSON.parse(credentials).installed;
			const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
			fs.readFile(process.cwd()+'/token.json', (error, token) => {
				if (error) {
					const authUrl = oAuth2Client.generateAuthUrl({
						'access_type': 'offline',
						'scope': scopes
					});
					console.log('Authorize app: ', unescape(authUrl));
					const rl = readline.createInterface({
						'input': process.stdin,
						'output': process.stdout
					});
					rl.question('CODE: ', (code) => {
						rl.close();
						oAuth2Client.getToken(code, (error, token) => {
							if (error) return console.error(error);
							oAuth2Client.credentials = token;
							fs.writeFile('token.json', JSON.stringify(token), (e) => {
								this.mailer = this.getMailer(oAuth2Client);
								this.sendMail('lpdelaware@gmail.com', 'LPD App Started', '<em>SUCCESS</em>')
									.then((r) => console.log(r.statusText)).catch(console.error);
							});
						});
					});
				} else {
					oAuth2Client.credentials = JSON.parse(token);
					this.mailer = this.getMailer(oAuth2Client);
					this.sendMail('lpdelaware@gmail.com', 'LPD App Started', '<em>SUCCESS</em>')
						.then(console.log).catch(console.error);
				}
			});
		});
	}

	getMailer(client) {
		return google.gmail({
			'version': 'v1',
			'auth': client
		});
	}

	sendMail(to, subj, htmlText) {
		return new Promise((resolve, reject) => {
			const utf8 = `=?utf-8?B?${Buffer.from(subj).toString('base64')}?=`;
			const part = [
				'From: LP Delaware <lpdelaware@gmail.com>',
				`To: LPD App User <${to}>`,
				'Content-type: text/html; charset=utf-8',
				'MIME-Version: 1.0',
				`Subject: ${utf8}`,
				'',
				htmlText
			];
			const message = part.join('\n');
			const coded = Buffer.from(message)
				.toString('base64')
				.replace(/\+/g, '-')
				.replace(/\//g, '_')
				.replace(/=+$/, '');

			this.mailer.users.messages.send({
				'userId': 'me',
				'requestBody': {
					'raw': coded
				}
			}).then(resolve).catch(reject);
		});
	}
}