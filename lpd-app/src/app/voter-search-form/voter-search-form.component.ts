import { Component, OnInit } from '@angular/core';

import { VotersService } from '../services/voters.service';
import { VoterSearchService } from '../services/voter-search.service';

@Component({
	selector: 'app-voter-search-form',
	templateUrl: './voter-search-form.component.html',
	styleUrls: ['./voter-search-form.component.css']
})
export class VoterSearchFormComponent implements OnInit {
	votersService: VotersService;
	voterSearchService: VoterSearchService;
	constructor(
			private _votersService: VotersService,
			private _voterSearchService: VoterSearchService) {
		this.votersService = this._votersService;
		this.voterSearchService = this._voterSearchService;
	}

	ngOnInit() {}

	getValues(field) {
		console.log(field);
		this.voterSearchService.isSearchLoading = true;
		this.votersService.cacheService.getFieldValues(field).subscribe(json => {
			console.log(json);
			this.voterSearchService.isSearchLoading = false;
		});
	}

	thisYear() {
		return ((new Date())['getYear']()+1900);
	}
}
