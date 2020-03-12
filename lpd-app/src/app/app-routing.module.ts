import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { LegislationComponent } from './legislation/legislation.component';
import { MainComponent } from './main/main.component';
import { PasswordComponent } from './password/password.component';

const routes: Routes = [{
	'path': '',
	'pathMatch': 'full',
	'redirectTo': 'legislation'
}, {
	'path': 'legislation',
	'component': LegislationComponent
}, {
	'path': 'voters',
	'component': MainComponent
}, {
	'path': 'password/:token',
	'component': PasswordComponent
}];

@NgModule({
	imports: [RouterModule.forRoot(routes)],
	exports: [RouterModule]
})
export class AppRoutingModule {}