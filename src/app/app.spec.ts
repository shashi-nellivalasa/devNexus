import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { REGISTERED_TOOL_COUNT, REGISTERED_TOOL_IDS } from './core/config/tool-catalog';
import { ToolRegistryService } from './core/services/tool-registry.service';
import { DataService } from './core/services/data.service';

describe('DevNexus Application & Tool Engine Tests', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();
  });

  it('should initialize DevNexus app root component', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should match ToolRegistry to the canonical tool catalog', () => {
    const registry = TestBed.inject(ToolRegistryService);
    const tools = registry.tools();
    const toolIds = tools.map(t => t.id).sort();
    const catalogIds = [...REGISTERED_TOOL_IDS].sort();

    expect(tools.length).toBe(REGISTERED_TOOL_COUNT);
    expect(toolIds).toEqual(catalogIds);
  });

  it('should expose a lazy route for every registered tool', () => {
    const registry = TestBed.inject(ToolRegistryService);
    const lazyToolPaths = new Set(
      routes
        .filter(r => r.path?.startsWith('tools/') && r.loadComponent)
        .map(r => r.path as string)
    );

    for (const tool of registry.tools()) {
      const path = tool.route.replace(/^\//, '');
      expect(lazyToolPaths.has(path))
        .withContext(`missing lazy route for tool "${tool.id}" at ${tool.route}`)
        .toBeTrue();
    }
  });

  it('should accurately filter tools using global search', () => {
    const registry = TestBed.inject(ToolRegistryService);

    const postmanSearch = registry.searchTools('postman');
    expect(postmanSearch.some(t => t.id === 'api-tester')).toBeTrue();

    const swaggerSearch = registry.searchTools('swagger');
    expect(swaggerSearch.some(t => t.id === 'swagger-explorer')).toBeTrue();

    const angularSearch = registry.searchTools('angular');
    expect(angularSearch.some(t => t.id === 'json-to-angular')).toBeTrue();
  });

  it('should generate structured mock data using DataService', () => {
    const dataService = TestBed.inject(DataService);

    const users = dataService.generateMockData('users', 5);
    expect(users.length).toBe(5);
    expect(users[0].firstName).toBeTruthy();
    expect(users[0].email).toContain('@');

    const products = dataService.generateMockData('products', 3);
    expect(products.length).toBe(3);
    expect(products[0].price).toBeGreaterThan(0);
  });

  it('should parse a minimal curl command for API tester import', async () => {
    const { parseCurlCommand } = await import('./shared/utils/curl-import.util');
    const parsed = parseCurlCommand(
      `curl -X POST 'https://api.example.com/users' -H 'Authorization: Bearer abc' -d '{"name":"Ada"}'`
    );
    expect(parsed?.method).toBe('POST');
    expect(parsed?.url).toContain('api.example.com/users');
    expect(parsed?.body?.type).toBe('json');
  });

  it('should prettify minified JS and CSS build chunks', async () => {
    const { formatChunk } = await import('./shared/utils/chunk-formatter.util');
    const jsRes = formatChunk('var a=1;function f(x){return x+1;}export{f};', {
      language: 'auto',
      indentSize: 2
    });
    expect(jsRes.detectedLanguage).toBe('javascript');
    expect(jsRes.formattedLines).toBeGreaterThan(3);
    expect(jsRes.formatted).toContain('function f(x) {');

    const cssRes = formatChunk('.btn{color:#fff;padding:4px 8px;}', {
      language: 'auto',
      indentSize: 2
    });
    expect(cssRes.detectedLanguage).toBe('css');
    expect(cssRes.formatted).toContain('  color: #fff;');
  });

  it('should parse OpenAPI specification document correctly', () => {
    const dataService = TestBed.inject(DataService);

    const sampleSpec = JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'Test API', version: '2.0.0' },
      servers: [{ url: 'https://api.test.com' }],
      paths: {
        '/users': {
          get: {
            tags: ['Users'],
            summary: 'Get all users',
            responses: { '200': { description: 'OK' } }
          }
        }
      }
    });

    const parsed = dataService.parseOpenApiSpec(sampleSpec);
    expect(parsed.title).toBe('Test API');
    expect(parsed.version).toBe('2.0.0');
    expect(parsed.endpoints.length).toBe(1);
    expect(parsed.endpoints[0].method).toBe('GET');
    expect(parsed.endpoints[0].path).toBe('/users');
  });
});