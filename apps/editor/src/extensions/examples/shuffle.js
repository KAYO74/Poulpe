// Exemple d'extension Poulpe : donne des couleurs au hasard aux objets sélectionnés.
poulpe.extension({
  id: 'org.poulpe.shuffle',
  name: 'Couleurs au hasard',
  version: '1.0.0',
  description: 'Recolore les objets sélectionnés avec une palette harmonieuse tirée au hasard.',
  author: 'Poulpe',
});

poulpe.command({
  id: 'shuffle',
  title: { fr: 'Couleurs au hasard', en: 'Random Colors' },
  needsSelection: true,
  run: function () {
    var base = Math.random() * 360;
    var items = poulpe.selection();
    var n = 0;
    walk(items, function (node) {
      if (!node.fill || node.type === 'image' || node.type === 'adjustment') return;
      // Teintes voisines (harmonie analogue), clartés variées.
      var hue = (base + (n % 5) * 24) % 360;
      var light = 40 + ((n * 17) % 35);
      poulpe.update(node.id, { fill: hsl(hue, 65, light) });
      n++;
    });
    if (!n) poulpe.toast(poulpe.lang === 'fr' ? 'Aucune forme à recolorer.' : 'No shape to recolor.');
  },
});

function walk(nodes, fn) {
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i].type === 'group') walk(nodes[i].children, fn);
    else fn(nodes[i]);
  }
}

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
