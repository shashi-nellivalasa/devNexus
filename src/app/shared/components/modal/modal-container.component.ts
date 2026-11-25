import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalService } from '../../../core/services/modal.service';

@Component({
  selector: 'app-modal-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- General Active Modal -->
    @if (modalService.activeModal(); as modal) {
      <div class="modal fade show d-block" tabindex="-1" role="dialog" style="background-color: rgba(3, 4, 7, 0.75); backdrop-filter: blur(4px);">
        <div class="modal-dialog modal-dialog-centered" [ngClass]="getSizeClass(modal.size)">
          <div class="modal-content dn-card text-light border border-secondary border-opacity-50">
            <div class="modal-header border-bottom border-secondary border-opacity-25 py-2 px-3">
              <h5 class="modal-title fs-6 fw-bold text-light">{{ modal.title }}</h5>
              <button type="button" class="btn-close btn-close-white" (click)="modalService.close()" aria-label="Close"></button>
            </div>
            <div class="modal-body p-3">
              @if (modal.template) {
                <ng-container *ngTemplateOutlet="modal.template; context: { $implicit: modal.data }"></ng-container>
              }
            </div>
            @if (modal.showFooter !== false) {
              <div class="modal-footer border-top border-secondary border-opacity-25 py-2 px-3">
                <button type="button" class="btn btn-sm btn-outline-secondary" (click)="modalService.close()">
                  {{ modal.cancelText || 'Cancel' }}
                </button>
                <button type="button" class="btn btn-sm btn-accent" (click)="modalService.confirmAction()">
                  {{ modal.confirmText || 'Confirm' }}
                </button>
              </div>
            }
          </div>
        </div>
      </div>
    }

    <!-- Confirmation Modal Dialog -->
    @if (modalService.confirmState().isOpen) {
      <div class="modal fade show d-block" tabindex="-1" role="dialog" style="background-color: rgba(3, 4, 7, 0.75); backdrop-filter: blur(4px);">
        <div class="modal-dialog modal-dialog-centered modal-sm">
          <div class="modal-content dn-card text-light border border-secondary border-opacity-50">
            <div class="modal-header border-bottom border-secondary border-opacity-25 py-2 px-3">
              <h5 class="modal-title fs-6 fw-bold text-light">{{ modalService.confirmState().options.title }}</h5>
              <button type="button" class="btn-close btn-close-white" (click)="modalService.resolveConfirm(false)" aria-label="Close"></button>
            </div>
            <div class="modal-body p-3 small">
              {{ modalService.confirmState().options.message }}
            </div>
            <div class="modal-footer border-top border-secondary border-opacity-25 py-2 px-3">
              <button type="button" class="btn btn-sm btn-outline-secondary" (click)="modalService.resolveConfirm(false)">
                {{ modalService.confirmState().options.cancelText || 'Cancel' }}
              </button>
              <button
                type="button"
                class="btn btn-sm"
                [ngClass]="modalService.confirmState().options.isDestructive ? 'btn-danger' : 'btn-accent'"
                (click)="modalService.resolveConfirm(true)"
              >
                {{ modalService.confirmState().options.confirmText || 'Confirm' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class ModalContainerComponent {
  public modalService = inject(ModalService);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.modalService.confirmState().isOpen) {
      this.modalService.resolveConfirm(false);
    } else if (this.modalService.activeModal()) {
      this.modalService.close();
    }
  }

  getSizeClass(size?: 'sm' | 'md' | 'lg' | 'xl'): string {
    switch (size) {
      case 'sm': return 'modal-sm';
      case 'lg': return 'modal-lg';
      case 'xl': return 'modal-xl';
      default: return '';
    }
  }
}

