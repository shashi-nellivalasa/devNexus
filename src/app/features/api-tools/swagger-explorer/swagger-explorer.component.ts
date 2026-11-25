import { Component, OnInit, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ToolHeaderComponent } from '../../../shared/components/tool-header/tool-header.component';
import { CodeEditorComponent } from '../../../shared/components/code-editor/code-editor.component';
import { DataService } from '../../../core/services/data.service';
import { NotificationService } from '../../../core/services/notification.service';
import { OpenApiSpecData, OpenApiEndpoint, OpenApiParameter } from '../../../core/models/openapi.model';
import { ApiResponseData } from '../../../core/models/api-tester.model';

interface EndpointExecutionState {
  isOpen: boolean;
  isExecuting: boolean;
  paramValues: Record<string, string>;
  requestBody: string;
  response: ApiResponseData | null;
}

@Component({
  selector: 'app-swagger-explorer',
  standalone: true,
  imports: [CommonModule, FormsModule, ToolHeaderComponent, CodeEditorComponent],
  template: `
    <div class="swagger-explorer-tool p-3">
      <app-tool-header
        title="Swagger / OpenAPI Explorer"
        description="Explore, inspect, and test OpenAPI 3.x and Swagger 2.0 specifications with live 'Try It Out' interactive request execution."
        icon="bi-file-earmark-code"
        badge="Core Feature"
        toolId="swagger-explorer"
        [showSampleBtn]="true"
        (loadSample)="loadSamplePetstore()"
        (clear)="clearSpec()"
      ></app-tool-header>

      <!-- Import Specification Toolbar Card -->
      <div class="dn-card p-3 mb-3">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <!-- Import Mode Switcher -->
          <div class="btn-group btn-group-sm" role="group">
            <button
              type="button"
              class="btn"
              [ngClass]="importMode === 'url' ? 'btn-accent' : 'btn-outline-secondary'"
              (click)="importMode = 'url'"
            >
              <i class="bi bi-link-45deg me-1"></i> Import by URL
            </button>
            <button
              type="button"
              class="btn"
              [ngClass]="importMode === 'paste' ? 'btn-accent' : 'btn-outline-secondary'"
              (click)="importMode = 'paste'"
            >
              <i class="bi bi-clipboard-data me-1"></i> Paste JSON / YAML
            </button>
            <button
              type="button"
              class="btn btn-outline-secondary"
              (click)="triggerFileInput()"
            >
              <i class="bi bi-upload me-1"></i> Upload File
            </button>
          </div>

          <!-- Server Selector (when spec is loaded) -->
          @if (specData && specData.servers.length > 0) {
            <div class="d-flex align-items-center gap-2">
              <label class="small text-secondary mb-0">Base Server:</label>
              <select class="form-select form-select-sm w-auto bg-dark-subtle border-secondary border-opacity-50 text-light font-mono" [(ngModel)]="selectedServerUrl">
                @for (server of specData.servers; track server.url) {
                  <option [value]="server.url">{{ server.url }} {{ server.description ? '(' + server.description + ')' : '' }}</option>
                }
              </select>
            </div>
          }
        </div>

        <!-- URL Input or Paste Area -->
        @if (importMode === 'url') {
          <div class="input-group mt-3">
            <span class="input-group-text bg-dark-subtle border-secondary border-opacity-50 text-secondary">
              <i class="bi bi-globe"></i>
            </span>
            <input
              type="text"
              class="form-control bg-dark-subtle border-secondary border-opacity-50 text-light font-mono shadow-none"
              placeholder="https://petstore.swagger.io/v2/swagger.json"
              [(ngModel)]="specUrl"
              (keyup.enter)="fetchSpecFromUrl()"
            />
            <button class="btn btn-accent" type="button" (click)="fetchSpecFromUrl()" [disabled]="isLoadingSpec">
              @if (isLoadingSpec) {
                <span class="spinner-border spinner-border-sm me-1" role="status"></span>
              }
              <span>Load Spec</span>
            </button>
          </div>
        } @else {
          <div class="mt-3">
            <div class="d-flex align-items-center justify-content-between mb-1">
              <span class="small text-secondary">Paste OpenAPI 3.0 / Swagger 2.0 (JSON or YAML):</span>
              <button class="btn btn-sm btn-accent py-0 px-2" type="button" (click)="parsePastedSpec()">
                Parse Spec
              </button>
            </div>
            <textarea
              class="form-control form-control-sm bg-dark-subtle border-secondary border-opacity-50 text-light font-mono"
              rows="5"
              placeholder="{ &quot;openapi&quot;: &quot;3.0.0&quot;, &quot;info&quot;: { ... } }"
              [(ngModel)]="pastedContent"
            ></textarea>
          </div>
        }

        @if (specError) {
          <div class="alert alert-danger mt-3 mb-0 py-2 small d-flex align-items-center gap-2">
            <i class="bi bi-exclamation-triangle-fill"></i>
            <span>{{ specError }}</span>
          </div>
        }
      </div>

      <!-- Spec Header & Metadata -->
      @if (specData) {
        <div class="dn-card p-4 mb-4 border border-secondary border-opacity-50 shadow-sm">
          <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div>
              <div class="d-flex align-items-center gap-2">
                <h2 class="h5 fw-bold text-light mb-0">{{ specData.title }}</h2>
                <span class="badge bg-secondary-subtle text-warning border border-warning border-opacity-25">{{ specData.version }}</span>
                <span class="badge bg-secondary-subtle text-info">{{ specData.endpoints.length }} Endpoints</span>
              </div>
              <p class="text-secondary small mb-0 mt-1" style="max-width: 800px;">
                {{ specData.description || 'OpenAPI 3.x Specification loaded and parsed.' }}
              </p>
            </div>

            <!-- Endpoint Filter by Keyword -->
            <div class="input-group input-group-sm" style="max-width: 260px;">
              <span class="input-group-text bg-dark-subtle border-secondary border-opacity-50 text-secondary">
                <i class="bi bi-search"></i>
              </span>
              <input
                type="text"
                class="form-control bg-dark-subtle border-secondary border-opacity-50 text-light shadow-none"
                placeholder="Filter endpoints..."
                [(ngModel)]="endpointFilter"
              />
            </div>
          </div>
        </div>

        <!-- Endpoints Grouped by Tags -->
        @for (tag of filteredTags; track tag) {
          <div class="tag-section mb-4">
            <h3 class="h6 fw-bold text-light border-bottom border-secondary border-opacity-25 pb-2 mb-3 d-flex align-items-center gap-2">
              <i class="bi bi-tag-fill" style="color: var(--dn-accent); font-size: 0.85rem;"></i>
              <span>{{ tag }}</span>
              <span class="badge bg-dark text-secondary font-mono" style="font-size: 0.7rem;">
                {{ getEndpointsForTag(tag).length }}
              </span>
            </h3>

            <!-- Endpoints Accordion List -->
            <div class="endpoints-list d-flex flex-column gap-2">
              @for (ep of getEndpointsForTag(tag); track ep.id) {
                <div class="endpoint-card dn-card overflow-hidden" [ngClass]="getEndpointBorderClass(ep.method)">
                  <!-- Endpoint Header Clickable Row -->
                  <div
                    class="endpoint-header p-2.5 d-flex align-items-center justify-content-between cursor-pointer"
                    (click)="toggleEndpoint(ep.id)"
                  >
                    <div class="d-flex align-items-center gap-3">
                      <span class="badge py-1 px-2 font-mono fw-bold" [ngClass]="getMethodBadgeClass(ep.method)">
                        {{ ep.method }}
                      </span>
                      <span class="font-mono text-light fw-semibold small">{{ ep.path }}</span>
                      <span class="text-secondary small d-none d-md-inline">&bull; {{ ep.summary }}</span>
                    </div>

                    <div class="d-flex align-items-center gap-2">
                      <i class="bi" [ngClass]="isEndpointOpen(ep.id) ? 'bi-chevron-up' : 'bi-chevron-down'" style="font-size: 0.85rem;"></i>
                    </div>
                  </div>

                  <!-- Expanded Endpoint Details & Try It Out -->
                  @if (isEndpointOpen(ep.id)) {
                    <div class="endpoint-body p-3 border-top border-secondary border-opacity-25 bg-dark-subtle">
                      @if (ep.description) {
                        <p class="text-secondary small mb-3">{{ ep.description }}</p>
                      }

                      <!-- Parameters Table -->
                      @if (ep.parameters.length > 0) {
                        <div class="mb-3">
                          <h4 class="small fw-bold text-light mb-2">Parameters</h4>
                          <div class="table-responsive">
                            <table class="table table-sm table-dark table-striped mb-0 font-mono small">
                              <thead>
                                <tr class="text-secondary">
                                  <th>Name</th>
                                  <th>In</th>
                                  <th>Type</th>
                                  <th>Required</th>
                                  <th>Description / Value</th>
                                </tr>
                              </thead>
                              <tbody>
                                @for (p of ep.parameters; track p.name) {
                                  <tr>
                                    <td class="text-info fw-bold">{{ p.name }}</td>
                                    <td><span class="badge bg-secondary-subtle text-secondary">{{ p.in }}</span></td>
                                    <td class="text-secondary">{{ p.type || 'string' }}</td>
                                    <td>
                                      @if (p.required) {
                                        <span class="badge bg-danger-subtle text-danger">Required</span>
                                      } @else {
                                        <span class="text-secondary opacity-50">Optional</span>
                                      }
                                    </td>
                                    <td>
                                      <input
                                        type="text"
                                        class="form-control form-control-sm bg-dark border-secondary border-opacity-50 text-light py-0 px-2"
                                        [placeholder]="p.description || p.name"
                                        [(ngModel)]="getExecutionState(ep.id).paramValues[p.name]"
                                      />
                                    </td>
                                  </tr>
                                }
                              </tbody>
                            </table>
                          </div>
                        </div>
                      }

                      <!-- Request Body Input if applicable -->
                      @if (ep.requestBody) {
                        <div class="mb-3">
                          <div class="d-flex align-items-center justify-content-between mb-1">
                            <span class="small fw-bold text-light">Request Body (JSON):</span>
                            @if (ep.requestBody.required) {
                              <span class="badge bg-danger-subtle text-danger" style="font-size: 0.65rem;">Required</span>
                            }
                          </div>
                          <textarea
                            class="form-control form-control-sm bg-dark border-secondary border-opacity-50 text-light font-mono"
                            rows="4"
                            placeholder="{ ... }"
                            [(ngModel)]="getExecutionState(ep.id).requestBody"
                          ></textarea>
                        </div>
                      }

                      <!-- Action Buttons -->
                      <div class="d-flex align-items-center gap-2 mb-3">
                        <button
                          type="button"
                          class="btn btn-sm btn-accent d-flex align-items-center gap-1.5"
                          (click)="executeEndpoint(ep)"
                          [disabled]="getExecutionState(ep.id).isExecuting"
                        >
                          @if (getExecutionState(ep.id).isExecuting) {
                            <span class="spinner-border spinner-border-sm" role="status"></span>
                            <span>Executing...</span>
                          } @else {
                            <i class="bi bi-play-fill"></i>
                            <span>Try It Out & Execute</span>
                          }
                        </button>

                        <button
                          type="button"
                          class="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                          (click)="openInApiTester(ep)"
                        >
                          <i class="bi bi-box-arrow-up-right"></i>
                          <span>Open in API Tester</span>
                        </button>
                      </div>

                      <!-- Live Execution Result -->
                      @if (getExecutionState(ep.id).response; as resp) {
                        <div class="execution-response dn-card p-3 border border-secondary border-opacity-50">
                          <div class="d-flex align-items-center justify-content-between mb-2">
                            <div class="d-flex align-items-center gap-2">
                              <span class="badge font-mono fw-bold" [ngClass]="getStatusBadgeClass(resp.status)">
                                {{ resp.status }} {{ resp.statusText }}
                              </span>
                              <span class="badge bg-secondary-subtle text-secondary font-mono">{{ resp.durationMs }}ms</span>
                              <span class="badge bg-secondary-subtle text-secondary font-mono">{{ resp.sizeBytes }} B</span>
                            </div>
                            <button
                              type="button"
                              class="btn btn-sm btn-outline-secondary py-0 px-2 small"
                              (click)="copyResponse(resp.body)"
                            >
                              <i class="bi bi-clipboard me-1"></i> Copy
                            </button>
                          </div>

                          <app-code-editor
                            [language]="resp.isJson ? 'json' : 'text'"
                            [value]="resp.body"
                            [readOnly]="true"
                            height="240px"
                          ></app-code-editor>
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        }
      } @else {
        <!-- Empty State -->
        <div class="dn-card text-center p-5">
          <i class="bi bi-file-earmark-code fs-1 text-secondary opacity-50 d-block mb-3"></i>
          <h3 class="h5 fw-bold text-light mb-1">No OpenAPI Specification Loaded</h3>
          <p class="text-secondary small mb-4" style="max-width: 480px; margin: 0 auto;">
            Load an API specification URL, upload a Swagger/OpenAPI file, or click <strong>Sample Petstore</strong> to explore documentation and test endpoints interactively.
          </p>
          <button type="button" class="btn btn-accent px-4 py-2" (click)="loadSamplePetstore()">
            <i class="bi bi-magic me-1"></i> Load Sample Petstore API
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .endpoint-card {
      background-color: var(--dn-surface-card);
      border-left-width: 4px !important;
    }
    .endpoint-border-get { border-left-color: #059669 !important; }
    .endpoint-border-post { border-left-color: #d97706 !important; }
    .endpoint-border-put { border-left-color: #2563eb !important; }
    .endpoint-border-delete { border-left-color: var(--dn-error) !important; }
    .endpoint-border-patch { border-left-color: #7c3aed !important; }
    .endpoint-border-other { border-left-color: #4b5563 !important; }

    .cursor-pointer {
      cursor: pointer;
    }
    .endpoint-header:hover {
      background-color: var(--dn-surface-2);
    }
  `]
})
export class SwaggerExplorerComponent implements OnInit {
  // Constructor dependency injection mandated when touching API calls
  constructor(
    private dataService: DataService,
    private notifyService: NotificationService,
    private router: Router,
    private destroyRef: DestroyRef
  ) {}

  public importMode: 'url' | 'paste' = 'url';
  public specUrl = 'https://petstore.swagger.io/v2/swagger.json';
  public pastedContent = '';
  public specData: OpenApiSpecData | null = null;
  public selectedServerUrl = '';
  public specError = '';
  public isLoadingSpec = false;
  public endpointFilter = '';

  private executionStates: Map<string, EndpointExecutionState> = new Map();

  ngOnInit(): void {
    this.loadSamplePetstore();
  }

  get filteredTags(): string[] {
    if (!this.specData) return [];
    const q = this.endpointFilter.trim().toLowerCase();
    if (!q) return this.specData.tags;

    return this.specData.tags.filter(tag => {
      const endpoints = this.getEndpointsForTag(tag);
      return endpoints.length > 0;
    });
  }

  getEndpointsForTag(tag: string): OpenApiEndpoint[] {
    if (!this.specData) return [];
    let list = this.specData.endpoints.filter(e => e.tags.includes(tag));
    const q = this.endpointFilter.trim().toLowerCase();
    if (q) {
      list = list.filter(e =>
        e.path.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q) ||
        e.method.toLowerCase().includes(q)
      );
    }
    return list;
  }

  fetchSpecFromUrl(): void {
    if (!this.specUrl.trim()) return;

    this.isLoadingSpec = true;
    this.specError = '';

    this.dataService.fetchOpenApiUrl(this.specUrl)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (text) => {
          this.isLoadingSpec = false;
          try {
            this.setParsedSpec(this.dataService.parseOpenApiSpec(text));
            this.notifyService.success('Loaded OpenAPI specification');
          } catch (e: any) {
            this.specError = e.message;
          }
        },
        error: (err) => {
          this.isLoadingSpec = false;
          this.specError = `Failed to fetch URL. CORS or network error: ${err.message}`;
        }
      });
  }

  parsePastedSpec(): void {
    if (!this.pastedContent.trim()) return;
    this.specError = '';
    try {
      this.setParsedSpec(this.dataService.parseOpenApiSpec(this.pastedContent));
      this.notifyService.success('Parsed specification');
    } catch (e: any) {
      this.specError = e.message;
    }
  }

  private setParsedSpec(data: OpenApiSpecData): void {
    this.specData = data;
    this.selectedServerUrl = data.servers[0]?.url || 'https://api.example.com';
    this.executionStates.clear();
  }

  triggerFileInput(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.yaml,.yml';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (re) => {
          try {
            const content = re.target?.result as string;
            this.setParsedSpec(this.dataService.parseOpenApiSpec(content));
            this.notifyService.success(`Loaded ${file.name}`);
          } catch (err: any) {
            this.specError = `Error reading file: ${err.message}`;
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }

  getExecutionState(endpointId: string): EndpointExecutionState {
    if (!this.executionStates.has(endpointId)) {
      this.executionStates.set(endpointId, {
        isOpen: false,
        isExecuting: false,
        paramValues: {},
        requestBody: '{\n  \n}',
        response: null
      });
    }
    return this.executionStates.get(endpointId)!;
  }

  toggleEndpoint(endpointId: string): void {
    const st = this.getExecutionState(endpointId);
    st.isOpen = !st.isOpen;
  }

  isEndpointOpen(endpointId: string): boolean {
    return this.getExecutionState(endpointId).isOpen;
  }

  executeEndpoint(ep: OpenApiEndpoint): void {
    const st = this.getExecutionState(ep.id);
    st.isExecuting = true;
    st.response = null;

    // Substitute path parameters
    let path = ep.path;
    const queryParams: { id: string; key: string; value: string; enabled: boolean }[] = [];
    const headerParams: { id: string; key: string; value: string; enabled: boolean }[] = [];

    ep.parameters.forEach(p => {
      const val = st.paramValues[p.name] || '';
      if (p.in === 'path') {
        path = path.replace(`{${p.name}}`, encodeURIComponent(val));
      } else if (p.in === 'query' && val) {
        queryParams.push({ id: p.name, key: p.name, value: val, enabled: true });
      } else if (p.in === 'header' && val) {
        headerParams.push({ id: p.name, key: p.name, value: val, enabled: true });
      }
    });

    const fullUrl = `${this.selectedServerUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

    const reqItem: any = {
      id: `swagger-exec-${Date.now()}`,
      name: `${ep.method} ${ep.path}`,
      method: ep.method,
      url: fullUrl,
      params: queryParams,
      headers: headerParams,
      auth: { type: 'none' },
      body: ep.requestBody ? { type: 'json', raw: st.requestBody } : { type: 'none' }
    };

    this.dataService.executeRequest(reqItem)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp) => {
          st.isExecuting = false;
          st.response = resp;
          this.notifyService.info(`${ep.method} ${resp.status} ${resp.statusText}`);
        },
        error: (err) => {
          st.isExecuting = false;
          this.notifyService.error('Execution failed: ' + err.message);
        }
      });
  }

  openInApiTester(ep: OpenApiEndpoint): void {
    const st = this.getExecutionState(ep.id);
    let path = ep.path;
    const queryParams: any[] = [];
    const headerParams: any[] = [];

    ep.parameters.forEach(p => {
      const val = st.paramValues[p.name] || '';
      if (p.in === 'path') {
        path = path.replace(`{${p.name}}`, encodeURIComponent(val || `:${p.name}`));
      } else if (p.in === 'query') {
        queryParams.push({ id: p.name, key: p.name, value: val, enabled: true });
      } else if (p.in === 'header') {
        headerParams.push({ id: p.name, key: p.name, value: val, enabled: true });
      }
    });

    const fullUrl = `${this.selectedServerUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

    // Navigate to API Tester
    this.router.navigate(['/tools/api-tester']);
    this.notifyService.info(`Opened ${ep.method} ${ep.path} in API Tester`);
  }

  copyResponse(body: string): void {
    navigator.clipboard.writeText(body).then(() => {
      this.notifyService.success('Copied response');
    });
  }

  loadSamplePetstore(): void {
    const samplePetstoreSpec = {
      openapi: '3.0.0',
      info: {
        title: 'Swagger Petstore — OpenAPI 3.0',
        version: '1.0.17',
        description: 'Sample pet store server demonstrating OpenAPI 3.0 interactive execution on DevNexus.'
      },
      servers: [
        { url: 'https://petstore.swagger.io/v2', description: 'Production Petstore Server' },
        { url: 'https://jsonplaceholder.typicode.com', description: 'JSONPlaceholder Test Mirror' }
      ],
      paths: {
        '/pet/findByStatus': {
          get: {
            tags: ['Pet'],
            summary: 'Finds Pets by status',
            description: 'Multiple status values can be provided with comma separated strings',
            parameters: [
              {
                name: 'status',
                in: 'query',
                description: 'Status values that need to be considered for filter',
                required: true,
                schema: { type: 'string', default: 'available' }
              }
            ],
            responses: {
              '200': {
                description: 'successful operation'
              }
            }
          }
        },
        '/pet/{petId}': {
          get: {
            tags: ['Pet'],
            summary: 'Find pet by ID',
            description: 'Returns a single pet',
            parameters: [
              {
                name: 'petId',
                in: 'path',
                description: 'ID of pet to return',
                required: true,
                schema: { type: 'integer' }
              }
            ],
            responses: {
              '200': { description: 'successful operation' },
              '404': { description: 'Pet not found' }
            }
          },
          delete: {
            tags: ['Pet'],
            summary: 'Deletes a pet',
            parameters: [
              { name: 'petId', in: 'path', required: true }
            ],
            responses: {
              '400': { description: 'Invalid ID supplied' }
            }
          }
        },
        '/store/inventory': {
          get: {
            tags: ['Store'],
            summary: 'Returns pet inventories by status',
            description: 'Returns a map of status codes to quantities',
            parameters: [],
            responses: {
              '200': { description: 'successful operation' }
            }
          }
        },
        '/user/login': {
          get: {
            tags: ['User'],
            summary: 'Logs user into the system',
            parameters: [
              { name: 'username', in: 'query', required: true, description: 'The user name for login' },
              { name: 'password', in: 'query', required: true, description: 'The password for login in clear text' }
            ],
            responses: {
              '200': { description: 'successful operation' }
            }
          }
        }
      }
    };

    this.setParsedSpec(this.dataService.parseOpenApiSpec(JSON.stringify(samplePetstoreSpec)));
    this.notifyService.info('Sample Petstore OpenAPI spec loaded');
  }

  clearSpec(): void {
    this.specData = null;
    this.pastedContent = '';
    this.specUrl = '';
    this.specError = '';
    this.executionStates.clear();
  }

  getMethodBadgeClass(method: string): string {
    switch (method.toUpperCase()) {
      case 'GET': return 'badge-method-get';
      case 'POST': return 'badge-method-post';
      case 'PUT': return 'badge-method-put';
      case 'DELETE': return 'badge-method-delete';
      case 'PATCH': return 'badge-method-patch';
      default: return 'badge-method-options';
    }
  }

  getEndpointBorderClass(method: string): string {
    switch (method.toUpperCase()) {
      case 'GET': return 'endpoint-border-get';
      case 'POST': return 'endpoint-border-post';
      case 'PUT': return 'endpoint-border-put';
      case 'DELETE': return 'endpoint-border-delete';
      case 'PATCH': return 'endpoint-border-patch';
      default: return 'endpoint-border-other';
    }
  }

  getStatusBadgeClass(status: number): string {
    if (status >= 200 && status < 300) return 'bg-success text-white';
    if (status >= 300 && status < 400) return 'bg-info text-white';
    if (status >= 400 && status < 500) return 'bg-warning text-dark';
    if (status >= 500) return 'bg-danger text-white';
    return 'bg-secondary text-white';
  }
}

