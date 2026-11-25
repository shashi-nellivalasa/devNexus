import { Injectable, DestroyRef } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { ApiCollection, ApiRequestItem, ApiResponseData, KeyValuePair } from '../models/api-tester.model';
import { OpenApiSpecData, OpenApiEndpoint, OpenApiParameter, OpenApiRequestBody, OpenApiResponseItem } from '../models/openapi.model';
import * as yaml from 'js-yaml';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private readonly DB_NAME = 'devnexus_db';
  private readonly DB_VERSION = 1;
  private readonly HISTORY_STORE = 'api_history';
  private readonly COLLECTIONS_STORE = 'api_collections';
  private readonly LOCAL_HISTORY_KEY = 'devnexus_api_history';
  private readonly LOCAL_COLLECTIONS_KEY = 'devnexus_api_collections';

  private db: IDBDatabase | null = null;
  private isDbReady = false;

  // Constructor dependency injection required for services touching API calls
  constructor(
    private http: HttpClient,
    private destroyRef: DestroyRef
  ) {
    this.initIndexedDb();
  }

  // =========================================================================
  // IndexedDB Storage Engine with LocalStorage Fallback
  // =========================================================================

  private async initIndexedDb(): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      this.isDbReady = false;
      return;
    }

    try {
      this.db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
        req.onupgradeneeded = (e: IDBVersionChangeEvent) => {
          const target = e.target as IDBOpenDBRequest;
          const db = target.result;
          if (!db.objectStoreNames.contains(this.HISTORY_STORE)) {
            db.createObjectStore(this.HISTORY_STORE, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(this.COLLECTIONS_STORE)) {
            db.createObjectStore(this.COLLECTIONS_STORE, { keyPath: 'id' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      this.isDbReady = true;
    } catch {
      this.isDbReady = false;
    }
  }

  public async getHistory(): Promise<ApiRequestItem[]> {
    if (this.isDbReady && this.db) {
      try {
        return await new Promise<ApiRequestItem[]>((resolve) => {
          const tx = this.db!.transaction(this.HISTORY_STORE, 'readonly');
          const store = tx.objectStore(this.HISTORY_STORE);
          const req = store.getAll();
          req.onsuccess = () => {
            const list = (req.result || []) as ApiRequestItem[];
            list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            resolve(list);
          };
          req.onerror = () => resolve(this.getLocalHistory());
        });
      } catch {
        return this.getLocalHistory();
      }
    }
    return this.getLocalHistory();
  }

  public async addToHistory(item: ApiRequestItem): Promise<void> {
    const clone = { ...item, timestamp: Date.now() };
    if (this.isDbReady && this.db) {
      try {
        const tx = this.db.transaction(this.HISTORY_STORE, 'readwrite');
        const store = tx.objectStore(this.HISTORY_STORE);
        store.put(clone);
      } catch {
        this.saveLocalHistory(clone);
      }
    } else {
      this.saveLocalHistory(clone);
    }
  }

  public async clearHistory(): Promise<void> {
    if (this.isDbReady && this.db) {
      try {
        const tx = this.db.transaction(this.HISTORY_STORE, 'readwrite');
        const store = tx.objectStore(this.HISTORY_STORE);
        store.clear();
      } catch {
        // fallback
      }
    }
    localStorage.removeItem(this.LOCAL_HISTORY_KEY);
  }

  public async getCollections(): Promise<ApiCollection[]> {
    if (this.isDbReady && this.db) {
      try {
        return await new Promise<ApiCollection[]>((resolve) => {
          const tx = this.db!.transaction(this.COLLECTIONS_STORE, 'readonly');
          const store = tx.objectStore(this.COLLECTIONS_STORE);
          const req = store.getAll();
          req.onsuccess = () => {
            const list = (req.result || []) as ApiCollection[];
            if (list.length === 0) {
              const defaultCol = this.getDefaultCollection();
              this.saveCollection(defaultCol);
              resolve([defaultCol]);
            } else {
              resolve(list);
            }
          };
          req.onerror = () => resolve(this.getLocalCollections());
        });
      } catch {
        return this.getLocalCollections();
      }
    }
    return this.getLocalCollections();
  }

  public async saveCollection(col: ApiCollection): Promise<void> {
    if (this.isDbReady && this.db) {
      try {
        const tx = this.db.transaction(this.COLLECTIONS_STORE, 'readwrite');
        const store = tx.objectStore(this.COLLECTIONS_STORE);
        store.put(col);
      } catch {
        this.saveLocalCollection(col);
      }
    } else {
      this.saveLocalCollection(col);
    }
  }

  public async deleteCollection(id: string): Promise<void> {
    if (this.isDbReady && this.db) {
      try {
        const tx = this.db.transaction(this.COLLECTIONS_STORE, 'readwrite');
        const store = tx.objectStore(this.COLLECTIONS_STORE);
        store.delete(id);
      } catch {
        // fallback
      }
    }
    const cols = this.getLocalCollections().filter(c => c.id !== id);
    localStorage.setItem(this.LOCAL_COLLECTIONS_KEY, JSON.stringify(cols));
  }

  private getLocalHistory(): ApiRequestItem[] {
    try {
      const raw = localStorage.getItem(this.LOCAL_HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveLocalHistory(item: ApiRequestItem): void {
    const list = this.getLocalHistory().filter(h => h.id !== item.id);
    list.unshift(item);
    if (list.length > 100) list.pop();
    localStorage.setItem(this.LOCAL_HISTORY_KEY, JSON.stringify(list));
  }

  private getLocalCollections(): ApiCollection[] {
    try {
      const raw = localStorage.getItem(this.LOCAL_COLLECTIONS_KEY);
      if (!raw) {
        const defaultCol = this.getDefaultCollection();
        localStorage.setItem(this.LOCAL_COLLECTIONS_KEY, JSON.stringify([defaultCol]));
        return [defaultCol];
      }
      return JSON.parse(raw);
    } catch {
      return [this.getDefaultCollection()];
    }
  }

  private saveLocalCollection(col: ApiCollection): void {
    const list = this.getLocalCollections().filter(c => c.id !== col.id);
    list.push(col);
    localStorage.setItem(this.LOCAL_COLLECTIONS_KEY, JSON.stringify(list));
  }

  private getDefaultCollection(): ApiCollection {
    return {
      id: 'default-col',
      name: 'Sample API Collection',
      description: 'Preconfigured endpoints for instant API testing',
      createdAt: Date.now(),
      requests: [
        {
          id: 'req-sample-1',
          name: 'Get Posts (JSONPlaceholder)',
          method: 'GET',
          url: 'https://jsonplaceholder.typicode.com/posts',
          params: [{ id: 'p1', key: '_limit', value: '5', enabled: true }],
          headers: [{ id: 'h1', key: 'Accept', value: 'application/json', enabled: true }],
          auth: { type: 'none' },
          body: { type: 'none' }
        },
        {
          id: 'req-sample-2',
          name: 'Create Post (JSONPlaceholder)',
          method: 'POST',
          url: 'https://jsonplaceholder.typicode.com/posts',
          params: [],
          headers: [{ id: 'h1', key: 'Content-Type', value: 'application/json; charset=UTF-8', enabled: true }],
          auth: { type: 'none' },
          body: {
            type: 'json',
            raw: JSON.stringify({ title: 'foo', body: 'bar', userId: 1 }, null, 2)
          }
        },
        {
          id: 'req-sample-3',
          name: 'HTTPBin Headers Echo',
          method: 'GET',
          url: 'https://httpbin.org/headers',
          params: [],
          headers: [
            { id: 'h1', key: 'X-DevNexus-Client', value: 'Angular-20', enabled: true }
          ],
          auth: { type: 'none' },
          body: { type: 'none' }
        }
      ]
    };
  }

  // =========================================================================
  // API Execution Engine
  // =========================================================================

  public executeRequest(req: ApiRequestItem): Observable<ApiResponseData> {
    const startTime = performance.now();

    // 1. Build Query Parameters
    let params = new HttpParams();
    if (req.params && req.params.length > 0) {
      req.params.filter(p => p.enabled && p.key.trim()).forEach(p => {
        params = params.append(p.key.trim(), p.value);
      });
    }

    // 2. Build Headers
    let headers = new HttpHeaders();
    if (req.headers && req.headers.length > 0) {
      req.headers.filter(h => h.enabled && h.key.trim()).forEach(h => {
        headers = headers.set(h.key.trim(), h.value);
      });
    }

    // 3. Apply Authentication
    if (req.auth) {
      if (req.auth.type === 'bearer' && req.auth.bearerToken) {
        headers = headers.set('Authorization', `Bearer ${req.auth.bearerToken.trim()}`);
      } else if (req.auth.type === 'basic' && (req.auth.username || req.auth.password)) {
        const credentials = btoa(`${req.auth.username || ''}:${req.auth.password || ''}`);
        headers = headers.set('Authorization', `Basic ${credentials}`);
      } else if (req.auth.type === 'apikey' && req.auth.apiKeyName && req.auth.apiKeyValue) {
        if (req.auth.apiKeyAddTo === 'query') {
          params = params.append(req.auth.apiKeyName.trim(), req.auth.apiKeyValue);
        } else {
          headers = headers.set(req.auth.apiKeyName.trim(), req.auth.apiKeyValue);
        }
      }
    }

    // 4. Build Request Body
    let bodyPayload: any = null;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      if (req.body.type === 'json') {
        bodyPayload = req.body.raw || '';
        if (!headers.has('Content-Type')) {
          headers = headers.set('Content-Type', 'application/json');
        }
      } else if (req.body.type === 'text' || req.body.type === 'xml') {
        bodyPayload = req.body.raw || '';
        if (!headers.has('Content-Type')) {
          headers = headers.set('Content-Type', req.body.type === 'xml' ? 'application/xml' : 'text/plain');
        }
      } else if (req.body.type === 'form-urlencoded' && req.body.urlEncoded) {
        let formParams = new HttpParams();
        req.body.urlEncoded.filter(p => p.enabled && p.key.trim()).forEach(p => {
          formParams = formParams.append(p.key.trim(), p.value);
        });
        bodyPayload = formParams.toString();
        headers = headers.set('Content-Type', 'application/x-www-form-urlencoded');
      } else if (req.body.type === 'form-data' && req.body.formData) {
        const formData = new FormData();
        req.body.formData.filter(f => f.enabled && f.key.trim()).forEach(f => {
          formData.append(f.key.trim(), f.value);
        });
        bodyPayload = formData;
      }
    }

    const cleanUrl = req.url ? req.url.trim() : '';

    return this.http.request(req.method, cleanUrl, {
      body: bodyPayload,
      headers,
      params,
      observe: 'response',
      responseType: 'text'
    }).pipe(
      map((res: HttpResponse<string>) => {
        const durationMs = Math.round(performance.now() - startTime);
        const headerRecord: Record<string, string> = {};
        res.headers.keys().forEach(k => {
          headerRecord[k] = res.headers.get(k) || '';
        });

        const rawBody = res.body || '';
        const sizeBytes = new Blob([rawBody]).size;
        let isJson = false;

        try {
          JSON.parse(rawBody);
          isJson = true;
        } catch {
          isJson = false;
        }

        // Add to history
        this.addToHistory(req);

        return {
          status: res.status,
          statusText: res.statusText || 'OK',
          durationMs,
          sizeBytes,
          headers: headerRecord,
          body: rawBody,
          isJson,
          timestamp: Date.now()
        };
      }),
      catchError((err: HttpErrorResponse) => {
        const durationMs = Math.round(performance.now() - startTime);
        const headerRecord: Record<string, string> = {};
        if (err.headers) {
          err.headers.keys().forEach(k => {
            headerRecord[k] = err.headers.get(k) || '';
          });
        }

        let bodyText = '';
        if (typeof err.error === 'string') {
          bodyText = err.error;
        } else if (err.error) {
          try {
            bodyText = JSON.stringify(err.error, null, 2);
          } catch {
            bodyText = String(err.error);
          }
        }

        let isJson = false;
        try {
          JSON.parse(bodyText);
          isJson = true;
        } catch {
          isJson = false;
        }

        const isCors = err.status === 0;
        const statusText = isCors
          ? 'Network / CORS Error (Cross-Origin Request Blocked)'
          : (err.statusText || 'Error');

        this.addToHistory(req);

        return of<ApiResponseData>({
          status: err.status,
          statusText,
          durationMs,
          sizeBytes: new Blob([bodyText]).size,
          headers: headerRecord,
          body: bodyText || (isCors ? 'Failed to fetch. This may be caused by browser CORS policy restrictions on the destination server or network disconnection.' : ''),
          isJson,
          timestamp: Date.now(),
          error: isCors ? 'CORS error: The requested resource did not provide Access-Control-Allow-Origin headers.' : (err.message || 'Request failed'),
          isNetworkError: isCors
        });
      })
    );
  }

  // =========================================================================
  // OpenAPI / Swagger Specification Parser
  // =========================================================================

  public fetchOpenApiUrl(url: string): Observable<string> {
    return this.http.get(url, { responseType: 'text' });
  }

  public parseOpenApiSpec(content: string): OpenApiSpecData {
    let doc: any = null;
    try {
      doc = JSON.parse(content);
    } catch {
      try {
        doc = yaml.load(content);
      } catch (e: any) {
        throw new Error('Failed to parse specification. Neither valid JSON nor valid YAML: ' + e.message);
      }
    }

    if (!doc || typeof doc !== 'object') {
      throw new Error('Invalid OpenAPI/Swagger structure');
    }

    const title = doc.info?.title || 'OpenAPI Specification';
    const version = doc.info?.version || '1.0.0';
    const description = doc.info?.description || '';

    // Servers
    const servers: { url: string; description?: string }[] = [];
    if (doc.servers && Array.isArray(doc.servers)) {
      doc.servers.forEach((s: any) => servers.push({ url: s.url, description: s.description }));
    } else if (doc.host) {
      const scheme = (doc.schemes && doc.schemes[0]) ? doc.schemes[0] : 'https';
      const basePath = doc.basePath || '';
      servers.push({ url: `${scheme}://${doc.host}${basePath}`, description: 'Default Server' });
    }

    if (servers.length === 0) {
      servers.push({ url: 'https://api.example.com', description: 'Sample Host' });
    }

    const endpoints: OpenApiEndpoint[] = [];
    const allTags = new Set<string>();

    const paths = doc.paths || {};
    const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

    for (const pathKey of Object.keys(paths)) {
      const pathObj = paths[pathKey];
      if (!pathObj || typeof pathObj !== 'object') continue;

      for (const m of methods) {
        const op = pathObj[m];
        if (!op) continue;

        const tags: string[] = Array.isArray(op.tags) && op.tags.length > 0 ? op.tags : ['General'];
        tags.forEach(t => allTags.add(t));

        // Parameters
        const parameters: OpenApiParameter[] = [];
        const rawParams = [...(pathObj.parameters || []), ...(op.parameters || [])];
        rawParams.forEach((p: any) => {
          parameters.push({
            name: p.name,
            in: p.in,
            required: !!p.required,
            description: p.description,
            schema: p.schema,
            type: p.type || p.schema?.type,
            example: p.example || p.schema?.example
          });
        });

        // Request Body (OpenAPI 3.x)
        let requestBody: OpenApiRequestBody | undefined;
        if (op.requestBody) {
          requestBody = {
            description: op.requestBody.description,
            required: !!op.requestBody.required,
            content: op.requestBody.content
          };
        } else {
          // Swagger 2.0 body parameter check
          const bodyParam = parameters.find(p => p.in === 'body');
          if (bodyParam) {
            requestBody = {
              description: bodyParam.description,
              required: bodyParam.required,
              content: {
                'application/json': {
                  schema: bodyParam.schema
                }
              }
            };
          }
        }

        // Responses
        const responses: OpenApiResponseItem[] = [];
        if (op.responses) {
          for (const statusKey of Object.keys(op.responses)) {
            const resp = op.responses[statusKey];
            responses.push({
              statusCode: statusKey,
              description: resp.description || '',
              content: resp.content,
              schema: resp.schema
            });
          }
        }

        endpoints.push({
          id: `${m.toUpperCase()}_${pathKey}`,
          path: pathKey,
          method: m.toUpperCase(),
          summary: op.summary || pathKey,
          description: op.description || '',
          tags,
          operationId: op.operationId,
          parameters,
          requestBody,
          responses,
          deprecated: !!op.deprecated
        });
      }
    }

    return {
      title,
      version,
      description,
      servers,
      endpoints,
      tags: Array.from(allTags)
    };
  }

  // =========================================================================
  // Mock Data Generation
  // =========================================================================

  public generateMockData(
    schemaType: 'users' | 'employees' | 'products' | 'transactions' | 'orders' | 'custom',
    count: number = 10,
    customFields?: { name: string; type: string }[]
  ): any[] {
    const records: any[] = [];
    const cappedCount = Math.max(1, Math.min(count, 500));

    const firstNames = ['Liam', 'Olivia', 'Noah', 'Emma', 'Oliver', 'Ava', 'Elijah', 'Sophia', 'Lucas', 'Mia', 'Alex', 'Sarah', 'Carlos', 'Yuki', 'Amina'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Chen', 'Patel', 'Kim'];
    const departments = ['Engineering', 'Product', 'Design', 'Marketing', 'Sales', 'Customer Success', 'Finance', 'Legal'];
    const roles = ['Software Engineer', 'Product Designer', 'Engineering Lead', 'Frontend Architect', 'DevOps Specialist', 'Data Analyst'];
    const categories = ['Electronics', 'Developer Tools', 'Audio', 'Home Office', 'Accessories', 'Software Licenses'];
    const productNames = ['Wireless Mechanical Keyboard', 'Ultra-Wide 4K Monitor', 'Noise-Canceling Studio Headphones', 'Ergonomic Desk Chair', 'USB-C Thunderbolt Hub', 'DevNexus Pro Subscription'];
    const cities = ['San Francisco', 'New York', 'London', 'Berlin', 'Tokyo', 'Toronto', 'Sydney', 'Bengaluru'];
    const countries = ['USA', 'UK', 'Germany', 'Japan', 'Canada', 'Australia', 'India'];
    const currencies = ['USD', 'EUR', 'GBP', 'CAD', 'JPY'];
    const statuses = ['COMPLETED', 'PENDING', 'PROCESSING', 'FAILED'];

    for (let i = 1; i <= cappedCount; i++) {
      const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
      const ln = lastNames[Math.floor(Math.random() * lastNames.length)];

      switch (schemaType) {
        case 'users':
          records.push({
            id: `usr_${1000 + i}`,
            firstName: fn,
            lastName: ln,
            fullName: `${fn} ${ln}`,
            email: `${fn.toLowerCase()}.${ln.toLowerCase()}@example.com`,
            avatar: `https://images.unsplash.com/photo-${1534528741775 + i}?auto=format&fit=crop&w=120&h=120&q=80`,
            role: roles[Math.floor(Math.random() * roles.length)],
            phone: `+1-555-${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`,
            isActive: Math.random() > 0.15,
            address: {
              street: `${Math.floor(10 + Math.random() * 990)} Tech Blvd`,
              city: cities[Math.floor(Math.random() * cities.length)],
              country: countries[Math.floor(Math.random() * countries.length)],
              zip: `${Math.floor(10000 + Math.random() * 89999)}`
            },
            createdAt: new Date(Date.now() - Math.floor(Math.random() * 10000000000)).toISOString()
          });
          break;

        case 'employees':
          records.push({
            id: `EMP-${2000 + i}`,
            name: `${fn} ${ln}`,
            department: departments[Math.floor(Math.random() * departments.length)],
            title: roles[Math.floor(Math.random() * roles.length)],
            salary: Math.floor(75000 + Math.random() * 95000),
            performanceScore: +(3.5 + Math.random() * 1.5).toFixed(2),
            email: `${fn.toLowerCase()}.${ln.toLowerCase()}@company.corp`,
            hireDate: new Date(Date.now() - Math.floor(Math.random() * 15000000000)).toISOString().split('T')[0]
          });
          break;

        case 'products':
          records.push({
            id: `prod_${3000 + i}`,
            name: `${productNames[i % productNames.length]} v${(i % 5) + 1}`,
            category: categories[Math.floor(Math.random() * categories.length)],
            price: +(19.99 + Math.random() * 480).toFixed(2),
            stock: Math.floor(Math.random() * 150),
            sku: `SKU-${Math.floor(100000 + Math.random() * 900000)}`,
            rating: +(3.8 + Math.random() * 1.2).toFixed(1),
            isAvailable: Math.random() > 0.1
          });
          break;

        case 'transactions':
          records.push({
            id: `tx_${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
            amount: +(10 + Math.random() * 2500).toFixed(2),
            currency: currencies[Math.floor(Math.random() * currencies.length)],
            status: statuses[Math.floor(Math.random() * statuses.length)],
            paymentMethod: ['CREDIT_CARD', 'PAYPAL', 'STRIPE', 'WIRE_TRANSFER'][Math.floor(Math.random() * 4)],
            customerId: `usr_${1000 + Math.floor(Math.random() * cappedCount) + 1}`,
            timestamp: new Date(Date.now() - Math.floor(Math.random() * 5000000000)).toISOString()
          });
          break;

        case 'orders':
          const orderItems = [
            {
              productId: `prod_${3000 + (i % 6) + 1}`,
              name: productNames[i % productNames.length],
              quantity: Math.floor(1 + Math.random() * 3),
              unitPrice: +(49.99 + Math.random() * 150).toFixed(2)
            }
          ];
          const total = +(orderItems.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0)).toFixed(2);
          records.push({
            id: `ORD-${8000 + i}`,
            customerName: `${fn} ${ln}`,
            email: `${fn.toLowerCase()}.${ln.toLowerCase()}@example.com`,
            total,
            currency: 'USD',
            status: statuses[Math.floor(Math.random() * statuses.length)],
            items: orderItems,
            orderDate: new Date(Date.now() - Math.floor(Math.random() * 8000000000)).toISOString()
          });
          break;

        case 'custom':
          const customItem: Record<string, any> = { id: i };
          if (customFields && customFields.length > 0) {
            customFields.forEach(f => {
              if (f.type === 'string') customItem[f.name] = `${f.name}_sample_${i}`;
              else if (f.type === 'number') customItem[f.name] = Math.floor(10 + Math.random() * 990);
              else if (f.type === 'boolean') customItem[f.name] = Math.random() > 0.5;
              else if (f.type === 'email') customItem[f.name] = `user${i}@domain.com`;
              else if (f.type === 'uuid') customItem[f.name] = crypto.randomUUID ? crypto.randomUUID() : `uuid-${i}-${Date.now()}`;
              else if (f.type === 'date') customItem[f.name] = new Date().toISOString();
            });
          }
          records.push(customItem);
          break;
      }
    }

    return records;
  }

  public async exportWorkspaceSnapshot(): Promise<{ history: ApiRequestItem[]; collections: ApiCollection[] }> {
    const [history, collections] = await Promise.all([this.getHistory(), this.getCollections()]);
    return { history, collections };
  }

  public async importWorkspaceSnapshot(data: {
    history?: ApiRequestItem[];
    collections?: ApiCollection[];
  }): Promise<void> {
    if (Array.isArray(data.history)) {
      await this.clearHistory();
      for (const item of data.history.slice(0, 100)) {
        await this.addToHistory(item);
      }
    }
    if (Array.isArray(data.collections)) {
      for (const col of data.collections) {
        await this.saveCollection(col);
      }
    }
  }

  public async clearAllWorkspaceData(): Promise<void> {
    await this.clearHistory();
    if (this.isDbReady && this.db) {
      try {
        const tx = this.db.transaction(this.COLLECTIONS_STORE, 'readwrite');
        tx.objectStore(this.COLLECTIONS_STORE).clear();
      } catch {
        // fallback
      }
    }
    localStorage.removeItem(this.LOCAL_COLLECTIONS_KEY);
  }
}

