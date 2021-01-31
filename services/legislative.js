const request = require('request');
const cheerio = require('cheerio');

const ObjectID = require('mongodb').ObjectID;

const ENCRYPTION = require('../utils/encryption');

const PermissionService = require('./permissions');

const _getGaFromYear = Symbol('getGaFromYear');
const _convertDate = Symbol('convertDate');

const _sequentialPromises = Symbol('sequentialPromises');

const _arrayJoinAggregation = Symbol('arrayJoinAggregation');
const _serviceError = Symbol('serviceError');

module.exports = class LegislationService {
	static #db;
	static #baseUrl = 'https://legis.delaware.gov/json/';

	static #dateRegEx = /\/Date\((\d*)\)\//;
	static #legSearchParams = {
		'sort': '',
		'group': '',
		'filter': '',
		'fromIntroDate': '',
		'toIntroDate': '',
		'sponsorName': '',
		'coSponsorCheck': 'false',
		'page': '1',
		'pageSize': '0',
		'selectedGA[0]': LegislationService[_getGaFromYear](new Date().getFullYear())
	};

	static #getAllLegislationUrl = 'AllLegislation/GetAllLegislation';
	static #getAmendmentsUrl = 'BillDetail/GetRelatedAmendmentsByLegislationId?legislationId=';
	static #getAllReportsUrl = 'BillDetail/GetRecentReportsByLegislationId?legislationId=';
	static #getCommitteeReportsUrl = 'BillDetail/GetCommitteeReportsByLegislationId?legislationId=';
	static #getVotingReportsUrl = 'BillDetail/GetVotingReportsByLegislationId?legislationId=';
	static #getRollCallReportUrl = 'RollCall/GetRollCallVoteByRollCallId';

	static #getLegislatorsUrl = 'Search/GetFullLegislatorList';
	static #getLegislatorBillsUrl = 'AssemblyMember/GetSponsoredLegislation';

	static #getAllCommitteesUrl = 'Committees/GetAllCommittees';
	static #getAllMeetingsUrl = 'CommitteeMeetings/GetUpcomingCommitteeMeetings';
	static #getMeetingItemsUrl = 'MeetingNotice/GetCommitteeMeetingItems';

	static #getCommitteeMembersUrl = 'http://legis.delaware.gov/CommitteeDetail?committeeId=';
	static #getAmendmentSponsorsUrl = 'http://legis.delaware.gov/BillDetail?LegislationId=';
	static #getLegislatorDetailsUrl = 'http://legis.delaware.gov/AssemblyMember/';

	static #syncData = {};
	static #syncInProgress = '';
	static #lastSyncComplete = '';

	static connect(_db) {
		LegislationService.#db = _db;
		LegislationService.#db.collection('syncStatus').find().toArray((error, result) => {
			result.forEach(status => {
				LegislationService.#syncData[status.gaSession] = status;
			});
		})
	}

	static getLastSync(gaSession) { return LegislationService.#syncData[gaSession].lastSyncComplete; }
	static getSyncStatus(gaSession) { return LegislationService.#syncData[gaSession].syncInProgress; }
	static checkSync(req, res) {
		const gaSession = req.query.gaSession || LegislationService[_getGaFromYear](new Date().getFullYear());
		var syncData = LegislationService.#syncData[gaSession];
		if (!syncData) syncData = LegislationService.#syncData[gaSession] = { 'gaSession': gaSession };
		if (!syncData.syncInProgress) {
			const ongoingSync = Object.values(LegislationService.#syncData).filter(s => s.syncInProgress);
			if (ongoingSync.length) {
				const elapsedTime = new Date(new Date() - new Date(ongoingSync[0].syncInProgress)).getTime()
				res.json({
					'status': ongoingSync[0].gaSession,
					'syncStarted': ongoingSync[0].syncInProgress,
					'syncTime': elapsedTime
				});
			} else if (!syncData.lastSyncComplete)
				res.json({ 'status': 'NONE' });
			else
				res.json({ 'status': 'DONE', 'lastSync': syncData.lastSyncComplete });
		} else {
			if (syncData.syncInProgress.indexOf('ERROR:') !== -1) {
				res.json({
					'status': 'DONE',
					'lastSync': LegislationService.#syncData[gaSession].syncInProgress
				});
			} else {
				const elapsedTime = new Date(new Date() - new Date(syncData.syncInProgress)).getTime()
				res.json({
					'status': 'SYNC',
					'syncStarted': syncData.syncInProgress,
					'syncTime': elapsedTime
				});
			}
		}
	}

//////////////////////

	static legisRequest(url, formData) {
		var options = {
			'method': 'POST',
			'url': LegislationService.#baseUrl + url,
			'form': formData
		};
		return new Promise((resolve, reject) => {
			request(options, (err, res, body) => {
				if (err) return reject(err);
				try {
					if (body === '') body = '{ "Data": [] }';
					const json = JSON.parse(body);
					resolve(json);
				} catch (e) {
					console.log(`ERROR parsing JSON from ${options.url}:`)
					console.log(body);
					return reject(e);
				}
			});
		});
	}

	static doLegSync(gaSession) {
		const syncStart = new Date();
		gaSession = gaSession || LegislationService[_getGaFromYear](new Date().getFullYear());
		if (!LegislationService.#syncData[gaSession])
			LegislationService.#syncData[gaSession] = { 'gaSession': gaSession };
		const syncData = LegislationService.#syncData[gaSession];
		LegislationService.#syncData[gaSession].syncInProgress = syncStart.toISOString();
		console.log(`Begin sync of [${gaSession}] at ${syncStart.toISOString()}.`);

		return new Promise((resolve, reject) => {
			const tasks = [
				LegislationService.getAllLegislation(gaSession),
				LegislationService.getAllSubstitutes(gaSession),
				LegislationService.getAllAmendments(gaSession),
				LegislationService.getLegislatorData(gaSession),
				LegislationService.getCommitteeInfo(gaSession)
			];
			Promise.all(tasks).then(data => {
				Promise.all([
					LegislationService.processLegislation(data),
					LegislationService[_sequentialPromises](data[4].committees,
							LegislationService.getCommitteeMembers)
				]).then(() => {
					console.log('Updating db legislation...');
					data[0].Data.forEach(bill => {
						console.log(`Updating legislation ${bill.LegislationId}...`);
						const query = { 'LegislationId': bill.LegislationId };
						const update = { '$set': bill };
						LegislationService.#db.collection('legislation')
								.updateOne(query, update, { 'upsert': true });
					});
					console.log('Updating db legislators...');
					data[3].legislators.forEach(legislator => {
						console.log(`Updating legislator ${legislator.PersonId}...`);
						const query = { 'PersonId': legislator.PersonId };
						const update = { '$set': legislator };
						LegislationService.#db.collection('legislators')
								.updateOne(query, update, { 'upsert': true });
					});
					console.log('Saving legislator images...');
					data[3].legislatorImages.forEach(image => {
						console.log(`Updating legislator image ${image.personId}...`);
						const query = { 'personId': image.personId };
						const update = { '$set': image };
						LegislationService.#db.collection('legislatorImages')
								.updateOne(query, update, { 'upsert': true });
					});
					console.log('Updating db committees...');
					data[4].committees.forEach(committee => {
						if (committee.NextMeetingDate)
							committee.NextMeetingDate = LegislationService[_convertDate](committee.NextMeetingDate);
						console.log(`Updating committee ${committee.CommitteeId}...`);
						const query = { 'CommitteeId': committee.CommitteeId };
						const update = { '$set': committee };
						LegislationService.#db.collection('committees')
								.updateOne(query, update, { 'upsert': true });
					});

					const syncDone = new Date();
					console.log(`Finished sync at ${syncDone.toISOString()}: ${syncDone - syncStart}ms`);
					syncData.lastSyncComplete = syncDone.toISOString();
					syncData.syncInProgress = '';
					// LegislationService.#lastSyncComplete = LegislationService.#syncInProgress;
					// LegislationService.#syncInProgress = '';

					LegislationService.saveSync().then(result => {
						resolve({
							'legislation': data[0].Data,
							'legislators': data[3].legislators,
							'committees': data[4].committees
						});
					}).catch(reject);
				}).catch(reject)
			}).catch(reject);
		});
	}

	static getAllLegislation(gaSession) {
		var params = {
			'selectedLegislationTypeId[0]': '1',
			'selectedLegislationTypeId[1]': '2',
			'selectedLegislationTypeId[2]': '3',
			'selectedLegislationTypeId[3]': '4'
		};
		Object.assign(params, LegislationService.#legSearchParams);
		const serviceUrl = LegislationService.#getAllLegislationUrl;
		params['selectedGA[0]'] = gaSession;

		return new Promise((resolve, reject) => {
			console.log('Getting bill count...');
			LegislationService.legisRequest(serviceUrl, params).then(billCount => {
				params.pageSize = billCount.Total;
				console.log(`Retrieving ${billCount.Total} bills...`);
				LegislationService.legisRequest(serviceUrl, params).then(billResponse => {
					console.log(`${billResponse.Data.length} bills retrieved...`);
					resolve(billResponse);
				}).catch(reject);
			}).catch(reject);
		});
	}

	static getAllSubstitutes(gaSession) {
		const serviceUrl = LegislationService.#getAllLegislationUrl;
		const params = { 'selectedLegislationTypeId[0]': '6' };
		Object.assign(params, LegislationService.#legSearchParams);
		params['selectedGA[0]'] = gaSession;

		return new Promise((resolve, reject) => {
			console.log('Getting substitute bill count...');
			LegislationService.legisRequest(serviceUrl, params).then(countResponse => {
				params.pageSize = countResponse.Total;
				console.log(`Retrieving ${countResponse.Total} substitute bills...`);
				LegislationService.legisRequest(serviceUrl, params).then(subsResponse => {
					console.log(`${subsResponse.Data.length} substitute bills retrieved...`);
					resolve(subsResponse);
				}).catch(reject);
			}).catch(reject);
		});
	}

	static getAllAmendments(gaSession) {
		const serviceUrl = LegislationService.#getAllLegislationUrl;
		const params = { 'selectedLegislationTypeId[0]': '5' };
		Object.assign(params, LegislationService.#legSearchParams);
		params['selectedGA[0]'] = gaSession;

		return new Promise((resolve, reject) => {
			console.log('Getting amendment count...');
			LegislationService.legisRequest(serviceUrl, params).then(countResponse => {
				params.pageSize = countResponse.Total;
				console.log(`Retrieving ${countResponse.Total} amendments...`);
				LegislationService.legisRequest(serviceUrl, params).then(amendsResponse => {
					console.log(`${amendsResponse.Data.length} amendments retrieved...`);
					resolve(amendsResponse);
				}).catch(reject);
			}).catch(reject);
		});
	}

	static processLegislation(data) {
		console.log('Processing legislation...')
		const subbedBills = [];
		const amendedBills = [];

		const legislation = data[0].Data;
		const substitutes = data[1].Data;
		const amendments = data[2].Data;
		const legislators = data[3].legislators;
		const sponsorships = data[3].sponsoredBills;
		const meetings = data[4].meetings;

		console.log('Searching for substituted or amended bills...');
		legislation.forEach(bill => {
			if (bill.LegislationStatusId === 12) {
				subbedBills.push(bill);
			}
			if (bill.HasAmendments) {
				amendedBills.push(bill);
			}
		});

		console.log('Filtering amended substitutes...')
		const amendedSubs = substitutes.filter(i => i.HasAmendments);
		console.log(`Finding amendments to ${amendedSubs.length} substitutes...`);
		const getSubAmendments = amendedSubs
			.map(i => i.LegislationId);

		console.log('Attaching substitutes...');
		subbedBills.forEach(bill => {
			bill.substitutes = substitutes
				.filter(i => i.SubstituteParentLegislationDisplayCode === bill.LegislationNumber);
		});
		console.log('Attaching amendments...');
		amendedBills.forEach(bill => {
			bill.amendments = amendments
				.filter(i => i.AmendmentParentLegislationDisplayCode === bill.LegislationNumber);
		});

		console.log('Getting meeting ids...');
		const meetingIds = meetings.map(meeting => meeting.CommitteeMeetingId);

		const allItems = legislation.concat(substitutes).concat(amendments);

		return new Promise((resolve, reject) => {
			Promise.all([
				LegislationService[_sequentialPromises](getSubAmendments,
						LegislationService.getAmendments).then(results => {
					console.log('Attaching amendments to substitutes...')
					amendedSubs.forEach((bill, index) => {
						bill.amendments = [];
						const amendmentIds = results[index].Data.map(i => i.AmendmentLegislationId);
						amendments.forEach(amendment => {
							if (amendmentIds.includes(amendment.LegislationId))
								bill.amendments.push(amendment);
						});
					});
				}).catch(reject),
				LegislationService[_sequentialPromises](meetingIds,
						LegislationService.getCommitteeItems).then(results => {
					console.log('Attaching committee meetings to legislation...');
					const items = results.reduce((acc, cv, idx) => {
						cv.Data.forEach(item => { item['meeting'] = data[4].meetings[idx]; });
						return acc.concat(cv.Data);
					}, []);
					allItems.forEach(item => {
						item.committeeMeetings = items
								.filter(itm => itm.LegislationId === item.LegislationId)
								.map(itm => itm.meeting);
					});
				}).catch(reject),
				LegislationService[_sequentialPromises](amendments,
						LegislationService.getAmendmentSponsors).then(sponsors => {
					amendments.forEach(amendment => {
						amendment.sponsorData = legislators
								.filter(l => amendment.SponsorPersonId === l.PersonId)
								.map(l => { return { 'legislatorData': l } });
						amendment.addlSponsorData = legislators
								.filter(l => amendment.addlSponsorData.includes(l.PersonId))
								.map(l => { return { 'legislatorData': l } });;
						amendment.cosponsorData = legislators
								.filter(l => amendment.cosponsorData.includes(l.PersonId))
								.map(l => { return { 'legislatorData': l } });;
					});
				}).catch(reject),
				LegislationService.getAllReports(allItems).then(reports => {
					console.log('Attaching reports to items...');
					allItems.forEach((item, index) => {
						console.log(`Attaching reports to item ${item.LegislationId}...`)
						item.IntroductionDateTime =
								LegislationService[_convertDate](item.IntroductionDateTime);
						item.LegislationStatusDateTime =
								LegislationService[_convertDate](item.LegislationStatusDateTime);
						item.condensedDisplayCode = item.LegislationDisplayCode.split(' ').join('');
						const sponsors = sponsorships.filter(s => s.LegislationId === item.LegislationId);
						if (item.LegislationTypeId !== 5) {
							item.sponsorData = sponsors.filter(s => s.SponsorTypeId === 1);
							item.addlSponsorData = sponsors.filter(s => s.SponsorTypeId === 2);
							item.cosponsorData = sponsors.filter(s => s.SponsorTypeId === 3);
						}
						item.reportItems = reports[0][index].Data;
						item.votingReports = reports[1][index];
						if (item.LegislationTypeId !== 5)
							item.committeeReports = reports[2][index].Data;
					});
				}).catch(reject)
			]).then(resolve).catch(reject);
		});
	}

	static getAmendments(legisId) {
		const serviceUrl = LegislationService.#getAmendmentsUrl+legisId;
		console.log(`Getting amendments for amended substituted bill ${legisId}`);
		return new Promise((resolve, reject) => {
			LegislationService.legisRequest(serviceUrl, {}).then(resolve).catch(reject);
		});
	}

	static getAllReports(allItems) {
		console.log(`Getting attachments for ${allItems.length} items...`);
		const allIds = allItems.map(i => i.LegislationId);
		const tasks = [
			LegislationService[_sequentialPromises](allIds, LegislationService.getItemReports),
			LegislationService[_sequentialPromises](allIds, LegislationService.getVotingReports),
			LegislationService[_sequentialPromises](allIds, LegislationService.getCommitteeReports)
		];
		return Promise.all(tasks);
	}

	static getItemReports(legisId) {
		const serviceUrl = LegislationService.#getAllReportsUrl+legisId;
		console.log(`Getting reports for ${legisId}`);
		return new Promise((resolve, reject) => {
			LegislationService.legisRequest(serviceUrl, {}).then(resolve).catch(reject);
		});
	}

	static getCommitteeReports(legisId) {
		const serviceUrl = LegislationService.#getCommitteeReportsUrl+legisId;
		console.log(`Getting committee reports for ${legisId}`);
		return new Promise((resolve, reject) => {
			LegislationService.legisRequest(serviceUrl, {}).then(resolve).catch(reject);
		});
	}

	static getVotingReports(legisId) {
		const serviceUrl = LegislationService.#getVotingReportsUrl+legisId;
		console.log(`Getting voting reports for ${legisId}`);
		return new Promise((resolve, reject) => {
			LegislationService.legisRequest(serviceUrl, {}).then(reportSummaries => {
				LegislationService[_sequentialPromises](reportSummaries.Data,
						LegislationService.getRollCallReport).then(rollCalls => {
					resolve(rollCalls);
				}).catch(reject);
			}).catch(reject);
		});
	}

	static getRollCallReport(summary) {
		const serviceUrl = LegislationService.#getRollCallReportUrl
		const params = { 'rollCallId': summary.RollCallId };
		return new Promise((resolve, reject) => {
			LegislationService.legisRequest(serviceUrl, params).then(resolve).catch(reject);
		});
	}

	static getAmendmentSponsors(amendment) {
		const serviceUrl = LegislationService.#getAmendmentSponsorsUrl+amendment.LegislationId;
		return new Promise((resolve, reject) => {
			console.log(`Getting amendment sponsors for ${amendment.LegislationId}...`);
			request({ 'method': 'GET', 'url': serviceUrl }, (err, res, html) => {
				if (err) return reject(err);
				const $ = cheerio.load(html);
				const sponsorLinks = $('.info-value > a[href*=personId]').toArray().map(sponsor => {
					return {
						'sponsorId': sponsor.attribs.href.split('=')[1],
						'sponsorType': sponsor.parent.parent.children[1].children[0].data.slice(0, -4)
					};
				});
				amendment.cosponsorData = sponsorLinks.filter(l=>l.sponsorType === 'Co-Sponsor')
						.map(l => Number(l.sponsorId));
				amendment.addlSponsorData = sponsorLinks.filter(l=>l.sponsorType === 'Additional Sponsor')
						.map(l => Number(l.sponsorId));
				console.log(`Retrieved ${sponsorLinks.length}+1 sponsors for ${amendment.LegislationId}...`);
				resolve(amendment);
			});
		});
	}

	static getLegislatorData(gaSession) {
		const serviceUrl = LegislationService.#getLegislatorsUrl;
		const params = {
			'sort': '',
			'group': '',
			'filter': '',
			'selectedGAs[0]': gaSession
		};

		return new Promise((resolve, reject) => {
			console.log('Getting all legislators...');
			LegislationService.legisRequest(serviceUrl, params).then(allLegislators => {
				Promise.all([
					LegislationService[_sequentialPromises](allLegislators.Data,
							LegislationService.getLegislatorBills.bind(LegislationService, gaSession)),
					LegislationService[_sequentialPromises](allLegislators.Data,
							LegislationService.getLegislatorDetails)
				]).then(data => {
					const allBills = data[0].reduce((acc, cv) => acc.concat(cv.Data), []);
					resolve({
						'legislators': allLegislators.Data,
						'sponsoredBills': allBills,
						'legislatorImages': data[1]
					});
				}).catch(reject)
			}).catch(reject);
		});
	}

	static getLegislatorBills(gaSession, legislator) {
		const serviceUrl = LegislationService.#getLegislatorBillsUrl;
		const params = {
			'sort': '',
			'filter': '',
			'group': '',
			'page': '1',
			'pageSize': '0',
			'assemblyId': gaSession,
			'personId': legislator.PersonId.toString()
		};

		return new Promise((resolve, reject) => {
			console.log(`Getting bill count for legislator ${params.personId}...`);
			LegislationService.legisRequest(serviceUrl, params).then(billCount => {
				params.pageSize = billCount.Total;
				console.log(`Retrieving ${billCount.Total} bills for legislator ${params.personId}...`);
				LegislationService.legisRequest(serviceUrl, params).then(billsResponse => {
					console.log(`${billsResponse.Data.length} bills retrieved for legislator ${params.personId}...`);
					billsResponse.Data.forEach(bill => bill.legislatorData = legislator);
					resolve(billsResponse);
				}).catch(reject);
			}).catch(reject);
		});
	}

	static getLegislatorDetails(legislator) {
		const serviceUrl = LegislationService.#getLegislatorDetailsUrl+
				`${legislator.AssemblyId}/${legislator.ShortName.replace('-','')}`;
		return new Promise((resolve, reject) => {
			console.log(`Getting details for legislator ${legislator.PersonId}...`);
			request({ 'method': 'GET', 'url': serviceUrl }, (err, res, html) => {
				if (err) return reject(err);
				const $ = cheerio.load(html);

				try {
					let mailLink = $('.info-value > a[href*=mailto]').toArray()[0].children[0].data;
					legislator.email = mailLink;
				} catch (e) {
					console.log(`Could not find email for legislator ${legislator.PersonId}: ${legislator.ShortName}`);
					console.log(e);
				}

				try {
					let phone = $('.info-phone').toArray()[0].children[3].children[3].children[0];
					legislator.phone = phone.data.match(/(\d{3}).{1,2}(\d{3}).(\d{4})/).slice(1).join('-');
				} catch (e) {
					console.log(`Could not find phone for legislator ${legislator.PersonId}: ${legislator.ShortName}`);
					console.log(e);
				}
				
				var imgLink = $('img.img-avatar').toArray()[0];
				if (imgLink) imgLink = imgLink.attribs.src;
				else imgLink = 'Content/images/placeholder_leg.png';
				if (imgLink.indexOf('data:image') !== -1) {
					resolve({
						'personId': legislator.PersonId,
						'imgData': imgLink
					});
				} else {
					request({ 'url': 'http://legis.delaware.gov/'+imgLink, 'encoding': null }, (err, imgRes, data) => {
						// console.log(data.toString('base64'));
						resolve({
							'personId': legislator.PersonId,
							'imgData': `data:image;base64,${data.toString('base64')}`
						});
					});
				}
			});
		});
	}

	static getCommitteeInfo(gaSession) {
		const committeeServiceUrl = LegislationService.#getAllCommitteesUrl;
		const meetingServiceUrl = LegislationService.#getAllMeetingsUrl;
		const params = { 'assemblyId': gaSession };

		return new Promise((resolve, reject) => {
			console.log('Getting all committees and upcoming meetings...');
			Promise.all([
				LegislationService.legisRequest(committeeServiceUrl, params),
				LegislationService.legisRequest(meetingServiceUrl, {})
			]).then(data => {
				console.log(`Retrieved ${data[0].Total} committees and ${data[1].Total} meetings...`);
				resolve({
					'committees': data[0].Data,
					'meetings': data[1].Data
				});
			}).catch(reject);
		});
	}

	static getCommitteeMembers(committee) {
		const serviceUrl = LegislationService.#getCommitteeMembersUrl+committee.CommitteeId;
		return new Promise((resolve, reject) => {
			console.log(`Getting members for committee ${committee.CommitteeId}...`);
			request({ 'method': 'GET', 'url': serviceUrl }, (err, res, html) => {
				if (err) return reject(err);
				const $ = cheerio.load(html);
				const legLinks = $('.info-value > a[href*=LegislatorDetail]').toArray().map(member => {
					return {
						'memberId': Number(member.attribs.href.split('/')[2]),
						'position': member.parent.parent.children[1].children[0]
								.data.slice(0, -1)
					};
				});
				console.log(`Retrieved ${legLinks.length} committee members...`);
				committee.members = legLinks;
				resolve();
			});
		});
	}

	static getCommitteeItems(meetingId) {
		const serviceUrl = LegislationService.#getMeetingItemsUrl;
		const params = { 'committeeMeetingId': meetingId };

		return new Promise((resolve, reject) => {
			console.log(`Getting items for committee ${meetingId}...`);
			LegislationService.legisRequest(serviceUrl, params).then(json => {
				console.log(`Retrieved ${json.Total} meeting items...`);
				resolve(json);
			}).catch(reject);
		});
	}

	static [_getGaFromYear](year) {
		return Math.ceil(year/2)-860;
	}

	static [_convertDate](dateString) {
		if (!dateString) return null;
		return new Date(Number(dateString.match(LegislationService.#dateRegEx)[1]));
	}

	static [_sequentialPromises](parameterList, method) {
		return parameterList.reduce((chain, task) => {
			return chain.then(results => {
				return method(task).then(result => {
					if (!(results instanceof Array)) return [ result ];
					results.push(result);
					return results;
				});
			});
		}, Promise.resolve([]));
	}

//////////////////////

	static getLegislation(req, res) {
		if (!LegislationService.#db) return res.status(500).send('DB not ready');

		console.log(req.body.query);

		var words = req.body.query.split(' ');
		var query = [ 'LegislationDisplayCode', 'Synopsis', 'LongTitle', 'Sponsor', 'condensedDisplayCode' ];
		query = words.map(word => {
			const wordQuery = query.map(field => {
				const fieldQuery = {};
				fieldQuery[field] = new RegExp(`.*${word}.*`, 'i');
				fieldQuery[field].toJSON = fieldQuery[field].toString;
				return fieldQuery;
			});
			return { '$or': wordQuery };
		});
		query.push({ 'AssemblyId': req.body.gaSession });
		query = { '$and': query };

		console.log('%j', JSON.stringify(query));

		var options = {
			'sort': { 'IntroductionDateTime': -1 },
			'allowDiskUse': true
		};

		var cursor = LegislationService.#db.collection('legislation').find(query, options);
		cursor.count().then(count => {
			cursor.skip(req.body.first).limit(req.body.rows).toArray((err, results) => {
				if (err) return LegislationService[_serviceError](req, res, err);
				res.json({ 'count': count, 'results': results });
			});
		});
	}

	static getCommitteeDetails(req, res) {
		if (!LegislationService.#db) return res.status(500).send('DB not ready');

		console.log(`Getting committee id: ${req.params.committeeId}...`);
		const aggregation = [{ '$match': { 'CommitteeId': Number(req.params.committeeId) } }]
				.concat(LegislationService[_arrayJoinAggregation]('legislators', 'PersonId', 'members', 'memberId'));

		LegislationService.#db.collection('committees').aggregate(aggregation)
				.toArray((err, results) => {
			if (err) return LegislationService[_serviceError](req, res, err);
			console.log(results);
			res.json(results[0]);
		});
	}

	static getLegislatorInfo(req, res) {
		if (!LegislationService.#db) return res.status(500).send('DB not ready');

		console.log(req.params.personId);
		var query = req.params.shortName === 'all'?{}:{ 'ShortName': req.params.shortName }
		LegislationService.#db.collection('legislators').find(query)
				.toArray((err, results) => {
			if (err) return LegislationService[_serviceError](req, res, err);
			console.log(results);
			res.json(req.params.shortName === 'all'?results:results[0]);
		});
	}

	static cacheLegislatorImage(req, res) {
		if (!LegislationService.#db) return res.status(500).send('DB not ready');

		console.log('Find image data:', req.params.personId);
		var query = req.params.personId === 'all'?{}:{ 'personId': Number(req.params.personId) };
		LegislationService.#db.collection('legislatorImages').find(query)
				.toArray((err, results) => {
			if (err) return LegislationService[_serviceError](req, res, err);
			if (!results[0].imgData) {
				res.end(Buffer.from(placeholderImg));
			}
			res.end(Buffer.from(results[0].imgData));
		});
	}

	static saveRating(req, res) {
		if (!LegislationService.#db) return res.status(500).send('DB not ready');
		if (!req.session.sessionKey) return res.status(401).send('No user logged in');
		if (PermissionService.isForbidden(req.session.permissions, 'LEG'))
			return res.status(403).send('Unauthorized operation for user');
		
		if (!req.body) return res.status(400).send('No query');
		if (!req.body.iv) return res.status(400).send('No encrypted query');

		var decryptedPayload = ENCRYPTION.decryptRequest(req);
		console.log(`Saving rating for ${req.session.username}, `,
				`LegislationId: ${decryptedPayload.legislationId}, `,
				`Rating: ${decryptedPayload.rating}`);

		const query = { 'username': req.session.username, 'legislationId': decryptedPayload.legislationId };
		const update = {
			'$set': {
				'legislationId': decryptedPayload.legislationId,
				'rating': decryptedPayload.rating,
				'username': req.session.username,
				'timestamp': new Date().getTime()
			}
		};
		const upsert = decryptedPayload.rating !== 0;

		LegislationService.#db.collection('ratings').updateOne(query, update, { 'upsert': upsert }, (err, results) => {
			if (err) return LegislationService[_serviceError](req, res, err);
			res.json(ENCRYPTION.encryptResponse(req, 'OK'));
		});
	}

	static saveComment(req, res) {
		if (!LegislationService.#db) return res.status(500).send('DB not ready');
		if (!req.session.sessionKey) return res.status(401).send('No user logged in');
		if (PermissionService.isForbidden(req.session.permissions, 'LEG'))
			return res.status(403).send('Unauthorized operation for user');
		
		if (!req.body) return res.status(400).send('No query');
		if (!req.body.iv) return res.status(400).send('No encrypted query');

		var decryptedPayload = ENCRYPTION.decryptRequest(req);
		console.log(`Saving comment for ${req.session.username} on `,
				`${decryptedPayload.legislationId}:`,
				`${decryptedPayload.comment}`);

		const record = {
			'legislationId': decryptedPayload.legislationId,
			'username': req.session.username,
			'timestamp': new Date().getTime(),
			'comment': decryptedPayload.comment
		};
		LegislationService.#db.collection('comments').insertOne(record, (err, results) => {
			if (err) return LegislationService[_serviceError](req, res, err);
			res.json(ENCRYPTION.encryptResponse(req, 'OK'));
		});
	}

	static getRatings(req, res) {
		if (!LegislationService.#db) return res.status(500).send('DB not ready');

		console.log(`Get type ${req.params.filter} ratings for ${req.params.legislationId}...`);
		const aggregation = [{
			'$match': { 'legislationId': Number(req.params.legislationId), 'rating': { '$ne': 0 } }
		}, {
			'$group': {
				'_id': '$legislationId',
				'avgRating': { '$avg': '$rating' },
				'count': { '$sum': 1 }
			}
		}];
		if (req.params.filter === '4')
			if (req.session.username) {
				aggregation[0]['$match'].username = req.session.username;
				delete aggregation[0]['$match'].rating;
			} else return res.json();
		console.log(aggregation);

		LegislationService.#db.collection('ratings').aggregate(aggregation).toArray((err, result) => {
			if (err) return LegislationService[_serviceError](req, res, err);
			console.log(result);
			if (result.length)
				res.json(result[0]);
			else
				res.json({
					'_id': req.params.legislationId,
					'avgRating': 0,
					'count': 0
				});
		});
	}

	static getComments(req, res) {
		if (!LegislationService.#db) return res.status(500).send('DB not ready');

		console.log(`Get type ${req.params.filter} comments for ${req.params.legislationId}...`);
		const query = {
			'legislationId': Number(req.params.legislationId),
			'$or': [ { 'deleted': false }, { 'deleted': { '$exists': false } } ]
		}
		LegislationService.#db.collection('comments').find(query).toArray((err, results) => {
			if (err) return LegislationService[_serviceError](req, res, err);
			console.log(results);
			const response = {
				'count': results.length
			};
			response.comments = results.map(comment => {
				const returnedComment = {
					'_id': comment._id,
					'legislationId': comment.legislationId,
					'timestamp': comment.timestamp,
					'comment': comment.comment
				};
				if (req.session.username === comment.username) returnedComment.mine = true;
				return returnedComment;
			});
			res.json(response);
		});
	}

	static deleteComment(req, res) {
		if (!LegislationService.#db) return res.status(500).send('DB not ready');
		if (!req.session.sessionKey) return res.status(401).send('No user logged in');
		if (PermissionService.isForbidden(req.session.permissions, 'LEG'))
			return res.status(403).send('Unauthorized operation for user');
		
		if (!req.body) return res.status(400).send('No query');
		if (!req.body.iv) return res.status(400).send('No encrypted query');

		const decryptedPayload = ENCRYPTION.decryptRequest(req);
		const sysAdmin = !PermissionService.isForbidden(req.session.permissions, 'SYSADMIN');

		console.log(`${req.session.username} deleting comment...`);
		console.log(decryptedPayload);
		const query = {
			'_id': ObjectID.createFromHexString(decryptedPayload._id),
			'legislationId': decryptedPayload.legislationId,
			'timestamp': decryptedPayload.timestamp,
			'comment': decryptedPayload.comment
		};
		if (!sysAdmin) query.username = req.session.username;
		const update = {
			'$set': { 'deleted': true }
		};
		LegislationService.#db.collection('comments').updateOne(query, update, (err, result) => {
			if (err) return LegislationService[_serviceError](req, res, err);
			res.json(ENCRYPTION.encryptResponse(req, 'OK'));
		});
	}

	static aggregationTest(req, res) {
		if (!LegislationService.#db) return res.status(500).send('DB not ready');
		if (!req.session.username) return res.status(401).send('No user logged in');
		if (PermissionService.isForbidden(req.session.permissions, 'SYSADMIN'))
			return res.status(403).send('Unauthorized operation for user');

		if (!req.body) return res.status(400).send('No query');
		if (!req.body.iv) return res.status(400).send('No encrypted query');

		const decryptedPayload = ENCRYPTION.decryptRequest(req);
		console.log(`Running aggregation query against ${decryptedPayload.collection}:\n`,decryptedPayload.aggregation);

		LegislationService.#db.collection(decryptedPayload.collection)
				.aggregate(decryptedPayload.aggregation)
				.toArray((err, result) => {
					if (err) return LegislationService[_serviceError](req, res, err);
					res.json(ENCRYPTION.encryptResponse(req, result));
				});
	}

	static startLegSync(req, res) {
		if (!LegislationService.#db) return res.status(500).send('DB not ready');
		if (!req.session.username) return res.status(401).send('No user logged in');
		if (PermissionService.isForbidden(req.session.permissions, 'SYSADMIN'))
			return res.status(403).send('Unauthorized operation for user');
		
		const gaSession = req.query.gaSession;
		const syncData = LegislationService.#syncData[gaSession];
		const ongoingSync = Object.values(LegislationService.#syncData).filter(s => s.syncInProgress);
		if (ongoingSync.length || (syncData && syncData.syncInProgress)) {
			LegislationService.checkSync(req, res);
		} else {
			LegislationService.doLegSync(req.query.gaSession).catch(e => {
				console.log(e);
				LegislationService.#syncData[gaSession].syncInProgress = `ERROR: ${e}`;
				LegislationService.#syncData[gaSession].lastSyncComplete = Date.now();
				LegislationService.saveSync().catch(console.log);
			});
			LegislationService.checkSync(req, res);
		}
	}

	static saveSync() {
		console.log(`Saving sync status...`);
		return Promise.all(Object.values(LegislationService.#syncData).map(syncStatus => {
			if (!LegislationService.#db) return Promise.reject('DB not ready');
			if (!syncStatus.lastSyncComplete) return Promise.resolve();
			const query = { 'gaSession': syncStatus.gaSession };
			const update = { '$set': syncStatus };
			const options = { 'upsert': true };
			return LegislationService.#db.collection('syncStatus').updateOne(query, update, options);
		}));
	}

	static [_arrayJoinAggregation](joinTable, joinField, arrayField, arrayObjField) {
		const originalField = `${arrayField}.${arrayObjField}`;
		const unwindArrayField = { '$unwind': `$${arrayField}` };
		const lookupJoinRecord = { '$lookup': {
			'from': joinTable,
			'localField': `${originalField}`,
			'foreignField': joinField,
			'as': '__tempData'
		} };
		const regroupRecords = { '$group': {
			'_id': '$_id',
			'__origDoc': { '$first': '$$ROOT' }
		} };
		regroupRecords['$group'][arrayField] = { '$push': {
			'$mergeObjects': [ { '$arrayElemAt': [ '$__tempData', 0 ] }, `$${arrayField}` ]
		} };
		const replaceOrigFields = { '$replaceRoot': {
			'newRoot': { '$mergeObjects': [ '$__origDoc', '$$ROOT' ] }
		} };
		const removeTempFields = { '$project': { '__origDoc': 0, '__tempData': 0 } };
		removeTempFields['$project'][originalField] = 0;
		return [
			unwindArrayField,
			lookupJoinRecord,
			regroupRecords,
			replaceOrigFields,
			removeTempFields
		];
	}

	static [_serviceError](req, res, err) {
		console.log(`Error servicing request to ${req.url}:`, err);
		return res.status(500).send('Error running query');
	}
}

// request.get('http://legis.delaware.gov/BillDetail?LegislationId=47922', (err, res, body) => {
// 	console.log(body);
// });
// module.exports.doLegSync(149).then(json => {
// 	const HA1SS2SB50 = json.legislation.filter(i=>i.LegislationId === 37099)[0];
// 	const SB37 = json.legislation.filter(i=>i.LegislationId === 47249)[0].substitutes[0];
// 	const HB237 = json.legislation.filter(i=>i.LegislationId === 47743)[0].committeeMeetings;
// 	const HA1HB265 = json.legislation.filter(i=>i.LegislationId === 47910)[0].amendments[0];
// 	const HA2HB222 = json.legislation.filter(i=>i.LegislationId === 47702)[0].amendments.filter(a=>a.LegislationId === 47853)[0];
// 	console.log(HA1SS2SB50.substitutes[1].amendments, SB37, HB237, HA1HB265, HA2HB222);
// 	console.log(json.committees[0]);
	// console.log(json.legislators);
	// console.log(json.legislation[0]);
// });
// module.exports.getAllLegislation(149).then(d => console.log(d.Data[0]));
// module.exports.getLegislatorData(149).then(d => console.log(d.sponsoredBills));
// module.exports.getLegislatorDetails({"_id":{"$oid":"60122565cd9b84e48c97bc29"},"PersonId":24001,"AssemblyId":151,"AssemblyMemberId":1096,"AssemblyMemberTypeId":12,"ChamberId":2,"ChamberName":null,"DisplayName":"Eric Morrison","DistrictAbbreviation":"RD","DistrictAliasNickname":null,"DistrictAsNumber":27,"DistrictId":48,"DistrictNumber":"27","FirstName":"Eric","HasProfilePicture":false,"IsLeadershipRole":false,"LastName":"Morrison","LeadershipDisplayOrder":13,"MemberTypeName":"Representative","MiddleInitial":null,"PartyCode":"D","PartyId":1,"ShortName":"Morrison","phone":"302-744-4351","email":"Eric.Morrison@delaware.gov"}).then(json => {
// 	console.log(json);
// });
// module.exports.getCommitteeInfo().then(json => {
// 	console.log(json.committees[0]);
// 	module.exports.getCommitteeMembers(json.committees[0]).then(console.log);
// });
// module.exports.getAmendmentSponsors({ 'LegislationId': 47853 }).then(console.log);
// module.exports.getAmendmentSponsors({ 'LegislationId': 47922 }).then(console.log);
// module.exports.getAmendmentSponsors({ 'LegislationId': 47372 }).then(console.log);
