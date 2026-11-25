import { Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, ViewChild, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StorageService } from '../../../core/services/storage.service';
import { ThemeService } from '../../../core/services/theme.service';
import { NotificationService } from '../../../core/services/notification.service';
import loader from '@monaco-editor/loader';

export interface EditorMarker {
  message: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  severity?: 'error' | 'warning';
}

@Component({
  selector: 'app-code-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="code-editor-container dn-card d-flex flex-column overflow-hidden h-100">
      <!-- Editor Top Bar -->
      <div class="editor-header px-3 py-2 border-bottom border-secondary border-opacity-25 d-flex align-items-center justify-content-between">
        <div class="d-flex align-items-center gap-2">
          @if (title) {
            <span class="small fw-semibold">{{ title }}</span>
          }
          <span class="badge bg-secondary-subtle text-muted text-uppercase" style="font-size: 0.65rem;">
            {{ language }}
          </span>
          @if (readOnly) {
            <span class="badge bg-dark-subtle text-secondary" style="font-size: 0.65rem;">Read Only</span>
          }
        </div>

        <div class="d-flex align-items-center gap-1">
          <!-- Character & Line stats -->
          <span class="small text-secondary me-2 font-mono" style="font-size: 0.75rem;">
            {{ lineCount }} lines &bull; {{ charCount }} chars
          </span>

          @if (!readOnly && showClear) {
            <button
              type="button"
              class="btn btn-sm btn-icon text-secondary hover-text-light p-1"
              (click)="clearContent()"
              title="Clear editor"
            >
              <i class="bi bi-x-circle"></i>
            </button>
          }

          @if (copyable) {
            <button
              type="button"
              class="btn btn-sm btn-icon text-secondary hover-text-light p-1"
              (click)="copyContent()"
              title="Copy to clipboard"
            >
              <i class="bi bi-copy"></i>
            </button>
          }

          @if (downloadable) {
            <button
              type="button"
              class="btn btn-sm btn-icon text-secondary hover-text-light p-1"
              (click)="downloadFile()"
              title="Download content"
            >
              <i class="bi bi-download"></i>
            </button>
          }
        </div>
      </div>

      <!-- Editor Body -->
      <div class="editor-body position-relative" [style.height]="height" [style.min-height]="height">
        <!-- Monaco host container -->
        <div
          #monacoContainer
          class="monaco-host"
          [style.visibility]="isMonacoReady ? 'visible' : 'hidden'"
          [style.opacity]="isMonacoReady ? '1' : '0'"
        ></div>

        <!-- Fallback High Quality Monospace Textarea -->
        @if (!isMonacoReady) {
          <div class="textarea-wrapper">
            <textarea
              class="w-100 h-100 font-mono p-3 bg-transparent border-0 form-control shadow-none"
              [style.font-size.px]="fontSize"
              [style.tab-size]="tabSize"
              [style.white-space]="wordWrap ? 'pre-wrap' : 'pre'"
              [style.resize]="'none'"
              [readonly]="readOnly"
              [placeholder]="placeholder || 'Type or paste content here...'"
              [(ngModel)]="currentValue"
              (ngModelChange)="onTextareaChange($event)"
              spellcheck="false"
            ></textarea>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .code-editor-container {
      background-color: var(--dn-surface-card);
      border: 1px solid var(--dn-border);
      border-radius: 8px;
    }
    .editor-header {
      background-color: var(--dn-surface-1);
    }
    .btn-icon {
      line-height: 1;
      border: none;
      background: transparent;
      transition: color 0.15s ease;
      &:hover {
        color: var(--dn-accent) !important;
      }
    }
    .editor-body {
      position: relative;
      width: 100%;
      overflow: hidden;
    }
    .monaco-host {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100% !important;
      height: 100% !important;
      transition: opacity 0.15s ease;
    }
    .textarea-wrapper {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      height: 100%;
    }
    textarea:focus {
      outline: none;
    }
  `]
})
export class CodeEditorComponent implements OnInit, OnChanges, OnDestroy {
  @Input() value = '';
  @Input() language = 'json';
  @Input() readOnly = false;
  @Input() placeholder = '';
  @Input() height = '320px';
  @Input() title = '';
  @Input() copyable = true;
  @Input() downloadable = false;
  @Input() downloadFilename = 'file.txt';
  @Input() showClear = true;
  @Input() markers: EditorMarker[] = [];

  @Output() valueChange = new EventEmitter<string>();

  @ViewChild('monacoContainer', { static: false }) monacoContainerRef?: ElementRef<HTMLDivElement>;

  public currentValue = '';
  public isMonacoReady = false;
  private monacoEditorInstance: any = null;
  private resizeObserver: ResizeObserver | null = null;
  private isSettingProgrammatically = false;

  private storageService = inject(StorageService);
  private themeService = inject(ThemeService);
  private notifyService = inject(NotificationService);

  constructor() {
    effect(() => {
      const theme = this.themeService.currentTheme();
      if (this.monacoEditorInstance && this.isMonacoReady) {
        const monaco = (window as any).monaco;
        if (monaco?.editor) {
          monaco.editor.setTheme(theme === 'light' ? 'vs' : 'vs-dark');
        }
      }
    });
  }

  get fontSize(): number {
    return this.storageService.preferences().editorFontSize || 13;
  }

  get tabSize(): number {
    return this.storageService.preferences().editorTabSize || 2;
  }

  get wordWrap(): boolean {
    return this.storageService.preferences().wordWrap ?? true;
  }

  get lineCount(): number {
    if (!this.currentValue) return 0;
    return this.currentValue.split('\n').length;
  }

  get charCount(): number {
    return this.currentValue ? this.currentValue.length : 0;
  }

  ngOnInit(): void {
    this.currentValue = this.value || '';
    this.tryInitMonaco();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value']) {
      const newVal = changes['value'].currentValue || '';
      if (newVal !== this.currentValue) {
        this.currentValue = newVal;
        if (this.monacoEditorInstance && this.isMonacoReady) {
          if (this.monacoEditorInstance.getValue() !== newVal) {
            this.isSettingProgrammatically = true;
            try {
              this.monacoEditorInstance.setValue(newVal);
            } finally {
              this.isSettingProgrammatically = false;
            }
            setTimeout(() => {
              if (this.monacoEditorInstance) {
                this.monacoEditorInstance.layout();
              }
            }, 30);
          }
        }
      }
    }

    if (changes['language'] && this.monacoEditorInstance && this.isMonacoReady) {
      const monaco = (window as any).monaco;
      if (monaco?.editor) {
        monaco.editor.setModelLanguage(this.monacoEditorInstance.getModel(), this.normalizeLanguage(this.language));
      }
    }

    if (changes['readOnly'] && this.monacoEditorInstance && this.isMonacoReady) {
      this.monacoEditorInstance.updateOptions({ readOnly: this.readOnly });
    }

    if (changes['markers'] && this.monacoEditorInstance && this.isMonacoReady) {
      this.applyMarkers();
    }
  }

  ngOnDestroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.monacoEditorInstance) {
      try {
        this.monacoEditorInstance.dispose();
      } catch {
        // ignore
      }
    }
  }

  private tryInitMonaco(): void {
    if (typeof window === 'undefined') return;

    const timeout = setTimeout(() => {
      if (!this.isMonacoReady) {
        this.isMonacoReady = false;
      }
    }, 1500);

    loader.init().then((monaco) => {
      clearTimeout(timeout);
      if (this.monacoContainerRef?.nativeElement) {
        this.createMonacoInstance(monaco);
      }
    }).catch(() => {
      clearTimeout(timeout);
      this.isMonacoReady = false;
    });
  }

  private createMonacoInstance(monaco: any): void {
    if (!this.monacoContainerRef?.nativeElement) return;

    try {
      this.monacoEditorInstance = monaco.editor.create(this.monacoContainerRef.nativeElement, {
        value: this.currentValue,
        language: this.normalizeLanguage(this.language),
        theme: document.documentElement.getAttribute('data-bs-theme') === 'light' ? 'vs' : 'vs-dark',
        readOnly: this.readOnly,
        fontSize: this.fontSize,
        lineHeight: 21,
        tabSize: this.tabSize,
        wordWrap: this.wordWrap ? 'on' : 'off',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        lineNumbers: 'on',
        lineNumbersMinChars: 3,
        folding: true,
        renderLineHighlight: 'all',
        fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
        scrollbar: {
          vertical: 'visible',
          horizontal: 'auto',
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10
        }
      });

      this.monacoEditorInstance.onDidChangeModelContent(() => {
        if (this.isSettingProgrammatically) return;
        const val = this.monacoEditorInstance.getValue();
        this.currentValue = val;
        this.valueChange.emit(val);
      });

      this.isMonacoReady = true;
      this.applyMarkers();

      setTimeout(() => {
        if (this.monacoEditorInstance) {
          this.monacoEditorInstance.layout();
        }
      }, 50);

      if (typeof ResizeObserver !== 'undefined' && this.monacoContainerRef?.nativeElement) {
        this.resizeObserver = new ResizeObserver(() => {
          this.monacoEditorInstance?.layout();
        });
        this.resizeObserver.observe(this.monacoContainerRef.nativeElement);
      }
    } catch {
      this.isMonacoReady = false;
    }
  }

  private normalizeLanguage(lang: string): string {
    switch (lang.toLowerCase()) {
      case 'ts':
      case 'typescript':
        return 'typescript';
      case 'js':
      case 'javascript':
        return 'javascript';
      case 'json':
        return 'json';
      case 'sql':
        return 'sql';
      case 'html':
        return 'html';
      case 'css':
      case 'scss':
        return 'css';
      case 'markdown':
      case 'md':
        return 'markdown';
      case 'xml':
        return 'xml';
      default:
        return 'plaintext';
    }
  }

  private applyMarkers(): void {
    const monaco = (window as any).monaco;
    const model = this.monacoEditorInstance?.getModel();
    if (!monaco?.editor || !model) return;

    const mapped = (this.markers || []).map(m => ({
      severity: m.severity === 'warning'
        ? monaco.MarkerSeverity.Warning
        : monaco.MarkerSeverity.Error,
      message: m.message,
      startLineNumber: Math.max(1, m.line),
      startColumn: Math.max(1, m.column),
      endLineNumber: Math.max(1, m.endLine || m.line),
      endColumn: Math.max(1, m.endColumn || m.column + 1)
    }));
    monaco.editor.setModelMarkers(model, 'devnexus-validator', mapped);
  }

  public onTextareaChange(val: string): void {
    this.currentValue = val;
    this.valueChange.emit(val);
  }

  public clearContent(): void {
    this.currentValue = '';
    if (this.monacoEditorInstance && this.isMonacoReady) {
      this.isSettingProgrammatically = true;
      try {
        this.monacoEditorInstance.setValue('');
      } finally {
        this.isSettingProgrammatically = false;
      }
    }
    this.valueChange.emit('');
  }

  public copyContent(): void {
    if (!this.currentValue) return;
    navigator.clipboard.writeText(this.currentValue).then(() => {
      this.notifyService.success('Copied to clipboard');
    }).catch(() => {
      this.notifyService.error('Copy failed');
    });
  }

  public downloadFile(): void {
    if (!this.currentValue) return;
    const blob = new Blob([this.currentValue], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = this.downloadFilename;
    link.click();
    URL.revokeObjectURL(url);
    this.notifyService.success(`Downloaded ${this.downloadFilename}`);
  }
}
