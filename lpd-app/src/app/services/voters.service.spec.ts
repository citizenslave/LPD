import { TestBed } from '@angular/core/testing';

import { VotersService } from './voters.service';

describe('VotersService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: VotersService = TestBed.get(VotersService);
    expect(service).toBeTruthy();
  });
});
