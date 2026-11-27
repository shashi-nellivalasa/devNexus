import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  TemplateRef,
  ViewChild,
  computed,
  effect,
  signal,
  untracked,
  viewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
  type PDFPageProxy,
  type RenderTask
} from 'pdfjs-dist';
import { ToolHeaderComponent } from '../../../shared/components/tool-header/tool-header.component';
import { NotificationService } from '../../../core/services/notification.service';
import { ModalService } from '../../../core/services/modal.service';
import { formatBytes } from '../../../shared/utils/pdf-image.util';
import {
  DEFAULT_SIGNER_NAMES,
  ESIGN_PROVIDER_OPTIONS,
  EsignProvider,
  ExportRounding,
  PdfDocumentMeta,
  PdfPageInfo,
  PdfRect,
  SIGNER_COLORS,
  ScreenRect,
  SignatureBox,
  Signer,
  alignPdf,
  buildSignatureExportData,
  clampToPage,
  commitPdf,
  cssPointToPdfPoint,
  ensurePromiseTryPolyfill,
  formatBoxesForProvider,
  parseProviderCoordinates,
  pdfToScreen,
  screenToPdf,
  serializeCdslBoxes,
  serializeCvlBoxes,
  serializeDigioForSigner,
  serializeEmudhraBoxes,
  serializeNsdlBoxes,
  transformInputFromPage,
  validateSignatureBoxes
} from '../../../shared/utils/pdf-signature-coordinates.util';

GlobalWorkerOptions.workerSrc =
  typeof document !== 'undefined'
    ? new URL('vendor/pdfjs/pdf.worker.min.mjs', document.baseURI).toString()
    : '/vendor/pdfjs/pdf.worker.min.mjs';

ensurePromiseTryPolyfill();

type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface DraftRect extends ScreenRect {
  page: number;
}

interface PointerGuide {
  x: number;
  y: number;
  labelX: number;
  labelY: number;
  label: string;
}

@Component({
  selector: 'app-pdf-signature-coordinates',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ToolHeaderComponent],
  template: `
    <div class="p-3 d-flex flex-column flex-grow-1">
      <app-tool-header
        title="PDF Signature Coordinate Generator"
        description="Upload a PDF, place and resize signer signature boxes, and extract NSDL / eMudhra eSign coordinates locally in your browser."
        icon="bi-pen"
        badge="New"
        toolId="pdf-signature-coordinates"
        [showSampleBtn]="false"
        [showCopyBtn]="false"
        (clear)="clearAll()"
      ></app-tool-header>

      <!-- Mode Switcher & Document Summary -->
      <div class="dn-card p-2 mb-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div class="btn-group btn-group-sm" role="group" aria-label="Tool mode">
          <button
            type="button"
            class="btn"
            [class.btn-primary]="mode() === 'setup'"
            [class.btn-outline-secondary]="mode() !== 'setup'"
            (click)="mode.set('setup')"
          >
            <i class="bi bi-sliders2 me-1"></i> Setup
          </button>
          <button
            type="button"
            class="btn"
            [class.btn-primary]="mode() === 'workspace'"
            [class.btn-outline-secondary]="mode() !== 'workspace'"
            [disabled]="!hasDocument()"
            (click)="mode.set('workspace')"
          >
            <i class="bi bi-bounding-box me-1"></i> Workspace
          </button>
        </div>

        <div class="d-flex align-items-center gap-2 flex-wrap">
          @if (docMeta(); as meta) {
            <span
              class="badge bg-secondary-subtle text-body border border-secondary border-opacity-25 font-mono text-truncate"
              style="max-width: 320px;"
              [title]="meta.documentName"
            >
              <i class="bi bi-file-earmark-pdf text-danger me-1"></i>
              {{ meta.documentName }} · {{ meta.pageCount }}p · {{ formatSize(meta.fileSizeBytes) }}
            </span>
          }
          <button type="button" class="btn btn-sm btn-outline-secondary" (click)="openSettingsModal()">
            <i class="bi bi-gear me-1"></i> Settings
          </button>
        </div>
      </div>

      <!-- SETUP VIEW -->
      @if (mode() === 'setup') {
        <div class="row g-3">
          <!-- Upload Card -->
          <div class="col-lg-5">
            <div class="dn-card p-3 h-100 d-flex flex-column">
              <h6 class="fw-bold small text-uppercase text-secondary mb-2">1. Upload PDF</h6>
              <p class="small text-secondary mb-3">
                Everything runs locally in your browser — PDFs and coordinates never leave your machine.
              </p>

              <label
                class="dropzone-box d-flex flex-column align-items-center justify-content-center text-center p-4 rounded border border-2 border-dashed mb-3 cursor-pointer flex-grow-1"
                [class.border-primary]="isDraggingPdf()"
                [class.border-secondary]="!isDraggingPdf()"
                (dragover)="onDragOver($event)"
                (dragleave)="isDraggingPdf.set(false)"
                (drop)="onDrop($event)"
              >
                <i class="bi bi-cloud-arrow-up fs-1 text-primary mb-2"></i>
                <span class="small fw-semibold">
                  {{ hasDocument() ? 'Drop a new PDF or click to replace' : 'Drop a PDF file here or click to browse' }}
                </span>
                <span class="text-secondary" style="font-size: 0.75rem;">Supports multi-page .pdf documents</span>
                <input type="file" accept="application/pdf,.pdf" class="d-none" (change)="onPdfFileInput($event)" />
              </label>

              @if (loadingPdf()) {
                <div class="alert alert-info py-2 px-3 small mb-2">
                  <span class="spinner-border spinner-border-sm me-2"></span>Loading PDF...
                </div>
              }
              @if (docMeta(); as meta) {
                <div class="alert alert-success py-2 px-3 small mb-3 d-flex justify-content-between align-items-center">
                  <span class="text-truncate me-2">
                    <i class="bi bi-check-circle-fill me-1"></i><strong>{{ meta.documentName }}</strong>
                  </span>
                  <span class="font-mono text-nowrap">{{ meta.pageCount }} pages · {{ formatSize(meta.fileSizeBytes) }}</span>
                </div>
              }

              <button
                type="button"
                class="btn btn-primary w-100 fw-semibold"
                [disabled]="!hasDocument()"
                (click)="mode.set('workspace')"
              >
                <i class="bi bi-arrow-right-circle me-1"></i>
                {{ hasDocument() ? 'Open Workspace' : 'Upload a PDF to continue' }}
              </button>
            </div>
          </div>

          <!-- eSign Provider, Signers & Import Card -->
          <div class="col-lg-7">
            <div class="dn-card p-3 h-100 d-flex flex-column gap-3">
              <!-- eSign Provider -->
              <div>
                <h6 class="fw-bold small text-uppercase text-secondary mb-1">2. eSign Provider</h6>
                <p class="small text-secondary mb-2">
                  Choose the coordinate format required by your eSign gateway (you can switch any time).
                </p>
                <div class="d-flex flex-wrap gap-1 mb-2">
                  @for (opt of providerOptions; track opt.id) {
                    <button
                      type="button"
                      class="btn btn-sm"
                      [class.btn-primary]="selectedProvider() === opt.id"
                      [class.btn-outline-secondary]="selectedProvider() !== opt.id"
                      (click)="selectedProvider.set(opt.id)"
                    >
                      {{ opt.label }}
                    </button>
                  }
                </div>
                <div class="small text-secondary font-mono bg-body-tertiary rounded px-2 py-1 border border-secondary border-opacity-25">
                  {{ activeProviderOption().formatHint }}
                </div>
              </div>

              <!-- Signers (1-5) -->
              <div class="border-top border-secondary border-opacity-25 pt-3">
                <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                  <div>
                    <h6 class="fw-bold small text-uppercase text-secondary mb-1">3. Signers (1–5)</h6>
                    <span class="small text-secondary">Assign colors and names for each signature party.</span>
                  </div>
                  <div class="btn-group btn-group-sm" role="group" aria-label="Number of signers">
                    @for (n of [1, 2, 3, 4, 5]; track n) {
                      <button
                        type="button"
                        class="btn"
                        [class.btn-primary]="signers().length === n"
                        [class.btn-outline-secondary]="signers().length !== n"
                        (click)="setSignerCount(n)"
                      >
                        {{ n }}
                      </button>
                    }
                  </div>
                </div>

                <div class="d-flex flex-column gap-2">
                  @for (signer of signers(); track signer.id) {
                    <div class="input-group input-group-sm">
                      <span class="input-group-text">
                        <span class="signer-swatch" [style.background]="signer.color"></span>
                      </span>
                      <span class="input-group-text">Signer {{ signer.id }}</span>
                      <input
                        type="text"
                        class="form-control"
                        [value]="signer.name"
                        (input)="updateSignerName(signer.id, $any($event.target).value)"
                      />
                    </div>
                  }
                </div>
              </div>

              <!-- Import -->
              <div class="border-top border-secondary border-opacity-25 pt-3">
                <h6 class="fw-bold small text-uppercase text-secondary mb-1">Import Existing Coordinates (Optional)</h6>
                <p class="small text-secondary mb-2">
                  Supports NSDL, eMudhra, CVL, CDSL, Digio JSON &amp; Leegality JSON (replaces boxes for the selected signer).
                </p>
                <form [formGroup]="importForm" class="d-flex flex-column gap-2">
                  <div class="row g-2">
                    <div class="col-sm-4">
                      <select class="form-select form-select-sm" formControlName="signerId">
                        @for (signer of signers(); track signer.id) {
                          <option [ngValue]="signer.id">{{ signer.name }}</option>
                        }
                      </select>
                    </div>
                    <div class="col-sm-8 d-flex gap-2">
                      <input
                        type="text"
                        class="form-control form-control-sm font-mono"
                        formControlName="nsdlText"
                        [placeholder]="activeProviderOption().placeholder"
                      />
                      <button
                        type="button"
                        class="btn btn-sm btn-outline-primary text-nowrap"
                        [disabled]="!hasDocument() || !(importForm.get('nsdlText')?.value || '').trim()"
                        (click)="importNsdlString()"
                      >
                        Import
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- WORKSPACE VIEW -->
      @if (mode() === 'workspace') {
        <!-- Compact Workspace Toolbar -->
        <div class="dn-card p-2 mb-2 d-flex flex-wrap align-items-center gap-2">
          <label class="btn btn-sm btn-outline-secondary mb-0">
            <i class="bi bi-upload me-1"></i> PDF
            <input type="file" accept="application/pdf,.pdf" class="d-none" (change)="onPdfFileInput($event)" />
          </label>

          <form
            [formGroup]="pageJumpForm"
            (ngSubmit)="submitPageJump()"
            class="input-group input-group-sm w-auto flex-nowrap"
            role="group"
            aria-label="Page navigation"
          >
            <button
              type="button"
              class="btn btn-outline-secondary"
              (click)="goToPage(currentPage() - 1)"
              [disabled]="currentPage() <= 1"
              title="Previous page"
            >
              <i class="bi bi-chevron-left"></i>
            </button>
            <input
              type="number"
              formControlName="page"
              class="form-control form-control-sm text-center font-mono px-1"
              style="width: 4rem;"
              [min]="1"
              [max]="pageCount() || 1"
              (change)="submitPageJump()"
              (blur)="submitPageJump()"
              aria-label="Go to page"
              title="Enter page number and press Enter"
            />
            <span class="input-group-text font-mono px-2">/ {{ pageCount() }}</span>
            <button
              type="submit"
              class="btn btn-outline-secondary"
              [disabled]="pageCount() <= 1"
              title="Go to page"
            >
              Go
            </button>
            <button
              type="button"
              class="btn btn-outline-secondary"
              (click)="goToPage(currentPage() + 1)"
              [disabled]="currentPage() >= pageCount()"
              title="Next page"
            >
              <i class="bi bi-chevron-right"></i>
            </button>
          </form>

          <div class="btn-group btn-group-sm" role="group" aria-label="Zoom controls">
            <button type="button" class="btn btn-outline-secondary" (click)="setZoom(zoom() / 1.25)">−</button>
            <select
              class="form-select form-select-sm"
              style="width: auto;"
              [value]="nearestZoomPreset()"
              (change)="setZoom(+$any($event.target).value)"
              aria-label="Zoom level"
            >
              @for (z of zoomPresets; track z) {
                <option [value]="z" [selected]="z === nearestZoomPreset()">{{ Math.round(z * 100) }}%</option>
              }
            </select>
            <button type="button" class="btn btn-outline-secondary" (click)="setZoom(zoom() * 1.25)">+</button>
            <button type="button" class="btn btn-outline-secondary" (click)="fitWidth()">Fit</button>
          </div>

          <button type="button" class="btn btn-sm btn-outline-secondary" (click)="rotateClockwise()" title="Rotate 90° clockwise">
            <i class="bi bi-arrow-clockwise"></i>
          </button>

          <div class="btn-group btn-group-sm" role="group" aria-label="Undo and Redo">
            <button type="button" class="btn btn-outline-secondary" (click)="undo()" [disabled]="undoStack().length === 0" title="Undo (Ctrl+Z)">
              <i class="bi bi-arrow-counterclockwise"></i>
            </button>
            <button type="button" class="btn btn-outline-secondary" (click)="redo()" [disabled]="redoStack().length === 0" title="Redo (Ctrl+Y)">
              <i class="bi bi-arrow-clockwise"></i>
            </button>
          </div>

          <button
            type="button"
            class="btn btn-sm fw-semibold"
            [class.btn-warning]="placementMode()"
            [class.btn-primary]="!placementMode()"
            (click)="placementMode.set(!placementMode())"
          >
            <i class="bi" [ngClass]="placementMode() ? 'bi-x-circle' : 'bi-plus-square'"></i>
            <span class="ms-1">{{ placementMode() ? 'Cancel Place' : 'Add Signature' }}</span>
          </button>

          <div class="ms-auto d-flex flex-wrap align-items-center gap-1">
            <select
              class="form-select form-select-sm"
              style="width: auto;"
              [value]="selectedProvider()"
              (change)="selectedProvider.set($any($event.target).value)"
              aria-label="eSign provider"
            >
              @for (opt of providerOptions; track opt.id) {
                <option [value]="opt.id" [selected]="selectedProvider() === opt.id">{{ opt.label }}</option>
              }
            </select>
            @if (selectedProvider() === 'all') {
              <button type="button" class="btn btn-sm btn-outline-primary" (click)="copyProviderOutput('nsdl')" [disabled]="boxes().length === 0">
                <i class="bi bi-copy me-1"></i> NSDL
              </button>
              <button type="button" class="btn btn-sm btn-outline-secondary" (click)="copyProviderOutput('emudhra')" [disabled]="boxes().length === 0">
                eMudhra
              </button>
              <button type="button" class="btn btn-sm btn-outline-secondary" (click)="copyProviderOutput('cvl')" [disabled]="boxes().length === 0">
                CVL
              </button>
              <button type="button" class="btn btn-sm btn-outline-secondary" (click)="copyProviderOutput('digio')" [disabled]="boxes().length === 0">
                Digio
              </button>
            } @else {
              <button type="button" class="btn btn-sm btn-outline-primary" (click)="copyActiveProviderOutput()" [disabled]="boxes().length === 0">
                <i class="bi bi-copy me-1"></i> Copy {{ activeProviderOption().label }}
              </button>
            }
            <button type="button" class="btn btn-sm btn-outline-secondary" (click)="downloadTxt()" [disabled]="boxes().length === 0" title="Download .txt">
              .txt
            </button>
            <button type="button" class="btn btn-sm btn-outline-secondary" (click)="downloadJson()" [disabled]="boxes().length === 0" title="Download JSON">
              .json
            </button>
          </div>
        </div>

        <!-- Main Workspace Body -->
        <div #workspaceGrid class="workspace-split flex-grow-1">
          <!-- PDF Canvas Stage -->
          <div class="workspace-stage-col" [style.--stage-col-width.px]="stageColumnWidthPx()">
            <div class="dn-card p-2 stage-card d-flex flex-column">
              <div #viewerHost class="viewer-host rounded border border-secondary border-opacity-25 p-2 position-relative flex-grow-1">
                @if (placementMode()) {
                  <div class="alert alert-warning py-1 px-2 small mb-0 d-flex align-items-center justify-content-between shadow-sm floating-banner">
                    <span>
                      <strong>Placement Mode ({{ activeSigner().name }}):</strong> Click to drop a box, or drag to draw custom bounds.
                    </span>
                    <button type="button" class="btn btn-sm btn-outline-dark py-0 ms-2" (click)="placementMode.set(false)">Cancel</button>
                  </div>
                }

                @if (copiedBox(); as clip) {
                  <div class="alert alert-info py-1 px-2 small mb-0 d-flex align-items-center justify-content-between shadow-sm floating-banner">
                    <span>Copied box from page {{ clip.sourcePage }} — paste onto page {{ currentPage() }}</span>
                    <div class="d-flex gap-1 ms-2">
                      <button type="button" class="btn btn-sm btn-primary py-0" (click)="pasteCopiedBox()">Paste here</button>
                      <button type="button" class="btn btn-sm btn-outline-secondary py-0" (click)="copiedBox.set(null)">Clear</button>
                    </div>
                  </div>
                }

                @if (currentPageInfo(); as page) {
                  <div
                    class="page-stage mx-auto shadow"
                    [class.page-stage--placing]="placementMode()"
                    [style.width.px]="page.renderedWidth"
                    [style.height.px]="page.renderedHeight"
                    (pointerdown)="onStagePointerDown($event, page)"
                    (pointermove)="onStagePointerMove($event, page)"
                    (pointerleave)="pointerGuide.set(null)"
                  >
                      <canvas #pdfCanvas class="page-canvas"></canvas>
                      @if (showGrid()) {
                        <div class="page-grid-overlay" [style.--grid-size.px]="gridSizePx(page)"></div>
                      }

                      @if (draftRect(); as draft) {
                        @if (draft.page === page.pageNumber) {
                          <div
                            class="draft-rect"
                            [style.left.px]="draft.left"
                            [style.top.px]="draft.top"
                            [style.width.px]="draft.width"
                            [style.height.px]="draft.height"
                          ></div>
                        }
                      }

                      @if (pointerGuide(); as guide) {
                        <div class="guide-v" [style.left.px]="guide.x"></div>
                        <div class="guide-h" [style.top.px]="guide.y"></div>
                        <div class="guide-label" [style.left.px]="guide.labelX" [style.top.px]="guide.labelY">
                          {{ guide.label }}
                        </div>
                      }

                      <!-- Signature Box Overlays -->
                      @for (box of currentPageBoxes(); track box.id) {
                        @if (signerFor(box.signerId); as signer) {
                          @let rect = screenRectFor(box, page);
                          <div
                            class="sig-marker"
                            [class.sig-marker--selected]="selectedBoxId() === box.id"
                            [style.left.px]="rect.left"
                            [style.top.px]="rect.top"
                            [style.width.px]="rect.width"
                            [style.height.px]="rect.height"
                            [style.borderColor]="signer.color"
                            [style.backgroundColor]="hexToRgba(signer.color, 0.18)"
                            (pointerdown)="onMarkerDragStart($event, box, page)"
                          >
                            <div class="sig-marker__badge" [style.background]="signer.color">
                              {{ signer.name }} · {{ Math.round(box.pdf.x) }},{{ Math.round(box.pdf.y) }}
                            </div>

                            @if (selectedBoxId() === box.id) {
                              @for (h of resizeHandles; track h) {
                                <span
                                  class="sig-handle"
                                  [class]="'sig-handle sig-handle--' + h"
                                  [style.borderColor]="signer.color"
                                  (pointerdown)="onMarkerResizeStart($event, box, page, h)"
                                ></span>
                              }
                            }
                          </div>
                        }
                      }
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- Right Inspector Panel -->
          <div class="workspace-inspector-col">
            <div class="dn-card p-3 d-flex flex-column gap-3 inspector-panel">
              <div class="inspector-top-grid">
                <div class="d-flex flex-column gap-3">
                  <!-- Active Signer Selector -->
                  <div>
                    <div class="small fw-bold text-uppercase text-secondary mb-2">Active Signer</div>
                    <div class="d-flex flex-column gap-1">
                      @for (signer of signers(); track signer.id) {
                        <button
                          type="button"
                          class="btn btn-sm text-start d-flex align-items-center justify-content-between"
                          [class.btn-primary]="activeSignerId() === signer.id"
                          [class.btn-outline-secondary]="activeSignerId() !== signer.id"
                          (click)="activeSignerId.set(signer.id)"
                        >
                          <span class="d-flex align-items-center gap-2 text-truncate">
                            <span class="signer-swatch" [style.background]="signer.color"></span>
                            <span class="text-truncate">{{ signer.name }}</span>
                          </span>
                          <span class="badge bg-dark bg-opacity-25">{{ countForSigner(signer.id) }}</span>
                        </button>
                      }
                    </div>
                  </div>

                  <!-- Selected Box Inspector -->
                  <div class="border-top border-secondary border-opacity-25 pt-2">
                <div class="d-flex align-items-center justify-content-between mb-2">
                  <span class="small fw-bold text-uppercase text-secondary">Selected Box</span>
                  @if (selectedBox(); as sel) {
                    <div class="btn-group btn-group-sm">
                      <button type="button" class="btn btn-outline-secondary py-0" (click)="copyBoxToClipboard(sel)" title="Copy box">
                        <i class="bi bi-copy"></i>
                      </button>
                      <button type="button" class="btn btn-outline-secondary py-0" (click)="duplicateBox(sel)" title="Duplicate">
                        <i class="bi bi-files"></i>
                      </button>
                      <button type="button" class="btn btn-outline-danger py-0" (click)="deleteBox(sel.id)" title="Delete box">
                        <i class="bi bi-trash"></i>
                      </button>
                    </div>
                  }
                </div>

                @if (selectedBox(); as sel) {
                  <form [formGroup]="boxForm" class="row g-2">
                    <div class="col-6">
                      <label class="form-label small text-secondary mb-0">Signer</label>
                      <select class="form-select form-select-sm" formControlName="signerId" (change)="applyBoxForm()">
                        @for (s of signers(); track s.id) {
                          <option [ngValue]="s.id">{{ s.name }}</option>
                        }
                      </select>
                    </div>
                    <div class="col-6">
                      <label class="form-label small text-secondary mb-0">Page</label>
                      <input type="number" class="form-control form-control-sm font-mono" formControlName="page" min="1" [max]="pageCount()" (change)="applyBoxForm()" />
                    </div>
                    <div class="col-6">
                      <label class="form-label small text-secondary mb-0">X (pt)</label>
                      <input type="number" class="form-control form-control-sm font-mono" formControlName="x" (change)="applyBoxForm()" />
                    </div>
                    <div class="col-6">
                      <label class="form-label small text-secondary mb-0">Y (pt)</label>
                      <input type="number" class="form-control form-control-sm font-mono" formControlName="y" (change)="applyBoxForm()" />
                    </div>
                    <div class="col-6">
                      <label class="form-label small text-secondary mb-0">Width (pt)</label>
                      <input type="number" class="form-control form-control-sm font-mono" formControlName="width" min="10" (change)="applyBoxForm()" />
                    </div>
                    <div class="col-6">
                      <label class="form-label small text-secondary mb-0">Height (pt)</label>
                      <input type="number" class="form-control form-control-sm font-mono" formControlName="height" min="10" (change)="applyBoxForm()" />
                    </div>
                    <div class="col-12 d-flex flex-wrap gap-1 pt-1">
                      <button type="button" class="btn btn-sm btn-outline-secondary py-0 font-mono" (click)="applyPresetSize(150, 50)">150×50</button>
                      <button type="button" class="btn btn-sm btn-outline-secondary py-0 font-mono" (click)="applyPresetSize(120, 40)">120×40</button>
                      <button type="button" class="btn btn-sm btn-outline-secondary py-0 font-mono" (click)="applyPresetSize(180, 60)">180×60</button>
                    </div>
                  </form>

                  @if (selectedBoxIssues().length > 0) {
                    <div class="alert alert-warning py-1 px-2 small mt-2 mb-0">
                      @for (issue of selectedBoxIssues(); track $index) {
                        <div>{{ issue.message }}</div>
                      }
                    </div>
                  }
                } @else {
                  <p class="small text-secondary mb-0">Click a signature box or use <strong>Add Signature</strong>.</p>
                }
                  </div>
                </div>

                <!-- Live Coordinate Exports -->
                <div class="inspector-pane-exports d-flex flex-column">
                <div class="d-flex align-items-center justify-content-between mb-2">
                  <span class="small fw-bold text-uppercase text-secondary">{{ activeProviderOption().label }} Output</span>
                </div>

                @for (row of signerExports(); track row.signerId) {
                  <div class="border border-secondary border-opacity-25 rounded p-2 mb-2">
                    <div class="d-flex align-items-center justify-content-between gap-1 mb-1">
                      <span class="small fw-semibold d-flex align-items-center gap-1 text-truncate">
                        <span class="signer-swatch" [style.background]="row.color"></span>
                        {{ row.name }}
                      </span>
                      <div class="btn-group btn-group-sm">
                        @if (selectedProvider() === 'all' || selectedProvider() === 'nsdl') {
                          <button type="button" class="btn btn-outline-primary py-0 px-1" style="font-size: 0.7rem;" (click)="copyText(row.nsdl, row.name + ' NSDL')" [disabled]="!row.nsdl">NSDL</button>
                        }
                        @if (selectedProvider() === 'all' || selectedProvider() === 'emudhra') {
                          <button type="button" class="btn btn-outline-secondary py-0 px-1" style="font-size: 0.7rem;" (click)="copyText(row.emudhra, row.name + ' eMudhra')" [disabled]="!row.emudhra">eMudhra</button>
                        }
                        @if (selectedProvider() === 'all' || selectedProvider() === 'cvl') {
                          <button type="button" class="btn btn-outline-primary py-0 px-1" style="font-size: 0.7rem;" (click)="copyText(row.cvl, row.name + ' CVL')" [disabled]="!row.cvl">CVL</button>
                        }
                        @if (selectedProvider() === 'all' || selectedProvider() === 'digio') {
                          <button type="button" class="btn btn-outline-secondary py-0 px-1" style="font-size: 0.7rem;" (click)="copyText(row.digio, row.name + ' Digio')" [disabled]="!row.digio">Digio</button>
                        }
                        @if (selectedProvider() === 'cdsl') {
                          <button type="button" class="btn btn-outline-primary py-0 px-1" style="font-size: 0.7rem;" (click)="copyText(row.cdsl, row.name + ' CDSL')" [disabled]="!row.cdsl">CDSL</button>
                        }
                        @if (selectedProvider() === 'leegality') {
                          <button type="button" class="btn btn-outline-primary py-0 px-1" style="font-size: 0.7rem;" (click)="copyText(row.leegality, row.name + ' Leegality')" [disabled]="!row.leegality">JSON</button>
                        }
                      </div>
                    </div>
                    <textarea
                      class="form-control form-control-sm font-mono"
                      rows="2"
                      readonly
                      [value]="signerOutputPreview(row)"
                      placeholder="No boxes placed"
                      style="font-size: 0.72rem;"
                    ></textarea>
                  </div>
                }

                <div class="d-flex align-items-center justify-content-between mb-1">
                  <span class="small text-secondary">Combined Payload ({{ selectedProvider() === 'all' ? 'NSDL' : activeProviderOption().label }})</span>
                  <div class="btn-group btn-group-sm">
                    @if (selectedProvider() === 'all') {
                      <button type="button" class="btn btn-outline-secondary py-0 px-1" style="font-size: 0.68rem;" (click)="copyProviderOutput('cdsl')" [disabled]="boxes().length === 0">CDSL</button>
                      <button type="button" class="btn btn-outline-secondary py-0 px-1" style="font-size: 0.68rem;" (click)="copyProviderOutput('leegality')" [disabled]="boxes().length === 0">Leegality</button>
                    }
                  </div>
                </div>
                <textarea
                  class="form-control form-control-sm font-mono flex-grow-1"
                  rows="4"
                  readonly
                  [value]="combinedProviderOutput()"
                  placeholder="No boxes placed"
                  style="font-size: 0.75rem; min-height: 96px;"
                ></textarea>
                </div>
              </div>

              <!-- Markers Table inside Inspector Box -->
              <div class="border-top border-secondary border-opacity-25 pt-2 d-flex flex-column inspector-markers-section">
                <div class="d-flex align-items-center justify-content-between mb-2">
                  <span class="small fw-bold text-uppercase text-secondary">
                    Markers <span class="badge bg-secondary ms-1">{{ boxes().length }}</span>
                  </span>
                  <button type="button" class="btn btn-sm btn-outline-secondary py-0" (click)="tableExpanded.set(!tableExpanded())">
                    {{ tableExpanded() ? 'Collapse' : 'Expand' }}
                  </button>
                </div>

                @if (tableExpanded()) {
                  @if (boxes().length > 0) {
                    <div class="table-responsive inspector-markers-table">
                      <table class="table table-sm table-hover align-middle mb-0 small">
                        <thead>
                          <tr>
                            <th>Signer</th>
                            <th>Page</th>
                            <th>X</th>
                            <th>Y</th>
                            <th>W</th>
                            <th>H</th>
                            <th>{{ selectedProvider() === 'all' ? 'NSDL Token' : activeProviderOption().label + ' Token' }}</th>
                            <th class="text-end">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (box of boxes(); track box.id) {
                            @let signer = signerFor(box.signerId);
                            <tr [class.table-active]="selectedBoxId() === box.id">
                              <td>
                                @if (signer) {
                                  <span class="signer-swatch me-1" [style.background]="signer.color"></span>
                                  {{ signer.name }}
                                }
                              </td>
                              <td class="font-mono">{{ box.page }}</td>
                              <td class="font-mono">{{ Math.round(box.pdf.x) }}</td>
                              <td class="font-mono">{{ Math.round(box.pdf.y) }}</td>
                              <td class="font-mono">{{ Math.round(box.pdf.width) }}</td>
                              <td class="font-mono">{{ Math.round(box.pdf.height) }}</td>
                              <td class="font-mono text-secondary">{{ tokenForActiveProvider(box) }}</td>
                              <td class="text-end text-nowrap">
                                <button type="button" class="btn btn-sm btn-outline-secondary py-0 me-1" (click)="selectAndJumpToBox(box)">
                                  Go
                                </button>
                                <button type="button" class="btn btn-sm btn-outline-danger py-0" (click)="deleteBox(box.id)">
                                  <i class="bi bi-trash"></i>
                                </button>
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  } @else {
                    <p class="small text-secondary mb-0">No signature boxes placed yet.</p>
                  }
                }
              </div>
            </div>
          </div>
        </div>
      }
    </div>

    <!-- Settings Modal Template (rendered via ModalService) -->
    <ng-template #settingsModal>
      <form [formGroup]="settingsForm" class="row g-3">
        <div class="col-12 d-flex flex-column gap-2">
          <div class="form-check form-switch">
            <input class="form-check-input" type="checkbox" id="coordShowGrid" formControlName="showGrid" />
            <label class="form-check-label small" for="coordShowGrid">Show coordinate grid on page</label>
          </div>
          <div class="form-check form-switch">
            <input class="form-check-input" type="checkbox" id="coordSnapGrid" formControlName="snapToGrid" />
            <label class="form-check-label small" for="coordSnapGrid">Snap boxes to grid step</label>
          </div>
        </div>
        <div class="col-sm-6">
          <label class="form-label small text-secondary mb-1">Snap / Grid Step (PDF pt)</label>
          <input type="number" class="form-control form-control-sm font-mono" formControlName="snapSize" min="1" />
        </div>
        <div class="col-sm-6">
          <label class="form-label small text-secondary mb-1">Coordinate Rounding</label>
          <select class="form-select form-select-sm" formControlName="exportRounding">
            <option value="integer">Integer (NSDL default)</option>
            <option value="float">Exact float</option>
          </select>
        </div>
        <div class="col-sm-6">
          <label class="form-label small text-secondary mb-1">Default Width (pt)</label>
          <input type="number" class="form-control form-control-sm font-mono" formControlName="defaultWidth" min="10" />
        </div>
        <div class="col-sm-6">
          <label class="form-label small text-secondary mb-1">Default Height (pt)</label>
          <input type="number" class="form-control form-control-sm font-mono" formControlName="defaultHeight" min="10" />
        </div>
      </form>
    </ng-template>
  `,
  styles: [`
    .cursor-pointer { cursor: pointer; }
    .border-dashed { border-style: dashed !important; }
    .dropzone-box:hover {
      border-color: var(--bs-primary) !important;
      background-color: rgba(var(--bs-primary-rgb), 0.05);
    }
    .signer-swatch {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 3px;
      flex-shrink: 0;
    }
    .workspace-split {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      min-height: 0;
    }
    .workspace-stage-col,
    .workspace-inspector-col {
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
    }
    .stage-card,
    .inspector-panel {
      height: calc(100vh - 220px);
      min-height: 460px;
    }
    .viewer-host {
      min-height: 0;
      overflow: auto;
      scrollbar-gutter: stable;
      background: rgba(100, 116, 139, 0.25);
    }
    .floating-banner {
      position: sticky;
      top: 0;
      z-index: 8;
      margin-top: -4px;
      margin-bottom: -30px !important;
      pointer-events: auto;
    }
    .inspector-panel {
      overflow-y: auto;
      scrollbar-gutter: stable;
      container-type: inline-size;
      container-name: inspector;
    }
    .inspector-top-grid {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .inspector-pane-exports {
      border-top: 1px solid rgba(108, 117, 125, 0.25);
      padding-top: 0.5rem;
    }
    .inspector-markers-table {
      max-height: 280px;
    }
    @media (min-width: 992px) {
      .workspace-split {
        flex-direction: row;
        flex: 1 1 0%;
        min-height: 460px;
      }
      .workspace-stage-col {
        flex: 0 0 auto;
        width: clamp(340px, var(--stage-col-width, 798px), calc(100% - 380px));
        max-width: calc(100% - 380px);
      }
      .workspace-inspector-col {
        flex: 1 1 0%;
      }
      .stage-card,
      .inspector-panel {
        height: auto;
        flex: 1 1 0%;
        min-height: 460px;
      }
    }
    @container inspector (min-width: 560px) {
      .inspector-top-grid {
        display: grid;
        grid-template-columns: minmax(220px, 0.9fr) minmax(260px, 1.1fr);
        gap: 0.75rem;
        align-items: start;
      }
      .inspector-pane-exports {
        border-top: none;
        border-left: 1px solid rgba(108, 117, 125, 0.25);
        padding-top: 0;
        padding-left: 0.75rem;
        height: 100%;
      }
    }
    .page-stage {
      position: relative;
      background: #fff;
      user-select: none;
    }
    .page-stage--placing {
      cursor: crosshair;
      touch-action: none;
    }
    .page-grid-overlay {
      position: absolute;
      inset: 0;
      z-index: 2;
      pointer-events: none;
      background-image:
        linear-gradient(to right, rgb(0 0 0 / 7%) 1px, transparent 1px),
        linear-gradient(to top, rgb(0 0 0 / 7%) 1px, transparent 1px);
      background-size: var(--grid-size, 10px) var(--grid-size, 10px);
      background-position: left bottom;
    }
    .page-canvas {
      display: block;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
    .draft-rect {
      position: absolute;
      z-index: 4;
      pointer-events: none;
      border: 1.5px dashed var(--bs-primary);
      background: rgba(13, 110, 253, 0.14);
    }
    .guide-v, .guide-h {
      position: absolute;
      z-index: 5;
      pointer-events: none;
      background: rgba(13, 110, 253, 0.65);
    }
    .guide-v { top: 0; bottom: 0; width: 1px; }
    .guide-h { left: 0; right: 0; height: 1px; }
    .guide-label {
      position: absolute;
      z-index: 6;
      pointer-events: none;
      background: var(--bs-dark);
      color: #fff;
      font-size: 11px;
      padding: 1px 6px;
      border-radius: 4px;
      white-space: nowrap;
    }
    .sig-marker {
      position: absolute;
      z-index: 3;
      border: 2px solid;
      cursor: move;
      touch-action: none;
    }
    .sig-marker--selected {
      outline: 2px solid rgba(255, 255, 255, 0.9);
      box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.45);
      z-index: 4;
    }
    .sig-marker__badge {
      position: absolute;
      top: -19px;
      left: -2px;
      color: #fff;
      font-size: 10px;
      font-weight: 600;
      padding: 1px 5px;
      border-radius: 3px 3px 0 0;
      white-space: nowrap;
      pointer-events: none;
    }
    .sig-handle {
      position: absolute;
      width: 9px;
      height: 9px;
      background: #fff;
      border: 2px solid;
      border-radius: 2px;
    }
    .sig-handle--nw { top: -5px; left: -5px; cursor: nwse-resize; }
    .sig-handle--n { top: -5px; left: calc(50% - 4.5px); cursor: ns-resize; }
    .sig-handle--ne { top: -5px; right: -5px; cursor: nesw-resize; }
    .sig-handle--e { top: calc(50% - 4.5px); right: -5px; cursor: ew-resize; }
    .sig-handle--se { bottom: -5px; right: -5px; cursor: nwse-resize; }
    .sig-handle--s { bottom: -5px; left: calc(50% - 4.5px); cursor: ns-resize; }
    .sig-handle--sw { bottom: -5px; left: -5px; cursor: nesw-resize; }
    .sig-handle--w { top: calc(50% - 4.5px); left: -5px; cursor: ew-resize; }
  `]
})
export class PdfSignatureCoordinatesComponent implements OnInit {
  @ViewChild('settingsModal') public settingsModal?: TemplateRef<unknown>;
  private readonly workspaceGrid = viewChild<ElementRef<HTMLElement>>('workspaceGrid');
  private readonly viewerHost = viewChild<ElementRef<HTMLElement>>('viewerHost');
  private readonly pdfCanvas = viewChild<ElementRef<HTMLCanvasElement>>('pdfCanvas');

  constructor(
    private fb: FormBuilder,
    private notifyService: NotificationService,
    private modalService: ModalService,
    private destroyRef: DestroyRef
  ) {
    effect(() => {
      const gridEl = this.workspaceGrid()?.nativeElement;
      if (gridEl && this.mode() === 'workspace') {
        this.attachResizeObserver(gridEl);
      }
    });

    effect(() => {
      const inWorkspace = this.mode() === 'workspace';
      const rev = this.docRevision();
      const pageNumber = this.currentPage();
      const zoom = this.zoom();
      const rot = this.userRotation();
      const canvasEl = this.pdfCanvas()?.nativeElement;
      void zoom;
      void rot;
      if (!inWorkspace) {
        this.lastRenderedKey = '';
        this.lastRenderedCanvas = null;
        return;
      }
      if (rev > 0 && canvasEl && untracked(() => this.pdfDoc)) {
        queueMicrotask(() => void this.renderPage(pageNumber, canvasEl));
      }
    });

    effect(() => {
      const sel = this.selectedBox();
      if (sel && this.boxForm) {
        this.boxForm.patchValue(
          {
            signerId: sel.signerId,
            page: sel.page,
            x: Math.round(sel.pdf.x * 100) / 100,
            y: Math.round(sel.pdf.y * 100) / 100,
            width: Math.round(sel.pdf.width * 100) / 100,
            height: Math.round(sel.pdf.height * 100) / 100
          },
          { emitEvent: false }
        );
      }
    });

    effect(() => {
      const page = this.currentPage();
      if (this.pageJumpForm) {
        this.pageJumpForm.patchValue({ page }, { emitEvent: false });
      }
    });

    this.destroyRef.onDestroy(() => {
      this.cleanupInteractions();
      this.resizeObserver?.disconnect();
      void this.disposePdfDoc();
    });
  }

  public Math = Math;
  public readonly providerOptions = ESIGN_PROVIDER_OPTIONS;
  public readonly resizeHandles: readonly ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  public readonly zoomPresets = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

  public selectedProvider = signal<EsignProvider>('all');
  public mode = signal<'setup' | 'workspace'>('setup');
  public isDraggingPdf = signal(false);
  public loadingPdf = signal(false);
  public docMeta = signal<PdfDocumentMeta | null>(null);
  public pageCount = signal(0);
  public currentPage = signal(1);
  public zoom = signal(1.25);
  public fitMode = signal<'none' | 'width'>('none');
  public userRotation = signal(0);
  public pageInfos = signal<PdfPageInfo[]>([]);
  public containerWidth = signal(800);

  public signers = signal<Signer[]>([{ id: 1, name: DEFAULT_SIGNER_NAMES[0], color: SIGNER_COLORS[0] }]);
  public activeSignerId = signal(1);
  public boxes = signal<SignatureBox[]>([]);
  public selectedBoxId = signal<string | null>(null);
  public placementMode = signal(false);
  public copiedBox = signal<{ box: SignatureBox; sourcePage: number } | null>(null);
  public undoStack = signal<SignatureBox[][]>([]);
  public redoStack = signal<SignatureBox[][]>([]);
  public tableExpanded = signal(true);
  public draftRect = signal<DraftRect | null>(null);
  public pointerGuide = signal<PointerGuide | null>(null);

  // Settings reactive state
  public showGrid = signal(true);
  public snapToGrid = signal(true);
  public snapSize = signal(1);
  public exportRounding = signal<ExportRounding>('integer');
  public defaultWidth = signal(150);
  public defaultHeight = signal(50);

  public pageJumpForm!: FormGroup;
  public importForm!: FormGroup;
  public boxForm!: FormGroup;
  public settingsForm!: FormGroup;

  private pdfDoc: PDFDocumentProxy | null = null;
  private docRevision = signal(0);
  private pageCache = new Map<number, PDFPageProxy>();
  private activeRenderTask: RenderTask | null = null;
  private renderEpoch = 0;
  private lastRenderedKey = '';
  private lastRenderedCanvas: HTMLCanvasElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private activeInteractionCleanup: (() => void) | null = null;
  private orderCounter = 0;

  public readonly hasDocument = computed(() => this.docMeta() !== null);
  public readonly activeSigner = computed(
    () => this.signers().find((s) => s.id === this.activeSignerId()) ?? this.signers()[0]
  );
  public readonly currentPageInfo = computed(
    () => this.pageInfos().find((p) => p.pageNumber === this.currentPage()) ?? null
  );
  public readonly stageColumnWidthPx = computed(() => {
    const renderedW = this.currentPageInfo()?.renderedWidth ?? 595 * this.zoom();
    return Math.ceil(renderedW + 54);
  });
  public readonly currentPageBoxes = computed(() =>
    this.boxes().filter((b) => b.page === this.currentPage())
  );
  public readonly selectedBox = computed(
    () => this.boxes().find((b) => b.id === this.selectedBoxId()) ?? null
  );
  public readonly allIssues = computed(() => validateSignatureBoxes(this.boxes(), this.pageInfos()));
  public readonly selectedBoxIssues = computed(() => {
    const id = this.selectedBoxId();
    return id ? this.allIssues().filter((i) => i.boxId === id) : [];
  });
  public readonly activeProviderOption = computed(
    () => this.providerOptions.find((p) => p.id === this.selectedProvider()) ?? this.providerOptions[0]
  );
  public readonly nsdlCombined = computed(() =>
    serializeNsdlBoxes(this.boxes(), this.exportRounding(), (p) => this.pageWidthFor(p))
  );
  public readonly combinedProviderOutput = computed(() => {
    const prov = this.selectedProvider();
    const target: Exclude<EsignProvider, 'all'> = prov === 'all' ? 'nsdl' : prov;
    return formatBoxesForProvider(
      target,
      this.boxes(),
      this.signers(),
      this.exportRounding(),
      (p) => this.pageWidthFor(p),
      (p) => this.pageHeightFor(p)
    );
  });
  public readonly signerExports = computed(() =>
    this.signers().map((s) => {
      const signerBoxes = this.boxes().filter((b) => b.signerId === s.id);
      return {
        signerId: s.id,
        name: s.name,
        color: s.color,
        nsdl: serializeNsdlBoxes(signerBoxes, this.exportRounding(), (p) => this.pageWidthFor(p)),
        emudhra: serializeEmudhraBoxes(signerBoxes, this.exportRounding()),
        cvl: serializeCvlBoxes(signerBoxes, this.exportRounding(), (p) => this.pageHeightFor(p)),
        digio: serializeDigioForSigner(signerBoxes, this.exportRounding()),
        cdsl: serializeCdslBoxes(signerBoxes, this.exportRounding()),
        leegality: formatBoxesForProvider(
          'leegality',
          signerBoxes,
          [s],
          this.exportRounding(),
          (p) => this.pageWidthFor(p),
          (p) => this.pageHeightFor(p)
        )
      };
    })
  );

  ngOnInit(): void {
    this.pageJumpForm = this.fb.group({
      page: [this.currentPage()]
    });
    this.importForm = this.fb.group({
      signerId: [1],
      nsdlText: ['']
    });
    this.boxForm = this.fb.group({
      signerId: [1],
      page: [1],
      x: [0],
      y: [0],
      width: [150],
      height: [50]
    });
    this.settingsForm = this.fb.group({
      showGrid: [true],
      snapToGrid: [true],
      snapSize: [1],
      exportRounding: ['integer' as ExportRounding],
      defaultWidth: [150],
      defaultHeight: [50]
    });
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeyDown(event: KeyboardEvent): void {
    if (this.mode() !== 'workspace') return;
    const tag = (event.target as HTMLElement | null)?.tagName ?? '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      this.redo();
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      const sel = this.selectedBox();
      if (sel) {
        event.preventDefault();
        this.deleteBox(sel.id);
      }
      return;
    }
    const sel = this.selectedBox();
    if (!sel) return;
    const step = event.shiftKey ? 0.25 : 1;
    let dx = 0;
    let dy = 0;
    if (event.key === 'ArrowLeft') dx = -step;
    else if (event.key === 'ArrowRight') dx = step;
    else if (event.key === 'ArrowUp') dy = step;
    else if (event.key === 'ArrowDown') dy = -step;
    else return;

    event.preventDefault();
    const page = this.pageInfoFor(sel.page);
    if (!page) return;
    this.checkpoint();
    const moved = clampToPage(
      { ...sel.pdf, x: sel.pdf.x + dx, y: sel.pdf.y + dy },
      page.pdfWidth,
      page.pdfHeight,
      page.originX,
      page.originY
    );
    this.updateBoxPdf(sel.id, moved);
  }

  public formatSize(bytes: number): string {
    return formatBytes(bytes);
  }

  public onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingPdf.set(true);
  }

  public async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.isDraggingPdf.set(false);
    const file = Array.from(event.dataTransfer?.files || []).find(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (file) await this.loadPdfFile(file);
    else this.notifyService.error('Please drop a valid PDF file.');
  }

  public async onPdfFileInput(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) await this.loadPdfFile(file);
  }

  private async loadPdfFile(file: File): Promise<void> {
    this.loadingPdf.set(true);
    await this.disposePdfDoc();
    try {
      ensurePromiseTryPolyfill();
      GlobalWorkerOptions.workerSrc =
        typeof document !== 'undefined'
          ? new URL('vendor/pdfjs/pdf.worker.min.mjs', document.baseURI).toString()
          : '/vendor/pdfjs/pdf.worker.min.mjs';
      const bytes = new Uint8Array(await file.arrayBuffer());
      this.pdfDoc = await getDocument({ data: bytes.slice() }).promise;
      this.pageCount.set(this.pdfDoc.numPages);
      this.currentPage.set(1);
      this.userRotation.set(0);
      this.fitMode.set('none');
      this.zoom.set(1.25);
      this.boxes.set([]);
      this.selectedBoxId.set(null);
      this.undoStack.set([]);
      this.redoStack.set([]);
      await this.refreshPageInfos();
      this.docMeta.set({
        documentName: file.name,
        pageCount: this.pdfDoc.numPages,
        fileSizeBytes: file.size
      });
      this.docRevision.update((v) => v + 1);
      this.notifyService.success(`Loaded ${file.name} (${this.pdfDoc.numPages} pages)`);
    } catch (err) {
      this.notifyService.error((err as Error)?.message || 'Failed to load PDF.');
      await this.disposePdfDoc();
    } finally {
      this.loadingPdf.set(false);
    }
  }

  public setSignerCount(count: number): void {
    const clamped = Math.min(5, Math.max(1, count));
    const current = this.signers();
    const next: Signer[] = [];
    for (let i = 1; i <= clamped; i++) {
      const existing = current.find((s) => s.id === i);
      next.push(existing ?? { id: i, name: DEFAULT_SIGNER_NAMES[i - 1], color: SIGNER_COLORS[i - 1] });
    }
    this.signers.set(next);
    if (!next.some((s) => s.id === this.activeSignerId())) {
      this.activeSignerId.set(next[0].id);
    }
  }

  public updateSignerName(id: number, name: string): void {
    this.signers.update((list) => list.map((s) => (s.id === id ? { ...s, name } : s)));
  }

  public importNsdlString(): void {
    const signerId = Number(this.importForm.get('signerId')?.value ?? 1);
    const raw = (this.importForm.get('nsdlText')?.value ?? '').trim();
    if (!raw) return;

    try {
      const tokens = parseProviderCoordinates(
        raw,
        (p) => this.pageWidthFor(p),
        (p) => this.pageHeightFor(p),
        this.selectedProvider()
      );
      this.checkpoint();
      const imported: SignatureBox[] = tokens.map((t) => ({
        id: this.newBoxId(),
        signerId,
        page: Math.min(Math.max(1, t.page), Math.max(1, this.pageCount())),
        pdf: { x: t.x, y: t.y, width: t.width, height: t.height },
        createdAt: Date.now(),
        order: this.orderCounter++
      }));
      this.boxes.update((list) => [...list.filter((b) => b.signerId !== signerId), ...imported]);
      this.importForm.patchValue({ nsdlText: '' });
      this.notifyService.success(`Imported ${imported.length} box(es)`);
    } catch (err) {
      this.notifyService.error((err as Error)?.message || 'Invalid coordinate string or JSON.');
    }
  }

  public submitPageJump(): void {
    const raw = this.pageJumpForm?.get('page')?.value;
    const text = raw === null || raw === undefined ? '' : String(raw).trim();
    const parsed = Number(text);
    if (!text || !Number.isFinite(parsed)) {
      this.pageJumpForm?.patchValue({ page: this.currentPage() }, { emitEvent: false });
      return;
    }
    this.goToPage(Math.trunc(parsed));
  }

  public goToPage(page: number): void {
    const max = this.pageCount();
    if (max === 0) return;
    const target = Math.min(Math.max(1, Math.trunc(page)), max);
    this.currentPage.set(target);
    this.pageJumpForm?.patchValue({ page: target }, { emitEvent: false });
  }

  public async setZoom(z: number): Promise<void> {
    this.fitMode.set('none');
    this.zoom.set(Math.min(4, Math.max(0.25, z)));
    await this.refreshPageInfos();
  }

  public async fitWidth(): Promise<void> {
    this.fitMode.set('width');
    await this.refreshPageInfos();
  }

  public async rotateClockwise(): Promise<void> {
    this.userRotation.set((this.userRotation() + 90) % 360);
    await this.refreshPageInfos();
  }

  public nearestZoomPreset(): number {
    const z = this.zoom();
    return this.zoomPresets.reduce((best, p) => (Math.abs(p - z) < Math.abs(best - z) ? p : best), 1);
  }

  public openSettingsModal(): void {
    if (!this.settingsModal) return;
    this.settingsForm.patchValue({
      showGrid: this.showGrid(),
      snapToGrid: this.snapToGrid(),
      snapSize: this.snapSize(),
      exportRounding: this.exportRounding(),
      defaultWidth: this.defaultWidth(),
      defaultHeight: this.defaultHeight()
    });
    this.modalService.open({
      title: 'PDF Coordinate Settings',
      size: 'md',
      template: this.settingsModal,
      confirmText: 'Apply',
      cancelText: 'Cancel',
      onConfirm: () => {
        const v = this.settingsForm.value;
        this.showGrid.set(!!v.showGrid);
        this.snapToGrid.set(!!v.snapToGrid);
        this.snapSize.set(Math.max(1, Number(v.snapSize) || 1));
        this.exportRounding.set(v.exportRounding === 'float' ? 'float' : 'integer');
        this.defaultWidth.set(Math.max(10, Number(v.defaultWidth) || 150));
        this.defaultHeight.set(Math.max(10, Number(v.defaultHeight) || 50));
      }
    });
  }

  public gridSizePx(page: PdfPageInfo): number {
    const unit = Math.max(0.5, this.snapSize()) * page.scale;
    return unit >= 8 ? unit : unit * Math.ceil(8 / unit);
  }

  public screenRectFor(box: SignatureBox, page: PdfPageInfo): ScreenRect {
    return pdfToScreen(box.pdf, transformInputFromPage(page));
  }

  public signerFor(signerId: number): Signer | undefined {
    return this.signers().find((s) => s.id === signerId);
  }

  public countForSigner(signerId: number): number {
    return this.boxes().filter((b) => b.signerId === signerId).length;
  }

  public onStagePointerDown(event: PointerEvent, page: PdfPageInfo): void {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement | null)?.closest('.sig-marker')) return;
    if (!this.placementMode()) {
      this.selectedBoxId.set(null);
      return;
    }

    event.preventDefault();
    const stage = event.currentTarget as HTMLElement;
    const toCss = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      return { x: Math.min(Math.max(0, e.clientX - r.left), r.width), y: Math.min(Math.max(0, e.clientY - r.top), r.height) };
    };
    const start = toCss(event);

    const onMove = (e: PointerEvent) => {
      const end = toCss(e);
      const draft: DraftRect = {
        page: page.pageNumber,
        left: Math.min(start.x, end.x),
        top: Math.min(start.y, end.y),
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y)
      };
      this.draftRect.set(draft);
      this.updatePointerGuide(page, end.x, end.y, draft);
    };

    const finish = (e: PointerEvent, commit: boolean) => {
      this.cleanupInteractions();
      const end = toCss(e);
      const draft: DraftRect = {
        page: page.pageNumber,
        left: Math.min(start.x, end.x),
        top: Math.min(start.y, end.y),
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y)
      };
      this.draftRect.set(null);
      this.pointerGuide.set(null);
      if (!commit) return;

      const dragged = Math.hypot(end.x - start.x, end.y - start.y) >= 5 && draft.width >= 5 && draft.height >= 5;
      const input = transformInputFromPage(page);
      let pdfRect: PdfRect;
      if (dragged) {
        pdfRect = screenToPdf(draft, input);
      } else {
        const pt = cssPointToPdfPoint(start.x, start.y, input);
        const w = this.defaultWidth();
        const h = this.defaultHeight();
        pdfRect = { x: pt.x - w / 2, y: pt.y - h / 2, width: w, height: h };
      }

      const finalRect = commitPdf(
        { ...pdfRect, width: Math.max(10, pdfRect.width), height: Math.max(10, pdfRect.height) },
        page,
        { snap: this.snapToGrid(), snapSize: this.snapSize(), integer: this.exportRounding() === 'integer' }
      );
      this.addBox(page.pageNumber, finalRect);
      this.placementMode.set(false);
    };

    const onUp = (e: PointerEvent) => finish(e, true);
    const onCancel = (e: PointerEvent) => finish(e, false);
    this.registerInteraction(onMove, onUp, onCancel);
  }

  public onStagePointerMove(event: PointerEvent, page: PdfPageInfo): void {
    if (!this.placementMode() || this.draftRect()) return;
    const r = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.updatePointerGuide(page, Math.min(Math.max(0, event.clientX - r.left), r.width), Math.min(Math.max(0, event.clientY - r.top), r.height));
  }

  private updatePointerGuide(page: PdfPageInfo, cssX: number, cssY: number, draft?: ScreenRect): void {
    const pt = cssPointToPdfPoint(cssX, cssY, transformInputFromPage(page));
    const label = draft && draft.width >= 5 && draft.height >= 5
      ? (() => {
          const p = screenToPdf(draft, transformInputFromPage(page));
          return `${Math.round(p.x)},${Math.round(p.y)} · ${Math.round(p.width)}×${Math.round(p.height)}`;
        })()
      : `${Math.round(pt.x)}, ${Math.round(pt.y)}`;
    this.pointerGuide.set({
      x: cssX,
      y: cssY,
      labelX: cssX > page.renderedWidth - 130 ? Math.max(0, cssX - 130) : cssX + 10,
      labelY: cssY > page.renderedHeight - 28 ? Math.max(0, cssY - 24) : cssY + 8,
      label
    });
  }

  public onMarkerDragStart(event: PointerEvent, box: SignatureBox, page: PdfPageInfo): void {
    if (event.button !== 0 || (event.target as HTMLElement).closest('.sig-handle')) return;
    event.preventDefault();
    event.stopPropagation();
    this.selectedBoxId.set(box.id);
    this.checkpoint();

    const startX = event.clientX;
    const startY = event.clientY;
    const startPdf = { ...box.pdf };
    const sx = page.pdfWidth / page.renderedWidth;
    const sy = page.pdfHeight / page.renderedHeight;
    let latest = { ...startPdf };

    const onMove = (e: PointerEvent) => {
      latest = alignPdf(
        { ...startPdf, x: startPdf.x + (e.clientX - startX) * sx, y: startPdf.y - (e.clientY - startY) * sy },
        page,
        this.snapToGrid() ? this.snapSize() : 0
      );
      this.updateBoxPdf(box.id, latest);
    };
    const onUp = () => {
      this.cleanupInteractions();
      this.updateBoxPdf(box.id, commitPdf(latest, page, {
        snap: this.snapToGrid(),
        snapSize: this.snapSize(),
        integer: this.exportRounding() === 'integer'
      }));
    };
    this.registerInteraction(onMove, onUp, onUp);
  }

  public onMarkerResizeStart(event: PointerEvent, box: SignatureBox, page: PdfPageInfo, handle: ResizeHandle): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    this.selectedBoxId.set(box.id);
    this.checkpoint();

    const startX = event.clientX;
    const startY = event.clientY;
    const start = { ...box.pdf };
    const sx = page.pdfWidth / page.renderedWidth;
    const sy = page.pdfHeight / page.renderedHeight;
    const minSize = 10;
    let latest = { ...start };

    const onMove = (e: PointerEvent) => {
      const dx = (e.clientX - startX) * sx;
      const dyCss = (e.clientY - startY) * sy;
      let { x, y, width, height } = start;
      if (handle.includes('e')) width = start.width + dx;
      if (handle.includes('w')) { x = start.x + dx; width = start.width - dx; }
      if (handle.includes('n')) { height = start.height - dyCss; y = start.y + dyCss; }
      if (handle.includes('s')) { y = start.y - dyCss; height = start.height + dyCss; }

      if (width < minSize) {
        if (handle.includes('w')) x = start.x + start.width - minSize;
        width = minSize;
      }
      if (height < minSize) {
        y = start.y + start.height - minSize;
        height = minSize;
      }
      latest = alignPdf({ x, y, width, height }, page, this.snapToGrid() ? this.snapSize() : 0);
      this.updateBoxPdf(box.id, latest);
    };
    const onUp = () => {
      this.cleanupInteractions();
      this.updateBoxPdf(box.id, commitPdf(latest, page, {
        snap: this.snapToGrid(),
        snapSize: this.snapSize(),
        integer: this.exportRounding() === 'integer'
      }));
    };
    this.registerInteraction(onMove, onUp, onUp);
  }

  public applyBoxForm(): void {
    const sel = this.selectedBox();
    if (!sel) return;
    const v = this.boxForm.value;
    const targetPage = Math.min(Math.max(1, Number(v.page) || sel.page), this.pageCount());
    const info = this.pageInfoFor(targetPage) ?? this.currentPageInfo();
    const raw: PdfRect = {
      x: Number(v.x) || 0,
      y: Number(v.y) || 0,
      width: Math.max(10, Number(v.width) || 10),
      height: Math.max(10, Number(v.height) || 10)
    };
    const pdf = info ? clampToPage(raw, info.pdfWidth, info.pdfHeight, info.originX, info.originY) : raw;
    this.checkpoint();
    this.boxes.update((list) =>
      list.map((b) => (b.id === sel.id ? { ...b, signerId: Number(v.signerId) || b.signerId, page: targetPage, pdf } : b))
    );
  }

  public applyPresetSize(width: number, height: number): void {
    const sel = this.selectedBox();
    const page = sel ? this.pageInfoFor(sel.page) : null;
    if (!sel || !page) return;
    this.checkpoint();
    this.updateBoxPdf(sel.id, clampToPage({ ...sel.pdf, width, height }, page.pdfWidth, page.pdfHeight, page.originX, page.originY));
  }

  public copyBoxToClipboard(box: SignatureBox): void {
    this.copiedBox.set({ box: { ...box, pdf: { ...box.pdf } }, sourcePage: box.page });
    this.notifyService.info(`Copied box from page ${box.page}`);
  }

  public pasteCopiedBox(): void {
    const clip = this.copiedBox();
    const page = this.currentPageInfo();
    if (!clip || !page) return;
    const clamped = clampToPage(clip.box.pdf, page.pdfWidth, page.pdfHeight, page.originX, page.originY);
    this.addBox(page.pageNumber, clamped, clip.box.signerId);
  }

  public duplicateBox(box: SignatureBox): void {
    const page = this.pageInfoFor(box.page);
    if (!page) return;
    const shifted = clampToPage(
      { ...box.pdf, x: box.pdf.x + 12, y: box.pdf.y - 12 },
      page.pdfWidth,
      page.pdfHeight,
      page.originX,
      page.originY
    );
    this.addBox(box.page, shifted, box.signerId);
  }

  public deleteBox(id: string): void {
    this.checkpoint();
    this.boxes.update((list) => list.filter((b) => b.id !== id));
    if (this.selectedBoxId() === id) this.selectedBoxId.set(null);
  }

  public selectAndJumpToBox(box: SignatureBox): void {
    this.goToPage(box.page);
    this.selectedBoxId.set(box.id);
  }

  public tokenForActiveProvider(box: SignatureBox): string {
    switch (this.selectedProvider()) {
      case 'emudhra':
        return serializeEmudhraBoxes([box], this.exportRounding());
      case 'cvl':
        return serializeCvlBoxes([box], this.exportRounding(), (p) => this.pageHeightFor(p));
      case 'cdsl':
        return serializeCdslBoxes([box], this.exportRounding());
      default:
        return serializeNsdlBoxes([box], this.exportRounding(), (p) => this.pageWidthFor(p));
    }
  }

  public undo(): void {
    const stack = this.undoStack();
    if (stack.length === 0) return;
    this.redoStack.update((r) => [this.cloneBoxes(this.boxes()), ...r]);
    this.boxes.set(stack[0]);
    this.undoStack.set(stack.slice(1));
  }

  public redo(): void {
    const stack = this.redoStack();
    if (stack.length === 0) return;
    this.undoStack.update((u) => [this.cloneBoxes(this.boxes()), ...u]);
    this.boxes.set(stack[0]);
    this.redoStack.set(stack.slice(1));
  }

  public signerOutputPreview(row: {
    nsdl: string;
    emudhra: string;
    cvl: string;
    digio: string;
    cdsl: string;
    leegality: string;
  }): string {
    switch (this.selectedProvider()) {
      case 'emudhra':
        return row.emudhra;
      case 'cvl':
        return row.cvl;
      case 'digio':
        return row.digio;
      case 'cdsl':
        return row.cdsl;
      case 'leegality':
        return row.leegality;
      default:
        return row.nsdl;
    }
  }

  public copyActiveProviderOutput(): void {
    const prov = this.selectedProvider();
    this.copyProviderOutput(prov === 'all' ? 'nsdl' : prov);
  }

  public copyProviderOutput(provider: Exclude<EsignProvider, 'all'>): void {
    const text = formatBoxesForProvider(
      provider,
      this.boxes(),
      this.signers(),
      this.exportRounding(),
      (p) => this.pageWidthFor(p),
      (p) => this.pageHeightFor(p)
    );
    const label = this.providerOptions.find((o) => o.id === provider)?.label ?? provider.toUpperCase();
    this.copyText(text, label);
  }

  public copyText(text: string, label: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(
      () => this.notifyService.success(`Copied ${label} coordinates`),
      () => this.notifyService.error('Failed to copy to clipboard')
    );
  }

  public downloadTxt(): void {
    const doc = this.docMeta();
    if (!doc) return;
    const data = buildSignatureExportData(
      doc,
      this.boxes(),
      this.signers(),
      this.exportRounding(),
      (p) => this.pageWidthFor(p),
      (p) => this.pageHeightFor(p)
    );
    const lines = [
      '# All signers (NSDL)',
      data.nsdlCoordinates || '(none)',
      '',
      ...this.signers().map((s) => `# ${s.name} (NSDL)\n${data.perSignerCoordinates[s.id] || '(none)'}`),
      '',
      '# All signers (eMudhra)',
      data.emudhraCoordinates || '(none)',
      ...this.signers().map((s) => `# ${s.name} (eMudhra)\n${data.perSignerEmudhra[s.id] || '(none)'}`),
      '',
      '# All signers (CVL - top-left x,y,width,height)',
      data.cvlCoordinates || '(none)',
      ...this.signers().map((s) => `# ${s.name} (CVL)\n${data.perSignerCvl[s.id] || '(none)'}`),
      '',
      '# All signers (CDSL)',
      data.cdslCoordinates || '(none)',
      '',
      '# Digio sign_coordinates',
      JSON.stringify({ display_on_page: 'custom', sign_coordinates: data.digioCoordinates }, null, 2),
      '',
      '# Leegality signatureCoordinates',
      JSON.stringify({ signatureCoordinates: data.leegalityCoordinates }, null, 2)
    ];
    this.downloadBlob(lines.join('\n') + '\n', `${this.baseName(doc.documentName)}-coordinates.txt`, 'text/plain');
  }

  public downloadJson(): void {
    const doc = this.docMeta();
    if (!doc) return;
    const data = buildSignatureExportData(
      doc,
      this.boxes(),
      this.signers(),
      this.exportRounding(),
      (p) => this.pageWidthFor(p),
      (p) => this.pageHeightFor(p)
    );
    this.downloadBlob(JSON.stringify(data, null, 2), `${this.baseName(doc.documentName)}-coordinates.json`, 'application/json');
  }

  public async clearAll(): Promise<void> {
    this.boxes.set([]);
    this.selectedBoxId.set(null);
    this.copiedBox.set(null);
    this.undoStack.set([]);
    this.redoStack.set([]);
    this.placementMode.set(false);
    this.fitMode.set('none');
    this.zoom.set(1.25);
    this.mode.set('setup');
    await this.disposePdfDoc();
  }

  public hexToRgba(hex: string, alpha: number): string {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const n = Number.parseInt(full, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }

  private addBox(page: number, pdf: PdfRect, signerId = this.activeSignerId()): void {
    this.checkpoint();
    const box: SignatureBox = {
      id: this.newBoxId(),
      signerId,
      page,
      pdf,
      createdAt: Date.now(),
      order: this.orderCounter++
    };
    this.boxes.update((list) => [...list, box]);
    this.selectedBoxId.set(box.id);
  }

  private updateBoxPdf(id: string, pdf: PdfRect): void {
    this.boxes.update((list) => list.map((b) => (b.id === id ? { ...b, pdf } : b)));
  }

  private checkpoint(): void {
    this.undoStack.update((u) => [this.cloneBoxes(this.boxes()), ...u].slice(0, 40));
    this.redoStack.set([]);
  }

  private cloneBoxes(list: SignatureBox[]): SignatureBox[] {
    return list.map((b) => ({ ...b, pdf: { ...b.pdf } }));
  }

  private pageInfoFor(page: number): PdfPageInfo | undefined {
    return this.pageInfos().find((p) => p.pageNumber === page);
  }

  private pageWidthFor(page: number): number {
    return this.pageInfoFor(page)?.pdfWidth ?? this.pageInfoFor(1)?.pdfWidth ?? 595;
  }

  private pageHeightFor(page: number): number {
    return this.pageInfoFor(page)?.pdfHeight ?? this.pageInfoFor(1)?.pdfHeight ?? 842;
  }

  private attachResizeObserver(host: HTMLElement): void {
    if (typeof ResizeObserver === 'undefined') return;
    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 40 && Math.abs(width - this.containerWidth()) >= 24) {
        this.containerWidth.set(width);
        if (this.fitMode() === 'width' && this.pdfDoc) void this.refreshPageInfos();
      }
    });
    this.resizeObserver.observe(host);
    if (host.clientWidth > 40 && Math.abs(host.clientWidth - this.containerWidth()) >= 24) {
      this.containerWidth.set(host.clientWidth);
      if (this.fitMode() === 'width' && this.pdfDoc) void this.refreshPageInfos();
    }
  }

  private async refreshPageInfos(): Promise<void> {
    if (!this.pdfDoc) {
      this.pageInfos.set([]);
      return;
    }
    const page1 = await this.getPdfPage(1);
    if (this.fitMode() === 'width') {
      const base = this.computePageInfo(page1, 1);
      const gridWidth = this.workspaceGrid()?.nativeElement?.clientWidth ?? 0;
      const availableWidth =
        gridWidth > 420
          ? Math.max(320, gridWidth - 388 - 54)
          : Math.max(260, this.containerWidth() - 54);
      const fitted = Math.max(0.35, Math.min(3, availableWidth / base.pdfWidth));
      this.zoom.set(fitted);
    }
    const infos: PdfPageInfo[] = [];
    for (let p = 1; p <= this.pdfDoc.numPages; p++) {
      const proxy = p === 1 ? page1 : this.pageCache.get(p);
      infos.push(proxy ? this.computePageInfo(proxy, p) : { ...this.computePageInfo(page1, 1), pageNumber: p });
    }
    this.pageInfos.set(infos);
  }

  private async renderPage(pageNumber: number, canvas: HTMLCanvasElement): Promise<void> {
    if (!this.pdfDoc) return;
    const epoch = ++this.renderEpoch;
    try {
      this.activeRenderTask?.cancel();
    } catch {
      /* ignore */
    }
    try {
      const page = await this.getPdfPage(pageNumber);
      if (epoch !== this.renderEpoch) return;
      const info = this.computePageInfo(page, pageNumber);
      const renderKey = `${this.docRevision()}:${pageNumber}:${info.scale.toFixed(4)}:${info.rotation}`;
      if (canvas === this.lastRenderedCanvas && renderKey === this.lastRenderedKey && canvas.width > 0 && canvas.height > 0) {
        this.patchPageInfo(info);
        return;
      }

      const dpr = Math.min(info.devicePixelRatio, 2);
      const viewport = page.getViewport({ scale: info.scale * dpr, rotation: info.rotation });
      const offscreen = document.createElement('canvas');
      offscreen.width = Math.max(1, Math.floor(viewport.width));
      offscreen.height = Math.max(1, Math.floor(viewport.height));
      const offCtx = offscreen.getContext('2d');
      if (!offCtx) return;

      offCtx.fillStyle = '#ffffff';
      offCtx.fillRect(0, 0, offscreen.width, offscreen.height);

      const task = page.render({ canvasContext: offCtx, viewport, canvas: offscreen } as any);
      this.activeRenderTask = task;
      await task.promise;
      if (epoch !== this.renderEpoch) return;
      this.activeRenderTask = null;

      canvas.width = offscreen.width;
      canvas.height = offscreen.height;
      canvas.style.width = `${info.renderedWidth}px`;
      canvas.style.height = `${info.renderedHeight}px`;
      const liveCtx = canvas.getContext('2d');
      if (liveCtx) {
        liveCtx.drawImage(offscreen, 0, 0);
      }
      this.lastRenderedKey = renderKey;
      this.lastRenderedCanvas = canvas;
      this.patchPageInfo(info);
    } catch (err: any) {
      if (err?.name === 'RenderingCancelledException' || epoch !== this.renderEpoch) {
        return;
      }
      this.notifyService.error(err?.message || `Failed to render page ${pageNumber}`);
    }
  }

  private patchPageInfo(info: PdfPageInfo): void {
    const list = this.pageInfos();
    const idx = list.findIndex((p) => p.pageNumber === info.pageNumber);
    if (idx < 0) return;
    const prev = list[idx];
    if (
      prev.pdfWidth === info.pdfWidth &&
      prev.pdfHeight === info.pdfHeight &&
      prev.renderedWidth === info.renderedWidth &&
      prev.renderedHeight === info.renderedHeight &&
      prev.originX === info.originX &&
      prev.originY === info.originY &&
      prev.scale === info.scale
    ) {
      return;
    }
    const next = [...list];
    next[idx] = info;
    this.pageInfos.set(next);
  }

  private async getPdfPage(pageNumber: number): Promise<PDFPageProxy> {
    const cached = this.pageCache.get(pageNumber);
    if (cached) return cached;
    if (!this.pdfDoc) throw new Error('No PDF loaded');
    const page = await this.pdfDoc.getPage(pageNumber);
    this.pageCache.set(pageNumber, page);
    return page;
  }

  private computePageInfo(page: PDFPageProxy, pageNumber: number): PdfPageInfo {
    const rotation = ((page.rotate ?? 0) + this.userRotation()) % 360;
    const view = page.view;
    const baseViewport = page.getViewport({ scale: 1, rotation });
    const originX = rotation === 0 ? (view[0] ?? 0) : 0;
    const originY = rotation === 0 ? (view[1] ?? 0) : 0;
    const pdfWidth = Math.max(1, baseViewport.width);
    const pdfHeight = Math.max(1, baseViewport.height);
    const scale = Math.max(0.25, this.zoom());
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    return {
      pageNumber,
      originX,
      originY,
      pdfWidth,
      pdfHeight,
      rotation,
      renderedWidth: pdfWidth * scale,
      renderedHeight: pdfHeight * scale,
      scale,
      devicePixelRatio: dpr
    };
  }

  private async disposePdfDoc(): Promise<void> {
    this.lastRenderedKey = '';
    this.lastRenderedCanvas = null;
    try {
      this.activeRenderTask?.cancel();
    } catch {
      /* ignore */
    }
    this.activeRenderTask = null;
    this.pageCache.clear();
    if (this.pdfDoc) {
      try {
        await this.pdfDoc.cleanup();
      } catch {
        /* ignore */
      }
      this.pdfDoc = null;
    }
    this.docMeta.set(null);
    this.pageCount.set(0);
    this.currentPage.set(1);
    this.pageInfos.set([]);
  }

  private registerInteraction(
    onMove: (e: PointerEvent) => void,
    onUp: (e: PointerEvent) => void,
    onCancel: (e: PointerEvent) => void
  ): void {
    this.cleanupInteractions();
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    this.activeInteractionCleanup = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }

  private cleanupInteractions(): void {
    this.activeInteractionCleanup?.();
    this.activeInteractionCleanup = null;
  }

  private downloadBlob(content: string, filename: string, mime: string): void {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    this.notifyService.success(`Downloaded ${filename}`);
  }

  private baseName(name: string): string {
    return name.replace(/\.pdf$/i, '') || 'document';
  }

  private newBoxId(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `box-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
