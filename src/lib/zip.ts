import JSZip from 'jszip';
import { Bundle, CasePackage, LedgerEvent } from '../types';
import { canonical } from './crypto';

export async function exportCaseToZip(pkg: CasePackage): Promise<Blob> {
  const zip = new JSZip();

  // Root case files
  zip.file('bundle.json', canonical(pkg.bundle));
  zip.file('ledger.json', canonical(pkg.ledger));
  zip.file('report.md', pkg.reportMd);
  zip.file('anchor.sha256', pkg.anchor + '\n');
  zip.file('COMPLETE', pkg.completeMarker);

  // Originals folder
  const originalsFolder = zip.folder('originals');
  if (originalsFolder) {
    for (const [path, data] of Object.entries(pkg.originalFiles)) {
      // path is e.g. "originals/documento.txt" or "originals/sub/doc.txt"
      const subPath = path.startsWith('originals/') ? path.slice(10) : path;
      originalsFolder.file(subPath, data);
    }
  }

  return await zip.generateAsync({ type: 'blob' });
}

export async function exportRestoredFilesToZip(files: Record<string, Uint8Array>): Promise<Blob> {
  const zip = new JSZip();
  for (const [path, data] of Object.entries(files)) {
    zip.file(path, data);
  }
  return await zip.generateAsync({ type: 'blob' });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, filename);
}

export async function parseUploadedZip(file: File): Promise<{
  bundle?: Bundle;
  ledger?: LedgerEvent[];
  anchor?: string;
  reportMd?: string;
  originalFiles: Record<string, Uint8Array>;
  hasComplete: boolean;
}> {
  const zip = await JSZip.loadAsync(file);
  const originalFiles: Record<string, Uint8Array> = {};
  let bundle: Bundle | undefined;
  let ledger: LedgerEvent[] | undefined;
  let anchor: string | undefined;
  let reportMd: string | undefined;
  let hasComplete = false;

  for (const [filename, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;
    const cleanName = filename.replace(/^\/+/, '');

    if (cleanName === 'bundle.json') {
      const text = await zipEntry.async('string');
      bundle = JSON.parse(text);
    } else if (cleanName === 'ledger.json') {
      const text = await zipEntry.async('string');
      ledger = JSON.parse(text);
    } else if (cleanName === 'anchor.sha256') {
      anchor = (await zipEntry.async('string')).trim();
    } else if (cleanName === 'report.md') {
      reportMd = await zipEntry.async('string');
    } else if (cleanName === 'COMPLETE') {
      hasComplete = true;
    } else if (cleanName.startsWith('originals/')) {
      const data = await zipEntry.async('uint8array');
      originalFiles[cleanName] = data;
    }
  }

  return {
    bundle,
    ledger,
    anchor,
    reportMd,
    originalFiles,
    hasComplete,
  };
}
