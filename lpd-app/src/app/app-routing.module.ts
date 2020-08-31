import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { LegislationComponent } from './components/legislation/legislation.component';
import { VotersComponent } from './components/voters/voters.component';
import { PasswordComponent } from './components/password/password.component';

const routes: Routes = [{
	'path': '',
	'pathMatch': 'full',
	'redirectTo': 'legislation'
}, {
	'path': 'legislation',
	'component': LegislationComponent
}, {
	'path': 'voters',
	'component': VotersComponent
}, {
	'path': 'password/:token',
	'component': PasswordComponent
}];

@NgModule({
	imports: [RouterModule.forRoot(routes)],
	exports: [RouterModule]
})
export class AppRoutingModule {}