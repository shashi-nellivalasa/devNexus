import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToolHeaderComponent } from '../../../shared/components/tool-header/tool-header.component';
import { CodeEditorComponent } from '../../../shared/components/code-editor/code-editor.component';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-json-to-typescript',
  standalone: true,
  imports: [CommonModule, FormsModule, ToolHeaderComponent, CodeEditorComponent],
  template: `
    <div class="json-to-ts-tool p-3">
      <app-tool-header
        title="JSON to TypeScript Interface Generator"
        description="Convert JSON payloads into strongly-typed TypeScript interfaces, extracting nested objects into modular, reusable types."
        icon="bi-filetype-tsx"
        toolId="json-to-typescript"
        [showSampleBtn]="true"
        [showCopyBtn]="true"
        [copyContent]="outputTs"
        [showDownloadBtn]="true"
        [downloadContent]="outputTs"
        [downloadFilename]="(rootInterfaceName || 'models') + '.ts'"
        (loadSample)="loadSampleData()"
        (clear)="clearAll()"
      ></app-tool-header>

      <!-- Generator Settings Toolbar -->
      <div class="dn-card p-3 mb-3">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div class="d-flex flex-wrap align-items-center gap-3">
            <!-- Root Interface Name -->
            <div class="d-flex align-items-center gap-2">
              <label class="small text-secondary mb-0">Root Interface:</label>
              <input
                type="text"
                class="form-control form-control-sm w-auto bg-dark-subtle border-secondary border-opacity-50 text-light font-mono"
                [(ngModel)]="rootInterfaceName"
                (ngModelChange)="generateTs()"
                placeholder="RootObject"
              />
            </div>

            <!-- Optional Properties Toggle -->
            <div class="form-check form-switch mb-0">
              <input class="form-check-input" type="checkbox" id="optionalProps" [(ngModel)]="makeOptional" (ngModelChange)="generateTs()">
              <label class="form-check-label small text-secondary" for="optionalProps">Make fields optional (?)</label>
            </div>

            <!-- Export Keyword Toggle -->
            <div class="form-check form-switch mb-0">
              <input class="form-check-input" type="checkbox" id="exportKeyword" [(ngModel)]="includeExport" (ngModelChange)="generateTs()">
              <label class="form-check-label small text-secondary" for="exportKeyword">Add 'export' keyword</label>
            </div>
          </div>

          <button type="button" class="btn btn-sm btn-accent d-flex align-items-center gap-1" (click)="generateTs()">
            <i class="bi bi-gear-fill"></i>
            <span>Generate Types</span>
          </button>
        </div>

        @if (errorMessage) {
          <div class="alert alert-danger mt-3 mb-0 py-2 small d-flex align-items-center gap-2">
            <i class="bi bi-exclamation-triangle-fill"></i>
            <span>{{ errorMessage }}</span>
          </div>
        }
      </div>

      <!-- Editor Grid -->
      <div class="row g-3">
        <div class="col-lg-6">
          <app-code-editor
            title="JSON Source Input"
            language="json"
            [value]="inputJson"
            (valueChange)="onInputChanged($event)"
            placeholder="Paste JSON document here..."
            height="500px"
          ></app-code-editor>
        </div>

        <div class="col-lg-6">
          <app-code-editor
            title="Generated TypeScript Interfaces"
            language="typescript"
            [value]="outputTs"
            [readOnly]="true"
            placeholder="Generated TypeScript code will appear here..."
            height="500px"
          ></app-code-editor>
        </div>
      </div>
    </div>
  `
})
export class JsonToTypescriptComponent {
  private notifyService = inject(NotificationService);

  public inputJson = '';
  public outputTs = '';
  public rootInterfaceName = 'RootObject';
  public makeOptional = false;
  public includeExport = true;
  public errorMessage = '';

  private generatedInterfaces: Map<string, string> = new Map();

  onInputChanged(val: string): void {
    this.inputJson = val;
    this.generateTs();
  }

  generateTs(): void {
    this.errorMessage = '';
    this.generatedInterfaces.clear();

    if (!this.inputJson.trim()) {
      this.outputTs = '';
      return;
    }

    try {
      const parsed = JSON.parse(this.inputJson);
      const rootName = this.sanitizeTypeName(this.rootInterfaceName || 'RootObject');

      if (Array.isArray(parsed)) {
        if (parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0] !== null) {
          this.buildInterface(rootName, parsed[0]);
          const exp = this.includeExport ? 'export ' : '';
          this.generatedInterfaces.set(
            `${rootName}List`,
            `${exp}type ${rootName}List = ${rootName}[];`
          );
        } else {
          this.outputTs = `${this.includeExport ? 'export ' : ''}type ${rootName} = ${this.inferPrimitiveType(parsed[0])}[];`;
          return;
        }
      } else if (typeof parsed === 'object' && parsed !== null) {
        this.buildInterface(rootName, parsed);
      } else {
        this.outputTs = `${this.includeExport ? 'export ' : ''}type ${rootName} = ${typeof parsed};`;
        return;
      }

      // Concatenate generated interfaces in order
      const lines: string[] = [];
      this.generatedInterfaces.forEach((content) => {
        lines.push(content);
      });
      this.outputTs = lines.join('\n\n');
    } catch (err: any) {
      this.errorMessage = `Invalid JSON: ${err.message}`;
    }
  }

  private buildInterface(interfaceName: string, obj: Record<string, any>): string {
    const lines: string[] = [];
    const exp = this.includeExport ? 'export ' : '';
    lines.push(`${exp}interface ${interfaceName} {`);

    const opt = this.makeOptional ? '?' : '';

    for (const key of Object.keys(obj)) {
      const val = obj[key];
      const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `'${key}'`;

      if (val === null) {
        lines.push(`  ${safeKey}${opt}: any;`);
      } else if (Array.isArray(val)) {
        if (val.length === 0) {
          lines.push(`  ${safeKey}${opt}: any[];`);
        } else if (typeof val[0] === 'object' && val[0] !== null) {
          const childName = this.capitalize(key) + 'Item';
          this.buildInterface(childName, val[0]);
          lines.push(`  ${safeKey}${opt}: ${childName}[];`);
        } else {
          lines.push(`  ${safeKey}${opt}: ${this.inferPrimitiveType(val[0])}[];`);
        }
      } else if (typeof val === 'object') {
        const childName = this.capitalize(key);
        this.buildInterface(childName, val);
        lines.push(`  ${safeKey}${opt}: ${childName};`);
      } else {
        lines.push(`  ${safeKey}${opt}: ${this.inferPrimitiveType(val)};`);
      }
    }

    lines.push('}');
    const full = lines.join('\n');
    this.generatedInterfaces.set(interfaceName, full);
    return interfaceName;
  }

  private inferPrimitiveType(val: any): string {
    if (typeof val === 'string') return 'string';
    if (typeof val === 'number') return 'number';
    if (typeof val === 'boolean') return 'boolean';
    return 'any';
  }

  private sanitizeTypeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_$]/g, '') || 'Model';
  }

  private capitalize(s: string): string {
    if (!s) return 'Child';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  loadSampleData(): void {
    this.inputJson = JSON.stringify({
      id: 42,
      username: 'johndoe',
      email: 'john@devnexus.io',
      isVerified: true,
      profile: {
        firstName: 'John',
        lastName: 'Doe',
        avatarUrl: 'https://cdn.devnexus.io/avatar.png',
        location: {
          city: 'San Francisco',
          state: 'CA',
          country: 'USA'
        }
      },
      roles: ['ADMIN', 'DEVELOPER'],
      skills: [
        { name: 'Angular 20', proficiency: 98 },
        { name: 'TypeScript', proficiency: 95 }
      ]
    }, null, 2);
    this.rootInterfaceName = 'UserAccount';
    this.generateTs();
    this.notifyService.info('Sample JSON loaded');
  }

  clearAll(): void {
    this.inputJson = '';
    this.outputTs = '';
    this.errorMessage = '';
  }
}

