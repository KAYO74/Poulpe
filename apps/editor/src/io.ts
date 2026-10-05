import {
  POULPE_EXTENSION,
  PoulpeFileError,
  activeEffects,
  artboardToSvg,
  effectMargin,
  nodeBounds,
  type SceneNode,
  createDocument,
  decodePoulpe,
  encodePoulpe,
  type Artboard,
  type PoulpeDocument,
} from '@poulpe/core';
import { ImageCache, drawNode, measureText, rasterizeArtboard } from '@poulpe/render';
import { placeImage } from './actions';
import { t } from './i18n';
import { editor, toast, ui } from './store';
import { placeSvg } from './vectorActions';

/*
 * Entrées / sorties de fichiers. Dans l'appli de bureau (Tauri), on passe par les boîtes de
 * dialogue et le système de fichiers natifs ; dans le navigateur, par l'API File System Access
 * quand elle existe, sinon par un téléchargement.
 */

export const isDesktop = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const exportImages = new ImageCache();

type FileKind = 'poulpe' | 'png' | 'jpeg' | 'svg' | 'pdf';
const KINDS: Record<FileKind, { ext: string; mime: string; label: string }> = {
  poulpe: { ext: POULPE_EXTENSION, mime: 'application/x-poulpe', label: 'Poulpe' },
  png: { ext: 'png', mime: 'image/png', label: 'PNG' },
  jpeg: { ext: 'jpg', mime: 'image/jpeg', label: 'JPEG' },
  svg: { ext: 'svg', mime: 'image/svg+xml', label: 'SVG' },
  pdf: { ext: 'pdf', mime: 'application/pdf', label: 'PDF' },
};

export function baseName(path: string): string {
  return path
    .split(/[\\/]/)
    .pop()!
    .replace(/\.[^.]+$/, '');
}

function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'poulpe';
}

/** Enregistre des octets sous un nom choisi par l'utilisateur. Renvoie le chemin ou le nom, ou null si annulé. */
async function saveBytes(
  bytes: Uint8Array,
  kind: FileKind,
  suggested: string,
  existingPath?: string | null,
): Promise<string | null> {
  const info = KINDS[kind];
  const fileName = `${safeName(suggested)}.${info.ext}`;
  if (isDesktop()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const path =
      existingPath ??
      (await save({ defaultPath: fileName, filters: [{ name: info.label, extensions: [info.ext] }] }));
    if (!path) return null;
    await writeFile(path, bytes);
    return path;
  }
  const w = window as unknown as { showSaveFilePicker?: (o: unknown) => Promise<FileSystemFileHandle> };
  if (w.showSaveFilePicker) {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: info.label, accept: { [info.mime]: [`.${info.ext}`] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(bytes as unknown as BufferSource);
      await writable.close();
      return handle.name;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return null;
      // Sinon on se rabat sur le téléchargement.
    }
  }
  const url = URL.createObjectURL(new Blob([bytes as unknown as BlobPart], { type: info.mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return fileName;
}

async function pickFile(
  accept: string[],
  mimes: string,
): Promise<{ name: string; bytes: Uint8Array } | null> {
  if (isDesktop()) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const { readFile } = await import('@tauri-apps/plugin-fs');
    const path = await open({ multiple: false, filters: [{ name: accept.join(', '), extensions: accept }] });
    if (!path || Array.isArray(path)) return null;
    return { name: path, bytes: await readFile(path) };
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = mimes;
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) } : null);
    };
    input.click();
  });
}

export function confirmDiscard(): boolean {
  return !editor.getState().dirty || window.confirm(t('file.unsaved'));
}

export function newDocument(width: number, height: number): void {
  if (!confirmDiscard()) return;
  editor.load(createDocument({ name: t('app.untitled'), width, height }));
  ui.set({ filePath: null, dialog: null });
  requestAnimationFrame(() => window.dispatchEvent(new Event('poulpe:fit')));
}

export function loadBytes(name: string, bytes: Uint8Array): void {
  try {
    const doc = decodePoulpe(bytes);
    editor.load({ ...doc, name: baseName(name) });
    ui.set({ filePath: name, dialog: null });
    requestAnimationFrame(() => window.dispatchEvent(new Event('poulpe:fit')));
  } catch (e) {
    window.alert(e instanceof PoulpeFileError && e.code === 'tooNew' ? t('file.tooNew') : t('file.invalid'));
  }
}

export async function openDocument(): Promise<void> {
  if (!confirmDiscard()) return;
  const file = await pickFile([POULPE_EXTENSION], `.${POULPE_EXTENSION}`);
  if (file) loadBytes(file.name, file.bytes);
}

/** Ouvre un fichier par son chemin (double-clic sur un `.poulpe` dans l'appli de bureau). */
export async function openPath(path: string): Promise<void> {
  const { readFile } = await import('@tauri-apps/plugin-fs');
  loadBytes(path, await readFile(path));
}

async function thumbnail(doc: PoulpeDocument): Promise<Uint8Array | undefined> {
  const ab = doc.artboards[0];
  if (!ab) return undefined;
  try {
    const blob = await rasterizeArtboard(doc, ab, exportImages, {
      scale: Math.min(1, 256 / Math.max(ab.width, ab.height)),
    });
    return new Uint8Array(await blob.arrayBuffer());
  } catch {
    return undefined;
  }
}

export async function saveDocument(saveAs = false): Promise<void> {
  const doc = editor.doc;
  const bytes = encodePoulpe(doc, {
    thumbnail: await thumbnail(doc),
    generator: `Poulpe ${__APP_VERSION__}`,
  });
  // Dans le navigateur, on ne peut pas réécrire le fichier ouvert : chaque enregistrement redemande où l'écrire.
  const existing = !saveAs && isDesktop() ? ui.get().filePath : null;
  const path = await saveBytes(bytes, 'poulpe', doc.name, existing);
  if (!path) return;
  editor.markSaved();
  ui.set({ filePath: path });
  toast(t('file.saved'));
}

export async function importImage(): Promise<void> {
  const file = await pickFile(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'], 'image/*');
  if (!file) {
    ui.set({ tool: 'select' });
    return;
  }
  const ext = file.name.split('.').pop()!.toLowerCase();
  if (ext === 'svg') {
    // Un SVG arrive en objets modifiables ; s'il est illisible, en image.
    if (placeSvg(new TextDecoder().decode(file.bytes), baseName(file.name))) return;
  }
  const mime =
    ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
  await placeImageBytes(file.bytes, mime);
}

export async function placeImageBytes(
  bytes: Uint8Array,
  mime: string,
  at?: { x: number; y: number },
): Promise<void> {
  const blob = new Blob([bytes as unknown as BlobPart], { type: mime });
  const data = await new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(blob);
  });
  const img = new Image();
  img.src = data;
  try {
    await img.decode();
  } catch {
    window.alert(t('file.imageError'));
    return;
  }
  placeImage(data, mime, img.naturalWidth || 512, img.naturalHeight || 512, at);
}

export interface ExportOptions {
  kind: 'png' | 'jpeg' | 'svg' | 'pdf';
  /** `all` : tous les plans de travail (PDF multipage ; un fichier par plan sinon). */
  artboardId: string | 'all';
  scale: number;
  quality: number;
  transparent: boolean;
}

/**
 * Le PDF ne sait pas lire les filtres SVG : les objets qui ont des effets y sont mis en image
 * (2 pixels par point), effets compris.
 */
async function rasterizedEffects(doc: PoulpeDocument, ab: Artboard): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const visit = async (n: SceneNode) => {
    if (!n.visible) return;
    const fx = activeEffects(n);
    if (!fx.length) {
      if (n.type === 'group') for (const c of n.children) await visit(c);
      return;
    }
    const m = effectMargin(fx) + 2;
    const b = nodeBounds(n);
    const x = b.x - m,
      y = b.y - m,
      w = b.width + 2 * m,
      h = b.height + 2 * m;
    const scale = Math.min(2, 4096 / Math.max(w, h, 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(w * scale));
    canvas.height = Math.max(1, Math.ceil(h * scale));
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.translate(-x, -y);
    drawNode(ctx, doc, n, { images: exportImages });
    out.set(
      n.id,
      `<image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none" href="${canvas.toDataURL('image/png')}"/>`,
    );
  };
  for (const n of ab.children) await visit(n);
  return out;
}

async function svgToPdf(
  doc: PoulpeDocument,
  artboards: Artboard[],
): Promise<{ bytes: Uint8Array; missingFonts: string[] }> {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  const first = artboards[0];
  const orientation = (ab: Artboard) => (ab.width > ab.height ? 'landscape' : 'portrait');
  // 1 px = 0,75 pt (96 ppp), comme les navigateurs.
  const pt = (px: number) => px * 0.75;
  const pdf = new jsPDF({
    unit: 'pt',
    format: [pt(first.width), pt(first.height)],
    orientation: orientation(first),
  });
  const { embedFonts } = await import('./pdfFonts');
  const missingFonts = await embedFonts(pdf, doc, artboards);
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-99999px;top:0';
  document.body.appendChild(host);
  try {
    for (let i = 0; i < artboards.length; i++) {
      const ab = artboards[i];
      if (i > 0) pdf.addPage([pt(ab.width), pt(ab.height)], orientation(ab));
      await exportImages.ready(doc);
      const fx = await rasterizedEffects(doc, ab);
      host.innerHTML = artboardToSvg(doc, ab, { measureText, override: (n) => fx.get(n.id) ?? null });
      const svg = host.querySelector('svg')!;
      await svg2pdf(svg, pdf, { x: 0, y: 0, width: pt(ab.width), height: pt(ab.height) });
    }
  } finally {
    host.remove();
  }
  pdf.setProperties({ title: doc.name, creator: `Poulpe ${__APP_VERSION__}` });
  return { bytes: new Uint8Array(pdf.output('arraybuffer')), missingFonts };
}

export async function exportDocument(opts: ExportOptions): Promise<void> {
  const doc = editor.doc;
  const artboards =
    opts.artboardId === 'all' ? doc.artboards : doc.artboards.filter((a) => a.id === opts.artboardId);
  if (!artboards.length) return;
  if (opts.kind === 'pdf') {
    const { bytes, missingFonts } = await svgToPdf(doc, artboards);
    if (await saveBytes(bytes, 'pdf', doc.name))
      toast(
        missingFonts.length
          ? t('export.pdfFontsMissing', { fonts: missingFonts.join(', ') })
          : t('file.exported'),
      );
    return;
  }
  let done = false;
  for (const ab of artboards) {
    const name = artboards.length > 1 || doc.artboards.length > 1 ? `${doc.name} - ${ab.name}` : doc.name;
    let bytes: Uint8Array;
    if (opts.kind === 'svg') {
      bytes = new TextEncoder().encode(
        artboardToSvg(doc, ab, { measureText, background: !opts.transparent }),
      );
    } else {
      const blob = await rasterizeArtboard(doc, ab, exportImages, {
        scale: opts.scale,
        type: opts.kind === 'png' ? 'image/png' : 'image/jpeg',
        quality: opts.quality,
        background: !(opts.transparent && opts.kind === 'png'),
      });
      bytes = new Uint8Array(await blob.arrayBuffer());
    }
    if (!(await saveBytes(bytes, opts.kind, name))) break;
    done = true;
  }
  if (done) toast(t('file.exported'));
}
