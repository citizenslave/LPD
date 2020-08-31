import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

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
  
  checkSync(): Observable<SyncStatus> {
    return <Observable<SyncStatus>>this.http.get(this.baseUrl+'checkSync');
  }

  doSync(): Observable<SyncStatus> {
    return <Observable<SyncStatus>>this.http.get(this.baseUrl+'startLegSync', { 'withCredentials': true });
  }

  getLegislation(query: LegislativeQuery): Observable<LegislativeResponse> {
    return <Observable<LegislativeResponse>>this.http.post(this.baseUrl+'getLegislation', query);
  }

  getImage(personId: number): Promise<typeof Image> {
    if (this.legislatorImages[personId]) return Promise.resolve(this.legislatorImages[personId]);

    this.legislatorImages[personId] = new Image();
    this.legislatorImages[personId].src = `${this.baseUrl}cacheLegislatorImage/${personId}`;

    return new Promise((resolve, reject) => {
      this.legislatorImages[personId].onload = () => {
        resolve(this.legislatorImages[personId]);
      }
      this.legislatorImages[personId].onerror = () => {
        reject(this.legislatorImages[personId]);
      }
    });
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
