import { Component, OnInit } from '@angular/core';

import { PanelModule } from 'primeng/panel';
import { ButtonModule } from 'primeng/button';

import { VotersService } from '../services/voters.service';
import { VoterSearchService } from '../services/voter-search.service';

@Component({
	selector: 'app-voter-search-bar',
	templateUrl: './voter-search-bar.component.html',
	styleUrls: ['./voter-search-bar.component.css']
})
export class VoterSearchBarComponent implements OnInit {
	votersService: VotersService;
	voterSearchService: VoterSearchService;
	
	constructor(
			private _votersService: VotersService,
			private _voterSearchService: VoterSearchService) {
		this.votersService = this._votersService;
		this.voterSearchService = this._voterSearchService;
	}

	ngOnInit() {}

	clearVoterSearch(evt: Event, reset: boolean = false) {
		evt.stopPropagation();
		this.votersService.voterData = [];
		this.votersService.searchBar = false;
		this.votersService.queryObj = null;
		if (reset) this.votersService.voterForm.reset();
	}
}
