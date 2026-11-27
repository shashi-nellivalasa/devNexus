import { Component, DestroyRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ToolHeaderComponent } from '../../../shared/components/tool-header/tool-header.component';
import { CodeEditorComponent, EditorMarker } from '../../../shared/components/code-editor/code-editor.component';
import { NotificationService } from '../../../core/services/notification.service';
import {
  ChunkFormatResult,
  ChunkLanguage,
  ChunkTransformMode,
  ChunkValidationError,
  ChunkValidationResult,
  ResolvedChunkLanguage,
  processChunk,
  validateChunkSyntax
} from '../../../shared/utils/chunk-formatter.util';

@Component({
  selector: 'app-chunk-formatter',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ToolHeaderComponent, CodeEditorComponent],
  template: `
    <div class="chunk-formatter-tool p-3 d-flex flex-column flex-grow-1">
      <app-tool-header
        title="Build Chunk Formatter & Minifier"
        description="Prettify, edit, validate syntax, and minify Angular, Vite, or Webpack build chunks (JS, CSS, HTML, JSON)."
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

      <!-- Reactive Form Configuration, Mode Toggle & File Upload Bar -->
      <form [formGroup]="form" (ngSubmit)="transform()" class="dn-card p-3 mb-3">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div class="d-flex flex-wrap align-items-center gap-3">
            <!-- Mode Segmented Toggle -->
            <div class="btn-group btn-group-sm" role="group" aria-label="Transform mode">
              <button
                type="button"
                class="btn"
                [ngClass]="currentMode === 'prettify' ? 'btn-accent' : 'btn-outline-secondary'"
                (click)="setMode('prettify')"
              >
                <i class="bi bi-magic me-1"></i> Prettify
              </button>
              <button
                type="button"
                class="btn"
                [ngClass]="currentMode === 'minify' ? 'btn-accent' : 'btn-outline-secondary'"
                (click)="setMode('minify')"
              >
                <i class="bi bi-arrows-collapse me-1"></i> Minify
              </button>
            </div>

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

            <!-- Indentation (when prettifying) -->
            @if (currentMode === 'prettify') {
              <div class="d-flex align-items-center gap-2">
                <label class="form-label small text-secondary mb-0">Indent:</label>
                <select class="form-select form-select-sm w-auto" formControlName="indentSize">
                  <option [ngValue]="2">2 Spaces</option>
                  <option [ngValue]="4">4 Spaces</option>
                </select>
              </div>
            }

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

            @if (outputCode) {
              <button
                type="button"
                class="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                (click)="applyOutputToInput()"
                title="Move edited output back to input so you can re-prettify or minify it"
              >
                <i class="bi bi-arrow-left"></i>
                <span>Use Output as Input</span>
              </button>
            }
          </div>

          <!-- Stats & Primary Action -->
          <div class="d-flex flex-wrap align-items-center gap-2">
            @if (outputCode) {
              <div class="d-flex align-items-center gap-2 small font-mono">
                <span class="badge bg-secondary-subtle text-info text-uppercase">
                  {{ activeLanguage }}
                </span>
                <span class="badge bg-secondary-subtle text-secondary">
                  {{ inputLineCount }} &rarr; {{ outputLineCount }} lines
                </span>
                <span class="badge bg-secondary-subtle text-secondary">
                  {{ formatBytes(inputBytes) }} &rarr; {{ formatBytes(outputBytes) }}
                </span>
                @if (currentMode === 'minify' && savingsPercent > 0) {
                  <span class="badge bg-success-subtle text-success">-{{ savingsPercent }}% Saved</span>
                }
              </div>
            }

            <button type="submit" class="btn btn-sm btn-accent d-flex align-items-center gap-1">
              <i class="bi" [ngClass]="currentMode === 'minify' ? 'bi-arrows-collapse' : 'bi-magic'"></i>
              <span>{{ currentMode === 'minify' ? 'Minify Chunk' : 'Prettify Chunk' }}</span>
            </button>
          </div>
        </div>

        <!-- Language Syntax Validation Status Strip -->
        @if (inputCode.trim() || outputCode.trim()) {
          <div class="mt-3 pt-2 border-top border-secondary border-opacity-25 d-flex flex-wrap align-items-center justify-content-between gap-2 small">
            <div class="d-flex flex-wrap align-items-center gap-3">
              @if (inputCode.trim()) {
                @if (inputValidation?.valid) {
                  <span class="text-success d-inline-flex align-items-center gap-1 fw-medium">
                    <i class="bi bi-check-circle-fill"></i>
                    <span>Input: Valid {{ activeLanguage.toUpperCase() }}</span>
                  </span>
                } @else if (inputValidation && inputValidation.errors.length > 0) {
                  <span class="text-danger d-inline-flex align-items-center gap-1 fw-medium">
                    <i class="bi bi-x-circle-fill"></i>
                    <span>Input Error ({{ activeLanguage.toUpperCase() }})</span>
                  </span>
                }
              }

              @if (outputCode.trim()) {
                @if (outputValidation?.valid) {
                  <span class="text-success d-inline-flex align-items-center gap-1 fw-medium">
                    <i class="bi bi-check-circle-fill"></i>
                    <span>Output: Valid {{ activeLanguage.toUpperCase() }}</span>
                  </span>
                } @else if (outputValidation && outputValidation.errors.length > 0) {
                  <span class="text-danger d-inline-flex align-items-center gap-1 fw-medium">
                    <i class="bi bi-x-circle-fill"></i>
                    <span>Output Error ({{ activeLanguage.toUpperCase() }})</span>
                  </span>
                }
              }
            </div>

            @if (hasManualOutputEdits) {
              <span class="badge bg-warning-subtle text-warning border border-warning border-opacity-25">
                Output edited manually
              </span>
            }
          </div>
        }

        <!-- Detailed Language Validation Errors -->
        @if (allErrors.length > 0) {
          <div class="alert alert-danger py-2 px-3 mt-2 mb-0 small d-flex flex-column gap-1">
            @for (err of allErrors; track $index) {
              <div class="d-flex align-items-start gap-2">
                <i class="bi bi-exclamation-triangle-fill mt-0.5 flex-shrink-0"></i>
                <div>
                  <span class="fw-bold">{{ err.source }} ({{ activeLanguage.toUpperCase() }}):</span>
                  <span class="ms-1">{{ err.detail.message }}</span>
                  <span class="font-mono ms-2 opacity-75">
                    [Line {{ err.detail.line }}, Col {{ err.detail.column }}]
                  </span>
                </div>
              </div>
            }
          </div>
        }
      </form>

      <!-- Side-by-Side Input & Editable Output Editors -->
      <div class="row g-3 flex-grow-1">
        <div class="col-lg-6 d-flex flex-column">
          <app-code-editor
            title="Source Chunk Input"
            [language]="editorLanguage"
            [value]="inputCode"
            [markers]="inputMarkers"
            (valueChange)="onInputChange($event)"
            placeholder="Paste minified chunk-*.js / styles-*.css here, or click 'Load Chunk File'..."
            [fillHeight]="true"
          ></app-code-editor>
        </div>

        <div class="col-lg-6 d-flex flex-column">
          <app-code-editor
            [title]="currentMode === 'minify' ? 'Minified Output (Editable)' : 'Prettified Output (Editable)'"
            [language]="editorLanguage"
            [value]="outputCode"
            [readOnly]="false"
            [markers]="outputMarkers"
            (valueChange)="onOutputChange($event)"
            placeholder="Formatted or minified output will appear here (editable)..."
            [fillHeight]="true"
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
  public hasManualOutputEdits = false;
  public lastResult: ChunkFormatResult | null = null;
  public activeLanguage: ResolvedChunkLanguage = 'javascript';
  public inputValidation: ChunkValidationResult | null = null;
  public outputValidation: ChunkValidationResult | null = null;
  public inputMarkers: EditorMarker[] = [];
  public outputMarkers: EditorMarker[] = [];

  get currentMode(): ChunkTransformMode {
    return (this.form?.value?.mode as ChunkTransformMode) || 'prettify';
  }

  get editorLanguage(): string {
    return this.activeLanguage;
  }

  get inputLineCount(): number {
    return this.inputCode ? this.inputCode.split(/\r?\n/).length : 0;
  }

  get outputLineCount(): number {
    return this.outputCode ? this.outputCode.split(/\r?\n/).length : 0;
  }

  get inputBytes(): number {
    return this.inputCode ? new TextEncoder().encode(this.inputCode).length : 0;
  }

  get outputBytes(): number {
    return this.outputCode ? new TextEncoder().encode(this.outputCode).length : 0;
  }

  get savingsPercent(): number {
    if (this.currentMode !== 'minify' || this.inputBytes <= 0) return 0;
    return Math.max(0, Math.round(((this.inputBytes - this.outputBytes) / this.inputBytes) * 100));
  }

  get allErrors(): { source: 'Input' | 'Output'; detail: ChunkValidationError }[] {
    const list: { source: 'Input' | 'Output'; detail: ChunkValidationError }[] = [];
    for (const detail of this.inputValidation?.errors || []) {
      list.push({ source: 'Input', detail });
    }
    for (const detail of this.outputValidation?.errors || []) {
      list.push({ source: 'Output', detail });
    }
    return list;
  }

  get downloadFilename(): string {
    const extMap: Record<ResolvedChunkLanguage, string> = {
      javascript: 'js',
      css: 'css',
      html: 'html',
      json: 'json'
    };
    const ext = extMap[this.activeLanguage] || 'txt';
    const suffix = this.currentMode === 'minify' ? 'min' : 'formatted';
    if (this.loadedFileName) {
      const base = this.loadedFileName.replace(/\.[^.]+$/, '');
      return `${base}.${suffix}.${ext}`;
    }
    return `chunk.${suffix}.${ext}`;
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      language: ['auto' as ChunkLanguage],
      mode: ['prettify' as ChunkTransformMode],
      indentSize: [2]
    });

    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.inputCode.trim()) {
          this.transform();
        } else if (this.outputCode.trim()) {
          this.validateOutputOnly();
        }
      });

    this.loadSampleChunk();
  }

  setMode(mode: ChunkTransformMode): void {
    if (this.currentMode === mode) return;
    this.form.patchValue({ mode });
  }

  onInputChange(val: string): void {
    this.inputCode = val;
    if (!val.trim()) {
      this.outputCode = '';
      this.hasManualOutputEdits = false;
      this.lastResult = null;
      this.inputValidation = null;
      this.outputValidation = null;
      this.inputMarkers = [];
      this.outputMarkers = [];
      return;
    }
    this.transform();
  }

  onOutputChange(val: string): void {
    this.outputCode = val;
    this.hasManualOutputEdits = true;
    this.validateOutputOnly();
  }

  applyOutputToInput(): void {
    if (!this.outputCode.trim()) return;
    this.inputCode = this.outputCode;
    this.hasManualOutputEdits = false;
    this.transform();
    this.notifyService.info('Moved output into input');
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
      this.transform();
      this.notifyService.success(`Loaded ${file.name}`);
    };
    reader.onerror = () => {
      this.notifyService.error('Failed to read selected file');
    };
    reader.readAsText(file);
    input.value = '';
  }

  transform(): void {
    if (!this.inputCode.trim()) {
      this.outputCode = '';
      this.hasManualOutputEdits = false;
      this.lastResult = null;
      this.inputValidation = null;
      this.outputValidation = null;
      this.inputMarkers = [];
      this.outputMarkers = [];
      return;
    }

    const language = (this.form.value.language || 'auto') as ChunkLanguage;
    const indentSize = Number(this.form.value.indentSize) || 2;
    const mode = this.currentMode;

    // Validate input syntax for the resolved language
    this.inputValidation = validateChunkSyntax(this.inputCode, language);
    this.activeLanguage = this.inputValidation.language;
    this.inputMarkers = this.toMarkers(this.inputValidation.errors);

    try {
      const result = processChunk(this.inputCode, { language, indentSize, mode });
      this.outputCode = result.output;
      this.hasManualOutputEdits = false;
      this.lastResult = result;
      this.activeLanguage = result.detectedLanguage;
      this.validateOutputOnly();
    } catch {
      // JSON.parse throws on invalid JSON; validation banner already captures line & col
      this.lastResult = null;
    }
  }

  private validateOutputOnly(): void {
    if (!this.outputCode.trim()) {
      this.outputValidation = null;
      this.outputMarkers = [];
      return;
    }
    const language = (this.form.value.language || 'auto') as ChunkLanguage;
    const targetLang: ChunkLanguage =
      language === 'auto' && this.inputCode.trim() ? this.activeLanguage : language;
    this.outputValidation = validateChunkSyntax(this.outputCode, targetLang);
    if (!this.inputCode.trim()) {
      this.activeLanguage = this.outputValidation.language;
    }
    this.outputMarkers = this.toMarkers(this.outputValidation.errors);
  }

  private toMarkers(errors: ChunkValidationError[]): EditorMarker[] {
    return errors.map(e => ({
      message: e.message,
      line: e.line,
      column: e.column,
      endLine: e.endLine,
      endColumn: e.endColumn,
      severity: 'error'
    }));
  }

  loadSampleChunk(): void {
    this.loadedFileName = '';
    this.form.patchValue({ language: 'auto', mode: 'prettify', indentSize: 2 }, { emitEvent: false });
    this.inputCode =
      `import{a as e,b as t}from"./chunk-AWGTDUQY.js";var n=(()=>{class r{constructor(o){this.data=o}format(o){if(!o)return"";return o.trim().replace(/\\s+/g," ")}static ɵfac=function(o){return new(o||r)(e(t))};static ɵprov=e({token:r,factory:r.ɵfac,providedIn:"root"})}return r})();export{n as ChunkHelper};`;
    this.transform();
  }

  clearAll(): void {
    this.inputCode = '';
    this.outputCode = '';
    this.loadedFileName = '';
    this.hasManualOutputEdits = false;
    this.lastResult = null;
    this.inputValidation = null;
    this.outputValidation = null;
    this.inputMarkers = [];
    this.outputMarkers = [];
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
