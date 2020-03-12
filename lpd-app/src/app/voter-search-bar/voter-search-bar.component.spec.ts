import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { VoterSearchBarComponent } from './voter-search-bar.component';

describe('VoterSearchBarComponent', () => {
  let component: VoterSearchBarComponent;
  let fixture: ComponentFixture<VoterSearchBarComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ VoterSearchBarComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(VoterSearchBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
