import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToolHeaderComponent } from '../../../shared/components/tool-header/tool-header.component';
import { CodeEditorComponent } from '../../../shared/components/code-editor/code-editor.component';
import { NotificationService } from '../../../core/services/notification.service';

interface RegexMatchItem {
  index: number;
  length: number;
  match: string;
  groups: { index: number; name?: string; value: string }[];
}

@Component({
  selector: 'app-regex-tester',
  standalone: true,
  imports: [CommonModule, FormsModule, ToolHeaderComponent, CodeEditorComponent],
  template: `
    <div class="regex-tester-tool p-3">
      <app-tool-header
        title="Regular Expression Tester & Debugger"
        description="Test regular expressions with real-time match highlighting, capture group inspection, and flag toggles."
        icon="bi-regex"
        toolId="regex-tester"
        [showSampleBtn]="true"
        (loadSample)="loadSampleData()"
        (clear)="clearAll()"
      ></app-tool-header>

      <!-- Pattern, Flags & Presets -->
      <div class="dn-card p-3 mb-3">
        <div class="row g-3 align-items-center">
          <!-- Pattern Input -->
          <div class="col-lg-6">
            <div class="input-group">
              <span class="input-group-text bg-dark-subtle border-secondary border-opacity-50 text-secondary font-mono">/</span>
              <input
                type="text"
                class="form-control bg-dark-subtle border-secondary border-opacity-50 text-light font-mono shadow-none"
                placeholder="Enter regex pattern (e.g. ([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+))"
                [(ngModel)]="pattern"
                (ngModelChange)="executeRegex()"
              />
              <span class="input-group-text bg-dark-subtle border-secondary border-opacity-50 text-secondary font-mono">/{{ activeFlagsString }}</span>
            </div>
          </div>

          <!-- Flags & Presets -->
          <div class="col-lg-6">
            <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
              <!-- Flags Checkboxes -->
              <div class="d-flex align-items-center gap-2">
                <div class="form-check form-check-inline mb-0">
                  <input class="form-check-input" type="checkbox" id="flagG" [(ngModel)]="flags.g" (ngModelChange)="executeRegex()">
                  <label class="form-check-label small font-mono text-secondary" for="flagG">g</label>
                </div>
                <div class="form-check form-check-inline mb-0">
                  <input class="form-check-input" type="checkbox" id="flagI" [(ngModel)]="flags.i" (ngModelChange)="executeRegex()">
                  <label class="form-check-label small font-mono text-secondary" for="flagI">i</label>
                </div>
                <div class="form-check form-check-inline mb-0">
                  <input class="form-check-input" type="checkbox" id="flagM" [(ngModel)]="flags.m" (ngModelChange)="executeRegex()">
                  <label class="form-check-label small font-mono text-secondary" for="flagM">m</label>
                </div>
                <div class="form-check form-check-inline mb-0">
                  <input class="form-check-input" type="checkbox" id="flagS" [(ngModel)]="flags.s" (ngModelChange)="executeRegex()">
                  <label class="form-check-label small font-mono text-secondary" for="flagS">s</label>
                </div>
                <div class="form-check form-check-inline mb-0">
                  <input class="form-check-input" type="checkbox" id="flagU" [(ngModel)]="flags.u" (ngModelChange)="executeRegex()">
                  <label class="form-check-label small font-mono text-secondary" for="flagU">u</label>
                </div>
              </div>

              <!-- Pattern Presets Dropdown -->
              <select
                class="form-select form-select-sm w-auto bg-dark-subtle border-secondary border-opacity-50 text-light"
                (change)="applyPreset($event)"
              >
                <option value="">Presets...</option>
                <option value="email">Email Address</option>
                <option value="url">HTTP / HTTPS URL</option>
                <option value="ipv4">IPv4 Address</option>
                <option value="date">Date (YYYY-MM-DD)</option>
                <option value="hex">Hex Color (#FFF)</option>
                <option value="uuid">UUID v4</option>
              </select>
            </div>
          </div>
        </div>

        @if (regexError) {
          <div class="alert alert-danger mt-3 mb-0 py-2 small d-flex align-items-center gap-2">
            <i class="bi bi-exclamation-triangle-fill"></i>
            <span>{{ regexError }}</span>
          </div>
        } @else if (pattern) {
          <div class="d-flex align-items-center gap-3 mt-3 pt-2 border-top border-secondary border-opacity-25 small text-secondary">
            <span>Matches found: <strong class="text-light">{{ matches.length }}</strong></span>
            <span>Execution time: <strong class="text-light">{{ executionTimeMs }}ms</strong></span>
          </div>
        }
      </div>

      <!-- Test String & Visual Match Inspector Layout -->
      <div class="row g-3">
        <!-- Test String Input -->
        <div class="col-lg-6">
          <app-code-editor
            title="Test String"
            language="text"
            [value]="testString"
            (valueChange)="onTestStringChange($event)"
            placeholder="Type or paste test string to evaluate against pattern..."
            height="460px"
          ></app-code-editor>
        </div>

        <!-- Matches & Capture Groups Output -->
        <div class="col-lg-6">
          <div class="dn-card p-3 h-100 d-flex flex-column">
            <h3 class="h6 fw-bold text-light border-bottom border-secondary border-opacity-25 pb-2 mb-3 d-flex align-items-center justify-content-between">
              <span class="d-flex align-items-center gap-2">
                <i class="bi bi-bullseye text-warning"></i>
                <span>Match Highlights & Groups</span>
              </span>
              <span class="badge bg-secondary-subtle text-secondary font-mono">{{ matches.length }} matches</span>
            </h3>

            <!-- Highlighted text box -->
            <div class="highlighted-preview font-mono p-3 rounded-2 bg-dark-subtle border border-secondary border-opacity-25 mb-3 overflow-auto" style="max-height: 180px; white-space: pre-wrap;" [innerHTML]="highlightedHtml"></div>

            <!-- Detailed Match & Group Table -->
            <div class="match-table-wrapper flex-grow-1 overflow-auto" style="max-height: 240px;">
              @if (matches.length > 0) {
                <table class="table table-sm table-dark table-striped align-middle mb-0 font-mono small">
                  <thead>
                    <tr class="text-secondary">
                      <th style="width: 50px;">#</th>
                      <th>Full Match</th>
                      <th>Range</th>
                      <th>Capture Groups</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (m of matches; track $index; let i = $index) {
                      <tr>
                        <td class="text-secondary">{{ i + 1 }}</td>
                        <td>
                          <span class="badge bg-warning-subtle text-warning border border-warning border-opacity-25">{{ m.match }}</span>
                        </td>
                        <td class="text-secondary small">{{ m.index }}..{{ m.index + m.length }}</td>
                        <td>
                          @if (m.groups.length > 0) {
                            @for (g of m.groups; track g.index) {
                              <span class="badge bg-primary-subtle text-info me-1 mb-1" style="font-size: 0.7rem;">
                                {{ g.name || '$' + g.index }}: {{ g.value }}
                              </span>
                            }
                          } @else {
                            <span class="text-secondary opacity-50">&mdash;</span>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              } @else {
                <div class="text-center text-secondary py-4">
                  <i class="bi bi-search fs-3 mb-1 d-block opacity-50"></i>
                  No matches found for current pattern.
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host ::ng-deep .regex-hl {
      background-color: rgba(212, 255, 36, 0.35);
      color: #ffffff;
      border-bottom: 2px solid var(--dn-accent);
      border-radius: 2px;
      padding: 0 2px;
    }
  `]
})
export class RegexTesterComponent {
  private notifyService = inject(NotificationService);

  public pattern = '([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})';
  public flags = {
    g: true,
    i: true,
    m: false,
    s: false,
    u: false
  };

  public testString = `Contact developer team at team@devnexus.io or support@company.org.
Emergency alerts: ops-alert@infra.cloud.net.
Invalid test emails: bad_address@, plain_word, @domain.com`;

  public matches: RegexMatchItem[] = [];
  public highlightedHtml = '';
  public regexError = '';
  public executionTimeMs = 0;

  get activeFlagsString(): string {
    let f = '';
    if (this.flags.g) f += 'g';
    if (this.flags.i) f += 'i';
    if (this.flags.m) f += 'm';
    if (this.flags.s) f += 's';
    if (this.flags.u) f += 'u';
    return f;
  }

  onTestStringChange(val: string): void {
    this.testString = val;
    this.executeRegex();
  }

  executeRegex(): void {
    this.regexError = '';
    this.matches = [];
    this.highlightedHtml = this.escapeHtml(this.testString);

    if (!this.pattern || !this.testString) {
      return;
    }

    const start = performance.now();

    try {
      const reg = new RegExp(this.pattern, this.activeFlagsString);

      if (this.flags.g) {
        let match: RegExpExecArray | null;
        let lastIndex = 0;
        const matchesList: RegexMatchItem[] = [];

        while ((match = reg.exec(this.testString)) !== null) {
          const fullMatch = match[0];
          const groups: { index: number; name?: string; value: string }[] = [];

          if (match.length > 1) {
            for (let i = 1; i < match.length; i++) {
              groups.push({ index: i, value: match[i] });
            }
          }

          matchesList.push({
            index: match.index,
            length: fullMatch.length,
            match: fullMatch,
            groups
          });

          // Prevent infinite loops on zero-length matches
          if (reg.lastIndex === lastIndex) {
            reg.lastIndex++;
          }
          lastIndex = reg.lastIndex;

          if (matchesList.length >= 500) break; // Safeguard
        }

        this.matches = matchesList;
      } else {
        const match = reg.exec(this.testString);
        if (match) {
          const groups: { index: number; name?: string; value: string }[] = [];
          for (let i = 1; i < match.length; i++) {
            groups.push({ index: i, value: match[i] });
          }
          this.matches = [{
            index: match.index,
            length: match[0].length,
            match: match[0],
            groups
          }];
        }
      }

      this.executionTimeMs = +(performance.now() - start).toFixed(2);
      this.buildHighlightedHtml();
    } catch (err: any) {
      this.regexError = `Regex Error: ${err.message}`;
    }
  }

  private buildHighlightedHtml(): void {
    if (this.matches.length === 0) {
      this.highlightedHtml = this.escapeHtml(this.testString);
      return;
    }

    let result = '';
    let curr = 0;

    for (const m of this.matches) {
      if (m.index > curr) {
        result += this.escapeHtml(this.testString.substring(curr, m.index));
      }
      result += `<span class="regex-hl">${this.escapeHtml(m.match)}</span>`;
      curr = m.index + m.length;
    }

    if (curr < this.testString.length) {
      result += this.escapeHtml(this.testString.substring(curr));
    }

    this.highlightedHtml = result;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  applyPreset(e: Event): void {
    const val = (e.target as HTMLSelectElement).value;
    switch (val) {
      case 'email':
        this.pattern = '([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})';
        break;
      case 'url':
        this.pattern = 'https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)';
        break;
      case 'ipv4':
        this.pattern = '\\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\b';
        break;
      case 'date':
        this.pattern = '\\b(\\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])\\b';
        break;
      case 'hex':
        this.pattern = '#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b';
        break;
      case 'uuid':
        this.pattern = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}';
        break;
    }
    if (val) {
      this.executeRegex();
      this.notifyService.info(`Applied ${val} preset`);
    }
  }

  loadSampleData(): void {
    this.pattern = '([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})';
    this.testString = `DevNexus Notifications:
Email alex@devnexus.io sent 2 reports.
Email contact-us@enterprise.org requested demo on 2026-11-12.`;
    this.executeRegex();
    this.notifyService.info('Sample data loaded');
  }

  clearAll(): void {
    this.pattern = '';
    this.testString = '';
    this.matches = [];
    this.highlightedHtml = '';
    this.regexError = '';
  }
}

