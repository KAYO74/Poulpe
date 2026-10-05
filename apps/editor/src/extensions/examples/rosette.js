// Exemple d'extension Poulpe : dessine une rosace (courbe de spirographe) en un seul tracé.
poulpe.extension({
  id: 'org.poulpe.rosette',
  name: 'Rosace',
  version: '1.0.0',
  description: 'Dessine une rosace de spirographe au centre du plan de travail.',
  author: 'Poulpe',
});

poulpe.command({
  id: 'draw',
  title: { fr: 'Rosace…', en: 'Rosette…' },
  params: [
    { id: 'petals', label: { fr: 'Pétales', en: 'Petals' }, type: 'number', default: 7, min: 2, max: 60 },
    { id: 'depth', label: { fr: 'Profondeur', en: 'Depth' }, type: 'number', default: 60, min: 5, max: 95 },
    { id: 'color', label: { fr: 'Couleur', en: 'Color' }, type: 'color', default: '#7a4fd6' },
    { id: 'width', label: { fr: 'Épaisseur', en: 'Width' }, type: 'number', default: 4, min: 1, max: 40 },
  ],
  run: function (p) {
    var ab = poulpe.artboard();
    var R = Math.min(ab.width, ab.height) * 0.4;
    var cx = ab.x + ab.width / 2,
      cy = ab.y + ab.height / 2;
    var k = p.depth / 100;
    var steps = 720;
    var d = '';
    for (var i = 0; i <= steps; i++) {
      var t = (i / steps) * Math.PI * 2;
      var r = R * (1 - k + k * Math.abs(Math.cos((p.petals * t) / 2)));
      d += (i ? 'L' : 'M') + (cx + r * Math.cos(t)).toFixed(2) + ' ' + (cy + r * Math.sin(t)).toFixed(2);
    }
    var id = poulpe.create({
      type: 'path',
      d: d + 'Z',
      fill: null,
      stroke: p.color,
      strokeWidth: p.width,
      name: 'Rosace',
    });
    poulpe.select([id]);
  },
});
