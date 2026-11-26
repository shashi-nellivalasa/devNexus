import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './layout/header/header.component';
import { SidebarComponent } from './layout/sidebar/sidebar.component';
import { CommandPaletteComponent } from './layout/command-palette/command-palette.component';
import { ModalContainerComponent } from './shared/components/modal/modal-container.component';
import { NotificationService, ToastItem } from './core/services/notification.service';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterOutlet,
    HeaderComponent,
    SidebarComponent,
    CommandPaletteComponent,
    ModalContainerComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  public notifyService = inject(NotificationService);
  public themeService = inject(ThemeService);

  private static readonly DESKTOP_SIDEBAR_KEY = 'devnexus-desktop-sidebar-collapsed';

  public isMobileSidebarOpen = signal<boolean>(false);
  public isDesktopSidebarCollapsed = signal<boolean>(this.loadDesktopSidebarState());

  toggleDesktopSidebar(): void {
    const next = !this.isDesktopSidebarCollapsed();
    this.isDesktopSidebarCollapsed.set(next);
    try {
      localStorage.setItem(App.DESKTOP_SIDEBAR_KEY, next ? '1' : '0');
    } catch {
      /* ignore storage errors */
    }
  }

  expandDesktopSidebar(): void {
    this.isDesktopSidebarCollapsed.set(false);
    try {
      localStorage.setItem(App.DESKTOP_SIDEBAR_KEY, '0');
    } catch {
      /* ignore storage errors */
    }
  }

  private loadDesktopSidebarState(): boolean {
    try {
      return localStorage.getItem(App.DESKTOP_SIDEBAR_KEY) === '1';
    } catch {
      return false;
    }
  }

  toggleMobileSidebar(): void {
    this.isMobileSidebarOpen.update(v => !v);
  }

  closeMobileSidebar(): void {
    this.isMobileSidebarOpen.set(false);
  }

  getToastIcon(type: string): string {
    switch (type) {
      case 'success': return 'bi-check-circle-fill text-success';
      case 'error': return 'bi-exclamation-octagon-fill text-danger';
      case 'warning': return 'bi-exclamation-triangle-fill text-warning';
      default: return 'bi-info-circle-fill text-info';
    }
  }
}
