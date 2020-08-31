import { Component, OnInit, Injector } from '@angular/core';

import { VotersService } from '../../../services/voters.service';

@Component({
	selector: 'app-voter-search-form',
	templateUrl: './voter-search-form.component.html',
	styleUrls: ['./voter-search-form.component.css']
})
export class VoterSearchFormComponent implements OnInit {
	votersService: VotersService;

	constructor(private injector: Injector) {
		this.votersService = this.injector.get(VotersService);
	}

	ngOnInit(): void {}

	getValues(field: any): void {
		this.votersService.isSearchLoading = true;
		this.votersService.cacheService.getFieldValues(field).subscribe(json => {
			this.votersService.isSearchLoading = false;
		});
	}

	thisYear(): number {
		return ((new Date())['getYear']()+1900);
	}
}
