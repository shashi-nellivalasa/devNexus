import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { filter } from 'rxjs/operators';
import { ToolRegistryService } from '../../core/services/tool-registry.service';
import { StorageService } from '../../core/services/storage.service';
import { ToolCategoryGroup } from '../../core/models/tool.model';
import { FooterComponent } from '../footer/footer.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, FooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside
      class="app-sidebar h-100 d-flex flex-column border-end border-secondary border-opacity-25"
      [class.app-sidebar--collapsed]="collapsed && !isMobile"
    >
      @if (!collapsed || isMobile) {
        <div class="p-3 border-bottom border-secondary border-opacity-25 sidebar-search d-flex align-items-center gap-2">
          <div class="input-group input-group-sm flex-grow-1">
            <span class="input-group-text bg-dark-subtle border-secondary border-opacity-50 text-secondary">
              <i class="bi bi-filter" aria-hidden="true"></i>
            </span>
            <input
              type="search"
              class="form-control form-control-sm bg-dark-subtle border-secondary border-opacity-50 shadow-none"
              placeholder="Filter utilities..."
              [(ngModel)]="filterQuery"
              aria-label="Filter sidebar utilities"
            />
            @if (filterQuery) {
              <button class="btn btn-sm btn-outline-secondary" type="button" (click)="filterQuery = ''" aria-label="Clear filter">
                <i class="bi bi-x" aria-hidden="true"></i>
              </button>
            }
          </div>
          @if (!isMobile) {
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary flex-shrink-0"
              (click)="toggleCollapsed.emit()"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <i class="bi bi-layout-sidebar-inset"></i>
            </button>
          }
        </div>
      } @else {
        <div class="p-2 border-bottom border-secondary border-opacity-25 d-flex justify-content-center">
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            (click)="toggleCollapsed.emit()"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <i class="bi bi-layout-sidebar"></i>
          </button>
        </div>
      }

      <nav class="sidebar-nav flex-grow-1 overflow-auto p-2" aria-label="Utilities navigation">
        @if (!collapsed || isMobile) {
          <h2 class="d-flex align-items-center gap-2 small fw-semibold flex-grow-1">Overview Dashboard</h2>
        } @else {
          <a
            routerLink="/"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
            class="category-header nav-dashboard w-100 d-flex align-items-center justify-content-center py-2 rounded-2 mb-2 text-decoration-none text-secondary"
            title="Overview Dashboard"
            aria-label="Overview Dashboard"
          >
            <i class="bi bi-grid-1x2" style="color: var(--dn-accent); font-size: 1rem;"></i>
          </a>
        }
        @for (cat of filteredCategories; track cat.id) {
          @if (cat.tools.length > 0) {
            <div class="category-group mb-2" [class.category-group--open]="!isCollapsed(cat.id)">
              <button
                type="button"
                class="category-header w-100 d-flex align-items-center px-2 py-2 rounded-2 border-0 text-secondary"
                [class.justify-content-between]="!collapsed || isMobile"
                [class.justify-content-center]="collapsed && !isMobile"
                [title]="cat.name"
                (click)="toggleCollapse(cat.id)"
                [attr.aria-expanded]="!collapsed && !isCollapsed(cat.id)"
                [attr.aria-controls]="'sidebar-cat-' + cat.id"
              >
                <div class="d-flex align-items-center gap-2 min-w-0">
                  <i
                    class="bi flex-shrink-0"
                    [ngClass]="cat.icon"
                    [style.fontSize]="collapsed && !isMobile ? '1.1rem' : '0.85rem'"
                    style="color: var(--dn-accent);"
                  ></i>
                  @if (!collapsed || isMobile) {
                    <span class="text-uppercase fw-bold text-truncate category-title">{{ cat.name }}</span>
                  }
                </div>
                @if (!collapsed || isMobile) {
                  <span class="d-flex align-items-center gap-1 flex-shrink-0 ms-2">
                    <span class="badge rounded-pill category-count-badge">{{ cat.tools.length }}</span>
                    <i
                      class="bi category-chevron"
                      [ngClass]="isCollapsed(cat.id) ? 'bi-chevron-right' : 'bi-chevron-down'"
                      aria-hidden="true"
                    ></i>
                  </span>
                }
              </button>

              @if ((!collapsed || isMobile) && !isCollapsed(cat.id)) {
                <div
                  class="tools-sublist mt-1"
                  [id]="'sidebar-cat-' + cat.id"
                  role="group"
                  [attr.aria-label]="cat.name"
                >
                  @for (tool of cat.tools; track tool.id) {
                    <a
                      [routerLink]="tool.route"
                      routerLinkActive="active"
                      (click)="onLinkClick(tool.id)"
                      class="nav-tool-item d-flex align-items-center gap-2 px-2.5 py-1.5 rounded-2 text-decoration-none mb-0.5 position-relative"
                    >
                      <i class="bi flex-shrink-0" [ngClass]="tool.icon" style="font-size: 0.95rem; opacity: 0.85;"></i>
                      <span class="small text-truncate nav-tool-label flex-grow-1">{{ tool.shortName || tool.name }}</span>
                      @if (isFavorite(tool.id)) {
                        <i class="bi bi-star-fill text-warning flex-shrink-0" style="font-size: 0.7rem;" aria-label="Favorite" title="Favorite"></i>
                      }
                    </a>
                  }
                </div>
              }
            </div>
          }
        }
      </nav>

      @if (!isMobile && !collapsed) {
        <app-footer [compact]="true"></app-footer>
      }
    </aside>
  `,
  styles: [`
    .app-sidebar {
      width: 260px;
      background-color: var(--dn-surface-card);
      transition: width 0.2s ease;
    }
    .app-sidebar--collapsed {
      width: 64px;
    }
    .category-title {
      font-size: 0.7rem;
      letter-spacing: 0.45px;
    }
    .category-chevron {
      font-size: 0.7rem;
      opacity: 0.75;
    }
    .category-header {
      cursor: pointer;
      background: transparent;
      transition: background-color 0.15s ease, color 0.15s ease;
    }
    .category-header:hover {
      background-color: var(--dn-surface-2);
      color: var(--dn-text-main) !important;
    }
    .category-group--open .category-header {
      background-color: var(--dn-surface-1);
      color: var(--dn-text-main) !important;
    }
    .category-count-badge {
      font-size: 0.65rem;
      background-color: var(--dn-surface-3);
      color: var(--dn-text-muted);
    }
    .tools-sublist {
      padding-left: 0.35rem;
      border-left: 2px solid var(--dn-border);
      margin-left: 0.65rem;
    }
    .nav-tool-item {
      color: var(--dn-text-main) !important;
      transition: background-color 0.15s ease, color 0.15s ease;
      font-size: 0.825rem;

      .nav-tool-label {
        color: var(--dn-text-main);
      }

      &:hover {
        background-color: var(--dn-surface-2);
        color: var(--dn-accent) !important;

        .nav-tool-label {
          color: var(--dn-accent) !important;
        }
      }

      &.active {
        background-color: var(--dn-surface-3);
        color: var(--dn-accent) !important;
        font-weight: 600;

        .nav-tool-label {
          color: var(--dn-accent) !important;
        }

        &::before {
          content: '';
          position: absolute;
          left: 0;
          top: 12%;
          height: 76%;
          width: 3px;
          border-radius: 0 4px 4px 0;
          background-color: var(--dn-accent);
          box-shadow: 0 0 8px var(--dn-accent-glow);
        }
      }
    }
    .nav-dashboard.active {
      background-color: var(--dn-surface-2);
    }
  `]
})
export class SidebarComponent implements OnInit {
  private readonly toolRegistry = inject(ToolRegistryService);
  private readonly storageService = inject(StorageService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  @Input() isMobile = false;
  @Input() collapsed = false;
  @Output() navigate = new EventEmitter<void>();
  @Output() expandRequest = new EventEmitter<void>();
  @Output() toggleCollapsed = new EventEmitter<void>();

  public filterQuery = '';
  /** At most one category expanded when not filtering (accordion). */
  readonly expandedCategoryId = signal<string | null>(null);

  ngOnInit(): void {
    this.syncExpandedToRoute(this.router.url);

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(event => this.syncExpandedToRoute(event.urlAfterRedirects));
  }

  private syncExpandedToRoute(url: string): void {
    if (this.filterQuery.trim()) {
      return;
    }

    const categories = this.toolRegistry.categories();
    const match = categories.find(cat =>
      cat.tools.some(tool => url === tool.route || url.startsWith(`${tool.route}/`))
    );

    if (match) {
      this.expandedCategoryId.set(match.id);
      return;
    }

    if (url === '/' || url === '') {
      const first = categories.find(c => c.tools.length > 0);
      this.expandedCategoryId.set(first?.id ?? null);
    }
  }

  get filteredCategories(): ToolCategoryGroup[] {
    const q = this.filterQuery.trim().toLowerCase();
    const categories = this.toolRegistry.categories();

    if (!q) {
      return categories;
    }

    return categories.map(cat => ({
      ...cat,
      tools: cat.tools.filter(
        t =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.keywords.some(k => k.toLowerCase().includes(q))
      )
    }));
  }

  toggleCollapse(catId: string): void {
    if (this.collapsed && !this.isMobile) {
      this.expandedCategoryId.set(catId);
      this.expandRequest.emit();
      return;
    }
    if (this.filterQuery.trim()) {
      return;
    }
    this.expandedCategoryId.update(current => (current === catId ? null : catId));
  }

  isCollapsed(catId: string): boolean {
    if (this.filterQuery.trim()) {
      return false;
    }
    return this.expandedCategoryId() !== catId;
  }

  isFavorite(toolId: string): boolean {
    return this.storageService.isFavorite(toolId);
  }

  onLinkClick(toolId?: string): void {
    if (toolId) {
      this.storageService.trackRecent(toolId);
    }
    this.navigate.emit();
  }
}