import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToolHeaderComponent } from '../../../shared/components/tool-header/tool-header.component';
import { CodeEditorComponent } from '../../../shared/components/code-editor/code-editor.component';
import { DiffViewerComponent } from '../../../shared/components/diff-viewer/diff-viewer.component';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-code-diff',
  standalone: true,
  imports: [CommonModule, FormsModule, ToolHeaderComponent, CodeEditorComponent, DiffViewerComponent],
  template: `
    <div class="code-diff-tool p-3">
      <app-tool-header
        title="Code Diff Viewer"
        description="Inspect differences between two source files with unified and side-by-side split comparison views."
        icon="bi-layout-split"
        toolId="code-diff"
        [showSampleBtn]="true"
        [showDownloadBtn]="true"
        [downloadContent]="diffPatch"
        downloadFilename="changes.patch"
        (loadSample)="loadSampleData()"
        (clear)="clearAll()"
      ></app-tool-header>

      <!-- Language & Controls Toolbar -->
      <div class="dn-card p-3 mb-3">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div class="d-flex align-items-center gap-2">
            <label class="small text-secondary mb-0">Language:</label>
            <select class="form-select form-select-sm w-auto bg-dark-subtle border-secondary border-opacity-50 text-light" [(ngModel)]="selectedLanguage">
              <option value="typescript">TypeScript</option>
              <option value="javascript">JavaScript</option>
              <option value="html">HTML</option>
              <option value="css">CSS / SCSS</option>
              <option value="json">JSON</option>
              <option value="sql">SQL</option>
              <option value="text">Plain Text</option>
            </select>
          </div>

          <div class="d-flex align-items-center gap-2">
            <button type="button" class="btn btn-sm btn-outline-secondary" (click)="swapInputs()" title="Swap left and right code">
              <i class="bi bi-arrow-left-right me-1"></i> Swap
            </button>
          </div>
        </div>
      </div>

      <!-- Diff Result Viewer -->
      <div class="mb-4">
        <app-diff-viewer
          [oldText]="leftCode"
          [newText]="rightCode"
          oldTitle="Original Code"
          newTitle="Modified Code"
          viewMode="split"
        ></app-diff-viewer>
      </div>

      <!-- Code Editors for Left and Right -->
      <div class="row g-3">
        <div class="col-lg-6">
          <app-code-editor
            title="Original Code"
            [language]="selectedLanguage"
            [value]="leftCode"
            (valueChange)="leftCode = $event; updatePatch()"
            placeholder="Paste original source code..."
            height="340px"
          ></app-code-editor>
        </div>

        <div class="col-lg-6">
          <app-code-editor
            title="Modified Code"
            [language]="selectedLanguage"
            [value]="rightCode"
            (valueChange)="rightCode = $event; updatePatch()"
            placeholder="Paste modified source code..."
            height="340px"
          ></app-code-editor>
        </div>
      </div>
    </div>
  `
})
export class CodeDiffComponent {
  private notifyService = inject(NotificationService);

  public selectedLanguage = 'typescript';
  public leftCode = '';
  public rightCode = '';
  public diffPatch = '';

  swapInputs(): void {
    const temp = this.leftCode;
    this.leftCode = this.rightCode;
    this.rightCode = temp;
    this.updatePatch();
    this.notifyService.info('Swapped code panes');
  }

  updatePatch(): void {
    this.diffPatch = `--- original\n+++ modified\n${this.leftCode}\n${this.rightCode}`;
  }

  loadSampleData(): void {
    this.selectedLanguage = 'typescript';
    this.leftCode = `import { Component } from '@angular/core';

@Component({
  selector: 'app-user',
  template: '<h1>Hello {{ name }}</h1>'
})
export class UserComponent {
  name: string = 'Developer';

  calculateTotal(items: number[]): number {
    let total = 0;
    for (let i = 0; i < items.length; i++) {
      total += items[i];
    }
    return total;
  }
}`;

    this.rightCode = `import { Component, signal, computed } from '@angular/core';

@Component({
  selector: 'app-user',
  standalone: true,
  template: '<h1>Hello {{ name() }}</h1>'
})
export class UserComponent {
  readonly name = signal<string>('Lead Engineer');
  readonly items = signal<number[]>([10, 20, 30]);

  readonly total = computed(() => {
    return this.items().reduce((acc, curr) => acc + curr, 0);
  });
}`;
    this.updatePatch();
    this.notifyService.info('Sample code diff loaded');
  }

  clearAll(): void {
    this.leftCode = '';
    this.rightCode = '';
    this.diffPatch = '';
  }
}

