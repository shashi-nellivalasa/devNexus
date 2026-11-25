export type PdfPageSize = 'a4' | 'letter' | 'fit';
export type PdfOrientation = 'auto' | 'portrait' | 'landscape';
export type PdfOutputImageFormat = 'image/png' | 'image/jpeg' | 'image/webp';

export interface PdfImageInput {
  name: string;
  widthPx: number;
  heightPx: number;
  jpegBytes: Uint8Array;
}

export interface ImageToPdfOptions {
  pageSize: PdfPageSize;
  orientation: PdfOrientation;
  marginPt: number;
}

export interface RenderedPdfPage {
  pageNumber: number;
  widthPx: number;
  heightPx: number;
  sizeBytes: number;
  dataUrl: string;
  blob: Blob;
  filename: string;
}

const STANDARD_SIZES_PT: Record<'a4' | 'letter', { width: number; height: number }> = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 }
};

/**
 * Parses a page range expression like "1-3, 5" against `totalPages`.
 * Empty or "all" returns all pages [1..totalPages].
 */
export function parsePageRange(rangeInput: string, totalPages: number): number[] {
  if (totalPages <= 0) return [];
  const trimmed = (rangeInput || '').trim().toLowerCase();
  if (!trimmed || trimmed === 'all' || trimmed === '*') {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set<number>();
  const tokens = trimmed.split(',').map(t => t.trim()).filter(Boolean);

  for (const token of tokens) {
    if (token.includes('-')) {
      const [startRaw, endRaw] = token.split('-').map(s => Number(s.trim()));
      if (!Number.isFinite(startRaw) || !Number.isFinite(endRaw)) continue;
      const start = Math.max(1, Math.min(Math.trunc(startRaw), Math.trunc(endRaw)));
      const end = Math.min(totalPages, Math.max(Math.trunc(startRaw), Math.trunc(endRaw)));
      for (let p = start; p <= end; p++) {
        pages.add(p);
      }
    } else {
      const single = Math.trunc(Number(token));
      if (Number.isFinite(single) && single >= 1 && single <= totalPages) {
        pages.add(single);
      }
    }
  }

  return Array.from(pages).sort((a, b) => a - b);
}

/**
 * Computes PDF page width and height in points (1 pt = 1/72 inch).
 */
export function getPageDimensionsPt(
  imgWidthPx: number,
  imgHeightPx: number,
  pageSize: PdfPageSize,
  orientation: PdfOrientation,
  marginPt: number
): { widthPt: number; heightPt: number } {
  if (pageSize === 'fit') {
    const w = Math.max(1, imgWidthPx * 0.75 + marginPt * 2);
    const h = Math.max(1, imgHeightPx * 0.75 + marginPt * 2);
    return { widthPt: Number(w.toFixed(2)), heightPt: Number(h.toFixed(2)) };
  }

  const base = STANDARD_SIZES_PT[pageSize];
  const isImgLandscape = imgWidthPx > imgHeightPx;
  const useLandscape =
    orientation === 'landscape' || (orientation === 'auto' && isImgLandscape);

  return useLandscape
    ? { widthPt: base.height, heightPt: base.width }
    : { widthPt: base.width, heightPt: base.height };
}

/**
 * Generates a valid multi-page PDF 1.4 binary from JPEG byte arrays.
 */
export function buildPdfFromJpegImages(
  images: PdfImageInput[],
  options: ImageToPdfOptions
): Uint8Array {
  if (images.length === 0) {
    throw new Error('At least one image is required to build a PDF.');
  }

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let offset = 0;

  const pushBytes = (bytes: Uint8Array): void => {
    chunks.push(bytes);
    offset += bytes.length;
  };

  const pushText = (text: string): void => {
    pushBytes(encoder.encode(text));
  };

  // Header + binary comment
  pushText('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  // Object 1: Catalog, Object 2: Pages, then 3 objects per page:
  // pageObjId = 3 + i*3, contentObjId = 4 + i*3, imageObjId = 5 + i*3
  const totalObjects = 2 + images.length * 3;
  const offsets: number[] = new Array(totalObjects + 1).fill(0);

  const pageRefs = images.map((_, i) => `${3 + i * 3} 0 R`).join(' ');

  // 1 0 obj - Catalog
  offsets[1] = offset;
  pushText('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // 2 0 obj - Pages
  offsets[2] = offset;
  pushText(`2 0 obj\n<< /Type /Pages /Kids [ ${pageRefs} ] /Count ${images.length} >>\nendobj\n`);

  const margin = Math.max(0, options.marginPt || 0);

  images.forEach((img, idx) => {
    const pageObjId = 3 + idx * 3;
    const contentObjId = 4 + idx * 3;
    const imageObjId = 5 + idx * 3;

    const { widthPt, heightPt } = getPageDimensionsPt(
      img.widthPx,
      img.heightPx,
      options.pageSize,
      options.orientation,
      margin
    );

    const availW = Math.max(10, widthPt - margin * 2);
    const availH = Math.max(10, heightPt - margin * 2);
    const scale = Math.min(availW / img.widthPx, availH / img.heightPx);
    const drawW = (img.widthPx * scale).toFixed(2);
    const drawH = (img.heightPx * scale).toFixed(2);
    const drawX = ((widthPt - Number(drawW)) / 2).toFixed(2);
    const drawY = ((heightPt - Number(drawH)) / 2).toFixed(2);

    const stream = `q\n${drawW} 0 0 ${drawH} ${drawX} ${drawY} cm\n/Im0 Do\nQ\n`;

    // Page object
    offsets[pageObjId] = offset;
    pushText(
      `${pageObjId} 0 obj\n` +
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPt} ${heightPt}] ` +
      `/Resources << /XObject << /Im0 ${imageObjId} 0 R >> >> ` +
      `/Contents ${contentObjId} 0 R >>\n` +
      `endobj\n`
    );

    // Content stream object
    offsets[contentObjId] = offset;
    pushText(
      `${contentObjId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`
    );

    // Image XObject (DCTDecode = JPEG)
    offsets[imageObjId] = offset;
    pushText(
      `${imageObjId} 0 obj\n` +
      `<< /Type /XObject /Subtype /Image /Width ${img.widthPx} /Height ${img.heightPx} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.jpegBytes.length} >>\n` +
      `stream\n`
    );
    pushBytes(img.jpegBytes);
    pushText('\nendstream\nendobj\n');
  });

  // Cross-reference table
  const xrefStart = offset;
  pushText(`xref\n0 ${totalObjects + 1}\n`);
  pushText('0000000000 65535 f \n');
  for (let id = 1; id <= totalObjects; id++) {
    pushText(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  }

  pushText(
    `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
  );

  const output = new Uint8Array(offset);
  let cursor = 0;
  for (const chunk of chunks) {
    output.set(chunk, cursor);
    cursor += chunk.length;
  }
  return output;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
