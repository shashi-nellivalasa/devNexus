import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToolHeaderComponent } from '../../../shared/components/tool-header/tool-header.component';
import { CodeEditorComponent } from '../../../shared/components/code-editor/code-editor.component';
import { NotificationService } from '../../../core/services/notification.service';

interface ValidationMetric {
  keysCount: number;
  maxDepth: number;
  arraysCount: number;
  objectsCount: number;
  stringCount: number;
  numberCount: number;
  booleanCount: number;
  nullCount: number;
}

@Component({
  selector: 'app-json-validator',
  standalone: true,
  imports: [CommonModule, FormsModule, ToolHeaderComponent, CodeEditorComponent],
  template: `
    <div class="json-validator-tool p-3">
      <app-tool-header
        title="JSON Linter & Validator"
        description="Check JSON syntax validity with precise line and column error indicators and deep structural metrics."
        icon="bi-check-circle"
        toolId="json-validator"
        [showSampleBtn]="true"
        [showCopyBtn]="true"
        [copyContent]="inputText"
        (loadSample)="loadSampleData()"
        (clear)="clearAll()"
      ></app-tool-header>

      <!-- Status & Stats Card -->
      <div class="dn-card p-3 mb-3">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div class="d-flex align-items-center gap-3">
            @if (isValid === true) {
              <div class="d-flex align-items-center gap-2 text-success">
                <i class="bi bi-check-circle-fill fs-5"></i>
                <span class="fw-bold">Valid JSON Specification</span>
              </div>
            } @else if (isValid === false) {
              <div class="d-flex align-items-center gap-2 text-danger">
                <i class="bi bi-x-circle-fill fs-5"></i>
                <span class="fw-bold">Invalid JSON Syntax</span>
              </div>
            } @else {
              <div class="d-flex align-items-center gap-2 text-secondary">
                <i class="bi bi-info-circle fs-5"></i>
                <span>Enter or paste JSON to validate</span>
              </div>
            }
          </div>

          <button type="button" class="btn btn-sm btn-accent d-flex align-items-center gap-1" (click)="validateJson()">
            <i class="bi bi-shield-check"></i>
            <span>Re-validate</span>
          </button>
        </div>

        <!-- Error Detail Banner -->
        @if (errorDetails) {
          <div class="alert alert-danger mt-3 mb-0 py-2.5 px-3 small">
            <div class="fw-bold mb-1 d-flex align-items-center gap-2">
              <i class="bi bi-exclamation-triangle-fill"></i>
              <span>{{ errorDetails.message }}</span>
            </div>
            @if (errorDetails.line) {
              <div class="font-mono text-danger-emphasis">
                Location: Line {{ errorDetails.line }}, Column {{ errorDetails.column }}
              </div>
            }
          </div>
        }
      </div>

      <div class="row g-3">
        <!-- Input Code Editor -->
        <div class="col-lg-7">
          <app-code-editor
            title="JSON Document to Validate"
            language="json"
            [value]="inputText"
            (valueChange)="onInputChanged($event)"
            placeholder="Paste JSON here to check validity..."
            height="500px"
          ></app-code-editor>
        </div>

        <!-- Structural Metrics & Inspector Panel -->
        <div class="col-lg-5">
          <div class="dn-card p-3 h-100 d-flex flex-column">
            <h3 class="h6 fw-bold text-light border-bottom border-secondary border-opacity-25 pb-2 mb-3 d-flex align-items-center gap-2">
              <i class="bi bi-bar-chart-fill text-info"></i>
              <span>Structural Analysis</span>
            </h3>

            @if (isValid && metrics) {
              <div class="metrics-grid row g-2 flex-grow-1">
                <div class="col-6">
                  <div class="p-2.5 rounded-2 bg-dark-subtle border border-secondary border-opacity-25">
                    <div class="text-secondary small">Total Keys</div>
                    <div class="fs-4 fw-bold text-light font-mono">{{ metrics.keysCount }}</div>
                  </div>
                </div>
                <div class="col-6">
                  <div class="p-2.5 rounded-2 bg-dark-subtle border border-secondary border-opacity-25">
                    <div class="text-secondary small">Max Nesting Depth</div>
                    <div class="fs-4 fw-bold text-light font-mono">{{ metrics.maxDepth }}</div>
                  </div>
                </div>
                <div class="col-6">
                  <div class="p-2.5 rounded-2 bg-dark-subtle border border-secondary border-opacity-25">
                    <div class="text-secondary small">Objects</div>
                    <div class="fs-4 fw-bold text-info font-mono">{{ metrics.objectsCount }}</div>
                  </div>
                </div>
                <div class="col-6">
                  <div class="p-2.5 rounded-2 bg-dark-subtle border border-secondary border-opacity-25">
                    <div class="text-secondary small">Arrays</div>
                    <div class="fs-4 fw-bold text-warning font-mono">{{ metrics.arraysCount }}</div>
                  </div>
                </div>
                <div class="col-6">
                  <div class="p-2.5 rounded-2 bg-dark-subtle border border-secondary border-opacity-25">
                    <div class="text-secondary small">Strings</div>
                    <div class="fs-4 fw-bold text-success font-mono">{{ metrics.stringCount }}</div>
                  </div>
                </div>
                <div class="col-6">
                  <div class="p-2.5 rounded-2 bg-dark-subtle border border-secondary border-opacity-25">
                    <div class="text-secondary small">Numbers</div>
                    <div class="fs-4 fw-bold text-primary-emphasis font-mono">{{ metrics.numberCount }}</div>
                  </div>
                </div>
                <div class="col-6">
                  <div class="p-2.5 rounded-2 bg-dark-subtle border border-secondary border-opacity-25">
                    <div class="text-secondary small">Booleans</div>
                    <div class="fs-4 fw-bold text-light font-mono">{{ metrics.booleanCount }}</div>
                  </div>
                </div>
                <div class="col-6">
                  <div class="p-2.5 rounded-2 bg-dark-subtle border border-secondary border-opacity-25">
                    <div class="text-secondary small">Null Values</div>
                    <div class="fs-4 fw-bold text-secondary font-mono">{{ metrics.nullCount }}</div>
                  </div>
                </div>
              </div>
            } @else {
              <div class="text-center text-secondary py-5 flex-grow-1 d-flex flex-column align-items-center justify-content-center">
                <i class="bi bi-clipboard-data fs-2 mb-2 opacity-50"></i>
                <p class="small mb-0">Structural inspection is calculated when the input is valid JSON.</p>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `
})
export class JsonValidatorComponent {
  private notifyService = inject(NotificationService);

  public inputText = '';
  public isValid: boolean | null = null;
  public errorDetails: { message: string; line?: number; column?: number } | null = null;
  public metrics: ValidationMetric | null = null;

  onInputChanged(val: string): void {
    this.inputText = val;
    this.validateJson();
  }

  validateJson(): void {
    if (!this.inputText.trim()) {
      this.isValid = null;
      this.errorDetails = null;
      this.metrics = null;
      return;
    }

    try {
      const parsed = JSON.parse(this.inputText);
      this.isValid = true;
      this.errorDetails = null;
      this.metrics = this.computeMetrics(parsed);
    } catch (err: any) {
      this.isValid = false;
      this.metrics = null;

      // Extract line and column from error message
      let line: number | undefined;
      let col: number | undefined;

      const posMatch = err.message.match(/position\s+(\d+)/i);
      if (posMatch) {
        const pos = parseInt(posMatch[1], 10);
        const sub = this.inputText.substring(0, pos);
        line = sub.split('\n').length;
        col = pos - sub.lastIndexOf('\n');
      } else {
        const lineMatch = err.message.match(/line\s+(\d+)\s+column\s+(\d+)/i);
        if (lineMatch) {
          line = parseInt(lineMatch[1], 10);
          col = parseInt(lineMatch[2], 10);
        }
      }

      this.errorDetails = {
        message: err.message,
        line,
        column: col
      };
    }
  }

  private computeMetrics(data: any): ValidationMetric {
    const metrics: ValidationMetric = {
      keysCount: 0,
      maxDepth: 1,
      arraysCount: 0,
      objectsCount: 0,
      stringCount: 0,
      numberCount: 0,
      booleanCount: 0,
      nullCount: 0
    };

    const traverse = (node: any, depth: number) => {
      if (depth > metrics.maxDepth) {
        metrics.maxDepth = depth;
      }

      if (node === null) {
        metrics.nullCount++;
      } else if (typeof node === 'string') {
        metrics.stringCount++;
      } else if (typeof node === 'number') {
        metrics.numberCount++;
      } else if (typeof node === 'boolean') {
        metrics.booleanCount++;
      } else if (Array.isArray(node)) {
        metrics.arraysCount++;
        node.forEach(item => traverse(item, depth + 1));
      } else if (typeof node === 'object') {
        metrics.objectsCount++;
        const keys = Object.keys(node);
        metrics.keysCount += keys.length;
        keys.forEach(k => traverse(node[k], depth + 1));
      }
    };

    traverse(data, 1);
    return metrics;
  }

  loadSampleData(): void {
    this.inputText = JSON.stringify({
      status: 'success',
      data: {
        users: [
          { id: 1, name: 'Alice', active: true, balance: 1450.50, roles: ['admin', 'dev'] },
          { id: 2, name: 'Bob', active: false, balance: null, roles: ['user'] }
        ],
        pagination: { page: 1, limit: 10, total: 2 }
      }
    }, null, 2);
    this.validateJson();
    this.notifyService.info('Sample JSON loaded');
  }

  clearAll(): void {
    this.inputText = '';
    this.isValid = null;
    this.errorDetails = null;
    this.metrics = null;
  }
}

