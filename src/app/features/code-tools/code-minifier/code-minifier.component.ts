import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToolHeaderComponent } from '../../../shared/components/tool-header/tool-header.component';
import { CodeEditorComponent } from '../../../shared/components/code-editor/code-editor.component';
import { NotificationService } from '../../../core/services/notification.service';

type CodeType = 'javascript' | 'css' | 'html';

@Component({
  selector: 'app-code-minifier',
  standalone: true,
  imports: [CommonModule, FormsModule, ToolHeaderComponent, CodeEditorComponent],
  template: `
    <div class="code-minifier-tool p-3 d-flex flex-column flex-grow-1">
      <app-tool-header
        title="Code Minifier (JS / CSS / HTML)"
        description="Compress JavaScript, CSS stylesheets, and HTML markup by stripping comments and redundant whitespace."
        icon="bi-file-zip"
        toolId="code-minifier"
        [showSampleBtn]="true"
        [showCopyBtn]="true"
        [copyContent]="outputCode"
        [showDownloadBtn]="true"
        [downloadContent]="outputCode"
        [downloadFilename]="'minified.' + getFileExtension()"
        (loadSample)="loadSampleData()"
        (clear)="clearAll()"
      ></app-tool-header>

      <!-- Language & Stats Toolbar -->
      <div class="dn-card p-3 mb-3">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <!-- Language Tabs -->
          <div class="btn-group" role="group">
            <button
              type="button"
              class="btn btn-sm"
              [ngClass]="codeType === 'javascript' ? 'btn-accent' : 'btn-outline-secondary'"
              (click)="setCodeType('javascript')"
            >
              <i class="bi bi-filetype-js me-1"></i> JavaScript
            </button>
            <button
              type="button"
              class="btn btn-sm"
              [ngClass]="codeType === 'css' ? 'btn-accent' : 'btn-outline-secondary'"
              (click)="setCodeType('css')"
            >
              <i class="bi bi-filetype-css me-1"></i> CSS
            </button>
            <button
              type="button"
              class="btn btn-sm"
              [ngClass]="codeType === 'html' ? 'btn-accent' : 'btn-outline-secondary'"
              (click)="setCodeType('html')"
            >
              <i class="bi bi-filetype-html me-1"></i> HTML
            </button>
          </div>

          <!-- Stats Badges -->
          @if (outputCode) {
            <div class="d-flex align-items-center gap-2 small font-mono">
              <span class="badge bg-secondary-subtle text-secondary">Original: {{ originalBytes }} B</span>
              <span class="badge bg-secondary-subtle text-info">Minified: {{ minifiedBytes }} B</span>
              <span class="badge bg-success-subtle text-success">-{{ savingsPercent }}% Saved</span>
            </div>
          }

          <button type="button" class="btn btn-sm btn-accent d-flex align-items-center gap-1" (click)="minify()">
            <i class="bi bi-arrows-collapse"></i>
            <span>Minify Code</span>
          </button>
        </div>
      </div>

      <!-- Editors -->
      <div class="row g-3 flex-grow-1">
        <div class="col-lg-6 d-flex flex-column">
          <app-code-editor
            title="Source Code Input"
            [language]="codeType"
            [value]="inputCode"
            (valueChange)="onInputChange($event)"
            placeholder="Paste code to minify..."
            [fillHeight]="true"
          ></app-code-editor>
        </div>

        <div class="col-lg-6 d-flex flex-column">
          <app-code-editor
            title="Minified Result"
            [language]="codeType"
            [value]="outputCode"
            [readOnly]="true"
            placeholder="Minified code will appear here..."
            [fillHeight]="true"
          ></app-code-editor>
        </div>
      </div>
    </div>
  `
})
export class CodeMinifierComponent {
  private notifyService = inject(NotificationService);

  public codeType: CodeType = 'javascript';
  public inputCode = '';
  public outputCode = '';
  public originalBytes = 0;
  public minifiedBytes = 0;
  public savingsPercent = 0;

  setCodeType(type: CodeType): void {
    this.codeType = type;
    this.minify();
  }

  getFileExtension(): string {
    switch (this.codeType) {
      case 'javascript': return 'js';
      case 'css': return 'css';
      case 'html': return 'html';
    }
  }

  onInputChange(val: string): void {
    this.inputCode = val;
    this.minify();
  }

  minify(): void {
    if (!this.inputCode.trim()) {
      this.outputCode = '';
      this.savingsPercent = 0;
      return;
    }

    let result = '';
    switch (this.codeType) {
      case 'javascript':
        result = this.minifyJs(this.inputCode);
        break;
      case 'css':
        result = this.minifyCss(this.inputCode);
        break;
      case 'html':
        result = this.minifyHtml(this.inputCode);
        break;
    }

    this.outputCode = result;
    this.originalBytes = new Blob([this.inputCode]).size;
    this.minifiedBytes = new Blob([this.outputCode]).size;
    if (this.originalBytes > 0) {
      this.savingsPercent = Math.max(0, Math.round(((this.originalBytes - this.minifiedBytes) / this.originalBytes) * 100));
    }
  }

  private minifyJs(js: string): string {
    return js
      // Remove multi-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Remove single line comments
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      // Clean around operators and punctuation
      .replace(/\s*([=+\-*\/%&|^!~?:;,{}()[\]<>])\s*/g, '$1')
      .trim();
  }

  private minifyCss(css: string): string {
    return css
      // Remove comments
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Remove spaces around braces, colons, semi-colons
      .replace(/\s*([{}:;,>+~])\s*/g, '$1')
      // Collapse multiple whitespace
      .replace(/\s+/g, ' ')
      // Remove trailing semicolons before closing brace
      .replace(/;}/g, '}')
      .trim();
  }

  private minifyHtml(html: string): string {
    return html
      // Remove HTML comments
      .replace(/<!--[\s\S]*?-->/g, '')
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      // Remove spaces between tags
      .replace(/>\s+</g, '><')
      .trim();
  }

  loadSampleData(): void {
    if (this.codeType === 'javascript') {
      this.inputCode = `// DevNexus Utility Module
/* Multi-line documentation block
   calculates fibonacci sequence
*/
function calculateFibonacci(n) {
  // Base cases
  if (n <= 1) {
    return n;
  }

  let prev = 0;
  let curr = 1;

  for (let i = 2; i <= n; i++) {
    let next = prev + curr;
    prev = curr;
    curr = next;
  }

  return curr;
}

console.log(calculateFibonacci(10));`;
    } else if (this.codeType === 'css') {
      this.inputCode = `/* Theme Styles for DevNexus */
.header-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background-color: #030407;
  border-bottom: 1px solid #1f2738;
}

.brand-title {
  font-family: 'JetBrains Mono', monospace;
  color: #d4ff24;
  font-weight: 700;
  margin: 0;
}`;
    } else {
      this.inputCode = `<!DOCTYPE html>
<!-- Page Header -->
<html lang="en">
  <head>
    <title>DevNexus Demo</title>
  </head>
  <body>
    <div class="app-root">
      <h1>Hello Developers!</h1>
      <p>All-in-one productivity suite.</p>
    </div>
  </body>
</html>`;
    }

    this.minify();
    this.notifyService.info('Sample code loaded');
  }

  clearAll(): void {
    this.inputCode = '';
    this.outputCode = '';
    this.savingsPercent = 0;
  }
}

