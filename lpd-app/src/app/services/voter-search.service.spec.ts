import { TestBed } from '@angular/core/testing';

import { VoterSearchService } from './voter-search.service';

describe('VoterSearchService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: VoterSearchService = TestBed.get(VoterSearchService);
    expect(service).toBeTruthy();
  });
});
