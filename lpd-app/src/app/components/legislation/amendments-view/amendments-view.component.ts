import { Component, OnInit, Input } from "@angular/core";

@Component({
    'selector': 'legislation-amendments-view',
    'templateUrl': './amendments-view.component.html',
    'styleUrls': ['./amendments-view.component.css']
})
export class AmendmentsViewComponent implements OnInit {
    @Input('amendments') amendments: any[];

    constructor() {}
    ngOnInit() {}
}