import { Component, OnInit, Input, Host } from "@angular/core";
import { HttpClient } from '@angular/common/http';

import { SelectItem, ConfirmationService } from 'primeng/api';

import { CONSTANTS } from '../../services/constants.const';

import { UserService } from 'src/app/services/user.service';
import { CryptoService } from 'src/app/services/crypto.service';
import { LegislativeService } from 'src/app/services/legislative.service';

@Component({
    'selector': 'legislation-bill-view',
    'templateUrl': './bill-view.component.html',
    'styleUrls': ['./bill-view.component.css']
})
export class BillViewComponent implements OnInit {
    @Input('bill') bill;

    userService: UserService;
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
            private http: HttpClient,
            private confirmationService: ConfirmationService,
            private _userService: UserService,
            private legislativeService: LegislativeService,
            private crypto: CryptoService) {
        this.userService = this._userService;
    }
    
    ngOnInit(): void {
        this.refreshRatings();
        this.refreshComments();
    }

    getFullTextLink(bill) {
        let link = 'http://legis.delaware.gov/json/BillDetail/GenerateHtmlDocument?docTypeId=2&legislationId=';
        let type = '&legislationTypeId=';
        return `${link+bill.LegislationId+type+bill.LegislationTypeId}`;
    }

    getCommitteeInfo(committeeId) {
        console.log(committeeId);
        this.isLoading = true;
        this.http.get(`${CONSTANTS.APIURL}/legis/getCommitteeDetails/${committeeId}`).subscribe(json => {
            console.log(json);
            this.isLoading = false;
            this.committeeInfo = json;
        });
    }

    saveRollCall(report) {
        console.log(report);
        this.rollCallVote = Array.from(report.Model.AssemblyMemberVotes);
    }

    showLegislator(legislator, dialog = null) {
        if (dialog) dialog.visibleChange.isStopped = true;
        document.body.style.cursor = 'wait';
        this.isLoading = true;
        if (typeof legislator === 'string') {
            this.http.get(`${CONSTANTS.APIURL}/legis/getLegislatorInfo/${legislator}`).subscribe(json => {
                this.legislativeService.getImage(json['PersonId']).then(img => {
                    this.legislatorInfo = json;
                    this.isLoading = false;
                    if (dialog) dialog.visibleChange.isStopped = false;
                    document.body.style.cursor = 'auto';
                });
            });
        } else {
            this.legislativeService.getImage(legislator.PersonId).then(img => {
                this.legislatorInfo = legislator;
                this.isLoading = false;
                if (dialog) dialog.visibleChange.isStopped = false;
                document.body.style.cursor = 'auto';
            });
        }
    }

    refreshRatings() {
        let ratingsUrl = `${CONSTANTS.APIURL}/legis/getRatings/${this.bill.LegislationId}/${this.selectedCommentFilter}`;
        this.http.get(ratingsUrl).subscribe(json => {
            console.log(json);
            this.ratingCount = json['count'];
            this.setRating(json['avgRating']);
        });
    }

    getMyRating() {
        let loggedIn: boolean = <boolean>this.userService.checkPermission('LEG');
        if (this.myRatingSet && loggedIn) return true;
        if (!this.myRatingSet && !loggedIn) return false;
        if (this.myRatingSet && !loggedIn) return this.myRatingSet = false;
        if (!this.myRatingSet && loggedIn) this.refreshComments();
        this.myRatingSet = true;
        let ratingsUrl = `${CONSTANTS.APIURL}/legis/getRatings/${this.bill.LegislationId}/4`;
        this.http.get(ratingsUrl, { 'withCredentials': true }).subscribe(json => {
            console.log(json['avgRating']);
            if (json['avgRating'] >= 0) this.rateBill(0, { 'value':json['avgRating'] });
            else this.rateBill(<number>json['avgRating']-1, { 'value': 1 });
        });
        return true;
    }

    refreshComments() {
        let commentsUrl = `${CONSTANTS.APIURL}/legis/getComments/${this.bill.LegislationId}/${this.selectedCommentFilter}`;
        this.http.get(commentsUrl, { 'withCredentials': true }).subscribe(json => {
            console.log(json);
            this.showComments[this.bill.LegislationId] = json['comments'];
        });
    }

    rateBill(rating, evt) {
        console.log(rating, evt, rating+evt.value);
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

        let query = {
            'legislationId': this.bill.LegislationId,
            'rating': rating+evt.value || 0
        };
        this.crypto.encryptedPost(`${CONSTANTS.APIURL}/legis/saveRating`, query).subscribe(json => {
            console.log(json);
            this.refreshRatings();
        });
    }

    setRating(rating) {
        console.log(rating);
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

    saveComment(legislationId) {
        console.log(legislationId);
        console.log(this.comments[legislationId]);
        let query = {
            'legislationId': legislationId,
            'comment': this.comments[legislationId]
        }
        this.crypto.encryptedPost(`${CONSTANTS.APIURL}/legis/saveComment`, query).subscribe(json => {
            console.log(json);
            this.comments[legislationId] = '';
            this.refreshComments();
        });
    }

    canDeleteComment(comment) {
        if (this.userService.checkPermission('SYSADMIN')) return true;
        if (!this.userService.checkPermission('LEG')) return false;
        return comment.mine;
    }

    confirmDelete(comment) {
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

    deleteComment(comment) {
        console.log(comment);
        this.crypto.encryptedPost(`${CONSTANTS.APIURL}/legis/deleteComment`, comment).subscribe(json => {
            console.log(json);
            this.refreshComments();
        });
    }

    getMailLink(address) {
        return `mailto:${address}`;
    }

    getCacheLink(personId) {
        if (!personId) return false;
        return `${CONSTANTS.APIURL}/legis/cacheLegislatorImage/${personId}`;
    }

    getLinkClass() {
        return this.isLoading?'gettingRecord':'getRecord';
    }

    closeDialog(evt, property) {
        if (!this.isLoading && evt.target.id !== 'mailLink' &&
                evt.target.className !== 'getRecord' && 
                evt.target.className !== 'gettingRecord')
            this[property] = property === 'rollCallVote'?[]:undefined;
    }
}