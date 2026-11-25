import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToolHeaderComponent } from '../../../shared/components/tool-header/tool-header.component';
import { CodeEditorComponent } from '../../../shared/components/code-editor/code-editor.component';
import { DiffViewerComponent } from '../../../shared/components/diff-viewer/diff-viewer.component';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-json-diff',
  standalone: true,
  imports: [CommonModule, FormsModule, ToolHeaderComponent, CodeEditorComponent, DiffViewerComponent],
  template: `
    <div class="json-diff-tool p-3">
      <app-tool-header
        title="JSON Diff & Comparator"
        description="Deep semantic comparison between two JSON documents. Formats both documents before diffing to eliminate whitespace noise."
        icon="bi-file-diff"
        toolId="json-diff"
        [showSampleBtn]="true"
        [showCopyBtn]="false"
        (loadSample)="loadSampleData()"
        (clear)="clearAll()"
      ></app-tool-header>

      <!-- Diff Configuration Toolbar -->
      <div class="dn-card p-3 mb-3">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div class="d-flex align-items-center gap-3">
            <div class="form-check form-switch mb-0">
              <input class="form-check-input" type="checkbox" id="sortBeforeDiff" [(ngModel)]="sortKeys" (ngModelChange)="processDiff()">
              <label class="form-check-label small text-secondary" for="sortBeforeDiff">Sort Keys (Ignore key order)</label>
            </div>

            <div class="form-check form-switch mb-0">
              <input class="form-check-input" type="checkbox" id="compactDiff" [(ngModel)]="collapseArrays" (ngModelChange)="processDiff()">
              <label class="form-check-label small text-secondary" for="compactDiff">2-Space Standard Indent</label>
            </div>
          </div>

          <button type="button" class="btn btn-sm btn-accent d-flex align-items-center gap-1" (click)="processDiff()">
            <i class="bi bi-arrow-repeat"></i>
            <span>Re-compute Diff</span>
          </button>
        </div>

        @if (diffError) {
          <div class="alert alert-danger mt-3 mb-0 py-2 small d-flex align-items-center gap-2">
            <i class="bi bi-exclamation-triangle-fill"></i>
            <span>{{ diffError }}</span>
          </div>
        }
      </div>

      <!-- Diff Comparison Result (Full Width) -->
      <div class="mb-4">
        <h3 class="h6 fw-bold text-light mb-2 d-flex align-items-center gap-2">
          <i class="bi bi-layout-split text-info"></i>
          <span>Visual Delta Comparison</span>
        </h3>
        <app-diff-viewer
          [oldText]="normalizedLeft"
          [newText]="normalizedRight"
          oldTitle="Left JSON (Baseline)"
          newTitle="Right JSON (Comparison)"
          viewMode="split"
        ></app-diff-viewer>
      </div>

      <!-- Inputs for Left & Right JSONs -->
      <div class="row g-3">
        <div class="col-lg-6">
          <app-code-editor
            title="Left JSON (Baseline)"
            language="json"
            [value]="leftJson"
            (valueChange)="onLeftChange($event)"
            placeholder="Paste baseline JSON here..."
            height="320px"
          ></app-code-editor>
        </div>

        <div class="col-lg-6">
          <app-code-editor
            title="Right JSON (Comparison)"
            language="json"
            [value]="rightJson"
            (valueChange)="onRightChange($event)"
            placeholder="Paste modified JSON here..."
            height="320px"
          ></app-code-editor>
        </div>
      </div>
    </div>
  `
})
export class JsonDiffComponent {
  private notifyService = inject(NotificationService);

  public leftJson = '';
  public rightJson = '';
  public normalizedLeft = '';
  public normalizedRight = '';
  public sortKeys = true;
  public collapseArrays = true;
  public diffError = '';

  onLeftChange(val: string): void {
    this.leftJson = val;
    this.processDiff();
  }

  onRightChange(val: string): void {
    this.rightJson = val;
    this.processDiff();
  }

  processDiff(): void {
    this.diffError = '';
    if (!this.leftJson.trim() && !this.rightJson.trim()) {
      this.normalizedLeft = '';
      this.normalizedRight = '';
      return;
    }

    try {
      if (this.leftJson.trim()) {
        let parsedLeft = JSON.parse(this.leftJson);
        if (this.sortKeys) parsedLeft = this.sortKeysRecursively(parsedLeft);
        this.normalizedLeft = JSON.stringify(parsedLeft, null, 2);
      } else {
        this.normalizedLeft = '';
      }
    } catch (e: any) {
      this.diffError = `Left JSON error: ${e.message}`;
      this.normalizedLeft = this.leftJson;
    }

    try {
      if (this.rightJson.trim()) {
        let parsedRight = JSON.parse(this.rightJson);
        if (this.sortKeys) parsedRight = this.sortKeysRecursively(parsedRight);
        this.normalizedRight = JSON.stringify(parsedRight, null, 2);
      } else {
        this.normalizedRight = '';
      }
    } catch (e: any) {
      this.diffError = `Right JSON error: ${e.message}`;
      this.normalizedRight = this.rightJson;
    }
  }

  private sortKeysRecursively(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.sortKeysRecursively(item));
    } else if (obj !== null && typeof obj === 'object') {
      const sorted: Record<string, any> = {};
      Object.keys(obj).sort().forEach(k => {
        sorted[k] = this.sortKeysRecursively(obj[k]);
      });
      return sorted;
    }
    return obj;
  }

  loadSampleData(): void {
    this.leftJson = JSON.stringify({
      id: 101,
      name: 'DevNexus',
      tier: 'standard',
      features: ['JSON Formatter', 'Code Diff', 'Regex Tester'],
      settings: {
        theme: 'dark',
        telemetry: true,
        maxRetries: 3
      }
    }, null, 2);

    this.rightJson = JSON.stringify({
      id: 101,
      name: 'DevNexus Pro',
      tier: 'enterprise',
      features: ['JSON Formatter', 'Code Diff', 'Regex Tester', 'API Tester', 'Swagger Explorer'],
      settings: {
        theme: 'dark',
        telemetry: false,
        maxRetries: 5,
        timeout: 10000
      }
    }, null, 2);

    this.processDiff();
    this.notifyService.info('Sample JSON diff loaded');
  }

  clearAll(): void {
    this.leftJson = '';
    this.rightJson = '';
    this.normalizedLeft = '';
    this.normalizedRight = '';
    this.diffError = '';
  }
}

