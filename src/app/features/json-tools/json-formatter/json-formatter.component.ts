import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToolHeaderComponent } from '../../../shared/components/tool-header/tool-header.component';
import { CodeEditorComponent } from '../../../shared/components/code-editor/code-editor.component';
import { NotificationService } from '../../../core/services/notification.service';
import { parseJsonInput } from '../../../shared/utils/json-unwrap.util';

@Component({
  selector: 'app-json-formatter',
  standalone: true,
  imports: [CommonModule, FormsModule, ToolHeaderComponent, CodeEditorComponent],
  template: `
    <div class="json-formatter-tool p-3 d-flex flex-column flex-grow-1">
      <app-tool-header
        title="JSON Formatter & Minifier"
        description="Cleanly pretty-print JSON with custom indentation, sort keys alphabetically, or minify payloads for minimal network payload size."
        icon="bi-braces"
        toolId="json-formatter"
        [showSampleBtn]="true"
        [showCopyBtn]="true"
        [copyContent]="outputText"
        [showDownloadBtn]="true"
        [downloadContent]="outputText"
        downloadFilename="formatted.json"
        (loadSample)="loadSampleData()"
        (clear)="clearAll()"
      ></app-tool-header>

      <!-- Formatting Controls Toolbar -->
      <div class="dn-card p-3 mb-3">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <!-- Main Actions -->
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <button type="button" class="btn btn-sm btn-accent d-flex align-items-center gap-1" (click)="formatJson()">
              <i class="bi bi-text-indent-left"></i>
              <span>Beautify / Format</span>
            </button>

            <button type="button" class="btn btn-sm btn-secondary-accent d-flex align-items-center gap-1" (click)="minifyJson()">
              <i class="bi bi-arrows-collapse"></i>
              <span>Minify / Compact</span>
            </button>

            <!-- Indentation Selector -->
            <div class="d-flex align-items-center gap-2 ms-2">
              <label class="small text-secondary mb-0">Indent:</label>
              <select class="form-select form-select-sm w-auto bg-dark-subtle border-secondary border-opacity-50 text-light" [(ngModel)]="indentation" (ngModelChange)="formatJson()">
                <option [ngValue]="2">2 Spaces</option>
                <option [ngValue]="4">4 Spaces</option>
                <option [ngValue]="'tab'">Tab</option>
              </select>
            </div>

            <!-- Sort Keys Toggle -->
            <div class="form-check form-switch ms-3 mb-0">
              <input class="form-check-input" type="checkbox" id="sortKeysCheck" [(ngModel)]="sortKeys" (ngModelChange)="formatJson()">
              <label class="form-check-label small text-secondary" for="sortKeysCheck">Sort Keys (A-Z)</label>
            </div>

            <!-- Unwrap Embedded / Unescaped JSON Toggle -->
            <div class="form-check form-switch ms-2 mb-0" title="Automatically parse escaped JSON strings, key fragments, and unescaped &quot;{...}&quot; blocks">
              <input class="form-check-input" type="checkbox" id="unwrapEmbeddedCheck" [(ngModel)]="unwrapEmbedded" (ngModelChange)="formatJson()">
              <label class="form-check-label small text-secondary" for="unwrapEmbeddedCheck">Unwrap Escaped JSON</label>
            </div>
          </div>

          <!-- Statistics Badges -->
          @if (outputText && !errorMessage) {
            <div class="d-flex align-items-center gap-2 small font-mono">
              <span class="badge bg-secondary-subtle text-secondary">
                Original: {{ originalBytes }} B
              </span>
              <span class="badge bg-secondary-subtle text-info">
                Output: {{ outputBytes }} B
              </span>
              @if (savingsPercent !== null) {
                <span class="badge" [ngClass]="savingsPercent >= 0 ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning'">
                  {{ savingsPercent >= 0 ? '-' : '+' }}{{ Math.abs(savingsPercent) }}%
                </span>
              }
            </div>
          }
        </div>

        @if (errorMessage) {
          <div class="alert alert-danger mt-3 mb-0 py-2 small d-flex align-items-center gap-2">
            <i class="bi bi-exclamation-octagon-fill"></i>
            <span>{{ errorMessage }}</span>
          </div>
        }
      </div>

      <!-- Editors -->
      <div class="row g-3 flex-grow-1">
        <div class="col-lg-6 d-flex flex-column">
          <app-code-editor
            title="JSON Input"
            language="json"
            [value]="inputText"
            (valueChange)="onInputChanged($event)"
            placeholder="Paste raw or unformatted JSON here..."
            [fillHeight]="true"
          ></app-code-editor>
        </div>

        <div class="col-lg-6 d-flex flex-column">
          <app-code-editor
            title="Formatted / Minified Result"
            language="json"
            [value]="outputText"
            [readOnly]="true"
            placeholder="Formatted output will appear here..."
            [fillHeight]="true"
          ></app-code-editor>
        </div>
      </div>
    </div>
  `
})
export class JsonFormatterComponent {
  private notifyService = inject(NotificationService);

  public inputText = '';
  public outputText = '';
  public indentation: number | string = 2;
  public sortKeys = false;
  public unwrapEmbedded = true;
  public errorMessage = '';
  public originalBytes = 0;
  public outputBytes = 0;
  public savingsPercent: number | null = null;
  public Math = Math;

  onInputChanged(val: string): void {
    this.inputText = val;
    this.formatJson();
  }

  formatJson(): void {
    this.errorMessage = '';
    if (!this.inputText.trim()) {
      this.outputText = '';
      this.savingsPercent = null;
      return;
    }

    try {
      let parsed = parseJsonInput(this.inputText, this.unwrapEmbedded);
      if (this.sortKeys) {
        parsed = this.sortObjectKeys(parsed);
      }
      const indent = this.indentation === 'tab' ? '\t' : Number(this.indentation);
      this.outputText = JSON.stringify(parsed, null, indent);
      this.updateStats();
    } catch (err: any) {
      this.errorMessage = `Syntax Error: ${err.message}`;
    }
  }

  minifyJson(): void {
    this.errorMessage = '';
    if (!this.inputText.trim()) {
      this.outputText = '';
      return;
    }

    try {
      let parsed = parseJsonInput(this.inputText, this.unwrapEmbedded);
      if (this.sortKeys) {
        parsed = this.sortObjectKeys(parsed);
      }
      this.outputText = JSON.stringify(parsed);
      this.updateStats();
      this.notifyService.info('Minified JSON');
    } catch (err: any) {
      this.errorMessage = `Syntax Error: ${err.message}`;
    }
  }

  private sortObjectKeys(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObjectKeys(item));
    } else if (obj !== null && typeof obj === 'object') {
      const sortedObj: Record<string, any> = {};
      Object.keys(obj).sort().forEach(k => {
        sortedObj[k] = this.sortObjectKeys(obj[k]);
      });
      return sortedObj;
    }
    return obj;
  }

  private updateStats(): void {
    this.originalBytes = new Blob([this.inputText]).size;
    this.outputBytes = new Blob([this.outputText]).size;
    if (this.originalBytes > 0) {
      const diff = this.originalBytes - this.outputBytes;
      this.savingsPercent = Math.round((diff / this.originalBytes) * 100);
    } else {
      this.savingsPercent = null;
    }
  }

  loadSampleData(): void {
    this.inputText = '{"name":"DevNexus","category":"Developer Utilities","features":["JSON Tools","API Tester","Swagger UI","Monaco Editor"],"version":1.0,"metadata":{"openSource":true,"license":"MIT","stars":1420},"tags":["angular20","typescript","scss"]}';
    this.formatJson();
    this.notifyService.info('Sample JSON loaded');
  }

  clearAll(): void {
    this.inputText = '';
    this.outputText = '';
    this.errorMessage = '';
    this.savingsPercent = null;
  }
}

