import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  // JSON Tools
  {
    path: 'tools/json-stringify',
    loadComponent: () => import('./features/json-tools/json-stringify/json-stringify.component').then(m => m.JsonStringifyComponent)
  },
  {
    path: 'tools/json-formatter',
    loadComponent: () => import('./features/json-tools/json-formatter/json-formatter.component').then(m => m.JsonFormatterComponent)
  },
  {
    path: 'tools/json-validator',
    loadComponent: () => import('./features/json-tools/json-validator/json-validator.component').then(m => m.JsonValidatorComponent)
  },
  {
    path: 'tools/json-diff',
    loadComponent: () => import('./features/json-tools/json-diff/json-diff.component').then(m => m.JsonDiffComponent)
  },
  {
    path: 'tools/json-to-typescript',
    loadComponent: () => import('./features/json-tools/json-to-typescript/json-to-typescript.component').then(m => m.JsonToTypescriptComponent)
  },
  {
    path: 'tools/json-to-angular',
    loadComponent: () => import('./features/json-tools/json-to-angular/json-to-angular.component').then(m => m.JsonToAngularComponent)
  },
  {
    path: 'tools/json-yaml',
    loadComponent: () => import('./features/json-tools/json-yaml/json-yaml.component').then(m => m.JsonYamlComponent)
  },
  // String Tools
  {
    path: 'tools/string-escape',
    loadComponent: () => import('./features/string-tools/string-escape/string-escape.component').then(m => m.StringEscapeComponent)
  },
  {
    path: 'tools/encode-decode',
    loadComponent: () => import('./features/string-tools/encode-decode/encode-decode.component').then(m => m.EncodeDecodeComponent)
  },
  {
    path: 'tools/jwt-decoder',
    loadComponent: () => import('./features/string-tools/jwt-decoder/jwt-decoder.component').then(m => m.JwtDecoderComponent)
  },
  {
    path: 'tools/base64-studio',
    loadComponent: () => import('./features/string-tools/base64-studio/base64-studio.component').then(m => m.Base64StudioComponent)
  },
  // Code Tools
  {
    path: 'tools/regex-tester',
    loadComponent: () => import('./features/code-tools/regex-tester/regex-tester.component').then(m => m.RegexTesterComponent)
  },
  {
    path: 'tools/code-diff',
    loadComponent: () => import('./features/code-tools/code-diff/code-diff.component').then(m => m.CodeDiffComponent)
  },
  {
    path: 'tools/code-minifier',
    loadComponent: () => import('./features/code-tools/code-minifier/code-minifier.component').then(m => m.CodeMinifierComponent)
  },
  {
    path: 'tools/typescript-playground',
    loadComponent: () => import('./features/code-tools/typescript-playground/typescript-playground.component').then(m => m.TypescriptPlaygroundComponent)
  },
  {
    path: 'tools/sql-formatter',
    loadComponent: () => import('./features/code-tools/sql-formatter/sql-formatter.component').then(m => m.SqlFormatterComponent)
  },
  {
    path: 'tools/markdown-preview',
    loadComponent: () => import('./features/code-tools/markdown-preview/markdown-preview.component').then(m => m.MarkdownPreviewComponent)
  },
  // Generators
  {
    path: 'tools/mock-data',
    loadComponent: () => import('./features/generators/mock-data-generator/mock-data-generator.component').then(m => m.MockDataGeneratorComponent)
  },
  {
    path: 'tools/git-generator',
    loadComponent: () => import('./features/generators/git-command-generator/git-command-generator.component').then(m => m.GitCommandGeneratorComponent)
  },
  {
    path: 'tools/git-command-generator',
    redirectTo: 'tools/git-generator',
    pathMatch: 'full'
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent)
  },
  // API Tools
  {
    path: 'tools/api-tester',
    loadComponent: () => import('./features/api-tools/api-tester/api-tester.component').then(m => m.ApiTesterComponent)
  },
  {
    path: 'tools/swagger-explorer',
    loadComponent: () => import('./features/api-tools/swagger-explorer/swagger-explorer.component').then(m => m.SwaggerExplorerComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
