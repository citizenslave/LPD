import { Component, OnInit, ViewChild, ElementRef, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { formatDate } from '@angular/common';

import { TableModule } from 'primeng/table';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { PanelModule } from 'primeng/panel';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';

import { switchMap } from 'rxjs/operators';
import { of } from 'rxjs';

import * as JsEncryptModule from 'jsencrypt';
import * as CryptoJS from 'crypto-js';

import { CallSheetComponent } from '../call-sheet/call-sheet.component';

import { CacheService } from '../services/cache.service';
import { CryptoService } from '../services/crypto.service';

import { UserService } from '../services/user.service';
import { VotersService } from '../services/voters.service';
import { VoterSearchService } from '../services/voter-search.service';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class MainComponent implements OnInit {
	@ViewChild('editVoterData')
			set setEditField(content: ElementRef)
			{ this.votersService.editVoterData = content; }
	@ViewChild('voterList')
			set setVoterList(content: ElementRef)
			{ this.votersService.voterList = content; }
	@ViewChild(CallSheetComponent)
			callSheetComponent: CallSheetComponent;
	
	votersService: VotersService;

	constructor(
			private cacheService: CacheService,
			private userService: UserService,
			private _votersService: VotersService,
			private voterSearchService: VoterSearchService,
			private fb: FormBuilder) {
		this.votersService = this._votersService;
	}

	ngOnInit() {}

	showSearchPanel() {
		if (!this.votersService.voterForm) return false;
		if (!this.cacheService.voterFields) return false;
		if (!this.userService.userProfile.permissions) return false;
		if (!this.userService.checkPermission('VOTER_SEARCH')) return false;
		return true;
	}

	lazyLoadVoters(evt) {
		console.log(evt);
		if (!this.votersService.queryObj) return;
		this.voterSearchService.isSearchLoading = true;
		if (!evt.query) this.votersService.queryObj['first'] = evt.first;
		if (!evt.query) this.votersService.queryObj['rows'] = evt.rows;
		this.votersService.find(this.votersService.queryObj).subscribe(json => {
			this.votersService.voterData = json;
			this.votersService.searchBar = true;
			this.voterSearchService.isSearchLoading = false;
			this.votersService.voterForm.enable();
			console.log(this.votersService.voterData);
		});
	}

	getFieldText(field) {
		if (field) {
			if (field.length) return field;
			if (field.getTypeName && field.getTypeName() === 'HTML') return field;
		}
		return 'No Data';
	}

	canEditField(field) {
		return this.userService.checkPermission('VOTER_EDIT|VOTER_SEARCH') && field.canEdit;
	}

	isBooleanField(fieldType) {
		return fieldType === this.cacheService.voterFieldTypes.BOOLEAN;
	}

	editField(evt, field) {
		if (!this.userService.checkPermission('VOTER_EDIT|VOTER_SEARCH')) return;
		if (!field.canEdit) return;
		this.votersService.editVoterField(evt, field);
	}

	generateEmailList() {
		var emails = this.votersService.voterData['results'].map(voter => {
			if (voter['email'] && voter['email'].length)
				return voter['email'];
			else return false;
		}).filter(voter => { return voter; });
		var list = emails.join(';');
		navigator.clipboard.writeText(list).then(() => { alert('Emails copied to clipboard'); });
	}
}