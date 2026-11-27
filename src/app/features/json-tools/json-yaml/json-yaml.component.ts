import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as yaml from 'js-yaml';
import { ToolHeaderComponent } from '../../../shared/components/tool-header/tool-header.component';
import { CodeEditorComponent } from '../../../shared/components/code-editor/code-editor.component';
import { NotificationService } from '../../../core/services/notification.service';

type ConvertMode = 'json-to-yaml' | 'yaml-to-json';

@Component({
  selector: 'app-json-yaml',
  standalone: true,
  imports: [CommonModule, FormsModule, ToolHeaderComponent, CodeEditorComponent],
  template: `
    <div class="json-yaml-tool p-3 d-flex flex-column flex-grow-1">
      <app-tool-header
        title="JSON ↔ YAML Converter"
        description="Convert between JSON and YAML locally. Useful for configs, OpenAPI snippets, and Kubernetes manifests."
        icon="bi-filetype-yml"
        toolId="json-yaml"
        [showSampleBtn]="true"
        [showCopyBtn]="true"
        [copyContent]="outputText"
        [showDownloadBtn]="true"
        [downloadContent]="outputText"
        [downloadFilename]="downloadName"
        (loadSample)="loadSample()"
        (clear)="clearAll()"
      ></app-tool-header>

      <div class="dn-card p-3 mb-3">
        <div class="btn-group btn-group-sm" role="group">
          <button
            type="button"
            class="btn"
            [ngClass]="mode === 'json-to-yaml' ? 'btn-accent' : 'btn-outline-secondary'"
            (click)="setMode('json-to-yaml')"
          >
            JSON → YAML
          </button>
          <button
            type="button"
            class="btn"
            [ngClass]="mode === 'yaml-to-json' ? 'btn-accent' : 'btn-outline-secondary'"
            (click)="setMode('yaml-to-json')"
          >
            YAML → JSON
          </button>
        </div>
        <button type="button" class="btn btn-sm btn-accent ms-2" (click)="convert()">
          <i class="bi bi-arrow-repeat me-1"></i> Convert
        </button>
        @if (errorMessage) {
          <div class="alert alert-danger small py-2 mt-3 mb-0">{{ errorMessage }}</div>
        }
      </div>

      <div class="row g-3 flex-grow-1">
        <div class="col-lg-6 d-flex flex-column">
          <app-code-editor
            [title]="inputTitle"
            [language]="inputLanguage"
            [(value)]="inputText"
            (valueChange)="onInputChange()"
            [fillHeight]="true"
          ></app-code-editor>
        </div>
        <div class="col-lg-6 d-flex flex-column">
          <app-code-editor
            [title]="outputTitle"
            [language]="outputLanguage"
            [readOnly]="true"
            [value]="outputText"
            [fillHeight]="true"
          ></app-code-editor>
        </div>
      </div>
    </div>
  `
})
export class JsonYamlComponent {
  private readonly notify = inject(NotificationService);

  public mode: ConvertMode = 'json-to-yaml';
  public inputText = '';
  public outputText = '';
  public errorMessage = '';

  get inputTitle(): string {
    return this.mode === 'json-to-yaml' ? 'JSON input' : 'YAML input';
  }

  get outputTitle(): string {
    return this.mode === 'json-to-yaml' ? 'YAML output' : 'JSON output';
  }

  get inputLanguage(): string {
    return this.mode === 'json-to-yaml' ? 'json' : 'yaml';
  }

  get outputLanguage(): string {
    return this.mode === 'json-to-yaml' ? 'yaml' : 'json';
  }

  get downloadName(): string {
    return this.mode === 'json-to-yaml' ? 'converted.yaml' : 'converted.json';
  }

  public setMode(mode: ConvertMode): void {
    this.mode = mode;
    this.errorMessage = '';
    this.outputText = '';
  }

  public onInputChange(): void {
    this.errorMessage = '';
  }

  public convert(): void {
    this.errorMessage = '';
    const source = this.inputText.trim();
    if (!source) {
      this.notify.warning('Paste content to convert');
      return;
    }

    try {
      if (this.mode === 'json-to-yaml') {
        const obj = JSON.parse(source);
        this.outputText = yaml.dump(obj, { indent: 2, lineWidth: 120, noRefs: true });
      } else {
        const obj = yaml.load(source);
        this.outputText = JSON.stringify(obj, null, 2);
      }
      this.notify.success('Converted successfully');
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : 'Conversion failed';
      this.outputText = '';
    }
  }

  public loadSample(): void {
    if (this.mode === 'json-to-yaml') {
      this.inputText = JSON.stringify(
        {
          service: 'DevNexus',
          version: 1,
          features: ['api-tester', 'jwt-decoder'],
          tls: { enabled: true, minVersion: '1.2' }
        },
        null,
        2
      );
    } else {
      this.inputText = `service: DevNexus\nversion: 1\nfeatures:\n  - api-tester\n  - jwt-decoder\ntls:\n  enabled: true\n  minVersion: "1.2"\n`;
    }
    this.convert();
  }

  public clearAll(): void {
    this.inputText = '';
    this.outputText = '';
    this.errorMessage = '';
  }
}