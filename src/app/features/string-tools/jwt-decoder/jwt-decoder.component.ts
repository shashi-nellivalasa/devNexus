import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToolHeaderComponent } from '../../../shared/components/tool-header/tool-header.component';
import { CodeEditorComponent } from '../../../shared/components/code-editor/code-editor.component';
import { NotificationService } from '../../../core/services/notification.service';

interface JwtPartView {
  raw: string;
  formatted: string;
  parseError?: string;
}

@Component({
  selector: 'app-jwt-decoder',
  standalone: true,
  imports: [CommonModule, FormsModule, ToolHeaderComponent, CodeEditorComponent],
  template: `
    <div class="jwt-decoder-tool p-3 d-flex flex-column flex-grow-1">
      <app-tool-header
        title="JWT Decoder"
        description="Decode JSON Web Token header and payload locally. Signature is not verified — for inspection only."
        icon="bi-shield-lock"
        toolId="jwt-decoder"
        [showSampleBtn]="true"
        [showCopyBtn]="true"
        [copyContent]="payloadFormatted"
        [showClearBtn]="true"
        (loadSample)="loadSample()"
        (clear)="clearAll()"
      ></app-tool-header>

      <div class="dn-card p-3 mb-3">
        <label class="form-label small text-secondary mb-2" for="jwt-input">Encoded JWT</label>
        <textarea
          id="jwt-input"
          class="form-control bg-dark-subtle border-secondary border-opacity-50 text-light font-mono"
          rows="3"
          [(ngModel)]="tokenInput"
          (ngModelChange)="decodeToken()"
          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...."
        ></textarea>
        @if (errorMessage) {
          <div class="alert alert-danger small py-2 mt-2 mb-0">{{ errorMessage }}</div>
        } @else if (isDecoded) {
          <div class="d-flex flex-wrap gap-2 mt-2">
            @if (algorithm) {
              <span class="badge bg-secondary-subtle text-light">alg: {{ algorithm }}</span>
            }
            @if (tokenType) {
              <span class="badge bg-secondary-subtle text-light">typ: {{ tokenType }}</span>
            }
            @if (expiresAtLabel) {
              <span class="badge" [ngClass]="isExpired ? 'bg-danger' : 'bg-success'">
                {{ isExpired ? 'Expired' : 'Valid' }} · exp {{ expiresAtLabel }}
              </span>
            }
          </div>
        }
      </div>

      <div class="row g-3 flex-grow-1">
        <div class="col-lg-6 d-flex flex-column">
          <div class="dn-card flex-grow-1 d-flex flex-column">
            <div class="px-3 py-2 border-bottom border-secondary border-opacity-25 small fw-semibold">Header</div>
            <app-code-editor
              language="json"
              [readOnly]="true"
              [value]="headerFormatted"
              title="Decoded header"
              [fillHeight]="true"
              minHeight="260px"
            ></app-code-editor>
          </div>
        </div>
        <div class="col-lg-6 d-flex flex-column">
          <div class="dn-card flex-grow-1 d-flex flex-column">
            <div class="px-3 py-2 border-bottom border-secondary border-opacity-25 small fw-semibold">Payload</div>
            <app-code-editor
              language="json"
              [readOnly]="true"
              [value]="payloadFormatted"
              title="Decoded payload"
              [fillHeight]="true"
              minHeight="260px"
            ></app-code-editor>
          </div>
        </div>
      </div>
    </div>
  `
})
export class JwtDecoderComponent {
  private readonly notify = inject(NotificationService);

  public tokenInput = '';
  public errorMessage = '';
  public headerFormatted = '{}';
  public payloadFormatted = '{}';
  public algorithm = '';
  public tokenType = '';
  public expiresAtLabel = '';
  public isExpired = false;

  get isDecoded(): boolean {
    return !this.errorMessage && this.tokenInput.trim().length > 0 && this.payloadFormatted !== '{}';
  }

  public decodeToken(): void {
    this.errorMessage = '';
    this.algorithm = '';
    this.tokenType = '';
    this.expiresAtLabel = '';
    this.isExpired = false;

    const token = this.tokenInput.trim();
    if (!token) {
      this.headerFormatted = '{}';
      this.payloadFormatted = '{}';
      return;
    }

    const parts = token.split('.');
    if (parts.length < 2) {
      this.errorMessage = 'JWT must contain at least header and payload segments separated by dots.';
      return;
    }

    try {
      const header = this.decodePart(parts[0]);
      const payload = this.decodePart(parts[1]);
      this.headerFormatted = header.formatted;
      this.payloadFormatted = payload.formatted;

      const headerObj = JSON.parse(header.formatted);
      this.algorithm = typeof headerObj.alg === 'string' ? headerObj.alg : '';
      this.tokenType = typeof headerObj.typ === 'string' ? headerObj.typ : '';

      const payloadObj = JSON.parse(payload.formatted);
      if (typeof payloadObj.exp === 'number') {
        const expDate = new Date(payloadObj.exp * 1000);
        this.expiresAtLabel = expDate.toLocaleString();
        this.isExpired = expDate.getTime() < Date.now();
      }
    } catch {
      this.errorMessage = 'Unable to decode JWT. Check that segments are valid Base64URL JSON.';
    }
  }

  public loadSample(): void {
    this.tokenInput =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkRldk5leHVzIFVzZXIiLCJpYXQiOjE1MTYyMzkwMjIsImV4cCI6OTk5OTk5OTk5OX0.signature-not-verified';
    this.decodeToken();
    this.notify.info('Sample JWT loaded');
  }

  public clearAll(): void {
    this.tokenInput = '';
    this.decodeToken();
  }

  private decodePart(segment: string): JwtPartView {
    const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (padded.length % 4)) % 4;
    const base64 = padded + '='.repeat(padLen);
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(json);
    return { raw: json, formatted: JSON.stringify(parsed, null, 2) };
  }
}