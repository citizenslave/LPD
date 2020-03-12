import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';

import { CryptoService } from './crypto.service';
import { CONSTANTS } from './constants.const';

@Injectable({
	providedIn: 'root'
})
export class CacheService {
	permissions;
	voterFieldViews;
	voterFieldTypes;
	voterFields;
	voterFieldValues = {};

	constructor(
			private cryptoService: CryptoService,
			private http: HttpClient) {}

	refreshCache() {
		return new Observable(observer => {
			forkJoin(
					this.getPermissions(),
					this.getVoterFieldViews(),
					this.getVoterFieldTypes(),
					this.getVoterFields()/*,
					this.getVoterFieldValues()*/).subscribe(json => {
				// this.voterFieldValues = json[4];
				observer.next(json);
				observer.complete();
			},
			err => {
				observer.error(err);
				observer.complete();
			});
			return { unsubscribe() {} };
		});
	}

	getPermissions() {
		return new Observable(observer => {
			this.http.get(`${CONSTANTS.APIURL}/permissions/get`, { 'withCredentials': true }).subscribe(json => {
				this.permissions = this.cryptoService.decryptPayload(json);
				observer.next(this.permissions);
				observer.complete();
			},
			err => {
				console.log(err);
				observer.next({ 'error': err.error });
				observer.complete();
			});
			return { unsubscribe() {} };
		});
	}

	getVoterFieldViews() {
		return new Observable(observer => {
			this.http.get(`${CONSTANTS.APIURL}/voterFields/getViews`, { 'withCredentials': true }).subscribe(json => {
				this.voterFieldViews = this.cryptoService.decryptPayload(json);
				observer.next(this.voterFieldViews);
				observer.complete();
			},
			err => {
				console.log(err);
				observer.next({ 'error': err.error });
				observer.complete();
			});
			return { unsubscribe() {} };
		});
	}

	getVoterFieldTypes() {
		return new Observable(observer => {
			this.http.get(`${CONSTANTS.APIURL}/voterFields/getTypes`, { 'withCredentials': true }).subscribe(json => {
				this.voterFieldTypes = this.cryptoService.decryptPayload(json);
				observer.next(this.voterFieldTypes);
				observer.complete();
			},
			err => {
				console.log(err);
				observer.next({ 'error': err.error });
				observer.complete();
			});
			return { unsubscribe() {} };
		});
	}

	getVoterFields() {
		return new Observable(observer => {
			this.http.get(`${CONSTANTS.APIURL}/voterFields/get`, { 'withCredentials': true }).subscribe(json => {
				this.voterFields = this.cryptoService.decryptPayload(json);
				observer.next(this.voterFields);
				observer.complete();
			},
			err => {
				console.log(err);
				observer.next({ 'error': err.error });
				observer.complete();
			});
			return { unsubscribe() {} };
		});
	}

	getVoterFieldValues() {
		return this.cryptoService.encryptedGet(`${CONSTANTS.APIURL}/voterFields/getValues`);
	}

	getFieldValues(field, query = {}) {
		let payload = { 'field': field, 'query': query };
		return new Observable(observer => {
			this.cryptoService.encryptedPost(`${CONSTANTS.APIURL}/voterFields/getValues`, payload).subscribe(json => {
				// console.log(json[field]);
				let numbers = json[field].filter(v => Number(v.value) || Number(v.value) === 0);
				// console.log(numbers);
				this.voterFieldValues[field] = json[field];
				this.voterFieldValues[field].sort((a, b) =>
					numbers.length === json[field].length?(Number(a.value) - Number(b.value)):(a.value - b.value));
				observer.next(json);
				observer.complete();
			},
			err => {
				console.log(err);
				observer.error({ 'error': err.error });
				observer.complete();
			});
			return { unsubscribe() {} };
		});
	}

	lookupField(fieldName) {
		return this.voterFields.filter(field => field.field === fieldName)[0];
	}
}
