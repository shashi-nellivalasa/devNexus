/**
 * Canonical list of registered utility tool IDs.
 * Keep in sync with `ToolRegistryService.toolsList` and lazy routes in `app.routes.ts`.
 */
export const REGISTERED_TOOL_IDS = [
  'api-tester',
  'base64-studio',
  'chunk-formatter',
  'code-diff',
  'code-minifier',
  'encode-decode',
  'git-generator',
  'json-diff',
  'json-formatter',
  'json-stringify',
  'json-to-angular',
  'json-to-typescript',
  'json-validator',
  'json-yaml',
  'jwt-decoder',
  'markdown-preview',
  'mock-data',
  'pdf-image-converter',
  'pdf-signature-coordinates',
  'regex-tester',
  'sql-formatter',
  'string-escape',
  'swagger-explorer',
  'typescript-playground'
] as const;

export type RegisteredToolId = (typeof REGISTERED_TOOL_IDS)[number];

export const REGISTERED_TOOL_COUNT = REGISTERED_TOOL_IDS.length;

export const REGISTERED_TOOL_ID_SET = new Set<string>(REGISTERED_TOOL_IDS);

export function isRegisteredToolId(id: string): id is RegisteredToolId {
  return REGISTERED_TOOL_ID_SET.has(id);
}

export function pruneToRegisteredToolIds(ids: string[]): string[] {
  return ids.filter(isRegisteredToolId);
}