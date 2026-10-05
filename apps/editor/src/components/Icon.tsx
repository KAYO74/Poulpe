/** Icônes au trait, 16 × 16, dessinées pour Poulpe. */
const PATHS = {
  select: 'M4 2.5l8.5 6-3.8.7 2.1 4.1-1.6.8-2.1-4.1L4 12.6z',
  direct: 'M5 2.5l7.5 5.5-3.4.6 1.9 3.7-1.4.7-1.9-3.7L5 11.7z M1.5 12.5h3v3h-3z',
  pen: 'M8 1.8l4.2 5.6-2.2 6.1H6l-2.2-6.1z M8 1.8v6.4 M8 9.6a1.2 1.2 0 1 0 0-.1 M5.5 15h5',
  pencil: 'M2.5 13.5l.7-3L11 2.7l2.3 2.3-7.8 7.8z M9.5 4.2l2.3 2.3 M2.5 13.5l3-.7',
  unite: 'M2.5 2.5h7v3.5h3.5v7.5h-7.5v-3.5H2.5z',
  subtract: 'M2.5 2.5h7v3.5H6v4H2.5z M7.5 7.5h6v6h-6z',
  intersect: 'M2.5 2.5h7v7h-7z M6.5 6.5h7v7h-7z M6.5 6.5h3v3h-3z',
  exclude: 'M2.5 2.5h7v4h-3v3h-4z M9.5 6.5h4v7h-7v-4h3z',
  divide: 'M2.5 2.5h7v7h-7z M6.5 6.5h7v7h-7z',
  effects: 'M3 4.5h8v8H3z M5 2.5h8v8 M13 2.5',
  artboard: 'M4 1.5v13 M12 1.5v13 M1.5 4h13 M1.5 12h13',
  rect: 'M2.5 3.5h11v9h-11z',
  ellipse: 'M8 3c3.3 0 5.5 2.2 5.5 5S11.3 13 8 13 2.5 10.8 2.5 8 4.7 3 8 3z',
  polygon: 'M8 2l5.2 3v6L8 14l-5.2-3V5z',
  star: 'M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z',
  line: 'M3 13L13 3',
  text: 'M3 3.5h10 M8 3.5v9.5 M6 13h4',
  image: 'M2.5 3h11v10h-11z M2.5 11l3.5-3.5 3 3 2-2 2.5 2.5 M10.5 6.2a.7.7 0 1 0 0-.1',
  hand: 'M5 8V3.8a1 1 0 0 1 2 0V7.5 M7 7V2.8a1 1 0 0 1 2 0V7 M9 7V3.5a1 1 0 0 1 2 0V8 M11 8V5.5a1 1 0 0 1 2 0V9.5c0 2.8-2 4.5-4.5 4.5S4.6 13 3.6 11.4L2.4 9.3a1 1 0 0 1 1.7-1L5 9.5',
  zoom: 'M7 2.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z M10.3 10.3l3.2 3.2 M5 7h4 M7 5v4',
  eyedropper: 'M10.5 2.5l3 3-1.5 1.5-3-3z M9 4l3 3-6.5 6.5H2.5v-3z',
  undo: 'M5.5 3.5L2.5 6.5l3 3 M2.5 6.5h7a4 4 0 0 1 0 8h-2',
  redo: 'M10.5 3.5l3 3-3 3 M13.5 6.5h-7a4 4 0 0 0 0 8h2',
  alignLeft: 'M2.5 2v12 M4.5 4.5h8v2.5h-8z M4.5 9h5v2.5h-5z',
  alignHCenter: 'M8 2v12 M3.5 4.5h9v2.5h-9z M5 9h6v2.5H5z',
  alignRight: 'M13.5 2v12 M3.5 4.5h8v2.5h-8z M6.5 9h5v2.5h-5z',
  alignTop: 'M2 2.5h12 M4.5 4.5v8h2.5v-8z M9 4.5v5h2.5v-5z',
  alignVCenter: 'M2 8h12 M4.5 3.5v9h2.5v-9z M9 5v6h2.5V5z',
  alignBottom: 'M2 13.5h12 M4.5 3.5v8h2.5v-8z M9 6.5v5h2.5v-5z',
  distributeH: 'M2.5 2v12 M13.5 2v12 M6.5 5h3v6h-3z',
  distributeV: 'M2 2.5h12 M2 13.5h12 M5 6.5h6v3H5z',
  front: 'M5.5 5.5h8v8h-8z M2.5 10.5v-8h8',
  back: 'M2.5 2.5h8v8h-8z M5.5 13.5h8v-8',
  forward: 'M8 13V3 M4.5 6.5L8 3l3.5 3.5',
  backward: 'M8 3v10 M4.5 9.5L8 13l3.5-3.5',
  group: 'M2.5 2.5h4v4h-4z M9.5 9.5h4v4h-4z M1.5 1.5h13v13h-13z',
  ungroup: 'M2.5 2.5h5v5h-5z M8.5 8.5h5v5h-5z',
  flipH: 'M8 2v12 M6 4L2.5 12H6z M10 4l3.5 8H10z',
  flipV: 'M2 8h12 M4 6l8-3.5V6z M4 10l8 3.5V10z',
  rotateLeft: 'M3 3v3.5h3.5 M3.3 6.3A5.5 5.5 0 1 1 3 9.5',
  rotateRight: 'M13 3v3.5H9.5 M12.7 6.3A5.5 5.5 0 1 0 13 9.5',
  snap: 'M4 2.5v5.5a4 4 0 0 0 8 0V2.5 M4 5h3 M9 5h3',
  grid: 'M2.5 2.5h11v11h-11z M2.5 6.2h11 M2.5 9.8h11 M6.2 2.5v11 M9.8 2.5v11',
  ruler: 'M2 11l9-9 3 3-9 9z M5 8l1.5 1.5 M7 6l1 1 M9 4l1.5 1.5',
  moon: 'M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z',
  sun: 'M8 5a3 3 0 1 1 0 6 3 3 0 0 1 0-6z M8 1v1.5 M8 13.5V15 M1 8h1.5 M13.5 8H15 M3 3l1 1 M12 12l1 1 M3 13l1-1 M12 4l1-1',
  sideLeft: 'M1.5 2.5h13v11h-13z M5.5 2.5v11',
  sideRight: 'M1.5 2.5h13v11h-13z M10.5 2.5v11',
  export: 'M8 10V2 M5 5l3-3 3 3 M2.5 9.5v4h11v-4',
  eye: 'M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z M8 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
  eyeOff:
    'M2 2l12 12 M6.6 6.6a2 2 0 0 0 2.8 2.8 M4.2 4.3C2.5 5.5 1.5 8 1.5 8S4 12.5 8 12.5c1.4 0 2.6-.5 3.6-1.2 M7 3.6c.3 0 .7-.1 1-.1 4 0 6.5 4.5 6.5 4.5s-.5 1-1.5 2',
  lock: 'M4 7.5h8v6H4z M5.5 7.5V5a2.5 2.5 0 0 1 5 0v2.5',
  unlock: 'M4 7.5h8v6H4z M5.5 7.5V5a2.5 2.5 0 0 1 4.9-.7',
  chevron: 'M6 4l4 4-4 4',
  chevronDown: 'M4 6l4 4 4-4',
  plus: 'M8 3v10 M3 8h10',
  minus: 'M3 8h10',
  close: 'M4 4l8 8 M12 4l-8 8',
  trash: 'M3 4.5h10 M6.5 4.5V3h3v1.5 M4.5 4.5l.7 9h5.6l.7-9',
  swap: 'M4 3v8 M2 9l2 2 2-2 M12 13V5 M10 7l2-2 2 2',
  draw: 'M3 13l2-.5 7.5-7.5-1.5-1.5L3.5 11z M10 4.5l1.5 1.5',
  photo: 'M2.5 4.5h3l1-1.5h3l1 1.5h3v8h-11z M8 6.5a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4z',
  layout: 'M2.5 2.5h11v11h-11z M2.5 6h11 M7 6v7.5',
  bold: 'M4.5 3h4a2.5 2.5 0 0 1 0 5h-4z M4.5 8h4.5a2.5 2.5 0 0 1 0 5H4.5z',
  italic: 'M7 3h5 M4 13h5 M9.5 3l-3 10',
  underline: 'M4.5 3v4.5a3.5 3.5 0 0 0 7 0V3 M3.5 14h9',
  strike:
    'M3 8h10 M11 5c-.5-1.3-1.7-2-3-2-1.7 0-3 .9-3 2.3 0 2.7 6 1.7 6 4.7 0 1.4-1.3 2.5-3 2.5-1.5 0-2.8-.8-3.2-2',
  caps: 'M2 13l3-9 3 9 M3 10h4 M9 13l2.5-7 2.5 7 M9.8 11h3.4',
  textLeft: 'M2.5 3.5h11 M2.5 6.5h7 M2.5 9.5h11 M2.5 12.5h7',
  textCenter: 'M2.5 3.5h11 M4.5 6.5h7 M2.5 9.5h11 M4.5 12.5h7',
  textRight: 'M2.5 3.5h11 M6.5 6.5h7 M2.5 9.5h11 M6.5 12.5h7',
  textJustify: 'M2.5 3.5h11 M2.5 6.5h11 M2.5 9.5h11 M2.5 12.5h11',
  mask: 'M8 2.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11z M8 2.5v11',
  folder: 'M1.5 4V3h4.5l1.5 1.5h7v8.5h-13z',
  path: 'M2.5 12.5C4 4 12 12 13.5 3.5 M1.5 11.5h2v2h-2z M12.5 2.5h2v2h-2z',
  library:
    'M2.5 2.5h4.5v4.5h-4.5z M9 2.5h4.5v4.5H9z M2.5 9h4.5v4.5h-4.5z M11.25 9a2.25 2.25 0 1 1 0 4.5 2.25 2.25 0 0 1 0-4.5z',
  template: 'M2.5 2.5h11v11h-11z M2.5 6.5h11 M6.5 6.5v7',
  resize: 'M2.5 9.5v4h4 M2.5 13.5l5-5 M13.5 6.5v-4h-4 M13.5 2.5l-5 5',
  palette:
    'M8 2a6 6 0 1 0 0 12c1 0 1.5-.6 1.5-1.3 0-1-1-1.2-1-2.2 0-.8.6-1.3 1.5-1.3H12a2 2 0 0 0 2-2C14 4.4 11.3 2 8 2z M5 7.5h.1 M6.5 4.8h.1 M9.8 4.8h.1',
  search: 'M7 2.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z M10.3 10.3l3.2 3.2',
  shuffle:
    'M2 4.5h2.5c3 0 4 7 7 7H14 M12 9.5l2 2-2 2 M2 11.5h2.5c1.2 0 2-1 2.7-2.3 M9.3 6.8c.7-1.3 1.5-2.3 2.7-2.3H14 M12 2.5l2 2-2 2',
  link: 'M6.5 9.5l3-3 M7 4.5l1-1a2.5 2.5 0 0 1 3.5 3.5l-1 1 M9 11.5l-1 1A2.5 2.5 0 0 1 4.5 9l1-1',
  unlink:
    'M7 4.5l1-1a2.5 2.5 0 0 1 3.5 3.5l-1 1 M9 11.5l-1 1A2.5 2.5 0 0 1 4.5 9l1-1 M2.5 2.5l2 2 M13.5 13.5l-2-2',
  pages: 'M4.5 1.5h7v10h-7z M2.5 4v10.5h7',
  master: 'M3.5 1.5h9v13h-9z M5.5 4h5 M5.5 6.5h5 M6.5 11.5h3',
  duplicate: 'M5.5 5.5h8v8h-8z M2.5 10.5v-8h8',
  textFrame: 'M2.5 2.5h11v11h-11z M5 5h6 M8 5v6',
  pageNumber: 'M3.5 1.5h9v13h-9z M6.5 10.5h3 M7 8.5l1-1v3',
  arrange: 'M2.5 2.5h4.5v5H2.5z M9 2.5h4.5v5H9z M2.5 9.5h4.5v4H2.5z M9 9.5h4.5v4H9z',
  settings:
    'M8 5.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z M8 1.5v2 M8 12.5v2 M1.5 8h2 M12.5 8h2 M3.4 3.4l1.4 1.4 M11.2 11.2l1.4 1.4 M3.4 12.6l1.4-1.4 M11.2 4.8l1.4-1.4',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16, label }: { name: IconName; size?: number; label?: string }) {
  return (
    <svg
      className="i"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
