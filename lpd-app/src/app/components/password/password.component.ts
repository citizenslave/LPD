import { Component, OnInit, Injector } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';

import { UserService } from '../../services/user.service';

@Component({
	selector: 'app-password',
	templateUrl: './password.component.html',
	styleUrls: ['./password.component.css']
})
export class PasswordComponent implements OnInit {
	numeric = new RegExp(/\d/);
	alpha = new RegExp(/[a-z]/i);

	passwordForm: FormGroup;
	token: string;
	error: string;

	userService: UserService;

	constructor(
			private injector: Injector,
			private route:ActivatedRoute,
			private router: Router,
			private fb:FormBuilder) {
		this.userService = this.injector.get(UserService);
		this.passwordForm = this.fb.group({
			'password': this.fb.control({ 'value': '', 'disabled': false }, [ Validators.required ]),
			'confirm': this.fb.control({ 'value': '', 'disabled': false }, [ Validators.required ])
		}, { 'validators': [ this.matchPasswords.bind(this), this.passwordComplexity.bind(this) ]});
	}

	ngOnInit(): void {
		this.route.paramMap.subscribe(param => console.log(this.token = param.get('token')));
		this.userService.lookupToken(this.token).subscribe(json => {
			if (json !== 'SUCCESS') this.error = json.toString();
			else console.log(this.userService.userProfile);
		});
	}

	setPassword(evt: any): void {
		evt.stopPropagation();
		if (this.passwordForm.value.password !== this.passwordForm.value.confirm) alert('Passwords do not match');
		else this.userService.setPassword(this.token, this.passwordForm.value.password).subscribe(() => {
			this.router.navigate(['']);
		},
		() => {
			alert('Invalid token');
		});
	}

	matchPasswords(c: AbstractControl): { 'invalid': boolean } {
		if (c.get('password').value !== c.get('confirm').value || !c.get('password').value.length)
			return { 'invalid': true };
		return null;
	}

	passwordComplexity(c: AbstractControl): { 'complexity': boolean } {
		const pwValue = c.get('password').value;
		if (pwValue.length < 4) return { 'complexity': true };
		if (!this.numeric.test(pwValue)) return { 'complexity': true };
		if (!this.alpha.test(pwValue)) return { 'complexity': true };
		return null;
	}

	getValidationState(criteria: number): string {
		const pwValue = this.passwordForm.get('password').value;
		switch (criteria) {
			case 0:
				return (pwValue.length < 4?'red':'inherit');
			case 1:
				return (!this.alpha.test(pwValue)?'red':'inherit');
			case 2:
				return (!this.numeric.test(pwValue)?'red':'inherit');
			case 3:
				return (this.matchPasswords(this.passwordForm)?'red':'inherit');
		}
	}
}