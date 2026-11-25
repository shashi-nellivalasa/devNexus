import { Component, OnInit, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ToolRegistryService } from '../../core/services/tool-registry.service';
import { ModalService } from '../../core/services/modal.service';
import { StorageService } from '../../core/services/storage.service';
import { DataService } from '../../core/services/data.service';
import { NotificationService } from '../../core/services/notification.service';
import { ToolItem } from '../../core/models/tool.model';
import { ApiCollection } from '../../core/models/api-tester.model';
import { DEVELOPER_CREDITS } from '../../core/config/developer-credits.config';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="dashboard-hub p-3 p-md-4">
      <!-- ================================================================= -->
      <!-- 1. SEARCH ANYTHING & HERO SECTION                                  -->
      <!-- ================================================================= -->
      <div class="hero-command-hub p-4 p-md-5 rounded-4 mb-4 border position-relative shadow-lg overflow-hidden">
        <div class="hero-decor" aria-hidden="true">
          <span class="hero-orb hero-orb-a"></span>
          <span class="hero-orb hero-orb-b"></span>
          <span class="hero-grid"></span>
        </div>
        <div class="row justify-content-center text-center position-relative z-1">
          <div class="col-lg-10 col-xl-8">
            <div class="hero-eyebrow d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill mb-3">
              <span class="hero-version-badge badge rounded-pill">v{{ credits.version }}</span>
              <span class="hero-eyebrow-label small">Developer Productivity Hub</span>
            </div>

            <h1 class="display-6 fw-bold hero-title mb-2">
              What do you want to <span class="hero-accent">build or inspect</span> today?
            </h1>
            <p class="hero-desc lead fs-6 mb-3">
              Search utilities, test live APIs, generate mock datasets, or format payloads right in your browser.
            </p>

            <ul class="hero-meta list-unstyled d-flex flex-wrap justify-content-center gap-2 mb-4">
              <li class="hero-meta-chip">
                <i class="bi bi-grid-3x3-gap" aria-hidden="true"></i>
                <span>{{ toolRegistry.favoriteTools().length }} favorites</span>
              </li>
              @for (chip of heroMetaChips; track chip.label) {
                <li class="hero-meta-chip">
                  <i class="bi" [ngClass]="chip.icon" aria-hidden="true"></i>
                  <span>{{ chip.label }}</span>
                </li>
              }
            </ul>

            <!-- Omnisearch Bar -->
            <div class="omnisearch-box position-relative text-start">
              <div class="input-group input-group-lg omnisearch-input-group shadow-lg">
                <span class="input-group-text omnisearch-addon border-0 ps-3">
                  <i class="bi bi-search fs-5" aria-hidden="true"></i>
                </span>
                <input
                  type="search"
                  class="form-control omnisearch-field border-0 py-3 shadow-none"
                  placeholder="Search anything – tools, formats, regex, JSON, APIs, commands..."
                  [(ngModel)]="searchQuery"
                  (keyup.enter)="onSearchEnter()"
                  (focus)="isSearchFocused = true"
                  aria-label="Search DevNexus tools"
                />
                <button
                  type="button"
                  class="btn btn-accent omnisearch-trigger px-4 d-flex align-items-center gap-2"
                  (click)="modalService.openCommandPalette()"
                  title="Open full command palette"
                >
                  <i class="bi bi-command" aria-hidden="true"></i>
                  <kbd class="hero-kbd small d-none d-sm-inline">Ctrl + K</kbd>
                </button>
              </div>

              <!-- Instant Search Results Dropdown -->
              @if (searchQuery.trim().length > 0 && isSearchFocused) {
                <div class="search-results-dropdown dn-card p-2 position-absolute w-100 shadow-lg border">
                  <!-- Dropdown Header Bar -->
                  <div class="d-flex align-items-center justify-content-between px-3 py-2 border-bottom border-secondary border-opacity-25 mb-1.5">
                    <div class="d-flex align-items-center gap-2 small">
                      <span class="badge bg-secondary-subtle text-secondary font-mono">{{ filteredSearchResults.length }} result{{ filteredSearchResults.length === 1 ? '' : 's' }}</span>
                      <span class="text-secondary">Matching utilities for "<strong class="text-accent">{{ searchQuery }}</strong>"</span>
                    </div>
                    <button
                      type="button"
                      class="btn btn-sm btn-link p-0 text-secondary text-decoration-none d-flex align-items-center gap-1"
                      (click)="searchQuery = ''; isSearchFocused = false"
                      title="Clear search"
                    >
                      <i class="bi bi-x-circle-fill"></i>
                      <span>Clear</span>
                    </button>
                  </div>

                  <!-- Results List -->
                  <div class="search-results-list" style="max-height: 340px; overflow-y: auto;">
                    @for (tool of filteredSearchResults; track tool.id) {
                      <a
                        [routerLink]="tool.route"
                        (click)="onToolClick(tool.id)"
                        class="dropdown-tool-row p-2.5 rounded-3 text-decoration-none d-flex align-items-center justify-content-between mb-1"
                      >
                        <div class="d-flex align-items-center gap-3 min-w-0">
                          <div class="tool-icon-circle rounded-3 d-flex align-items-center justify-content-center flex-shrink-0">
                            <i class="bi" [ngClass]="tool.icon"></i>
                          </div>
                          <div class="min-w-0 text-start">
                            <div class="d-flex align-items-center gap-2 mb-0.5 flex-wrap">
                              <span class="fw-bold tool-dropdown-title text-truncate">{{ tool.name }}</span>
                              <span class="badge bg-secondary-subtle text-secondary" style="font-size: 0.65rem;">{{ tool.categoryLabel }}</span>
                              @if (tool.badge) {
                                <span class="badge bg-primary-subtle text-info border border-info border-opacity-25" style="font-size: 0.6rem;">{{ tool.badge }}</span>
                              }
                            </div>
                            <p class="tool-dropdown-desc small mb-0 text-truncate">{{ tool.description }}</p>
                          </div>
                        </div>

                        <div class="d-flex align-items-center gap-2 flex-shrink-0 ms-3">
                          <span class="open-pill badge py-1 px-2.5 d-flex align-items-center gap-1">
                            <span>Open</span>
                            <i class="bi bi-arrow-right"></i>
                          </span>
                        </div>
                      </a>
                    }

                    @if (filteredSearchResults.length === 0) {
                      <div class="text-center py-4 text-secondary small">
                        <i class="bi bi-search fs-3 mb-2 d-block opacity-50"></i>
                        <div class="fw-semibold text-main mb-1">No tools found matching "{{ searchQuery }}"</div>
                        <p class="small text-secondary mb-3">Try searching for JSON, API, Regex, Base64, or SQL.</p>
                        <button type="button" class="btn btn-sm btn-outline-accent" (click)="modalService.openCommandPalette(); searchQuery = ''; isSearchFocused = false">
                          <i class="bi bi-command me-1"></i> Open Command Palette (Ctrl+K)
                        </button>
                      </div>
                    }
                  </div>
                </div>
              }

              @if (toolRegistry.favoriteTools().length > 0) {
                <div class="d-flex flex-wrap align-items-center justify-content-center gap-2 mt-3">
                  <span class="small hero-jump-label me-1">Jump to favorites:</span>
                  @for (tool of toolRegistry.favoriteTools().slice(0, 6); track tool.id) {
                    <a
                      [routerLink]="tool.route"
                      (click)="onToolClick(tool.id)"
                      class="btn btn-sm hero-jump-pill py-1 px-2.5 rounded-pill d-inline-flex align-items-center gap-1"
                    >
                      <i class="bi" [ngClass]="tool.icon" aria-hidden="true"></i>
                      <span>{{ tool.shortName || tool.name }}</span>
                    </a>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- 2. FAVORITES (dashboard shows pinned tools only)                   -->
      <!-- ================================================================= -->
      <section class="hub-section mb-5">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
          <div class="d-flex align-items-center gap-2">
            <i class="bi bi-star-fill text-warning fs-5"></i>
            <h2 class="h5 fw-bold mb-0">Your Favorites</h2>
          </div>
          <span class="text-secondary small">
            {{ toolRegistry.favoriteTools().length }} pinned
            <span class="d-none d-sm-inline">· use search or sidebar to open any utility</span>
          </span>
        </div>

        @if (toolRegistry.favoriteTools().length > 0) {
          <div class="row g-3">
            @for (tool of toolRegistry.favoriteTools(); track tool.id) {
              <div class="col-sm-6 col-lg-4 col-xl-3">
                <ng-container *ngTemplateOutlet="toolBrowserCard; context: { $implicit: tool }" />
              </div>
            }
          </div>
        } @else {
          <div class="dn-card p-5 text-center text-secondary">
            <i class="bi bi-star fs-1 mb-3 d-block opacity-50"></i>
            <p class="mb-2">No favorites yet. Pin tools from the sidebar, header, or start with a recommended set.</p>
            <div class="d-flex flex-wrap justify-content-center gap-2">
              <button type="button" class="btn btn-sm btn-outline-warning" (click)="pinDefaultFavorites()">
                Pin recommended tools
              </button>
              <button type="button" class="btn btn-sm btn-accent" (click)="modalService.openCommandPalette()">
                <i class="bi bi-command me-1"></i> Browse all (Ctrl+K)
              </button>
            </div>
          </div>
        }
      </section>

      <ng-template #toolBrowserCard let-tool>
        <div class="dn-card p-3 h-100 tool-browser-card d-flex flex-column justify-content-between position-relative">
          <button
            type="button"
            class="btn btn-sm btn-link position-absolute top-0 end-0 p-1 text-warning text-decoration-none favorite-unpin"
            (click)="toggleFavorite(tool.id)"
            title="Remove from favorites"
            aria-label="Remove from favorites"
          >
            <i class="bi bi-star-fill"></i>
          </button>
          <a [routerLink]="tool.route" (click)="onToolClick(tool.id)" class="text-decoration-none flex-grow-1 d-flex flex-column justify-content-between">
            <div>
              <div class="d-flex align-items-center justify-content-between mb-2 pe-4">
                <div class="tool-icon-circle rounded-3 d-flex align-items-center justify-content-center">
                  <i class="bi" [ngClass]="tool.icon" style="color: var(--dn-accent); font-size: 1.1rem;"></i>
                </div>
                @if (tool.badge) {
                  <span class="badge bg-secondary-subtle text-info border border-info border-opacity-25" style="font-size: 0.65rem;">
                    {{ tool.badge }}
                  </span>
                }
              </div>
              <h3 class="h6 fw-bold mb-1 text-main">{{ tool.name }}</h3>
              <p class="text-secondary small mb-0">{{ tool.description }}</p>
            </div>

            <div class="mt-3 pt-2 border-top border-secondary border-opacity-25 d-flex align-items-center justify-content-between small text-secondary">
              <span>{{ tool.categoryLabel }}</span>
              <i class="bi bi-arrow-right"></i>
            </div>
          </a>
        </div>
      </ng-template>
    </div>
  `,
  styles: [`
    .omnisearch-box {
      z-index: 30;
    }

    :host-context([data-bs-theme='light']) .search-results-dropdown {
      box-shadow: 0 16px 40px rgba(15, 23, 42, 0.12);
    }

    .search-results-dropdown {
      background-color: var(--dn-surface-card) !important;
      border: 1px solid var(--dn-border-light) !important;
      border-radius: 14px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(20px);
      z-index: 1050;
      top: calc(100% + 8px);
      left: 0;
      right: 0;
    }

    .dropdown-tool-row {
      color: var(--dn-text-main);
      background-color: var(--dn-surface-1);
      border: 1px solid transparent;
      transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
      cursor: pointer;

      .tool-dropdown-title {
        color: var(--dn-text-main) !important;
        font-size: 0.925rem;
      }

      .tool-dropdown-desc {
        color: var(--dn-text-muted) !important;
        font-size: 0.8rem;
        max-width: 520px;
      }

      .open-pill {
        background-color: var(--dn-surface-3);
        color: var(--dn-text-muted);
        font-weight: 500;
        font-size: 0.75rem;
        transition: all 0.15s ease;
      }

      &:hover, &:focus {
        background-color: var(--dn-surface-3) !important;
        border-color: var(--dn-accent) !important;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
        transform: translateX(3px);

        .tool-dropdown-title {
          color: var(--dn-accent) !important;
        }

        .tool-icon-circle {
          background-color: var(--dn-accent) !important;
          color: #030407 !important;
          i {
            color: #030407 !important;
          }
        }

        .open-pill {
          background-color: var(--dn-accent) !important;
          color: #030407 !important;
        }
      }
    }

    .card-title-text {
      color: var(--dn-text-main) !important;
    }

    .tool-icon-circle {
      width: 42px;
      height: 42px;
      background-color: var(--dn-surface-2);
      border: 1px solid var(--dn-border);
      color: var(--dn-accent);
      font-size: 1.25rem;
      transition: all 0.15s ease;
    }

    .action-icon-wrapper {
      width: 42px;
      height: 42px;
    }

    .quick-card, .tool-browser-card {
      transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
      &:hover {
        transform: translateY(-2px);
        border-color: var(--dn-accent) !important;
      }
    }

    .tool-hover-item {
      color: var(--dn-text-main);
      transition: background-color 0.12s ease;
      &:hover {
        background-color: var(--dn-surface-2) !important;
      }
    }

    .shortcut-pill {
      background-color: var(--dn-surface-2);
      border-color: var(--dn-border) !important;
    }

    .shortcut-action {
      color: var(--dn-text-main);
    }

    .palette-kbd {
      font-family: var(--dn-font-mono);
      font-size: 0.75rem;
      background-color: var(--dn-surface-3);
      color: var(--dn-text-main);
      border: 1px solid var(--dn-border);
    }
  `]
})
export class DashboardComponent implements OnInit {
  readonly credits = DEVELOPER_CREDITS;

  public toolRegistry = inject(ToolRegistryService);
  public modalService = inject(ModalService);
  public storageService = inject(StorageService);
  private dataService = inject(DataService);
  private notifyService = inject(NotificationService);
  private router = inject(Router);

  public searchQuery = '';
  public isSearchFocused = false;
  public savedCollections: ApiCollection[] = [];
  public scratchpadText = '';

  private readonly SCRATCHPAD_KEY = 'devnexus_scratchpad';

  public readonly heroMetaChips = [
    { icon: 'bi-shield-lock', label: 'Runs in your browser' },
    { icon: 'bi-wifi-off', label: 'Works offline-ready' }
  ];

  // 7. Discoverable Shortcuts Cheat Sheet
  public readonly keyboardShortcuts = [
    { action: 'Command Palette', keys: 'Ctrl + K' },
    { action: 'Execute Tool / Query', keys: 'Ctrl + Enter' },
    { action: 'Format Content', keys: 'Ctrl + Shift + F' },
    { action: 'Copy Result', keys: 'Ctrl + Shift + C' },
    { action: 'Close Modal / Dropdown', keys: 'Escape' },
    { action: 'Navigate Items', keys: '↑ / ↓ Arrows' },
    { action: 'Quick Toggle Theme', keys: 'Palette → Theme' },
    { action: 'Clear Inputs', keys: 'Tool Header → Clear' }
  ];

  ngOnInit(): void {
    this.loadWorkspaces();
    this.loadScratchpad();
  }

  get filteredSearchResults(): ToolItem[] {
    return this.toolRegistry.searchTools(this.searchQuery);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.omnisearch-box')) {
      this.isSearchFocused = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.searchQuery = '';
    this.isSearchFocused = false;
  }

  onSearchEnter(): void {
    const results = this.filteredSearchResults;
    if (results.length > 0) {
      this.router.navigateByUrl(results[0].route);
      this.searchQuery = '';
    } else {
      this.modalService.openCommandPalette();
    }
  }

  onToolClick(toolId: string): void {
    this.storageService.trackRecent(toolId);
    this.searchQuery = '';
  }

  toggleFavorite(toolId: string): void {
    this.storageService.toggleFavorite(toolId);
    const fav = this.storageService.isFavorite(toolId);
    this.notifyService.info(fav ? 'Pinned to favorites' : 'Removed from favorites');
  }

  pinDefaultFavorites(): void {
    ['api-tester', 'json-formatter', 'typescript-playground', 'regex-tester'].forEach(id => {
      if (!this.storageService.isFavorite(id)) {
        this.storageService.toggleFavorite(id);
      }
    });
    this.notifyService.success('Pinned recommended utilities');
  }

  private async loadWorkspaces(): Promise<void> {
    try {
      this.savedCollections = await this.dataService.getCollections();
    } catch {
      this.savedCollections = [];
    }
  }

  private loadScratchpad(): void {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(this.SCRATCHPAD_KEY);
      if (saved) {
        this.scratchpadText = saved;
      } else {
        this.scratchpadText = '{\n  "workspace": "DevNexus Hub",\n  "status": "ready",\n  "active": true\n}';
      }
    }
  }

  saveScratchpad(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.SCRATCHPAD_KEY, this.scratchpadText);
    }
  }

  formatScratchpadJson(): void {
    try {
      if (this.scratchpadText.trim()) {
        const parsed = JSON.parse(this.scratchpadText);
        this.scratchpadText = JSON.stringify(parsed, null, 2);
        this.saveScratchpad();
        this.notifyService.success('Formatted scratchpad JSON');
      }
    } catch {
      this.notifyService.warning('Scratchpad content is not valid JSON');
    }
  }

  copyScratchpad(): void {
    if (this.scratchpadText) {
      navigator.clipboard.writeText(this.scratchpadText).then(() => {
        this.notifyService.success('Copied scratchpad');
      });
    }
  }

  sendScratchpadToFormatter(): void {
    this.saveScratchpad();
    this.router.navigate(['/tools/json-formatter']);
  }
}
