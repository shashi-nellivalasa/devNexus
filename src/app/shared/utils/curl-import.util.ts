import { ApiRequestItem, BodyType, HttpMethod, KeyValuePair } from '../../core/models/api-tester.model';

const METHODS = new Set<HttpMethod>(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

function newPair(key: string, value: string): KeyValuePair {
  return { id: Math.random().toString(36).slice(2, 9), key, value, enabled: true };
}

function extractQuotedSegments(input: string): string[] {
  const parts: string[] = [];
  const regex = /'([^']*)'|"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(input)) !== null) {
    parts.push(match[1] ?? match[2] ?? '');
  }
  return parts;
}

function findUrl(tokens: string[]): string {
  for (const t of tokens) {
    if (/^https?:\/\//i.test(t)) {
      return t;
    }
  }
  const joined = tokens.join(' ');
  const urlMatch = joined.match(/https?:\/\/[^\s'"]+/i);
  return urlMatch?.[0] ?? '';
}

/**
 * Best-effort parser for common `curl` command shapes (browser-side import).
 */
export function parseCurlCommand(raw: string): Partial<ApiRequestItem> | null {
  const normalized = raw.replace(/\\\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
  if (!/^curl\s/i.test(normalized)) {
    return null;
  }

  let method: HttpMethod = 'GET';
  const methodMatch = normalized.match(/(?:^|\s)(?:-X|--request)\s+([A-Z]+)/i);
  if (methodMatch?.[1] && METHODS.has(methodMatch[1].toUpperCase() as HttpMethod)) {
    method = methodMatch[1].toUpperCase() as HttpMethod;
  }

  const headers: KeyValuePair[] = [];
  const headerRegex = /(?:-H|--header)\s+('[^']*'|"[^"]*")/gi;
  let headerMatch: RegExpExecArray | null;
  while ((headerMatch = headerRegex.exec(normalized)) !== null) {
    const segment = headerMatch[1].slice(1, -1);
    const colon = segment.indexOf(':');
    if (colon > 0) {
      headers.push(newPair(segment.slice(0, colon).trim(), segment.slice(colon + 1).trim()));
    }
  }

  let bodyRaw = '';
  const dataMatch = normalized.match(/(?:-d|--data|--data-raw|--data-binary)\s+('[^']*'|"[^"]*")/i);
  if (dataMatch?.[1]) {
    bodyRaw = dataMatch[1].slice(1, -1);
    if (method === 'GET') {
      method = 'POST';
    }
  }

  const tokens = extractQuotedSegments(normalized);
  const url = findUrl(tokens);
  if (!url) {
    return null;
  }

  let bodyType: BodyType = 'none';
  if (bodyRaw) {
    try {
      JSON.parse(bodyRaw);
      bodyType = 'json';
    } catch {
      bodyType = 'text';
    }
  }

  let auth: ApiRequestItem['auth'] = { type: 'none' };
  const authHeader = headers.find(h => h.key.toLowerCase() === 'authorization');
  if (authHeader?.value.toLowerCase().startsWith('bearer ')) {
    auth = { type: 'bearer', bearerToken: authHeader.value.slice(7).trim() };
    headers.splice(headers.indexOf(authHeader), 1);
  }

  return {
    method,
    url,
    headers,
    auth,
    body: { type: bodyType, raw: bodyRaw }
  };
}