export type ExportRounding = 'integer' | 'float';
export type EsignProvider = 'all' | 'nsdl' | 'emudhra' | 'digio' | 'cdsl' | 'leegality' | 'cvl';

/** Zone.js replaces native Promise with ZoneAwarePromise which may lack ES2025 Promise.try used by pdfjs-dist v5. */
export function ensurePromiseTryPolyfill(): void {
  const ctor = Promise as PromiseConstructor & {
    try?: <T>(fn: (...args: unknown[]) => T | PromiseLike<T>, ...args: unknown[]) => Promise<T>;
  };
  if (typeof ctor.try !== 'function') {
    ctor.try = <T>(fn: (...args: unknown[]) => T | PromiseLike<T>, ...args: unknown[]): Promise<T> => {
      try {
        return Promise.resolve(fn(...args));
      } catch (err) {
        return Promise.reject(err);
      }
    };
  }
}

export interface EsignProviderOption {
  id: EsignProvider;
  label: string;
  formatHint: string;
  placeholder: string;
}

export const ESIGN_PROVIDER_OPTIONS: readonly EsignProviderOption[] = [
  {
    id: 'all',
    label: 'All Providers',
    formatHint: 'Outputs NSDL, eMudhra, Digio, CDSL, Leegality & CVL together',
    placeholder: 'e.g. 1,390,739,164,60; or 10-411,22,44,150; or Digio JSON'
  },
  {
    id: 'nsdl',
    label: 'NSDL (Protean)',
    formatHint: 'page-x,y,height,width; (right-mirrored X, bottom-left Y)',
    placeholder: 'e.g. 10-411,22,44,150;11-65,440,50,150;'
  },
  {
    id: 'emudhra',
    label: 'eMudhra',
    formatHint: 'page,llx,lly,urx,ury; (left-edge X, bottom-left Y)',
    placeholder: 'e.g. 10,34,22,184,66;11,380,440,530,490;'
  },
  {
    id: 'cvl',
    label: 'CVL',
    formatHint: 'page,x,y,width,height; (top-left origin: x from left, y from top)',
    placeholder: 'e.g. 1,390,739,164,60;'
  },
  {
    id: 'digio',
    label: 'Digio',
    formatHint: 'sign_coordinates JSON { signer: { page: [{ llx, lly, urx, ury }] } }',
    placeholder: 'e.g. {"1":[{"llx":34,"lly":22,"urx":184,"ury":66}]}'
  },
  {
    id: 'cdsl',
    label: 'CDSL',
    formatHint: 'page:llx,lly,urx,ury; (standard bottom-left PDF bounds)',
    placeholder: 'e.g. 10:34,22,184,66;11:380,440,530,490;'
  },
  {
    id: 'leegality',
    label: 'Leegality',
    formatHint: 'signatureCoordinates JSON [{ pageNumber, xcoordinate, ycoordinate, width, height }]',
    placeholder: 'e.g. [{"pageNumber":1,"xcoordinate":34,"ycoordinate":22,"width":150,"height":44}]'
  }
] as const;

export interface PdfRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PdfDocumentMeta {
  documentName: string;
  pageCount: number;
  fileSizeBytes: number;
}

export interface PdfPageInfo {
  pageNumber: number;
  originX: number;
  originY: number;
  pdfWidth: number;
  pdfHeight: number;
  rotation: number;
  renderedWidth: number;
  renderedHeight: number;
  scale: number;
  devicePixelRatio: number;
}

export interface CoordinateTransformInput {
  pdfWidth: number;
  pdfHeight: number;
  cssWidth: number;
  cssHeight: number;
  originX?: number;
  originY?: number;
  rotation?: number;
}

export interface Signer {
  id: number;
  name: string;
  color: string;
}

export interface SignatureBox {
  id: string;
  signerId: number;
  page: number;
  pdf: PdfRect;
  createdAt: number;
  order: number;
}

export interface ValidationIssue {
  boxId: string;
  severity: 'error' | 'warning';
  code: 'negative' | 'outside' | 'exceeds' | 'overlap';
  message: string;
}

export interface ParsedNsdlToken {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  nsdlX: number;
}

export interface ExportSignatureDebug {
  signerId: number;
  signerName: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  nsdlX: number;
}

export interface SignatureExportData {
  documentName: string;
  pageCount: number;
  nsdlCoordinates: string;
  perSignerCoordinates: Record<number, string>;
  emudhraCoordinates: string;
  perSignerEmudhra: Record<number, string>;
  cvlCoordinates: string;
  perSignerCvl: Record<number, string>;
  digioCoordinates: Record<string, Record<string, Array<{ llx: number; lly: number; urx: number; ury: number }>>>;
  cdslCoordinates: string;
  leegalityCoordinates: Array<{
    pageNumber: number;
    signerName: string;
    xcoordinate: number;
    ycoordinate: number;
    width: number;
    height: number;
  }>;
  signatures: ExportSignatureDebug[];
}

export type PageWidthLookup = (page: number) => number;
export type PageHeightLookup = (page: number) => number;

export const DEFAULT_SIGNER_NAMES: readonly string[] = [
  'Applicant',
  'Joint Holder 1',
  'Joint Holder 2',
  'Witness',
  'Director'
] as const;

export const SIGNER_COLORS: readonly string[] = [
  '#0d6efd',
  '#198754',
  '#dc3545',
  '#fd7e14',
  '#6f42c1'
] as const;

const NSDL_TOKEN_RE = /^(\d+)-(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/;

export function transformInputFromPage(page: PdfPageInfo): CoordinateTransformInput {
  return {
    pdfWidth: page.pdfWidth,
    pdfHeight: page.pdfHeight,
    cssWidth: page.renderedWidth,
    cssHeight: page.renderedHeight,
    originX: page.originX,
    originY: page.originY,
    rotation: page.rotation
  };
}

/** Convert CSS overlay rectangle (top-left origin) to PDF points (bottom-left origin). */
export function screenToPdf(screen: ScreenRect, input: CoordinateTransformInput): PdfRect {
  const { pdfWidth, pdfHeight, cssWidth, cssHeight } = input;
  const originX = input.originX ?? 0;
  const originY = input.originY ?? 0;
  if (cssWidth <= 0 || cssHeight <= 0) {
    return { x: originX, y: originY, width: 0, height: 0 };
  }

  const sx = pdfWidth / cssWidth;
  const sy = pdfHeight / cssHeight;
  return {
    x: originX + screen.left * sx,
    y: originY + pdfHeight - (screen.top + screen.height) * sy,
    width: screen.width * sx,
    height: screen.height * sy
  };
}

/** Convert PDF points (bottom-left origin) to CSS overlay rectangle (top-left origin). */
export function pdfToScreen(pdf: PdfRect, input: CoordinateTransformInput): ScreenRect {
  const { pdfWidth, pdfHeight, cssWidth, cssHeight } = input;
  const originX = input.originX ?? 0;
  const originY = input.originY ?? 0;
  if (pdfWidth <= 0 || pdfHeight <= 0) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }

  const sx = cssWidth / pdfWidth;
  const sy = cssHeight / pdfHeight;
  return {
    left: (pdf.x - originX) * sx,
    top: (originY + pdfHeight - pdf.y - pdf.height) * sy,
    width: pdf.width * sx,
    height: pdf.height * sy
  };
}

/** Convert a CSS click point on a rendered page to PDF user-space point. */
export function cssPointToPdfPoint(
  cssX: number,
  cssY: number,
  input: CoordinateTransformInput
): { x: number; y: number } {
  const originX = input.originX ?? 0;
  const originY = input.originY ?? 0;
  const sx = input.pdfWidth / input.cssWidth;
  const sy = input.pdfHeight / input.cssHeight;
  return {
    x: originX + cssX * sx,
    y: originY + input.pdfHeight - cssY * sy
  };
}

export function clampToPage(
  pdf: PdfRect,
  pdfWidth: number,
  pdfHeight: number,
  originX = 0,
  originY = 0
): PdfRect {
  const width = Math.min(Math.max(pdf.width, 1), pdfWidth);
  const height = Math.min(Math.max(pdf.height, 1), pdfHeight);
  const x = Math.min(Math.max(pdf.x, originX), originX + pdfWidth - width);
  const y = Math.min(Math.max(pdf.y, originY), originY + pdfHeight - height);
  return { x, y, width, height };
}

export function roundCoordinate(value: number, step: number, origin = 0): number {
  if (step <= 0 || !Number.isFinite(value)) {
    return value;
  }
  const snapped = origin + Math.round((value - origin) / step) * step;
  return Number(snapped.toFixed(4));
}

export function snapPdf(pdf: PdfRect, snapSize: number, originX = 0, originY = 0): PdfRect {
  if (snapSize <= 0) {
    return pdf;
  }
  return {
    x: roundCoordinate(pdf.x, snapSize, originX),
    y: roundCoordinate(pdf.y, snapSize, originY),
    width: Math.max(snapSize, roundCoordinate(pdf.width, snapSize, 0)),
    height: Math.max(snapSize, roundCoordinate(pdf.height, snapSize, 0))
  };
}

function fitsPage(pdf: PdfRect, page: PdfPageInfo): boolean {
  const eps = 0.05;
  return (
    pdf.width > 0 &&
    pdf.height > 0 &&
    pdf.x >= page.originX - eps &&
    pdf.y >= page.originY - eps &&
    pdf.x + pdf.width <= page.originX + page.pdfWidth + eps &&
    pdf.y + pdf.height <= page.originY + page.pdfHeight + eps
  );
}

export function alignPdf(pdf: PdfRect, page: PdfPageInfo, step: number): PdfRect {
  if (step <= 0) {
    return clampToPage(pdf, page.pdfWidth, page.pdfHeight, page.originX, page.originY);
  }
  const clamped = clampToPage(
    snapPdf(pdf, step, page.originX, page.originY),
    page.pdfWidth,
    page.pdfHeight,
    page.originX,
    page.originY
  );
  const again = snapPdf(clamped, step, page.originX, page.originY);
  return fitsPage(again, page) ? again : clamped;
}

export function commitPdf(
  pdf: PdfRect,
  page: PdfPageInfo,
  opts: { snap: boolean; snapSize: number; integer: boolean }
): PdfRect {
  const step = opts.snap && opts.snapSize > 0 ? opts.snapSize : opts.integer ? 1 : 0;
  return alignPdf(pdf, page, step);
}

/** Convert NSDL wire X (from right edge) to PDF left-edge X. */
export function nsdlXToPdfX(nsdlX: number, width: number, pageWidth: number): number {
  return pageWidth - nsdlX - width;
}

/** Convert PDF left-edge X to NSDL wire X (from right edge). */
export function pdfXToNsdlX(pdfX: number, width: number, pageWidth: number): number {
  return pageWidth - pdfX - width;
}

function roundValue(value: number, rounding: ExportRounding): number {
  return rounding === 'float' ? value : Math.round(value);
}

function sortBoxes(boxes: SignatureBox[]): SignatureBox[] {
  return [...boxes].sort((a, b) => (a.page !== b.page ? a.page - b.page : a.order - b.order));
}

/** Serialize signature boxes into canonical NSDL wire format: `page-x,y,height,width;`. */
export function serializeNsdlBoxes(
  boxes: SignatureBox[],
  rounding: ExportRounding = 'integer',
  pageWidthOf: PageWidthLookup = () => 595
): string {
  if (boxes.length === 0) {
    return '';
  }
  return (
    sortBoxes(boxes)
      .map((b) => {
        const x = roundValue(b.pdf.x, rounding);
        const y = roundValue(b.pdf.y, rounding);
        const width = roundValue(b.pdf.width, rounding);
        const height = roundValue(b.pdf.height, rounding);
        const nsdlX = roundValue(pdfXToNsdlX(x, width, pageWidthOf(b.page)), rounding);
        return `${b.page}-${nsdlX},${y},${height},${width}`;
      })
      .join(';') + ';'
  );
}

/** Parse an NSDL coordinate string (`page-x,y,height,width;`) into PDF-space tokens. */
export function parseNsdlCoordinates(
  nsdl: string,
  pageWidthOf: PageWidthLookup = () => 595
): ParsedNsdlToken[] {
  const parts = nsdl
    .split(';')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  return parts.map((part) => {
    const match = NSDL_TOKEN_RE.exec(part);
    if (!match) {
      throw new Error(`Invalid NSDL coordinate token: "${part}"`);
    }
    const page = Number(match[1]);
    const nsdlX = Number(match[2]);
    const y = Number(match[3]);
    const height = Number(match[4]);
    const width = Number(match[5]);
    return {
      page,
      nsdlX,
      x: nsdlXToPdfX(nsdlX, width, pageWidthOf(page)),
      y,
      height,
      width
    };
  });
}

/** Serialize parsed NSDL tokens back into canonical NSDL wire format. */
export function serializeNsdlTokens(
  tokens: ParsedNsdlToken[],
  rounding: ExportRounding = 'integer',
  pageWidthOf: PageWidthLookup = () => 595
): string {
  if (tokens.length === 0) {
    return '';
  }
  return (
    [...tokens]
      .sort((a, b) => a.page - b.page)
      .map((t) => {
        const width = roundValue(t.width, rounding);
        const height = roundValue(t.height, rounding);
        const y = roundValue(t.y, rounding);
        const nsdlX = roundValue(pdfXToNsdlX(t.x, width, pageWidthOf(t.page)), rounding);
        return `${t.page}-${nsdlX},${y},${height},${width}`;
      })
      .join(';') + ';'
  );
}

/** Serialize signature boxes into eMudhra format: `page,llx,lly,urx,ury;`. */
export function serializeEmudhraBoxes(
  boxes: SignatureBox[],
  rounding: ExportRounding = 'integer'
): string {
  if (boxes.length === 0) {
    return '';
  }
  return (
    sortBoxes(boxes)
      .map((b) => {
        const llx = roundValue(b.pdf.x, rounding);
        const lly = roundValue(b.pdf.y, rounding);
        const urx = llx + roundValue(b.pdf.width, rounding);
        const ury = lly + roundValue(b.pdf.height, rounding);
        return `${b.page},${llx},${lly},${urx},${ury}`;
      })
      .join(';') + ';'
  );
}

/** Serialize signature boxes into CDSL format: `page:llx,lly,urx,ury;`. */
export function serializeCdslBoxes(
  boxes: SignatureBox[],
  rounding: ExportRounding = 'integer'
): string {
  if (boxes.length === 0) {
    return '';
  }
  return (
    sortBoxes(boxes)
      .map((b) => {
        const llx = roundValue(b.pdf.x, rounding);
        const lly = roundValue(b.pdf.y, rounding);
        const urx = llx + roundValue(b.pdf.width, rounding);
        const ury = lly + roundValue(b.pdf.height, rounding);
        return `${b.page}:${llx},${lly},${urx},${ury}`;
      })
      .join(';') + ';'
  );
}

/**
 * Serialize signature boxes into CVL wire format: `page,x,y,width,height;`.
 * Origin is top-left (`x` from left edge, `y` down from top edge of page).
 */
export function serializeCvlBoxes(
  boxes: SignatureBox[],
  rounding: ExportRounding = 'integer',
  pageHeightOf: PageHeightLookup = () => 842
): string {
  if (boxes.length === 0) {
    return '';
  }
  return (
    sortBoxes(boxes)
      .map((b) => {
        const x = roundValue(b.pdf.x, rounding);
        const width = roundValue(b.pdf.width, rounding);
        const height = roundValue(b.pdf.height, rounding);
        const topY = roundValue(pageHeightOf(b.page) - (b.pdf.y + b.pdf.height), rounding);
        return `${b.page},${x},${topY},${width},${height}`;
      })
      .join(';') + ';'
  );
}

/** Build Digio `sign_coordinates` object keyed by signer name then page number. */
export function buildDigioSignCoordinates(
  boxes: SignatureBox[],
  signers: Signer[],
  rounding: ExportRounding = 'integer'
): Record<string, Record<string, Array<{ llx: number; lly: number; urx: number; ury: number }>>> {
  const signerById = new Map(signers.map((s) => [s.id, s.name || `Signer ${s.id}`]));
  const result: Record<string, Record<string, Array<{ llx: number; lly: number; urx: number; ury: number }>>> = {};
  for (const b of sortBoxes(boxes)) {
    const key = signerById.get(b.signerId) ?? `Signer ${b.signerId}`;
    const pageKey = String(b.page);
    if (!result[key]) result[key] = {};
    if (!result[key][pageKey]) result[key][pageKey] = [];
    const llx = roundValue(b.pdf.x, rounding);
    const lly = roundValue(b.pdf.y, rounding);
    const urx = llx + roundValue(b.pdf.width, rounding);
    const ury = lly + roundValue(b.pdf.height, rounding);
    result[key][pageKey].push({ llx, lly, urx, ury });
  }
  return result;
}

/** Build Digio page map `{ "1": [{ llx, lly, urx, ury }] }` for a single signer. */
export function serializeDigioForSigner(
  boxes: SignatureBox[],
  rounding: ExportRounding = 'integer'
): string {
  if (boxes.length === 0) return '';
  const pages: Record<string, Array<{ llx: number; lly: number; urx: number; ury: number }>> = {};
  for (const b of sortBoxes(boxes)) {
    const pageKey = String(b.page);
    if (!pages[pageKey]) pages[pageKey] = [];
    const llx = roundValue(b.pdf.x, rounding);
    const lly = roundValue(b.pdf.y, rounding);
    const urx = llx + roundValue(b.pdf.width, rounding);
    const ury = lly + roundValue(b.pdf.height, rounding);
    pages[pageKey].push({ llx, lly, urx, ury });
  }
  return JSON.stringify(pages);
}

/** Build Leegality `signatureCoordinates` array. */
export function buildLeegalityCoordinates(
  boxes: SignatureBox[],
  signers: Signer[],
  rounding: ExportRounding = 'integer'
): Array<{
  pageNumber: number;
  signerName: string;
  xcoordinate: number;
  ycoordinate: number;
  width: number;
  height: number;
}> {
  const signerById = new Map(signers.map((s) => [s.id, s.name || `Signer ${s.id}`]));
  return sortBoxes(boxes).map((b) => ({
    pageNumber: b.page,
    signerName: signerById.get(b.signerId) ?? `Signer ${b.signerId}`,
    xcoordinate: roundValue(b.pdf.x, rounding),
    ycoordinate: roundValue(b.pdf.y, rounding),
    width: roundValue(b.pdf.width, rounding),
    height: roundValue(b.pdf.height, rounding)
  }));
}

/** Format boxes for the selected eSign provider (string or pretty JSON). */
export function formatBoxesForProvider(
  provider: Exclude<EsignProvider, 'all'>,
  boxes: SignatureBox[],
  signers: Signer[],
  rounding: ExportRounding = 'integer',
  pageWidthOf: PageWidthLookup = () => 595,
  pageHeightOf: PageHeightLookup = () => 842
): string {
  if (boxes.length === 0) return '';
  switch (provider) {
    case 'nsdl':
      return serializeNsdlBoxes(boxes, rounding, pageWidthOf);
    case 'emudhra':
      return serializeEmudhraBoxes(boxes, rounding);
    case 'cvl':
      return serializeCvlBoxes(boxes, rounding, pageHeightOf);
    case 'cdsl':
      return serializeCdslBoxes(boxes, rounding);
    case 'digio':
      return JSON.stringify(
        {
          display_on_page: 'custom',
          sign_coordinates: buildDigioSignCoordinates(boxes, signers, rounding)
        },
        null,
        2
      );
    case 'leegality':
      return JSON.stringify(
        {
          signatureCoordinates: buildLeegalityCoordinates(boxes, signers, rounding)
        },
        null,
        2
      );
  }
}

export interface ImportedBoxSpec {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

const FIVE_NUM_TOKEN_RE = /^(\d+)([,:])(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/;

/** Parse NSDL, eMudhra, CVL, CDSL, Digio JSON, or Leegality JSON coordinate input. */
export function parseProviderCoordinates(
  raw: string,
  pageWidthOf: PageWidthLookup = () => 595,
  pageHeightOf: PageHeightLookup = () => 842,
  preferredProvider: EsignProvider = 'all'
): ImportedBoxSpec[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed);
    const out: ImportedBoxSpec[] = [];

    // Leegality array or { signatureCoordinates: [...] }
    const leegalityList = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.signatureCoordinates)
        ? parsed.signatureCoordinates
        : null;
    if (leegalityList) {
      for (const item of leegalityList) {
        const page = Number(item.pageNumber ?? item.page ?? 1);
        const x = Number(item.xcoordinate ?? item.x ?? item.llx ?? 0);
        const y = Number(item.ycoordinate ?? item.y ?? item.lly ?? 0);
        const width = Number(item.width ?? (item.urx !== undefined ? Number(item.urx) - x : 150));
        const height = Number(item.height ?? (item.ury !== undefined ? Number(item.ury) - y : 50));
        if (page > 0 && width > 0 && height > 0) {
          out.push({ page, x, y, width, height });
        }
      }
      if (out.length === 0) throw new Error('No valid coordinate entries found in JSON.');
      return out;
    }

    // Digio: { sign_coordinates: { signer: { "1": [{ llx, lly, urx, ury }] } } } or { "1": [...] }
    const root = parsed?.sign_coordinates ?? parsed;
    const collectDigioPages = (pageMap: Record<string, unknown>) => {
      for (const [key, val] of Object.entries(pageMap)) {
        const page = Number(key);
        if (!Number.isFinite(page) || page <= 0 || !Array.isArray(val)) continue;
        for (const box of val) {
          const llx = Number((box as Record<string, unknown>)['llx']);
          const lly = Number((box as Record<string, unknown>)['lly']);
          const urx = Number((box as Record<string, unknown>)['urx']);
          const ury = Number((box as Record<string, unknown>)['ury']);
          if ([llx, lly, urx, ury].every(Number.isFinite) && urx > llx && ury > lly) {
            out.push({ page, x: llx, y: lly, width: urx - llx, height: ury - lly });
          }
        }
      }
    };

    if (root && typeof root === 'object') {
      const values = Object.values(root as Record<string, unknown>);
      if (values.some((v) => Array.isArray(v))) {
        collectDigioPages(root as Record<string, unknown>);
      } else {
        for (const v of values) {
          if (v && typeof v === 'object') collectDigioPages(v as Record<string, unknown>);
        }
      }
    }
    if (out.length === 0) throw new Error('Unrecognized JSON coordinate structure.');
    return out;
  }

  const parts = trimmed
    .split(';')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  return parts.map((part) => {
    if (NSDL_TOKEN_RE.test(part)) {
      const [t] = parseNsdlCoordinates(part, pageWidthOf);
      return { page: t.page, x: t.x, y: t.y, width: t.width, height: t.height };
    }
    const m = FIVE_NUM_TOKEN_RE.exec(part);
    if (m) {
      const page = Number(m[1]);
      const sep = m[2];
      const a = Number(m[3]);
      const b = Number(m[4]);
      const c = Number(m[5]);
      const d = Number(m[6]);
      // CVL uses comma-separated top-left `page,x,y,width,height` where c/d are dimensions (not urx/ury > llx/lly).
      const treatAsCvl = sep === ',' && (preferredProvider === 'cvl' || (preferredProvider !== 'emudhra' && (c <= a || d <= b)));
      if (treatAsCvl) {
        const pageH = pageHeightOf(page);
        return {
          page,
          x: a,
          y: pageH - b - d,
          width: Math.max(1, c),
          height: Math.max(1, d)
        };
      }
      return { page, x: a, y: b, width: Math.max(1, c - a), height: Math.max(1, d - b) };
    }
    throw new Error(`Invalid coordinate token: "${part}"`);
  });
}

/** Build combined + per-signer NSDL, eMudhra, CVL, Digio, CDSL, Leegality, and debug export payload. */
export function buildSignatureExportData(
  doc: PdfDocumentMeta,
  boxes: SignatureBox[],
  signers: Signer[],
  rounding: ExportRounding = 'integer',
  pageWidthOf: PageWidthLookup = () => 595,
  pageHeightOf: PageHeightLookup = () => 842
): SignatureExportData {
  const signerById = new Map(signers.map((s) => [s.id, s]));
  const perSignerCoordinates: Record<number, string> = {};
  const perSignerEmudhra: Record<number, string> = {};
  const perSignerCvl: Record<number, string> = {};

  for (const signer of signers) {
    const signerBoxes = boxes.filter((b) => b.signerId === signer.id);
    perSignerCoordinates[signer.id] = serializeNsdlBoxes(signerBoxes, rounding, pageWidthOf);
    perSignerEmudhra[signer.id] = serializeEmudhraBoxes(signerBoxes, rounding);
    perSignerCvl[signer.id] = serializeCvlBoxes(signerBoxes, rounding, pageHeightOf);
  }

  return {
    documentName: doc.documentName,
    pageCount: doc.pageCount,
    nsdlCoordinates: serializeNsdlBoxes(boxes, rounding, pageWidthOf),
    perSignerCoordinates,
    emudhraCoordinates: serializeEmudhraBoxes(boxes, rounding),
    perSignerEmudhra,
    cvlCoordinates: serializeCvlBoxes(boxes, rounding, pageHeightOf),
    perSignerCvl,
    digioCoordinates: buildDigioSignCoordinates(boxes, signers, rounding),
    cdslCoordinates: serializeCdslBoxes(boxes, rounding),
    leegalityCoordinates: buildLeegalityCoordinates(boxes, signers, rounding),
    signatures: sortBoxes(boxes).map((b) => {
      const x = roundValue(b.pdf.x, rounding);
      const y = roundValue(b.pdf.y, rounding);
      const width = roundValue(b.pdf.width, rounding);
      const height = roundValue(b.pdf.height, rounding);
      return {
        signerId: b.signerId,
        signerName: signerById.get(b.signerId)?.name ?? `Signer ${b.signerId}`,
        page: b.page,
        x,
        y,
        width,
        height,
        nsdlX: roundValue(pdfXToNsdlX(x, width, pageWidthOf(b.page)), rounding)
      };
    })
  };
}

/** Validate boxes against page bounds and check pairwise page overlaps. */
export function validateSignatureBoxes(
  boxes: SignatureBox[],
  pages: PdfPageInfo[]
): ValidationIssue[] {
  const pageMap = new Map(pages.map((p) => [p.pageNumber, p]));
  const issues: ValidationIssue[] = [];

  for (const box of boxes) {
    const { pdf } = box;
    if (pdf.x < 0 || pdf.y < 0 || pdf.width < 0 || pdf.height < 0) {
      issues.push({
        boxId: box.id,
        severity: 'error',
        code: 'negative',
        message: 'Coordinates must not be negative.'
      });
    }
    const page = pageMap.get(box.page);
    if (!page) {
      continue;
    }
    if (
      pdf.x < page.originX ||
      pdf.y < page.originY ||
      pdf.x + pdf.width > page.originX + page.pdfWidth ||
      pdf.y + pdf.height > page.originY + page.pdfHeight
    ) {
      issues.push({
        boxId: box.id,
        severity: 'error',
        code: 'outside',
        message: 'Signature is outside the page bounds.'
      });
    }
    if (pdf.width > page.pdfWidth || pdf.height > page.pdfHeight) {
      issues.push({
        boxId: box.id,
        severity: 'warning',
        code: 'exceeds',
        message: 'Signature size exceeds the page dimensions.'
      });
    }
  }

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (a.page !== b.page) {
        continue;
      }
      const separated =
        a.pdf.x + a.pdf.width <= b.pdf.x ||
        b.pdf.x + b.pdf.width <= a.pdf.x ||
        a.pdf.y + a.pdf.height <= b.pdf.y ||
        b.pdf.y + b.pdf.height <= a.pdf.y;
      if (!separated) {
        issues.push({
          boxId: a.id,
          severity: 'warning',
          code: 'overlap',
          message: `Overlaps another signature on page ${a.page}.`
        });
        issues.push({
          boxId: b.id,
          severity: 'warning',
          code: 'overlap',
          message: `Overlaps another signature on page ${b.page}.`
        });
      }
    }
  }

  return issues;
}
