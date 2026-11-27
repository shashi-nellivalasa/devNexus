import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToolHeaderComponent } from '../../../shared/components/tool-header/tool-header.component';
import { CodeEditorComponent } from '../../../shared/components/code-editor/code-editor.component';
import { DataService } from '../../../core/services/data.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-mock-data-generator',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ToolHeaderComponent, CodeEditorComponent],
  template: `
    <div class="mock-data-tool p-3 d-flex flex-column flex-grow-1">
      <app-tool-header
        title="Mock Data Generator"
        description="Generate realistic, schema-driven mock datasets for frontend testing, API mocks, and database seeding."
        icon="bi-diagram-3"
        toolId="mock-data"
        [showSampleBtn]="true"
        [showCopyBtn]="true"
        [copyContent]="outputContent"
        [showDownloadBtn]="true"
        [downloadContent]="outputContent"
        [downloadFilename]="'mock-data.' + (form.value.format === 'csv' ? 'csv' : 'json')"
        (loadSample)="loadSampleData()"
        (clear)="clearAll()"
      ></app-tool-header>

      <!-- Reactive Form Configuration Card -->
      <form [formGroup]="form" (ngSubmit)="generateData()" class="dn-card p-3 mb-3">
        <div class="row g-3 align-items-center">
          <!-- Schema Preset -->
          <div class="col-md-3">
            <label class="form-label small text-secondary mb-1">Preset Entity:</label>
            <select class="form-select form-select-sm border-secondary border-opacity-50" formControlName="schemaType">
              <option value="users">Users & Accounts</option>
              <option value="employees">Employees & HR</option>
              <option value="products">E-Commerce Products</option>
              <option value="transactions">Financial Transactions</option>
              <option value="orders">Customer Orders</option>
              <option value="custom">Custom Schema</option>
            </select>
          </div>

          <!-- Record Count -->
          <div class="col-md-3">
            <label class="form-label small text-secondary mb-1">Record Count (1 - 500):</label>
            <input type="number" class="form-control form-control-sm border-secondary border-opacity-50" formControlName="count" min="1" max="500" />
          </div>

          <!-- Format Selector -->
          <div class="col-md-3">
            <label class="form-label small text-secondary mb-1">Export Format:</label>
            <div class="btn-group btn-group-sm w-100" role="group">
              <button
                type="button"
                class="btn"
                [ngClass]="form.value.format === 'json' ? 'btn-accent' : 'btn-outline-secondary'"
                (click)="form.patchValue({ format: 'json' }); generateData()"
              >
                JSON
              </button>
              <button
                type="button"
                class="btn"
                [ngClass]="form.value.format === 'csv' ? 'btn-accent' : 'btn-outline-secondary'"
                (click)="form.patchValue({ format: 'csv' }); generateData()"
              >
                CSV
              </button>
            </div>
          </div>

          <!-- Action Button -->
          <div class="col-md-3 d-flex align-items-end pt-3">
            <button type="submit" class="btn btn-sm btn-accent w-100 d-flex align-items-center justify-content-center gap-1">
              <i class="bi bi-play-fill"></i>
              <span>Generate Dataset</span>
            </button>
          </div>
        </div>

        <!-- Custom Fields Builder (when 'custom' is selected) -->
        @if (form.value.schemaType === 'custom') {
          <div class="custom-fields-panel border-top border-secondary border-opacity-25 mt-3 pt-3">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <span class="small fw-bold">Custom Schema Columns</span>
              <button type="button" class="btn btn-sm btn-outline-info py-0 px-2" (click)="addCustomField()">
                <i class="bi bi-plus-lg me-1"></i> Add Column
              </button>
            </div>

            <div formArrayName="customFields" class="d-flex flex-column gap-2">
              @for (fieldCtrl of customFieldsArray.controls; track $index; let idx = $index) {
                <div [formGroupName]="idx" class="d-flex align-items-center gap-2">
                  <input
                    type="text"
                    class="form-control form-control-sm border-secondary border-opacity-50 font-mono"
                    placeholder="field_name"
                    formControlName="name"
                  />
                  <select class="form-select form-select-sm border-secondary border-opacity-50 w-auto" formControlName="type">
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="email">Email</option>
                    <option value="uuid">UUID v4</option>
                    <option value="date">ISO Date</option>
                  </select>
                  <button type="button" class="btn btn-sm btn-outline-danger p-1" (click)="removeCustomField(idx)" [disabled]="customFieldsArray.length <= 1">
                    <i class="bi bi-trash3"></i>
                  </button>
                </div>
              }
            </div>
          </div>
        }
      </form>

      <!-- Output Display -->
      <div class="d-flex flex-column flex-grow-1">
        <app-code-editor
          [title]="'Generated ' + (form.value.schemaType | uppercase) + ' (' + generatedCount + ' items)'"
          [language]="form.value.format === 'csv' ? 'text' : 'json'"
          [value]="outputContent"
          [readOnly]="true"
          placeholder="Click 'Generate Dataset' to synthesize records..."
          [fillHeight]="true"
        ></app-code-editor>
      </div>
    </div>
  `
})
export class MockDataGeneratorComponent implements OnInit {
  private fb = inject(FormBuilder);
  private dataService = inject(DataService);
  private notifyService = inject(NotificationService);

  public form!: FormGroup;
  public outputContent = '';
  public generatedCount = 0;

  get customFieldsArray(): FormArray {
    return this.form.get('customFields') as FormArray;
  }

  ngOnInit(): void {
    this.initForm();
    this.generateData();
  }

  private initForm(): void {
    this.form = this.fb.group({
      schemaType: ['users', Validators.required],
      count: [10, [Validators.required, Validators.min(1), Validators.max(500)]],
      format: ['json', Validators.required],
      customFields: this.fb.array([
        this.createFieldGroup('id', 'number'),
        this.createFieldGroup('title', 'string'),
        this.createFieldGroup('userEmail', 'email'),
        this.createFieldGroup('isPublished', 'boolean'),
        this.createFieldGroup('createdOn', 'date')
      ])
    });

    this.form.get('schemaType')?.valueChanges.subscribe(() => {
      this.generateData();
    });
  }

  private createFieldGroup(name: string, type: string): FormGroup {
    return this.fb.group({
      name: [name, Validators.required],
      type: [type, Validators.required]
    });
  }

  addCustomField(): void {
    this.customFieldsArray.push(this.createFieldGroup(`field_${this.customFieldsArray.length + 1}`, 'string'));
  }

  removeCustomField(index: number): void {
    if (this.customFieldsArray.length > 1) {
      this.customFieldsArray.removeAt(index);
      this.generateData();
    }
  }

  generateData(): void {
    if (this.form.invalid) return;

    const { schemaType, count, format, customFields } = this.form.value;

    const data = this.dataService.generateMockData(
      schemaType,
      count || 10,
      schemaType === 'custom' ? customFields : undefined
    );

    this.generatedCount = data.length;

    if (format === 'csv') {
      this.outputContent = this.convertToCsv(data);
    } else {
      this.outputContent = JSON.stringify(data, null, 2);
    }
  }

  private convertToCsv(arr: any[]): string {
    if (!arr || arr.length === 0) return '';
    const headers = Object.keys(arr[0]);
    const csvRows = [headers.join(',')];

    for (const row of arr) {
      const values = headers.map(header => {
        const val = row[header];
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') {
          return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
        }
        const stringVal = String(val);
        if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
          return `"${stringVal.replace(/"/g, '""')}"`;
        }
        return stringVal;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  loadSampleData(): void {
    this.form.patchValue({
      schemaType: 'products',
      count: 5,
      format: 'json'
    });
    this.generateData();
    this.notifyService.info('Sample products dataset generated');
  }

  clearAll(): void {
    this.outputContent = '';
    this.generatedCount = 0;
  }
}

