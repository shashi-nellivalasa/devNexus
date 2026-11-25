# <p align="center"><img src="public/devnexus-logo.svg" alt="DevNexus Logo" width="480"></p>

<p align="center">
  <strong>The Modern All-In-One Developer Utility Suite & API Workbench</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Angular-20-dd0031.svg?style=flat-square&logo=angular" alt="Angular 20">
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178c6.svg?style=flat-square&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Bootstrap-5.3-7952b3.svg?style=flat-square&logo=bootstrap" alt="Bootstrap 5">
  <img src="https://img.shields.io/badge/Monaco-Editor-007acc.svg?style=flat-square&logo=visualstudiocode" alt="Monaco Editor">
  <img src="https://img.shields.io/badge/Privacy-Local_Only-10b981.svg?style=flat-square" alt="Privacy First">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="MIT License">
</p>

---

## 🚀 Overview

**DevNexus** is a modern, privacy-first, client-side developer utility platform built with **Angular 20**, **TypeScript**, and **Bootstrap 5**. It seamlessly combines the best developer tools into a single, cohesive experience:

- **Offline Developer Utilities** (similar to DevToys) for JSON, strings, encoding, and code formatting.
- **Advanced API Testing Client** (similar to Postman) with parameter builders, headers, authentication, response inspection, and IndexedDB history.
- **OpenAPI & Swagger Documentation Explorer** (similar to Swagger UI) with interactive "Try It Out" execution and seamless transition into the API tester.
- **Code Playground & Editors** (similar to VS Code) powered by the Monaco Editor and the live TypeScript Compiler API.

All utilities run directly in the browser—your sensitive data, tokens, and payloads are never sent to external third-party analytics.

---

## 🧰 Utility Matrix (21 Built-in Tools)

Tools are grouped into **API** (2), **JSON** (7), **String** (4), **Code** (6), and **Generators** (2). The **Settings** page (`/settings`) is separate from the tool registry. The canonical ID list lives in `src/app/core/config/tool-catalog.ts` and is kept in sync with `ToolRegistryService` and `app.routes.ts`.

### 1. API Testing & Documentation
| Tool | Route | Description |
| :--- | :--- | :--- |
| **Advanced API Tester** | `/tools/api-tester` | Postman-inspired HTTP client supporting `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`, query parameters, custom headers, Auth (Bearer, Basic, API Key), Body payloads (JSON, text, XML), `{{variable}}` environments (from Settings), cURL import, response headers/metrics, and IndexedDB collections & history. |
| **Swagger / OpenAPI Explorer** | `/tools/swagger-explorer` | OpenAPI 3.x and Swagger 2.0 explorer supporting URL, file, and pasted imports. Groups endpoints by tags, renders parameter schemas, executes live **Try It Out** requests, and allows 1-click transfer to API Tester. |

### 2. JSON Utilities
| Tool | Route | Description |
| :--- | :--- | :--- |
| **JSON Stringify / Unstringify** | `/tools/json-stringify` | Escape JSON objects into strings or recursively unpack escaped stringified payloads back into formatted JSON. |
| **JSON Formatter & Minifier** | `/tools/json-formatter` | Pretty-print JSON with 2/4 spaces or tabs, sort keys alphabetically (A-Z), minify payloads, and display compression byte savings. |
| **JSON Linter & Validator** | `/tools/json-validator` | Syntax validation with exact line and column pointers, snippet error highlights, and structural metrics (key counts, depth, objects, arrays, types). |
| **JSON Diff & Comparator** | `/tools/json-diff` | Semantic JSON comparison with key-order normalization and side-by-side or unified diff highlighting. |
| **JSON to TypeScript** | `/tools/json-to-typescript` | Generate strongly-typed TypeScript interfaces, extracting child objects into reusable types with optional field toggles. |
| **JSON to Angular Model Interface** | `/tools/json-to-angular` | Angular 20 model generator with customizable conventions (`IUser`, `UserModel`, `UserDto`), nullable fields, factory functions, and `DataService` stubs. |
| **JSON ↔ YAML Converter** | `/tools/json-yaml` | Convert JSON to YAML and back for configs, OpenAPI snippets, and CI manifests. |

### 3. String & Encoding Utilities
| Tool | Route | Description |
| :--- | :--- | :--- |
| **String Escape / Unescape** | `/tools/string-escape` | Escape and unescape strings across JSON, JavaScript, HTML Entities, and Unicode (`\uXXXX`) code points. |
| **Base64 / URL / HTML / Hex Encode Decode** | `/tools/encode-decode` | Convert text across UTF-8 Base64, URL encoding, HTML character entities, and Hexadecimal representations. |
| **JWT Decoder** | `/tools/jwt-decoder` | Decode JWT header and payload locally with expiry hints (signature not verified). |
| **Base64 Studio — Text & Image** | `/tools/base64-studio` | Text ↔ Base64 and image ↔ Base64 with preview, data URIs, and download. |

### 4. Code Tools
| Tool | Route | Description |
| :--- | :--- | :--- |
| **Regex Tester & Evaluator** | `/tools/regex-tester` | Live pattern evaluator with real-time match highlighting, capture group table, execution time stats, flags (`g`, `i`, `m`, `s`, `u`), and presets (Email, URL, IPv4, Date, Hex, UUID). |
| **Code Diff Viewer** | `/tools/code-diff` | Side-by-side split and unified code comparison with additions/deletions badges and unified patch download. |
| **Code Minifier (JS / CSS / HTML)** | `/tools/code-minifier` | Strips comments, collapses whitespace, optimizes delimiters, and calculates compression reduction percentages. |
| **TypeScript Playground** | `/tools/typescript-playground` | In-browser Monaco editor with live transpilation via the TypeScript Compiler API, compiler target selection (ES5 to ESNext), and sandboxed execution output. |
| **SQL Formatter** | `/tools/sql-formatter` | SQL query formatter and beautifier with keyword casing options (UPPERCASE/lowercase), indentation control, and minification. |
| **Markdown Live Preview** | `/tools/markdown-preview` | GitHub-flavored Markdown editor with live preview, syntax-highlighted code blocks, tables, task lists, and HTML export. |

### 5. Generators
| Tool | Route | Description |
| :--- | :--- | :--- |
| **Mock Data Generator** | `/tools/mock-data` | Schema-driven synthesis for Users, Employees, Products, Transactions, Orders, or custom fields exported to JSON or CSV. |
| **Git Command Generator** | `/tools/git-generator` | Interactive builder for branching, committing, rebasing, cherry-picking, resetting, and stashing with educational step-by-step explanations. |

### Settings & backup

| Page | Route | Description |
| :--- | :--- | :--- |
| **Settings & Data** | `/settings` | Editor preferences, API environments (`{{variable}}` substitution), and full local JSON backup/restore. |

---

## 🎨 Brand Design Tokens & Theming

DevNexus features a dark theme by default alongside full light theme support adhering to WCAG contrast standards:

| Token | Hex Value | Role |
| :--- | :--- | :--- |
| **Primary** | `#030407` | Core dark canvas / Obsidian surface |
| **Accent** | `#d4ff24` | Electric Lime neon brand accent |
| **Secondary Accent** | `#1558c9` | Cobalt Blue utility accent |
| **Neutral** | `#e5e7eb` | Crisp neutral text and border highlight |
| **Error** | `#c74b3c` | Crimson error alert and delete badge |

- **Dark Mode**: High-contrast, minimal eye strain, subtle border glows.
- **Light Mode**: Clean SaaS aesthetic (`#ffffff` canvas, `#090d16` deep text, `#1558c9` primary accents).
- **Monospace Font**: JetBrains Mono, Fira Code, and monospace fallbacks for editors.

---

## 🏛️ Application Architecture

The application is structured following Angular 20 best practices:

```
src/
├── app/
│   ├── core/
│   │   ├── models/           # Tool, API tester, and OpenAPI TypeScript models
│   │   └── services/         # DataService, ModalService, ThemeService, StorageService, NotificationService
│   ├── layout/
│   │   ├── header/           # Brand logo, global search, theme switcher, favorites
│   │   ├── sidebar/          # Collapsible categories, tool filter, active indicators
│   │   └── command-palette/  # Global Ctrl+K command palette and shortcuts
│   ├── shared/
│   │   ├── components/       # ToolHeaderComponent, CodeEditorComponent, DiffViewerComponent, ModalContainerComponent
│   │   └── utils/            # Helper utilities
│   ├── features/
│   │   ├── dashboard/        # Overview dashboard with featured tools & category directory
│   │   ├── api-tools/        # Advanced API Tester & Swagger/OpenAPI Explorer
│   │   ├── json-tools/       # 7 JSON utilities (Stringify, Format, Validate, Diff, TS, YAML, Angular)
│   │   ├── string-tools/     # Escape, Encode/Decode, Base64 Studio, JWT Decoder
│   │   ├── code-tools/       # Regex, Diff, Minifier, TS Playground, SQL, Markdown (6)
│   │   ├── generators/       # Mock Data and Git Command Generator (2)
│   │   └── settings/         # Preferences, API environments, backup/restore
│   ├── app.config.ts         # Application configuration & providers (HttpClient, Router)
│   ├── app.routes.ts         # Lazy-loaded feature routes
│   ├── app.ts / app.html     # Root application shell & toast notifications
│   └── app.spec.ts           # Automated test suites
├── public/
│   ├── devnexus-logo.svg     # Brand wordmark (README / marketing)
│   ├── devnexus-mark.svg     # Header icon mark
│   └── favicon.svg / favicon.ico
└── styles.scss               # Global design tokens, Bootstrap overrides & themes
```

### Key Architectural Patterns
- **Standalone Components**: Every component is standalone and loaded on-demand via `loadComponent: () => import(...)`.
- **Reactive Forms & Signals**: Complex builders (API tester, mock schema, git options) use Reactive Forms, while UI state uses Angular Signals (`signal`, `computed`, `effect`).
- **DataService**: Centralized data layer handling HTTP execution, OpenAPI parsing, mock synthesis, and IndexedDB / LocalStorage persistence.
- **ModalService**: Centralized service for command palette activation and user confirmation dialogs.
- **DestroyRef**: Automatic subscription lifecycle cleanup via `takeUntilDestroyed(this.destroyRef)`.

---

## ⌨️ Global Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>K</kbd> / <kbd>Cmd</kbd> + <kbd>K</kbd> | Open Command Palette |
| <kbd>Esc</kbd> | Close Modal / Command Palette |
| <kbd>↑</kbd> / <kbd>↓</kbd> | Navigate Command Palette results |
| <kbd>Enter</kbd> | Open selected tool / Execute action |

---

## 🛠️ Getting Started

### Prerequisites
- **Node.js**: v20.x or higher
- **npm**: v10.x or higher
- **Angular CLI**: v20.x

### Installation

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd DevNexus
npm install
```

### Development Server

Start the local development server:

```bash
npm start
# or
ng serve
```

Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

### Type Checking & Linting

Verify strict TypeScript compilation:

```bash
npx tsc --noEmit
```

### Production Build

Compile the application for production deployment:

```bash
npm run build
# or
ng build --configuration production
```

Build artifacts will be stored in the `dist/` directory.

### Running Automated Tests

Run unit test suites:

```bash
npm test
```

---

## 🔒 Privacy & Security

1. **No External Tracking**: Code, JSON files, API keys, and regular expressions are processed locally in your browser.
2. **Local-First Storage**: Favorites and recents use **cookies** (30-day rolling expiry). Preferences use **LocalStorage**; API collections and request history use **IndexedDB**.
3. **Safe Previews**: Markdown and HTML previews are sanitized through Angular's `DomSanitizer` to prevent cross-site scripting (XSS).

---

## 📄 License

DevNexus is open-source software licensed under the [MIT License](LICENSE).
