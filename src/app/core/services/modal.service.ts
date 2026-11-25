import { Injectable, signal, TemplateRef, Type } from '@angular/core';

export interface ModalConfig {
  title: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  template?: TemplateRef<any>;
  component?: Type<any>;
  data?: any;
  showFooter?: boolean;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ModalService {
  // Signals for responsive UI state
  public readonly isCommandPaletteOpen = signal<boolean>(false);
  public readonly activeModal = signal<ModalConfig | null>(null);
  public readonly confirmState = signal<{
    isOpen: boolean;
    options: ConfirmDialogOptions;
    resolve?: (val: boolean) => void;
  }>({
    isOpen: false,
    options: { title: '', message: '' }
  });

  public open(config: ModalConfig): void {
    this.activeModal.set(config);
  }

  public close(): void {
    const modal = this.activeModal();
    if (modal?.onCancel) {
      modal.onCancel();
    }
    this.activeModal.set(null);
  }

  public confirmAction(): void {
    const modal = this.activeModal();
    if (modal?.onConfirm) {
      modal.onConfirm();
    }
    this.activeModal.set(null);
  }

  public openCommandPalette(): void {
    this.isCommandPaletteOpen.set(true);
  }

  public closeCommandPalette(): void {
    this.isCommandPaletteOpen.set(false);
  }

  public toggleCommandPalette(): void {
    this.isCommandPaletteOpen.update(v => !v);
  }

  public confirm(options: ConfirmDialogOptions): Promise<boolean> {
    return new Promise((resolve) => {
      this.confirmState.set({
        isOpen: true,
        options,
        resolve
      });
    });
  }

  public resolveConfirm(result: boolean): void {
    const st = this.confirmState();
    if (st.resolve) {
      st.resolve(result);
    }
    this.confirmState.set({
      isOpen: false,
      options: { title: '', message: '' }
    });
  }
}

