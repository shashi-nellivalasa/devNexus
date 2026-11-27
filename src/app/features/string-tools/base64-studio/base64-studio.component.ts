import { Component, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { ToolHeaderComponent } from '../../../shared/components/tool-header/tool-header.component';
import { CodeEditorComponent } from '../../../shared/components/code-editor/code-editor.component';
import { NotificationService } from '../../../core/services/notification.service';

type StudioTab = 'text' | 'image';
type Direction = 'encode' | 'decode';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

@Component({
  selector: 'app-base64-studio',
  standalone: true,
  imports: [CommonModule, FormsModule, ToolHeaderComponent, CodeEditorComponent],
  template: `
    <div class="base64-studio p-3 d-flex flex-column flex-grow-1">
      <app-tool-header
        title="Base64 Studio — Text & Image"
        description="Encode and decode UTF-8 text and images to Base64 locally. Preview pictures, copy data URIs, and download decoded files."
        icon="bi-image"
        toolId="base64-studio"
        [showSampleBtn]="true"
        [showCopyBtn]="true"
        [copyContent]="activeCopyContent"
        [showDownloadBtn]="showHeaderDownload"
        [downloadContent]="headerDownloadContent"
        [downloadFilename]="headerDownloadFilename"
        (loadSample)="loadSample()"
        (clear)="clearAll()"
      ></app-tool-header>

      <div class="dn-card p-3 mb-3">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div class="btn-group btn-group-sm" role="group" aria-label="Content type">
            <button type="button" class="btn" [class.btn-accent]="studioTab === 'text'" (click)="setTab('text')">
              <i class="bi bi-fonts me-1"></i> Text
            </button>
            <button type="button" class="btn" [class.btn-accent]="studioTab === 'image'" (click)="setTab('image')">
              <i class="bi bi-image me-1"></i> Image
            </button>
          </div>

          <div class="btn-group btn-group-sm" role="group" aria-label="Direction">
            <button type="button" class="btn" [class.btn-accent]="direction === 'encode'" (click)="setDirection('encode')">
              To Base64
            </button>
            <button type="button" class="btn" [class.btn-accent]="direction === 'decode'" (click)="setDirection('decode')">
              From Base64
            </button>
          </div>

          @if (studioTab === 'image' && direction === 'encode') {
            <div class="form-check form-switch mb-0">
              <input class="form-check-input" type="checkbox" id="data-uri" [(ngModel)]="includeDataUri" (ngModelChange)="rebuildImageOutput()" />
              <label class="form-check-label small" for="data-uri">Include data URI prefix</label>
            </div>
          }
        </div>
        @if (errorMessage) {
          <div class="alert alert-danger small py-2 mt-3 mb-0">{{ errorMessage }}</div>
        }
      </div>

      @if (studioTab === 'text') {
        <div class="row g-3 flex-grow-1">
          <div class="col-lg-6 d-flex flex-column">
            <app-code-editor
              [title]="direction === 'encode' ? 'Plain text' : 'Base64 input'"
              language="text"
              [value]="textInput"
              (valueChange)="onTextInput($event)"
              placeholder="Type or paste text…"
              [fillHeight]="true"
            />
          </div>
          <div class="col-lg-6 d-flex flex-column">
            <app-code-editor
              [title]="direction === 'encode' ? 'Base64 output' : 'Decoded text'"
              language="text"
              [value]="textOutput"
              [readOnly]="true"
              [fillHeight]="true"
            />
          </div>
        </div>
      } @else if (direction === 'encode') {
        <div class="row g-3 flex-grow-1">
          <div class="col-lg-6 d-flex flex-column">
            <div class="dn-card p-3 flex-grow-1">
              <label class="form-label small fw-semibold" for="img-file">Upload image</label>
              <input
                id="img-file"
                type="file"
                class="form-control form-control-sm bg-dark-subtle border-secondary mb-2"
                accept="image/*"
                (change)="onImageFile($event)"
              />
              <p class="small text-secondary mb-3">PNG, JPEG, GIF, WebP, SVG — max {{ maxMb }} MB</p>

              @if (imagePreviewUrl) {
                <div class="image-preview-wrap rounded-3 border border-secondary border-opacity-25 p-2 bg-dark-subtle text-center">
                  <img [src]="imagePreviewUrl" alt="Preview" class="img-fluid rounded-2" style="max-height: 280px;" />
                  @if (imageMeta) {
                    <p class="small text-secondary mb-0 mt-2">{{ imageMeta }}</p>
                  }
                </div>
              }

              @if (sourceImageBlob) {
                <button type="button" class="btn btn-sm btn-accent mt-3" (click)="downloadImageFile()">
                  <i class="bi bi-file-image me-1"></i> Download original image
                </button>
              }
            </div>
          </div>
          <div class="col-lg-6 d-flex flex-column">
            <app-code-editor
              title="Base64 output"
              language="text"
              [value]="imageBase64Output"
              [readOnly]="true"
              [fillHeight]="true"
            />
          </div>
        </div>
      } @else {
        <div class="row g-3 flex-grow-1">
          <div class="col-lg-6 d-flex flex-column">
            <app-code-editor
              title="Base64 or data URI"
              language="text"
              [value]="imageBase64Input"
              (valueChange)="onImageBase64Input($event)"
              placeholder="Paste data:image/jpeg;base64,... or raw Base64"
              [fillHeight]="true"
            />
          </div>
          <div class="col-lg-6 d-flex flex-column">
            <div class="dn-card p-3 flex-grow-1 d-flex flex-column" style="min-height: 320px;">
              <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
                <h2 class="h6 fw-bold mb-0">Decoded image</h2>
                <button type="button" class="btn btn-sm btn-outline-secondary" (click)="decodeImageFromInput()">
                  Refresh preview
                </button>
              </div>

              @if (imagePreviewUrl) {
                <div class="image-preview-wrap flex-grow-1 rounded-3 border border-secondary border-opacity-25 p-3 bg-dark-subtle text-center d-flex flex-column justify-content-center">
                  <img [src]="imagePreviewUrl" alt="Decoded from Base64" class="img-fluid rounded-2 mx-auto" style="max-height: 400px;" />
                  @if (imageMeta) {
                    <p class="small text-secondary mb-0 mt-3">{{ imageMeta }}</p>
                  }
                </div>
              } @else {
                <div class="flex-grow-1 rounded-3 border border-secondary border-opacity-25 border-dashed d-flex align-items-center justify-content-center text-secondary small px-3 text-center">
                  Paste Base64 on the left — the image preview appears here automatically.
                </div>
              }

              <div class="d-flex flex-wrap gap-2 mt-3 pt-3 border-top border-secondary border-opacity-25">
                <button
                  type="button"
                  class="btn btn-sm btn-accent"
                  (click)="downloadImageFile()"
                  [disabled]="!imageDownloadBlob"
                >
                  <i class="bi bi-file-image me-1"></i> Download image
                </button>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-secondary"
                  (click)="downloadBase64File()"
                  [disabled]="!imageBase64Input.trim()"
                >
                  <i class="bi bi-file-earmark-text me-1"></i> Download Base64
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class Base64StudioComponent {
  private readonly notify = inject(NotificationService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  readonly maxMb = MAX_IMAGE_BYTES / (1024 * 1024);

  studioTab: StudioTab = 'text';
  direction: Direction = 'encode';
  errorMessage = '';

  textInput = '';
  textOutput = '';

  includeDataUri = true;
  imageBase64Input = '';
  imageBase64Output = '';
  imagePreviewUrl: SafeUrl | null = null;
  imageMeta = '';
  private rawImageBase64 = '';
  private imageMime = 'image/png';
  decodedImageBlob: Blob | null = null;
  sourceImageBlob: Blob | null = null;
  sourceImageFileName = 'image.png';
  private objectUrl: string | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.revokeObjectUrl());
  }

  get activeCopyContent(): string {
    if (this.studioTab === 'text') {
      return this.textOutput;
    }
    return this.direction === 'decode' ? this.imageBase64Input : this.imageBase64Output;
  }

  get imageDownloadBlob(): Blob | null {
    if (this.direction === 'encode') {
      return this.sourceImageBlob;
    }
    return this.decodedImageBlob;
  }

  get hasImageDownloads(): boolean {
    return !!this.imageDownloadBlob || !!this.imageBase64Output.trim();
  }

  get showHeaderDownload(): boolean {
    if (this.studioTab === 'text') {
      return !!this.textOutput;
    }
    return this.direction === 'decode' ? !!this.imageBase64Input.trim() : !!this.imageBase64Output;
  }

  get headerDownloadContent(): string {
    if (this.studioTab === 'text') {
      return this.textOutput;
    }
    return this.direction === 'decode' ? this.imageBase64Input : this.imageBase64Output;
  }

  get headerDownloadFilename(): string {
    if (this.studioTab === 'text') {
      return 'base64-output.txt';
    }
    return this.includeDataUri ? 'image-data-uri.txt' : 'image-base64.txt';
  }

  setTab(tab: StudioTab): void {
    this.studioTab = tab;
    this.errorMessage = '';
  }

  setDirection(dir: Direction): void {
    this.direction = dir;
    this.errorMessage = '';
    if (this.studioTab === 'text') {
      this.processText();
    }
  }

  onTextInput(value: string): void {
    this.textInput = value;
    this.processText();
  }

  processText(): void {
    this.errorMessage = '';
    if (!this.textInput.trim()) {
      this.textOutput = '';
      return;
    }
    try {
      if (this.direction === 'encode') {
        this.textOutput = this.encodeUtf8Base64(this.textInput);
      } else {
        this.textOutput = this.decodeUtf8Base64(this.textInput);
      }
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : 'Text conversion failed';
      this.textOutput = '';
    }
  }

  async onImageFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.errorMessage = 'Please choose an image file.';
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      this.errorMessage = `Image exceeds ${this.maxMb} MB limit.`;
      return;
    }
    this.errorMessage = '';
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    this.rawImageBase64 = this.uint8ToBase64(bytes);
    this.imageMime = file.type || 'application/octet-stream';
    this.sourceImageBlob = file;
    this.sourceImageFileName = file.name || `image.${this.mimeToExt(this.imageMime)}`;
    this.decodedImageBlob = null;
    this.setPreviewFromBlob(file);
    this.rebuildImageOutput();
    this.notify.success('Image encoded');
  }

  onImageBase64Input(value: string): void {
    this.imageBase64Input = value;
    this.decodeImageFromInput();
  }

  decodeImageFromInput(): void {
    this.errorMessage = '';
    const parsed = this.parseImageBase64(this.imageBase64Input.trim());
    if (!parsed) {
      if (this.imageBase64Input.trim()) {
        this.errorMessage = 'Invalid Base64 image data.';
      }
      return;
    }
    try {
      const bytes = this.base64ToUint8(parsed.base64);
      this.imageMime = parsed.mime;
      this.decodedImageBlob = new Blob([bytes], { type: parsed.mime });
      this.imageBase64Output = parsed.base64;
      this.setPreviewFromBlob(this.decodedImageBlob);
      this.imageMeta = `${parsed.mime} · ${this.formatBytes(bytes.length)}`;
    } catch {
      this.errorMessage = 'Could not decode image bytes.';
    }
  }

  rebuildImageOutput(): void {
    if (!this.rawImageBase64) return;
    this.imageBase64Output = this.includeDataUri
      ? `data:${this.imageMime};base64,${this.rawImageBase64}`
      : this.rawImageBase64;
  }

  downloadImageFile(): void {
    const blob = this.imageDownloadBlob;
    if (!blob) {
      this.notify.warning('No image available to download');
      return;
    }
    const filename =
      this.direction === 'encode' && this.sourceImageFileName
        ? this.sourceImageFileName
        : `decoded-image.${this.mimeToExt(this.imageMime)}`;
    this.triggerDownload(blob, filename);
    this.notify.success('Image download started');
  }

  downloadBase64File(): void {
    const content =
      this.direction === 'decode' ? this.imageBase64Input : this.imageBase64Output;
    if (!content.trim()) {
      this.notify.warning('No Base64 output to download');
      return;
    }
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    this.triggerDownload(blob, this.headerDownloadFilename);
    this.notify.success('Base64 file download started');
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  loadSample(): void {
    if (this.studioTab === 'text') {
      if (this.direction === 'encode') {
        this.textInput = 'Hello, DevNexus — UTF-8 text ↔ Base64';
      } else {
        this.textInput = 'SGVsbG8sIERldk5leHVzIOKAlCBVVEYtOCB0ZXh0IOKCrCBCYXNlNjQ=';
      }
      this.processText();
    } else {
      this.direction = 'decode';
      this.imageBase64Input =
        'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iNjAiPjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iNjAiIGZpbGw9IiMwMzA0MDciLz48dGV4dCB4PSI2MCIgeT0iMzgiIGZpbGw9IiNkNGZmMjQiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjE4Ij5EZXZOZXh1czwvdGV4dD48L3N2Zz4=';
      this.decodeImageFromInput();
    }
    this.notify.info('Sample loaded');
  }

  clearAll(): void {
    this.textInput = '';
    this.textOutput = '';
    this.imageBase64Input = '';
    this.imageBase64Output = '';
    this.rawImageBase64 = '';
    this.decodedImageBlob = null;
    this.sourceImageBlob = null;
    this.sourceImageFileName = 'image.png';
    this.imageMeta = '';
    this.errorMessage = '';
    this.revokeObjectUrl();
    this.imagePreviewUrl = null;
  }

  private encodeUtf8Base64(text: string): string {
    const bytes = new TextEncoder().encode(text);
    return this.uint8ToBase64(bytes);
  }

  private decodeUtf8Base64(input: string): string {
    const clean = input.replace(/\s+/g, '');
    const bytes = this.base64ToUint8(clean);
    return new TextDecoder().decode(bytes);
  }

  private uint8ToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToUint8(b64: string): Uint8Array {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  }

  private parseImageBase64(input: string): { mime: string; base64: string } | null {
    if (!input) return null;
    const dataUri = input.match(/^data:([^;]+);base64,(.+)$/i);
    if (dataUri) {
      return { mime: dataUri[1], base64: dataUri[2].replace(/\s+/g, '') };
    }
    const raw = input.replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/=]+$/.test(raw)) return null;
    return { mime: this.guessMimeFromBase64(raw), base64: raw };
  }

  private guessMimeFromBase64(b64: string): string {
    try {
      const head = atob(b64.slice(0, 24));
      if (head.startsWith('\x89PNG')) return 'image/png';
      if (head.startsWith('\xff\xd8\xff')) return 'image/jpeg';
      if (head.startsWith('GIF8')) return 'image/gif';
      if (head.trimStart().startsWith('<svg') || head.includes('<svg')) return 'image/svg+xml';
    } catch {
      // fall through
    }
    return 'image/png';
  }

  private setPreviewFromBlob(blob: Blob): void {
    this.revokeObjectUrl();
    this.objectUrl = URL.createObjectURL(blob);
    this.imagePreviewUrl = this.sanitizer.bypassSecurityTrustUrl(this.objectUrl);
    this.imageMeta = `${blob.type || 'image'} · ${this.formatBytes(blob.size)}`;
  }

  private revokeObjectUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  private formatBytes(n: number): string {
    if ( n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  }

  private mimeToExt(mime: string): string {
    const map: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg'
    };
    return map[mime] ?? 'bin';
  }
}