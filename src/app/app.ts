import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './layout/header/header.component';
import { FooterComponent } from './layout/footer/footer.component';
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
    FooterComponent,
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

  public isMobileSidebarOpen = signal<boolean>(false);

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
