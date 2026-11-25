import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  ApiEnvironment,
  EnvironmentVariablesService
} from '../../core/services/environment-variables.service';
import { DataService } from '../../core/services/data.service';
import { ModalService } from '../../core/services/modal.service';
import { NotificationService } from '../../core/services/notification.service';
import { StorageService, UserPreferences } from '../../core/services/storage.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="settings-page p-3 p-lg-4" style="max-width: 960px;">
      <div class="d-flex align-items-center gap-2 mb-4">
        <a routerLink="/" class="btn btn-sm btn-outline-secondary"><i class="bi bi-arrow-left"></i></a>
        <div>
          <h1 class="h4 mb-0 fw-bold">Settings &amp; Data</h1>
          <p class="text-secondary small mb-0">Preferences, API environments, and local backup — everything stays in your browser.</p>
        </div>
      </div>

      <div class="dn-card p-4 mb-3">
        <h2 class="h6 fw-bold mb-3">Editor preferences</h2>
        <div class="row g-3">
          <div class="col-md-4">
            <label class="form-label small" for="pref-font">Font size (px)</label>
            <input id="pref-font" type="number" class="form-control form-control-sm bg-dark-subtle border-secondary" min="10" max="24"
              [ngModel]="prefs().editorFontSize" (ngModelChange)="patchPrefs({ editorFontSize: $event })" />
          </div>
          <div class="col-md-4">
            <label class="form-label small" for="pref-tab">Tab size</label>
            <input id="pref-tab" type="number" class="form-control form-control-sm bg-dark-subtle border-secondary" min="2" max="8"
              [ngModel]="prefs().editorTabSize" (ngModelChange)="patchPrefs({ editorTabSize: $event })" />
          </div>
          <div class="col-md-4 d-flex align-items-end">
            <div class="form-check form-switch">
              <input class="form-check-input" type="checkbox" id="pref-wrap"
                [ngModel]="prefs().wordWrap" (ngModelChange)="patchPrefs({ wordWrap: $event })" />
              <label class="form-check-label small" for="pref-wrap">Word wrap in editors</label>
            </div>
          </div>
        </div>
      </div>

      <div class="dn-card p-4 mb-3">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
          <h2 class="h6 fw-bold mb-0">API environments</h2>
          <button type="button" class="btn btn-sm btn-outline-secondary" (click)="addEnvironment()">
            <i class="bi bi-plus-lg me-1"></i> Add environment
          </button>
        </div>
        <p class="text-secondary small" ngNonBindable>
          Use double-curly placeholders such as <code class="font-mono">{{baseUrl}}</code> in the API Tester URL, headers, and body.
        </p>

        <label class="form-label small" for="active-env">Active environment</label>
        <select id="active-env" class="form-select form-select-sm bg-dark-subtle border-secondary mb-3" style="max-width: 320px;"
          [ngModel]="envService.activeId()" (ngModelChange)="envService.setActiveEnvironment($event)">
          <option [ngValue]="null">None</option>
          @for (env of envService.environments(); track env.id) {
            <option [ngValue]="env.id">{{ env.name }}</option>
          }
        </select>

        @for (env of envService.environments(); track env.id) {
          <div class="border border-secondary border-opacity-25 rounded-3 p-3 mb-2">
            <div class="d-flex flex-wrap gap-2 mb-2">
              <input class="form-control form-control-sm bg-dark-subtle border-secondary" style="max-width: 220px;"
                [ngModel]="env.name" (ngModelChange)="renameEnvironment(env.id, $event)" aria-label="Environment name" />
              <button type="button" class="btn btn-sm btn-outline-danger ms-auto" (click)="removeEnvironment(env.id)">Remove</button>
            </div>
            @for (row of envVarRows(env); track row.key) {
              <div class="input-group input-group-sm mb-1">
                <span class="input-group-text bg-dark-subtle border-secondary font-mono">{{ row.key }}</span>
                <input class="form-control bg-dark-subtle border-secondary font-mono" [ngModel]="row.value"
                  (ngModelChange)="setEnvVar(env.id, row.key, $event)" />
              </div>
            }
            <button type="button" class="btn btn-sm btn-link px-0" (click)="addEnvVariable(env.id)">+ variable</button>
          </div>
        }
      </div>

      <div class="dn-card p-4">
        <h2 class="h6 fw-bold mb-3">Backup &amp; restore</h2>
        <p class="text-secondary small">
          Exports favorites, recents (stored in browser cookies, 30-day rolling expiry), preferences, API environments, collections, and request history.
        </p>
        <div class="d-flex flex-wrap gap-2">
          <button type="button" class="btn btn-sm btn-accent" (click)="exportAll()" [disabled]="exporting">
            <i class="bi bi-download me-1"></i> Export JSON
          </button>
          <label class="btn btn-sm btn-outline-secondary mb-0">
            <i class="bi bi-upload me-1"></i> Import JSON
            <input type="file" accept="application/json,.json" class="d-none" (change)="onImportFile($event)" />
          </label>
          <button type="button" class="btn btn-sm btn-outline-danger" (click)="clearAllLocalData()">Clear all local data</button>
        </div>
      </div>
    </div>
  `
})
export class SettingsComponent {
  private readonly storage = inject(StorageService);
  private readonly data = inject(DataService);
  private readonly modal = inject(ModalService);
  private readonly notify = inject(NotificationService);
  readonly envService = inject(EnvironmentVariablesService);

  public exporting = false;
  readonly prefs = this.storage.preferences;

  patchPrefs(partial: Partial<UserPreferences>): void {
    this.storage.updatePreferences(partial);
  }

  envVarRows(env: ApiEnvironment): { key: string; value: string }[] {
    return Object.keys(env.variables).map(key => ({ key, value: env.variables[key] }));
  }

  addEnvironment(): void {
    const id = `env-${Date.now()}`;
    this.envService.upsertEnvironment({
      id,
      name: 'New environment',
      variables: { baseUrl: '', token: '' }
    });
    this.envService.setActiveEnvironment(id);
  }

  renameEnvironment(id: string, name: string): void {
    const env = this.envService.environments().find(e => e.id === id);
    if (!env) return;
    this.envService.upsertEnvironment({ ...env, name });
  }

  setEnvVar(envId: string, key: string, value: string): void {
    const env = this.envService.environments().find(e => e.id === envId);
    if (!env) return;
    this.envService.upsertEnvironment({
      ...env,
      variables: { ...env.variables, [key]: value }
    });
  }

  addEnvVariable(envId: string): void {
    const key = prompt('Variable name (e.g. apiKey):')?.trim();
    if (!key) return;
    this.setEnvVar(envId, key, '');
  }

  async removeEnvironment(id: string): Promise<void> {
    const ok = await this.modal.confirm({
      title: 'Remove environment',
      message: 'Delete this environment and its variables?',
      confirmText: 'Remove',
      isDestructive: true
    });
    if (ok) {
      this.envService.removeEnvironment(id);
    }
  }

  async exportAll(): Promise<void> {
    this.exporting = true;
    try {
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        preferences: this.storage.exportSnapshot(),
        apiEnvironments: this.envService.exportState(),
        apiWorkspace: await this.data.exportWorkspaceSnapshot()
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `devnexus-backup-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.notify.success('Backup downloaded');
    } finally {
      this.exporting = false;
    }
  }

  async onImportFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.preferences) {
        this.storage.importSnapshot(data.preferences);
      }
      if (data.apiEnvironments) {
        this.envService.importState(data.apiEnvironments);
      }
      if (data.apiWorkspace) {
        await this.data.importWorkspaceSnapshot(data.apiWorkspace);
      }
      this.notify.success('Backup imported');
    } catch {
      this.notify.error('Invalid backup file');
    }
  }

  async clearAllLocalData(): Promise<void> {
    const ok = await this.modal.confirm({
      title: 'Clear all data',
      message: 'This removes favorites, history, collections, environments, and preferences from this browser.',
      confirmText: 'Clear everything',
      isDestructive: true
    });
    if (!ok) return;
    this.storage.clearAllLocal();
    this.envService.importState({ activeId: null, environments: [] });
    await this.data.clearAllWorkspaceData();
    this.notify.info('Local data cleared');
  }
}