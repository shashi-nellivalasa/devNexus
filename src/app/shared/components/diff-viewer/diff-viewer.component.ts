import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as Diff from 'diff';

interface DiffLine {
  type: 'added' | 'removed' | 'neutral';
  oldLineNumber?: number;
  newLineNumber?: number;
  text: string;
}

@Component({
  selector: 'app-diff-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="diff-viewer dn-card overflow-hidden">
      <!-- Toolbar -->
      <div class="diff-toolbar px-3 py-2 border-bottom border-secondary border-opacity-25 d-flex align-items-center justify-content-between">
        <div class="d-flex align-items-center gap-2">
          <span class="badge bg-success-subtle text-success border border-success border-opacity-25 px-2 py-1 font-mono">
            +{{ additionsCount }}
          </span>
          <span class="badge bg-danger-subtle text-danger border border-danger border-opacity-25 px-2 py-1 font-mono">
            -{{ deletionsCount }}
          </span>
        </div>

        <div class="btn-group btn-group-sm" role="group">
          <button
            type="button"
            class="btn btn-outline-secondary"
            [class.active]="viewMode === 'split'"
            (click)="viewMode = 'split'"
          >
            <i class="bi bi-layout-split me-1"></i> Side by Side
          </button>
          <button
            type="button"
            class="btn btn-outline-secondary"
            [class.active]="viewMode === 'unified'"
            (click)="viewMode = 'unified'"
          >
            <i class="bi bi-list-ul me-1"></i> Unified
          </button>
        </div>
      </div>

      <!-- Diff Content -->
      @if (viewMode === 'unified') {
        <!-- Unified View -->
        <div class="diff-body overflow-auto font-mono small p-2" style="max-height: 520px;">
          @for (line of unifiedLines; track $index) {
            <div class="diff-row d-flex align-items-start" [ngClass]="getLineClass(line.type)">
              <div class="line-num text-secondary user-select-none text-end pe-2" style="width: 45px;">
                {{ line.oldLineNumber || '' }}
              </div>
              <div class="line-num text-secondary user-select-none text-end pe-2" style="width: 45px;">
                {{ line.newLineNumber || '' }}
              </div>
              <div class="line-marker user-select-none px-2 fw-bold">
                {{ line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ' }}
              </div>
              <div class="line-code flex-grow-1 text-break">
                {{ line.text }}
              </div>
            </div>
          }
          @if (unifiedLines.length === 0) {
            <div class="text-center text-secondary py-5">
              <i class="bi bi-check-circle text-success fs-3 mb-2 d-block"></i>
              No differences found. Both inputs are identical.
            </div>
          }
        </div>
      } @else {
        <!-- Side-by-Side (Split) View -->
        <div class="diff-split-container d-flex overflow-auto font-mono small" style="max-height: 520px;">
          <!-- Left: Old -->
          <div class="split-pane w-50 border-end border-secondary border-opacity-25 p-2">
            <div class="pane-title text-secondary border-bottom border-secondary border-opacity-25 pb-1 mb-2 fw-semibold">
              {{ oldTitle }}
            </div>
            @for (line of leftLines; track $index) {
              <div class="diff-row d-flex align-items-start" [ngClass]="getLineClass(line.type)">
                <div class="line-num text-secondary user-select-none text-end pe-2" style="width: 45px;">
                  {{ line.oldLineNumber || '' }}
                </div>
                <div class="line-marker user-select-none px-1">
                  {{ line.type === 'removed' ? '-' : ' ' }}
                </div>
                <div class="line-code flex-grow-1 text-break">
                  {{ line.text }}
                </div>
              </div>
            }
          </div>

          <!-- Right: New -->
          <div class="split-pane w-50 p-2">
            <div class="pane-title text-secondary border-bottom border-secondary border-opacity-25 pb-1 mb-2 fw-semibold">
              {{ newTitle }}
            </div>
            @for (line of rightLines; track $index) {
              <div class="diff-row d-flex align-items-start" [ngClass]="getLineClass(line.type)">
                <div class="line-num text-secondary user-select-none text-end pe-2" style="width: 45px;">
                  {{ line.newLineNumber || '' }}
                </div>
                <div class="line-marker user-select-none px-1">
                  {{ line.type === 'added' ? '+' : ' ' }}
                </div>
                <div class="line-code flex-grow-1 text-break">
                  {{ line.text }}
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .diff-toolbar {
      background-color: var(--dn-surface-1);
    }
    .diff-body, .diff-split-container {
      background-color: var(--dn-primary);
    }
    .diff-row {
      line-height: 1.45;
      min-height: 22px;
    }
    .diff-row:hover {
      filter: brightness(1.2);
    }
    .diff-added {
      background-color: rgba(16, 185, 129, 0.14);
      color: #34d399;
    }
    .diff-removed {
      background-color: rgba(199, 75, 60, 0.18);
      color: #f87171;
    }
    .diff-neutral {
      color: var(--dn-text-main);
    }
    .line-num {
      opacity: 0.5;
    }
  `]
})
export class DiffViewerComponent implements OnChanges {
  @Input() oldText = '';
  @Input() newText = '';
  @Input() oldTitle = 'Original';
  @Input() newTitle = 'Modified';
  @Input() viewMode: 'split' | 'unified' = 'split';

  public unifiedLines: DiffLine[] = [];
  public leftLines: DiffLine[] = [];
  public rightLines: DiffLine[] = [];
  public additionsCount = 0;
  public deletionsCount = 0;

  ngOnChanges(): void {
    this.computeDiff();
  }

  private computeDiff(): void {
    this.unifiedLines = [];
    this.leftLines = [];
    this.rightLines = [];
    this.additionsCount = 0;
    this.deletionsCount = 0;

    const changes = Diff.diffLines(this.oldText || '', this.newText || '');

    let oldLineNum = 1;
    let newLineNum = 1;

    changes.forEach(part => {
      const lines = part.value.replace(/\r\n/g, '\n').split('\n');
      if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop(); // remove trailing empty string
      }

      if (part.added) {
        this.additionsCount += lines.length;
        lines.forEach(text => {
          this.unifiedLines.push({
            type: 'added',
            newLineNumber: newLineNum++,
            text
          });
          this.rightLines.push({
            type: 'added',
            newLineNumber: newLineNum - 1,
            text
          });
        });
      } else if (part.removed) {
        this.deletionsCount += lines.length;
        lines.forEach(text => {
          this.unifiedLines.push({
            type: 'removed',
            oldLineNumber: oldLineNum++,
            text
          });
          this.leftLines.push({
            type: 'removed',
            oldLineNumber: oldLineNum - 1,
            text
          });
        });
      } else {
        lines.forEach(text => {
          this.unifiedLines.push({
            type: 'neutral',
            oldLineNumber: oldLineNum++,
            newLineNumber: newLineNum++,
            text
          });
          this.leftLines.push({
            type: 'neutral',
            oldLineNumber: oldLineNum - 1,
            text
          });
          this.rightLines.push({
            type: 'neutral',
            newLineNumber: newLineNum - 1,
            text
          });
        });
      }
    });
  }

  public getLineClass(type: 'added' | 'removed' | 'neutral'): string {
    switch (type) {
      case 'added': return 'diff-added';
      case 'removed': return 'diff-removed';
      default: return 'diff-neutral';
    }
  }
}

