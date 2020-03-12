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

import { AppComponent } from './app.component';
import { PasswordComponent } from './password/password.component';
import { MainComponent } from './main/main.component';
import { LoginComponent } from './login/login.component';
import { CallSheetComponent } from './call-sheet/call-sheet.component';
import { VoterSearchBarComponent } from './voter-search-bar/voter-search-bar.component';
import { VoterSearchFormComponent } from './voter-search-form/voter-search-form.component';
import { VoterListingComponent } from './voter-listing/voter-listing.component';
import { LegislationComponent } from './legislation/legislation.component';
import { BillViewComponent } from './legislation/bill-view/bill-view.component';
import { AmendmentsViewComponent } from './legislation/amendments-view/amendments-view.component';

@NgModule({
	declarations: [
		AppComponent,
		PasswordComponent,
		MainComponent,
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