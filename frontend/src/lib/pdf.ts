import * as pdfjsLib from 'pdfjs-dist';

// Use local worker file copied to public folder
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export async function getPdfPageCount(file: File): Promise<number> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    return pdf.numPages;
  } catch {
    return 1;
  }
}

export async function pdfPageToBase64(file: File, pageNum = 1): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const safePageNum = Math.min(Math.max(1, pageNum), pdf.numPages);
  const page = await pdf.getPage(safePageNum);
  const viewport = page.getViewport({ scale: 2.0 });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: context, viewport }).promise;
  return canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
}

export async function extractPdfText(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;
    const textParts: string[] = [];

    for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ');
      if (pageText.trim()) {
        textParts.push(`--- Page ${i} ---\n${pageText}`);
      }
    }
    const combined = textParts.join('\n\n').trim();
    if (combined.length > 20) {
      return combined;
    }
  } catch (e) {
    console.warn('pdfjs extractPdfText error:', e);
  }

  // Fallback: Raw Stream String Extraction
  try {
    const buffer = await file.arrayBuffer();
    const decoder = new TextDecoder('latin1');
    const text = decoder.decode(buffer);
    const regex = /\(([^)\\]{2,})\)\s*Tj/g;
    let match;
    const extracted: string[] = [];
    while ((match = regex.exec(text)) !== null) {
      if (match[1]) {
        extracted.push(match[1]);
      }
    }
    if (extracted.length > 10) {
      return extracted.join(' ');
    }
  } catch {
    // ignore
  }

  return '';
}


