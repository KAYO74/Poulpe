// Exemple d'extension Poulpe : remplit le plan de travail d'une grille de formes.
poulpe.extension({
  id: 'org.poulpe.grid',
  name: 'Grille de formes',
  version: '1.0.0',
  description: 'Remplit le plan de travail d’une grille de cercles, de carrés ou d’étoiles.',
  author: 'Poulpe',
});

poulpe.command({
  id: 'make',
  title: { fr: 'Grille de formes…', en: 'Shape Grid…' },
  params: [
    { id: 'cols', label: { fr: 'Colonnes', en: 'Columns' }, type: 'number', default: 6, min: 1, max: 50 },
    { id: 'rows', label: { fr: 'Lignes', en: 'Rows' }, type: 'number', default: 6, min: 1, max: 50 },
    { id: 'gap', label: { fr: 'Espace', en: 'Gap' }, type: 'number', default: 12, min: 0, max: 500 },
    {
      id: 'shape',
      label: { fr: 'Forme', en: 'Shape' },
      type: 'select',
      default: 'ellipse',
      options: [
        { value: 'ellipse', label: { fr: 'Cercle', en: 'Circle' } },
        { value: 'rect', label: { fr: 'Carré', en: 'Square' } },
        { value: 'star', label: { fr: 'Étoile', en: 'Star' } },
      ],
    },
    { id: 'color', label: { fr: 'Couleur', en: 'Color' }, type: 'color', default: '#2ba59a' },
    { id: 'shade', label: { fr: 'Dégradé de teinte', en: 'Hue gradient' }, type: 'boolean', default: true },
  ],
  run: function (p) {
    var ab = poulpe.artboard();
    var cw = (ab.width - p.gap * (p.cols + 1)) / p.cols;
    var ch = (ab.height - p.gap * (p.rows + 1)) / p.rows;
    var size = Math.max(1, Math.min(cw, ch));
    var ids = [];
    for (var r = 0; r < p.rows; r++)
      for (var c = 0; c < p.cols; c++) {
        var color = p.color;
        if (p.shade) {
          var hue = Math.round(((r * p.cols + c) / (p.rows * p.cols)) * 360);
          color = hsl(hue, 60, 55);
        }
        ids.push(
          poulpe.create({
            type: p.shape,
            x: ab.x + p.gap + c * (cw + p.gap) + (cw - size) / 2,
            y: ab.y + p.gap + r * (ch + p.gap) + (ch - size) / 2,
            width: size,
            height: size,
            fill: color,
            stroke: null,
          }),
        );
      }
    poulpe.select([poulpe.group(ids, poulpe.lang === 'fr' ? 'Grille' : 'Grid')]);
  },
});

function hsl(h, s, l) {
  s /= 100;
  l /= 100;
  var k = function (n) {
    return (n + h / 30) % 12;
  };
  var a = s * Math.min(l, 1 - l);
  var f = function (n) {
    var v = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return ('0' + Math.round(v * 255).toString(16)).slice(-2);
  };
  return '#' + f(0) + f(8) + f(4);
}
