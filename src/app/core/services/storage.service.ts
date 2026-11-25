import { Injectable, signal } from '@angular/core';
import { isRegisteredToolId, pruneToRegisteredToolIds } from '../config/tool-catalog';
import { deleteCookie, getCookie, setCookie } from '../../shared/utils/cookie.util';

export interface UserPreferences {
  editorFontSize: number;
  editorTabSize: number;
  wordWrap: boolean;
  defaultIndent: number;
  sidebarCollapsed: boolean;
}

const DEFAULT_FAVORITE_TOOL_IDS: string[] = [
  'json-formatter',
  'api-tester',
  'regex-tester',
  'typescript-playground'
];

const DEFAULT_PREFS: UserPreferences = {
  editorFontSize: 13,
  editorTabSize: 2,
  wordWrap: true,
  defaultIndent: 2,
  sidebarCollapsed: false
};

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  /** @deprecated legacy localStorage keys — migrated to cookies on load */
  private readonly LEGACY_FAVORITES_KEY = 'devnexus_favorites';
  private readonly LEGACY_RECENT_KEY = 'devnexus_recent_tools';
  private readonly FAVORITES_COOKIE = 'devnexus_favorites';
  private readonly RECENT_COOKIE = 'devnexus_recent_tools';
  private readonly PREFS_KEY = 'devnexus_preferences';

  public readonly favorites = signal<string[]>([]);
  public readonly recentTools = signal<string[]>([]);
  public readonly preferences = signal<UserPreferences>(DEFAULT_PREFS);

  constructor() {
    this.loadAll();
  }

  private loadAll(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      this.favorites.set(this.readToolIdListFromCookieOrLegacy(this.FAVORITES_COOKIE, this.LEGACY_FAVORITES_KEY, [
        ...DEFAULT_FAVORITE_TOOL_IDS
      ]));

      this.recentTools.set(this.readToolIdListFromCookieOrLegacy(this.RECENT_COOKIE, this.LEGACY_RECENT_KEY, []));

      const pref = localStorage.getItem(this.PREFS_KEY);
      if (pref) {
        this.preferences.set({ ...DEFAULT_PREFS, ...JSON.parse(pref) });
      }
    } catch {
      // fallback
    }
  }

  private readToolIdListFromCookieOrLegacy(
    cookieName: string,
    legacyKey: string,
    fallback: string[]
  ): string[] {
    const fromCookie = this.parseToolIdsCookie(getCookie(cookieName));
    if (fromCookie !== null) {
      const pruned = pruneToRegisteredToolIds(fromCookie);
      if (pruned.length !== fromCookie.length) {
        this.persistToolIdsCookie(cookieName, pruned);
      }
      return pruned;
    }

    const legacy = localStorage.getItem(legacyKey);
    if (legacy) {
      const parsed = JSON.parse(legacy) as string[];
      const pruned = pruneToRegisteredToolIds(parsed);
      this.persistToolIdsCookie(cookieName, pruned);
      localStorage.removeItem(legacyKey);
      return pruned;
    }

    if (fallback.length > 0) {
      this.persistToolIdsCookie(cookieName, fallback);
    }
    return [...fallback];
  }

  private parseToolIdsCookie(raw: string | null): string[] | null {
    if (raw === null) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter((id): id is string => typeof id === 'string');
    } catch {
      return [];
    }
  }

  private persistToolIdsCookie(cookieName: string, ids: string[]): void {
    setCookie(cookieName, JSON.stringify(ids));
  }

  public toggleFavorite(toolId: string): void {
    if (!isRegisteredToolId(toolId)) {
      return;
    }
    this.favorites.update(current => {
      let updated: string[];
      if (current.includes(toolId)) {
        updated = current.filter(id => id !== toolId);
      } else {
        updated = [...current, toolId];
      }
      this.persistToolIdsCookie(this.FAVORITES_COOKIE, updated);
      return updated;
    });
  }

  public isFavorite(toolId: string): boolean {
    return this.favorites().includes(toolId);
  }

  public trackRecent(toolId: string): void {
    if (!isRegisteredToolId(toolId)) {
      return;
    }
    this.recentTools.update(current => {
      const filtered = current.filter(id => id !== toolId);
      const updated = [toolId, ...filtered].slice(0, 10);
      this.persistToolIdsCookie(this.RECENT_COOKIE, updated);
      return updated;
    });
  }

  public updatePreferences(partial: Partial<UserPreferences>): void {
    this.preferences.update(curr => {
      const updated = { ...curr, ...partial };
      localStorage.setItem(this.PREFS_KEY, JSON.stringify(updated));
      return updated;
    });
  }

  public exportSnapshot(): {
    favorites: string[];
    recentTools: string[];
    preferences: UserPreferences;
  } {
    return {
      favorites: this.favorites(),
      recentTools: this.recentTools(),
      preferences: this.preferences()
    };
  }

  public importSnapshot(data: {
    favorites?: string[];
    recentTools?: string[];
    preferences?: Partial<UserPreferences>;
  }): void {
    if (Array.isArray(data.favorites)) {
      const pruned = pruneToRegisteredToolIds(data.favorites);
      this.favorites.set(pruned);
      this.persistToolIdsCookie(this.FAVORITES_COOKIE, pruned);
    }
    if (Array.isArray(data.recentTools)) {
      const pruned = pruneToRegisteredToolIds(data.recentTools);
      this.recentTools.set(pruned);
      this.persistToolIdsCookie(this.RECENT_COOKIE, pruned);
    }
    if (data.preferences) {
      this.updatePreferences(data.preferences);
    }
  }

  public clearAllLocal(): void {
    deleteCookie(this.FAVORITES_COOKIE);
    deleteCookie(this.RECENT_COOKIE);
    localStorage.removeItem(this.LEGACY_FAVORITES_KEY);
    localStorage.removeItem(this.LEGACY_RECENT_KEY);
    localStorage.removeItem(this.PREFS_KEY);
    this.favorites.set([...DEFAULT_FAVORITE_TOOL_IDS]);
    this.recentTools.set([]);
    this.preferences.set(DEFAULT_PREFS);
    this.persistToolIdsCookie(this.FAVORITES_COOKIE, this.favorites());
    localStorage.setItem(this.PREFS_KEY, JSON.stringify(DEFAULT_PREFS));
  }
}