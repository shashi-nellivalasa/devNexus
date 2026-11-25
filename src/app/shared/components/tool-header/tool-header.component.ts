import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StorageService } from '../../../core/services/storage.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-tool-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tool-header mb-4 pb-3 border-bottom border-secondary border-opacity-25">
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
        <!-- Title & Category Info -->
        <div class="d-flex align-items-center gap-3">
          <div class="tool-icon-wrapper rounded-3 d-flex align-items-center justify-content-center shadow-sm">
            <i class="bi" [ngClass]="icon" style="font-size: 1.5rem; color: var(--dn-accent);"></i>
          </div>
          <div>
            <div class="d-flex align-items-center gap-2">
              <h1 class="h4 mb-0 fw-bold">{{ title }}</h1>
              @if (badge) {
                <span class="badge bg-secondary-subtle text-info border border-info border-opacity-25 px-2 py-1">{{ badge }}</span>
              }
              @if (toolId) {
                <button
                  type="button"
                  class="btn btn-sm btn-link p-0 text-decoration-none"
                  [attr.aria-label]="isFavorite ? 'Remove from favorites' : 'Add to favorites'"
                  (click)="toggleFavorite()"
                  title="Favorite this tool"
                >
                  <i class="bi" [ngClass]="isFavorite ? 'bi-star-fill text-warning' : 'bi-star text-secondary'" style="font-size: 1.15rem;"></i>
                </button>
              }
            </div>
            <p class="text-secondary small mb-0 mt-1">{{ description }}</p>
          </div>
        </div>

        <!-- Action Controls -->
        <div class="d-flex align-items-center gap-2 flex-wrap">
          @if (showSampleBtn) {
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
              (click)="loadSample.emit()"
              title="Load representative sample input"
            >
              <i class="bi bi-magic"></i>
              <span>Sample</span>
            </button>
          }

          @if (showClearBtn) {
            <button
              type="button"
              class="btn btn-sm btn-outline-danger d-flex align-items-center gap-1"
              (click)="clear.emit()"
              title="Clear current input/output"
            >
              <i class="bi bi-trash3"></i>
              <span>Clear</span>
            </button>
          }

          @if (showCopyBtn) {
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
              (click)="triggerCopy()"
              title="Copy output to clipboard"
            >
              <i class="bi bi-clipboard"></i>
              <span>Copy</span>
            </button>
          }

          @if (showDownloadBtn) {
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
              (click)="triggerDownload()"
              title="Download file"
            >
              <i class="bi bi-download"></i>
              <span>Download</span>
            </button>
          }

          @if (showActionBtn) {
            <button
              type="button"
              class="btn btn-sm btn-accent d-flex align-items-center gap-1"
              (click)="action.emit()"
            >
              <i class="bi" [ngClass]="actionIcon || 'bi-play-fill'"></i>
              <span>{{ actionLabel || 'Execute' }}</span>
            </button>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .tool-icon-wrapper {
      width: 48px;
      height: 48px;
      background-color: var(--dn-surface-2);
      border: 1px solid var(--dn-border);
    }
  `]
})
export class ToolHeaderComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) description!: string;
  @Input() icon = 'bi-wrench';
  @Input() toolId?: string;
  @Input() badge?: string;
  @Input() showSampleBtn = false;
  @Input() showClearBtn = true;
  @Input() showCopyBtn = false;
  @Input() copyContent?: string;
  @Input() showDownloadBtn = false;
  @Input() downloadContent?: string;
  @Input() downloadFilename = 'output.txt';
  @Input() showActionBtn = false;
  @Input() actionLabel?: string;
  @Input() actionIcon?: string;

  @Output() loadSample = new EventEmitter<void>();
  @Output() clear = new EventEmitter<void>();
  @Output() action = new EventEmitter<void>();

  private storageService = inject(StorageService);
  private notifyService = inject(NotificationService);

  get isFavorite(): boolean {
    return this.toolId ? this.storageService.isFavorite(this.toolId) : false;
  }

  toggleFavorite(): void {
    if (this.toolId) {
      this.storageService.toggleFavorite(this.toolId);
      const fav = this.storageService.isFavorite(this.toolId);
      this.notifyService.info(fav ? 'Added to favorites' : 'Removed from favorites');
    }
  }

  triggerCopy(): void {
    if (this.copyContent !== undefined && this.copyContent !== null) {
      navigator.clipboard.writeText(this.copyContent).then(() => {
        this.notifyService.success('Copied to clipboard');
      }).catch(() => {
        this.notifyService.error('Failed to copy to clipboard');
      });
    }
  }

  triggerDownload(): void {
    if (this.downloadContent !== undefined && this.downloadContent !== null) {
      const blob = new Blob([this.downloadContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = this.downloadFilename;
      link.click();
      URL.revokeObjectURL(url);
      this.notifyService.success(`Downloaded ${this.downloadFilename}`);
    }
  }
}
