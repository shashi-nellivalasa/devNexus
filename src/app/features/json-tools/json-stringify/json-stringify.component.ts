import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToolHeaderComponent } from '../../../shared/components/tool-header/tool-header.component';
import { CodeEditorComponent } from '../../../shared/components/code-editor/code-editor.component';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-json-stringify',
  standalone: true,
  imports: [CommonModule, FormsModule, ToolHeaderComponent, CodeEditorComponent],
  template: `
    <div class="json-stringify-tool p-3 d-flex flex-column flex-grow-1">
      <app-tool-header
        title="JSON Stringify / Unstringify"
        description="Escape JSON into single-line escaped strings or unpack escaped stringified payloads back into formatted JSON."
        icon="bi-quote"
        toolId="json-stringify"
        [showSampleBtn]="true"
        [showCopyBtn]="true"
        [copyContent]="outputText"
        [showDownloadBtn]="true"
        [downloadContent]="outputText"
        downloadFilename="processed-json.txt"
        (loadSample)="loadSampleData()"
        (clear)="clearAll()"
      ></app-tool-header>

      <!-- Operation Selector & Controls Bar -->
      <div class="dn-card p-3 mb-3">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <!-- Mode Toggle -->
          <div class="btn-group" role="group">
            <button
              type="button"
              class="btn btn-sm"
              [ngClass]="mode === 'stringify' ? 'btn-accent' : 'btn-outline-secondary'"
              (click)="setMode('stringify')"
            >
              <i class="bi bi-box-arrow-in-right me-1"></i> Stringify (Escape)
            </button>
            <button
              type="button"
              class="btn btn-sm"
              [ngClass]="mode === 'unstringify' ? 'btn-accent' : 'btn-outline-secondary'"
              (click)="setMode('unstringify')"
            >
              <i class="bi bi-box-arrow-up-left me-1"></i> Unstringify (Unescape)
            </button>
          </div>

          <!-- Indentation for Unstringify -->
          @if (mode === 'unstringify') {
            <div class="d-flex align-items-center gap-2">
              <label class="small text-secondary mb-0">Indentation:</label>
              <select class="form-select form-select-sm w-auto bg-dark-subtle border-secondary border-opacity-50 text-light" [(ngModel)]="indentation" (ngModelChange)="process()">
                <option [ngValue]="2">2 Spaces</option>
                <option [ngValue]="4">4 Spaces</option>
                <option [ngValue]="'tab'">Tab</option>
              </select>
            </div>
          }

          <!-- Process Button -->
          <button type="button" class="btn btn-sm btn-accent d-flex align-items-center gap-1" (click)="process()">
            <i class="bi bi-play-fill fs-6"></i>
            <span>Run Conversion</span>
          </button>
        </div>

        @if (errorMessage) {
          <div class="alert alert-danger mt-3 mb-0 py-2 small d-flex align-items-center gap-2">
            <i class="bi bi-exclamation-triangle-fill"></i>
            <span>{{ errorMessage }}</span>
          </div>
        }
      </div>

      <!-- Two-Panel Editor Layout -->
      <div class="row g-3 flex-grow-1">
        <div class="col-lg-6 d-flex flex-column">
          <app-code-editor
            [title]="mode === 'stringify' ? 'JSON Input (Object / Array)' : 'Escaped String Input'"
            [language]="mode === 'stringify' ? 'json' : 'text'"
            [value]="inputText"
            (valueChange)="onInputChanged($event)"
            placeholder="Paste your content here..."
            [fillHeight]="true"
          ></app-code-editor>
        </div>

        <div class="col-lg-6 d-flex flex-column">
          <app-code-editor
            [title]="mode === 'stringify' ? 'Escaped String Output' : 'Formatted JSON Object Output'"
            [language]="mode === 'stringify' ? 'text' : 'json'"
            [value]="outputText"
            [readOnly]="true"
            placeholder="Result will appear here..."
            [fillHeight]="true"
          ></app-code-editor>
        </div>
      </div>
    </div>
  `
})
export class JsonStringifyComponent {
  private notifyService = inject(NotificationService);

  public mode: 'stringify' | 'unstringify' = 'stringify';
  public inputText = '';
  public outputText = '';
  public indentation: number | string = 2;
  public errorMessage = '';

  setMode(m: 'stringify' | 'unstringify'): void {
    this.mode = m;
    this.errorMessage = '';
    this.process();
  }

  onInputChanged(val: string): void {
    this.inputText = val;
    this.process();
  }

  process(): void {
    this.errorMessage = '';
    if (!this.inputText.trim()) {
      this.outputText = '';
      return;
    }

    try {
      if (this.mode === 'stringify') {
        // Stringify mode: parse JSON then stringify with JSON.stringify
        const parsed = JSON.parse(this.inputText);
        this.outputText = JSON.stringify(JSON.stringify(parsed));
      } else {
        // Unstringify mode: remove outer escaping recursively if needed
        let current = this.inputText.trim();

        // If wrapped in quotes, attempt JSON.parse to unpack the string
        let unwrapped: any;
        try {
          unwrapped = JSON.parse(current);
        } catch {
          // If it wasn't wrapped in quotes, try adding quotes or direct parse
          unwrapped = JSON.parse(`"${current.replace(/"/g, '\\"')}"`);
        }

        // If unwrapped is still a string containing JSON, unwrap once more
        if (typeof unwrapped === 'string') {
          try {
            unwrapped = JSON.parse(unwrapped);
          } catch {
            // Keep current unwrapped
          }
        }

        const indent = this.indentation === 'tab' ? '\t' : Number(this.indentation);
        this.outputText = JSON.stringify(unwrapped, null, indent);
      }
    } catch (err: any) {
      this.errorMessage = `Parsing Error: ${err.message}`;
    }
  }

  loadSampleData(): void {
    if (this.mode === 'stringify') {
      this.inputText = JSON.stringify({
        project: 'DevNexus',
        version: '1.0.0',
        author: {
          name: 'Developer',
          skills: ['Angular 20', 'TypeScript', 'SCSS']
        },
        settings: {
          darkTheme: true,
          offlineSupported: true
        }
      }, null, 2);
    } else {
      this.inputText = '"{\\"project\\":\\"DevNexus\\",\\"version\\":\\"1.0.0\\",\\"author\\":{\\"name\\":\\"Developer\\",\\"skills\\":[\\"Angular 20\\",\\"TypeScript\\"]}}"';
    }
    this.process();
    this.notifyService.info('Sample data loaded');
  }

  clearAll(): void {
    this.inputText = '';
    this.outputText = '';
    this.errorMessage = '';
  }
}

