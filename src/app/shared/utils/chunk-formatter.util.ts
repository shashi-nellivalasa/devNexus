export type ChunkLanguage = 'auto' | 'javascript' | 'css' | 'html' | 'json';
export type ResolvedChunkLanguage = Exclude<ChunkLanguage, 'auto'>;

export interface ChunkFormatOptions {
  language: ChunkLanguage;
  indentSize: number;
}

export interface ChunkFormatResult {
  formatted: string;
  detectedLanguage: ResolvedChunkLanguage;
  originalLines: number;
  formattedLines: number;
  originalBytes: number;
  formattedBytes: number;
}

/**
 * Detects the most likely language of a minified build chunk.
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
      // Not valid JSON; likely a JS block or array expression
    }
  }

  if (/^<!doctype\s+html/i.test(trimmed) || /^<[a-z][\w-]*(\s|>)/i.test(trimmed)) {
    return 'html';
  }

  const hasJsSignals =
    /\b(function|const|let|var|import|export|return|class|new|typeof|switch|case)\b/.test(
      trimmed.slice(0, 1500)
    ) || trimmed.includes('=>');

  const hasCssSignals =
    /^(@charset|@import|@media|@keyframes|@font-face|:root|\.[a-z_-]|#[a-z_-])/i.test(trimmed) ||
    (!hasJsSignals && /\{[^}]*:[^{};]+;[^}]*\}/.test(trimmed.slice(0, 1500)));

  if (hasCssSignals && !hasJsSignals) {
    return 'css';
  }

  return 'javascript';
}

/**
 * Formats a minified JS, CSS, HTML, or JSON chunk into readable indented source.
 */
export function formatChunk(code: string, options: ChunkFormatOptions): ChunkFormatResult {
  const indentUnit = ' '.repeat(Math.max(1, options.indentSize || 2));
  const resolved =
    options.language === 'auto' ? detectChunkLanguage(code) : options.language;

  let formatted = '';
  switch (resolved) {
    case 'json':
      formatted = formatJsonChunk(code, indentUnit);
      break;
    case 'css':
      formatted = formatCssChunk(code, indentUnit);
      break;
    case 'html':
      formatted = formatHtmlChunk(code, indentUnit);
      break;
    case 'javascript':
    default:
      formatted = formatJsChunk(code, indentUnit);
      break;
  }

  const encoder = new TextEncoder();
  return {
    formatted,
    detectedLanguage: resolved,
    originalLines: code ? code.split(/\r?\n/).length : 0,
    formattedLines: formatted ? formatted.split(/\r?\n/).length : 0,
    originalBytes: encoder.encode(code).length,
    formattedBytes: encoder.encode(formatted).length
  };
}

function formatJsonChunk(code: string, indentUnit: string): string {
  const parsed = JSON.parse(code);
  return JSON.stringify(parsed, null, indentUnit.length);
}

/**
 * Lightweight tokenizer-based prettifier for minified JavaScript / ES module chunks.
 * Preserves strings, template literals, comments, and regex literals intact.
 */
function formatJsChunk(code: string, indentUnit: string): string {
  const out: string[] = [];
  let indent = 0;
  let parenDepth = 0;
  let inForHeader = false;
  let forParenDepth = 0;
  let lastNonWsToken = '';

  const pushIndent = () => {
    out.push(indentUnit.repeat(Math.max(0, indent)));
  };

  const trimTrailingSpaces = () => {
    while (out.length > 0 && (out[out.length - 1] === ' ' || out[out.length - 1] === '\t')) {
      out.pop();
    }
  };

  const ensureNewline = () => {
    trimTrailingSpaces();
    if (out.length > 0 && out[out.length - 1] !== '\n') {
      out.push('\n');
    }
  };

  const canStartRegex = (prev: string): boolean => {
    if (!prev) return true;
    return /^[(\[{,;:=!&|?+\-*%~^<>]$/.test(prev) ||
      ['return', 'case', 'throw', 'typeof', 'void', 'delete', 'in', 'of', 'new', 'else', 'yield', 'await'].includes(prev);
  };

  const len = code.length;
  let i = 0;

  while (i < len) {
    const ch = code[i];

    // Whitespace: collapse runs into single space or skip after newline
    if (/\s/.test(ch)) {
      while (i < len && /\s/.test(code[i])) i++;
      const prevOut = out[out.length - 1];
      if (out.length > 0 && prevOut !== '\n' && prevOut !== ' ' && prevOut !== '(' && prevOut !== '[') {
        out.push(' ');
      }
      continue;
    }

    // Single-line comment
    if (ch === '/' && code[i + 1] === '/') {
      const start = i;
      i += 2;
      while (i < len && code[i] !== '\n') i++;
      if (out.length > 0 && out[out.length - 1] === '\n') pushIndent();
      out.push(code.slice(start, i));
      ensureNewline();
      continue;
    }

    // Block comment
    if (ch === '/' && code[i + 1] === '*') {
      const start = i;
      i += 2;
      while (i < len && !(code[i] === '*' && code[i + 1] === '/')) i++;
      i = Math.min(len, i + 2);
      if (out.length > 0 && out[out.length - 1] === '\n') pushIndent();
      out.push(code.slice(start, i));
      if (code[i] !== ';' && code[i] !== ',') {
        ensureNewline();
      }
      continue;
    }

    // String / template literals
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      const start = i++;
      while (i < len) {
        if (code[i] === '\\') {
          i += 2;
          continue;
        }
        if (code[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      if (out.length > 0 && out[out.length - 1] === '\n') pushIndent();
      out.push(code.slice(start, i));
      lastNonWsToken = quote;
      continue;
    }

    // Regex literal
    if (ch === '/' && canStartRegex(lastNonWsToken)) {
      const start = i++;
      let inClass = false;
      while (i < len) {
        const rc = code[i];
        if (rc === '\\') {
          i += 2;
          continue;
        }
        if (rc === '[') inClass = true;
        else if (rc === ']') inClass = false;
        else if (rc === '/' && !inClass) {
          i++;
          break;
        } else if (rc === '\n') {
          break;
        }
        i++;
      }
      while (i < len && /[a-z]/i.test(code[i])) i++;
      if (out.length > 0 && out[out.length - 1] === '\n') pushIndent();
      out.push(code.slice(start, i));
      lastNonWsToken = '/';
      continue;
    }

    // Identifiers & keywords
    if (/[a-zA-Z_$]/.test(ch)) {
      const start = i;
      while (i < len && /[a-zA-Z0-9_$]/.test(code[i])) i++;
      const word = code.slice(start, i);
      if (out.length > 0 && out[out.length - 1] === '\n') pushIndent();
      out.push(word);
      if (word === 'for') {
        inForHeader = true;
        forParenDepth = parenDepth;
      }
      lastNonWsToken = word;
      continue;
    }

    // Numbers
    if (/[0-9]/.test(ch)) {
      const start = i;
      while (i < len && /[0-9a-fA-FxXoObBn._eE+-]/.test(code[i])) {
        if ((code[i] === '+' || code[i] === '-') && !/[eE]/.test(code[i - 1] || '')) break;
        i++;
      }
      if (out.length > 0 && out[out.length - 1] === '\n') pushIndent();
      out.push(code.slice(start, i));
      lastNonWsToken = '0';
      continue;
    }

    // Punctuation
    if (ch === '(') {
      parenDepth++;
      if (out.length > 0 && out[out.length - 1] === '\n') pushIndent();
      out.push('(');
      lastNonWsToken = '(';
      i++;
      continue;
    }

    if (ch === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      if (inForHeader && parenDepth === forParenDepth) {
        inForHeader = false;
      }
      if (out.length > 0 && out[out.length - 1] === '\n') pushIndent();
      trimTrailingSpaces();
      out.push(')');
      lastNonWsToken = ')';
      i++;
      continue;
    }

    if (ch === '{') {
      if (out.length > 0 && out[out.length - 1] === '\n') {
        pushIndent();
      } else if (out.length > 0 && out[out.length - 1] !== ' ') {
        out.push(' ');
      }
      out.push('{');
      indent++;
      ensureNewline();
      lastNonWsToken = '{';
      i++;
      continue;
    }

    if (ch === '}') {
      indent = Math.max(0, indent - 1);
      ensureNewline();
      pushIndent();
      out.push('}');
      // Look ahead to see if followed by ; , ) else catch finally
      let j = i + 1;
      while (j < len && /\s/.test(code[j])) j++;
      const next = code[j];
      const nextWord = code.slice(j, j + 7);
      if (
        next !== ';' &&
        next !== ',' &&
        next !== ')' &&
        next !== '.' &&
        !/^(else|catch|finally)\b/.test(nextWord)
      ) {
        ensureNewline();
      } else if (/^(else|catch|finally)\b/.test(nextWord)) {
        out.push(' ');
      }
      lastNonWsToken = '}';
      i++;
      continue;
    }

    if (ch === ';') {
      trimTrailingSpaces();
      out.push(';');
      if (inForHeader) {
        out.push(' ');
      } else {
        ensureNewline();
      }
      lastNonWsToken = ';';
      i++;
      continue;
    }

    if (ch === ',') {
      trimTrailingSpaces();
      out.push(',');
      // Break lines at top-level or inside object literals (parenDepth === 0)
      if (parenDepth === 0 && indent > 0) {
        ensureNewline();
      } else {
        out.push(' ');
      }
      lastNonWsToken = ',';
      i++;
      continue;
    }

    if (out.length > 0 && out[out.length - 1] === '\n') pushIndent();
    out.push(ch);
    lastNonWsToken = ch;
    i++;
  }

  return out
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Formats minified CSS into multi-line indented rules.
 */
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

/**
 * Formats minified HTML into indented tag lines.
 */
function formatHtmlChunk(code: string, indentUnit: string): string {
  const voidTags = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr'
  ]);
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
      const selfClosing = trimmed.endsWith('/>') || voidTags.has(tagName);
      lines.push(indentUnit.repeat(indent) + trimmed);
      if (!selfClosing) indent++;
    } else {
      lines.push(indentUnit.repeat(indent) + trimmed);
    }
  }

  return lines.join('\n').trim();
}
