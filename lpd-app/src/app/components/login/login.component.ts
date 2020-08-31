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
		this.userService.getAllUsers().subscribe(json => {
			this.usersList = json;
			this.displayUserManagement = true;
		});
	}

	openUser(evt: any): void {
		var user = this.usersList[evt.index];
		this.aorUser = evt.index;
		var permissions = this.userService.cacheService.permissions;
		this.permissions = [];
		if (user.permissions === 0) this.permissions.push(0);
		(<any[]> Object.values(permissions)).forEach(permission => {
			if ((user.permissions & Number(permission.mask)) ||
					(user.permissions & Number(permissions['SYSADMIN'].mask)))
				this.permissions.push(Number(permission.mask));
		});
		if (this.permissions.includes(0) && this.permissions.length > 1)
			this.permissions = this.permissions.filter(permission => permission !== 0);
	}

	sortPerms(a: any, b: any): number {
		return a.mask-b.mask;
	}

	disableUser(user: any): boolean {
		if (user.username === this.userService.userProfile.username) return true;
		if (!this.isSysAdmin(user.permissions)) return false;
		if (this.isSysAdmin(this.userService.userProfile.permissions)) return false;
		return true;
	}

	isSysAdmin(userPermission: number): boolean {
		var permissions = this.userService.cacheService.permissions;
		return !!(userPermission & permissions['SYSADMIN'].mask);
	}

	disableCheckbox(index: string): boolean {
		if (!this.userService.checkPermission('SYSADMIN') && index === 'SYSADMIN') return true;
		else return false;
	}

	changePermission(username: string, mask: number): void {
		var finalPermission = 0;
		var permissions = this.userService.cacheService.permissions;
		// clear permissions when setting NOOP
		if ((mask === permissions['NOOP'].mask) && this.permissions.includes(0)) this.permissions = [0];
		// set NOOP if permissions are cleared
		if ((mask !== permissions['NOOP'].mask) && !this.permissions.length) this.permissions = [0];
		// remove NOOP when setting other permissions
		if ((mask !== permissions['NOOP'].mask) && this.permissions.includes(mask))
			this.permissions = this.permissions.filter(permission => permission !== 0);
		// add all permissions but NOOP when setting SYSADMIN
		if ((mask === permissions['SYSADMIN'].mask) && this.permissions.includes(1))
			this.permissions = (<any[]> Object.values(permissions))
				.filter(permission => permission.mask !== 0)
				.map(permission => permission.mask);
		// if unsetting a permissions other than NOOP, remove SYSADMIN
		if ((mask !== permissions['NOOP'].mask && !this.permissions.includes(mask)))
			this.permissions = this.permissions.filter(permission => permission !== 1);
		// can't clear NOOP except by setting another permission
		if (mask === permissions['NOOP'].mask && !this.permissions.length) this.permissions = [0];
		this.permissions.forEach(permission => finalPermission |= permission);
		this.isPermissionsLoading = true;
		this.userService.setPermissions(username, finalPermission).subscribe(json => {
			if (json !== 200) console.log(json);
			else console.log(`Permissions for ${username} updated`);
			this.userService.getAllUsers().subscribe(json => {
				this.usersList[this.aorUser].permissions = json.filter(user => user.username === username)[0].permissions;
				this.isPermissionsLoading = false;
			});
		});
	}

	setAor(username: string, permission: number): void {
		this.displayUserManagement = false;
		this.aorPermissionMask = permission;
		this.aorValuesLoading++;
		Object.keys(this.userService.cacheService.permissions).forEach(key => {
			if (this.userService.cacheService.permissions[key].mask === permission) this.aorPermission = key;
		});
		this.userService.loadUserAor(username, this.aorPermissionMask).subscribe(json => {
			if (!json.aorValues) json.aorValues = {};
			this.aorSelection = json.aorValues;
		});
		this.votersService.cacheService.getVoterFields().subscribe(json => {
			let aorFields = (<any[]>json).filter(field => typeof field.aor !== 'undefined');
			let dbFields = {};
			aorFields.forEach(field => {
				let label = field.aor.split('/');
				let dependencyLabels = {};
				if (label.length > 2) {
					let depLabel = aorFields.filter(field => field.field === label[1].trim())[0].aor.split('/').pop();
					dependencyLabels[label[1]] = label[1][0] === ' '?'':depLabel;
				}
				if (typeof dbFields[field.aor] === 'undefined')
					dbFields[field.aor] = {
						'sortOrder': Number(label[0])+(label.length > 2?0.1:0),
						'dbFields': [ field.field ],
						'dependencies': label.length > 2?[ label[1].trim() ]:[],
						'aorLabel': ((label.length > 2?`${dependencyLabels[label[1]]} `:'') + label[label.length-1]).trim()
					}
				else
					dbFields[field.aor].dbFields.push(field.field);
			});
			this.aorFields = Object.keys(dbFields)
					.sort((a, b) => dbFields[a].sortOrder - dbFields[b].sortOrder)
					.map(key => {
						this.getValues(dbFields[key]);
						return dbFields[key]
					});
			this.displayAorSelection = true;
		});
	}

	hideAor(): void {
		this.displayUserManagement = true;
		this.openUser({ 'index': this.aorUser });
	}

	getValues(field: any): void {
		this.aorValuesLoading++;
		this.aorValues[field.aorLabel] = [];
		if (!field.dependencies.length) {
			let calls = 0;
			field.dbFields.forEach(dbField => {
				calls++;
				this.votersService.cacheService.getFieldValues(dbField).subscribe(json => {
					let mergeValues = this.votersService.cacheService.voterFieldValues[dbField].map(value => {
						return {
							'label': value.label,
							'value': `${dbField}:${value.value}`
						};
					});
					this.aorValues[field.aorLabel] = this.aorValues[field.aorLabel].concat(mergeValues);
					if (!--calls) this.aorValuesLoading--;
				});
			});
		} else {
			let calls = 0;
			field.dependencies.forEach(dependency => {
				this.votersService.cacheService.getFieldValues(dependency).subscribe(json => {
					let query = {};
					this.votersService.cacheService.voterFieldValues[dependency].forEach(dependencyValue => {
						query[dependency] = dependencyValue.value;
						field.dbFields.forEach(dbField => {
							calls++;
							this.votersService.cacheService.getFieldValues(dbField, query).subscribe(json => {
								calls--;
								let dependentValues = this.votersService.cacheService.voterFieldValues[dbField]
										.map(item => { 
											return {
												'label': dependencyValue.label+' - '+item.label,
												'value': `${dependency}:${dependencyValue.value}/${dbField}:${item.value}`
											}
										});
								this.aorValues[field.aorLabel] = this.aorValues[field.aorLabel].concat(dependentValues);
								this.sortValues(field.aorLabel, calls);
							});
						});
					});
				});
			});
		}
	}

	sortValues(label: string, calls: number): void {
		if (calls !== 0) return;
		this.aorValues[label] = this.aorValues[label].sort((a, b) => {
			let aParts = a.label.split(' ');
			let bParts = b.label.split(' ');
			if (!isNaN(aParts[0]) && !isNaN(bParts[0])) {
				let sortValue = (Number(a.label.split(' ')[0]) - Number(b.label.split(' ')[0]));
				if (sortValue) return sortValue;
				if (!isNaN(aParts[2]) && !isNaN(bParts[2])) return Number(aParts[2]) - Number(bParts[2]);
				else return aParts[2].localeCompare(bParts[2]);
			}
			else {
				let sortValue = aParts[0].localeCompare(bParts[0]);
				if (sortValue) return sortValue;
				if (!isNaN(aParts[2]) && !isNaN(bParts[2])) return Number(aParts[2]) - Number(bParts[2]);
				else return aParts[2].localeCompare(bParts[2]);
			}
		});
		if (--this.aorValuesLoading === 1) this.aorValuesLoading--;
	}

	changeAor(): void {
		this.userService.updateAor(
				this.usersList[this.aorUser].username,
				this.aorPermissionMask,
				this.aorSelection).subscribe();
	}
}
