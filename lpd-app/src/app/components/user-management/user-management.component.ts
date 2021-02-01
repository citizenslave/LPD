import { Component, Injector, OnInit } from "@angular/core";
import { Subscription } from "rxjs";
import { CacheService } from "src/app/services/cache.service";

import { UserService } from "src/app/services/user.service";
import { VotersService } from "src/app/services/voters.service";

@Component({
    selector: 'app-user-management',
    templateUrl: './user-management.component.html',
    styleUrls: ['./user-management.component.css']
})
export class UserManagementComponent {
    userService: UserService;

    usersList: any[] = [];
    fullUserList: any[] = [];
    userFilter: string = '';
    permissions: number[] = [];
    isPermissionsLoading: boolean = false;

    displayAorSelection: boolean = false;
    selectAorField: string = '';
    selectedAorItem: number;
    aorValuesLoading: number = 0;
    aorPermission: string;
    aorPermissionMask: number;
    aorUser: number = -1;
    aorFields: any[] = [];
    aorValues: any = {};
    aorSelection: any = {};

    cacheSubscription: Subscription;

    constructor(private injector: Injector,
                private votersService: VotersService,
                private cacheService: CacheService) {
        this.userService = this.injector.get(UserService);
        if (this.cacheService.cacheLoaded) this.load();
        else this.cacheSubscription = this.cacheService.cacheListener.subscribe(this.load.bind(this));
    }

    showUserPanel(): boolean {
        if (!this.userService.userProfile.permissions) return false;
        if (!this.userService.checkPermission('USRMGMT')) return false;
        return true;
    }

    load(): void {
        if (this.cacheSubscription) this.cacheSubscription.unsubscribe();
        this.userService.getAllUsers().subscribe(json => {
            this.fullUserList = this.usersList = json;
        });
    }

    filterUsers(newFilter: string = undefined): void {
        if (newFilter || newFilter === '') this.userFilter = newFilter;
        this.usersList = this.fullUserList.filter(user => user.username.includes(this.userFilter));
    }

    openUser(user: any): void {
        console.log(user);
        this.aorUser = this.usersList.indexOf(user);
        var permissions = this.userService.cacheService.permissions;
        console.log(permissions);
        this.permissions = [];
        if (user.permissions === 0) this.permissions.push(0);
        (<any[]>Object.values(permissions)).forEach(permission => {
            if ((user.permissions & Number(permission.mask)) ||
                (user.permissions & Number(permissions['SYSADMIN'].mask)))
                this.permissions.push(Number(permission.mask));
        });
        if (this.permissions.includes(0) && this.permissions.length > 1)
            this.permissions = this.permissions.filter(permission => permission !== 0);
        console.log(this.permissions);
    }

    sortPerms(a: any, b: any): number {
        return a.mask - b.mask;
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
            this.permissions = (<any[]>Object.values(permissions))
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
        this.aorPermissionMask = permission;
        this.aorValuesLoading++;
        Object.keys(this.cacheService.permissions).forEach(key => {
            if (this.userService.cacheService.permissions[key].mask === permission) this.aorPermission = key;
        });
        this.userService.loadUserAor(username, this.aorPermissionMask).subscribe(json => {
            if (!json.aorValues) json.aorValues = false;
            if (json.aorValues instanceof Array) {
                this.aorSelection = json.aorValues;
            } else {
                this.aorSelection = [json.aorValues];
            }
            this.aorValuesLoading--;
            if (!this.aorValuesLoading)
                this.displayAorSelection = true;
        });
        this.aorValuesLoading++;
        this.votersService.cacheService.getVoterFields().subscribe(json => {
            let aorFields = (<any[]>json).filter(field => typeof field.aor !== 'undefined');
            let dbFields = {};
            aorFields.forEach(field => {
                let label = field.aor.split('/');
                let dependencyLabels = {};
                if (label.length > 2) {
                    let depLabel = aorFields.filter(field => field.field === label[1].trim())[0].aor.split('/').pop();
                    dependencyLabels[label[1]] = label[1][0] === ' ' ? '' : depLabel;
                }
                if (typeof dbFields[field.aor] === 'undefined')
                    dbFields[field.aor] = {
                        'sortOrder': Number(label[0]) + (label.length > 2 ? 0.1 : 0),
                        'dbFields': [field.field],
                        'dependencies': label.length > 2 ? [label[1].trim()] : [],
                        'aorLabel': ((label.length > 2 ? `${dependencyLabels[label[1]]} ` : '') + label[label.length - 1]).trim()
                    }
                else
                    dbFields[field.aor].dbFields.push(field.field);
            });
            this.aorFields = Object.keys(dbFields)
                .sort((a, b) => dbFields[a].sortOrder - dbFields[b].sortOrder)
                .map(key => {
                    return dbFields[key]
                });
            this.aorValuesLoading--;
            if (!this.aorValuesLoading)
                this.displayAorSelection = true;
        });
    }

    extractAorValues(aorText: string[]): string {
        if (!aorText) return '';
        return aorText.map(value => value.split(':')[1]).join('\n');
    }

    addAor(): void {
        this.aorSelection.push({});
    }

    editAor(index: number, field: any): void {
        if (!this.aorSelection[index][field.aorLabel]) this.aorSelection[index][field.aorLabel] = [];
        this.getValues(field);
        this.selectedAorItem = index;
    }

    removeAor(aorIndex: number): void {
        this.aorSelection.splice(aorIndex, 1);
        this.changeAor();
    }

    hideAor(): void {
        this.openUser(this.usersList[this.aorUser]);
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
                    calls--;
                    this.sortValues(field.aorLabel, calls);
                    if (!this.aorValuesLoading) this.selectAorField = field.aorLabel;
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
                                let dependentValues = this.votersService.cacheService.voterFieldValues[dbField]
                                    .map(item => {
                                        return {
                                            'label': dependencyValue.label + ' - ' + item.label,
                                            'value': `${dependency}:${dependencyValue.value}/${dbField}:${item.value}`
                                        }
                                    });
                                this.aorValues[field.aorLabel] = this.aorValues[field.aorLabel].concat(dependentValues);
                                calls--;
                                this.sortValues(field.aorLabel, calls);
                                if (!this.aorValuesLoading) this.selectAorField = field.aorLabel;
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
        if (this.selectedAorItem && !this.aorSelection[this.selectedAorItem][this.selectAorField].length) {
            delete this.aorSelection[this.selectedAorItem][this.selectedAorItem];
            this.selectAorField = '';
        }
        this.userService.updateAor(
                this.usersList[this.aorUser].username,
                this.aorPermissionMask,
                this.aorSelection).subscribe(r => {
            this.selectAorField = '';
        });
    }
}