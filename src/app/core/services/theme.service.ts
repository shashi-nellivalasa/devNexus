import { Injectable, signal, effect } from '@angular/core';

export type AppTheme = 'dark' | 'light';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly STORAGE_KEY = 'devnexus_theme';
  public readonly currentTheme = signal<AppTheme>('dark');

  constructor() {
    this.initTheme();

    // Effect to reactively update document attributes
    effect(() => {
      const theme = this.currentTheme();
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-bs-theme', theme);
        localStorage.setItem(this.STORAGE_KEY, theme);
      }
    });
  }

  private initTheme(): void {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(this.STORAGE_KEY) as AppTheme;
      if (saved === 'dark' || saved === 'light') {
        this.currentTheme.set(saved);
        return;
      }
      // Check system preference
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        this.currentTheme.set('light');
        return;
      }
    }
    this.currentTheme.set('dark');
  }

  public toggleTheme(): void {
    this.currentTheme.update(current => (current === 'dark' ? 'light' : 'dark'));
  }

  public setTheme(theme: AppTheme): void {
    this.currentTheme.set(theme);
  }
}

