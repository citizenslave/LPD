import { Injectable, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';

import { Observable, of } from 'rxjs';

import { TableModule } from 'primeng/table';

import { CryptoService } from './crypto.service';
import { CONSTANTS } from './constants.const';
import { CacheService } from './cache.service';

@Injectable({
	providedIn: 'root'
})
export class VotersService {
	voterForm: FormGroup;

	voterData: any = {};
	fields: any[] = [];
	queryObj: object = null;

	searchBar: boolean = false;
	isSearchLoading: boolean = false;

	resultColumns: number = 0;
	selectedVoter: object;

	voterList: ElementRef<TableModule> = null;
	editVoterData: ElementRef = null;

	isEditLoading: boolean = false;
	editField: object = {};
	editForm: FormGroup;

	showCallSheet: boolean = false;

	constructor(
			private cryptoService: CryptoService,
			public cacheService: CacheService,
			private fb: FormBuilder) {}

	query(evt) {
		console.log(evt);
		evt.stopPropagation();
		this.isSearchLoading = true;console.log(this.voterForm.value)
		let fields = Object.getOwnPropertyNames(this.voterForm.value);
		let queryObj = {};

		for (let i=0; i<fields.length; i++) {
			var value = this.voterForm.value[fields[i]];
			if (value && (!Array.isArray(value) || value.length)) {
				switch (this.cacheService.lookupField(fields[i]).type) {
				case this.cacheService.voterFieldTypes.MULTISELECT:
					queryObj[fields[i]] = { '$in': this.voterForm.value[fields[i]] };
					break;
				case this.cacheService.voterFieldTypes.CALENDAR:
					if (this.voterForm.value[fields[i]][0] === this.voterForm.value[fields[i]][1]
							|| this.voterForm.value[fields[i]][1] === null)
						queryObj[fields[i]] = this.voterForm.value[fields[i]][0].toISOString();
					else
						queryObj[fields[i]] = {
							'$gte': this.voterForm.value[fields[i]][0].toISOString(),
							'$lt': this.voterForm.value[fields[i]][1].toISOString()
						};
					break;
				default:
					queryObj[fields[i]] = this.voterForm.value[fields[i]];
				}
			}
		}
		queryObj = { 'query': queryObj };
		queryObj['first'] = evt.first?evt.first:0;
		queryObj['rows'] = evt.rows?evt.rows:25;

		console.log(queryObj);
		this.voterForm.disable();
		this.queryObj = null;
		setTimeout(() => this.queryObj = queryObj);
	}

	lazyLoadVoters(evt: any): void {
		if (!this.queryObj) return;
		this.isSearchLoading = true;
		if (!evt.query) this.queryObj['first'] = evt.first;
		if (!evt.query) this.queryObj['rows'] = evt.rows;
		this.find(this.queryObj).subscribe(json => {
			this.voterData = json;
			this.searchBar = true;
			this.isSearchLoading = false;
			this.voterForm.enable();
		});
	}

	find(queryObj): Observable<any> {
		return this.cryptoService.encryptedPost(`${CONSTANTS.APIURL}/voters/search`, queryObj);
	}

	update(queryObj): Observable<any> {
		return this.cryptoService.encryptedPut(`${CONSTANTS.APIURL}/voters/update`, queryObj);
	}

	clearVoterSearch(evt: Event, reset: boolean = false) {
		evt.stopPropagation();
		this.voterData = [];
		this.searchBar = false;
		this.queryObj = null;
		if (reset) this.voterForm.reset();
	}

	processVoterSearchKeys(json) {
		let controls: object = {};
		this.fields = json;
		this.fields.forEach(field => {
			if (field.display & this.cacheService.voterFieldViews.RESULT) this.resultColumns++;
			controls[field.field] = this.fb.control({ 'value': '', 'disabled': false });
		});
		this.voterForm = this.fb.group(controls);
	}

	checkDisplayFlags(flag: number, type: string) {
		return flag & this.cacheService.voterFieldViews[type];
	}

	getCheckClass(fieldName) {
		var value = this.voterForm.get(fieldName).value;
		if (value === '' || value === null) return 'question';
		else if (value === true) return 'check';
		else if (value === false) return 'times';
	}

	cycleCheck(fieldName) {
		var field = this.voterForm.get(fieldName);
		var value = field.value;
		if (value === '' || value === null) field.patchValue(true);
		else if (value === true) field.patchValue(false);
		else if (value === false) field.reset('');
		this.voterForm.markAsDirty();
		this.voterForm.updateValueAndValidity();
	}

	thisYear() {
		return ((new Date())['getYear']()+1900);
	}

	expandRow(evt) {
		console.log(evt);
		let controls: object = {};
		this.selectedVoter = evt.data;
		this.fields.forEach(field => {
			controls[field.field] = this.fb.control({ 'value': evt.data[field.field], 'disabled': false });
		});
		controls['_id'] = this.fb.control({ 'value': evt.data['_id'], 'disabled': false });
		this.editForm = this.fb.group(controls);
		this.editField = {};
	}

	editVoterField(evt, field) {
		console.log(evt, field);
		if (this.cacheService.voterFieldTypes.BOOLEAN === field.type) {
			var currentValue = this.editForm.get(field.field).value;
			console.log(currentValue);
			if (field.field === 'verified' && !currentValue) {
				var verificationAllowed = true;
				var email = this.editForm.get('email');
				var phone = this.editForm.get('PHONE');
				var emailValidator = Validators.compose([ Validators.required, Validators.email ]);
				var phoneValidator = Validators.compose([ Validators.required, Validators.minLength(10), Validators.maxLength(10) ]);
				if (emailValidator(email) && (!email.value || email.value.toUpperCase() !== 'DECLINED')) {
					alert('Invalid email address, not DECLINED');
					verificationAllowed = false;
				}
				if (phoneValidator(phone)) {
					alert('Invalid phone number');
					verificationAllowed = false;
				}
				if (!verificationAllowed) return;
			}
			this.editForm.get(field.field).patchValue(!currentValue);
			this.updateVoterField(evt, field);
		} else {
			this.editField[field.field] = true;
			if (this.cacheService.voterFieldTypes.TEXT !== field.type) {
				setTimeout(() => this.editVoterData.nativeElement.focus());
				console.log(this.editForm.value[field.field]);
			}
		}
	}

	updateVoterField(evt, field) {
		if (this.isEditLoading) return;
		var fieldName = field.field;
		console.log(this.editForm.value);
		if (this.editForm.pristine && field.type !== this.cacheService.voterFieldTypes.BOOLEAN)
			return this.editField[fieldName] = false;;
		this.isEditLoading = true;
		this.editForm.disable();
		this.update(this.editForm.value).subscribe(json => {
			console.log(json);
			var query = {
				'query': {
					'VOTER ID': this.editForm.value['VOTER ID']
				},
				'first': 0,
				'rows': 1
			};
			this.find(query).subscribe(json => {
				this.voterData['results'] = this.voterData['results'].map(voter => {
					this.editField[fieldName] = false;
					this.editForm.enable();
					this.isEditLoading = false;
					if (voter['VOTER ID'] !== this.editForm.value['VOTER ID']) return voter;
					Object.keys(json.results[0]).forEach(key => {
						if (key !== '_id' && key !== 'timestamp' && key !== 'canEdit'
								&& this.cacheService.lookupField(key).type === this.cacheService.voterFieldTypes.TEXT)
							json.results[0][key] = json.results[0][key];
					});
					return json.results[0];
				});
				console.log(json);
			});
		});
	}

	showVoter(id) {
		console.log(this.voterList);
		this.voterList['expandedRowKeys'] = {};
		this.voterList['expandedRowKeys'][id] = true;
		var voter = this.voterData['results'].filter(voter => { return voter['VOTER ID'] === id; })[0];
		this.expandRow({ 'data': voter });
	}
}