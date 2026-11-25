import { Component, EventEmitter, HostListener, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';
import { ModalService } from '../../core/services/modal.service';
import { ToolRegistryService } from '../../core/services/tool-registry.service';
import { DEVELOPER_CREDITS } from '../../core/config/developer-credits.config';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <header class="app-header px-3 py-2 border-bottom border-secondary border-opacity-25 d-flex align-items-center justify-content-between position-sticky top-0 z-3 gap-2">
      <!-- Left: Mobile Toggle & Brand Logo -->
      <div class="d-flex align-items-center gap-3">
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary d-md-none p-1"
          (click)="toggleMobileSidebar.emit()"
          aria-label="Toggle Navigation"
        >
          <i class="bi bi-list fs-5"></i>
        </button>

        <a routerLink="/" class="brand-lockup text-decoration-none d-flex align-items-center gap-2" aria-label="DevNexus home">
          <span class="brand-mark-frame" aria-hidden="true">
            <img src="svgviewer-output.svg" alt="" width="28" height="28" class="brand-mark" />
          </span>
          <span class="brand-wordmark d-none d-md-flex flex-column">
            <span class="brand-title">
              <span class="brand-dev">Dev</span><span class="brand-nexus">Nexus</span>
            </span>
            <span class="brand-tagline">Developer toolbox</span>
          </span>
        </a>
      </div>

      <!-- Center: Global Quick Search / Command Palette Bar -->
      <div class="header-search-container flex-grow-1 mx-md-3 d-none d-sm-block">
        <button
          type="button"
          class="btn w-100 search-trigger-btn d-flex align-items-center justify-content-between px-3 py-2 text-secondary rounded-3 text-start"
          (click)="modalService.openCommandPalette()"
        >
          <span class="d-flex align-items-center gap-2 small search-trigger-label">
            <i class="bi bi-search"></i>
            <span class="text-truncate">Search utilities, APIs, JSON, regex…</span>
          </span>
          <kbd class="header-kbd small d-none d-md-inline">Ctrl + K</kbd>
        </button>
      </div>

      <button
        type="button"
        class="btn btn-sm btn-outline-secondary d-sm-none header-icon-btn"
        (click)="modalService.openCommandPalette()"
        aria-label="Open search"
      >
        <i class="bi bi-search fs-6"></i>
      </button>

      <!-- Right: Favorites, Recents, Theme, GitHub -->
      <div class="d-flex align-items-center gap-1 gap-md-2 header-actions">
        <!-- Favorites Dropdown -->
        <div class="dropdown position-relative">
          <button
            class="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1 dropdown-toggle header-icon-btn"
            type="button"
            [class.show]="isFavoritesOpen()"
            [attr.aria-expanded]="isFavoritesOpen()"
            (click)="toggleFavorites($event)"
            title="Favorite utilities"
          >
            <i class="bi bi-star-fill text-warning"></i>
            <span class="d-none d-lg-inline small">Favorites</span>
            <span class="badge bg-secondary-subtle text-secondary ms-1">{{ toolRegistry.favoriteTools().length }}</span>
          </button>
          <ul
            class="dropdown-menu dropdown-menu-end dn-card border border-secondary border-opacity-50 p-1 shadow-lg"
            [class.show]="isFavoritesOpen()"
            style="min-width: 250px; position: absolute; right: 0; top: 100%; margin-top: 4px; z-index: 1050;"
            (click)="$event.stopPropagation()"
          >
            <li class="dropdown-header text-uppercase small py-1" style="font-size: 0.7rem;">Saved Favorites</li>
            @for (tool of toolRegistry.favoriteTools(); track tool.id) {
              <li>
                <a
                  class="dropdown-item small d-flex align-items-center gap-2 rounded-1 py-1.5 cursor-pointer"
                  [routerLink]="tool.route"
                  (click)="closeDropdowns()"
                >
                  <i class="bi" [ngClass]="tool.icon" style="color: var(--dn-accent);"></i>
                  <span class="text-truncate">{{ tool.name }}</span>
                </a>
              </li>
            }
            @if (toolRegistry.favoriteTools().length === 0) {
              <li class="px-3 py-2 text-secondary small text-center">No favorites added yet</li>
            }
          </ul>
        </div>

        <!-- Recently Used Dropdown -->
        <div class="dropdown position-relative">
          <button
            class="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1 dropdown-toggle header-icon-btn"
            type="button"
            [class.show]="isRecentOpen()"
            [attr.aria-expanded]="isRecentOpen()"
            (click)="toggleRecent($event)"
            title="Recent utilities"
          >
            <i class="bi bi-clock-history text-info"></i>
            <span class="d-none d-lg-inline small">Recent</span>
          </button>
          <ul
            class="dropdown-menu dropdown-menu-end dn-card border border-secondary border-opacity-50 p-1 shadow-lg"
            [class.show]="isRecentOpen()"
            style="min-width: 250px; position: absolute; right: 0; top: 100%; margin-top: 4px; z-index: 1050;"
            (click)="$event.stopPropagation()"
          >
            <li class="dropdown-header text-uppercase small py-1" style="font-size: 0.7rem;">Recently Opened</li>
            @for (tool of toolRegistry.recentTools(); track tool.id) {
              <li>
                <a
                  class="dropdown-item small d-flex align-items-center gap-2 rounded-1 py-1.5 cursor-pointer"
                  [routerLink]="tool.route"
                  (click)="closeDropdowns()"
                >
                  <i class="bi" [ngClass]="tool.icon" style="color: var(--dn-accent);"></i>
                  <span class="text-truncate">{{ tool.name }}</span>
                </a>
              </li>
            }
            @if (toolRegistry.recentTools().length === 0) {
              <li class="px-3 py-2 text-secondary small text-center">No recent tools</li>
            }
          </ul>
        </div>

        <a
          routerLink="/settings"
          class="btn btn-sm btn-outline-secondary header-icon-btn d-flex align-items-center justify-content-center"
          title="Settings & backup"
          aria-label="Settings"
        >
          <i class="bi bi-gear fs-6"></i>
        </a>

        <!-- Theme Switcher -->
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary header-icon-btn d-flex align-items-center justify-content-center"
          (click)="themeService.toggleTheme()"
          [title]="themeService.currentTheme() === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'"
          aria-label="Toggle Theme"
        >
          @if (themeService.currentTheme() === 'dark') {
            <i class="bi bi-sun-fill text-warning fs-6"></i>
          } @else {
            <i class="bi bi-moon-stars-fill text-info fs-6"></i>
          }
        </button>

        <!-- GitHub Link -->
        <a
          [href]="developerCredits.githubUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-sm btn-outline-secondary header-icon-btn d-flex align-items-center justify-content-center"
          title="Developer GitHub"
          aria-label="Developer GitHub"
        >
          <i class="bi bi-github fs-6"></i>
        </a>
      </div>
    </header>
  `,
  styles: [`
    .app-header {
      min-height: 56px;
      background-color: color-mix(in srgb, var(--dn-surface-card) 88%, transparent);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    .header-search-container {
      max-width: 460px;
    }
    .header-icon-btn {
      min-width: 40px;
      min-height: 40px;
      padding: 0.35rem 0.5rem;
    }
    .brand-lockup {
      color: var(--dn-text-main);
      transition: opacity 0.15s ease;
      &:hover {
        opacity: 0.92;
      }
    }
    .brand-mark-frame {
      width: 40px;
      height: 40px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      border-radius: 11px;
      background: var(--dn-surface-2);
      border: 1px solid var(--dn-border);
      box-shadow: inset 0 1px 0 color-mix(in srgb, var(--dn-text-main) 6%, transparent);
    }
    .brand-title {
      font-size: 1.05rem;
      font-weight: 700;
      line-height: 1.1;
      letter-spacing: -0.02em;
    }
    .brand-dev {
      color: var(--dn-text-main);
    }
    .brand-nexus {
      color: var(--dn-accent);
    }
    .brand-tagline {
      font-size: 0.65rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--dn-text-subtle);
      line-height: 1.2;
    }
    .brand-mark {
      flex-shrink: 0;
    }
    .search-trigger-btn {
      background-color: var(--dn-surface-2);
      border: 1px solid var(--dn-border);
      color: var(--dn-text-muted);
      transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
      &:hover,
      &:focus-visible {
        border-color: var(--dn-accent);
        background-color: var(--dn-surface-1);
        box-shadow: 0 0 0 3px var(--dn-accent-subtle);
      }
    }
    .search-trigger-label {
      color: var(--dn-text-muted);
      min-width: 0;
    }
    .header-kbd {
      border: 1px solid var(--dn-border);
      background: var(--dn-surface-card);
      color: var(--dn-text-subtle);
      font-size: 0.68rem;
      font-family: var(--dn-font-mono);
      border-radius: 6px;
      padding: 0.2rem 0.45rem;
    }
    .dropdown-menu {
      background-color: var(--dn-surface-card);
      display: none;
      &.show {
        display: block;
      }
    }
    .dropdown-item {
      color: var(--dn-text-main);
      &:hover {
        background-color: var(--dn-surface-2);
      }
    }
    .cursor-pointer {
      cursor: pointer;
    }
  `]
})
export class HeaderComponent {
  public themeService = inject(ThemeService);
  public modalService = inject(ModalService);
  public toolRegistry = inject(ToolRegistryService);
  public readonly developerCredits = DEVELOPER_CREDITS;

  @Output() toggleMobileSidebar = new EventEmitter<void>();

  public readonly isFavoritesOpen = signal<boolean>(false);
  public readonly isRecentOpen = signal<boolean>(false);

  toggleFavorites(event: MouseEvent): void {
    event.stopPropagation();
    this.isRecentOpen.set(false);
    this.isFavoritesOpen.update(v => !v);
  }

  toggleRecent(event: MouseEvent): void {
    event.stopPropagation();
    this.isFavoritesOpen.set(false);
    this.isRecentOpen.update(v => !v);
  }

  closeDropdowns(): void {
    this.isFavoritesOpen.set(false);
    this.isRecentOpen.set(false);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeDropdowns();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeDropdowns();
  }
}
