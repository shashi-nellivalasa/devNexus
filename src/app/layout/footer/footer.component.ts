import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DEVELOPER_CREDITS } from '../../core/config/developer-credits.config';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <footer class="app-footer mt-auto" [class.app-footer--compact]="compact" role="contentinfo">
      <div class="app-footer-inner">
        <div
          class="footer-bar d-flex"
          [ngClass]="compact ? 'flex-column align-items-start gap-2' : 'flex-column flex-md-row align-items-center justify-content-between gap-3'"
        >
          <div class="footer-copy" [ngClass]="compact ? 'text-start' : 'text-center text-md-start'">
            <span class="footer-product fw-semibold">{{ credits.productName }}</span>
            <span class="footer-dot" aria-hidden="true">·</span>
            <span class="small text-secondary">{{ credits.registrationNotice }}</span>
            <span class="footer-dot d-none d-sm-inline" aria-hidden="true">·</span>
            <span class="small text-secondary d-block d-sm-inline mt-1 mt-sm-0">
              <a [href]="credits.licenseUrl" target="_blank" rel="noopener noreferrer" class="footer-link">{{ credits.licenseName }}</a>
            </span>
          </div>

          <div
            class="footer-meta d-flex flex-wrap align-items-center gap-2"
            [ngClass]="compact ? 'justify-content-between w-100' : 'justify-content-center gap-md-3'"
          >
            <span class="small text-secondary" style="font-size: 0.72rem;">
              {{ credits.productName }} v{{ credits.version }}
            </span>
            <span
              class="badge bg-secondary-subtle text-success border border-success border-opacity-25"
              style="font-size: 0.65rem;"
            >
              Angular 20 Standalone
            </span>
            <span class="small text-secondary" [style.fontSize]="compact ? '0.72rem' : null">
              Built by <span class="footer-dev-name fw-semibold">{{ credits.developerName }}</span>
            </span>
            <nav class="footer-social d-inline-flex align-items-center gap-1" aria-label="Developer profiles">
              <a
                [href]="credits.githubUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="footer-icon-link"
                title="GitHub"
                aria-label="GitHub profile"
              >
                <i class="bi bi-github" aria-hidden="true"></i>
              </a>
              <a
                [href]="credits.linkedInUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="footer-icon-link"
                title="LinkedIn"
                aria-label="LinkedIn profile"
              >
                <i class="bi bi-linkedin" aria-hidden="true"></i>
              </a>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  `,
  styles: [`
    .app-footer {
      flex-shrink: 0;
      margin-top: auto;
      padding: 1.5rem 1rem 2rem;
      border-top: 1px solid var(--dn-border);
      background: linear-gradient(
        180deg,
        color-mix(in srgb, var(--dn-primary) 80%, transparent) 0%,
        var(--dn-surface-2) 100%
      );
    }
    .app-footer--compact {
      padding: 0.75rem;
    }
    .app-footer--compact .footer-copy {
      font-size: 0.72rem;
      line-height: 1.35;
    }
    .app-footer--compact .footer-product {
      font-size: 0.75rem;
    }
    .app-footer--compact .footer-icon-link {
      width: 28px;
      height: 28px;
      border-radius: 6px;
    }
    .app-footer-inner {
      max-width: 1320px;
      margin: 0 auto;
    }
    .footer-product {
      color: var(--dn-text-main);
      font-size: 0.85rem;
    }
    .footer-dot {
      color: var(--dn-text-subtle);
      margin: 0 0.35rem;
    }
    .footer-dev-name {
      color: var(--dn-text-main);
    }
    .footer-link {
      color: var(--dn-accent);
      text-decoration: none;
      &:hover {
        text-decoration: underline;
      }
    }
    .footer-icon-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 8px;
      color: var(--dn-text-muted);
      border: 1px solid var(--dn-border);
      background: var(--dn-surface-card);
      text-decoration: none;
      transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease;
      &:hover {
        color: var(--dn-accent);
        border-color: var(--dn-accent);
        background: var(--dn-surface-1);
      }
    }
  `]
})
export class FooterComponent {
  @Input() compact = false;
  readonly credits = DEVELOPER_CREDITS;
}