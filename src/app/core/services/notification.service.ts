import { Injectable, signal } from '@angular/core';

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title?: string;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  public readonly toasts = signal<ToastItem[]>([]);

  public show(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', title?: string, durationMs = 3500): void {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const toast: ToastItem = {
      id,
      message,
      type,
      title: title || (type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Notification'),
      timestamp: Date.now()
    };

    this.toasts.update(list => [...list, toast]);

    setTimeout(() => {
      this.dismiss(id);
    }, durationMs);
  }

  public success(message: string, title = 'Success'): void {
    this.show(message, 'success', title);
  }

  public error(message: string, title = 'Error'): void {
    this.show(message, 'error', title, 5000);
  }

  public info(message: string, title = 'Info'): void {
    this.show(message, 'info', title);
  }

  public warning(message: string, title = 'Warning'): void {
    this.show(message, 'warning', title);
  }

  public dismiss(id: string): void {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }
}

