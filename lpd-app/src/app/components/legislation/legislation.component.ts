import { Component, OnInit, ViewChild, Injector } from '@angular/core';
import { formatDate } from '@angular/common';

import { TableModule } from 'primeng/table';

import { UserService } from '../../services/user.service';
import { LegislativeService } from '../../services/legislative.service';

import { SyncStatus } from '../../objects/sync-status';
import { LegislativeQuery } from '../../objects/legislative-query';
import { Legislation } from '../../objects/legislative-response';

@Component({
	selector: 'app-legislation',
	templateUrl: './legislation.component.html',
	styleUrls: ['./legislation.component.css']
})
export class LegislationComponent implements OnInit {
	@ViewChild('legislationList') table: TableModule;

	userService: UserService;

	isLoading: boolean = true;

	syncStatus: SyncStatus;

	gaSession: number = Math.ceil((new Date().getFullYear()) / 2) - 860;
	loadedGaSession: number = this.gaSession;
	minGaSession: number = 136;
	maxGaSession: number = this.gaSession;
	gaFocused: boolean = false;
	query: LegislativeQuery = { 'query': '', 'first': 0, 'gaSession': this.gaSession };

	legislation: Legislation[];
	billCount: number;
	selectedBill: Legislation = null;
	substituteShown: boolean = false;

	constructor(
			private injector: Injector,
			private legislativeService: LegislativeService) {
		this.userService = this.injector.get(UserService);
	}

	ngOnInit(): void {
		this.checkSync();
	}

	checkSync(hover: boolean = false): void {
		this.legislativeService.checkSync(this.gaSession).subscribe(json => {
			if ((!this.syncStatus || this.syncStatus.status === 'SYNC') && json.status === 'DONE')
				this.isLoading = true;
			if (this.syncStatus)
				clearTimeout(this.syncStatus.checkInterval);
			this.syncStatus = json;
			if (json.status === 'DONE' || json.status === 'NONE') {
				this.syncStatus.checkInterval = setTimeout(this.checkSync.bind(this), 10*60000);
			} else if (!hover) {
				this.syncStatus.checkInterval = setTimeout(this.checkSync.bind(this), 10000);
			} else {
				this.syncStatus.checkInterval = setTimeout(this.checkSync.bind(this, true), 100);
			}
		});
	}

	doSync(): void {
		this.legislativeService.doSync(this.gaSession).subscribe(json => {
			clearTimeout(this.syncStatus.checkInterval);
			this.syncStatus = json;
			this.syncStatus.checkInterval = setTimeout(this.checkSync.bind(this), 10000);
		});
	}

	showSyncStatus(active: boolean = false): string | boolean {
		if (!this.syncStatus) return false;
		if (active) return (this.syncStatus.status === 'SYNC' || Number.isInteger(Number.parseInt(this.syncStatus.status)));
		if (this.showSyncStatus(true)) {
			const session = this.syncStatus.status === 'SYNC'?this.loadedGaSession:this.syncStatus.status;
			return `Sync of Session ${session} in progress...\n${this.syncStatus.syncTime}ms elapsed.`;
		} else if (this.syncStatus.status === 'NONE') {
			return `No sync recorded!`;
		} else if (this.syncStatus.status === 'DONE') {
			let dateString: string = formatDate(this.syncStatus.lastSync, 'M/d/yyyy', 'en-US');
			let timeString: string = formatDate(this.syncStatus.lastSync, 'h:mm:ssaa', 'en-US');
			return `Last sync completed on:\n${dateString} at ${timeString}`;
		}
	}

	syncIcon(): string {
		if (this.syncStatus && this.syncStatus.status === 'SYNC') return 'pi pi-spin pi-refresh';
		else if (!this.syncStatus || Number.isNaN(Number.parseInt(this.syncStatus.status))) return 'pi pi-refresh';
		else return 'pi pi-times';
	}

	lazyLoadLegis(evt: any): void {
		this.query = {
			'first': evt.first,
			'rows': evt.rows,
			'query': this.query.query,
			'gaSession': this.gaSession
		};
		this.isLoading = true;
		this.legislativeService.getLegislation(this.query).subscribe(json => {
			console.log(json);
			this.isLoading = false;
			this.legislation = json.results;
			this.billCount = json.count;
		});
	}

	gaSearch(update: number = 0, evt: KeyboardEvent = null): void {
		if (update !== 0) {
			if (typeof this.gaSession === 'string') {
				this.gaSession = Number.parseInt(this.gaSession);
			}
			this.gaSession += update;
			this.gaFocused = false;
			this.loadedGaSession = this.gaSession;
			this.updateQuery();
			this.checkSync();
		} else if (evt.code === 'Enter') {
			if (typeof this.gaSession === 'string') {
				this.gaSession = Number.parseInt(this.gaSession);
			}
			if (this.gaSession > this.maxGaSession) {
				this.gaSession = this.maxGaSession;
			}
			if (this.gaSession < this.minGaSession) {
				this.gaSession = this.minGaSession;
			}
			this.loadedGaSession = this.gaSession;
			(evt.target as HTMLInputElement).select();
			this.updateQuery();
			this.checkSync();
		}
	}

	updateQuery(newQuery: string = undefined): void {
		if (newQuery || newQuery === '') this.query.query = newQuery;
		this.query.first = 0;
		this.query.gaSession = this.gaSession;
		this.isLoading = true;
		this.legislativeService.getLegislation(this.query).subscribe(json => {
			this.isLoading = false;
			this.legislation = json.results;
			this.billCount = json.count;
		});
	}

	showLegislation(evt: any): void {
		this.substituteShown = false;
	}

	showSubstitute(evt: any, show: boolean): void {
		this.substituteShown = show;
	}

	showAmendment(evt: any): void {}
}
