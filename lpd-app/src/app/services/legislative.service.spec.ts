import { TestBed } from '@angular/core/testing';

import { LegislativeService } from './legislative.service';

describe('LegislativeService', () => {
  let service: LegislativeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LegislativeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
