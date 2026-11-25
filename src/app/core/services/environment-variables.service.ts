import { Injectable, computed, signal } from '@angular/core';

export interface ApiEnvironment {
  id: string;
  name: string;
  variables: Record<string, string>;
}

export interface ApiEnvironmentsState {
  activeId: string | null;
  environments: ApiEnvironment[];
}

const STORAGE_KEY = 'devnexus_api_environments';

const DEFAULT_ENVIRONMENTS: ApiEnvironmentsState = {
  activeId: 'local',
  environments: [
    {
      id: 'local',
      name: 'Local',
      variables: { baseUrl: 'http://localhost:3000', token: '' }
    },
    {
      id: 'staging',
      name: 'Staging',
      variables: { baseUrl: 'https://staging-api.example.com', token: '' }
    }
  ]
};

@Injectable({ providedIn: 'root' })
export class EnvironmentVariablesService {
  private readonly state = signal<ApiEnvironmentsState>(this.loadState());

  readonly environments = computed(() => this.state().environments);
  readonly activeId = computed(() => this.state().activeId);
  readonly activeEnvironment = computed(
    () => this.state().environments.find(e => e.id === this.state().activeId) ?? null
  );
  readonly activeVariables = computed(() => this.activeEnvironment()?.variables ?? {});

  public setActiveEnvironment(id: string | null): void {
    this.persist({ ...this.state(), activeId: id });
  }

  public upsertEnvironment(env: ApiEnvironment): void {
    const list = [...this.state().environments];
    const idx = list.findIndex(e => e.id === env.id);
    if (idx >= 0) {
      list[idx] = env;
    } else {
      list.push(env);
    }
    this.persist({ ...this.state(), environments: list });
  }

  public removeEnvironment(id: string): void {
    const environments = this.state().environments.filter(e => e.id !== id);
    const activeId = this.state().activeId === id ? environments[0]?.id ?? null : this.state().activeId;
    this.persist({ activeId, environments });
  }

  /** Replaces `{{variableName}}` tokens (case-sensitive keys). */
  public substitute(text: string): string {
    if (!text.includes('{{')) {
      return text;
    }
    const vars = this.activeVariables();
    return text.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key: string) =>
      Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : `{{${key}}}`
    );
  }

  public exportState(): ApiEnvironmentsState {
    return structuredClone(this.state());
  }

  public importState(data: ApiEnvironmentsState): void {
    if (!data?.environments?.length) {
      this.persist(structuredClone(DEFAULT_ENVIRONMENTS));
      return;
    }
    this.persist({
      activeId: data.activeId ?? data.environments[0].id,
      environments: data.environments
    });
  }

  private loadState(): ApiEnvironmentsState {
    if (typeof localStorage === 'undefined') {
      return structuredClone(DEFAULT_ENVIRONMENTS);
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return structuredClone(DEFAULT_ENVIRONMENTS);
      }
      const parsed = JSON.parse(raw) as ApiEnvironmentsState;
      if (!Array.isArray(parsed.environments) || parsed.environments.length === 0) {
        return structuredClone(DEFAULT_ENVIRONMENTS);
      }
      return parsed;
    } catch {
      return structuredClone(DEFAULT_ENVIRONMENTS);
    }
  }

  private persist(state: ApiEnvironmentsState): void {
    this.state.set(state);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }
}