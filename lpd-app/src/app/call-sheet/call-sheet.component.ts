import { Component, OnInit } from '@angular/core';

import { VotersService } from '../services/voters.service';
import { UserService } from '../services/user.service';

@Component({
	selector: 'app-call-sheet',
	templateUrl: './call-sheet.component.html',
	styleUrls: ['./call-sheet.component.css']
})
export class CallSheetComponent implements OnInit {
	votersService: VotersService;
	callLinkTemplate: string = 'https://hangouts.google.com/?action=chat&authuser=1&pn=';
	showCallSheet: boolean = false;
	callList: any[] = [];

	constructor(
			private userService: UserService,
			private _votersService: VotersService) {
		this.votersService = this._votersService;
	}

	ngOnInit() {}

	generateCallSheet() {
		this.callList = this.votersService.voterData['results'].map(voter => {
			if (voter['PHONE']) {
				return {
					'name': `${voter['FIRST-NAME']} ${voter['LAST-NAME']}`,
					'phone': voter['PHONE'],
					'id': voter['VOTER ID']
				};
			} else {
				return false;
			}
		}).filter(voter => { return voter; }).sort((x, y) => { return x.phone < y.phone?-1:1; });
		this.userService.getCallSheetLink().subscribe(json => {
			this.callLinkTemplate = json['callSheetTemplate'];
			this.showCallSheet = true;
		});
	}

	updateCallSheetLink(newLink) {
		this.userService.setCallSheetLink(newLink).subscribe(() => {});
	}
}
