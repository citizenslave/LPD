import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable, of } from 'rxjs';

import * as JsEncryptModule from 'jsencrypt';

import { CryptoService } from './crypto.service';
import { CONSTANTS } from './constants.const';
import { CacheService } from './cache.service';

@Injectable({
	providedIn: 'root'
})
export class UserService {
	userProfile: any = {
		'username': undefined,
		'publicKey': undefined,
		'pwHash': undefined,
		'sessionSalt': undefined,
		'permissions': undefined
	};

	encryptionInstance: JsEncryptModule.JSEncrypt;
	sessionPublicKey: string;

	constructor(
			private http: HttpClient,
			private cryptoService: CryptoService,
			public cacheService: CacheService) {
		this.encryptionInstance = this.cryptoService.getJSEncryptInstance();
	}

	getSession(): Observable<boolean> {
		let publicKey: string = this.encryptionInstance.getPublicKey();
		return new Observable(observer => {
			this.http.get<any>(`${CONSTANTS.APIURL}/users/key`, { withCredentials: true }).subscribe(json => {
				this.sessionPublicKey = json.publicKey;
				let sessionPassword = localStorage.sessionPassword;
				if (!sessionPassword) {
					console.log('No session');
					observer.next(false);
					observer.complete();
					return;
				}
				let esp = this.cryptoService.encryptAsymmetrically(sessionPassword, json.publicKey);
				publicKey = this.cryptoService.encryptAsymmetrically(publicKey, json.publicKey);
				this.http.post(`${CONSTANTS.APIURL}/users/session`,
						{ 'publicKey': publicKey, 'esp': esp },
						{ 'withCredentials': true }).subscribe(json => {
					this.cryptoService.saveKey(this.encryptionInstance.decrypt(json['encryptedHash']));
					var decryptedPayload = JSON.parse(this.encryptionInstance.decrypt(json['encryptedProfile']));
					this.userProfile.username = decryptedPayload['username'];
					this.userProfile.permissions = decryptedPayload['permissions'];
					this.cacheService.refreshCache().subscribe(json => {
						observer.next(true);
						observer.complete();
					});
				},
				err => {
					console.log(err.error);
					observer.next(false);
					observer.complete();
				});
			},
			err => {
				console.log(err.error);
				observer.next(false);
				observer.complete();
			});
			return { unsubscribe() {} };
		});
	}

	registerUser(username: string) {
		return new Observable(observer => {
			this.http.get<any>(`${CONSTANTS.APIURL}/users/key`, { 'withCredentials': true }).subscribe(json => {
				username = this.cryptoService.encryptAsymmetrically(username, json.publicKey);
				this.http.post(`${CONSTANTS.APIURL}/users/register`,
						{ 'username': username },
						{ 'withCredentials': true }).subscribe(json => {
					observer.next(json);
					observer.complete();
				});
			});
			return { unsubscribe() {} };
		});
	}

	lookupToken(token: string): Observable<string> {
		let clientPublicKey = this.encryptionInstance.getPublicKey();
		return new Observable(observer => {
			this.http.get<any>(`${CONSTANTS.APIURL}/users/key`, { 'withCredentials': true }).subscribe(json => {
				clientPublicKey = { 'publicKey': this.cryptoService.encryptAsymmetrically(clientPublicKey, json.publicKey) };
				this.http.post(`${CONSTANTS.APIURL}/users/lookupToken/${token}`,
						clientPublicKey, { 'withCredentials': true }).subscribe(json => {
					this.userProfile.username = this.encryptionInstance.decrypt(json['username']);
					this.userProfile.publicKey = json['publicKey'];
					observer.next('SUCCESS');
					observer.complete();
				},
				err => {
					observer.next(err.error);
					observer.complete();
				});
			});
			return { unsubscribe() {} };
		});
	}

	setPassword(token: string, password: string) {
		let hashedPassword: string = this.cryptoService.hashPassword(password);
		hashedPassword = this.cryptoService.encryptAsymmetrically(hashedPassword, this.userProfile.publicKey);
		return this.http.post(`${CONSTANTS.APIURL}/users/password/` + token, { 'hash': hashedPassword });
	}

	findUser(username: string): Observable<Number> {
		this.userProfile.username = username;
		return new Observable(observer => {
			this.http.get<any>(`${CONSTANTS.APIURL}/users/key`, { 'withCredentials': true }).subscribe(json => {
				username = this.cryptoService.encryptAsymmetrically(username, json.publicKey);
				this.sessionPublicKey = json.publicKey;
				this.http.post(`${CONSTANTS.APIURL}/users/login`,
						{ 'username': username }, { 'withCredentials': true }).subscribe(json => {
					this.userProfile.publicKey = json['publicKey'];
					observer.next(200);
					observer.complete();
				},
				err => {
					console.log(err.error);
					observer.next(err.status);
					observer.complete();
				});
			});
			return { unsubscribe() {} };
		});
	}

	loginUser(username: string, password: string) {
		let hashedPassword: string = this.userProfile.pwHash = this.cryptoService.hashPassword(password);
		hashedPassword = this.cryptoService.encryptAsymmetrically(hashedPassword, this.userProfile.publicKey);
		username = this.cryptoService.encryptAsymmetrically(username, this.sessionPublicKey);
		this.userProfile.sessionSalt = this.cryptoService.generateRandom(256/8);
		this.cryptoService.configure(this.userProfile.pwHash, this.userProfile.sessionSalt);
		return new Observable(observer => {
			var encryptedSalt = this.cryptoService.encryptAsymmetrically(this.userProfile.sessionSalt, this.userProfile.publicKey);
			this.http.post<any>(`${CONSTANTS.APIURL}/users/login`, {
				'username': username,
				'hash': hashedPassword,
				'sessionSalt': encryptedSalt
			}, { 'withCredentials': true }).subscribe(json => {
				let sessionPassword = this.cryptoService.decryptPayload(json.esp) as any;
				localStorage.setItem('sessionPassword', sessionPassword.sessionPassword);
				this.cacheService.refreshCache().subscribe(json => {
					this.getPermissions().subscribe(json => {
						this.userProfile.permissions = json['permissions'];
						observer.next(json);
						observer.complete();
					});
				},
				err => {
					observer.next(err.error);
					observer.complete();
				});
				return { unsubscribe() {} };
			},
			err => observer.error(err.error));
		});
	}

	getPermissions() {
		return this.cryptoService.encryptedGet(`${CONSTANTS.APIURL}/users/permissions`);
	}

	getCallSheetLink() {
		return this.cryptoService.encryptedGet(`${CONSTANTS.APIURL}/users/getCallSheetLink`);
	}

	setCallSheetLink(linkTemplate) {
		console.log(linkTemplate);
		var payload = { 'callSheetTemplate': linkTemplate };
		console.log(payload);
		return this.cryptoService.encryptedPut(`${CONSTANTS.APIURL}/users/setCallSheetLink`, payload);
	}

	getAllUsers(): Observable<any> {
		return this.cryptoService.encryptedGet(`${CONSTANTS.APIURL}/users/getAllUsers`);
	}

	setPermissions(username, permissions) {
		var payload = { 'username': username, 'permissions': permissions };
		console.log(payload);
		return this.cryptoService.encryptedPost(`${CONSTANTS.APIURL}/users/setPermissions`, payload);
	}

	loadUserAor(username, permission) {
		let payload = { 'username': username, 'permission': permission };
		return this.cryptoService.encryptedPost(`${CONSTANTS.APIURL}/users/loadUserAor`, payload);
	}

	updateAor(username, permission, aorValues) {
		let payload = { 'username': username, 'permission': permission, 'aorValues': aorValues };
		return this.cryptoService.encryptedPost(`${CONSTANTS.APIURL}/users/setAor`, payload);
	}

	checkPermission(mask: string = 'NOOP') {
		if (!this.userProfile.permissions) return false;
		if (!this.cacheService.permissions) return false;
		let masks: string[] = mask.split('|');
		let maskMix: number = this.cacheService.permissions['NOOP'].mask;
		masks.forEach(item => maskMix |= this.cacheService.permissions[item].mask);
		return ((this.userProfile.permissions & maskMix) === maskMix) ||
				(this.userProfile.permissions & this.cacheService.permissions['SYSADMIN'].mask)
	}

	logoutUser() {
		this.userProfile = {};
		localStorage.removeItem('sessionPassword');
		return this.http.get(`${CONSTANTS.APIURL}/users/logout`, { 'withCredentials': true });
	}
}
