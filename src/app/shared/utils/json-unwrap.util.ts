/**
 * Utilities for parsing JSON payloads or key-value fragments that contain
 * escaped JSON strings (e.g. `"key": "{\"a\":1}"`) or already-unescaped
 * JSON wrapped in quotes (e.g. `"key": "{"a":1}"`).
 */

/** Try parsing a string as JSON object/array, unwrapping multi-level string escaping. */
function tryParseJsonContainer(raw: string, depth = 0): unknown {
  if (depth > 4) {
    return raw;
  }
  const trimmed = raw.trim();
  if (
    !(trimmed.startsWith('{') && trimmed.endsWith('}')) &&
    !(trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    return raw;
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed !== null && typeof parsed === 'object') {
      return unwrapEmbeddedJsonValues(parsed, depth + 1);
    }
    return raw;
  } catch {
    return raw;
  }
}

/** Recursively parse string values inside a JSON value when they contain valid JSON objects/arrays. */
export function unwrapEmbeddedJsonValues(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') {
    return tryParseJsonContainer(value, depth);
  }
  if (Array.isArray(value)) {
    return value.map((item) => unwrapEmbeddedJsonValues(item, depth));
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = unwrapEmbeddedJsonValues(v, depth);
    }
    return out;
  }
  return value;
}

/** Skip a standard JSON string starting at opening quote index `start`. Returns index right after closing quote, or -1. */
function skipJsonString(text: string, start: number): number {
  let i = start + 1;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '"') {
      return i + 1;
    }
    i++;
  }
  return -1;
}

/**
 * Scan from an opening `{` or `[` using balanced JSON nesting (ignoring chars inside valid `"..."` strings).
 * Returns the index immediately after the matching `}` or `]`, or -1 if unbalanced.
 */
function findBalancedJsonEnd(text: string, start: number): number {
  const openChar = text[start];
  if (openChar !== '{' && openChar !== '[') {
    return -1;
  }
  let depth = 0;
  let i = start;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      const next = skipJsonString(text, i);
      if (next === -1) {
        return -1;
      }
      i = next;
      continue;
    }
    if (ch === '{' || ch === '[') {
      depth++;
    } else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) {
        return i + 1;
      }
      if (depth < 0) {
        return -1;
      }
    }
    i++;
  }
  return -1;
}

/**
 * Remove accidental outer quotes around unescaped JSON containers like `"{"a":1}"` or `"[{"a":1}]"`
 * while preserving normal strings and escaping.
 */
function stripQuotesAroundEmbeddedContainers(text: string): string {
  let out = '';
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      const nextNonWs = text[i + 1];
      if (nextNonWs === '{' || nextNonWs === '[') {
        const balancedEnd = findBalancedJsonEnd(text, i + 1);
        if (balancedEnd !== -1 && text[balancedEnd] === '"') {
          let look = balancedEnd + 1;
          while (look < text.length && /\s/.test(text[look])) {
            look++;
          }
          const after = text[look];
          if (look >= text.length || after === ',' || after === '}' || after === ']') {
            const inner = stripQuotesAroundEmbeddedContainers(text.slice(i + 1, balancedEnd));
            out += inner;
            i = balancedEnd + 1;
            continue;
          }
        }
      }

      const endStr = skipJsonString(text, i);
      if (endStr !== -1) {
        out += text.slice(i, endStr);
        i = endStr;
        continue;
      }
    }
    out += ch;
    i++;
  }

  return out;
}

/** Remove trailing commas before `}` / `]` / EOF outside strings. */
function stripTrailingCommas(text: string): string {
  let out = '';
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      const endStr = skipJsonString(text, i);
      if (endStr === -1) {
        out += text.slice(i);
        break;
      }
      out += text.slice(i, endStr);
      i = endStr;
      continue;
    }
    if (ch === ',') {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) {
        j++;
      }
      if (j >= text.length || text[j] === '}' || text[j] === ']') {
        i++;
        continue;
      }
    }
    out += ch;
    i++;
  }

  return out;
}

/** Wrap property fragments like `"key": ...` into `{ "key": ... }` when not already an object/array. */
function normalizeFragmentRoot(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return trimmed;
  }
  if (/^"(?:[^"\\]|\\.)+"\s*:/.test(trimmed)) {
    return `{${trimmed}}`;
  }
  return trimmed;
}

/**
 * Parse JSON cleanly. When `unwrapEmbedded` is enabled:
 * 1) Recursively parses stringified JSON values inside objects/arrays.
 * 2) If strict `JSON.parse` fails, recovers key-value fragments (`"key": ...,`),
 *    trailing commas, and `"{"...}"` values produced by raw string unescaping.
 */
export function parseJsonInput(raw: string, unwrapEmbedded: boolean): unknown {
  if (!unwrapEmbedded) {
    return JSON.parse(raw);
  }

  try {
    return unwrapEmbeddedJsonValues(JSON.parse(raw));
  } catch (strictErr) {
    const cleaned = stripTrailingCommas(
      normalizeFragmentRoot(stripQuotesAroundEmbeddedContainers(stripTrailingCommas(raw.trim())))
    );
    try {
      return unwrapEmbeddedJsonValues(JSON.parse(cleaned));
    } catch {
      throw strictErr;
    }
  }
}
