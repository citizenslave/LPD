import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

import { Observable } from 'rxjs';

import { CONSTANTS } from './constants.const';
import { CryptoService } from './crypto.service';

import { SyncStatus } from '../objects/sync-status';
import { LegislativeQuery } from '../objects/legislative-query';
import { LegislativeResponse } from '../objects/legislative-response';

@Injectable({
  providedIn: 'root'
})
export class LegislativeService {
  baseUrl: string = `${CONSTANTS.APIURL}/legis/`;
  legislatorImages: Object = {};

  constructor(
      private http: HttpClient,
      private crypto: CryptoService) {}
  
  checkSync(gaSession: number): Observable<SyncStatus> {
    return <Observable<SyncStatus>>this.http.get(this.baseUrl+`checkSync?gaSession=${gaSession}`);
  }

  doSync(gaSession: number): Observable<SyncStatus> {
    let params = {
      'withCredentials': true,
      'params': new HttpParams().set('gaSession', gaSession.toString())
    };

    return <Observable<SyncStatus>>this.http.get(this.baseUrl+'startLegSync', params);
  }

  getLegislation(query: LegislativeQuery): Observable<LegislativeResponse> {
    return <Observable<LegislativeResponse>>this.http.post(this.baseUrl+'getLegislation', query);
  }

  getImage(personId: number): Observable<string> {
    if (this.legislatorImages[personId]) return new Observable(observer => {
      observer.next(this.legislatorImages[personId]);
      observer.complete();
      return { unsubscribe() {} };
    });
    return this.http.get(`${this.baseUrl}cacheLegislatorImage/${personId}`, { 'responseType': 'text' });
  }

  getImageLink(personId: number): string {
    if (!personId) return null;
    return this.baseUrl+`cacheLegislatorImage/${personId}`;
  }

  getCommitteeDetails(committeeId: number): Observable<any> {
    return this.http.get(this.baseUrl+`getCommitteeDetails/${committeeId}`);
  }

  getLegislatorInfo(name: string): Observable<any> {
    return this.http.get(this.baseUrl+`getLegislatorInfo/${name}`);
  }

  getRatings(billNo: number, filterLevel: number): Observable<any> {
    const options: any = {};
    if (filterLevel === 4) options.withCredentials = true;
    return this.http.get(this.baseUrl+`getRatings/${billNo}/${filterLevel}`, options);
  }

  saveRating(billNo: number, rating: number): Observable<null> {
    const payload = { 'legislationId': billNo, 'rating': rating || 0 };
    return this.crypto.encryptedPost(this.baseUrl+`saveRating`, payload);
  }

  getComments(billNo: number, filterLevel: number): Observable<any> {
    return this.http.get(this.baseUrl+`getComments/${billNo}/${filterLevel}`, { 'withCredentials': true });
  }

  saveComment(query: any): Observable<null> {
    return this.crypto.encryptedPost(this.baseUrl+'saveComment', query);
  }

  deleteComment(comment: any): Observable<null> {
    return this.crypto.encryptedPost(this.baseUrl+'deleteComment', comment);
  }
}
