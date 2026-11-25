import { Component, DestroyRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ToolHeaderComponent } from '../../../shared/components/tool-header/tool-header.component';
import { CodeEditorComponent } from '../../../shared/components/code-editor/code-editor.component';
import { NotificationService } from '../../../core/services/notification.service';
import {
  ChunkFormatResult,
  ChunkLanguage,
  ResolvedChunkLanguage,
  formatChunk
} from '../../../shared/utils/chunk-formatter.util';

@Component({
  selector: 'app-chunk-formatter',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ToolHeaderComponent, CodeEditorComponent],
  template: `
    <div class="chunk-formatter-tool p-3">
      <app-tool-header
        title="Build Chunk Formatter (Prettifier)"
        description="Beautify minified Angular, Vite, or Webpack build chunks (JS, CSS, HTML, JSON) into readable indented source."
        icon="bi-file-earmark-code"
        badge="New"
        toolId="chunk-formatter"
        [showSampleBtn]="true"
        [showCopyBtn]="true"
        [copyContent]="outputCode"
        [showDownloadBtn]="true"
        [downloadContent]="outputCode"
        [downloadFilename]="downloadFilename"
        (loadSample)="loadSampleChunk()"
        (clear)="clearAll()"
      ></app-tool-header>

      <!-- Reactive Form Configuration & File Upload Bar -->
      <form [formGroup]="form" (ngSubmit)="format()" class="dn-card p-3 mb-3">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div class="d-flex flex-wrap align-items-center gap-3">
            <!-- Language Selector -->
            <div class="d-flex align-items-center gap-2">
              <label class="form-label small text-secondary mb-0">Type:</label>
              <select class="form-select form-select-sm w-auto" formControlName="language">
                <option value="auto">Auto-Detect</option>
                <option value="javascript">JavaScript / Chunk (.js)</option>
                <option value="css">Stylesheet (.css)</option>
                <option value="html">HTML (.html)</option>
                <option value="json">JSON (.json)</option>
              </select>
            </div>

            <!-- Indentation -->
            <div class="d-flex align-items-center gap-2">
              <label class="form-label small text-secondary mb-0">Indent:</label>
              <select class="form-select form-select-sm w-auto" formControlName="indentSize">
                <option [ngValue]="2">2 Spaces</option>
                <option [ngValue]="4">4 Spaces</option>
              </select>
            </div>

            <!-- Upload Chunk File -->
            <input
              #fileInput
              type="file"
              class="d-none"
              accept=".js,.mjs,.cjs,.css,.html,.json,.txt"
              (change)="onFileSelected($event)"
            />
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
              (click)="fileInput.click()"
              title="Load a chunk-*.js, main-*.js, or styles-*.css file from disk"
            >
              <i class="bi bi-upload"></i>
              <span>{{ loadedFileName || 'Load Chunk File' }}</span>
            </button>
          </div>

          <!-- Stats & Format CTA -->
          <div class="d-flex flex-wrap align-items-center gap-2">
            @if (lastResult && outputCode) {
              <div class="d-flex align-items-center gap-2 small font-mono">
                <span class="badge bg-secondary-subtle text-info text-uppercase">
                  {{ lastResult.detectedLanguage }}
                </span>
                <span class="badge bg-secondary-subtle text-secondary">
                  {{ lastResult.originalLines }} &rarr; {{ lastResult.formattedLines }} lines
                </span>
                <span class="badge bg-secondary-subtle text-secondary">
                  {{ formatBytes(lastResult.originalBytes) }} &rarr; {{ formatBytes(lastResult.formattedBytes) }}
                </span>
              </div>
            }

            <button type="submit" class="btn btn-sm btn-accent d-flex align-items-center gap-1">
              <i class="bi bi-magic"></i>
              <span>Prettify Chunk</span>
            </button>
          </div>
        </div>

        @if (errorMessage) {
          <div class="alert alert-danger py-2 px-3 mt-3 mb-0 small d-flex align-items-center gap-2">
            <i class="bi bi-exclamation-triangle-fill"></i>
            <span>{{ errorMessage }}</span>
          </div>
        }
      </form>

      <!-- Side-by-Side Input & Output Editors -->
      <div class="row g-3">
        <div class="col-lg-6">
          <app-code-editor
            title="Minified Chunk Input"
            [language]="editorLanguage"
            [value]="inputCode"
            (valueChange)="onInputChange($event)"
            placeholder="Paste minified chunk-*.js / styles-*.css here, or click 'Load Chunk File'..."
            height="500px"
          ></app-code-editor>
        </div>

        <div class="col-lg-6">
          <app-code-editor
            title="Prettified Output"
            [language]="editorLanguage"
            [value]="outputCode"
            [readOnly]="true"
            placeholder="Formatted, readable output will appear here..."
            height="500px"
          ></app-code-editor>
        </div>
      </div>
    </div>
  `
})
export class ChunkFormatterComponent implements OnInit {
  private fb = inject(FormBuilder);
  private notifyService = inject(NotificationService);
  private destroyRef = inject(DestroyRef);

  @ViewChild('fileInput') fileInputRef?: ElementRef<HTMLInputElement>;

  public form!: FormGroup;
  public inputCode = '';
  public outputCode = '';
  public loadedFileName = '';
  public errorMessage = '';
  public lastResult: ChunkFormatResult | null = null;
  public activeLanguage: ResolvedChunkLanguage = 'javascript';

  get editorLanguage(): string {
    return this.activeLanguage;
  }

  get downloadFilename(): string {
    const extMap: Record<ResolvedChunkLanguage, string> = {
      javascript: 'js',
      css: 'css',
      html: 'html',
      json: 'json'
    };
    const ext = extMap[this.activeLanguage] || 'txt';
    if (this.loadedFileName) {
      const base = this.loadedFileName.replace(/\.[^.]+$/, '');
      return `${base}.formatted.${ext}`;
    }
    return `formatted-chunk.${ext}`;
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      language: ['auto' as ChunkLanguage],
      indentSize: [2]
    });

    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.inputCode.trim()) {
          this.format();
        }
      });

    this.loadSampleChunk();
  }

  onInputChange(val: string): void {
    this.inputCode = val;
    if (!val.trim()) {
      this.outputCode = '';
      this.lastResult = null;
      this.errorMessage = '';
      return;
    }
    this.format();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.loadedFileName = file.name;
    const inferred = this.inferLanguageFromFilename(file.name);
    if (inferred) {
      this.form.patchValue({ language: inferred }, { emitEvent: false });
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.inputCode = typeof reader.result === 'string' ? reader.result : '';
      this.format();
      this.notifyService.success(`Loaded ${file.name}`);
    };
    reader.onerror = () => {
      this.notifyService.error('Failed to read selected file');
    };
    reader.readAsText(file);
    input.value = '';
  }

  format(): void {
    this.errorMessage = '';
    if (!this.inputCode.trim()) {
      this.outputCode = '';
      this.lastResult = null;
      return;
    }

    try {
      const { language, indentSize } = this.form.value;
      const result = formatChunk(this.inputCode, {
        language: language || 'auto',
        indentSize: Number(indentSize) || 2
      });
      this.outputCode = result.formatted;
      this.lastResult = result;
      this.activeLanguage = result.detectedLanguage;
    } catch (err: any) {
      this.errorMessage = err?.message || 'Unable to format input chunk';
    }
  }

  loadSampleChunk(): void {
    this.loadedFileName = '';
    this.form.patchValue({ language: 'auto', indentSize: 2 }, { emitEvent: false });
    this.inputCode =
      `import{a as e,b as t}from"./chunk-AWGTDUQY.js";var n=(()=>{class r{constructor(o){this.data=o}format(o){if(!o)return"";return o.trim().replace(/\\s+/g," ")}static ɵfac=function(o){return new(o||r)(e(t))};static ɵprov=e({token:r,factory:r.ɵfac,providedIn:"root"})}return r})();export{n as ChunkHelper};`;
    this.format();
  }

  clearAll(): void {
    this.inputCode = '';
    this.outputCode = '';
    this.loadedFileName = '';
    this.errorMessage = '';
    this.lastResult = null;
    if (this.fileInputRef?.nativeElement) {
      this.fileInputRef.nativeElement.value = '';
    }
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  private inferLanguageFromFilename(name: string): ChunkLanguage | null {
    const lower = name.toLowerCase();
    if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) return 'javascript';
    if (lower.endsWith('.css')) return 'css';
    if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
    if (lower.endsWith('.json')) return 'json';
    return null;
  }
}
