import { Component, OnInit, Injector } from '@angular/core';

import { VotersService } from '../../../services/voters.service';

@Component({
	selector: 'app-voter-search-bar',
	templateUrl: './voter-search-bar.component.html',
	styleUrls: ['./voter-search-bar.component.css']
})
export class VoterSearchBarComponent implements OnInit {
	votersService: VotersService;
	
	constructor(private injector: Injector) {
		this.votersService = this.injector.get(VotersService);
	}

	ngOnInit(): void {}

	showResults(): string {
		if (this.votersService.voterData.count && this.votersService.searchBar)
			return ` - (${this.votersService.voterData.count}) Results`;
		else return '';
	}

	disableClear(): boolean {
		return !(this.votersService.voterData && this.votersService.voterData.results);
	}

	disableReset(): boolean {
		return !this.votersService.voterForm.dirty || this.votersService.isSearchLoading;
	}
	
	disableSearch(): boolean {
		return this.votersService.isSearchLoading;
	}
}
