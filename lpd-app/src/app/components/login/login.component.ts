import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef, Injector } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { MenuItem } from 'primeng/api';

import { CacheService } from '../../services/cache.service';
import { UserService } from '../../services/user.service';
import { VotersService } from '../../services/voters.service';

@Component({
	selector: 'app-login',
	templateUrl: './login.component.html',
	styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
	@ViewChild('login') loginPanel: ElementRef;
	@ViewChild('password') passwordInput: ElementRef;

	userService: UserService;

	userMenuItems: MenuItem[];
	loginForm: FormGroup;

	publicKey: boolean;
	register: boolean;
	registered: boolean;
	loggedIn: boolean;

	collapseLogin: boolean = true;
	isLoginLoading: boolean = false;

	errorMessage: string = ' ';
	registrationStatus: string = `Registration complete.  Check your email to set your password.`;

	displayAorSelection: boolean = false;
	aorValuesLoading: number = 0;
	aorPermission: string;
	aorPermissionMask: number;
	aorUser: number;
	aorFields: any[] = [];
	aorValues: any = {};
	aorSelection: any = {};

	logoutMenuItem: MenuItem = {
		'label': 'Logout',
		'icon': 'pi pi-sign-out',
		'command': this.logoutUser.bind(this, new Event('logout'))
	};
	legislationMenuItem: MenuItem = {
		'label': 'Legislation',
		'icon': 'pi pi-briefcase',
		'command': this.showLegislation.bind(this)
	}
	votersMenuItem: MenuItem = {
		'label': 'Voter Database',
		'icon': 'pi pi-id-card',
		'command': this.showVoters.bind(this)
	}
	userMgmtMenuItem: MenuItem = {
		'label': 'User Management',
		'icon': 'pi pi-users',
		'command': this.showUserManagement.bind(this)
	}

	displayUserManagement: boolean = false;
	usersList: any[] = [];
	permissions: number[] = [];
	isPermissionsLoading: boolean = false;

	constructor(
			private injector: Injector,
			private cacheService: CacheService,
			private votersService: VotersService,
			private fb: FormBuilder,
			private cdr: ChangeDetectorRef,
			private router: Router) {
		this.userService = this.injector.get(UserService);
	}

	ngOnInit(): void {
		this.userMenuItems = [ this.logoutMenuItem ];
		this.userService.getSession().subscribe(json => {
			this.loggedIn = json;
			if (!this.loggedIn) return;
			this.votersService.processVoterSearchKeys(this.cacheService.voterFields);
			this.configureMenu();
		});
		this.loginForm = this.fb.group({
			'username': this.fb.control({ 'value': '', 'disabled': false }, [ Validators.required, Validators.email ]),
			'password': this.fb.control({ 'value': '', 'disabled': false }, [ Validators.required ])
		});
	}

	loginUser(evt: any, register: boolean = false): void {
		evt.stopPropagation();
		if (!this.loginForm.get('username').valid) {
			this.errorMessage = 'Please enter a valid email address';
			return;
		} else this.errorMessage = '';
		if (register) {
			this.isLoginLoading = true;
			this.userService.registerUser(this.loginForm.value.username).subscribe(json => {
				this.registered = true;
				this.isLoginLoading = false;
				this.registrationStatus = `Registration/Reset complete.  Check your email to set your password.`;
			},
			err => {
				this.registrationStatus = `Registration/Reset failed.`;
				this.registered = true;
				this.isLoginLoading = false;
			});
		} else if (!this.loginForm.value.password && !this.publicKey) {
			this.isLoginLoading = true;
			this.userService.findUser(this.loginForm.value.username).subscribe(() => {
				this.publicKey = true;
				this.isLoginLoading = false;
				setTimeout(() => this.passwordInput.nativeElement.focus());
			});
		} else if (this.publicKey) {
			if (!this.loginForm.valid) {
				this.errorMessage = 'Password is required';
				return;
			} else this.errorMessage = '';
			this.isLoginLoading = true;
			this.userService.loginUser(this.loginForm.value.username, this.loginForm.value.password).subscribe(() => {
				this.loggedIn = true;
				this.collapseLogin = true;
				this.isLoginLoading = false;
				if (this.loggedIn) this.votersService.processVoterSearchKeys(this.cacheService.voterFields);
				this.configureMenu();
				this.cdr.detectChanges();
			},
			err => {
				this.registered = true;
				this.registrationStatus = err;
				this.isLoginLoading = false;
			});
		} else {
			console.log('Cannot find public key');
		}
	}

	configureMenu(): void {
		this.userMenuItems = [];
		this.userMenuItems.push(this.legislationMenuItem);
		if (this.userService.checkPermission('VOTER_SEARCH')) this.userMenuItems.push(this.votersMenuItem);
		if (this.userService.checkPermission('USRMGMT')) this.userMenuItems.push(this.userMgmtMenuItem);
		this.userMenuItems.push(this.logoutMenuItem);
	}

	logoutUser(evt: any): void {
		evt.stopPropagation();
		this.userService.logoutUser().subscribe(json => {
			this.publicKey = this.loggedIn = this.register = this.registered = this.collapseLogin = false;
			this.loginForm.reset();
			this.votersService.queryObj = null;
			this.votersService.voterData = [];
			this.votersService.searchBar = false;
			this.votersService.voterForm.reset();
		});
	}

	showLegislation(): void {
		this.router.navigate(['/legislation']);
	}

	showVoters(): void {
		this.router.navigate(['/voters']);
	}

	showUserManagement(): void {
		this.router.navigate(['/user-management']);
	}
}
