import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { VoterListingComponent } from './voter-listing.component';

describe('VoterListingComponent', () => {
  let component: VoterListingComponent;
  let fixture: ComponentFixture<VoterListingComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ VoterListingComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(VoterListingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
