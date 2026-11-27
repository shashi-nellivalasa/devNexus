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

  it('should render PdfSignatureCoordinatesComponent with ToolHeader title, icon, and go-to-page jump', async () => {
    const { PdfSignatureCoordinatesComponent } = await import(
      './features/generators/pdf-signature-coordinates/pdf-signature-coordinates.component'
    );
    const fixture = TestBed.createComponent(PdfSignatureCoordinatesComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('app-tool-header h1')?.textContent?.trim()).toBe(
      'PDF Signature Coordinate Generator'
    );
    expect(el.querySelector('app-tool-header i.bi-pen')).toBeTruthy();
    expect(comp.zoom()).toBe(1.25);
    expect(comp.fitMode()).toBe('none');

    comp.docMeta.set({ documentName: 'sample.pdf', pageCount: 12, fileSizeBytes: 1024 });
    comp.pageCount.set(12);
    comp.mode.set('workspace');
    fixture.detectChanges();

    const pageInput = el.querySelector('[aria-label="Page navigation"] input[aria-label="Go to page"]') as HTMLInputElement;
    expect(pageInput).toBeTruthy();
    expect(el.querySelector('.workspace-inspector-col .inspector-markers-section')).toBeTruthy();
    expect(comp.stageColumnWidthPx()).toBe(Math.ceil(595 * 1.25 + 54));

    comp.pageJumpForm.patchValue({ page: 8 });
    comp.submitPageJump();
    fixture.detectChanges();
    expect(comp.currentPage()).toBe(8);

    comp.pageJumpForm.patchValue({ page: 99 });
    comp.submitPageJump();
    fixture.detectChanges();
    expect(comp.currentPage()).toBe(12);
    expect(comp.pageJumpForm.get('page')?.value).toBe(12);

    comp.pageJumpForm.patchValue({ page: '' });
    comp.submitPageJump();
    expect(comp.currentPage()).toBe(12);
    expect(comp.pageJumpForm.get('page')?.value).toBe(12);
  });

  it('should transform CSS/PDF coordinates, clamp/snap with CropBox origin, and round-trip NSDL & eMudhra formats', async () => {
    const {
      screenToPdf,
      pdfToScreen,
      snapPdf,
      commitPdf,
      nsdlXToPdfX,
      pdfXToNsdlX,
      parseNsdlCoordinates,
      serializeNsdlTokens,
      serializeNsdlBoxes,
      serializeEmudhraBoxes
    } = await import('./shared/utils/pdf-signature-coordinates.util');

    const pageInput = { pdfWidth: 600, pdfHeight: 800, cssWidth: 300, cssHeight: 400, originX: 36, originY: 48 };
    const rect = { x: 136, y: 248, width: 150, height: 50 };
    const screen = pdfToScreen(rect, pageInput);
    expect(screen.left).toBeCloseTo(50);
    expect(screen.top).toBeCloseTo(275);
    const back = screenToPdf(screen, pageInput);
    expect(back.x).toBeCloseTo(rect.x);
    expect(back.y).toBeCloseTo(rect.y);

    const snapped = snapPdf({ x: 48, y: 60, width: 150.4, height: 50.4 }, 10, 36, 48);
    expect(snapped).toEqual({ x: 46, y: 58, width: 150, height: 50 });

    const info = {
      pageNumber: 1,
      originX: 36,
      originY: 48,
      pdfWidth: 600,
      pdfHeight: 800,
      rotation: 0,
      renderedWidth: 600,
      renderedHeight: 800,
      scale: 1,
      devicePixelRatio: 1
    };
    const committed = commitPdf({ x: 630.6, y: 840.4, width: 20.2, height: 15.6 }, info, {
      snap: false,
      snapSize: 1,
      integer: true
    });
    expect(committed.x + committed.width).toBeLessThanOrEqual(636);
    expect(committed.y + committed.height).toBeLessThanOrEqual(848);

    const sample = '10-411,22,44,150;11-65,440,50,150;';
    expect(nsdlXToPdfX(411, 150, 595)).toBeCloseTo(34);
    expect(pdfXToNsdlX(34, 150, 595)).toBeCloseTo(411);
    const parsed = parseNsdlCoordinates(sample, () => 595);
    expect(parsed.length).toBe(2);
    expect(serializeNsdlTokens(parsed, 'integer', () => 595)).toBe(sample);

    const boxes = [
      { id: '1', signerId: 1, page: 10, pdf: { x: 34, y: 22, width: 150, height: 44 }, createdAt: 1, order: 0 },
      { id: '2', signerId: 1, page: 11, pdf: { x: 380, y: 440, width: 150, height: 50 }, createdAt: 1, order: 1 }
    ];
    expect(serializeNsdlBoxes(boxes, 'integer', () => 595)).toBe(sample);
    expect(serializeEmudhraBoxes(boxes, 'integer')).toBe('10,34,22,184,66;11,380,440,530,490;');

    const {
      serializeCdslBoxes,
      serializeCvlBoxes,
      formatBoxesForProvider,
      parseProviderCoordinates
    } = await import('./shared/utils/pdf-signature-coordinates.util');
    expect(serializeCdslBoxes(boxes, 'integer')).toBe('10:34,22,184,66;11:380,440,530,490;');

    // CVL round-trip using uploaded CKYC sample: `1,390,739,164,60;` on A4 (595x842)
    const cvlSample = '1,390,739,164,60;';
    const [cvlImported] = parseProviderCoordinates(cvlSample, () => 595, () => 842, 'cvl');
    expect(cvlImported).toEqual({ page: 1, x: 390, y: 43, width: 164, height: 60 });
    expect(
      serializeCvlBoxes(
        [{ id: 'cvl1', signerId: 1, page: 1, pdf: { x: 390, y: 43, width: 164, height: 60 }, createdAt: 1, order: 0 }],
        'integer',
        () => 842
      )
    ).toBe(cvlSample);
    expect(parseProviderCoordinates(cvlSample, () => 595, () => 842, 'all')[0]).toEqual({
      page: 1,
      x: 390,
      y: 43,
      width: 164,
      height: 60
    });

    const digioJson = formatBoxesForProvider('digio', boxes, [{ id: 1, name: 'Applicant', color: '#0d6efd' }]);
    expect(digioJson).toContain('"display_on_page": "custom"');
    expect(parseProviderCoordinates(digioJson).length).toBe(2);

    const leegalityJson = formatBoxesForProvider('leegality', boxes, [{ id: 1, name: 'Applicant', color: '#0d6efd' }]);
    expect(leegalityJson).toContain('"signatureCoordinates"');
    expect(parseProviderCoordinates(leegalityJson).length).toBe(2);
    expect(parseProviderCoordinates('10,34,22,184,66;').length).toBe(1);
  });

  it('should unwrap escaped and raw-unescaped embedded JSON fragments in JSON Formatter', async () => {
    const { parseJsonInput } = await import('./shared/utils/json-unwrap.util');

    // Case 1: Property fragment with trailing comma + escaped inner JSON string
    const escapedFragment =
      '  "Bankresponsejson": "{\\"status\\":true,\\"message\\":\\"Data fetched successfully\\",\\"data\\":[{\\"header\\":{\\"sourceappcode\\":\\"NEXGENKYC\\"},\\"Party_Financials\\":{\\"Income_Slab_Desc\\":\\"10,00,001 To 25,00,000\\"}}]}",';
    const parsedEscaped = parseJsonInput(escapedFragment, true) as any;
    expect(parsedEscaped.Bankresponsejson.status).toBeTrue();
    expect(parsedEscaped.Bankresponsejson.data[0].header.sourceappcode).toBe('NEXGENKYC');

    // Case 2: Property fragment after raw String Unescape (outer quotes wrapping "{...}")
    const unescapedFragment =
      '  "Bankresponsejson": "{"status":true,"message":"Data fetched successfully","data":[{"header":{"sourceappcode":"NEXGENKYC"},"CRN_Status_code":"","Income_Slab_Desc":"10,00,001 To 25,00,000"}]}",';
    const parsedUnescaped = parseJsonInput(unescapedFragment, true) as any;
    expect(parsedUnescaped.Bankresponsejson.status).toBeTrue();
    expect(parsedUnescaped.Bankresponsejson.data[0].CRN_Status_code).toBe('');
    expect(parsedUnescaped.Bankresponsejson.data[0].Income_Slab_Desc).toBe('10,00,001 To 25,00,000');

    // Strict mode preserves error on malformed unescaped quotes
    expect(() => parseJsonInput(unescapedFragment, false)).toThrow();
  });
});

describe('DevNexus Viewport Editor Sizing Tests', () => {
  it('should stretch fillHeight CodeEditorComponent panes inside a tall App workspace with zero leftover bottom space', async () => {
    const { Router } = await import('@angular/router');
    const { JsonFormatterComponent } = await import(
      './features/json-tools/json-formatter/json-formatter.component'
    );

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'tools/json-formatter', component: JsonFormatterComponent }])
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/tools/json-formatter');
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    const rootEl = fixture.nativeElement as HTMLElement;
    const layoutEl = rootEl.querySelector('.app-layout') as HTMLElement;
    expect(layoutEl).toBeTruthy();

    // Force a tall desktop-height workspace regardless of ChromeHeadless default window size
    layoutEl.style.setProperty('width', '1280px', 'important');
    layoutEl.style.setProperty('height', '960px', 'important');
    layoutEl.style.setProperty('min-height', '960px', 'important');

    const editorsRow = rootEl.querySelector('app-json-formatter .row') as HTMLElement;
    expect(editorsRow).toBeTruthy();
    // Simulate side-by-side lg columns inside test even if headless width is < 992px
    Array.from(editorsRow.children).forEach(col => {
      (col as HTMLElement).style.width = '50%';
      (col as HTMLElement).style.flex = '0 0 auto';
    });

    const toolRoot = rootEl.querySelector('.json-formatter-tool') as HTMLElement;
    const mainEl = rootEl.querySelector('.app-main-workspace') as HTMLElement;
    const editorBodies = Array.from(rootEl.querySelectorAll('app-code-editor .editor-body')) as HTMLElement[];

    expect(toolRoot).toBeTruthy();
    expect(mainEl).toBeTruthy();
    expect(editorBodies.length).toBe(2);

    const mainRect = mainEl.getBoundingClientRect();
    const toolRect = toolRoot.getBoundingClientRect();
    const rowRect = editorsRow.getBoundingClientRect();
    const leftBodyRect = editorBodies[0].getBoundingClientRect();
    const rightBodyRect = editorBodies[1].getBoundingClientRect();

    expect(mainRect.height).toBeGreaterThan(800);
    expect(toolRect.height).toBeCloseTo(mainRect.height, 0);
    expect(Math.abs((mainRect.bottom - rowRect.bottom) - 16)).toBeLessThanOrEqual(2);
    expect(leftBodyRect.height).toBeGreaterThan(560);
    expect(rightBodyRect.height).toBeGreaterThan(560);
    expect(Math.abs(leftBodyRect.height - rightBodyRect.height)).toBeLessThanOrEqual(1);

    fixture.destroy();
  });
});