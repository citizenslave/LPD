import { Injectable } from '@angular/core';
import { CONSTANTS } from './constants.const';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class LegislativeService {
  baseUrl: string = `${CONSTANTS.APIURL}/legis/`;
  legislatorImages: Object = {};

  constructor(private http: HttpClient) {}

  getImage(personId) {
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
}
