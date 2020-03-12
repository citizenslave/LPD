export class VotersField {
	label: string;
	field: string;
	clear: boolean;
	display: number;
	canEdit: boolean;

	static readonly NONE: number = 0x0;
	static readonly SEARCH: number = 0x1;
	static readonly RESULT: number = 0x2;
	static readonly VIEWER: number = 0x4;
	static readonly ALL: number = VotersField.SEARCH | VotersField.RESULT | VotersField.VIEWER;

	constructor(_label: string, _field: string, _clear: boolean = false, _display: number = VotersField.SEARCH | VotersField.VIEWER, _canEdit: boolean = false) {
		this.label = _label;
		this.field = _field;
		this.clear = _clear;
		this.display = _display;
		this.canEdit = _canEdit;
	}
}

export const VOTERS_FIELDS: VotersField[] = [
	new VotersField('Updated By', 'updatedBy', false),
	new VotersField('Updated At', 'updatedAt', false, VotersField.VIEWER),
	new VotersField('Voter ID', 'VOTER ID'),
	new VotersField('Last Name', 'LAST-NAME', true, VotersField.ALL, true),
	new VotersField('First Name', 'FIRST-NAME', false, VotersField.ALL, true),
	new VotersField('Middle Initial', 'MID-NAME'),
	new VotersField('Suffix', 'SUFFIX'),
	new VotersField('Date of Birth', 'DATE-OF-BIRTH', true, VotersField.ALL),
	new VotersField('Birth Year', 'BIRTH-YEAR'),
	new VotersField('Phone Number', 'PHONE', true, VotersField.SEARCH | VotersField.VIEWER, true),
	new VotersField('Email Address', 'email', false, VotersField.SEARCH | VotersField.VIEWER, true),
	new VotersField('Home Number', 'HOME-NO'),
	new VotersField('Home Apt', 'HOME-APT'),
	new VotersField('Home Street', 'HOME-STREET'),
	new VotersField('Home Development', 'HOME-DEV'),
	new VotersField('Home City', 'HOME-CITY'),
	new VotersField('Home Zip', 'HOME-ZIPCODE'),
	new VotersField('Home Zip', 'HOME-ZIP+FOUR'),
	new VotersField('County', 'COUNTY', true),
	new VotersField('Election District', 'PRECINCT'),
	new VotersField('Rep District', 'RD'),
	new VotersField('Senate District', 'SD'),
	new VotersField('County District', 'COUNTY-COUNCIL'),
	new VotersField('Wilmington District', 'WILM-CC', true),
	new VotersField('Municipal Code', 'MUNI-CC'),
	new VotersField('School District', 'SCH-DIST'),
	new VotersField('Party', 'PARTY', true, VotersField.ALL),
	new VotersField('Affiliation Date', 'DATE-PARTY'),
	new VotersField('Registration Date', 'DATE-REG'),
	new VotersField('Voting History', 'HISTORY', true),
	new VotersField('Mail Line 1', 'MAIL-1', true, VotersField.SEARCH | VotersField.VIEWER, true),
	new VotersField('Mail Line 2', 'MAIL-2', false, VotersField.SEARCH | VotersField.VIEWER, true),
	new VotersField('Mail Line 3', 'MAIL-3', false, VotersField.SEARCH | VotersField.VIEWER, true),
	new VotersField('Mail Line 4', 'MAIL-4', false, VotersField.SEARCH | VotersField.VIEWER, true),
	new VotersField('Mail City', 'MAIL-CITY', false, VotersField.SEARCH | VotersField.VIEWER, true),
	new VotersField('Mail State', 'MAIL-STATE', false, VotersField.SEARCH | VotersField.VIEWER, true),
	new VotersField('Mail Zip', 'MAIL-ZIP', false, VotersField.SEARCH | VotersField.VIEWER, true),
	new VotersField('CoE Change Date', 'DATE-UPDATE', true),
	new VotersField('Status', 'STATUS')
];