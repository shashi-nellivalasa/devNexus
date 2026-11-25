export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type AuthType = 'none' | 'bearer' | 'basic' | 'apikey';

export type BodyType = 'none' | 'json' | 'text' | 'form-urlencoded' | 'form-data' | 'xml';

export interface KeyValuePair {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

export interface RequestAuth {
  type: AuthType;
  bearerToken?: string;
  username?: string;
  password?: string;
  apiKeyName?: string;
  apiKeyValue?: string;
  apiKeyAddTo?: 'header' | 'query';
}

export interface RequestBodyConfig {
  type: BodyType;
  raw?: string;
  urlEncoded?: KeyValuePair[];
  formData?: KeyValuePair[];
}

export interface ApiRequestItem {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  params: KeyValuePair[];
  headers: KeyValuePair[];
  auth: RequestAuth;
  body: RequestBodyConfig;
  collectionId?: string;
  timestamp?: number;
}

export interface ApiResponseData {
  status: number;
  statusText: string;
  durationMs: number;
  sizeBytes: number;
  headers: Record<string, string>;
  body: string;
  isJson: boolean;
  timestamp: number;
  error?: string;
  isNetworkError?: boolean;
}

export interface ApiCollection {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  requests: ApiRequestItem[];
}

