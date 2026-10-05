import { inkToLab, labToInk } from './cmyk';

/*
 * Profil ICC (version 2.1, classe « imprimante ») du modèle d'encres de Poulpe. Il est incorporé
 * dans les PDF/X comme profil de sortie : il décrit à l'imprimeur et aux logiciels de contrôle
 * les couleurs attendues. Les tables sont calculées à partir du même modèle que les conversions
 * et l'épreuvage (voir cmyk.ts).
 */

const A2B_GRID = 9;
const B2A_GRID = 17;

class Writer {
  bytes: number[] = [];
  u8(v: number) {
    this.bytes.push(v & 255);
  }
  u16(v: number) {
    this.u8(v >> 8);
    this.u8(v);
  }
  u32(v: number) {
    this.u16(Math.floor(v / 65536) & 0xffff);
    this.u16(v & 0xffff);
  }
  s15(v: number) {
    const n = Math.round(v * 65536);
    this.u32(n < 0 ? n + 0x100000000 : n);
  }
  sig(s: string) {
    for (let i = 0; i < 4; i++) this.u8(s.charCodeAt(i) || 32);
  }
  ascii(s: string) {
    for (const ch of s) this.u8(ch.charCodeAt(0) < 128 ? ch.charCodeAt(0) : 63);
  }
  pad4() {
    while (this.bytes.length % 4) this.u8(0);
  }
}

const enc16 = (v: number) => Math.max(0, Math.min(65535, Math.round(v)));
/** Lab sur 16 bits, codage historique des profils v2 (L : 0xFF00 = 100 ; a, b : 0x8000 = 0). */
const labEnc = (L: number, a: number, b: number) => [
  enc16(L * 652.8),
  enc16((a + 128) * 256),
  enc16((b + 128) * 256),
];
const labDec = (l: number, a: number, b: number) => [l / 652.8, a / 256 - 128, b / 256 - 128];

/** Table `lut16Type` : courbes identité, grille de `grid` points par entrée. */
function lut16(inputs: number, outputs: number, grid: number, cell: (idx: number[]) => number[]): number[] {
  const w = new Writer();
  w.sig('mft2');
  w.u32(0);
  w.u8(inputs);
  w.u8(outputs);
  w.u8(grid);
  w.u8(0);
  for (let i = 0; i < 9; i++) w.s15(i % 4 === 0 ? 1 : 0);
  w.u16(2);
  w.u16(2);
  for (let i = 0; i < inputs; i++) {
    w.u16(0);
    w.u16(65535);
  }
  const idx = new Array(inputs).fill(0);
  const total = grid ** inputs;
  for (let n = 0; n < total; n++) {
    let rest = n;
    for (let i = inputs - 1; i >= 0; i--) {
      idx[i] = rest % grid;
      rest = Math.floor(rest / grid);
    }
    for (const v of cell(idx)) w.u16(enc16(v));
  }
  for (let i = 0; i < outputs; i++) {
    w.u16(0);
    w.u16(65535);
  }
  return w.bytes;
}

function textDescription(text: string): number[] {
  const w = new Writer();
  w.sig('desc');
  w.u32(0);
  w.u32(text.length + 1);
  w.ascii(text);
  w.u8(0);
  w.u32(0);
  w.u32(0);
  w.u16(0);
  w.u8(0);
  for (let i = 0; i < 67; i++) w.u8(0);
  return w.bytes;
}

function textType(text: string): number[] {
  const w = new Writer();
  w.sig('text');
  w.u32(0);
  w.ascii(text);
  w.u8(0);
  return w.bytes;
}

function xyzType(x: number, y: number, z: number): number[] {
  const w = new Writer();
  w.sig('XYZ ');
  w.u32(0);
  w.s15(x);
  w.s15(y);
  w.s15(z);
  return w.bytes;
}

let cached: Uint8Array | null = null;

/** Description du profil, telle qu'elle apparaît dans les logiciels de contrôle. */
export const ICC_DESCRIPTION = 'Poulpe CMJN (offset couche, proche FOGRA39)';

/** Profil ICC CMJN du modèle d'encres de Poulpe (calculé une fois, environ 100 Ko). */
export function cmykIccProfile(): Uint8Array {
  if (cached) return cached;
  const step = (g: number) => 1 / (g - 1);
  const a2b = lut16(4, 3, A2B_GRID, (i) => {
    const s = step(A2B_GRID);
    const [L, a, b] = inkToLab(i[0] * s, i[1] * s, i[2] * s, i[3] * s);
    return labEnc(L, a, b);
  });
  const results: { ink: number[]; error: number }[] = [];
  const b2a = lut16(3, 4, B2A_GRID, (i) => {
    const v = (k: number) => (i[k] / (B2A_GRID - 1)) * 65535;
    const [L, a, b] = labDec(v(0), v(1), v(2));
    const r = labToInk(L, a, b);
    results.push(r);
    return r.ink.map((x) => x * 65535);
  });
  let n = 0;
  const gamut = lut16(3, 1, B2A_GRID, () => [results[n++].error > 5 ? 65535 : 0]);
  const tags: [string, number[]][] = [
    ['desc', textDescription(ICC_DESCRIPTION)],
    ['cprt', textType('Domaine public (Projet Poulpe, MPL-2.0)')],
    ['wtpt', xyzType(0.9642, 1, 0.8249)],
    ['A2B0', a2b],
    ['B2A0', b2a],
    ['gamt', gamut],
  ];
  // Les autres intentions de rendu partagent les mêmes tables.
  const aliases: [string, string][] = [
    ['A2B1', 'A2B0'],
    ['A2B2', 'A2B0'],
    ['B2A1', 'B2A0'],
    ['B2A2', 'B2A0'],
  ];
  const count = tags.length + aliases.length;
  let offset = 128 + 4 + count * 12;
  const placed = new Map<string, { offset: number; size: number }>();
  for (const [sig, data] of tags) {
    placed.set(sig, { offset, size: data.length });
    offset += data.length;
    offset += (4 - (offset % 4)) % 4;
  }
  const size = offset;
  const w = new Writer();
  // En-tête.
  w.u32(size);
  w.u32(0);
  w.u32(0x02100000);
  w.sig('prtr');
  w.sig('CMYK');
  w.sig('Lab ');
  const now = new Date();
  for (const v of [
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds(),
  ])
    w.u16(v);
  w.sig('acsp');
  for (let i = 0; i < 4 + 4 + 4 + 4 + 8 + 4; i++) w.u8(0);
  w.s15(0.9642);
  w.s15(1);
  w.s15(0.8249);
  for (let i = 0; i < 4 + 16 + 28; i++) w.u8(0);
  // Table des balises.
  w.u32(count);
  for (const [sig] of tags) {
    const p = placed.get(sig)!;
    w.sig(sig);
    w.u32(p.offset);
    w.u32(p.size);
  }
  for (const [sig, target] of aliases) {
    const p = placed.get(target)!;
    w.sig(sig);
    w.u32(p.offset);
    w.u32(p.size);
  }
  for (const [, data] of tags) {
    for (const b of data) w.u8(b);
    w.pad4();
  }
  cached = new Uint8Array(w.bytes);
  return cached;
}
