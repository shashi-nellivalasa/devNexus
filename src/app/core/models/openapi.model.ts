export interface OpenApiParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie' | 'body';
  required?: boolean;
  description?: string;
  schema?: any;
  type?: string;
  example?: any;
}

export interface OpenApiMediaType {
  schema?: any;
  example?: any;
  examples?: Record<string, any>;
}

export interface OpenApiRequestBody {
  description?: string;
  required?: boolean;
  content?: Record<string, OpenApiMediaType>;
}

export interface OpenApiResponseItem {
  statusCode: string;
  description?: string;
  content?: Record<string, OpenApiMediaType>;
  schema?: any;
}

export interface OpenApiEndpoint {
  id: string;
  path: string;
  method: string;
  summary: string;
  description?: string;
  tags: string[];
  operationId?: string;
  parameters: OpenApiParameter[];
  requestBody?: OpenApiRequestBody;
  responses: OpenApiResponseItem[];
  deprecated?: boolean;
}

export interface OpenApiServer {
  url: string;
  description?: string;
}

export interface OpenApiSpecData {
  title: string;
  version: string;
  description?: string;
  servers: OpenApiServer[];
  endpoints: OpenApiEndpoint[];
  tags: string[];
}

