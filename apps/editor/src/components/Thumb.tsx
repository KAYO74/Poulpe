import { useEffect, useState } from 'react';
import { artboardToSvg, createDocument, type PoulpeDocument, type SceneNode } from '@poulpe/core';
import { ImageCache, drawArtboard, measureText } from '@poulpe/render';
import { loadDocumentFonts, normalizeTexts } from '../normalize';

/*
 * Aperçus des modèles et des éléments de la bibliothèque. Ils sont dessinés par le moteur de
 * rendu lui-même (ce qu'on voit est ce qu'on obtient), une fois, puis gardés en mémoire.
 */

const cache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();
const images = new ImageCache();

async function render(doc: PoulpeDocument, maxW: number, maxH: number): Promise<string> {
  await loadDocumentFonts(doc);
  normalizeTexts(doc);
  const ab = doc.artboards[0];
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const k = Math.min(maxW / ab.width, maxH / ab.height) * dpr;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(ab.width * k));
  canvas.height = Math.max(1, Math.round(ab.height * k));
  const ctx = canvas.getContext('2d')!;
  ctx.scale(k, k);
  ctx.translate(-ab.x, -ab.y);
  drawArtboard(ctx, doc, ab, { images, measure: measureText });
  return canvas.toDataURL('image/png');
}

/** Aperçu dessiné d'un document (son premier plan de travail). */
export function DocThumb({
  cacheKey,
  make,
  maxW,
  maxH,
  alt = '',
}: {
  cacheKey: string;
  make: () => PoulpeDocument;
  maxW: number;
  maxH: number;
  alt?: string;
}) {
  const key = `${cacheKey}@${maxW}x${maxH}`;
  const [src, setSrc] = useState(() => cache.get(key) ?? null);
  useEffect(() => {
    if (cache.has(key)) {
      setSrc(cache.get(key)!);
      return;
    }
    let alive = true;
    let p = pending.get(key);
    if (!p) {
      p = render(make(), maxW, maxH).then((url) => {
        cache.set(key, url);
        pending.delete(key);
        return url;
      });
      pending.set(key, p);
    }
    void p.then((url) => alive && setSrc(url));
    return () => {
      alive = false;
    };
    // `make` change à chaque rendu : la clé suffit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return src ? (
    <img className="thumb-img" src={src} alt={alt} draggable={false} />
  ) : (
    <span className="thumb-img loading" aria-hidden="true" />
  );
}

/** Document d'un seul objet, ajusté à sa taille (pour l'aperçu d'un élément). */
export function nodeDocument(node: SceneNode, pad = 0): PoulpeDocument {
  const doc = createDocument({ width: node.width + pad * 2, height: node.height + pad * 2 });
  const ab = doc.artboards[0];
  ab.x = node.x - pad;
  ab.y = node.y - pad;
  ab.background = { type: 'none' };
  ab.children = [node];
  return doc;
}

/** Aperçu vectoriel léger d'un objet sans texte (formes, cadres) : une image SVG. */
export function NodeSvg({ node, label }: { node: SceneNode; label: string }) {
  const doc = nodeDocument(node, Math.max(node.width, node.height) * 0.02);
  const svg = artboardToSvg(doc, doc.artboards[0], { background: false });
  return (
    <img
      className="el-svg"
      src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
      alt={label}
      draggable={false}
    />
  );
}
