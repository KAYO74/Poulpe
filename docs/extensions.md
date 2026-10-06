# Écrire une extension Poulpe Design

Une extension est un fichier JavaScript (`.js`) qui ajoute des commandes au menu **Extensions**. On l'installe depuis Extensions > Gérer les extensions… > Installer depuis un fichier…. Trois exemples complets sont dans [`apps/editor/src/extensions/examples/`](../apps/editor/src/extensions/examples/).

## Le plus petit exemple

```js
poulpe.extension({ id: 'com.exemple.carre', name: 'Carré rouge', version: '1.0.0', author: 'Moi' });

poulpe.command({
  id: 'carre',
  title: { fr: 'Ajouter un carré rouge', en: 'Add a Red Square' },
  run: function () {
    var ab = poulpe.artboard();
    var id = poulpe.create({
      type: 'rect',
      x: ab.x + 20,
      y: ab.y + 20,
      width: 100,
      height: 100,
      fill: '#e03030',
    });
    poulpe.select([id]);
  },
});
```

## Ce qu'une extension peut faire

Le code tourne dans un interpréteur JavaScript isolé (QuickJS) : il n'y a ni `window`, ni `document`, ni `fetch`, ni accès aux fichiers. Une commande est arrêtée après 5 secondes de calcul ; la mémoire est limitée à 64 Mo. Tout passe par l'objet `poulpe` :

| Fonction                                                         | Rôle                                                                                                                                             |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `poulpe.extension({ id, name, version, description?, author? })` | Obligatoire, une fois. `id` : lettres, chiffres, points, tirets (par exemple `com.exemple.outil`).                                               |
| `poulpe.command({ id, title, params?, needsSelection?, run })`   | Ajoute une commande. `title` : texte, ou `{ fr, en }`. `run(réglages)` est appelée quand on choisit la commande.                                 |
| `poulpe.lang`                                                    | Langue de l'interface : `'fr'` ou `'en'`.                                                                                                        |
| `poulpe.document()`                                              | Nom du document et liste des plans de travail (`id`, `name`, `x`, `y`, `width`, `height`).                                                       |
| `poulpe.artboard()`                                              | Plan de travail actif, avec ses objets (`children`).                                                                                             |
| `poulpe.selection()`                                             | Copies des objets sélectionnés.                                                                                                                  |
| `poulpe.find(id)`                                                | Copie d'un objet, ou `null`.                                                                                                                     |
| `poulpe.create(forme)`                                           | Crée un objet, renvoie son id (voir ci-dessous). `parent` : id d'un plan de travail ou d'un groupe (par défaut le plan actif).                   |
| `poulpe.update(id, changements)`                                 | Change `x`, `y`, `width`, `height`, `rotation`, `opacity`, `name`, `visible`, `locked`, `fill`, `stroke`, `strokeWidth`, `cornerRadius`, `text`. |
| `poulpe.remove(id ou [ids])`                                     | Supprime des objets.                                                                                                                             |
| `poulpe.group([ids], nom?)`                                      | Groupe des objets, renvoie l'id du groupe.                                                                                                       |
| `poulpe.select([ids])`                                           | Change la sélection.                                                                                                                             |
| `poulpe.toast(message)`                                          | Affiche un court message.                                                                                                                        |
| `console.log(…)`                                                 | Écrit dans la console de développement.                                                                                                          |

Les coordonnées sont en pixels du document (pas relatives au plan de travail). Les couleurs s'écrivent `#rrggbb` ou `#rrggbbaa` ; `null` veut dire « aucun ».

Toutes les modifications d'une commande forment **une seule étape d'historique** : Ctrl+Z annule la commande en entier. Si la commande lève une erreur, rien n'est modifié et un message s'affiche.

### Formes

`poulpe.create({ type, … })` accepte `type` : `rect`, `ellipse`, `polygon` (`sides`), `star` (`points`, `innerRatio`), `line`, `text` (`text`, `fontSize`, `fontFamily`, `fontWeight`) et `path` (`d` : données de tracé SVG, en coordonnées du document ; la boîte suit le tracé). Communs : `x`, `y`, `width`, `height`, `name`, `fill`, `stroke`, `strokeWidth`, `opacity`, `rotation`, `cornerRadius` (rectangle).

### Réglages d'une commande

Avec `params`, Poulpe Design demande les réglages dans une fenêtre avant d'appeler `run(réglages)`. Chaque réglage : `{ id, label, type, default, … }` avec `type` :

- `number` (`min`, `max`, `step`),
- `text`,
- `color` (valeur `#rrggbb`),
- `boolean` (case à cocher),
- `select` (`options: [{ value, label }]`).

Les commandes d'extension s'enregistrent dans les macros avec leurs réglages, et peuvent recevoir un raccourci (Aide > Raccourcis clavier).

---

# Writing a Poulpe Design extension (English summary)

An extension is a single JavaScript file that adds commands to the **Extensions** menu. It runs in an isolated QuickJS interpreter (no `window`, network or file access; 5 s and 64 MB limits) and talks to Poulpe Design only through the `poulpe` object above: declare it with `poulpe.extension({ id, name, version })`, add commands with `poulpe.command({ id, title, params, run })`, then read the document (`document`, `artboard`, `selection`, `find`) and change it (`create`, `update`, `remove`, `group`, `select`). All changes made by one command are a single undo step. See the examples in `apps/editor/src/extensions/examples/`.
