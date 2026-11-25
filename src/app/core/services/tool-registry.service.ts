import { Injectable, computed, inject, signal } from '@angular/core';
import { REGISTERED_TOOL_IDS } from '../config/tool-catalog';
import { ToolCategoryGroup, ToolItem } from '../models/tool.model';
import { StorageService } from './storage.service';

@Injectable({
  providedIn: 'root'
})
export class ToolRegistryService {
  private storageService = inject(StorageService);

  constructor() {
    this.assertCatalogSync();
  }

  private readonly toolsList: ToolItem[] = [
    // ---------------- JSON Tools ----------------
    {
      id: 'json-stringify',
      name: 'JSON Stringify / Unstringify',
      shortName: 'Stringify / Parse',
      description: 'Convert JSON objects into escaped strings and unpack escaped stringified payloads recursively.',
      category: 'json',
      categoryLabel: 'JSON Tools',
      icon: 'bi-quote',
      route: '/tools/json-stringify',
      keywords: ['json', 'stringify', 'unstringify', 'escape', 'parse', 'unescape', 'nested']
    },
    {
      id: 'json-formatter',
      name: 'JSON Formatter / Minifier',
      shortName: 'Formatter / Minifier',
      description: 'Pretty-print JSON with 2/4 spaces or tabs, or compact minification with syntax validation.',
      category: 'json',
      categoryLabel: 'JSON Tools',
      icon: 'bi-braces',
      route: '/tools/json-formatter',
      keywords: ['json', 'format', 'minify', 'pretty', 'beautify', 'indent', 'compress'],
      shortcut: 'Ctrl+Shift+F'
    },
    {
      id: 'json-validator',
      name: 'JSON Linter & Validator',
      shortName: 'Linter / Validator',
      description: 'Validate JSON syntax with detailed line and column error pointers and structural analysis.',
      category: 'json',
      categoryLabel: 'JSON Tools',
      icon: 'bi-check-circle',
      route: '/tools/json-validator',
      keywords: ['json', 'lint', 'validate', 'syntax', 'error', 'schema', 'checker']
    },
    {
      id: 'json-diff',
      name: 'JSON Diff & Comparator',
      shortName: 'JSON Diff',
      description: 'Deep structural comparison between two JSON documents with side-by-side or unified highlights.',
      category: 'json',
      categoryLabel: 'JSON Tools',
      icon: 'bi-file-diff',
      route: '/tools/json-diff',
      keywords: ['json', 'diff', 'compare', 'difference', 'delta', 'side-by-side']
    },
    {
      id: 'json-to-typescript',
      name: 'JSON to TypeScript',
      shortName: 'JSON to TS',
      description: 'Generate clean, strongly-typed TypeScript interfaces and type definitions from JSON data.',
      category: 'json',
      categoryLabel: 'JSON Tools',
      icon: 'bi-filetype-tsx',
      route: '/tools/json-to-typescript',
      keywords: ['json', 'typescript', 'interface', 'type', 'generator', 'models', 'types']
    },
    {
      id: 'json-yaml',
      name: 'JSON ↔ YAML Converter',
      shortName: 'JSON / YAML',
      description: 'Convert JSON documents to YAML and back — ideal for configs, OpenAPI snippets, and CI manifests.',
      category: 'json',
      categoryLabel: 'JSON Tools',
      icon: 'bi-filetype-yml',
      route: '/tools/json-yaml',
      keywords: ['json', 'yaml', 'yml', 'convert', 'config', 'kubernetes', 'openapi']
    },
    {
      id: 'json-to-angular',
      name: 'JSON to Angular Model Interface',
      shortName: 'JSON to Angular',
      description: 'Generate Angular-ready model files with exportable interfaces, nested DTOs, and naming conventions.',
      category: 'json',
      categoryLabel: 'JSON Tools',
      icon: 'bi-shield-check',
      route: '/tools/json-to-angular',
      keywords: ['json', 'angular', 'model', 'dto', 'interface', 'frontend', 'contract'],
      badge: 'Angular 20'
    },

    // ---------------- String Utilities ----------------
    {
      id: 'string-escape',
      name: 'String Escape / Unescape',
      shortName: 'Escape / Unescape',
      description: 'Escape and unescape strings across JSON, JavaScript, HTML Entities, SQL, and Unicode formats.',
      category: 'string',
      categoryLabel: 'String Utilities',
      icon: 'bi-slash-square',
      route: '/tools/string-escape',
      keywords: ['string', 'escape', 'unescape', 'html', 'javascript', 'unicode', 'slash', 'quotes']
    },
    {
      id: 'encode-decode',
      name: 'Base64 / URL / HTML Encode Decode',
      shortName: 'Encode / Decode',
      description: 'Convert strings between UTF-8 Base64, URI components, HTML decimal/hex entities, and Unicode escapes.',
      category: 'string',
      categoryLabel: 'String Utilities',
      icon: 'bi-code-slash',
      route: '/tools/encode-decode',
      keywords: ['base64', 'url', 'uri', 'html', 'encode', 'decode', 'utf8', 'hex', 'binary']
    },
    {
      id: 'base64-studio',
      name: 'Base64 Studio — Text & Image',
      shortName: 'Base64 Studio',
      description: 'Encode/decode UTF-8 text and images to Base64 with live preview, data URIs, and image download.',
      category: 'string',
      categoryLabel: 'String Utilities',
      icon: 'bi-image',
      route: '/tools/base64-studio',
      keywords: ['base64', 'image', 'text', 'data uri', 'encode', 'decode', 'picture', 'photo', 'blob']
    },
    {
      id: 'jwt-decoder',
      name: 'JWT Decoder',
      shortName: 'JWT Decoder',
      description: 'Inspect JSON Web Token headers and payloads locally with expiry hints (signature not verified).',
      category: 'string',
      categoryLabel: 'String Utilities',
      icon: 'bi-shield-lock',
      route: '/tools/jwt-decoder',
      keywords: ['jwt', 'token', 'bearer', 'oauth', 'decode', 'auth', 'payload', 'header']
    },

    // ---------------- Code Tools ----------------
    {
      id: 'regex-tester',
      name: 'Regex Tester & Evaluator',
      shortName: 'Regex Tester',
      description: 'Interactive Regular Expression tester with match highlighting, capture group explorer, and live stats.',
      category: 'code',
      categoryLabel: 'Code Tools',
      icon: 'bi-regex',
      route: '/tools/regex-tester',
      keywords: ['regex', 'regular expression', 'pattern', 'test', 'matcher', 'groups', 'flags'],
      shortcut: 'Ctrl+Enter'
    },
    {
      id: 'code-diff',
      name: 'Code Diff Viewer',
      shortName: 'Code Diff',
      description: 'Side-by-side and unified syntax-highlighted diff engine for source code, patches, and raw text.',
      category: 'code',
      categoryLabel: 'Code Tools',
      icon: 'bi-layout-split',
      route: '/tools/code-diff',
      keywords: ['diff', 'code diff', 'compare', 'unified', 'side by side', 'patch', 'git']
    },
    {
      id: 'code-minifier',
      name: 'Code Minifier (JS / CSS / HTML)',
      shortName: 'Code Minifier',
      description: 'Minify JavaScript, CSS, and HTML code with compression ratios and size savings statistics.',
      category: 'code',
      categoryLabel: 'Code Tools',
      icon: 'bi-file-zip',
      route: '/tools/code-minifier',
      keywords: ['minify', 'compress', 'javascript', 'css', 'html', 'bundle', 'optimize']
    },
    {
      id: 'chunk-formatter',
      name: 'Build Chunk Formatter & Minifier',
      shortName: 'Chunk Formatter',
      description: 'Prettify, edit, validate syntax, and minify Angular, Vite, or Webpack build chunks (JS, CSS, HTML, JSON).',
      category: 'code',
      categoryLabel: 'Code Tools',
      icon: 'bi-file-earmark-code',
      route: '/tools/chunk-formatter',
      keywords: ['chunk', 'prettify', 'beautify', 'format', 'minify', 'validate', 'syntax', 'angular', 'bundle', 'minified', 'js', 'css'],
      badge: 'New'
    },
    {
      id: 'typescript-playground',
      name: 'TypeScript Playground',
      shortName: 'TS Playground',
      description: 'Live in-browser TypeScript compilation to JavaScript with target configuration and diagnostic viewer.',
      category: 'code',
      categoryLabel: 'Code Tools',
      icon: 'bi-terminal',
      route: '/tools/typescript-playground',
      keywords: ['typescript', 'playground', 'compiler', 'transpile', 'es6', 'javascript', 'monaco'],
      badge: 'Live TS'
    },
    {
      id: 'sql-formatter',
      name: 'SQL Formatter & Beautifier',
      shortName: 'SQL Formatter',
      description: 'Format, align, and beautify SQL queries with keyword casing controls and minification.',
      category: 'code',
      categoryLabel: 'Code Tools',
      icon: 'bi-database',
      route: '/tools/sql-formatter',
      keywords: ['sql', 'query', 'format', 'beautify', 'database', 'postgres', 'mysql', 'casing']
    },
    {
      id: 'markdown-preview',
      name: 'Markdown Live Editor & Preview',
      shortName: 'Markdown Preview',
      description: 'Full GitHub-flavored Markdown editor with live preview, code highlighting, tables, and HTML export.',
      category: 'code',
      categoryLabel: 'Code Tools',
      icon: 'bi-markdown',
      route: '/tools/markdown-preview',
      keywords: ['markdown', 'preview', 'editor', 'gfm', 'html', 'docs', 'readme']
    },

    // ---------------- Generators ----------------
    {
      id: 'mock-data',
      name: 'Mock Data Generator',
      shortName: 'Mock Data',
      description: 'Generate realistic datasets (Users, Employees, Products, Orders, Transactions) in JSON or CSV.',
      category: 'generators',
      categoryLabel: 'Generators',
      icon: 'bi-diagram-3',
      route: '/tools/mock-data',
      keywords: ['mock', 'data', 'fake', 'users', 'products', 'generator', 'csv', 'json']
    },
    {
      id: 'git-generator',
      name: 'Git Command Generator',
      shortName: 'Git Generator',
      description: 'Interactive visual builder for branching, committing, rebasing, cherry-picking, stash, and undo operations.',
      category: 'generators',
      categoryLabel: 'Generators',
      icon: 'bi-git',
      route: '/tools/git-generator',
      keywords: ['git', 'command', 'branch', 'rebase', 'merge', 'cherry-pick', 'stash', 'reset']
    },

    // ---------------- API Tools ----------------
    {
      id: 'api-tester',
      name: 'Advanced API Tester',
      shortName: 'API Tester',
      description: 'Professional Postman-inspired HTTP client with headers, query params, auth, response inspection, and history.',
      category: 'api',
      categoryLabel: 'API Tools',
      icon: 'bi-send',
      route: '/tools/api-tester',
      keywords: ['api', 'tester', 'postman', 'http', 'rest', 'client', 'fetch', 'headers', 'curl'],
      badge: 'Core Feature'
    },
    {
      id: 'swagger-explorer',
      name: 'Swagger / OpenAPI Explorer',
      shortName: 'OpenAPI Explorer',
      description: 'Interactive Swagger UI & OpenAPI 3.x explorer with live Try It Out request execution and schema browser.',
      category: 'api',
      categoryLabel: 'API Tools',
      icon: 'bi-file-earmark-code',
      route: '/tools/swagger-explorer',
      keywords: ['swagger', 'openapi', 'docs', 'api', 'endpoints', 'schemas', 'try it out'],
      badge: 'Core Feature'
    }
  ];

  public readonly tools = signal<ToolItem[]>(this.toolsList);

  // Grouped tools for sidebar navigation
  public readonly categories = computed<ToolCategoryGroup[]>(() => {
    const list = this.tools();
    return [
      {
        id: 'api',
        name: 'API Testing & Docs',
        icon: 'bi-send-check',
        description: 'Postman-style HTTP client and Swagger/OpenAPI explorer',
        tools: list.filter(t => t.category === 'api')
      },
      {
        id: 'json',
        name: 'JSON Tools',
        icon: 'bi-braces',
        description: 'Stringify, format, validate, diff, YAML, TypeScript, and Angular models',
        tools: list.filter(t => t.category === 'json')
      },
      {
        id: 'code',
        name: 'Code Tools',
        icon: 'bi-code-square',
        description: 'Regex, diff, minifier, SQL, Markdown preview, and TS playground',
        tools: list.filter(t => t.category === 'code')
      },
      {
        id: 'string',
        name: 'String & Encoding',
        icon: 'bi-fonts',
        description: 'Escape/unescape, encodings, Base64 Studio (text & image), and JWT decode',
        tools: list.filter(t => t.category === 'string')
      },
      {
        id: 'generators',
        name: 'Generators',
        icon: 'bi-cpu',
        description: 'Mock data synthesis and interactive Git command builder',
        tools: list.filter(t => t.category === 'generators')
      }
    ];
  });

  public readonly favoriteTools = computed<ToolItem[]>(() => {
    const favIds = this.storageService.favorites();
    return this.toolsList.filter(t => favIds.includes(t.id));
  });

  public readonly recentTools = computed<ToolItem[]>(() => {
    const recentIds = this.storageService.recentTools();
    const map = new Map(this.toolsList.map(t => [t.id, t]));
    return recentIds.map(id => map.get(id)).filter((t): t is ToolItem => !!t);
  });

  public getToolById(id: string): ToolItem | undefined {
    return this.toolsList.find(t => t.id === id);
  }

  public searchTools(query: string): ToolItem[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.toolsList;
    return this.toolsList.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.categoryLabel.toLowerCase().includes(q) ||
      t.keywords.some(k => k.toLowerCase().includes(q))
    );
  }

  private assertCatalogSync(): void {
    const ids = this.toolsList.map(t => t.id).sort();
    const catalog = [...REGISTERED_TOOL_IDS].sort();
    if (ids.length !== catalog.length || ids.some((id, i) => id !== catalog[i])) {
      throw new Error(
        'ToolRegistryService.toolsList is out of sync with core/config/tool-catalog.ts'
      );
    }
  }
}

