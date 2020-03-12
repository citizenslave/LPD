import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { CallSheetComponent } from './call-sheet.component';

describe('CallSheetComponent', () => {
  let component: CallSheetComponent;
  let fixture: ComponentFixture<CallSheetComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ CallSheetComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CallSheetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
