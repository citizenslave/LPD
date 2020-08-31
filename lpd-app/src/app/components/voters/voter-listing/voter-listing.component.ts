import { Component, OnInit, ElementRef, ViewChild, Injector } from '@angular/core';

import { UserService } from '../../../services/user.service';
import { VotersService } from '../../../services/voters.service';
import { CacheService } from '../../../services/cache.service';

import { CallSheetComponent } from '../../call-sheet/call-sheet.component';

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

	emails: string = '';
	isoRegEx: RegExp = new RegExp(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

	constructor(
			private injector: Injector,
			private cacheService: CacheService,
			private userService: UserService) {
		this.votersService = this.injector.get(VotersService);
	}

	ngOnInit(): void {}

	getFieldText(fieldValue: any, field: any): string {
		if (this.isBooleanField(field.type))
			return '';
		if (fieldValue) {
			if (this.isoRegEx.test(fieldValue) && field.field !== 'updatedAt')
				return fieldValue.split('T')[0];
			if (field.type === this.votersService.cacheService.voterFieldTypes.ARRAY)
				return fieldValue.join('&nbsp;&nbsp;')
			if (fieldValue.length) return fieldValue;
		}
		return 'No Data';
	}

	canEditField(voter: any, field: any): boolean {
		return this.userService.checkPermission('VOTER_EDIT|VOTER_SEARCH')
				&& voter.canEdit && field.canEdit;
	}

	isBooleanField(fieldType: number): boolean {
		return fieldType === this.cacheService.voterFieldTypes.BOOLEAN;
	}

	editField(evt: any, field: any): void {
		if (!this.userService.checkPermission('VOTER_EDIT|VOTER_SEARCH')) return;
		if (!field.canEdit) return;
		this.votersService.editVoterField(evt, field);
	}

	generateEmailList(): void {
		const emailQuery = {
			'query': this.votersService.queryObj['query'],
			'first': 0,
			'rows': this.votersService.voterData['count']
		};
		this.votersService.find(emailQuery).subscribe(json => {
			const emails = (<any[]>json.results).map(voter => {
				if (voter['email'] && voter['email'].length && voter['email'] !== 'DECLINED')
					return voter['email'];
				else return false;
			}).filter(voter => { return voter; });
			const list = emails.join(';');
			this.emails = list;
			setTimeout(() => {
				this.emailsField.nativeElement.select();
				document.execCommand('copy');
				alert('Email addresses copied to clipboard');
			});
		});
	}
}
