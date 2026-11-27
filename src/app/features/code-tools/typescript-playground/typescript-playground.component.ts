import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToolHeaderComponent } from '../../../shared/components/tool-header/tool-header.component';
import { CodeEditorComponent } from '../../../shared/components/code-editor/code-editor.component';
import { NotificationService } from '../../../core/services/notification.service';
import type * as tsTypes from 'typescript';

type TsModule = typeof tsTypes;
let compilerLoadPromise: Promise<TsModule> | null = null;

@Component({
  selector: 'app-typescript-playground',
  standalone: true,
  imports: [CommonModule, FormsModule, ToolHeaderComponent, CodeEditorComponent],
  template: `
    <div class="ts-playground-tool p-3 d-flex flex-column flex-grow-1">
      <app-tool-header
        title="TypeScript Playground"
        description="In-browser live TypeScript compiler and transpiler. Experiment with modern TypeScript features, decorators, generics, and compiler target outputs."
        icon="bi-terminal"
        badge="Monaco & TS 5.8"
        toolId="typescript-playground"
        [showSampleBtn]="true"
        [showCopyBtn]="true"
        [copyContent]="outputJs"
        [showDownloadBtn]="true"
        [downloadContent]="outputJs"
        downloadFilename="compiled.js"
        (loadSample)="loadSampleData()"
        (clear)="clearAll()"
      ></app-tool-header>

      <!-- Compiler Options Toolbar -->
      <div class="dn-card p-3 mb-3">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div class="d-flex flex-wrap align-items-center gap-3">
            <!-- Target Selector -->
            <div class="d-flex align-items-center gap-2">
              <label class="small text-secondary mb-0">Target:</label>
              <select class="form-select form-select-sm w-auto bg-dark-subtle border-secondary border-opacity-50 text-light" [(ngModel)]="targetVersion" (ngModelChange)="compile()">
                <option value="ES2022">ES2022 (Modern)</option>
                <option value="ES2020">ES2020</option>
                <option value="ES2015">ES2015 (ES6)</option>
                <option value="ES5">ES5 (Legacy)</option>
                <option value="ESNext">ESNext</option>
              </select>
            </div>

            <!-- Module Format -->
            <div class="d-flex align-items-center gap-2">
              <label class="small text-secondary mb-0">Module:</label>
              <select class="form-select form-select-sm w-auto bg-dark-subtle border-secondary border-opacity-50 text-light" [(ngModel)]="moduleFormat" (ngModelChange)="compile()">
                <option value="ESNext">ESNext (import/export)</option>
                <option value="CommonJS">CommonJS (require)</option>
                <option value="None">None</option>
              </select>
            </div>

            <!-- Remove Comments -->
            <div class="form-check form-switch mb-0">
              <input class="form-check-input" type="checkbox" id="removeCommentsCheck" [(ngModel)]="removeComments" (ngModelChange)="compile()">
              <label class="form-check-label small text-secondary" for="removeCommentsCheck">Remove comments</label>
            </div>
          </div>

          <div class="d-flex align-items-center gap-2">
            <button type="button" class="btn btn-sm btn-outline-info d-flex align-items-center gap-1" (click)="runCode()">
              <i class="bi bi-play-circle-fill"></i>
              <span>Run in Console</span>
            </button>
            <button type="button" class="btn btn-sm btn-accent d-flex align-items-center gap-1" (click)="compile()" [disabled]="isLoadingCompiler">
              <i class="bi bi-lightning-charge-fill"></i>
              <span>{{ isLoadingCompiler ? 'Loading TS...' : 'Compile' }}</span>
            </button>
          </div>
        </div>

        @if (compilationError) {
          <div class="alert alert-danger mt-3 mb-0 py-2 small d-flex align-items-center gap-2">
            <i class="bi bi-exclamation-triangle-fill"></i>
            <span>{{ compilationError }}</span>
          </div>
        }
      </div>

      <!-- Editors -->
      <div class="row g-3 flex-grow-1">
        <div class="col-lg-6 d-flex flex-column">
          <app-code-editor
            title="TypeScript Source"
            language="typescript"
            [value]="inputTs"
            (valueChange)="onTsChange($event)"
            placeholder="Write TypeScript code here..."
            [fillHeight]="true"
          ></app-code-editor>
        </div>

        <div class="col-lg-6 d-flex flex-column">
          <app-code-editor
            title="Compiled JavaScript Output"
            language="javascript"
            [value]="outputJs"
            [readOnly]="true"
            placeholder="Transpiled JavaScript will appear here..."
            [fillHeight]="true"
          ></app-code-editor>
        </div>
      </div>

      <!-- Console Execution Logs Panel -->
      @if (consoleLogs.length > 0) {
        <div class="mt-3 dn-card p-3">
          <div class="d-flex align-items-center justify-content-between border-bottom border-secondary border-opacity-25 pb-2 mb-2">
            <span class="small fw-bold text-light d-flex align-items-center gap-2">
              <i class="bi bi-terminal-split text-info"></i> Execution Output
            </span>
            <button class="btn btn-sm btn-link text-secondary p-0 text-decoration-none" (click)="consoleLogs = []">Clear</button>
          </div>
          <div class="font-mono small p-2 bg-dark rounded-2 overflow-auto" style="max-height: 160px;">
            @for (log of consoleLogs; track $index) {
              <div class="text-light py-0.5">&gt; {{ log }}</div>
            }
          </div>
        </div>
      }
    </div>
  `
})
export class TypescriptPlaygroundComponent implements OnInit {
  private notifyService = inject(NotificationService);

  public inputTs = '';
  public outputJs = '';
  public targetVersion = 'ES2022';
  public moduleFormat = 'ESNext';
  public removeComments = false;
  public compilationError = '';
  public isLoadingCompiler = false;
  public consoleLogs: string[] = [];

  private tsCompiler: TsModule | null = null;

  ngOnInit(): void {
    this.loadSampleData();
  }

  onTsChange(val: string): void {
    this.inputTs = val;
    this.compile();
  }

  async ensureCompilerLoaded(): Promise<TsModule> {
    if (this.tsCompiler) return this.tsCompiler;
    const globalTs = (window as any).ts as TsModule | undefined;
    if (globalTs?.transpileModule) {
      this.tsCompiler = globalTs;
      return globalTs;
    }

    this.isLoadingCompiler = true;
    try {
      if (!compilerLoadPromise) {
        compilerLoadPromise = new Promise<TsModule>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = new URL('vendor/typescript/typescript.js', document.baseURI).toString();
          script.async = true;
          script.onload = () => {
            const loaded = (window as any).ts as TsModule | undefined;
            if (loaded?.transpileModule) {
              resolve(loaded);
            } else {
              compilerLoadPromise = null;
              reject(new Error('TypeScript compiler global not initialized'));
            }
          };
          script.onerror = () => {
            compilerLoadPromise = null;
            reject(new Error('Failed to load TypeScript compiler script'));
          };
          document.head.appendChild(script);
        });
      }
      this.tsCompiler = await compilerLoadPromise;
      return this.tsCompiler;
    } finally {
      this.isLoadingCompiler = false;
    }
  }

  compile(): void {
    this.compilationError = '';
    if (!this.inputTs.trim()) {
      this.outputJs = '';
      return;
    }

    const ts = this.tsCompiler ?? ((window as any).ts as TsModule | undefined);
    if (!ts?.transpileModule) {
      void this.ensureCompilerLoaded()
        .then(() => this.compile())
        .catch((err: any) => {
          this.compilationError = `TypeScript Compiler Load Error: ${err?.message || 'Unable to load compiler'}`;
        });
      return;
    }
    this.tsCompiler = ts;

    try {
      let target = ts.ScriptTarget.ES2022;
      switch (this.targetVersion) {
        case 'ES5': target = ts.ScriptTarget.ES5; break;
        case 'ES2015': target = ts.ScriptTarget.ES2015; break;
        case 'ES2020': target = ts.ScriptTarget.ES2020; break;
        case 'ES2022': target = ts.ScriptTarget.ES2022; break;
        case 'ESNext': target = ts.ScriptTarget.ESNext; break;
      }

      let moduleKind = ts.ModuleKind.ESNext;
      switch (this.moduleFormat) {
        case 'CommonJS': moduleKind = ts.ModuleKind.CommonJS; break;
        case 'None': moduleKind = ts.ModuleKind.None; break;
        default: moduleKind = ts.ModuleKind.ESNext; break;
      }

      const res = ts.transpileModule(this.inputTs, {
        compilerOptions: {
          target,
          module: moduleKind,
          removeComments: this.removeComments,
          strict: true,
          esModuleInterop: true
        }
      });

      this.outputJs = res.outputText;
    } catch (err: any) {
      this.compilationError = `TypeScript Compilation Error: ${err.message}`;
    }
  }

  runCode(): void {
    if (!this.outputJs) return;
    this.consoleLogs = [];

    const originalLog = console.log;
    const captured: string[] = [];
    console.log = (...args: any[]) => {
      captured.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
      originalLog.apply(console, args);
    };

    try {
      // Evaluate in function scope
      const runner = new Function(this.outputJs);
      runner();
      this.consoleLogs = captured.length > 0 ? captured : ['(Code executed successfully with no console.log output)'];
      this.notifyService.success('Executed script');
    } catch (e: any) {
      this.consoleLogs = [`Error executing JavaScript: ${e.message}`];
    } finally {
      console.log = originalLog;
    }
  }

  loadSampleData(): void {
    this.inputTs = `// DevNexus TypeScript Playground Example
interface Developer {
  id: number;
  name: string;
  skills: string[];
  role: 'Frontend' | 'Backend' | 'Fullstack';
}

class DeveloperManager {
  private developers: Developer[] = [];

  public add(dev: Developer): void {
    this.developers.push(dev);
    console.log(\`Added \${dev.name} as \${dev.role}\`);
  }

  public getBySkill(skill: string): Developer[] {
    return this.developers.filter(d => d.skills.includes(skill));
  }
}

const manager = new DeveloperManager();
manager.add({
  id: 1,
  name: 'Alex',
  skills: ['Angular 20', 'TypeScript', 'SCSS'],
  role: 'Frontend'
});

const angularDevs = manager.getBySkill('Angular 20');
console.log('Angular Developers Count:', angularDevs.length);`;

    this.compile();
  }

  clearAll(): void {
    this.inputTs = '';
    this.outputJs = '';
    this.consoleLogs = [];
    this.compilationError = '';
  }
}

