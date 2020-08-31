import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { MenuModule } from 'primeng/menu';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { PanelModule } from 'primeng/panel';
import { SidebarModule } from 'primeng/sidebar';
import { AccordionModule } from 'primeng/accordion';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { CheckboxModule } from 'primeng/checkbox';
import { MultiSelectModule } from 'primeng/multiselect';
import { DropdownModule } from 'primeng/dropdown';
import { EditorModule } from 'primeng/editor';
import { CalendarModule } from 'primeng/calendar';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { RatingModule } from 'primeng/rating';

import { ConfirmationService } from 'primeng/api';

import { AppRoutingModule } from './app-routing.module';

import { AppComponent } from './components/app/app.component';
import { PasswordComponent } from './components/password/password.component';
import { VotersComponent } from './components/voters/voters.component';
import { LoginComponent } from './components/login/login.component';
import { CallSheetComponent } from './components/call-sheet/call-sheet.component';
import { VoterSearchBarComponent } from './components/voters/voter-search-bar/voter-search-bar.component';
import { VoterSearchFormComponent } from './components/voters/voter-search-form/voter-search-form.component';
import { VoterListingComponent } from './components/voters/voter-listing/voter-listing.component';
import { LegislationComponent } from './components/legislation/legislation.component';
import { BillViewComponent } from './components/legislation/bill-view/bill-view.component';
import { AmendmentsViewComponent } from './components/legislation/amendments-view/amendments-view.component';

@NgModule({
	declarations: [
		AppComponent,
		PasswordComponent,
		VotersComponent,
		LoginComponent,
		CallSheetComponent,
		VoterSearchBarComponent,
		VoterSearchFormComponent,
		VoterListingComponent,
		LegislationComponent,
		BillViewComponent,
		AmendmentsViewComponent
	],
	imports: [
		BrowserModule,
		BrowserAnimationsModule,
		AppRoutingModule,
		HttpClientModule,
		FormsModule,
		ReactiveFormsModule,
		MenuModule,
		AccordionModule,
		TabViewModule,
		DialogModule,
		ConfirmDialogModule,
		TableModule,
		CheckboxModule,
		MultiSelectModule,
		DropdownModule,
		EditorModule,
		CalendarModule,
		ButtonModule,
		TooltipModule,
		PanelModule,
		OverlayPanelModule,
		SidebarModule,
		RatingModule
	],
	providers: [ ConfirmationService ],
	bootstrap: [ AppComponent ]
})
export class AppModule {}