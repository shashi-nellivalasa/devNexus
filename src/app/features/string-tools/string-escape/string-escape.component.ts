import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToolHeaderComponent } from '../../../shared/components/tool-header/tool-header.component';
import { CodeEditorComponent } from '../../../shared/components/code-editor/code-editor.component';
import { NotificationService } from '../../../core/services/notification.service';

type EscapeType = 'json' | 'javascript' | 'html' | 'unicode';

@Component({
  selector: 'app-string-escape',
  standalone: true,
  imports: [CommonModule, FormsModule, ToolHeaderComponent, CodeEditorComponent],
  template: `
    <div class="string-escape-tool p-3 d-flex flex-column flex-grow-1">
      <app-tool-header
        title="String Escape / Unescape"
        description="Escape and unescape special characters for JSON payloads, JavaScript strings, HTML markup, and Unicode code points."
        icon="bi-slash-square"
        toolId="string-escape"
        [showSampleBtn]="true"
        [showCopyBtn]="true"
        [copyContent]="outputText"
        [showDownloadBtn]="true"
        [downloadContent]="outputText"
        downloadFilename="escaped-string.txt"
        (loadSample)="loadSampleData()"
        (clear)="clearAll()"
      ></app-tool-header>

      <!-- Escape Toolbar -->
      <div class="dn-card p-3 mb-3">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <!-- Operation: Escape or Unescape -->
          <div class="btn-group" role="group">
            <button
              type="button"
              class="btn btn-sm"
              [ngClass]="direction === 'escape' ? 'btn-accent' : 'btn-outline-secondary'"
              (click)="setDirection('escape')"
            >
              <i class="bi bi-slash-lg me-1"></i> Escape
            </button>
            <button
              type="button"
              class="btn btn-sm"
              [ngClass]="direction === 'unescape' ? 'btn-accent' : 'btn-outline-secondary'"
              (click)="setDirection('unescape')"
            >
              <i class="bi bi-backspace me-1"></i> Unescape
            </button>
          </div>

          <!-- Escape Target Format -->
          <div class="d-flex align-items-center gap-2">
            <label class="small text-secondary mb-0">Format:</label>
            <div class="btn-group btn-group-sm" role="group">
              <button
                type="button"
                class="btn btn-outline-secondary"
                [class.active]="escapeType === 'json'"
                (click)="setEscapeType('json')"
              >
                JSON
              </button>
              <button
                type="button"
                class="btn btn-outline-secondary"
                [class.active]="escapeType === 'javascript'"
                (click)="setEscapeType('javascript')"
              >
                JavaScript
              </button>
              <button
                type="button"
                class="btn btn-outline-secondary"
                [class.active]="escapeType === 'html'"
                (click)="setEscapeType('html')"
              >
                HTML Entities
              </button>
              <button
                type="button"
                class="btn btn-outline-secondary"
                [class.active]="escapeType === 'unicode'"
                (click)="setEscapeType('unicode')"
              >
                Unicode (\\u)
              </button>
            </div>
          </div>

          <button type="button" class="btn btn-sm btn-accent d-flex align-items-center gap-1" (click)="process()">
            <i class="bi bi-play-fill"></i>
            <span>Process</span>
          </button>
        </div>

        @if (errorMessage) {
          <div class="alert alert-danger mt-3 mb-0 py-2 small d-flex align-items-center gap-2">
            <i class="bi bi-exclamation-triangle-fill"></i>
            <span>{{ errorMessage }}</span>
          </div>
        }
      </div>

      <!-- Editors -->
      <div class="row g-3 flex-grow-1">
        <div class="col-lg-6 d-flex flex-column">
          <app-code-editor
            [title]="direction === 'escape' ? 'Raw Input String' : 'Escaped Input String'"
            language="text"
            [value]="inputText"
            (valueChange)="onInputChanged($event)"
            placeholder="Type or paste text to escape or unescape..."
            [fillHeight]="true"
          ></app-code-editor>
        </div>

        <div class="col-lg-6 d-flex flex-column">
          <app-code-editor
            [title]="direction === 'escape' ? 'Escaped Result' : 'Unescaped Raw Output'"
            language="text"
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
export class StringEscapeComponent {
  private notifyService = inject(NotificationService);

  public direction: 'escape' | 'unescape' = 'escape';
  public escapeType: EscapeType = 'json';
  public inputText = '';
  public outputText = '';
  public errorMessage = '';

  setDirection(dir: 'escape' | 'unescape'): void {
    this.direction = dir;
    this.process();
  }

  setEscapeType(type: EscapeType): void {
    this.escapeType = type;
    this.process();
  }

  onInputChanged(val: string): void {
    this.inputText = val;
    this.process();
  }

  process(): void {
    this.errorMessage = '';
    if (!this.inputText) {
      this.outputText = '';
      return;
    }

    try {
      if (this.direction === 'escape') {
        this.outputText = this.doEscape(this.inputText, this.escapeType);
      } else {
        this.outputText = this.doUnescape(this.inputText, this.escapeType);
      }
    } catch (err: any) {
      this.errorMessage = `Conversion Error: ${err.message}`;
    }
  }

  private doEscape(str: string, type: EscapeType): string {
    switch (type) {
      case 'json':
        // JSON string escape (inner characters of JSON.stringify)
        const jsonStr = JSON.stringify(str);
        return jsonStr.slice(1, -1);

      case 'javascript':
        return str
          .replace(/\\/g, '\\\\')
          .replace(/'/g, "\\'")
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t')
          .replace(/\f/g, '\\f')
          .replace(/\v/g, '\\v');

      case 'html':
        return str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');

      case 'unicode':
        return str
          .split('')
          .map(c => {
            const code = c.charCodeAt(0);
            return code > 127 ? '\\u' + ('0000' + code.toString(16)).slice(-4) : c;
          })
          .join('');
    }
  }

  private doUnescape(str: string, type: EscapeType): string {
    switch (type) {
      case 'json':
      case 'javascript':
        try {
          return JSON.parse(`"${str.replace(/"/g, '\\"')}"`);
        } catch {
          return str
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'")
            .replace(/\\\\/g, '\\');
        }

      case 'html':
        const doc = new DOMParser().parseFromString(str, 'text/html');
        return doc.documentElement.textContent || '';

      case 'unicode':
        return str.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
          return String.fromCharCode(parseInt(hex, 16));
        });
    }
  }

  loadSampleData(): void {
    if (this.direction === 'escape') {
      this.inputText = 'Hello World!\nPath: C:\\Program Files\\App\nTags: <script>alert("XSS & fun")</script>\nSpecial: "DevNexus" & \'Toolbox\'';
    } else {
      this.inputText = 'Hello World!\\nPath: C:\\\\Program Files\\\\App\\nTags: &lt;script&gt;alert(&quot;XSS &amp; fun&quot;)&lt;/script&gt;';
    }
    this.process();
    this.notifyService.info('Sample text loaded');
  }

  clearAll(): void {
    this.inputText = '';
    this.outputText = '';
    this.errorMessage = '';
  }
}

