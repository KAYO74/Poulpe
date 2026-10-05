import { unzlibSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  cmykIccProfile,
  cmykToColor,
  colorToCmyk,
  ICC_DESCRIPTION,
  outOfGamut,
  preparePrintPdf,
  softProofPixels,
} from '../src';

/** Petit PDF fait main : une page avec un carré rouge et un contour bleu. */
function handmadePdf(): Uint8Array {
  const content = '1 0 0 rg\n10 10 50 50 re f\n0 0 1 RG\n2 w 5 5 90 90 re S\n';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Contents 4 0 R /Resources << >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}endstream`,
  ];
  let out = '%PDF-1.3\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

/** Texte de tous les flux, décompressés si besoin. */
function streams(bytes: Uint8Array): string[] {
  const s = new TextDecoder('latin1').decode(bytes);
  const out: string[] = [];
  for (const m of s.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    const raw = Uint8Array.from(m[1], (c) => c.charCodeAt(0));
    try {
      out.push(new TextDecoder('latin1').decode(unzlibSync(raw)));
    } catch {
      out.push(m[1]);
    }
  }
  return out;
}

describe('couleurs CMJN', () => {
  it('donne du noir seul pour les gris', () => {
    const [c, m, y, k] = colorToCmyk('#000000');
    expect(c + m + y).toBe(0);
    expect(k).toBe(100);
    expect(colorToCmyk('#ffffff')).toEqual([0, 0, 0, 0]);
    const gray = colorToCmyk('#808080');
    expect(gray[0] + gray[1] + gray[2]).toBe(0);
  });

  it('retrouve à peu près la couleur après un aller-retour', () => {
    for (const hex of ['#c83c3c', '#3c8cc8', '#64a050', '#e6c850']) {
      const back = cmykToColor(colorToCmyk(hex));
      for (let i = 1; i < 7; i += 2) {
        const a = parseInt(hex.slice(i, i + 2), 16);
        const b = parseInt(back.slice(i, i + 2), 16);
        expect(Math.abs(a - b)).toBeLessThan(16);
      }
    }
  });

  it('respecte la limite d’encrage', () => {
    for (const hex of ['#000000', '#100030', '#202020', '#003010']) {
      const ink = colorToCmyk(hex);
      expect(ink.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(321);
    }
  });

  it('garde la valeur CMJN saisie par l’utilisateur', () => {
    const hex = cmykToColor([100, 0, 0, 0]);
    const doc = { layout: { cmyk: { [hex]: [100, 0, 0, 0] as [number, number, number, number] } } };
    expect(colorToCmyk(hex, doc)).toEqual([100, 0, 0, 0]);
  });

  it('signale les couleurs hors gamme', () => {
    expect(outOfGamut('#00ff00')).toBe(true);
    expect(outOfGamut('#0000ff')).toBe(true);
    expect(outOfGamut('#808080')).toBe(false);
    expect(outOfGamut(cmykToColor([0, 60, 80, 10]))).toBe(false);
  });

  it('ternit les couleurs vives à l’épreuvage', () => {
    const px = new Uint8ClampedArray([0, 255, 0, 255, 128, 128, 128, 255]);
    softProofPixels(px);
    expect(px[1]).toBeLessThan(230);
    expect(px[3]).toBe(255);
    expect(Math.abs(px[4] - 128)).toBeLessThan(12);
  });
});

describe('profil ICC', () => {
  it('a un en-tête CMJN vers Lab valide', () => {
    const icc = cmykIccProfile();
    const view = new DataView(icc.buffer, icc.byteOffset, icc.byteLength);
    const tag = (o: number) => String.fromCharCode(...icc.slice(o, o + 4));
    expect(view.getUint32(0)).toBe(icc.length);
    expect(tag(36)).toBe('acsp');
    expect(tag(12)).toBe('prtr');
    expect(tag(16)).toBe('CMYK');
    expect(tag(20)).toBe('Lab ');
    const tags = new Set<string>();
    for (let i = 0; i < view.getUint32(128); i++) tags.add(tag(132 + i * 12));
    for (const t of ['desc', 'A2B0', 'B2A0', 'gamt', 'wtpt']) expect(tags.has(t)).toBe(true);
    expect(new TextDecoder('latin1').decode(icc)).toContain(ICC_DESCRIPTION);
  });
});

describe('PDF pour l’imprimerie', () => {
  it('convertit les couleurs RVB en CMJN', () => {
    const { bytes } = preparePrintPdf(handmadePdf());
    const text = new TextDecoder('latin1').decode(bytes);
    const content = streams(bytes).join('\n');
    expect(content).toMatch(/[\d.]+ [\d.]+ [\d.]+ [\d.]+ k/);
    expect(content).toMatch(/[\d.]+ [\d.]+ [\d.]+ [\d.]+ K/);
    expect(content).not.toMatch(/\b(rg|RG)\b/);
    expect(text).not.toContain('/OutputIntents');
  });

  it('produit un PDF/X-4 avec son profil et sa zone de coupe', () => {
    const { bytes, warnings } = preparePrintPdf(handmadePdf(), {
      pdfx: true,
      title: 'Essai',
      date: new Date('2026-10-05T12:00:00Z'),
    });
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text.startsWith('%PDF-1.6')).toBe(true);
    expect(text).toContain('/GTS_PDFX');
    expect(text).toContain('/OutputIntents');
    expect(text).toContain('(FOGRA39)');
    expect(text).toContain('/TrimBox');
    expect(text).toContain('/BleedBox');
    expect(text).toContain('/Metadata');
    expect(streams(bytes).some((s) => s.includes('PDF/X-4'))).toBe(true);
    expect(warnings.rgbImages).toBe(0);
    // Le tableau des renvois pointe sur de vrais objets.
    const start = Number(/startxref\s+(\d+)/.exec(text)![1]);
    expect(text.slice(start, start + 4)).toBe('xref');
  });
});
