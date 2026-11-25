export type ChunkLanguage = 'auto' | 'javascript' | 'css' | 'html' | 'json';
export type ResolvedChunkLanguage = Exclude<ChunkLanguage, 'auto'>;
export type ChunkTransformMode = 'prettify' | 'minify';

export interface ChunkFormatOptions {
  language: ChunkLanguage;
  indentSize: number;
  mode?: ChunkTransformMode;
}

export interface ChunkValidationError {
  message: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

export interface ChunkValidationResult {
  valid: boolean;
  language: ResolvedChunkLanguage;
  errors: ChunkValidationError[];
}

export interface ChunkFormatResult {
  output: string;
  /** @deprecated Kept for backwards compatibility; mirrors `output`. */
  formatted: string;
  detectedLanguage: ResolvedChunkLanguage;
  mode: ChunkTransformMode;
  originalLines: number;
  outputLines: number;
  /** @deprecated Kept for backwards compatibility; mirrors `outputLines`. */
  formattedLines: number;
  originalBytes: number;
  outputBytes: number;
  /** @deprecated Kept for backwards compatibility; mirrors `outputBytes`. */
  formattedBytes: number;
  savingsPercent: number;
}

type JsTokenKind =
  | 'word'
  | 'number'
  | 'string'
  | 'template'
  | 'regex'
  | 'comment-line'
  | 'comment-block'
  | 'punct';

interface JsToken {
  kind: JsTokenKind;
  value: string;
  line: number;
  column: number;
  start: number;
  end: number;
}

interface JsTokenizeResult {
  tokens: JsToken[];
  lexicalError?: ChunkValidationError;
}

const AsyncFunction: FunctionConstructor = Object.getPrototypeOf(async function () {}).constructor;

const ID_START_RE = /^[\p{ID_Start}$_#]$/u;
const ID_CONTINUE_RE = /^[\p{ID_Continue}$_\u200c\u200d]$/u;

const VOID_HTML_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr'
]);

/**
 * Computes 1-based line and column for a character offset in source text.
 */
function offsetToLineCol(code: string, offset: number): { line: number; column: number } {
  const clamped = Math.max(0, Math.min(offset, code.length));
  let line = 1;
  let lastLineStart = 0;
  for (let i = 0; i < clamped; i++) {
    if (code[i] === '\n') {
      line++;
      lastLineStart = i + 1;
    }
  }
  return { line, column: clamped - lastLineStart + 1 };
}

/**
 * Detects the most likely language of a minified or formatted build chunk.
 */
export function detectChunkLanguage(code: string): ResolvedChunkLanguage {
  const trimmed = code.trim();
  if (!trimmed) return 'javascript';

  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // Check if it looks more like JSON than JS (e.g. broken JSON with quoted keys)
      if (/^\{\s*"[^"]+"\s*:/.test(trimmed) && !/\b(function|return|const|let|var|=>)\b/.test(trimmed)) {
        return 'json';
      }
    }
  }

  if (/^<!doctype\s+html/i.test(trimmed) || /^<[a-z][\w-]*(\s|\/?>)/i.test(trimmed)) {
    return 'html';
  }

  const head = trimmed.slice(0, 1500);
  const hasJsSignals =
    /\b(function|const|let|var|import|export|return|class|new|typeof|switch|case)\b/.test(head) ||
    head.includes('=>');

  const hasCssSignals =
    /^(@charset|@import|@media|@keyframes|@font-face|:root|\.[a-z_-]|#[a-z_-])/i.test(trimmed) ||
    (!hasJsSignals && /\{[^}]*:[^{};]+;[^}]*\}/.test(head));

  if (hasCssSignals && !hasJsSignals) {
    return 'css';
  }

  return 'javascript';
}

/**
 * Resolves `'auto'` into a concrete language.
 */
export function resolveChunkLanguage(code: string, language: ChunkLanguage): ResolvedChunkLanguage {
  return language === 'auto' ? detectChunkLanguage(code) : language;
}

/**
 * Prettifies or minifies a JS, CSS, HTML, or JSON chunk.
 */
export function processChunk(code: string, options: ChunkFormatOptions): ChunkFormatResult {
  const mode: ChunkTransformMode = options.mode || 'prettify';
  const indentUnit = ' '.repeat(Math.max(1, options.indentSize || 2));
  const resolved = resolveChunkLanguage(code, options.language);

  let output = '';
  if (mode === 'minify') {
    switch (resolved) {
      case 'json':
        output = minifyJsonChunk(code);
        break;
      case 'css':
        output = minifyCssChunk(code);
        break;
      case 'html':
        output = minifyHtmlChunk(code);
        break;
      case 'javascript':
      default:
        output = minifyJsChunk(code);
        break;
    }
  } else {
    switch (resolved) {
      case 'json':
        output = formatJsonChunk(code, indentUnit);
        break;
      case 'css':
        output = formatCssChunk(code, indentUnit);
        break;
      case 'html':
        output = formatHtmlChunk(code, indentUnit);
        break;
      case 'javascript':
      default:
        output = formatJsChunk(code, indentUnit);
        break;
    }
  }

  const encoder = new TextEncoder();
  const originalBytes = encoder.encode(code).length;
  const outputBytes = encoder.encode(output).length;
  const originalLines = code ? code.split(/\r?\n/).length : 0;
  const outputLines = output ? output.split(/\r?\n/).length : 0;
  const savingsPercent =
    mode === 'minify' && originalBytes > 0
      ? Math.max(0, Math.round(((originalBytes - outputBytes) / originalBytes) * 100))
      : 0;

  return {
    output,
    formatted: output,
    detectedLanguage: resolved,
    mode,
    originalLines,
    outputLines,
    formattedLines: outputLines,
    originalBytes,
    outputBytes,
    formattedBytes: outputBytes,
    savingsPercent
  };
}

/**
 * Formats a minified JS, CSS, HTML, or JSON chunk into readable indented source.
 */
export function formatChunk(code: string, options: ChunkFormatOptions): ChunkFormatResult {
  return processChunk(code, { ...options, mode: options.mode || 'prettify' });
}

/**
 * Validates syntax for the given language and returns line/column error diagnostics.
 */
export function validateChunkSyntax(
  code: string,
  language: ChunkLanguage
): ChunkValidationResult {
  const resolved = resolveChunkLanguage(code, language);
  if (!code.trim()) {
    return { valid: true, language: resolved, errors: [] };
  }

  let errors: ChunkValidationError[] = [];
  switch (resolved) {
    case 'json':
      errors = validateJsonChunk(code);
      break;
    case 'css':
      errors = validateCssChunk(code);
      break;
    case 'html':
      errors = validateHtmlChunk(code);
      break;
    case 'javascript':
    default:
      errors = validateJsChunk(code);
      break;
  }

  return {
    valid: errors.length === 0,
    language: resolved,
    errors
  };
}

// =============================================================================
// Shared JS Tokenizer (used by Format, Minify, and Validate)
// =============================================================================

function tokenizeJs(code: string): JsTokenizeResult {
  const tokens: JsToken[] = [];
  const len = code.length;
  let i = 0;
  let line = 1;
  let col = 1;
  let lastSignificant = '';

  const advance = (count = 1) => {
    for (let k = 0; k < count && i < len; k++) {
      if (code[i] === '\n') {
        line++;
        col = 1;
      } else {
        col++;
      }
      i++;
    }
  };

  const canStartRegex = (prev: string): boolean => {
    if (!prev) return true;
    if (/^[(\[{,;:=!&|?+\-*%~^<>]$/.test(prev)) return true;
    return [
      'return', 'case', 'throw', 'typeof', 'void', 'delete',
      'in', 'of', 'new', 'else', 'yield', 'await'
    ].includes(prev);
  };

  while (i < len) {
    const ch = code[i];

    if (/\s/.test(ch)) {
      advance(1);
      continue;
    }

    const tokLine = line;
    const tokCol = col;
    const start = i;

    // Single-line comment
    if (ch === '/' && code[i + 1] === '/') {
      advance(2);
      while (i < len && code[i] !== '\n') advance(1);
      tokens.push({
        kind: 'comment-line',
        value: code.slice(start, i),
        line: tokLine,
        column: tokCol,
        start,
        end: i
      });
      continue;
    }

    // Block comment
    if (ch === '/' && code[i + 1] === '*') {
      advance(2);
      let closed = false;
      while (i < len) {
        if (code[i] === '*' && code[i + 1] === '/') {
          advance(2);
          closed = true;
          break;
        }
        advance(1);
      }
      if (!closed) {
        return {
          tokens,
          lexicalError: {
            message: 'Unterminated block comment (/* ... */)',
            line: tokLine,
            column: tokCol
          }
        };
      }
      tokens.push({
        kind: 'comment-block',
        value: code.slice(start, i),
        line: tokLine,
        column: tokCol,
        start,
        end: i
      });
      continue;
    }

    // String literals
    if (ch === '"' || ch === "'") {
      const quote = ch;
      advance(1);
      let closed = false;
      while (i < len) {
        const sc = code[i];
        if (sc === '\\') {
          advance(i + 1 < len ? 2 : 1);
          continue;
        }
        if (sc === '\n') {
          break;
        }
        if (sc === quote) {
          advance(1);
          closed = true;
          break;
        }
        advance(1);
      }
      if (!closed) {
        return {
          tokens,
          lexicalError: {
            message: `Unterminated string literal (${quote}...${quote})`,
            line: tokLine,
            column: tokCol
          }
        };
      }
      tokens.push({
        kind: 'string',
        value: code.slice(start, i),
        line: tokLine,
        column: tokCol,
        start,
        end: i
      });
      lastSignificant = quote;
      continue;
    }

    // Template literals (supports nested ${...} expressions)
    if (ch === '`') {
      const scanTemplate = (): boolean => {
        advance(1); // opening `
        while (i < len) {
          const tc = code[i];
          if (tc === '\\') {
            advance(i + 1 < len ? 2 : 1);
            continue;
          }
          if (tc === '$' && code[i + 1] === '{') {
            advance(2);
            let braceDepth = 1;
            while (i < len && braceDepth > 0) {
              const ec = code[i];
              if (ec === '\\') {
                advance(i + 1 < len ? 2 : 1);
              } else if (ec === '"' || ec === "'") {
                const q = ec;
                advance(1);
                while (i < len) {
                  if (code[i] === '\\') advance(i + 1 < len ? 2 : 1);
                  else if (code[i] === q) { advance(1); break; }
                  else if (code[i] === '\n') break;
                  else advance(1);
                }
              } else if (ec === '`') {
                if (!scanTemplate()) return false;
              } else if (ec === '{') {
                braceDepth++;
                advance(1);
              } else if (ec === '}') {
                braceDepth--;
                advance(1);
              } else {
                advance(1);
              }
            }
            if (braceDepth > 0) return false;
            continue;
          }
          if (tc === '`') {
            advance(1);
            return true;
          }
          advance(1);
        }
        return false;
      };

      if (!scanTemplate()) {
        return {
          tokens,
          lexicalError: {
            message: 'Unterminated template literal (`...`)',
            line: tokLine,
            column: tokCol
          }
        };
      }
      tokens.push({
        kind: 'template',
        value: code.slice(start, i),
        line: tokLine,
        column: tokCol,
        start,
        end: i
      });
      lastSignificant = '`';
      continue;
    }

    // Regex literal
    if (ch === '/' && canStartRegex(lastSignificant)) {
      advance(1);
      let inClass = false;
      let closed = false;
      while (i < len) {
        const rc = code[i];
        if (rc === '\\') {
          if (i + 1 >= len || code[i + 1] === '\n') break;
          advance(2);
          continue;
        }
        if (rc === '[') inClass = true;
        else if (rc === ']') inClass = false;
        else if (rc === '/' && !inClass) {
          advance(1);
          closed = true;
          break;
        } else if (rc === '\n') {
          break;
        }
        advance(1);
      }
      if (!closed) {
        return {
          tokens,
          lexicalError: {
            message: 'Unterminated regular expression literal',
            line: tokLine,
            column: tokCol
          }
        };
      }
      while (i < len && /[a-z]/i.test(code[i])) advance(1);
      tokens.push({
        kind: 'regex',
        value: code.slice(start, i),
        line: tokLine,
        column: tokCol,
        start,
        end: i
      });
      lastSignificant = '/';
      continue;
    }

    // Identifier / keyword (supports Unicode identifiers such as Angular Ivy ɵfac / ɵprov)
    if (ID_START_RE.test(ch)) {
      advance(1);
      while (i < len && ID_CONTINUE_RE.test(code[i])) advance(1);
      const word = code.slice(start, i);
      tokens.push({
        kind: 'word',
        value: word,
        line: tokLine,
        column: tokCol,
        start,
        end: i
      });
      lastSignificant = word;
      continue;
    }

    // Numbers
    if (/[0-9]/.test(ch)) {
      while (i < len && /[0-9a-fA-FxXoObBn._eE+-]/.test(code[i])) {
        if ((code[i] === '+' || code[i] === '-') && !/[eE]/.test(code[i - 1] || '')) break;
        advance(1);
      }
      const num = code.slice(start, i);
      tokens.push({
        kind: 'number',
        value: num,
        line: tokLine,
        column: tokCol,
        start,
        end: i
      });
      lastSignificant = '0';
      continue;
    }

    // Multi-character operators / punctuation (keeps operators intact for minify spacing)
    const three = code.slice(i, i + 3);
    const two = code.slice(i, i + 2);
    let punct = ch;
    if (['===', '!==', '>>>', '**=', '&&=', '||=', '??=', '...'].includes(three)) {
      punct = three;
    } else if (
      ['=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--', '**', '<<', '>>', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^='].includes(two)
    ) {
      punct = two;
    }
    advance(punct.length);
    tokens.push({
      kind: 'punct',
      value: punct,
      line: tokLine,
      column: tokCol,
      start,
      end: i
    });
    lastSignificant = punct;
  }

  return { tokens };
}

// =============================================================================
// JavaScript Formatter, Minifier, and Validator
// =============================================================================

function formatJsChunk(code: string, indentUnit: string): string {
  const { tokens } = tokenizeJs(code);
  const out: string[] = [];
  const containerStack: ('{' | '(' | '[')[] = [];
  let indent = 0;
  let parenDepth = 0;
  let inForHeader = false;
  let forParenDepth = 0;

  const pushIndent = () => out.push(indentUnit.repeat(Math.max(0, indent)));
  const trimTrailingSpaces = () => {
    while (out.length > 0 && (out[out.length - 1] === ' ' || out[out.length - 1] === '\t')) {
      out.pop();
    }
  };
  const ensureNewline = () => {
    trimTrailingSpaces();
    if (out.length > 0 && out[out.length - 1] !== '\n') out.push('\n');
  };
  const endsWithWhitespaceOrOpen = (): boolean => {
    const prev = out[out.length - 1];
    return !prev || prev === '\n' || prev.endsWith(' ') || prev === '(' || prev === '[' || prev === '.' || prev === '?.';
  };
  const maybeSpaceBefore = (val: string) => {
    if (endsWithWhitespaceOrOpen()) return;
    const prev = out[out.length - 1];
    if (prev === '!' || prev === '~' || prev === '++' || prev === '--') return;
    if (val === '(' || val === '[' || val === '.' || val === '?.' || val === ';' || val === ',') return;
    out.push(' ');
  };

  for (let idx = 0; idx < tokens.length; idx++) {
    const tok = tokens[idx];
    const next = tokens[idx + 1];

    if (tok.kind === 'comment-line') {
      if (out.length > 0 && out[out.length - 1] === '\n') pushIndent();
      else if (out.length > 0 && !out[out.length - 1].endsWith(' ')) out.push(' ');
      out.push(tok.value);
      ensureNewline();
      continue;
    }

    if (tok.kind === 'comment-block') {
      if (out.length > 0 && out[out.length - 1] === '\n') pushIndent();
      else if (out.length > 0 && !out[out.length - 1].endsWith(' ')) out.push(' ');
      out.push(tok.value);
      if (next?.value !== ';' && next?.value !== ',') ensureNewline();
      continue;
    }

    if (tok.kind === 'punct') {
      const v = tok.value;
      if (v === '(') {
        const prev = out[out.length - 1];
        if (['if', 'for', 'while', 'switch', 'catch', 'return', 'new', '=>', 'from'].includes(prev)) {
          out.push(' ');
        } else if (out.length > 0 && prev === '\n') {
          pushIndent();
        }
        parenDepth++;
        containerStack.push('(');
        out.push('(');
        continue;
      }

      if (v === ')') {
        parenDepth = Math.max(0, parenDepth - 1);
        if (containerStack[containerStack.length - 1] === '(') containerStack.pop();
        if (inForHeader && parenDepth === forParenDepth) inForHeader = false;
        if (out.length > 0 && out[out.length - 1] === '\n') pushIndent();
        trimTrailingSpaces();
        out.push(')');
        continue;
      }

      if (v === '{') {
        const prev = out[out.length - 1];
        if (out.length > 0 && prev === '\n') {
          pushIndent();
        } else if (out.length > 0 && !prev.endsWith(' ') && prev !== '(' && prev !== '[') {
          out.push(' ');
        }
        out.push('{');
        indent++;
        containerStack.push('{');
        ensureNewline();
        continue;
      }

      if (v === '}') {
        indent = Math.max(0, indent - 1);
        if (containerStack[containerStack.length - 1] === '{') containerStack.pop();
        ensureNewline();
        pushIndent();
        out.push('}');
        const nv = next?.value;
        if (
          nv !== ';' &&
          nv !== ',' &&
          nv !== ')' &&
          nv !== ']' &&
          nv !== '.' &&
          nv !== 'else' &&
          nv !== 'catch' &&
          nv !== 'finally' &&
          nv !== 'from'
        ) {
          ensureNewline();
        } else if (nv === 'else' || nv === 'catch' || nv === 'finally' || nv === 'from') {
          out.push(' ');
        }
        continue;
      }

      if (v === ';') {
        trimTrailingSpaces();
        out.push(';');
        if (inForHeader) out.push(' ');
        else ensureNewline();
        continue;
      }

      if (v === ',') {
        trimTrailingSpaces();
        out.push(',');
        const topContainer = containerStack[containerStack.length - 1];
        if (topContainer === '{' && !inForHeader) ensureNewline();
        else out.push(' ');
        continue;
      }

      if (v === '[') {
        const prev = out[out.length - 1];
        if (out.length > 0 && prev === '\n') pushIndent();
        else if (['return', 'throw', 'case', 'in', 'of', '=>', '='].includes(prev)) out.push(' ');
        containerStack.push('[');
        out.push('[');
        continue;
      }

      if (v === ']') {
        if (containerStack[containerStack.length - 1] === '[') containerStack.pop();
        trimTrailingSpaces();
        out.push(']');
        continue;
      }

      if (v === '.' || v === '?.') {
        trimTrailingSpaces();
        out.push(v);
        continue;
      }

      if (v === ':') {
        trimTrailingSpaces();
        out.push(': ');
        continue;
      }

      if (v === '++' || v === '--') {
        out.push(v);
        continue;
      }

      if (v === '!' || v === '~') {
        if (out.length > 0 && out[out.length - 1] === '\n') pushIndent();
        else maybeSpaceBefore(v);
        out.push(v);
        continue;
      }

      // Binary/assignment/arrow operators
      if (out.length > 0 && out[out.length - 1] === '\n') pushIndent();
      else trimTrailingSpaces();
      if (out.length > 0 && out[out.length - 1] !== '\n' && !out[out.length - 1].endsWith(' ')) out.push(' ');
      out.push(v, ' ');
      continue;
    }

    // Words, numbers, strings, templates, regexes
    if (out.length > 0 && out[out.length - 1] === '\n') {
      pushIndent();
    } else {
      maybeSpaceBefore(tok.value);
    }
    out.push(tok.value);

    if (tok.value === 'for') {
      inForHeader = true;
      forParenDepth = parenDepth;
    }
  }

  return out.join('').replace(/\n{3,}/g, '\n\n').trim();
}

function minifyJsChunk(code: string): string {
  const { tokens } = tokenizeJs(code);
  const parts: string[] = [];
  let prev: JsToken | null = null;

  const isWordLike = (t: JsToken): boolean =>
    t.kind === 'word' || t.kind === 'number';

  for (const tok of tokens) {
    if (tok.kind === 'comment-line' || tok.kind === 'comment-block') {
      continue;
    }

    if (prev) {
      const bothWord = isWordLike(prev) && isWordLike(tok);
      const sameSignCollision =
        (prev.value.endsWith('+') && tok.value.startsWith('+')) ||
        (prev.value.endsWith('-') && tok.value.startsWith('-')) ||
        (prev.value === '/' && tok.kind === 'regex');
      const regexKeywordSep =
        prev.kind === 'word' && tok.kind === 'regex';
      const asiSafeNewline =
        prev.line < tok.line &&
        prev.kind !== 'punct' &&
        (prev.value === 'return' || prev.value === 'throw' || prev.value === 'break' || prev.value === 'continue');

      if (asiSafeNewline && tok.value !== ';') {
        parts.push(';');
      } else if (bothWord || sameSignCollision || regexKeywordSep) {
        parts.push(' ');
      }
    }

    parts.push(tok.value);
    prev = tok;
  }

  return parts.join('').trim();
}

function validateJsChunk(code: string): ChunkValidationError[] {
  const { tokens, lexicalError } = tokenizeJs(code);
  if (lexicalError) {
    return [lexicalError];
  }

  // 1. Bracket / brace / paren balance check
  const openStack: { ch: string; expected: string; line: number; column: number }[] = [];
  const pairs: Record<string, string> = { '(': ')', '{': '}', '[': ']' };
  const closers = new Set([')', '}', ']']);

  for (const tok of tokens) {
    if (tok.kind !== 'punct') continue;
    if (pairs[tok.value]) {
      openStack.push({
        ch: tok.value,
        expected: pairs[tok.value],
        line: tok.line,
        column: tok.column
      });
    } else if (closers.has(tok.value)) {
      const top = openStack.pop();
      if (!top) {
        return [{
          message: `Unexpected closing '${tok.value}' with no matching opener`,
          line: tok.line,
          column: tok.column
        }];
      }
      if (top.expected !== tok.value) {
        return [{
          message: `Mismatched '${tok.value}': expected '${top.expected}' to close '${top.ch}' at Line ${top.line}, Col ${top.column}`,
          line: tok.line,
          column: tok.column
        }];
      }
    }
  }

  if (openStack.length > 0) {
    const unclosed = openStack[openStack.length - 1];
    return [{
      message: `Unclosed '${unclosed.ch}' — expected matching '${unclosed.expected}'`,
      line: unclosed.line,
      column: unclosed.column
    }];
  }

  // 2. Transform top-level ES module syntax into parseable JS while preserving line structure
  const normalized = normalizeTopLevelEsm(code, tokens);
  try {
    new AsyncFunction(normalized);
  } catch (err: any) {
    const errLine = extractJsErrorLine(err, normalized, tokens);
    return [{
      message: err?.message || 'JavaScript syntax error',
      line: errLine.line,
      column: errLine.column
    }];
  }

  return [];
}

/**
 * Replaces top-level `import`, `export`, and `import.meta` tokens so ES modules
 * can be syntactically validated by `AsyncFunction`.
 */
function normalizeTopLevelEsm(code: string, tokens: JsToken[]): string {
  const sig = tokens.filter(t => t.kind !== 'comment-line' && t.kind !== 'comment-block');
  const edits: { start: number; end: number; text: string }[] = [];
  let depth = 0;

  for (let i = 0; i < sig.length; i++) {
    const t = sig[i];

    if (t.kind === 'punct') {
      if (t.value === '{' || t.value === '(' || t.value === '[') depth++;
      else if (t.value === '}' || t.value === ')' || t.value === ']') depth = Math.max(0, depth - 1);
      continue;
    }

    // `import.meta` expression anywhere
    if (
      t.kind === 'word' &&
      t.value === 'import' &&
      sig[i + 1]?.value === '.' &&
      sig[i + 2]?.value === 'meta'
    ) {
      edits.push({ start: t.start, end: sig[i + 2].end, text: '({})' });
      i += 2;
      continue;
    }

    if (depth !== 0 || t.kind !== 'word') continue;

    // Static top-level `import` statement (skip dynamic `import(...)`)
    if (t.value === 'import' && sig[i + 1]?.value !== '(' && sig[i + 1]?.value !== '.') {
      let j = i + 1;
      let localDepth = 0;
      while (j < sig.length) {
        const cur = sig[j];
        if (cur.value === '{' || cur.value === '(') localDepth++;
        else if (cur.value === '}' || cur.value === ')') localDepth = Math.max(0, localDepth - 1);
        if (localDepth === 0 && cur.kind === 'string') {
          if (sig[j + 1]?.value === ';') j++;
          break;
        }
        if (localDepth === 0 && cur.value === ';') break;
        j++;
      }
      const endTok = sig[Math.min(j, sig.length - 1)];
      const nlCount = (code.slice(t.start, endTok.end).match(/\n/g) || []).length;
      edits.push({ start: t.start, end: endTok.end, text: 'void 0;' + '\n'.repeat(nlCount) });
      i = j;
      continue;
    }

    // Static top-level `export` statement
    if (t.value === 'export') {
      const next = sig[i + 1];
      if (!next) continue;

      if (next.value === 'default') {
        edits.push({ start: t.start, end: next.end, text: 'void' });
        i += 1;
      } else if (next.value === '{' || next.value === '*') {
        let j = i + 1;
        let localDepth = 0;
        while (j < sig.length) {
          const cur = sig[j];
          if (cur.value === '{' || cur.value === '(') localDepth++;
          else if (cur.value === '}' || cur.value === ')') {
            localDepth = Math.max(0, localDepth - 1);
            if (localDepth === 0 && sig[j + 1]?.value !== 'from' && sig[j + 1]?.value !== ';') {
              break;
            }
          }
          if (localDepth === 0 && cur.kind === 'string') {
            if (sig[j + 1]?.value === ';') j++;
            break;
          }
          if (localDepth === 0 && cur.value === ';') break;
          j++;
        }
        const endTok = sig[Math.min(j, sig.length - 1)];
        const nlCount = (code.slice(t.start, endTok.end).match(/\n/g) || []).length;
        edits.push({ start: t.start, end: endTok.end, text: 'void 0;' + '\n'.repeat(nlCount) });
        i = j;
      } else if (
        ['const', 'let', 'var', 'function', 'async', 'class'].includes(next.value)
      ) {
        edits.push({ start: t.start, end: t.end, text: '' });
      }
    }
  }

  if (edits.length === 0) return code;
  let result = '';
  let cursor = 0;
  for (const e of edits) {
    result += code.slice(cursor, e.start) + e.text;
    cursor = e.end;
  }
  return result + code.slice(cursor);
}

function extractJsErrorLine(
  err: any,
  normalized: string,
  originalTokens: JsToken[]
): { line: number; column: number } {
  if (typeof err?.lineNumber === 'number') {
    return {
      line: Math.max(1, err.lineNumber - 2),
      column: typeof err.columnNumber === 'number' ? err.columnNumber : 1
    };
  }
  const totalLines = normalized.split(/\r?\n/).length;
  const stack: string = typeof err?.stack === 'string' ? err.stack : '';
  const match = /<anonymous>:(\d+):(\d+)/.exec(stack);
  if (match) {
    const rawLine = Number(match[1]);
    return {
      line: Math.max(1, Math.min(totalLines, rawLine - 2)),
      column: Number(match[2]) || 1
    };
  }

  // Isolate the failing top-level statement so errors inside multi-line chunks report an accurate line
  const normTokens = tokenizeJs(normalized).tokens.filter(
    t => t.kind !== 'comment-line' && t.kind !== 'comment-block'
  );
  let depth = 0;
  let stmtStartLine = 1;
  let stmtStartIdx = 0;

  const findTokenInRange = (startLine: number, endLine: number): { line: number; column: number } => {
    const tokenMatch = /Unexpected (?:identifier|token|string|number)\s+'([^']+)'/.exec(
      err?.message || ''
    );
    if (tokenMatch) {
      const target = tokenMatch[1];
      const hit = originalTokens.find(
        t => t.line >= startLine && t.line <= endLine && t.value === target
      );
      if (hit) return { line: hit.line, column: hit.column };
    }
    const firstOnLine = originalTokens.find(t => t.line >= startLine);
    return firstOnLine
      ? { line: firstOnLine.line, column: firstOnLine.column }
      : { line: startLine, column: 1 };
  };

  for (let i = 0; i < normTokens.length; i++) {
    const t = normTokens[i];
    if (i === stmtStartIdx) {
      stmtStartLine = t.line;
    }
    if (t.kind === 'punct') {
      if (t.value === '{' || t.value === '(' || t.value === '[') depth++;
      else if (t.value === '}' || t.value === ')' || t.value === ']') depth = Math.max(0, depth - 1);
    }

    const isStmtBoundary =
      depth === 0 && (t.value === ';' || (t.value === '}' && normTokens[i + 1]?.value !== ';'));
    const isLast = i === normTokens.length - 1;
    if (isStmtBoundary || isLast) {
      const sliceStart = normTokens[stmtStartIdx].start;
      const slice = normalized.slice(sliceStart, t.end);
      try {
        new AsyncFunction(slice);
      } catch {
        return findTokenInRange(stmtStartLine, t.line);
      }
      stmtStartIdx = i + 1;
    }
  }

  return findTokenInRange(1, totalLines);
}

// =============================================================================
// JSON Formatter, Minifier, and Validator
// =============================================================================

function formatJsonChunk(code: string, indentUnit: string): string {
  return JSON.stringify(JSON.parse(code), null, indentUnit.length);
}

function minifyJsonChunk(code: string): string {
  return JSON.stringify(JSON.parse(code));
}

function validateJsonChunk(code: string): ChunkValidationError[] {
  try {
    JSON.parse(code);
    return [];
  } catch (err: any) {
    const message = err?.message || 'Invalid JSON syntax';
    const lineColMatch = /line\s+(\d+)\s+column\s+(\d+)/i.exec(message);
    if (lineColMatch) {
      return [{
        message,
        line: Number(lineColMatch[1]),
        column: Number(lineColMatch[2])
      }];
    }
    const posMatch = /position\s+(\d+)/i.exec(message);
    if (posMatch) {
      const { line, column } = offsetToLineCol(code, Number(posMatch[1]));
      return [{ message, line, column }];
    }
    return [{ message, line: 1, column: 1 }];
  }
}

// =============================================================================
// CSS Formatter, Minifier, and Validator
// =============================================================================

function formatCssChunk(code: string, indentUnit: string): string {
  const out: string[] = [];
  let indent = 0;
  let i = 0;
  const len = code.length;

  const pushIndent = () => out.push(indentUnit.repeat(Math.max(0, indent)));
  const trimTrailingSpaces = () => {
    while (out.length > 0 && out[out.length - 1] === ' ') out.pop();
  };
  const ensureNewline = () => {
    trimTrailingSpaces();
    if (out.length > 0 && out[out.length - 1] !== '\n') out.push('\n');
  };

  while (i < len) {
    const ch = code[i];

    if (/\s/.test(ch)) {
      while (i < len && /\s/.test(code[i])) i++;
      if (out.length > 0 && out[out.length - 1] !== '\n' && out[out.length - 1] !== ' ') {
        out.push(' ');
      }
      continue;
    }

    if (ch === '/' && code[i + 1] === '*') {
      const start = i;
      i += 2;
      while (i < len && !(code[i] === '*' && code[i + 1] === '/')) i++;
      i = Math.min(len, i + 2);
      if (out.length > 0 && out[out.length - 1] === '\n') pushIndent();
      out.push(code.slice(start, i));
      ensureNewline();
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      const start = i++;
      while (i < len) {
        if (code[i] === '\\') { i += 2; continue; }
        if (code[i] === quote) { i++; break; }
        i++;
      }
      if (out.length > 0 && out[out.length - 1] === '\n') pushIndent();
      out.push(code.slice(start, i));
      continue;
    }

    if (ch === '{') {
      if (out.length > 0 && out[out.length - 1] === '\n') pushIndent();
      else if (out.length > 0 && out[out.length - 1] !== ' ') out.push(' ');
      out.push('{');
      indent++;
      ensureNewline();
      i++;
      continue;
    }

    if (ch === '}') {
      indent = Math.max(0, indent - 1);
      ensureNewline();
      pushIndent();
      out.push('}');
      ensureNewline();
      if (indent === 0) out.push('\n');
      i++;
      continue;
    }

    if (ch === ';') {
      trimTrailingSpaces();
      out.push(';');
      ensureNewline();
      i++;
      continue;
    }

    if (ch === ':' && indent > 0) {
      trimTrailingSpaces();
      out.push(': ');
      i++;
      while (i < len && code[i] === ' ') i++;
      continue;
    }

    if (out.length > 0 && out[out.length - 1] === '\n') pushIndent();
    out.push(ch);
    i++;
  }

  return out.join('').replace(/\n{3,}/g, '\n\n').trim();
}

function minifyCssChunk(code: string): string {
  const out: string[] = [];
  let i = 0;
  const len = code.length;

  while (i < len) {
    const ch = code[i];

    if (ch === '/' && code[i + 1] === '*') {
      i += 2;
      while (i < len && !(code[i] === '*' && code[i + 1] === '/')) i++;
      i = Math.min(len, i + 2);
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      const start = i++;
      while (i < len) {
        if (code[i] === '\\') { i += 2; continue; }
        if (code[i] === quote) { i++; break; }
        i++;
      }
      out.push(code.slice(start, i));
      continue;
    }

    if (/\s/.test(ch)) {
      while (i < len && /\s/.test(code[i])) i++;
      const prev = out[out.length - 1];
      const next = code[i];
      if (prev && next && !/[{}:;,>+~()]/.test(prev) && !/[{}:;,>+~()]/.test(next)) {
        out.push(' ');
      }
      continue;
    }

    if (ch === '}' && out[out.length - 1] === ';') {
      out.pop();
    }

    out.push(ch);
    i++;
  }

  return out.join('').trim();
}

function validateCssChunk(code: string): ChunkValidationError[] {
  const errors: ChunkValidationError[] = [];
  const stack: { ch: string; expected: string; line: number; column: number }[] = [];
  const len = code.length;
  let i = 0;
  let line = 1;
  let col = 1;
  let blockStartLine = 1;
  let blockStartCol = 1;
  let currentDeclText = '';

  const advance = (count = 1) => {
    for (let k = 0; k < count && i < len; k++) {
      if (code[i] === '\n') { line++; col = 1; } else { col++; }
      i++;
    }
  };

  while (i < len) {
    const ch = code[i];

    if (ch === '/' && code[i + 1] === '*') {
      const cLine = line;
      const cCol = col;
      advance(2);
      let closed = false;
      while (i < len) {
        if (code[i] === '*' && code[i + 1] === '/') {
          advance(2);
          closed = true;
          break;
        }
        advance(1);
      }
      if (!closed) {
        return [{ message: 'Unterminated CSS comment (/* ... */)', line: cLine, column: cCol }];
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      const sLine = line;
      const sCol = col;
      const quote = ch;
      advance(1);
      let closed = false;
      while (i < len) {
        if (code[i] === '\\') { advance(i + 1 < len ? 2 : 1); continue; }
        if (code[i] === '\n') break;
        if (code[i] === quote) { advance(1); closed = true; break; }
        advance(1);
      }
      if (!closed) {
        return [{ message: `Unterminated CSS string (${quote}...${quote})`, line: sLine, column: sCol }];
      }
      currentDeclText += quote;
      continue;
    }

    if (ch === '{' || ch === '(' || ch === '[') {
      if (ch === '{') currentDeclText = '';
      stack.push({
        ch,
        expected: ch === '{' ? '}' : ch === '(' ? ')' : ']',
        line,
        column: col
      });
      if (stack.length > 0 && ch === '{') {
        blockStartLine = line;
        blockStartCol = col;
      }
      advance(1);
      continue;
    }

    if (ch === '}' || ch === ')' || ch === ']') {
      const top = stack.pop();
      if (!top) {
        return [{ message: `Unexpected '${ch}' in CSS`, line, column: col }];
      }
      if (top.expected !== ch) {
        return [{
          message: `Mismatched '${ch}': expected '${top.expected}' for '${top.ch}' at Line ${top.line}, Col ${top.column}`,
          line,
          column: col
        }];
      }
      if (ch === '}') {
        const trimmed = currentDeclText.trim();
        if (trimmed && !trimmed.startsWith('@') && !trimmed.includes(':')) {
          errors.push({
            message: `CSS declaration "${trimmed}" is missing ':'`,
            line: blockStartLine,
            column: blockStartCol
          });
        }
        currentDeclText = '';
      }
      advance(1);
      continue;
    }

    if (ch === ';') {
      const insideRuleBlock = stack.some(s => s.ch === '{') && !stack.some(s => s.ch === '(');
      const trimmed = currentDeclText.trim();
      if (insideRuleBlock && trimmed && !trimmed.startsWith('@') && !trimmed.includes(':')) {
        errors.push({
          message: `CSS declaration "${trimmed}" is missing ':'`,
          line,
          column: col
        });
      }
      currentDeclText = '';
      advance(1);
      continue;
    }

    if (stack.some(s => s.ch === '{') && !stack.some(s => s.ch === '(')) {
      if (!currentDeclText.trim() && !/\s/.test(ch)) {
        blockStartLine = line;
        blockStartCol = col;
      }
      currentDeclText += ch;
    }

    advance(1);
  }

  if (stack.length > 0) {
    const unclosed = stack[stack.length - 1];
    errors.unshift({
      message: `Unclosed '${unclosed.ch}' in CSS — expected '${unclosed.expected}'`,
      line: unclosed.line,
      column: unclosed.column
    });
  }

  return errors;
}

// =============================================================================
// HTML Formatter, Minifier, and Validator
// =============================================================================

function formatHtmlChunk(code: string, indentUnit: string): string {
  const tokens = code.replace(/>\s+</g, '><').split(/(<[^>]+>)/g).filter(Boolean);
  const lines: string[] = [];
  let indent = 0;

  for (const token of tokens) {
    const trimmed = token.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('</')) {
      indent = Math.max(0, indent - 1);
      lines.push(indentUnit.repeat(indent) + trimmed);
    } else if (trimmed.startsWith('<!') || trimmed.startsWith('<?')) {
      lines.push(indentUnit.repeat(indent) + trimmed);
    } else if (trimmed.startsWith('<')) {
      const tagMatch = /^<([a-zA-Z0-9-]+)/.exec(trimmed);
      const tagName = tagMatch ? tagMatch[1].toLowerCase() : '';
      const selfClosing = trimmed.endsWith('/>') || VOID_HTML_TAGS.has(tagName);
      lines.push(indentUnit.repeat(indent) + trimmed);
      if (!selfClosing) indent++;
    } else {
      lines.push(indentUnit.repeat(indent) + trimmed);
    }
  }

  return lines.join('\n').trim();
}

function minifyHtmlChunk(code: string): string {
  return code
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function validateHtmlChunk(code: string): ChunkValidationError[] {
  const tagStack: { tag: string; line: number; column: number }[] = [];
  const len = code.length;
  let i = 0;

  while (i < len) {
    const lt = code.indexOf('<', i);
    if (lt === -1) break;

    const { line, column } = offsetToLineCol(code, lt);

    // HTML Comment
    if (code.startsWith('<!--', lt)) {
      const endComment = code.indexOf('-->', lt + 4);
      if (endComment === -1) {
        return [{ message: 'Unterminated HTML comment (<!-- ... -->)', line, column }];
      }
      i = endComment + 3;
      continue;
    }

    // Doctype / Processing Instruction / CDATA
    if (code.startsWith('<!', lt) || code.startsWith('<?', lt)) {
      const gt = code.indexOf('>', lt + 2);
      if (gt === -1) {
        return [{ message: 'Unclosed markup declaration', line, column }];
      }
      i = gt + 1;
      continue;
    }

    // Scan tag until unquoted '>'
    let j = lt + 1;
    let quote: string | null = null;
    while (j < len) {
      const ch = code[j];
      if (quote) {
        if (ch === quote) quote = null;
      } else {
        if (ch === '"' || ch === "'") quote = ch;
        else if (ch === '>') break;
        else if (ch === '<') {
          const badPos = offsetToLineCol(code, j);
          return [{ message: "Unexpected '<' inside HTML tag", line: badPos.line, column: badPos.column }];
        }
      }
      j++;
    }

    if (quote) {
      return [{ message: `Unterminated attribute quote (${quote}) in HTML tag`, line, column }];
    }
    if (j >= len) {
      return [{ message: "Unclosed '<' tag in HTML", line, column }];
    }

    const rawTag = code.slice(lt + 1, j).trim();
    i = j + 1;

    if (!rawTag) {
      return [{ message: 'Empty "<>" tag in HTML', line, column }];
    }

    if (rawTag.startsWith('/')) {
      const closeName = rawTag.slice(1).trim().toLowerCase();
      if (!closeName) {
        return [{ message: 'Empty closing tag "</>" in HTML', line, column }];
      }
      if (VOID_HTML_TAGS.has(closeName)) continue;
      const top = tagStack.pop();
      if (!top) {
        return [{ message: `Unexpected closing tag </${closeName}> with no matching opener`, line, column }];
      }
      if (top.tag !== closeName) {
        return [{
          message: `Mismatched closing tag </${closeName}>: expected </${top.tag}> (opened at Line ${top.line}, Col ${top.column})`,
          line,
          column
        }];
      }
    } else {
      const nameMatch = /^([a-zA-Z0-9-]+)/.exec(rawTag);
      if (!nameMatch) {
        return [{ message: `Invalid HTML tag "<${rawTag}>"`, line, column }];
      }
      const tagName = nameMatch[1].toLowerCase();
      const selfClosing = rawTag.endsWith('/') || VOID_HTML_TAGS.has(tagName);

      if (tagName === 'script' || tagName === 'style') {
        if (!selfClosing) {
          const closeRe = new RegExp(`</${tagName}\\s*>`, 'i');
          const rest = code.slice(i);
          const m = closeRe.exec(rest);
          if (!m) {
            return [{ message: `Unclosed <${tagName}> element`, line, column }];
          }
          i += m.index + m[0].length;
        }
        continue;
      }

      if (!selfClosing) {
        tagStack.push({ tag: tagName, line, column });
      }
    }
  }

  if (tagStack.length > 0) {
    const unclosed = tagStack[tagStack.length - 1];
    return [{
      message: `Unclosed <${unclosed.tag}> tag — expected </${unclosed.tag}>`,
      line: unclosed.line,
      column: unclosed.column
    }];
  }

  return [];
}
