// Code chargé dans l'interpréteur de chaque extension, avant elle : il définit l'objet `poulpe`.
// L'extension ne communique avec Poulpe que par __host(opération, arguments en JSON).
(function () {
  var host = globalThis.__host;
  delete globalThis.__host;
  function call(op, args) {
    var r = host(op, JSON.stringify(args === undefined ? null : args));
    return r === undefined ? undefined : JSON.parse(r);
  }
  var commands = {};
  function log(level) {
    return function () {
      var parts = [];
      for (var i = 0; i < arguments.length; i++) {
        var v = arguments[i];
        parts.push(typeof v === 'string' ? v : JSON.stringify(v));
      }
      call('log', level + ': ' + parts.join(' '));
    };
  }
  globalThis.console = { log: log('log'), info: log('info'), warn: log('warn'), error: log('error') };
  globalThis.poulpe = Object.freeze({
    /** Langue de l'interface : 'fr' ou 'en'. */
    get lang() {
      return call('lang');
    },
    extension: function (manifest) {
      call('manifest', manifest);
    },
    command: function (def) {
      if (!def || typeof def.run !== 'function') throw new Error('poulpe.command : il faut une fonction run');
      commands[def.id] = def.run;
      var meta = {};
      for (var k in def) if (k !== 'run') meta[k] = def[k];
      call('command', meta);
    },
    document: function () {
      return call('document');
    },
    artboard: function () {
      return call('artboard');
    },
    selection: function () {
      return call('selection');
    },
    find: function (id) {
      return call('find', { id: id });
    },
    create: function (spec) {
      return call('create', { spec: spec });
    },
    update: function (id, patch) {
      call('update', { id: id, patch: patch });
    },
    remove: function (ids) {
      call('remove', { ids: ids });
    },
    select: function (ids) {
      call('select', { ids: ids });
    },
    group: function (ids, name) {
      return call('group', { ids: ids, name: name });
    },
    toast: function (message) {
      call('toast', String(message));
    },
  });
  globalThis.__run = function (id, params) {
    var run = commands[id];
    if (!run) throw new Error('commande inconnue : ' + id);
    run(JSON.parse(params));
  };
})();
