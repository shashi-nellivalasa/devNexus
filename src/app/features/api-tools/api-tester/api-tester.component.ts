import { Component, OnInit, DestroyRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { ToolHeaderComponent } from '../../../shared/components/tool-header/tool-header.component';
import { CodeEditorComponent } from '../../../shared/components/code-editor/code-editor.component';
import { DataService } from '../../../core/services/data.service';
import { EnvironmentVariablesService } from '../../../core/services/environment-variables.service';
import { ModalService } from '../../../core/services/modal.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ApiCollection, ApiRequestItem, ApiResponseData, HttpMethod, KeyValuePair } from '../../../core/models/api-tester.model';
import { parseCurlCommand } from '../../../shared/utils/curl-import.util';
@Component({
  selector: 'app-api-tester',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ToolHeaderComponent, CodeEditorComponent, FormsModule, RouterModule],
  template: `
    <div class="api-tester-workbench p-3">
      <app-tool-header
        title="Advanced API Tester"
        description="Comprehensive HTTP client for REST APIs with query parameters, headers, authentication, body payloads, response inspection, and IndexedDB history."
        icon="bi-send"
        badge="Core Feature"
        toolId="api-tester"
        [showSampleBtn]="true"
        (loadSample)="loadSampleRequest()"
        (clear)="resetRequestForm()"
      ></app-tool-header>

      <div class="row g-3">
        <!-- Left: Collections & History Sidebar -->
        <div class="col-xl-3 col-lg-4">
          <div class="dn-card p-3 h-100 d-flex flex-column" style="min-height: 720px;">
            <!-- History / Collections Switcher -->
            <div class="d-flex align-items-center justify-content-between mb-3 border-bottom border-secondary border-opacity-25 pb-2">
              <div class="btn-group btn-group-sm" role="group">
                <button
                  type="button"
                  class="btn"
                  [ngClass]="sidebarTab === 'history' ? 'btn-accent' : 'btn-outline-secondary'"
                  (click)="sidebarTab = 'history'"
                >
                  <i class="bi bi-clock-history me-1"></i> History
                </button>
                <button
                  type="button"
                  class="btn"
                  [ngClass]="sidebarTab === 'collections' ? 'btn-accent' : 'btn-outline-secondary'"
                  (click)="sidebarTab = 'collections'"
                >
                  <i class="bi bi-folder2 me-1"></i> Collections
                </button>
              </div>

              <!-- Action buttons -->
              <div class="dropdown position-relative">
                <button
                  class="btn btn-sm btn-outline-secondary p-1"
                  type="button"
                  [class.show]="isActionsMenuOpen"
                  [attr.aria-expanded]="isActionsMenuOpen"
                  (click)="toggleActionsMenu($event)"
                  title="Actions menu"
                >
                  <i class="bi bi-three-dots-vertical"></i>
                </button>
                <ul
                  class="dropdown-menu dropdown-menu-end dn-card border border-secondary border-opacity-50 p-1 shadow"
                  [class.show]="isActionsMenuOpen"
                  style="position: absolute; right: 0; top: 100%; margin-top: 4px; z-index: 1050;"
                  (click)="$event.stopPropagation()"
                >
                  @if (sidebarTab === 'history') {
                    <li>
                      <button class="dropdown-item small text-danger py-1" type="button" (click)="clearAllHistory(); isActionsMenuOpen = false;">
                        <i class="bi bi-trash3 me-1"></i> Clear History
                      </button>
                    </li>
                  } @else {
                    <li>
                      <button class="dropdown-item small py-1" type="button" (click)="exportCollectionsJson(); isActionsMenuOpen = false;">
                        <i class="bi bi-download me-1"></i> Export Collections
                      </button>
                    </li>
                    <li>
                      <button class="dropdown-item small py-1" type="button" (click)="triggerImportInput(); isActionsMenuOpen = false;">
                        <i class="bi bi-upload me-1"></i> Import Collections
                      </button>
                    </li>
                  }
                </ul>
              </div>
            </div>

            <!-- List of items -->
            <div class="sidebar-items-list flex-grow-1 overflow-auto" style="max-height: 640px;">
              @if (sidebarTab === 'history') {
                @for (item of historyList; track item.id) {
                  <div
                    class="history-item p-2 rounded-2 mb-1 cursor-pointer border border-transparent transition"
                    (click)="loadRequestIntoForm(item)"
                  >
                    <div class="d-flex align-items-center justify-content-between mb-1">
                      <span class="badge py-0.5 px-1.5" [ngClass]="getMethodBadgeClass(item.method)" style="font-size: 0.65rem;">
                        {{ item.method }}
                      </span>
                      <span class="text-secondary small font-mono" style="font-size: 0.7rem;">
                        {{ item.timestamp ? (item.timestamp | date:'shortTime') : '' }}
                      </span>
                    </div>
                    <div class="text-truncate text-light small font-mono">{{ item.url }}</div>
                  </div>
                }
                @if (historyList.length === 0) {
                  <div class="text-center text-secondary py-5 small">
                    <i class="bi bi-clock fs-3 mb-2 d-block opacity-50"></i>
                    No recent requests yet. Run a request to record history.
                  </div>
                }
              } @else {
                <!-- Collections view -->
                @for (col of collectionsList; track col.id) {
                  <div class="collection-group mb-3">
                    <div class="d-flex align-items-center justify-content-between text-secondary small fw-bold px-1 mb-1">
                      <span class="d-flex align-items-center gap-1.5 text-light">
                        <i class="bi bi-folder-fill text-warning"></i>
                        <span>{{ col.name }}</span>
                      </span>
                      <span class="badge bg-secondary-subtle text-secondary" style="font-size: 0.65rem;">{{ col.requests.length }}</span>
                    </div>
                    @for (req of col.requests; track req.id) {
                      <div
                        class="history-item p-2 rounded-2 mb-1 cursor-pointer ms-2 border border-transparent"
                        (click)="loadRequestIntoForm(req)"
                      >
                        <div class="d-flex align-items-center gap-2">
                          <span class="badge py-0.5 px-1" [ngClass]="getMethodBadgeClass(req.method)" style="font-size: 0.65rem;">
                            {{ req.method }}
                          </span>
                          <span class="text-light small text-truncate">{{ req.name || req.url }}</span>
                        </div>
                      </div>
                    }
                  </div>
                }
              }
            </div>
          </div>
        </div>

        <!-- Right: Request Builder & Response Viewer -->
        <div class="col-xl-9 col-lg-8">
          <!-- Request Top Bar (Method + URL + Send Button) -->
          <div class="dn-card p-3 mb-3">
            <div class="input-group">
              <!-- HTTP Method Selector -->
              <select
                class="form-select bg-dark-subtle border-secondary border-opacity-50 text-light fw-bold flex-grow-0"
                style="width: 130px;"
                [ngModel]="currentMethod"
                (ngModelChange)="onMethodChange($event)"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
                <option value="HEAD">HEAD</option>
                <option value="OPTIONS">OPTIONS</option>
              </select>

              <!-- Request URL Input -->
              <input
                type="text"
                class="form-control bg-dark-subtle border-secondary border-opacity-50 text-light font-mono shadow-none"
                placeholder="https://api.example.com/v1/resource"
                [ngModel]="currentUrl"
                (ngModelChange)="onUrlChange($event)"
              />

              <!-- Send Button -->
              @if (!isLoading) {
                <button type="button" class="btn btn-accent px-4 fw-bold d-flex align-items-center gap-1.5" (click)="sendRequest()">
                  <i class="bi bi-send-fill"></i>
                  <span>Send</span>
                </button>
              } @else {
                <button type="button" class="btn btn-danger px-3 d-flex align-items-center gap-1.5" (click)="cancelRequest()">
                  <span class="spinner-border spinner-border-sm" role="status"></span>
                  <span>Cancel ({{ elapsedTimerMs }}ms)</span>
                </button>
              }
            </div>

            <div class="d-flex flex-wrap align-items-center gap-2 mt-2 pt-2 border-top border-secondary border-opacity-25">
              <label class="small text-secondary mb-0" for="api-env-select">Environment</label>
              <select
                id="api-env-select"
                class="form-select form-select-sm bg-dark-subtle border-secondary border-opacity-50 text-light"
                style="max-width: 220px;"
                [ngModel]="envService.activeId()"
                (ngModelChange)="envService.setActiveEnvironment($event)"
              >
                <option [ngValue]="null">None</option>
                @for (env of envService.environments(); track env.id) {
                  <option [ngValue]="env.id">{{ env.name }}</option>
                }
              </select>
              <a routerLink="/settings" class="btn btn-sm btn-link text-secondary text-decoration-none px-1">Manage variables</a>
              <button type="button" class="btn btn-sm btn-outline-secondary ms-sm-auto" (click)="importCurlFromClipboard()">
                <i class="bi bi-terminal me-1"></i> Import cURL
              </button>
            </div>
          </div>

          <!-- Request Configuration Tabs -->
          <div class="dn-card p-3 mb-3">
            <ul class="nav nav-tabs border-secondary border-opacity-25 mb-3" role="tablist">
              <li class="nav-item" role="presentation">
                <button
                  class="nav-link text-secondary"
                  [class.active]="activeTab === 'params'"
                  (click)="activeTab = 'params'"
                  type="button"
                >
                  Params
                  @if (activeParamsCount > 0) {
                    <span class="badge bg-secondary-subtle text-info ms-1">{{ activeParamsCount }}</span>
                  }
                </button>
              </li>
              <li class="nav-item" role="presentation">
                <button
                  class="nav-link text-secondary"
                  [class.active]="activeTab === 'headers'"
                  (click)="activeTab = 'headers'"
                  type="button"
                >
                  Headers
                  @if (activeHeadersCount > 0) {
                    <span class="badge bg-secondary-subtle text-info ms-1">{{ activeHeadersCount }}</span>
                  }
                </button>
              </li>
              <li class="nav-item" role="presentation">
                <button
                  class="nav-link text-secondary"
                  [class.active]="activeTab === 'auth'"
                  (click)="activeTab = 'auth'"
                  type="button"
                >
                  Authorization
                  @if (authType !== 'none') {
                    <span class="badge bg-secondary-subtle text-warning ms-1">&bull;</span>
                  }
                </button>
              </li>
              <li class="nav-item" role="presentation">
                <button
                  class="nav-link text-secondary"
                  [class.active]="activeTab === 'body'"
                  (click)="activeTab = 'body'"
                  type="button"
                >
                  Body
                  @if (bodyType !== 'none') {
                    <span class="badge bg-secondary-subtle text-success ms-1">{{ bodyType }}</span>
                  }
                </button>
              </li>
            </ul>

            <!-- Tab Content -->
            <div class="tab-content">
              <!-- 1. Params Tab -->
              @if (activeTab === 'params') {
                <div class="params-tab">
                  <div class="d-flex align-items-center justify-content-between mb-2">
                    <span class="small text-secondary fw-semibold">Query Parameters</span>
                    <button type="button" class="btn btn-sm btn-outline-info py-0 px-2" (click)="addParamRow()">
                      <i class="bi bi-plus-lg me-1"></i> Add Parameter
                    </button>
                  </div>

                  @for (param of paramsList; track param.id; let idx = $index) {
                    <div class="d-flex align-items-center gap-2 mb-2">
                      <input
                        class="form-check-input mt-0"
                        type="checkbox"
                        [(ngModel)]="param.enabled"
                        (ngModelChange)="syncParamsToUrl()"
                      />
                      <input
                        type="text"
                        class="form-control form-control-sm bg-dark-subtle border-secondary border-opacity-50 text-light font-mono"
                        placeholder="Key (e.g. page)"
                        [(ngModel)]="param.key"
                        (ngModelChange)="syncParamsToUrl()"
                      />
                      <input
                        type="text"
                        class="form-control form-control-sm bg-dark-subtle border-secondary border-opacity-50 text-light font-mono"
                        placeholder="Value (e.g. 1)"
                        [(ngModel)]="param.value"
                        (ngModelChange)="syncParamsToUrl()"
                      />
                      <button type="button" class="btn btn-sm btn-outline-danger p-1" (click)="removeParamRow(idx)">
                        <i class="bi bi-x-lg"></i>
                      </button>
                    </div>
                  }
                </div>
              }

              <!-- 2. Headers Tab -->
              @if (activeTab === 'headers') {
                <div class="headers-tab">
                  <div class="d-flex align-items-center justify-content-between mb-2">
                    <span class="small text-secondary fw-semibold">HTTP Headers</span>
                    <div class="d-flex align-items-center gap-2">
                      <button type="button" class="btn btn-sm btn-outline-secondary py-0 px-2" (click)="addHeaderPreset('Content-Type', 'application/json')">
                        + JSON Header
                      </button>
                      <button type="button" class="btn btn-sm btn-outline-info py-0 px-2" (click)="addHeaderRow()">
                        <i class="bi bi-plus-lg me-1"></i> Add Header
                      </button>
                    </div>
                  </div>

                  @for (header of headersList; track header.id; let idx = $index) {
                    <div class="d-flex align-items-center gap-2 mb-2">
                      <input
                        class="form-check-input mt-0"
                        type="checkbox"
                        [(ngModel)]="header.enabled"
                      />
                      <input
                        type="text"
                        class="form-control form-control-sm bg-dark-subtle border-secondary border-opacity-50 text-light font-mono"
                        placeholder="Header (e.g. Authorization)"
                        [(ngModel)]="header.key"
                      />
                      <input
                        type="text"
                        class="form-control form-control-sm bg-dark-subtle border-secondary border-opacity-50 text-light font-mono"
                        placeholder="Value"
                        [(ngModel)]="header.value"
                      />
                      <button type="button" class="btn btn-sm btn-outline-danger p-1" (click)="removeHeaderRow(idx)">
                        <i class="bi bi-x-lg"></i>
                      </button>
                    </div>
                  }
                </div>
              }

              <!-- 3. Auth Tab -->
              @if (activeTab === 'auth') {
                <div class="auth-tab">
                  <div class="row g-3">
                    <div class="col-md-3">
                      <label class="form-label small text-secondary mb-1">Auth Type:</label>
                      <select class="form-select form-select-sm bg-dark-subtle border-secondary border-opacity-50 text-light" [(ngModel)]="authType">
                        <option value="none">No Auth</option>
                        <option value="bearer">Bearer Token</option>
                        <option value="basic">Basic Auth</option>
                        <option value="apikey">API Key</option>
                      </select>
                    </div>

                    <div class="col-md-9">
                      @if (authType === 'bearer') {
                        <div>
                          <label class="form-label small text-secondary mb-1">Token:</label>
                          <input
                            type="text"
                            class="form-control form-control-sm bg-dark-subtle border-secondary border-opacity-50 text-light font-mono"
                            placeholder="eyJhbGciOi..."
                            [(ngModel)]="authBearerToken"
                          />
                        </div>
                      } @else if (authType === 'basic') {
                        <div class="row g-2">
                          <div class="col-6">
                            <label class="form-label small text-secondary mb-1">Username:</label>
                            <input
                              type="text"
                              class="form-control form-control-sm bg-dark-subtle border-secondary border-opacity-50 text-light"
                              [(ngModel)]="authUsername"
                            />
                          </div>
                          <div class="col-6">
                            <label class="form-label small text-secondary mb-1">Password:</label>
                            <input
                              type="password"
                              class="form-control form-control-sm bg-dark-subtle border-secondary border-opacity-50 text-light"
                              [(ngModel)]="authPassword"
                            />
                          </div>
                        </div>
                      } @else if (authType === 'apikey') {
                        <div class="row g-2">
                          <div class="col-4">
                            <label class="form-label small text-secondary mb-1">Key Name:</label>
                            <input
                              type="text"
                              class="form-control form-control-sm bg-dark-subtle border-secondary border-opacity-50 text-light font-mono"
                              placeholder="X-API-KEY"
                              [(ngModel)]="apiKeyName"
                            />
                          </div>
                          <div class="col-5">
                            <label class="form-label small text-secondary mb-1">Key Value:</label>
                            <input
                              type="text"
                              class="form-control form-control-sm bg-dark-subtle border-secondary border-opacity-50 text-light font-mono"
                              placeholder="secret_key_..."
                              [(ngModel)]="apiKeyValue"
                            />
                          </div>
                          <div class="col-3">
                            <label class="form-label small text-secondary mb-1">Add To:</label>
                            <select class="form-select form-select-sm bg-dark-subtle border-secondary border-opacity-50 text-light" [(ngModel)]="apiKeyAddTo">
                              <option value="header">Header</option>
                              <option value="query">Query Params</option>
                            </select>
                          </div>
                        </div>
                      } @else {
                        <div class="text-secondary small pt-3">This request does not use any authorization headers.</div>
                      }
                    </div>
                  </div>
                </div>
              }

              <!-- 4. Body Tab -->
              @if (activeTab === 'body') {
                <div class="body-tab">
                  <div class="d-flex align-items-center justify-content-between mb-2">
                    <div class="d-flex align-items-center gap-3">
                      <div class="form-check form-check-inline mb-0">
                        <input class="form-check-input" type="radio" name="bodyType" id="bodyNone" value="none" [(ngModel)]="bodyType">
                        <label class="form-check-label small text-secondary" for="bodyNone">none</label>
                      </div>
                      <div class="form-check form-check-inline mb-0">
                        <input class="form-check-input" type="radio" name="bodyType" id="bodyJson" value="json" [(ngModel)]="bodyType">
                        <label class="form-check-label small text-secondary" for="bodyJson">JSON</label>
                      </div>
                      <div class="form-check form-check-inline mb-0">
                        <input class="form-check-input" type="radio" name="bodyType" id="bodyText" value="text" [(ngModel)]="bodyType">
                        <label class="form-check-label small text-secondary" for="bodyText">raw text</label>
                      </div>
                      <div class="form-check form-check-inline mb-0">
                        <input class="form-check-input" type="radio" name="bodyType" id="bodyXml" value="xml" [(ngModel)]="bodyType">
                        <label class="form-check-label small text-secondary" for="bodyXml">XML</label>
                      </div>
                    </div>

                    @if (bodyType === 'json') {
                      <button type="button" class="btn btn-sm btn-outline-secondary py-0 px-2" (click)="formatRequestBodyJson()">
                        <i class="bi bi-braces me-1"></i> Format JSON
                      </button>
                    }
                  </div>

                  @if (bodyType !== 'none') {
                    <app-code-editor
                      [language]="bodyType === 'json' ? 'json' : bodyType === 'xml' ? 'xml' : 'text'"
                      [value]="rawBodyContent"
                      (valueChange)="rawBodyContent = $event"
                      placeholder="Write request payload body here..."
                      height="200px"
                    ></app-code-editor>
                  }
                </div>
              }
            </div>
          </div>

          <!-- Response Inspector Card -->
          <div class="dn-card p-3">
            <div class="d-flex flex-wrap align-items-center justify-content-between border-bottom border-secondary border-opacity-25 pb-2 mb-3 gap-2">
              <div class="d-flex align-items-center gap-3">
                <span class="fw-bold text-light small d-flex align-items-center gap-1.5">
                  <i class="bi bi-terminal text-info"></i>
                  <span>Response</span>
                </span>

                @if (lastResponse) {
                  <span class="badge py-1 px-2 font-mono fw-bold" [ngClass]="getStatusBadgeClass(lastResponse.status)">
                    {{ lastResponse.status }} {{ lastResponse.statusText }}
                  </span>
                  <span class="badge bg-secondary-subtle text-secondary font-mono">
                    <i class="bi bi-stopwatch me-1"></i>{{ lastResponse.durationMs }} ms
                  </span>
                  <span class="badge bg-secondary-subtle text-secondary font-mono">
                    <i class="bi bi-hdd me-1"></i>{{ lastResponse.sizeBytes }} B
                  </span>
                }
              </div>

              <!-- Response View Modes & Actions -->
              @if (lastResponse) {
                <div class="d-flex align-items-center gap-2">
                  <div class="btn-group btn-group-sm" role="group">
                    <button
                      type="button"
                      class="btn btn-outline-secondary"
                      [class.active]="responseTab === 'body'"
                      (click)="responseTab = 'body'"
                    >
                      Body
                    </button>
                    <button
                      type="button"
                      class="btn btn-outline-secondary"
                      [class.active]="responseTab === 'headers'"
                      (click)="responseTab = 'headers'"
                    >
                      Headers ({{ Object.keys(lastResponse.headers).length }})
                    </button>
                  </div>

                  <button type="button" class="btn btn-sm btn-outline-secondary p-1" (click)="copyResponseBody()" title="Copy response">
                    <i class="bi bi-clipboard"></i>
                  </button>
                  <button type="button" class="btn btn-sm btn-outline-secondary p-1" (click)="downloadResponse()" title="Download response">
                    <i class="bi bi-download"></i>
                  </button>
                </div>
              }
            </div>

            <!-- Response Content -->
            @if (lastResponse) {
              @if (responseTab === 'body') {
                <app-code-editor
                  [language]="lastResponse.isJson ? 'json' : 'text'"
                  [value]="lastResponse.body"
                  [readOnly]="true"
                  placeholder="Empty response body"
                  height="340px"
                ></app-code-editor>
              } @else {
                <!-- Headers Table -->
                <div class="response-headers-table overflow-auto font-mono small" style="max-height: 340px;">
                  <table class="table table-dark table-sm table-striped mb-0">
                    <thead>
                      <tr class="text-secondary">
                        <th>Header Key</th>
                        <th>Header Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (key of Object.keys(lastResponse.headers); track key) {
                        <tr>
                          <td class="text-info">{{ key }}</td>
                          <td class="text-light text-break">{{ lastResponse.headers[key] }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            } @else {
              <div class="text-center text-secondary py-5">
                <i class="bi bi-send-dash fs-2 mb-2 d-block opacity-50"></i>
                <p class="small mb-0">Enter an API endpoint and click <strong>Send</strong> to execute the request.</p>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .history-item {
      background-color: var(--dn-surface-1);
      &:hover {
        background-color: var(--dn-surface-2);
        border-color: var(--dn-border-light) !important;
      }
    }
    .cursor-pointer {
      cursor: pointer;
    }
    .nav-tabs .nav-link {
      border: none;
      border-bottom: 2px solid transparent;
      padding: 0.4rem 0.8rem;
      font-size: 0.85rem;
      font-weight: 500;
      &.active {
        background: transparent;
        color: var(--dn-accent) !important;
        border-bottom-color: var(--dn-accent);
      }
    }
  `]
})
export class ApiTesterComponent implements OnInit {
  // Constructor dependency injection mandated when touching API calls
  constructor(
    private dataService: DataService,
    private modalService: ModalService,
    private notifyService: NotificationService,
    private destroyRef: DestroyRef,
    public envService: EnvironmentVariablesService
  ) {}

  public Object = Object;
  public sidebarTab: 'history' | 'collections' = 'history';
  public activeTab: 'params' | 'headers' | 'auth' | 'body' = 'params';
  public responseTab: 'body' | 'headers' = 'body';
  public isActionsMenuOpen = false;

  public toggleActionsMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isActionsMenuOpen = !this.isActionsMenuOpen;
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.isActionsMenuOpen = false;
  }

  public currentMethod: HttpMethod = 'GET';
  public currentUrl = 'https://jsonplaceholder.typicode.com/posts/1';

  public paramsList: KeyValuePair[] = [
    { id: '1', key: '', value: '', enabled: true }
  ];

  public headersList: KeyValuePair[] = [
    { id: '1', key: 'Accept', value: 'application/json', enabled: true }
  ];

  public authType: 'none' | 'bearer' | 'basic' | 'apikey' = 'none';
  public authBearerToken = '';
  public authUsername = '';
  public authPassword = '';
  public apiKeyName = 'X-API-KEY';
  public apiKeyValue = '';
  public apiKeyAddTo: 'header' | 'query' = 'header';

  public bodyType: 'none' | 'json' | 'text' | 'xml' = 'none';
  public rawBodyContent = '';

  public isLoading = false;
  public elapsedTimerMs = 0;
  private timerInterval: any = null;
  private activeRequestSub: Subscription | null = null;

  public lastResponse: ApiResponseData | null = null;
  public historyList: ApiRequestItem[] = [];
  public collectionsList: ApiCollection[] = [];

  get activeParamsCount(): number {
    return this.paramsList.filter(p => p.enabled && p.key.trim()).length;
  }

  get activeHeadersCount(): number {
    return this.headersList.filter(h => h.enabled && h.key.trim()).length;
  }

  ngOnInit(): void {
    this.refreshHistory();
    this.refreshCollections();
  }

  public async refreshHistory(): Promise<void> {
    this.historyList = await this.dataService.getHistory();
  }

  public async refreshCollections(): Promise<void> {
    this.collectionsList = await this.dataService.getCollections();
  }

  public onMethodChange(method: HttpMethod): void {
    this.currentMethod = method;
  }

  public onUrlChange(url: string): void {
    this.currentUrl = url;
    this.syncUrlToParams();
  }

  public addParamRow(): void {
    this.paramsList.push({
      id: Math.random().toString(36).substring(2, 8),
      key: '',
      value: '',
      enabled: true
    });
  }

  public removeParamRow(idx: number): void {
    this.paramsList.splice(idx, 1);
    this.syncParamsToUrl();
  }

  public addHeaderRow(): void {
    this.headersList.push({
      id: Math.random().toString(36).substring(2, 8),
      key: '',
      value: '',
      enabled: true
    });
  }

  public addHeaderPreset(key: string, value: string): void {
    const existing = this.headersList.find(h => h.key.toLowerCase() === key.toLowerCase());
    if (existing) {
      existing.value = value;
      existing.enabled = true;
    } else {
      this.headersList.push({
        id: Math.random().toString(36).substring(2, 8),
        key,
        value,
        enabled: true
      });
    }
    this.activeTab = 'headers';
    this.notifyService.info(`Added ${key} header`);
  }

  public removeHeaderRow(idx: number): void {
    this.headersList.splice(idx, 1);
  }

  public syncParamsToUrl(): void {
    try {
      const qIndex = this.currentUrl.indexOf('?');
      const baseUrl = qIndex !== -1 ? this.currentUrl.substring(0, qIndex) : this.currentUrl;

      const activeParams = this.paramsList.filter(p => p.enabled && p.key.trim());
      if (activeParams.length === 0) {
        this.currentUrl = baseUrl;
        return;
      }

      const queryStr = activeParams
        .map(p => `${encodeURIComponent(p.key.trim())}=${encodeURIComponent(p.value)}`)
        .join('&');

      this.currentUrl = `${baseUrl}?${queryStr}`;
    } catch {
      // fallback
    }
  }

  private syncUrlToParams(): void {
    const qIndex = this.currentUrl.indexOf('?');
    if (qIndex === -1) return;

    const queryString = this.currentUrl.substring(qIndex + 1);
    const searchParams = new URLSearchParams(queryString);

    const newParams: KeyValuePair[] = [];
    searchParams.forEach((value, key) => {
      newParams.push({
        id: Math.random().toString(36).substring(2, 8),
        key,
        value,
        enabled: true
      });
    });

    if (newParams.length > 0) {
      this.paramsList = newParams;
    }
  }

  public formatRequestBodyJson(): void {
    try {
      if (this.rawBodyContent.trim()) {
        const parsed = JSON.parse(this.rawBodyContent);
        this.rawBodyContent = JSON.stringify(parsed, null, 2);
        this.notifyService.info('Formatted JSON body');
      }
    } catch {
      this.notifyService.error('Invalid JSON in request body');
    }
  }

  public sendRequest(): void {
    if (!this.currentUrl.trim()) {
      this.notifyService.warning('Please enter an API URL');
      return;
    }

    this.isLoading = true;
    this.elapsedTimerMs = 0;
    const start = performance.now();
    this.timerInterval = setInterval(() => {
      this.elapsedTimerMs = Math.round(performance.now() - start);
    }, 50);

    const substitute = (value: string) => this.envService.substitute(value);

    const reqItem: ApiRequestItem = {
      id: `req-${Date.now()}`,
      name: `${this.currentMethod} ${substitute(this.currentUrl)}`,
      method: this.currentMethod,
      url: substitute(this.currentUrl),
      params: this.paramsList.map(p => ({
        ...p,
        key: substitute(p.key),
        value: substitute(p.value)
      })),
      headers: this.headersList.map(h => ({
        ...h,
        key: substitute(h.key),
        value: substitute(h.value)
      })),
      auth: {
        type: this.authType,
        bearerToken: substitute(this.authBearerToken),
        username: substitute(this.authUsername),
        password: substitute(this.authPassword),
        apiKeyName: substitute(this.apiKeyName),
        apiKeyValue: substitute(this.apiKeyValue),
        apiKeyAddTo: this.apiKeyAddTo
      },
      body: {
        type: this.bodyType,
        raw: substitute(this.rawBodyContent)
      }
    };

    this.activeRequestSub = this.dataService.executeRequest(reqItem)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp) => {
          clearInterval(this.timerInterval);
          this.isLoading = false;
          this.lastResponse = resp;
          this.refreshHistory();

          if (resp.status >= 200 && resp.status < 300) {
            this.notifyService.success(`Response ${resp.status} ${resp.statusText}`);
          } else if (resp.isNetworkError) {
            this.notifyService.warning('Cross-Origin (CORS) or Network Error');
          } else {
            this.notifyService.info(`Response ${resp.status} ${resp.statusText}`);
          }
        },
        error: (err) => {
          clearInterval(this.timerInterval);
          this.isLoading = false;
          this.notifyService.error('Request failed: ' + err.message);
        }
      });
  }

  public cancelRequest(): void {
    if (this.activeRequestSub) {
      this.activeRequestSub.unsubscribe();
      this.activeRequestSub = null;
    }
    clearInterval(this.timerInterval);
    this.isLoading = false;
    this.notifyService.info('Request cancelled');
  }

  public loadRequestIntoForm(item: ApiRequestItem): void {
    this.currentMethod = item.method;
    this.currentUrl = item.url;
    this.paramsList = item.params ? JSON.parse(JSON.stringify(item.params)) : [];
    this.headersList = item.headers ? JSON.parse(JSON.stringify(item.headers)) : [];

    if (item.auth) {
      this.authType = item.auth.type || 'none';
      this.authBearerToken = item.auth.bearerToken || '';
      this.authUsername = item.auth.username || '';
      this.authPassword = item.auth.password || '';
      this.apiKeyName = item.auth.apiKeyName || 'X-API-KEY';
      this.apiKeyValue = item.auth.apiKeyValue || '';
      this.apiKeyAddTo = item.auth.apiKeyAddTo || 'header';
    }

    if (item.body) {
      this.bodyType = (item.body.type as any) || 'none';
      this.rawBodyContent = item.body.raw || '';
    }

    this.notifyService.info(`Loaded request: ${item.name || item.url}`);
  }

  public loadSampleRequest(): void {
    this.currentMethod = 'POST';
    this.currentUrl = 'https://jsonplaceholder.typicode.com/posts';
    this.paramsList = [];
    this.headersList = [
      { id: '1', key: 'Content-Type', value: 'application/json; charset=UTF-8', enabled: true },
      { id: '2', key: 'Accept', value: 'application/json', enabled: true }
    ];
    this.authType = 'none';
    this.bodyType = 'json';
    this.rawBodyContent = JSON.stringify({
      title: 'DevNexus Architecture',
      body: 'Building full-featured client-side developer utilities with Angular 20 and Bootstrap.',
      userId: 101
    }, null, 2);
    this.activeTab = 'body';
    this.notifyService.info('Sample POST request loaded');
  }

  public resetRequestForm(): void {
    this.currentMethod = 'GET';
    this.currentUrl = '';
    this.paramsList = [{ id: '1', key: '', value: '', enabled: true }];
    this.headersList = [{ id: '1', key: 'Accept', value: 'application/json', enabled: true }];
    this.authType = 'none';
    this.bodyType = 'none';
    this.rawBodyContent = '';
    this.lastResponse = null;
  }

  public async clearAllHistory(): Promise<void> {
    const confirmed = await this.modalService.confirm({
      title: 'Clear History',
      message: 'Are you sure you want to delete all saved request history? This cannot be undone.',
      confirmText: 'Clear All',
      isDestructive: true
    });

    if (confirmed) {
      await this.dataService.clearHistory();
      await this.refreshHistory();
      this.notifyService.success('Cleared API history');
    }
  }

  public exportCollectionsJson(): void {
    const dataStr = JSON.stringify(this.collectionsList, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `devnexus-collections-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    this.notifyService.success('Exported collections');
  }

  public triggerImportInput(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (re) => {
          try {
            const parsed = JSON.parse(re.target?.result as string);
            if (Array.isArray(parsed)) {
              for (const col of parsed) {
                await this.dataService.saveCollection(col);
              }
              await this.refreshCollections();
              this.notifyService.success('Imported collections');
            }
          } catch {
            this.notifyService.error('Invalid collections JSON file');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }

  public copyResponseBody(): void {
    if (this.lastResponse?.body) {
      navigator.clipboard.writeText(this.lastResponse.body).then(() => {
        this.notifyService.success('Copied response body');
      });
    }
  }

  public downloadResponse(): void {
    if (this.lastResponse?.body) {
      const ext = this.lastResponse.isJson ? 'json' : 'txt';
      const blob = new Blob([this.lastResponse.body], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `response-${Date.now()}.${ext}`;
      link.click();
      URL.revokeObjectURL(url);
      this.notifyService.success('Downloaded response file');
    }
  }

  public getMethodBadgeClass(method: string): string {
    switch (method.toUpperCase()) {
      case 'GET': return 'badge-method-get';
      case 'POST': return 'badge-method-post';
      case 'PUT': return 'badge-method-put';
      case 'DELETE': return 'badge-method-delete';
      case 'PATCH': return 'badge-method-patch';
      default: return 'badge-method-options';
    }
  }

  public getStatusBadgeClass(status: number): string {
    if (status >= 200 && status < 300) return 'bg-success text-white';
    if (status >= 300 && status < 400) return 'bg-info text-white';
    if (status >= 400 && status < 500) return 'bg-warning text-dark';
    if (status >= 500) return 'bg-danger text-white';
    return 'bg-secondary text-white';
  }

  public async importCurlFromClipboard(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = parseCurlCommand(text);
      if (!parsed) {
        this.notifyService.warning('Clipboard does not contain a recognizable curl command');
        return;
      }
      this.applyPartialRequest(parsed);
      this.notifyService.success('Imported cURL command');
    } catch {
      this.notifyService.error('Could not read clipboard');
    }
  }

  private applyPartialRequest(parsed: Partial<ApiRequestItem>): void {
    if (parsed.method) {
      this.currentMethod = parsed.method;
    }
    if (parsed.url) {
      this.currentUrl = parsed.url;
    }
    if (parsed.headers?.length) {
      this.headersList = parsed.headers;
    }
    if (parsed.auth) {
      this.authType = parsed.auth.type || 'none';
      this.authBearerToken = parsed.auth.bearerToken || '';
      this.authUsername = parsed.auth.username || '';
      this.authPassword = parsed.auth.password || '';
      this.apiKeyName = parsed.auth.apiKeyName || 'X-API-KEY';
      this.apiKeyValue = parsed.auth.apiKeyValue || '';
      this.apiKeyAddTo = parsed.auth.apiKeyAddTo || 'header';
    }
    if (parsed.body) {
      const allowedBodyTypes = new Set(['none', 'json', 'text', 'xml']);
      const nextType = parsed.body.type || 'none';
      this.bodyType = allowedBodyTypes.has(nextType) ? (nextType as typeof this.bodyType) : 'none';
      this.rawBodyContent = parsed.body.raw || '';
    }
  }
}

