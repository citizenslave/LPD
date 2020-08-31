import { Component, OnInit, ViewChild, ElementRef, ViewEncapsulation } from '@angular/core';
import { FormBuilder } from '@angular/forms';

import { CallSheetComponent } from '../call-sheet/call-sheet.component';

import { CacheService } from '../../services/cache.service';

import { UserService } from '../../services/user.service';
import { VotersService } from '../../services/voters.service';

@Component({
  selector: 'app-voters',
  templateUrl: './voters.component.html',
  styleUrls: ['./voters.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class VotersComponent implements OnInit {
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
			private fb: FormBuilder) {
		this.votersService = this._votersService;
	}

	ngOnInit(): void {}

	showSearchPanel(): boolean {
		if (!this.votersService.voterForm) return false;
		if (!this.cacheService.voterFields) return false;
		if (!this.userService.userProfile.permissions) return false;
		if (!this.userService.checkPermission('VOTER_SEARCH')) return false;
		return true;
	}
}