import { Component, ElementRef, HostListener, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ModalService } from '../../core/services/modal.service';
import { ToolRegistryService } from '../../core/services/tool-registry.service';
import { ThemeService } from '../../core/services/theme.service';
import { ToolItem } from '../../core/models/tool.model';

@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (modalService.isCommandPaletteOpen()) {
      <div
        class="command-palette-backdrop position-fixed top-0 start-0 w-100 h-100 d-flex align-items-start justify-content-center pt-5"
        (click)="closeOnBackdrop($event)"
      >
        <div class="command-palette-box dn-card shadow-lg overflow-hidden border border-secondary border-opacity-50">
          <!-- Search Header -->
          <div class="palette-search-wrapper p-3 border-bottom border-secondary border-opacity-25 d-flex align-items-center gap-2">
            <i class="bi bi-search text-secondary fs-5"></i>
            <input
              #searchInput
              type="text"
              class="form-control form-control-lg bg-transparent border-0 text-light shadow-none p-0"
              placeholder="Search tools, actions, shortcuts..."
              [(ngModel)]="searchQuery"
              (keydown)="onKeydown($event)"
            />
            <kbd class="palette-kbd bg-secondary-subtle text-secondary small px-2 py-1 rounded">ESC</kbd>
          </div>

          <!-- Results List -->
          <div class="palette-results overflow-auto p-2" style="max-height: 400px;">
            @if (filteredTools.length > 0) {
              <div class="text-secondary small fw-semibold px-2 py-1 text-uppercase" style="font-size: 0.7rem;">
                Tools & Utilities ({{ filteredTools.length }})
              </div>
              @for (tool of filteredTools; track tool.id; let idx = $index) {
                <div
                  class="palette-item d-flex align-items-center justify-content-between p-2 rounded-2 cursor-pointer mb-1"
                  [class.active]="selectedIndex === idx"
                  (click)="selectTool(tool)"
                  (mouseenter)="selectedIndex = idx"
                >
                  <div class="d-flex align-items-center gap-3">
                    <div class="tool-icon-mini rounded-2 d-flex align-items-center justify-content-center">
                      <i class="bi" [ngClass]="tool.icon" style="color: var(--dn-accent);"></i>
                    </div>
                    <div>
                      <div class="text-light fw-medium small">{{ tool.name }}</div>
                      <div class="text-secondary" style="font-size: 0.75rem;">{{ tool.categoryLabel }} &bull; {{ tool.description }}</div>
                    </div>
                  </div>
                  <div class="d-flex align-items-center gap-2">
                    @if (tool.shortcut) {
                      <kbd class="palette-kbd small bg-dark text-secondary px-1.5 py-0.5 rounded">{{ tool.shortcut }}</kbd>
                    }
                    <i class="bi bi-arrow-right-short text-secondary"></i>
                  </div>
                </div>
              }
            } @else {
              <div class="p-4 text-center text-secondary">
                <i class="bi bi-emoji-neutral fs-3 d-block mb-2"></i>
                No matching tools found for "{{ searchQuery }}".
              </div>
            }

            <!-- Quick Global Actions -->
            <div class="text-secondary small fw-semibold px-2 pt-3 pb-1 text-uppercase border-top border-secondary border-opacity-25 mt-2" style="font-size: 0.7rem;">
              Quick Actions
            </div>
            <div
              class="palette-item d-flex align-items-center justify-content-between p-2 rounded-2 cursor-pointer mb-1"
              (click)="toggleTheme()"
            >
              <div class="d-flex align-items-center gap-3">
                <div class="tool-icon-mini rounded-2 d-flex align-items-center justify-content-center">
                  <i class="bi bi-palette text-info"></i>
                </div>
                <div>
                  <div class="text-light fw-medium small">Switch Theme</div>
                  <div class="text-secondary" style="font-size: 0.75rem;">Toggle between Dark and Light mode</div>
                </div>
              </div>
              <span class="badge bg-secondary-subtle text-secondary">Action</span>
            </div>
          </div>

          <!-- Footer hint -->
          <div class="palette-footer px-3 py-2 border-top border-secondary border-opacity-25 d-flex align-items-center justify-content-between small text-secondary">
            <div class="d-flex align-items-center gap-3" style="font-size: 0.75rem;">
              <span><kbd class="palette-kbd small">&uarr;&darr;</kbd> Navigate</span>
              <span><kbd class="palette-kbd small">&crarr;</kbd> Open</span>
              <span><kbd class="palette-kbd small">Esc</kbd> Close</span>
            </div>
            <span class="font-mono text-muted" style="font-size: 0.7rem;">DevNexus Command Palette</span>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .command-palette-backdrop {
      z-index: 1060;
      background-color: rgba(3, 4, 7, 0.75);
      backdrop-filter: blur(6px);
      animation: fadeIn 0.15s ease-out;
    }
    .command-palette-box {
      width: 100%;
      max-width: 640px;
      margin: 0 1rem;
      background-color: var(--dn-surface-card);
      border-radius: 12px;
      animation: slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .palette-item {
      transition: background-color 0.1s ease;
      &.active, &:hover {
        background-color: var(--dn-surface-2);
      }
    }
    .tool-icon-mini {
      width: 32px;
      height: 32px;
      background-color: var(--dn-surface-1);
      border: 1px solid var(--dn-border);
    }
    .cursor-pointer {
      cursor: pointer;
    }
    .palette-kbd {
      font-family: var(--dn-font-mono);
      font-size: 0.7rem;
      border: 1px solid var(--dn-border);
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideDown {
      from { transform: translateY(-20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `]
})
export class CommandPaletteComponent {
  public modalService = inject(ModalService);
  private toolRegistry = inject(ToolRegistryService);
  private themeService = inject(ThemeService);
  private router = inject(Router);

  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;

  public searchQuery = '';
  public selectedIndex = 0;

  get filteredTools(): ToolItem[] {
    return this.toolRegistry.searchTools(this.searchQuery);
  }

  @HostListener('document:keydown', ['$event'])
  handleGlobalShortcuts(event: KeyboardEvent): void {
    // Ctrl + K or Cmd + K
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.modalService.toggleCommandPalette();
      if (this.modalService.isCommandPaletteOpen()) {
        this.searchQuery = '';
        this.selectedIndex = 0;
        setTimeout(() => this.searchInputRef?.nativeElement.focus(), 50);
      }
    }

    // Escape closes palette
    if (event.key === 'Escape' && this.modalService.isCommandPaletteOpen()) {
      this.modalService.closeCommandPalette();
    }
  }

  onKeydown(event: KeyboardEvent): void {
    const list = this.filteredTools;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectedIndex = (this.selectedIndex + 1) % (list.length || 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectedIndex = (this.selectedIndex - 1 + list.length) % (list.length || 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (list[this.selectedIndex]) {
        this.selectTool(list[this.selectedIndex]);
      }
    }
  }

  selectTool(tool: ToolItem): void {
    this.modalService.closeCommandPalette();
    this.router.navigateByUrl(tool.route);
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
    this.modalService.closeCommandPalette();
  }

  closeOnBackdrop(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('command-palette-backdrop')) {
      this.modalService.closeCommandPalette();
    }
  }
}

