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

  it('should prettify, minify, and validate JS, CSS, HTML, and JSON build chunks', async () => {
    const { formatChunk, processChunk, validateChunkSyntax } = await import(
      './shared/utils/chunk-formatter.util'
    );

    const sampleJs =
      'import{a as e,b as t}from"./chunk.js";class R{static ɵfac=()=>new R();static ɵprov=e({token:R,factory:R.ɵfac,providedIn:"root"})}export{R};';
    const jsRes = formatChunk(sampleJs, {
      language: 'auto',
      indentSize: 2
    });
    expect(jsRes.detectedLanguage).toBe('javascript');
    expect(jsRes.formattedLines).toBeGreaterThan(3);
    expect(jsRes.formatted).toContain('static ɵfac =');
    expect(jsRes.formatted).toContain('factory: R.ɵfac');
    expect(validateChunkSyntax(jsRes.formatted, 'javascript').valid).toBeTrue();

    const jsMin = processChunk(jsRes.formatted, {
      language: 'javascript',
      indentSize: 2,
      mode: 'minify'
    });
    expect(jsMin.output).toContain('static ɵfac=');
    expect(validateChunkSyntax(jsMin.output, 'javascript').valid).toBeTrue();

    const badJs = validateChunkSyntax('function f(x) { return x + 1;', 'javascript');
    expect(badJs.valid).toBeFalse();
    expect(badJs.errors[0].line).toBe(1);

    const cssRes = formatChunk('.btn{color:#fff;padding:4px 8px;}', {
      language: 'auto',
      indentSize: 2
    });
    expect(cssRes.detectedLanguage).toBe('css');
    expect(cssRes.formatted).toContain('  color: #fff;');
    const cssMin = processChunk(cssRes.formatted, { language: 'css', indentSize: 2, mode: 'minify' });
    expect(cssMin.output).toBe('.btn{color:#fff;padding:4px 8px}');
    expect(validateChunkSyntax('.btn{color red;}', 'css').valid).toBeFalse();

    expect(validateChunkSyntax('<div><span>ok</span></div>', 'html').valid).toBeTrue();
    expect(validateChunkSyntax('<div><span>ok</div>', 'html').valid).toBeFalse();

    const jsonMin = processChunk('{\n  "a": 1\n}', { language: 'json', indentSize: 2, mode: 'minify' });
    expect(jsonMin.output).toBe('{"a":1}');
    expect(validateChunkSyntax('{"a": }', 'json').valid).toBeFalse();

    const { ChunkFormatterComponent } = await import(
      './features/code-tools/chunk-formatter/chunk-formatter.component'
    );
    const chunkFixture = TestBed.createComponent(ChunkFormatterComponent);
    chunkFixture.detectChanges();
    expect(chunkFixture.componentInstance.inputValidation?.valid).toBeTrue();
    expect(chunkFixture.componentInstance.outputValidation?.valid).toBeTrue();
    expect(chunkFixture.componentInstance.allErrors.length).toBe(0);
  });

  it('should load and compile TypeScript inside TypescriptPlaygroundComponent in browser', async () => {
    const { TypescriptPlaygroundComponent } = await import(
      './features/code-tools/typescript-playground/typescript-playground.component'
    );
    const fixture = TestBed.createComponent(TypescriptPlaygroundComponent);
    const comp = fixture.componentInstance;
    await comp.ensureCompilerLoaded();
    comp.inputTs = 'const greet = (name: string): string => `Hello ${name}`;';
    comp.compile();
    expect(comp.compilationError).toBe('');
    expect(comp.outputJs).toContain('const greet');
    expect(comp.outputJs).not.toContain(': string');
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

  it('should parse PDF page ranges and build valid multi-page PDF bytes from JPEG images', async () => {
    const {
      parsePageRange,
      getPageDimensionsPt,
      buildPdfFromJpegImages
    } = await import('./shared/utils/pdf-image.util');

    expect(parsePageRange('all', 4)).toEqual([1, 2, 3, 4]);
    expect(parsePageRange('1-2, 4, 99', 5)).toEqual([1, 2, 4]);
    expect(parsePageRange('', 3)).toEqual([1, 2, 3]);

    expect(getPageDimensionsPt(1200, 800, 'a4', 'auto', 24)).toEqual({ widthPt: 841.89, heightPt: 595.28 });
    expect(getPageDimensionsPt(800, 1200, 'a4', 'auto', 24)).toEqual({ widthPt: 595.28, heightPt: 841.89 });

    const dummyJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);
    const pdfBytes = buildPdfFromJpegImages(
      [
        { name: 'p1.jpg', widthPx: 800, heightPx: 600, jpegBytes: dummyJpeg },
        { name: 'p2.jpg', widthPx: 600, heightPx: 800, jpegBytes: dummyJpeg }
      ],
      { pageSize: 'a4', orientation: 'auto', marginPt: 24 }
    );

    const pdfText = new TextDecoder().decode(pdfBytes);
    expect(pdfText.startsWith('%PDF-1.4')).toBeTrue();
    expect(pdfText).toContain('/Count 2');
    expect(pdfText).toContain('/Filter /DCTDecode');
    expect(pdfText.trim().endsWith('%%EOF')).toBeTrue();
  });
});