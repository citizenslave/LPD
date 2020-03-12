import { Injectable } from '@angular/core';
import { formatDate } from '@angular/common';

import { VotersService } from '../services/voters.service';

@Injectable({
	providedIn: 'root'
})
export class VoterSearchService {
	searchBar: boolean = false;
	isSearchLoading: boolean = false;

	constructor(
			private votersService: VotersService) {}

	query(evt) {
		console.log(evt);
		evt.stopPropagation();
		this.isSearchLoading = true;console.log(this.votersService.voterForm.value)
		let fields = Object.getOwnPropertyNames(this.votersService.voterForm.value);
		let queryObj = {};
		for (let i=0; i<fields.length; i++) {
			var value = this.votersService.voterForm.value[fields[i]];
			if (value && (!Array.isArray(value) || value.length)) {
				switch (this.votersService.cacheService.lookupField(fields[i]).type) {
				case this.votersService.cacheService.voterFieldTypes.MULTISELECT:
					queryObj[fields[i]] = { '$in': this.votersService.voterForm.value[fields[i]] };
					break;
				case this.votersService.cacheService.voterFieldTypes.CALENDAR:
					if (this.votersService.voterForm.value[fields[i]][0] === this.votersService.voterForm.value[fields[i]][1]
							|| this.votersService.voterForm.value[fields[i]][1] === null)
						queryObj[fields[i]] = this.votersService.voterForm.value[fields[i]][0].toISOString();
					else
						queryObj[fields[i]] = {
							'$gte': this.votersService.voterForm.value[fields[i]][0].toISOString(),
							'$lt': this.votersService.voterForm.value[fields[i]][1].toISOString()
						};
					break;
				default:
					queryObj[fields[i]] = this.votersService.voterForm.value[fields[i]];
				}
			}
		}
		queryObj = { 'query': queryObj };
		queryObj['first'] = evt.first?evt.first:0;
		queryObj['rows'] = evt.rows?evt.rows:25;
		console.log(queryObj);
		this.votersService.voterForm.disable();
		this.votersService.queryObj = null;
		setTimeout(() => this.votersService.queryObj = queryObj);
	}
}
