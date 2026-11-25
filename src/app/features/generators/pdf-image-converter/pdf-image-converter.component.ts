import { Component, DestroyRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToolHeaderComponent } from '../../../shared/components/tool-header/tool-header.component';
import { NotificationService } from '../../../core/services/notification.service';
import {
  buildPdfFromJpegImages,
  formatBytes,
  parsePageRange,
  PdfImageInput,
  PdfOrientation,
  PdfOutputImageFormat,
  PdfPageSize,
  RenderedPdfPage
} from '../../../shared/utils/pdf-image.util';

interface UploadedImageItem {
  id: string;
  name: string;
  sizeBytes: number;
  widthPx: number;
  heightPx: number;
  previewUrl: string;
  jpegBytes: Uint8Array;
}

@Component({
  selector: 'app-pdf-image-converter',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ToolHeaderComponent],
  template: `
    <div class="pdf-image-converter p-3">
      <app-tool-header
        title="PDF ↔ Image Converter"
        description="Convert PDF pages into PNG, JPEG, or WebP images (individual or ZIP download), or combine multiple images into a downloadable PDF locally in your browser."
        icon="bi-file-earmark-pdf"
        badge="New"
        toolId="pdf-image-converter"
        [showSampleBtn]="true"
        [showCopyBtn]="false"
        (loadSample)="loadSampleForCurrentMode()"
        (clear)="clearCurrentMode()"
      ></app-tool-header>

      <!-- Mode Switcher -->
      <div class="dn-card p-2 mb-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div class="btn-group btn-group-sm" role="group" aria-label="Converter mode">
          <button
            type="button"
            class="btn"
            [class.btn-primary]="mode === 'pdf-to-image'"
            [class.btn-outline-secondary]="mode !== 'pdf-to-image'"
            (click)="mode = 'pdf-to-image'"
          >
            <i class="bi bi-file-earmark-pdf me-1"></i> PDF → Image
          </button>
          <button
            type="button"
            class="btn"
            [class.btn-primary]="mode === 'image-to-pdf'"
            [class.btn-outline-secondary]="mode !== 'image-to-pdf'"
            (click)="mode = 'image-to-pdf'"
          >
            <i class="bi bi-images me-1"></i> Image → PDF
          </button>
        </div>

        <span class="text-secondary small">
          <i class="bi bi-shield-check text-success me-1"></i>
          100% client-side conversion — files never leave your browser.
        </span>
      </div>

      <!-- MODE 1: PDF -> IMAGE -->
      @if (mode === 'pdf-to-image') {
        <div class="row g-3">
          <div class="col-lg-4">
            <div class="dn-card p-3 h-100">
              <h6 class="fw-bold small text-uppercase text-secondary mb-3">1. Upload PDF &amp; Options</h6>

              <!-- Dropzone -->
              <label
                class="dropzone-box d-flex flex-column align-items-center justify-content-center text-center p-4 rounded border border-2 border-dashed mb-3 cursor-pointer"
                [class.border-primary]="isDraggingPdf"
                [class.border-secondary]="!isDraggingPdf"
                (dragover)="onDragOver($event, 'pdf')"
                (dragleave)="isDraggingPdf = false"
                (drop)="onDrop($event, 'pdf')"
              >
                <i class="bi bi-cloud-arrow-up fs-2 text-primary mb-2"></i>
                <span class="small fw-semibold">Drop a PDF file here or click to browse</span>
                <span class="text-secondary" style="font-size: 0.75rem;">Supports multi-page .pdf files</span>
                <input type="file" accept="application/pdf,.pdf" class="d-none" (change)="onPdfFileSelected($event)" />
              </label>

              @if (loadedPdfName) {
                <div class="alert alert-secondary py-2 px-3 small d-flex align-items-center justify-content-between mb-3">
                  <div class="text-truncate me-2">
                    <i class="bi bi-file-earmark-pdf-fill text-danger me-1"></i>
                    <strong>{{ loadedPdfName }}</strong>
                    <div class="text-secondary" style="font-size: 0.75rem;">
                      {{ loadedPdfPageCount }} page(s) • {{ formatSize(loadedPdfSizeBytes) }}
                    </div>
                  </div>
                </div>
              }

              <form [formGroup]="pdfToImgForm" class="d-flex flex-column gap-3">
                <div>
                  <label class="form-label small text-secondary mb-1">Output Image Format</label>
                  <select class="form-select form-select-sm" formControlName="format">
                    <option value="image/png">PNG (Lossless)</option>
                    <option value="image/jpeg">JPEG (Smaller size)</option>
                    <option value="image/webp">WebP (Modern)</option>
                  </select>
                </div>

                <div>
                  <label class="form-label small text-secondary mb-1">Render Scale (DPI)</label>
                  <select class="form-select form-select-sm" formControlName="scale">
                    <option [ngValue]="1">1x (72 DPI — Fast)</option>
                    <option [ngValue]="1.5">1.5x (108 DPI)</option>
                    <option [ngValue]="2">2x (144 DPI — Sharp)</option>
                    <option [ngValue]="3">3x (216 DPI — Print)</option>
                  </select>
                </div>

                @if (pdfToImgForm.get('format')?.value !== 'image/png') {
                  <div>
                    <label class="form-label small text-secondary mb-1 d-flex justify-content-between">
                      <span>Image Quality</span>
                      <span class="font-mono">{{ Math.round((pdfToImgForm.get('quality')?.value || 0.92) * 100) }}%</span>
                    </label>
                    <input type="range" class="form-range" min="0.5" max="1" step="0.02" formControlName="quality" />
                  </div>
                }

                <div>
                  <label class="form-label small text-secondary mb-1">Page Range</label>
                  <input
                    type="text"
                    class="form-control form-control-sm font-mono"
                    formControlName="pageRange"
                    placeholder="all (or e.g. 1-3, 5)"
                  />
                </div>

                <button
                  type="button"
                  class="btn btn-primary btn-sm fw-semibold"
                  [disabled]="!loadedPdfBuffer || isConvertingPdf"
                  (click)="convertPdfToImages()"
                >
                  @if (isConvertingPdf) {
                    <span class="spinner-border spinner-border-sm me-1"></span>
                    Rendering {{ pdfProgressCurrent }}/{{ pdfProgressTotal }}...
                  } @else {
                    <i class="bi bi-magic me-1"></i> Convert PDF to Images
                  }
                </button>
              </form>
            </div>
          </div>

          <div class="col-lg-8">
            <div class="dn-card p-3 h-100">
              <div class="d-flex flex-wrap align-items-center justify-content-between border-bottom border-secondary border-opacity-25 pb-2 mb-3 gap-2">
                <span class="fw-bold small">
                  <i class="bi bi-images text-info me-1"></i>
                  Rendered Pages ({{ renderedPages.length }})
                </span>
                @if (renderedPages.length > 0) {
                  <button type="button" class="btn btn-sm btn-success" (click)="downloadAllAsZip()" [disabled]="isZipping">
                    @if (isZipping) {
                      <span class="spinner-border spinner-border-sm me-1"></span> Packaging ZIP...
                    } @else {
                      <i class="bi bi-file-earmark-zip me-1"></i> Download All (.zip)
                    }
                  </button>
                }
              </div>

              @if (renderedPages.length > 0) {
                <div class="row g-3">
                  @for (page of renderedPages; track page.pageNumber) {
                    <div class="col-md-6 col-xl-4">
                      <div class="border border-secondary border-opacity-25 rounded p-2 h-100 d-flex flex-column">
                        <div class="bg-dark bg-opacity-25 rounded d-flex align-items-center justify-content-center mb-2 overflow-hidden" style="height: 200px;">
                          <img [src]="page.dataUrl" [alt]="'Page ' + page.pageNumber" class="img-fluid mh-100 object-fit-contain" />
                        </div>
                        <div class="d-flex align-items-center justify-content-between small mb-2">
                          <span class="fw-semibold">Page {{ page.pageNumber }}</span>
                          <span class="text-secondary font-mono" style="font-size: 0.72rem;">
                            {{ page.widthPx }}×{{ page.heightPx }} • {{ formatSize(page.sizeBytes) }}
                          </span>
                        </div>
                        <button type="button" class="btn btn-sm btn-outline-primary mt-auto w-100" (click)="downloadRenderedPage(page)">
                          <i class="bi bi-download me-1"></i> Download
                        </button>
                      </div>
                    </div>
                  }
                </div>
              } @else {
                <div class="text-center text-secondary py-5">
                  <i class="bi bi-file-earmark-image fs-1 opacity-50 d-block mb-2"></i>
                  <p class="small mb-0">Upload a PDF or click <strong>Sample</strong> in the header, then click <strong>Convert PDF to Images</strong>.</p>
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- MODE 2: IMAGE -> PDF -->
      @if (mode === 'image-to-pdf') {
        <div class="row g-3">
          <div class="col-lg-4">
            <div class="dn-card p-3 h-100">
              <h6 class="fw-bold small text-uppercase text-secondary mb-3">1. Upload Images &amp; PDF Layout</h6>

              <label
                class="dropzone-box d-flex flex-column align-items-center justify-content-center text-center p-4 rounded border border-2 border-dashed mb-3 cursor-pointer"
                [class.border-primary]="isDraggingImages"
                [class.border-secondary]="!isDraggingImages"
                (dragover)="onDragOver($event, 'image')"
                (dragleave)="isDraggingImages = false"
                (drop)="onDrop($event, 'image')"
              >
                <i class="bi bi-images fs-2 text-primary mb-2"></i>
                <span class="small fw-semibold">Drop images here or click to add</span>
                <span class="text-secondary" style="font-size: 0.75rem;">PNG, JPEG, WebP, GIF, BMP, SVG</span>
                <input type="file" accept="image/*" multiple class="d-none" (change)="onImagesSelected($event)" />
              </label>

              <form [formGroup]="imgToPdfForm" class="d-flex flex-column gap-3">
                <div>
                  <label class="form-label small text-secondary mb-1">Page Size</label>
                  <select class="form-select form-select-sm" formControlName="pageSize">
                    <option value="a4">A4 (595 × 842 pt)</option>
                    <option value="letter">US Letter (612 × 792 pt)</option>
                    <option value="fit">Fit to Image Dimensions</option>
                  </select>
                </div>

                @if (imgToPdfForm.get('pageSize')?.value !== 'fit') {
                  <div>
                    <label class="form-label small text-secondary mb-1">Orientation</label>
                    <select class="form-select form-select-sm" formControlName="orientation">
                      <option value="auto">Auto (Match each image)</option>
                      <option value="portrait">Portrait</option>
                      <option value="landscape">Landscape</option>
                    </select>
                  </div>
                }

                <div>
                  <label class="form-label small text-secondary mb-1">Page Margin</label>
                  <select class="form-select form-select-sm" formControlName="marginPt">
                    <option [ngValue]="0">None (0 pt)</option>
                    <option [ngValue]="16">Narrow (16 pt)</option>
                    <option [ngValue]="24">Standard (24 pt)</option>
                    <option [ngValue]="40">Wide (40 pt)</option>
                  </select>
                </div>

                <div>
                  <label class="form-label small text-secondary mb-1">Output Filename</label>
                  <input type="text" class="form-control form-control-sm font-mono" formControlName="filename" />
                </div>

                <button
                  type="button"
                  class="btn btn-primary btn-sm fw-semibold"
                  [disabled]="uploadedImages.length === 0 || isBuildingPdf"
                  (click)="convertImagesToPdfAndDownload()"
                >
                  @if (isBuildingPdf) {
                    <span class="spinner-border spinner-border-sm me-1"></span> Generating PDF...
                  } @else {
                    <i class="bi bi-file-earmark-arrow-down me-1"></i> Convert &amp; Download PDF
                  }
                </button>
              </form>
            </div>
          </div>

          <div class="col-lg-8">
            <div class="dn-card p-3 h-100">
              <div class="d-flex flex-wrap align-items-center justify-content-between border-bottom border-secondary border-opacity-25 pb-2 mb-3 gap-2">
                <span class="fw-bold small">
                  <i class="bi bi-layers text-info me-1"></i>
                  Image Queue ({{ uploadedImages.length }} page{{ uploadedImages.length === 1 ? '' : 's' }})
                </span>
                @if (generatedPdfUrl) {
                  <button type="button" class="btn btn-sm btn-success" (click)="triggerGeneratedPdfDownload()">
                    <i class="bi bi-download me-1"></i> Download PDF ({{ formatSize(generatedPdfSizeBytes) }})
                  </button>
                }
              </div>

              @if (uploadedImages.length > 0) {
                <div class="d-flex flex-column gap-2">
                  @for (img of uploadedImages; track img.id; let i = $index; let last = $last) {
                    <div class="d-flex align-items-center gap-3 p-2 rounded border border-secondary border-opacity-25 bg-dark bg-opacity-25">
                      <span class="badge bg-secondary-subtle text-secondary font-mono">#{{ i + 1 }}</span>
                      <img [src]="img.previewUrl" [alt]="img.name" class="rounded border border-secondary border-opacity-25" style="width: 56px; height: 56px; object-fit: cover;" />
                      <div class="flex-grow-1 overflow-hidden">
                        <div class="small fw-semibold text-truncate">{{ img.name }}</div>
                        <div class="text-secondary font-mono" style="font-size: 0.75rem;">
                          {{ img.widthPx }}×{{ img.heightPx }} px • {{ formatSize(img.sizeBytes) }}
                        </div>
                      </div>
                      <div class="d-flex align-items-center gap-1">
                        <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="i === 0" (click)="moveImage(i, -1)" title="Move Up">
                          <i class="bi bi-arrow-up"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="last" (click)="moveImage(i, 1)" title="Move Down">
                          <i class="bi bi-arrow-down"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-danger" (click)="removeImage(i)" title="Remove">
                          <i class="bi bi-trash"></i>
                        </button>
                      </div>
                    </div>
                  }
                </div>
              } @else {
                <div class="text-center text-secondary py-5">
                  <i class="bi bi-images fs-1 opacity-50 d-block mb-2"></i>
                  <p class="small mb-0">Add one or more images (or click <strong>Sample</strong> in the header) to build a multi-page PDF.</p>
                </div>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .cursor-pointer { cursor: pointer; }
    .border-dashed { border-style: dashed !important; }
    .dropzone-box:hover {
      border-color: var(--bs-primary) !important;
      background-color: rgba(var(--bs-primary-rgb), 0.05);
    }
  `]
})
export class PdfImageConverterComponent implements OnInit {
  constructor(
    private fb: FormBuilder,
    private notifyService: NotificationService,
    private destroyRef: DestroyRef
  ) {
    this.destroyRef.onDestroy(() => {
      if (this.generatedPdfUrl) {
        URL.revokeObjectURL(this.generatedPdfUrl);
      }
    });
  }

  public Math = Math;
  public mode: 'pdf-to-image' | 'image-to-pdf' = 'pdf-to-image';

  // PDF -> Image state
  public pdfToImgForm!: FormGroup;
  public isDraggingPdf = false;
  public loadedPdfName = '';
  public loadedPdfSizeBytes = 0;
  public loadedPdfPageCount = 0;
  public loadedPdfBuffer: Uint8Array | null = null;
  public isConvertingPdf = false;
  public pdfProgressCurrent = 0;
  public pdfProgressTotal = 0;
  public renderedPages: RenderedPdfPage[] = [];
  public isZipping = false;

  // Image -> PDF state
  public imgToPdfForm!: FormGroup;
  public isDraggingImages = false;
  public uploadedImages: UploadedImageItem[] = [];
  public isBuildingPdf = false;
  public generatedPdfUrl: string | null = null;
  public generatedPdfSizeBytes = 0;

  ngOnInit(): void {
    this.pdfToImgForm = this.fb.group({
      format: ['image/png' as PdfOutputImageFormat],
      scale: [2],
      quality: [0.92],
      pageRange: ['all']
    });

    this.imgToPdfForm = this.fb.group({
      pageSize: ['a4' as PdfPageSize],
      orientation: ['auto' as PdfOrientation],
      marginPt: [24],
      filename: ['converted-images.pdf', Validators.required]
    });
  }

  public formatSize(bytes: number): string {
    return formatBytes(bytes);
  }

  public onDragOver(event: DragEvent, kind: 'pdf' | 'image'): void {
    event.preventDefault();
    if (kind === 'pdf') this.isDraggingPdf = true;
    else this.isDraggingImages = true;
  }

  public async onDrop(event: DragEvent, kind: 'pdf' | 'image'): Promise<void> {
    event.preventDefault();
    this.isDraggingPdf = false;
    this.isDraggingImages = false;
    const files = Array.from(event.dataTransfer?.files || []);
    if (files.length === 0) return;

    if (kind === 'pdf') {
      const pdf = files.find(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
      if (pdf) await this.loadPdfFile(pdf);
      else this.notifyService.warning('Please drop a valid .pdf file');
    } else {
      await this.addImageFiles(files);
    }
  }

  public async onPdfFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      await this.loadPdfFile(file);
    }
    input.value = '';
  }

  private async loadPdfFile(file: File): Promise<void> {
    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      await this.loadPdfBytes(buffer, file.name, file.size);
    } catch (err: any) {
      this.notifyService.error('Failed to read PDF: ' + (err?.message || 'Unknown error'));
    }
  }

  private async loadPdfBytes(bytes: Uint8Array, name: string, sizeBytes: number): Promise<void> {
    const pdfjs = await this.loadPdfJs();
    const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
    this.loadedPdfBuffer = bytes;
    this.loadedPdfName = name;
    this.loadedPdfSizeBytes = sizeBytes;
    this.loadedPdfPageCount = doc.numPages;
    this.renderedPages = [];
    this.notifyService.success(`Loaded "${name}" (${doc.numPages} page${doc.numPages === 1 ? '' : 's'})`);
  }

  private async loadPdfJs() {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'vendor/pdfjs/pdf.worker.min.mjs',
      document.baseURI
    ).toString();
    return pdfjs;
  }

  public async convertPdfToImages(): Promise<void> {
    if (!this.loadedPdfBuffer || this.isConvertingPdf) return;
    this.isConvertingPdf = true;
    this.renderedPages = [];

    try {
      const pdfjs = await this.loadPdfJs();
      const doc = await pdfjs.getDocument({ data: this.loadedPdfBuffer.slice() }).promise;
      const { format, scale, quality, pageRange } = this.pdfToImgForm.value;
      const pagesToRender = parsePageRange(pageRange, doc.numPages);

      if (pagesToRender.length === 0) {
        this.notifyService.warning('No valid pages matched that page range');
        this.isConvertingPdf = false;
        return;
      }

      this.pdfProgressTotal = pagesToRender.length;
      const ext = format === 'image/jpeg' ? 'jpg' : format === 'image/webp' ? 'webp' : 'png';
      const baseName = (this.loadedPdfName || 'document').replace(/\.pdf$/i, '');

      for (let i = 0; i < pagesToRender.length; i++) {
        const pageNum = pagesToRender[i];
        this.pdfProgressCurrent = i + 1;
        const page = await doc.getPage(pageNum);
        const viewport = page.getViewport({ scale: Number(scale) || 2 });

        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;

        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            b => (b ? resolve(b) : reject(new Error('Canvas encoding failed'))),
            format,
            Number(quality) || 0.92
          );
        });

        const dataUrl = canvas.toDataURL(format, Number(quality) || 0.92);
        this.renderedPages.push({
          pageNumber: pageNum,
          widthPx: canvas.width,
          heightPx: canvas.height,
          sizeBytes: blob.size,
          dataUrl,
          blob,
          filename: `${baseName}-page-${pageNum}.${ext}`
        });
      }

      this.notifyService.success(`Rendered ${this.renderedPages.length} page(s) to ${ext.toUpperCase()}`);
    } catch (err: any) {
      this.notifyService.error('PDF conversion failed: ' + (err?.message || 'Unknown error'));
    } finally {
      this.isConvertingPdf = false;
    }
  }

  public downloadRenderedPage(page: RenderedPdfPage): void {
    const url = URL.createObjectURL(page.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = page.filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  public async downloadAllAsZip(): Promise<void> {
    if (this.renderedPages.length === 0 || this.isZipping) return;
    this.isZipping = true;
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      for (const page of this.renderedPages) {
        zip.file(page.filename, page.blob);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const baseName = (this.loadedPdfName || 'pdf-images').replace(/\.pdf$/i, '');
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseName}-images.zip`;
      link.click();
      URL.revokeObjectURL(url);
      this.notifyService.success('Downloaded all images as ZIP');
    } catch (err: any) {
      this.notifyService.error('ZIP export failed: ' + (err?.message || 'Unknown error'));
    } finally {
      this.isZipping = false;
    }
  }

  public async onImagesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (files.length > 0) {
      await this.addImageFiles(files);
    }
    input.value = '';
  }

  private async addImageFiles(files: File[]): Promise<void> {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      this.notifyService.warning('Please select valid image files');
      return;
    }

    for (const file of imageFiles) {
      try {
        const item = await this.encodeFileToImageItem(file);
        this.uploadedImages.push(item);
      } catch {
        this.notifyService.warning(`Skipped unreadable image: ${file.name}`);
      }
    }
  }

  private async encodeFileToImageItem(file: File): Promise<UploadedImageItem> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image decode failed'));
      el.src = dataUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    const jpegBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        b => (b ? resolve(b) : reject(new Error('JPEG encoding failed'))),
        'image/jpeg',
        0.92
      );
    });

    const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
    return {
      id: Math.random().toString(36).substring(2, 9),
      name: file.name,
      sizeBytes: file.size,
      widthPx: canvas.width,
      heightPx: canvas.height,
      previewUrl: dataUrl,
      jpegBytes
    };
  }

  public moveImage(idx: number, delta: -1 | 1): void {
    const target = idx + delta;
    if (target < 0 || target >= this.uploadedImages.length) return;
    const [moved] = this.uploadedImages.splice(idx, 1);
    this.uploadedImages.splice(target, 0, moved);
  }

  public removeImage(idx: number): void {
    this.uploadedImages.splice(idx, 1);
  }

  public convertImagesToPdfAndDownload(): void {
    if (this.uploadedImages.length === 0 || this.isBuildingPdf) return;
    this.isBuildingPdf = true;
    try {
      const { pageSize, orientation, marginPt } = this.imgToPdfForm.value;
      const inputs: PdfImageInput[] = this.uploadedImages.map(img => ({
        name: img.name,
        widthPx: img.widthPx,
        heightPx: img.heightPx,
        jpegBytes: img.jpegBytes
      }));

      const pdfBytes = buildPdfFromJpegImages(inputs, {
        pageSize,
        orientation,
        marginPt: Number(marginPt) || 0
      });

      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      if (this.generatedPdfUrl) {
        URL.revokeObjectURL(this.generatedPdfUrl);
      }
      this.generatedPdfUrl = URL.createObjectURL(blob);
      this.generatedPdfSizeBytes = blob.size;
      this.triggerGeneratedPdfDownload();
      this.notifyService.success(`Generated PDF (${this.uploadedImages.length} page${this.uploadedImages.length === 1 ? '' : 's'})`);
    } catch (err: any) {
      this.notifyService.error('PDF build failed: ' + (err?.message || 'Unknown error'));
    } finally {
      this.isBuildingPdf = false;
    }
  }

  public triggerGeneratedPdfDownload(): void {
    if (!this.generatedPdfUrl) return;
    const rawName = (this.imgToPdfForm.get('filename')?.value || 'converted-images.pdf').trim();
    const filename = rawName.toLowerCase().endsWith('.pdf') ? rawName : `${rawName}.pdf`;
    const link = document.createElement('a');
    link.href = this.generatedPdfUrl;
    link.download = filename;
    link.click();
  }

  public async loadSampleForCurrentMode(): Promise<void> {
    const sampleImages = await this.createSampleCanvasImages();
    if (this.mode === 'image-to-pdf') {
      this.uploadedImages = sampleImages;
      this.notifyService.info('Loaded 2 sample images — click Convert & Download PDF');
    } else {
      const pdfBytes = buildPdfFromJpegImages(
        sampleImages.map(s => ({
          name: s.name,
          widthPx: s.widthPx,
          heightPx: s.heightPx,
          jpegBytes: s.jpegBytes
        })),
        { pageSize: 'a4', orientation: 'portrait', marginPt: 24 }
      );
      await this.loadPdfBytes(pdfBytes, 'devnexus-sample.pdf', pdfBytes.length);
      await this.convertPdfToImages();
    }
  }

  public clearCurrentMode(): void {
    if (this.mode === 'pdf-to-image') {
      this.loadedPdfBuffer = null;
      this.loadedPdfName = '';
      this.loadedPdfSizeBytes = 0;
      this.loadedPdfPageCount = 0;
      this.renderedPages = [];
    } else {
      this.uploadedImages = [];
      if (this.generatedPdfUrl) {
        URL.revokeObjectURL(this.generatedPdfUrl);
        this.generatedPdfUrl = null;
      }
      this.generatedPdfSizeBytes = 0;
    }
  }

  private async createSampleCanvasImages(): Promise<UploadedImageItem[]> {
    const cards = [
      { title: 'DevNexus Sample Page 1', subtitle: 'Client-Side PDF ↔ Image Converter', accent: '#1558c9' },
      { title: 'DevNexus Sample Page 2', subtitle: 'Angular 20 • Canvas • PDF 1.4', accent: '#10b981' }
    ];

    const items: UploadedImageItem[] = [];
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 500;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = c.accent;
      ctx.fillRect(40, 40, 720, 14);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText(c.title, 40, 140);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '22px sans-serif';
      ctx.fillText(c.subtitle, 40, 195);

      const previewUrl = canvas.toDataURL('image/jpeg', 0.92);
      const blob = await new Promise<Blob>(resolve =>
        canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.92)
      );
      const jpegBytes = new Uint8Array(await blob.arrayBuffer());
      items.push({
        id: `sample-${i + 1}`,
        name: `sample-page-${i + 1}.jpg`,
        sizeBytes: jpegBytes.length,
        widthPx: canvas.width,
        heightPx: canvas.height,
        previewUrl,
        jpegBytes
      });
    }
    return items;
  }
}
