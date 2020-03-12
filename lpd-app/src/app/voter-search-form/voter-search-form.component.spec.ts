import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { VoterSearchFormComponent } from './voter-search-form.component';

describe('VoterSearchFormComponent', () => {
  let component: VoterSearchFormComponent;
  let fixture: ComponentFixture<VoterSearchFormComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ VoterSearchFormComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(VoterSearchFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
