import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { sanitizePreviewHtml } from '../../../shared/utils/html-sanitize.util';
import { ToolHeaderComponent } from '../../../shared/components/tool-header/tool-header.component';
import { CodeEditorComponent } from '../../../shared/components/code-editor/code-editor.component';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-markdown-preview',
  standalone: true,
  imports: [CommonModule, FormsModule, ToolHeaderComponent, CodeEditorComponent],
  template: `
    <div class="markdown-preview-tool p-3 d-flex flex-column flex-grow-1">
      <app-tool-header
        title="Markdown Live Editor & Preview"
        description="Write and preview GitHub-flavored Markdown with live visual rendering, tables, code blocks, and HTML export."
        icon="bi-markdown"
        toolId="markdown-preview"
        [showSampleBtn]="true"
        [showCopyBtn]="true"
        [copyContent]="renderedHtmlRaw"
        [showDownloadBtn]="true"
        [downloadContent]="renderedHtmlRaw"
        downloadFilename="rendered.html"
        (loadSample)="loadSampleData()"
        (clear)="clearAll()"
      ></app-tool-header>

      <!-- Preview Mode Toolbar -->
      <div class="dn-card p-3 mb-3">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div class="btn-group btn-group-sm" role="group">
            <button
              type="button"
              class="btn btn-outline-secondary"
              [class.active]="viewMode === 'split'"
              (click)="viewMode = 'split'"
            >
              <i class="bi bi-layout-split me-1"></i> Editor & Preview
            </button>
            <button
              type="button"
              class="btn btn-outline-secondary"
              [class.active]="viewMode === 'preview-only'"
              (click)="viewMode = 'preview-only'"
            >
              <i class="bi bi-eye me-1"></i> Full Preview
            </button>
            <button
              type="button"
              class="btn btn-outline-secondary"
              [class.active]="viewMode === 'html-only'"
              (click)="viewMode = 'html-only'"
            >
              <i class="bi bi-code-slash me-1"></i> Raw HTML
            </button>
          </div>

          <div class="d-flex align-items-center gap-2 small text-secondary">
            <span>{{ wordCount }} words</span> &bull;
            <span>{{ charCount }} characters</span>
          </div>
        </div>
      </div>

      <!-- Main Workspace Panels -->
      <div class="row g-3 flex-grow-1">
        <!-- Editor Column -->
        @if (viewMode === 'split') {
          <div class="col-lg-6 d-flex flex-column">
            <app-code-editor
              title="Markdown Source"
              language="markdown"
              [value]="markdownInput"
              (valueChange)="onMarkdownChange($event)"
              placeholder="Write Markdown here..."
              [fillHeight]="true"
            ></app-code-editor>
          </div>
        }

        <!-- Preview Column -->
        <div class="d-flex flex-column" [ngClass]="viewMode === 'split' ? 'col-lg-6' : 'col-12'">
          @if (viewMode === 'html-only') {
            <app-code-editor
              title="Rendered HTML Code"
              language="html"
              [value]="renderedHtmlRaw"
              [readOnly]="true"
              placeholder="Rendered HTML will appear here..."
              [fillHeight]="true"
            ></app-code-editor>
          } @else {
            <div class="dn-card p-4 flex-grow-1 overflow-auto markdown-body-container" style="min-height: 320px;">
              <div class="markdown-rendered-content text-light" [innerHTML]="safeRenderedHtml"></div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .markdown-body-container {
      background-color: var(--dn-surface-card);
      border: 1px solid var(--dn-border);
    }
    :host ::ng-deep .markdown-rendered-content {
      line-height: 1.6;
      h1, h2, h3, h4, h5, h6 {
        color: #ffffff;
        font-weight: 700;
        margin-top: 1.25rem;
        margin-bottom: 0.75rem;
        border-bottom: 1px solid var(--dn-border);
        padding-bottom: 0.35rem;
      }
      p {
        margin-bottom: 1rem;
        color: var(--dn-text-main);
      }
      code {
        background-color: var(--dn-surface-2);
        padding: 0.2rem 0.4rem;
        border-radius: 4px;
        color: var(--dn-accent);
        font-family: var(--dn-font-mono);
      }
      pre {
        background-color: var(--dn-primary);
        border: 1px solid var(--dn-border);
        padding: 1rem;
        border-radius: 8px;
        overflow-x: auto;
        code {
          background-color: transparent;
          padding: 0;
          color: #e5e7eb;
        }
      }
      blockquote {
        border-left: 4px solid var(--dn-accent);
        padding-left: 1rem;
        color: var(--dn-text-muted);
        margin: 1rem 0;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 1rem 0;
        th, td {
          border: 1px solid var(--dn-border);
          padding: 0.5rem 0.75rem;
        }
        th {
          background-color: var(--dn-surface-2);
          color: #ffffff;
        }
      }
      a {
        color: #38bdf8;
        text-decoration: underline;
      }
      ul, ol {
        padding-left: 1.5rem;
        margin-bottom: 1rem;
      }
      hr {
        border-color: var(--dn-border);
        margin: 1.5rem 0;
      }
    }
  `]
})
export class MarkdownPreviewComponent implements OnInit {
  private sanitizer = inject(DomSanitizer);
  private notifyService = inject(NotificationService);

  public markdownInput = '';
  public renderedHtmlRaw = '';
  public safeRenderedHtml: SafeHtml = '';
  public viewMode: 'split' | 'preview-only' | 'html-only' = 'split';

  get wordCount(): number {
    if (!this.markdownInput.trim()) return 0;
    return this.markdownInput.trim().split(/\s+/).length;
  }

  get charCount(): number {
    return this.markdownInput.length;
  }

  ngOnInit(): void {
    this.loadSampleData();
  }

  onMarkdownChange(val: string): void {
    this.markdownInput = val;
    this.render();
  }

  render(): void {
    this.renderedHtmlRaw = this.parseMarkdown(this.markdownInput);
    const cleaned = sanitizePreviewHtml(this.renderedHtmlRaw);
    this.safeRenderedHtml = this.sanitizer.bypassSecurityTrustHtml(cleaned);
  }

  private parseMarkdown(md: string): string {
    if (!md) return '';

    let html = md;

    // Fenced Code blocks
    html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code class="language-${lang}">${this.escapeHtml(code.trim())}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, (_, code) => {
      return `<code>${this.escapeHtml(code)}</code>`;
    });

    // Headings
    html = html.replace(/^###### (.*$)/gim, '<h6>$1</h6>');
    html = html.replace(/^##### (.*$)/gim, '<h5>$1</h5>');
    html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Blockquotes
    html = html.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

    // Horizontal rule
    html = html.replace(/^---$/gim, '<hr>');

    // Bold & Italic
    html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');

    // Links & Images
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="img-fluid rounded my-2">');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Tables
    html = html.replace(/\|(.+)\|/g, (match) => {
      const cells = match.split('|').filter(c => c.trim().length > 0);
      if (cells.every(c => c.trim().match(/^:?-+:?$/))) {
        return ''; // delimiter line
      }
      const tdCells = cells.map(c => `<td>${c.trim()}</td>`).join('');
      return `<tr>${tdCells}</tr>`;
    });
    html = html.replace(/(<tr>.+<\/tr>\n?)+/g, (tbl) => `<table class="table table-bordered"><tbody>${tbl}</tbody></table>`);

    // Task lists & Bullet lists
    html = html.replace(/^\s*-\s+\[ \]\s+(.*$)/gim, '<li><input type="checkbox" disabled class="form-check-input me-2"> $1</li>');
    html = html.replace(/^\s*-\s+\[x\]\s+(.*$)/gim, '<li><input type="checkbox" checked disabled class="form-check-input me-2"> $1</li>');
    html = html.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.+<\/li>\n?)+/g, '<ul>$&</ul>');

    // Paragraphs
    const paras = html.split(/\n\s*\n/);
    html = paras.map(p => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<h') || trimmed.startsWith('<pre') || trimmed.startsWith('<table') || trimmed.startsWith('<ul') || trimmed.startsWith('<blockquote') || trimmed.startsWith('<hr')) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');

    return html;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  loadSampleData(): void {
    this.markdownInput = `# DevNexus — Modern Developer Utility Suite

Welcome to **DevNexus**, the ultimate workstation utility.

> "Simplicity is prerequisite for reliability." &mdash; Edsger W. Dijkstra

---

### Features Overview

- [x] High-performance Monaco code editors
- [x] Postman-inspired **Advanced API Tester**
- [x] OpenAPI 3.x / Swagger UI Explorer
- [x] Client-side JSON & String manipulation
- [ ] Direct cloud sync (privacy-first local storage)

### Quick Code Example

\`\`\`typescript
import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: true,
  template: '<h1>{{ title() }}</h1>'
})
export class AppComponent {
  readonly title = signal('DevNexus');
}
\`\`\`

### Comparison Matrix

| Feature | DevToys | Postman | DevNexus |
| :--- | :--- | :--- | :--- |
| Offline Tools | Yes | Partial | **Yes** |
| API Tester | No | Yes | **Yes** |
| OpenAPI Explorer | No | Partial | **Yes** |
| TypeScript Compiler | No | No | **Yes** |

Check out the [Project Documentation](https://github.com) for more details!`;

    this.render();
    this.notifyService.info('Sample Markdown loaded');
  }

  clearAll(): void {
    this.markdownInput = '';
    this.renderedHtmlRaw = '';
    this.safeRenderedHtml = '';
  }
}

