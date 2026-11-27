import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToolHeaderComponent } from '../../../shared/components/tool-header/tool-header.component';
import { CodeEditorComponent } from '../../../shared/components/code-editor/code-editor.component';
import { NotificationService } from '../../../core/services/notification.service';

type EncodingType = 'base64' | 'url' | 'html' | 'hex';

@Component({
  selector: 'app-encode-decode',
  standalone: true,
  imports: [CommonModule, FormsModule, ToolHeaderComponent, CodeEditorComponent],
  template: `
    <div class="encode-decode-tool p-3 d-flex flex-column flex-grow-1">
      <app-tool-header
        title="Base64 / URL / HTML / Hex Encode Decode"
        description="Encode and decode text across UTF-8 Base64, URL encoding, HTML character entities, and Hexadecimal representations."
        icon="bi-code-slash"
        toolId="encode-decode"
        [showSampleBtn]="true"
        [showCopyBtn]="true"
        [copyContent]="outputText"
        [showDownloadBtn]="true"
        [downloadContent]="outputText"
        downloadFilename="encoded-output.txt"
        (loadSample)="loadSampleData()"
        (clear)="clearAll()"
      ></app-tool-header>

      <!-- Operation Controls Toolbar -->
      <div class="dn-card p-3 mb-3">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <!-- Direction -->
          <div class="btn-group" role="group">
            <button
              type="button"
              class="btn btn-sm"
              [ngClass]="direction === 'encode' ? 'btn-accent' : 'btn-outline-secondary'"
              (click)="setDirection('encode')"
            >
              <i class="bi bi-lock me-1"></i> Encode
            </button>
            <button
              type="button"
              class="btn btn-sm"
              [ngClass]="direction === 'decode' ? 'btn-accent' : 'btn-outline-secondary'"
              (click)="setDirection('decode')"
            >
              <i class="bi bi-unlock me-1"></i> Decode
            </button>
          </div>

          <!-- Encoding Scheme -->
          <div class="d-flex align-items-center gap-2">
            <label class="small text-secondary mb-0">Format:</label>
            <div class="btn-group btn-group-sm" role="group">
              <button
                type="button"
                class="btn btn-outline-secondary"
                [class.active]="encodingType === 'base64'"
                (click)="setEncodingType('base64')"
              >
                Base64 (UTF-8)
              </button>
              <button
                type="button"
                class="btn btn-outline-secondary"
                [class.active]="encodingType === 'url'"
                (click)="setEncodingType('url')"
              >
                URL (URI)
              </button>
              <button
                type="button"
                class="btn btn-outline-secondary"
                [class.active]="encodingType === 'html'"
                (click)="setEncodingType('html')"
              >
                HTML Entities
              </button>
              <button
                type="button"
                class="btn btn-outline-secondary"
                [class.active]="encodingType === 'hex'"
                (click)="setEncodingType('hex')"
              >
                Hexadecimal
              </button>
            </div>
          </div>

          <!-- URL specifics -->
          @if (encodingType === 'url' && direction === 'encode') {
            <div class="form-check form-switch mb-0">
              <input class="form-check-input" type="checkbox" id="encodeAllCharsCheck" [(ngModel)]="urlEncodeAll" (ngModelChange)="process()">
              <label class="form-check-label small text-secondary" for="encodeAllCharsCheck">Encode all special chars</label>
            </div>
          }

          <button type="button" class="btn btn-sm btn-accent d-flex align-items-center gap-1" (click)="process()">
            <i class="bi bi-arrow-repeat"></i>
            <span>Execute</span>
          </button>
        </div>

        @if (errorMessage) {
          <div class="alert alert-danger mt-3 mb-0 py-2 small d-flex align-items-center gap-2">
            <i class="bi bi-exclamation-triangle-fill"></i>
            <span>{{ errorMessage }}</span>
          </div>
        }
      </div>

      <!-- Editors -->
      <div class="row g-3 flex-grow-1">
        <div class="col-lg-6 d-flex flex-column">
          <app-code-editor
            [title]="direction === 'encode' ? 'Raw Input Text' : 'Encoded Input Data'"
            language="text"
            [value]="inputText"
            (valueChange)="onInputChanged($event)"
            placeholder="Enter text to convert..."
            [fillHeight]="true"
          ></app-code-editor>
        </div>

        <div class="col-lg-6 d-flex flex-column">
          <app-code-editor
            [title]="direction === 'encode' ? 'Encoded Output Result' : 'Decoded Plaintext'"
            language="text"
            [value]="outputText"
            [readOnly]="true"
            placeholder="Converted result will appear here..."
            [fillHeight]="true"
          ></app-code-editor>
        </div>
      </div>
    </div>
  `
})
export class EncodeDecodeComponent {
  private notifyService = inject(NotificationService);

  public direction: 'encode' | 'decode' = 'encode';
  public encodingType: EncodingType = 'base64';
  public inputText = '';
  public outputText = '';
  public urlEncodeAll = true;
  public errorMessage = '';

  setDirection(dir: 'encode' | 'decode'): void {
    this.direction = dir;
    this.process();
  }

  setEncodingType(type: EncodingType): void {
    this.encodingType = type;
    this.process();
  }

  onInputChanged(val: string): void {
    this.inputText = val;
    this.process();
  }

  process(): void {
    this.errorMessage = '';
    if (!this.inputText) {
      this.outputText = '';
      return;
    }

    try {
      if (this.direction === 'encode') {
        this.outputText = this.doEncode(this.inputText, this.encodingType);
      } else {
        this.outputText = this.doDecode(this.inputText, this.encodingType);
      }
    } catch (err: any) {
      this.errorMessage = `Encoding Error: ${err.message}`;
    }
  }

  private doEncode(str: string, type: EncodingType): string {
    switch (type) {
      case 'base64':
        // Full UTF-8 Base64 encoding
        const encoder = new TextEncoder();
        const bytes = encoder.encode(str);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);

      case 'url':
        return this.urlEncodeAll ? encodeURIComponent(str) : encodeURI(str);

      case 'html':
        return str.replace(/[\u00A0-\u9999<>\&"']/g, (i) => `&#${i.charCodeAt(0)};`);

      case 'hex':
        return Array.from(new TextEncoder().encode(str))
          .map(b => b.toString(16).padStart(2, '0'))
          .join(' ');
    }
  }

  private doDecode(str: string, type: EncodingType): string {
    switch (type) {
      case 'base64':
        // Safe UTF-8 Base64 decoding
        const cleanB64 = str.replace(/\s+/g, '');
        const binaryStr = atob(cleanB64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        return new TextDecoder().decode(bytes);

      case 'url':
        return decodeURIComponent(str.replace(/\+/g, '%20'));

      case 'html':
        const doc = new DOMParser().parseFromString(str, 'text/html');
        return doc.documentElement.textContent || '';

      case 'hex':
        const cleanHex = str.replace(/[^0-9a-fA-F]/g, '');
        if (cleanHex.length % 2 !== 0) {
          throw new Error('Hexadecimal string has an odd number of digits.');
        }
        const hexBytes = new Uint8Array(cleanHex.length / 2);
        for (let i = 0; i < cleanHex.length; i += 2) {
          hexBytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
        }
        return new TextDecoder().decode(hexBytes);
    }
  }

  loadSampleData(): void {
    if (this.direction === 'encode') {
      this.inputText = 'DevNexus — Modern Developer Utility Suite & API Workbench 🚀';
    } else {
      this.inputText = 'RGV2TmV4dXMg4oCUIE1vZGVybiBEZXZlbG9wZXIgVXRpbGl0eSBTdWl0ZSAmIEFQSSBXb3JrYmVuY2gg8J+agA==';
    }
    this.process();
    this.notifyService.info('Sample data loaded');
  }

  clearAll(): void {
    this.inputText = '';
    this.outputText = '';
    this.errorMessage = '';
  }
}

