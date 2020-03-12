import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';

import * as JsEncryptModule from 'jsencrypt';
import * as CryptoJS from 'crypto-js';

@Injectable({
	providedIn: 'root'
})
export class CryptoService {
	key: CryptoJS.lib.WordArray;

	constructor(
			private http: HttpClient) {}

	configure(_pwHash: string, _salt: string) {
		this.key = CryptoJS.enc.Utf8.parse(CryptoJS.PBKDF2(_pwHash, _salt, { 'keySize': 256/64 }).toString(CryptoJS.enc.Hex));
	}

	saveKey(_key: string) {
		this.key = CryptoJS.enc.Utf8.parse(_key);
	}

	encryptedRequest(request: Observable<any>): Observable<any> {
		return new Observable<any>(observer => {
			request.subscribe(json => {
				observer.next(this.decryptPayload(json));
				observer.complete();
			},
			err => {
				observer.error(err.error);
				observer.complete();
			});
			return { unsubscribe() {} };
		});
	}

	encryptedPost(url: string, payload: object): Observable<any> {
		let encryptedPayload = this.encryptPayload(JSON.stringify(payload));
		var request = this.http.post(url, encryptedPayload, { 'withCredentials': true });
		return this.encryptedRequest(request);
	}

	encryptedPut(url: string, payload: object): Observable<any> {
		let encryptedPayload = this.encryptPayload(JSON.stringify(payload));
		var request = this.http.put(url, encryptedPayload, { 'withCredentials': true });
		return this.encryptedRequest(request);
	}

	encryptedGet(url: string): Observable<any> {
		var request = this.http.get(url, { 'withCredentials': true });
		return this.encryptedRequest(request);
	}

	generateRandom(length: Number): string {
		return CryptoJS.lib.WordArray.random(length).toString();
	}

	encryptPayload(payload: string): object {
		if (!this.key) return {};

		let iv: CryptoJS.lib.WordArray = CryptoJS.lib.WordArray.random(128/8);
		let encryptedPayload: string = CryptoJS.AES.encrypt(payload, this.key, { 'mode': CryptoJS.mode.CBC, 'iv': iv }).toString();
		let postBody: object = {
			'iv': iv.toString(CryptoJS.enc.Hex),
			'payload': encryptedPayload
		};
		return postBody;
	}

	decryptPayload(obj: object): object {
		if (!this.key || !obj['iv']) return {};

		let iv: CryptoJS.lib.WordArray = CryptoJS.enc.Hex.parse(obj['iv']);
		let decryptedPayload: string = CryptoJS.AES.decrypt(obj['encryptedPayload'], this.key, { 'iv': iv }).toString(CryptoJS.enc.Utf8);
		return JSON.parse(decryptedPayload);
	}

	getJSEncryptInstance(): JsEncryptModule.JSEncrypt {
		let instance: JsEncryptModule.JSEncrypt = new JsEncryptModule.JSEncrypt();
		instance.getKey();
		return instance;
	}

	hashPassword(password: string): string {
		return CryptoJS.PBKDF2(password, 'taxation-is-theft', { 'keySize': 256/32 }).toString();
	}

	encryptAsymmetrically(payload: string, publicKey: string): string {
		let instance: JsEncryptModule.JSEncrypt = new JsEncryptModule.JSEncrypt();
		instance.setPublicKey(publicKey);
		return instance.encrypt(payload);
	}
}