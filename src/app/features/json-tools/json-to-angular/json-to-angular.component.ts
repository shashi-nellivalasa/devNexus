import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToolHeaderComponent } from '../../../shared/components/tool-header/tool-header.component';
import { CodeEditorComponent } from '../../../shared/components/code-editor/code-editor.component';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-json-to-angular',
  standalone: true,
  imports: [CommonModule, FormsModule, ToolHeaderComponent, CodeEditorComponent],
  template: `
    <div class="json-to-angular-tool p-3">
      <app-tool-header
        title="JSON to Angular Interface & Model Generator"
        description="Generate production-ready Angular model files, DTO contracts, factory helpers, and Angular DataService definitions."
        icon="bi-shield-check"
        badge="Angular 20"
        toolId="json-to-angular"
        [showSampleBtn]="true"
        [showCopyBtn]="true"
        [copyContent]="outputCode"
        [showDownloadBtn]="true"
        [downloadContent]="outputCode"
        [downloadFilename]="(modelBaseName.toLowerCase() || 'model') + '.model.ts'"
        (loadSample)="loadSampleData()"
        (clear)="clearAll()"
      ></app-tool-header>

      <!-- Options Toolbar -->
      <div class="dn-card p-3 mb-3">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div class="d-flex flex-wrap align-items-center gap-3">
            <!-- Model Base Name -->
            <div class="d-flex align-items-center gap-2">
              <label class="small text-secondary mb-0">Model Name:</label>
              <input
                type="text"
                class="form-control form-control-sm w-auto bg-dark-subtle border-secondary border-opacity-50 text-light font-mono"
                [(ngModel)]="modelBaseName"
                (ngModelChange)="generateAngularModel()"
                placeholder="User"
              />
            </div>

            <!-- Naming Suffix / Convention -->
            <div class="d-flex align-items-center gap-2">
              <label class="small text-secondary mb-0">Convention:</label>
              <select class="form-select form-select-sm w-auto bg-dark-subtle border-secondary border-opacity-50 text-light" [(ngModel)]="namingConvention" (ngModelChange)="generateAngularModel()">
                <option value="direct">Direct (User)</option>
                <option value="model">Suffix (UserModel)</option>
                <option value="dto">DTO (UserDto)</option>
                <option value="i-prefix">Prefix (IUser)</option>
              </select>
            </div>

            <!-- Include Factory Function -->
            <div class="form-check form-switch mb-0">
              <input class="form-check-input" type="checkbox" id="factoryFuncCheck" [(ngModel)]="includeFactory" (ngModelChange)="generateAngularModel()">
              <label class="form-check-label small text-secondary" for="factoryFuncCheck">Include Factory function</label>
            </div>

            <!-- Include DataService Contract Snippet -->
            <div class="form-check form-switch mb-0">
              <input class="form-check-input" type="checkbox" id="serviceSnippetCheck" [(ngModel)]="includeServiceSnippet" (ngModelChange)="generateAngularModel()">
              <label class="form-check-label small text-secondary" for="serviceSnippetCheck">Include Angular DataService stub</label>
            </div>
          </div>

          <button type="button" class="btn btn-sm btn-accent d-flex align-items-center gap-1" (click)="generateAngularModel()">
            <i class="bi bi-shield-check"></i>
            <span>Generate Angular Model</span>
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
      <div class="row g-3">
        <div class="col-lg-5">
          <app-code-editor
            title="JSON Payload"
            language="json"
            [value]="inputJson"
            (valueChange)="onInputChanged($event)"
            placeholder="Paste API response JSON here..."
            height="520px"
          ></app-code-editor>
        </div>

        <div class="col-lg-7">
          <app-code-editor
            title="Generated Angular Model File (.ts)"
            language="typescript"
            [value]="outputCode"
            [readOnly]="true"
            placeholder="Angular model code will appear here..."
            height="520px"
          ></app-code-editor>
        </div>
      </div>
    </div>
  `
})
export class JsonToAngularComponent {
  private notifyService = inject(NotificationService);

  public inputJson = '';
  public outputCode = '';
  public modelBaseName = 'User';
  public namingConvention: 'direct' | 'model' | 'dto' | 'i-prefix' = 'direct';
  public includeFactory = true;
  public includeServiceSnippet = true;
  public errorMessage = '';

  private generatedInterfaces: Map<string, string> = new Map();
  private rootFields: Record<string, string> = {};

  onInputChanged(val: string): void {
    this.inputJson = val;
    this.generateAngularModel();
  }

  generateAngularModel(): void {
    this.errorMessage = '';
    this.generatedInterfaces.clear();
    this.rootFields = {};

    if (!this.inputJson.trim()) {
      this.outputCode = '';
      return;
    }

    try {
      const parsed = JSON.parse(this.inputJson);
      const rootModelName = this.formatModelName(this.modelBaseName || 'Model');

      let targetObj = parsed;
      if (Array.isArray(parsed)) {
        targetObj = parsed.length > 0 ? parsed[0] : {};
      }

      this.buildAngularInterface(rootModelName, targetObj, true);

      const parts: string[] = [];

      // File header
      parts.push(`/**\n * DevNexus Angular 20 Model Definition\n * Model: ${rootModelName}\n */`);

      // Interfaces
      this.generatedInterfaces.forEach(code => parts.push(code));

      // Factory function
      if (this.includeFactory) {
        parts.push(this.buildFactoryFunction(rootModelName));
      }

      // Angular DataService Snippet
      if (this.includeServiceSnippet) {
        parts.push(this.buildServiceSnippet(rootModelName));
      }

      this.outputCode = parts.join('\n\n');
    } catch (err: any) {
      this.errorMessage = `Invalid JSON: ${err.message}`;
    }
  }

  private buildAngularInterface(interfaceName: string, obj: Record<string, any>, isRoot = false): string {
    const lines: string[] = [];
    lines.push(`export interface ${interfaceName} {`);

    for (const key of Object.keys(obj)) {
      const val = obj[key];
      const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `'${key}'`;

      if (val === null) {
        lines.push(`  ${safeKey}: string | null;`);
        if (isRoot) this.rootFields[key] = 'null';
      } else if (Array.isArray(val)) {
        if (val.length === 0) {
          lines.push(`  ${safeKey}: any[];`);
          if (isRoot) this.rootFields[key] = '[]';
        } else if (typeof val[0] === 'object' && val[0] !== null) {
          const childName = this.formatModelName(key) + 'Item';
          this.buildAngularInterface(childName, val[0]);
          lines.push(`  ${safeKey}: ${childName}[];`);
          if (isRoot) this.rootFields[key] = '[]';
        } else {
          const prim = this.inferType(val[0]);
          lines.push(`  ${safeKey}: ${prim}[];`);
          if (isRoot) this.rootFields[key] = '[]';
        }
      } else if (typeof val === 'object') {
        const childName = this.formatModelName(key);
        this.buildAngularInterface(childName, val);
        lines.push(`  ${safeKey}: ${childName};`);
        if (isRoot) this.rootFields[key] = `{}`;
      } else {
        const prim = this.inferType(val);
        lines.push(`  ${safeKey}: ${prim};`);
        if (isRoot) {
          if (prim === 'string') this.rootFields[key] = "''";
          else if (prim === 'number') this.rootFields[key] = '0';
          else if (prim === 'boolean') this.rootFields[key] = 'false';
          else this.rootFields[key] = 'null';
        }
      }
    }

    lines.push('}');
    const full = lines.join('\n');
    this.generatedInterfaces.set(interfaceName, full);
    return interfaceName;
  }

  private buildFactoryFunction(modelName: string): string {
    const fields = Object.entries(this.rootFields)
      .map(([k, defaultVal]) => `    ${k}: ${defaultVal}`)
      .join(',\n');

    return `export function createEmpty${modelName}(): ${modelName} {\n  return {\n${fields}\n  };\n}`;
  }

  private buildServiceSnippet(modelName: string): string {
    return `// Angular 20 DataService Consumer Example
import { Injectable, DestroyRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ${modelName}DataService {
  private readonly apiUrl = '/api/${this.modelBaseName.toLowerCase()}s';

  constructor(
    private http: HttpClient,
    private destroyRef: DestroyRef
  ) {}

  public getAll(): Observable<${modelName}[]> {
    return this.http.get<${modelName}[]>(this.apiUrl);
  }

  public getById(id: string | number): Observable<${modelName}> {
    return this.http.get<${modelName}>(\`\${this.apiUrl}/\${id}\`);
  }

  public create(payload: ${modelName}): Observable<${modelName}> {
    return this.http.post<${modelName}>(this.apiUrl, payload);
  }
}`;
  }

  private inferType(val: any): string {
    if (typeof val === 'string') return 'string';
    if (typeof val === 'number') return 'number';
    if (typeof val === 'boolean') return 'boolean';
    return 'any';
  }

  private formatModelName(base: string): string {
    const clean = base.replace(/[^a-zA-Z0-9_$]/g, '') || 'Model';
    const capitalized = clean.charAt(0).toUpperCase() + clean.slice(1);

    switch (this.namingConvention) {
      case 'model': return `${capitalized}Model`;
      case 'dto': return `${capitalized}Dto`;
      case 'i-prefix': return `I${capitalized}`;
      default: return capitalized;
    }
  }

  loadSampleData(): void {
    this.inputJson = JSON.stringify({
      id: 'usr_84920',
      email: 'alex.rivera@company.com',
      displayName: 'Alex Rivera',
      isEmailVerified: true,
      lastLoginAt: '2026-11-12T09:30:00Z',
      preferences: {
        theme: 'dark',
        notificationsEnabled: true,
        locale: 'en-US'
      },
      tags: ['lead-dev', 'maintainer']
    }, null, 2);
    this.modelBaseName = 'UserProfile';
    this.generateAngularModel();
    this.notifyService.info('Sample JSON loaded');
  }

  clearAll(): void {
    this.inputJson = '';
    this.outputCode = '';
    this.errorMessage = '';
  }
}

