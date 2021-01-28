import { Component, OnInit, Input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

import { SelectItem, ConfirmationService } from 'primeng/api';

import { CONSTANTS } from '../../../services/constants.const';

import { UserService } from 'src/app/services/user.service';
import { LegislativeService } from 'src/app/services/legislative.service';

@Component({
    'selector': 'legislation-bill-view',
    'templateUrl': './bill-view.component.html',
    'styleUrls': ['./bill-view.component.css']
})
export class BillViewComponent implements OnInit {
    @Input('bill') bill: any;

    userService: UserService;
    sanitizer: DomSanitizer;

    isLoading: boolean = false;

    rollCallVote = [];

    committeeInfo: any;

    legislatorInfo: any;
    legislatorImage: any;

    negative1Rating: number;
    negative2Rating: number;
    negative3Rating: number;
    positiveRating: number;
    myRatingSet: boolean = false;

    comments: any = {};

    showNegative1Rating: number;
    showNegative2Rating: number;
    showNegative3Rating: number;
    showPositiveRating: number;
    totalRating: number;
    ratingCount: number;
    ratingsMap: {[k: string]: string} = { '=0': 'no ratings', '=1': '1 rating', 'other': '# ratings' };

    showComments: any = {};

    selectedCommentFilter: number = 0;
    commentFilterOptions: SelectItem[] = [
        { 'label': 'All Users', 'value': 0 },
        { 'label': 'Verified Users', 'value': 1 },
        { 'label': 'Verified Libertarian Users', 'value': 2 },
    ];

    constructor(
            private confirmationService: ConfirmationService,
            private _userService: UserService,
            private legislativeService: LegislativeService,
            private _sanitizer: DomSanitizer) {
        this.userService = this._userService;
        this.sanitizer = _sanitizer;
    }
    
    ngOnInit(): void {
        this.refreshRatings();
        this.refreshComments();
    }

    getCommitteeInfo(committeeId: number): void {
        this.isLoading = true;
        this.legislativeService.getCommitteeDetails(committeeId).subscribe(json => {
            this.isLoading = false;
            this.committeeInfo = json;
        });
    }

    saveRollCall(report: any): void {
        this.rollCallVote = Array.from(report.Model.AssemblyMemberVotes);
    }

    showLegislator(legislator: any, dialog: any = null): void {
        if (dialog) dialog.visibleChange.isStopped = true;
        document.body.style.cursor = 'wait';
        this.isLoading = true;
        if (typeof legislator === 'string') {
            this.legislativeService.getLegislatorInfo(legislator).subscribe(json => {
                this.loadImage(json, dialog);
            });
        } else {
            this.loadImage(legislator, dialog)
        }
    }

    loadImage(legislator: any, dialog: any = null): void {
        this.legislativeService.getImage(legislator.PersonId).subscribe(img => {
            if (dialog) dialog.visibleChange.isStopped = false;
            document.body.style.cursor = 'auto';
            this.legislativeService.legislatorImages[legislator.PersonId] = img;
            this.legislatorInfo = legislator;
            this.isLoading = false;
        });
    }

    refreshRatings(): void {
        this.legislativeService.getRatings(this.bill.LegislationId, this.selectedCommentFilter).subscribe(json => {
            this.ratingCount = json['count'];
            this.setRating(json['avgRating']);
        });
    }

    getMyRating(): boolean {
        let loggedIn: boolean = <boolean>this.userService.checkPermission('LEG');
        if (this.myRatingSet && loggedIn) return true;
        if (!this.myRatingSet && !loggedIn) return false;
        if (this.myRatingSet && !loggedIn) return this.myRatingSet = false;
        if (!this.myRatingSet && loggedIn) this.refreshComments();
        this.myRatingSet = true;
        this.legislativeService.getRatings(this.bill.LegislationId, 4).subscribe(json => {
            if (json['avgRating'] >= 0) this.rateBill(0, { 'value':json['avgRating'] }, false);
            else this.rateBill(<number>json['avgRating']-1, { 'value': 1 }, false);
        });
        return true;
    }

    rateBill(rating: number, evt: any, send: boolean = true): void {
        if (rating === -4) {
            this.negative1Rating = this.negative2Rating = this.negative3Rating = 1;
            this.positiveRating = 0;
        } else if (rating === -3) {
            this.negative3Rating = this.positiveRating = 0;
            this.negative1Rating = this.negative2Rating = 1
        } else if (rating === -2) {
            this.negative2Rating = this.negative3Rating = this.positiveRating = 0;
            this.negative1Rating = 1;
        } else {
            this.negative1Rating = this.negative2Rating = this.negative3Rating = 0;
            this.positiveRating = evt.value;
        }

        if (!send) return;
        let query = {
            'legislationId': this.bill.LegislationId,
            'rating': rating+evt.value || 0
        };
        this.legislativeService.saveRating(this.bill.LegislationId, rating+evt.value).subscribe(json => {
            this.refreshRatings();
        });
    }

    setRating(rating: number): void {
        this.totalRating = rating;
        if (rating < 0) rating = Math.floor(rating);
        else rating = Math.ceil(rating);
        if (rating === -3) {
            this.showNegative1Rating = this.showNegative2Rating = this.showNegative3Rating = 1;
            this.showPositiveRating = 0;
        } else if (rating === -2) {
            this.showNegative3Rating = this.showPositiveRating = 0;
            this.showNegative1Rating = this.showNegative2Rating = 1;
        } else if (rating === -1) {
            this.showNegative2Rating = this.showNegative3Rating = this.showPositiveRating = 0;
            this.showNegative1Rating = 1;
        } else {
            this.showNegative3Rating = this.showNegative2Rating = this.showNegative1Rating = 0;
            this.showPositiveRating = rating;
        }
    }

    refreshComments(): void {
        this.legislativeService.getComments(this.bill.LegislationId, this.selectedCommentFilter).subscribe(json => {
            this.showComments[this.bill.LegislationId] = json['comments'];
        });
    }

    saveComment(legislationId: number): void {
        let query = {
            'legislationId': legislationId,
            'comment': this.comments[legislationId]
        }
        this.legislativeService.saveComment(query).subscribe(json => {
            this.comments[legislationId] = '';
            this.refreshComments();
        });
    }

    canDeleteComment(comment: any): boolean {
        if (this.userService.checkPermission('SYSADMIN')) return true;
        if (!this.userService.checkPermission('LEG')) return false;
        return comment.mine;
    }

    confirmDelete(comment: any): void {
        const deleteConfirmationContent =   `<div class="delete-confirm">
                                                Are you sure you want to delete this comment?
                                                <br/><br/>
                                                <strong>NOTE:</strong> This will not clear your rating.
                                            </div>`;
        this.confirmationService.confirm({
            'key': 'deleteCommentConfirmation',
            'message': deleteConfirmationContent,
            'header': 'Confirm Comment Deletion',
            'acceptLabel': 'Delete',
            'rejectLabel': 'Cancel',
            'icon': 'pi pi-trash big-icon',
            'accept': this.deleteComment.bind(this, comment)
        });
    }

    deleteComment(comment: any): void {
        this.legislativeService.deleteComment(comment).subscribe(this.refreshComments.bind(this));
    }

    getFullTextLink(bill: any): string {
        let link = 'http://legis.delaware.gov/json/BillDetail/GenerateHtmlDocument?docTypeId=2&legislationId=';
        let type = '&legislationTypeId=';
        return `${link+bill.LegislationId+type+bill.LegislationTypeId}`;
    }

    getMailLink(address: string): string {
        return `mailto:${address}`;
    }

    getCacheLink(personId: number): any {
        return this.sanitizer.bypassSecurityTrustResourceUrl(this.legislativeService.legislatorImages[personId]);
    }

    getLinkClass(): string {
        return this.isLoading?'gettingRecord':'getRecord';
    }

    closeDialog(evt: any, property: string): void {
        if (!this.isLoading && evt.target.id !== 'mailLink' &&
                evt.target.className !== 'getRecord' && 
                evt.target.className !== 'gettingRecord')
            this[property] = property === 'rollCallVote'?[]:undefined;
    }
}