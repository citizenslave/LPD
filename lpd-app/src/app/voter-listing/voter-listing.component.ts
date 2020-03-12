import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';

import { UserService } from '../services/user.service';
import { VotersService } from '../services/voters.service';
import { VoterSearchService } from '../services/voter-search.service';
import { CacheService } from '../services/cache.service';

import { CallSheetComponent } from '../call-sheet/call-sheet.component';

@Component({
	selector: 'app-voter-listing',
	templateUrl: './voter-listing.component.html',
styleUrls: ['./voter-listing.component.css']
})
export class VoterListingComponent implements OnInit {
	@ViewChild('editVoterData')
			set setEditField(content: ElementRef)
			{ this.votersService.editVoterData = content; }
	@ViewChild('voterList')
			set setVoterList(content: ElementRef)
			{ this.votersService.voterList = content; }
	@ViewChild(CallSheetComponent)
			callSheetComponent: CallSheetComponent;
	@ViewChild('emailsField')
			emailsField: ElementRef;
	
	votersService: VotersService;
	voterSearchService: VoterSearchService;

	emails: string = '';

	constructor(
			private cacheService: CacheService,
			private userService: UserService,
			private _votersService: VotersService,
			private _voterSearchService: VoterSearchService) {
		this.votersService = this._votersService;
		this.voterSearchService = this._voterSearchService;
	}

	ngOnInit() {}

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

	getFieldText(fieldValue, field) {
		// console.log(this.votersService.selectedVoter)
		if (fieldValue) {
			const isoRegEx = new RegExp(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
			if (isoRegEx.test(fieldValue) && field.field !== 'updatedAt') return fieldValue.split('T')[0];
			if (field.type === this.votersService.cacheService.voterFieldTypes.ARRAY) return fieldValue.join('&nbsp;&nbsp;')
			if (fieldValue.length) return fieldValue;
			// if (field.getTypeName && field.getTypeName() === 'HTML') return field;
		}
		return 'No Data';
	}

	canEditField(voter, field) {
		return this.userService.checkPermission('VOTER_EDIT|VOTER_SEARCH') && voter.canEdit && field.canEdit;
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
		var emailQuery = {
			'query': this.votersService.queryObj['query'],
			'first': 0,
			'rows': this.votersService.voterData['count']
		};
		this.votersService.find(emailQuery).subscribe(json => {
			console.log(json);
			var emails = json.results.map(voter => {
				if (voter['email'] && voter['email'].length)
					return voter['email'];
				else return false;
			}).filter(voter => { return voter; });
			var list = emails.join(';');
			this.emails = list;
			setTimeout(() => {
				this.emailsField.nativeElement.select();
				document.execCommand('copy');
				alert('Email addresses copied to clipboard');
			});
		});
	}
}
