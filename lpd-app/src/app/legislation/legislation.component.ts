import { Component, OnInit, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { CONSTANTS } from '../services/constants.const';
import { UserService } from '../services/user.service';
import { TableModule } from 'primeng/table';
import { formatDate } from '@angular/common';

@Component({
	selector: 'app-legislation',
	templateUrl: './legislation.component.html',
	styleUrls: ['./legislation.component.css']
})
export class LegislationComponent implements OnInit {
	@ViewChild('legislationList') table: TableModule;

	userService: UserService;

	isLoading: boolean = true;
	syncStatus;
	preloadedImages = [];
	legislation: any[];
	billCount: number;
	selectedBill: any = {};
	substituteShown: boolean = false;
	query: any = { 'query': '', 'first': 0 };

	constructor(
			private http: HttpClient,
			private _userService: UserService) {
		this.userService = this._userService;
	}

	ngOnInit(): void {
		this.checkSync();
	}

	checkSync(hover: boolean = false) {
		this.http.get(`${CONSTANTS.APIURL}/legis/checkSync`, { 'withCredentials': true }).subscribe(json => {
			if ((!this.syncStatus || this.syncStatus['status'] === 'SYNC') && json['status'] === 'DONE')
				this.isLoading = true;
			if (this.syncStatus)
				clearTimeout(this.syncStatus['checkInterval']);
			this.syncStatus = json;
			if (json['status'] === 'DONE' || json['status'] === 'NONE') {
				this.syncStatus['checkInterval'] = setTimeout(this.checkSync.bind(this), 10*60000);
			} else if (!hover) {
				this.syncStatus['checkInterval'] = setTimeout(this.checkSync.bind(this), 10000);
			} else {
				this.syncStatus['checkInterval'] = setTimeout(this.checkSync.bind(this, true), 100);
			}
		});
	}

	syncIcon() {
		if (this.showSyncStatus(true)) return 'pi pi-spin pi-refresh';
		else return 'pi pi-refresh';
	}

	doSync() {
		this.http.get(`${CONSTANTS.APIURL}/legis/startLegSync`, { 'withCredentials': true }).subscribe(json => {
			console.log(json);
			clearTimeout(this.syncStatus['checkInterval']);
			this.syncStatus = json;
			this.syncStatus['checkInterval'] = setTimeout(this.checkSync.bind(this), 10000);
		});
	}

	showSyncStatus(active: boolean = false) {
		if (!this.syncStatus) return false;
		if (active) return this.syncStatus['status'] === 'SYNC';
		if (this.showSyncStatus(true)) {
			return `Sync in progress...\n${this.syncStatus['syncTime']}ms elapsed.`;
		} else if (this.syncStatus['status'] === 'NONE') {
			return `No sync recorded!`;
		} else {
			let dateString: string = formatDate(this.syncStatus['lastSync'], 'M/d/yyyy', 'en-US');
			let timeString: string = formatDate(this.syncStatus['lastSync'], 'h:mm:ssaa', 'en-US');
			return `Last sync completed on:\n${dateString} at ${timeString}`;
		}
	}

	lazyLoadLegis(evt) {
		this.query = {
			'first': evt.first,
			'rows': evt.rows,
			'query': this.query.query
		};
		this.isLoading = true;
		this.http.post(`${CONSTANTS.APIURL}/legis/getLegislation`, this.query).subscribe(json => {
			console.log(json);
			this.isLoading = false;
			this.legislation = json['results'];
			this.billCount = json['count'];
		});
	}

	updateQuery(newQuery: string = undefined) {
		if (newQuery || newQuery === '') this.query.query = newQuery;
		this.query.first = 0;
		this.isLoading = true;
		this.http.post(`${CONSTANTS.APIURL}/legis/getLegislation`, this.query).subscribe(json => {
			console.log(json);
			this.isLoading = false;
			this.legislation = json['results'];
			this.billCount = json['count'];
		});
	}

	showLegislation(evt) {
		console.log(evt.data);
		this.substituteShown = false;
	}

	showSubstitute(evt, show) {
		this.substituteShown = show;
	}

	showAmendment(evt) {
		console.log(evt.data);
	}
}
