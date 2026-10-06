# Format de fichier `.poulpe` (version 4)

Un document Poulpe Design est une archive ZIP. Tout y est lisible avec des outils standard : un logiciel de décompression suffit pour récupérer les images d'origine et le document en JSON.

```
affiche.poulpe (ZIP)
├── manifest.json        version du format, appli d'origine, liste des fichiers (non compressé, en premier)
├── document.json        le document
├── assets/images/       images importées, telles quelles (jamais recompressées), pixels retouchés et masques (PNG)
└── thumbnail.png        aperçu du premier plan de travail, 256 px au plus (facultatif)
```

Le code de lecture et d'écriture est dans [`packages/core/src/file.ts`](../packages/core/src/file.ts), et les types dans [`packages/core/src/types.ts`](../packages/core/src/types.ts).

## manifest.json

```json
{
  "format": "poulpe",
  "version": 4,
  "generator": "Poulpe Design 0.2.0",
  "created": "2026-10-04T09:43:00.000Z",
  "files": ["document.json", "assets/images/img_1a2b3c.png", "thumbnail.png"]
}
```

## document.json

| Champ        | Type              | Contenu                                                                                                                                |
| ------------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `format`     | `"poulpe"`        | Toujours `poulpe`.                                                                                                                     |
| `version`    | entier            | Version du format. Poulpe Design migre les anciennes versions et refuse proprement une version plus récente que la sienne.             |
| `id`, `name` | texte             | Identifiant stable et nom du document.                                                                                                 |
| `artboards`  | liste             | Plans de travail, chacun avec `x`, `y`, `width`, `height`, `background` (peinture) et `children`.                                      |
| `swatches`   | liste de couleurs | Nuancier du document.                                                                                                                  |
| `assets`     | objet             | Images, par identifiant : `mime`, `width`, `height` et `path` dans l'archive.                                                          |
| `guides`     | objet, facultatif | Repères tirés depuis les règles : `x` (repères verticaux) et `y` (repères horizontaux), listes de positions dans l'espace du document. |
| `layout`     | objet, facultatif | Mise en page et impression (version 4), voir plus bas.                                                                                 |

Toutes les coordonnées sont en pixels dans l'espace du document : un objet n'est pas relatif à son plan de travail. Chaque objet est une boîte `x`, `y`, `width`, `height` tournée de `rotation` degrés autour de son centre. Les listes `children` vont du dessous vers le dessus.

### Pages et pages maîtres (version 5)

Une page est un plan de travail ; l'ordre des pages est celui de `artboards`. Deux champs facultatifs s'ajoutent aux plans de travail :

| Champ      | Contenu                                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------------------------------- |
| `master`   | `true` : page maître. Elle n'est pas une page (pas de numéro, pas exportée avec « toutes les pages »).               |
| `masterId` | Identifiant de la page maître de cette page. Ses objets sont dessinés sous ceux de la page, au même endroit relatif. |

`layout` du document :

| Champ         | Contenu                                                                                                   |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| `dpi`         | Pixels par pouce (96 si absent). Donne la taille réelle des pages à l'impression et dans le PDF.          |
| `bleed`       | Fond perdu autour de chaque page, en pixels.                                                              |
| `margins`     | `{ "top", "bottom", "inside", "outside" }` en pixels ; `inside` est du côté de la reliure.                |
| `facing`      | `true` : pages en vis-à-vis (page 1 seule à droite, puis doubles pages ; les pages paires sont à gauche). |
| `firstNumber` | Numéro de la première page (1 si absent).                                                                 |

Version 6, pour l'impression (facultatifs) :

| Champ       | Contenu                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------- |
| `colorMode` | `"rgb"` (par défaut) ou `"cmyk"` : le document est destiné à l'imprimerie (saisie CMJN, épreuvage, PDF CMJN). |
| `cmyk`      | Valeurs CMJN exactes saisies par l'utilisateur, par couleur : `{ "#00a0e6": [100, 0, 0, 0] }` (de 0 à 100).   |

### Objets

Champs communs : `id`, `name`, `x`, `y`, `width`, `height`, `rotation`, `opacity` (0 à 1), `blendMode`, `visible`, `locked`, `effects` et `mask` (facultatifs, voir plus bas).

| `type`       | Champs propres                                                                          |
| ------------ | --------------------------------------------------------------------------------------- |
| `rect`       | `fill`, `stroke`, `cornerRadius`                                                        |
| `ellipse`    | `fill`, `stroke`                                                                        |
| `polygon`    | `fill`, `stroke`, `sides`                                                               |
| `star`       | `fill`, `stroke`, `points`, `innerRatio`                                                |
| `path`       | `fill`, `stroke`, `d`, `viewBox`, `fillRule` (facultatif)                               |
| `line`       | `stroke`, `direction` (1 : haut gauche vers bas droit, -1 : bas gauche vers haut droit) |
| `text`       | `text`, `style`, `fill`, `stroke`, `autoWidth`, `runs` et `path` (facultatifs)          |
| `image`      | `assetId`, `crop` (facultatif)                                                          |
| `group`      | `children`, `clip` (l'objet du dessous sert de masque d'écrêtage)                       |
| `adjustment` | `adjustment` : réglage ou filtre dynamique (voir « Calques de réglage »)                |
| `symbol`     | `symbolId` : instance d'un symbole du document (version 7, voir « Symboles »)           |

`style` d'un texte : `fontFamily`, `fontSize`, `fontWeight`, `italic`, `align` (`left`, `center`, `right`, `justify`), `lineHeight` (multiplicateur), `letterSpacing` (px), `underline`, `strike`, `uppercase`. Facultatifs (version 7) : `features`, la liste des fonctions OpenType actives (`smcp`, `c2sc`, `kern`, `liga`, `dlig`, `onum`, `tnum`, `frac`, `ss01`), et `columns`, les colonnes du bloc : `{ "count": 2, "gap": 16 }` (`gap` en pixels). Un lecteur qui ne les connaît pas affiche le texte sur une colonne, sans ces fonctions : le document reste juste.

`runs` d'un texte : styles par caractère, triés et sans chevauchement. Chaque plage vaut `{ "start": 8, "end": 12, "style": { … } }` : elle couvre les caractères `start` à `end - 1` (indices UTF-16 de `text`) et ne contient que ce qui diffère du `style` du texte, parmi `fontFamily`, `fontSize`, `fontWeight`, `italic`, `underline`, `strike`, `letterSpacing` et `color` (couleur unie qui remplace le remplissage). L'alignement, l'interligne et les capitales valent pour tout le texte.

`d` d'un tracé : données de tracé SVG (commandes `M L H V C S Q T A Z`, absolues ou relatives), dans le repère `viewBox` (`{ "x", "y", "width", "height" }`). Le tracé est étiré pour remplir la boîte de l'objet. `fillRule` vaut `nonzero` (par défaut) ou `evenodd`.

`frame` d'un texte (version 4) : `true` pour un cadre de texte, dont la hauteur reste fixe ; le texte qui ne tient pas est caché, ou passe au cadre suivant. `next` : identifiant du cadre suivant d'une chaîne de cadres liés. Le premier cadre de la chaîne porte le texte, son style et ses plages ; le `text` des cadres suivants est ignoré (vide).

Champs d'un texte (version 4) : `{page}` est remplacé à l'affichage par le numéro de la page, `{pages}` par le nombre de pages. Sur une page maître, ils s'affichent « # » ; sur une page qui l'utilise, ils prennent les valeurs de cette page.

`path` d'un texte : courbe que suit le texte, `{ "d", "viewBox", "offset" }`. `d` et `viewBox` se lisent comme ceux d'un tracé, étirés sur la boîte du texte. `offset` (0 à 1) place le texte le long de la courbe : son début s'il est aligné à gauche, son milieu s'il est centré, sa fin s'il est aligné à droite. Un texte sur tracé ne passe pas à la ligne.

`crop` d'une image : partie de l'image source affichée dans la boîte de l'objet, `{ "x", "y", "width", "height" }` en fractions (0 à 1) de l'image. Sans `crop`, l'image entière remplit la boîte.

`blendMode` : `normal`, `multiply`, `screen`, `overlay`, `darken`, `lighten`, `color-dodge`, `color-burn`, `hard-light`, `soft-light`, `difference`, `exclusion`, `hue`, `saturation`, `color`, `luminosity` (mêmes noms qu'en CSS).

### Peintures

Les couleurs sont en hexadécimal `#rrggbb` ou `#rrggbbaa`.

```json
{ "type": "none" }
{ "type": "solid", "color": "#2ba59a" }
{ "type": "linear", "angle": 90, "stops": [{ "offset": 0, "color": "#2ba59a" }, { "offset": 1, "color": "#ffffff" }] }
{ "type": "radial", "cx": 0.5, "cy": 0.5, "r": 0.5, "stops": [ … ] }
{ "type": "conic", "angle": 0, "cx": 0.5, "cy": 0.5, "stops": [ … ] }
{ "type": "pattern", "assetId": "img_…", "scale": 1, "angle": 0 }
```

L'angle d'un dégradé linéaire est en degrés (0 : de gauche à droite, 90 : de haut en bas) et la ligne du dégradé couvre toute la boîte, comme en CSS. Le centre et le rayon d'un dégradé radial sont des fractions de la boîte (le rayon, de sa plus grande dimension).

Un dégradé conique (version 7) tourne autour de son centre : `angle` donne la direction de l'arrêt 0, les `offset` des arrêts sont des fractions du tour. Un motif (version 7) répète l'image `assetId` ; `scale` multiplie la taille de la tuile et `angle` la fait tourner. Le SVG exporté approche un dégradé conique par des secteurs, car SVG n'en a pas.

Un contour vaut `{ "paint": <peinture>, "width": <px> }`, centré sur le tracé. Champs facultatifs (version 3) :

| Champ          | Valeurs                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| `cap`          | `butt`, `round` (par défaut), `square` : extrémités des traits                                         |
| `join`         | `miter`, `round` (par défaut), `bevel` : jonctions des traits                                          |
| `dash`         | longueurs alternées trait / espace, en multiples de l'épaisseur (`[3, 2]`) ; absent : trait plein      |
| `start`, `end` | `none`, `triangle`, `arrow`, `circle`, `square`, `bar` : flèche au début et à la fin d'un tracé ouvert |
| `align`        | `center` (par défaut), `inside`, `outside` : position du trait par rapport au tracé (version 7)        |
| `profile`      | largeur variable : multiplicateurs de l'épaisseur du début (0) à la fin (1), `[0.05, 1, 0.05]` (v. 7)  |

Un objet peut aussi porter `strokes` (version 7) : des contours dessinés **sous** son `stroke`, du premier au dernier de la liste. Un lecteur qui ne connaît pas `strokes` n'affiche que le contour principal.

### Effets

`effects` est une liste d'au plus un effet de chaque type, dessinés dans cet ordre : ombre portée et lueur externe sous l'objet, l'objet lui-même (flouté par `blur`), puis ombre interne et lueur interne à l'intérieur de l'objet. Chaque effet a `type` et `enabled` (un effet désactivé est gardé avec ses réglages). Couleurs avec transparence (`#rrggbbaa`), distances en pixels.

```json
{ "type": "dropShadow", "enabled": true, "color": "#00000066", "x": 4, "y": 6, "blur": 10 }
{ "type": "innerShadow", "enabled": true, "color": "#00000066", "x": 2, "y": 3, "blur": 6 }
{ "type": "outerGlow", "enabled": true, "color": "#ffd166cc", "blur": 12 }
{ "type": "innerGlow", "enabled": true, "color": "#ffffffaa", "blur": 8 }
{ "type": "blur", "enabled": true, "radius": 4 }
{ "type": "bevel", "enabled": true, "style": "bevel", "angle": 135, "depth": 6, "softness": 4, "intensity": 70, "light": "#ffffff", "shadow": "#000000" }
```

Le biseau (version 7) simule un relief éclairé depuis `angle` degrés : `depth` en pixels, `softness` adoucit l'arête, `intensity` (0 à 100) dose lumière et ombre. `style` vaut `bevel` (relief vers l'extérieur) ou `emboss` (vers l'intérieur).

### Masques de calque

`mask` vaut `{ "assetId": "img_…", "enabled": true }`. L'image désignée (PNG) est étirée sur la boîte de l'objet, comme une image ; seule son opacité compte : opaque, l'objet est visible, transparent, il est caché. Un masque désactivé (`enabled: false`) est gardé mais n'agit pas.

Un objet `image` retouché (pinceau, gomme, gomme magique, filtres) pointe simplement vers une nouvelle image PNG dans `assets` : l'image d'origine n'est jamais modifiée sur place.

### Calques de réglage

Un objet `adjustment` modifie tout ce qui est dessous lui dans le même parent (plan de travail ou groupe), sans toucher aux pixels : on peut le régler, le masquer ou le supprimer à tout moment. Son `opacity` dose l'effet, son `mask` le limite à une zone. Le champ `adjustment` a un `kind` et ses réglages :

| `kind`               | Réglages                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------- |
| `brightnessContrast` | `brightness`, `contrast` (−100 à 100)                                                        |
| `levels`             | `black`, `white`, `outBlack`, `outWhite` (0 à 255), `gamma` (0,1 à 10)                       |
| `curves`             | `rgb`, `r`, `g`, `b` : points `[entrée, sortie]` de 0 à 1                                    |
| `exposure`           | `exposure` (IL, −5 à 5), `offset`, `gamma`                                                   |
| `hsl`                | `hue` (−180 à 180), `saturation`, `lightness` (−100 à 100)                                   |
| `vibrance`           | `vibrance`, `saturation` (−100 à 100)                                                        |
| `whiteBalance`       | `temperature`, `tint` (−100 à 100)                                                           |
| `colorBalance`       | `shadows`, `midtones`, `highlights` : `[cyan↔rouge, magenta↔vert, jaune↔bleu]` de −100 à 100 |
| `blackWhite`         | `red`, `green`, `blue` : part de chaque canal en %                                           |
| `photoFilter`        | `color`, `density` (0 à 100)                                                                 |
| `gradientMap`        | `stops` : arrêts de dégradé, du plus sombre au plus clair                                    |
| `invert`             | (aucun)                                                                                      |
| `threshold`          | `level` (0 à 255)                                                                            |
| `posterize`          | `levels` (2 à 32)                                                                            |
| `gaussianBlur`       | `radius` (px du document)                                                                    |
| `unsharpMask`        | `amount` (%), `radius` (px), `threshold` (0 à 255)                                           |
| `clarity`            | `amount` (−100 à 100)                                                                        |
| `noise`              | `amount` (%), `monochrome`                                                                   |
| `vignette`           | `amount` (−100 à 100), `size`, `softness` (0 à 100)                                          |
| `pixelate`           | `size` (px du document)                                                                      |

Un logiciel qui ne connaît pas les calques de réglage peut les ignorer : le reste du document reste juste, seules les corrections manquent.

Depuis la version 7, le `blendMode` d'un calque de réglage est appliqué comme celui d'un objet ordinaire.

### Symboles et styles enregistrés (version 7)

`symbols` range les symboles du document, par identifiant :

```json
"symbols": {
  "sym_a1": {
    "id": "sym_a1",
    "name": "Puce",
    "box": { "x": 0, "y": 0, "width": 24, "height": 24 },
    "children": [ … ]
  }
}
```

Les objets d'un symbole sont exprimés dans sa `box`. Chaque objet `symbol` du document les ramène dans sa propre boîte (position, taille et rotation comprises), si bien que modifier le symbole met à jour toutes ses instances. Un lecteur qui ne connaît pas les symboles peut dessiner le contenu du symbole à la place de l'instance, ou l'ignorer.

`styles` est la liste des styles enregistrés. Chaque style porte `id`, `name` et seulement ce qu'il applique : `fill`, `stroke`, `strokes`, `effects`, `opacity`, `blendMode` et `text` (réglages de caractère, pour les textes). Les champs absents ne touchent pas à l'objet. Les styles ne changent rien à l'affichage du document : ils sont là pour l'interface.

## Versions

- **1** (Poulpe Design 0.1) : version initiale.
- **2** (Poulpe Design 0.2) : ajout des objets `path`. Un fichier de version 1 s'ouvre sans changement ; un fichier de version 2 ne s'ouvre pas dans Poulpe Design 0.1.
- **3** (Poulpe Design 0.3) : contours avancés (`cap`, `join`, `dash`, `start`, `end`), `effects` sur tous les objets, `path` sur les textes. Tous ces champs sont facultatifs : un fichier de version 1 ou 2 s'ouvre sans changement ; un fichier de version 3 ne s'ouvre pas dans Poulpe Design 0.2.
- **4** (Poulpe Design 0.4) : objets `adjustment` (calques de réglage et filtres dynamiques) et `mask` sur tous les objets. Un fichier des versions 1 à 3 s'ouvre sans changement ; un fichier de version 4 ne s'ouvre pas dans Poulpe Design 0.3.
- **5** (Poulpe Design 0.5, mise en page) : `layout` du document, `master` et `masterId` des plans de travail, `frame` et `next` des textes, champs `{page}` et `{pages}`. Tous facultatifs : les fichiers des versions 1 à 4 s'ouvrent sans changement ; un fichier de version 5 ne s'ouvre pas dans Poulpe Design 0.4.
- **7** (Poulpe Design 0.6, outils vectoriels) : objets `symbol`, `symbols` et `styles` du document, peintures `conic` et `pattern`, `align`, `profile` et `strokes` des contours, effet `bevel`, `features` et `columns` des textes. Tous facultatifs : les fichiers des versions 1 à 6 s'ouvrent sans changement ; un fichier de version 7 ne s'ouvre pas dans Poulpe Design 0.5.
- **6** (Poulpe Design 0.5, impression) : `colorMode` et `cmyk` dans `layout`. Facultatifs : les fichiers des versions 1 à 5 s'ouvrent sans changement ; un fichier de version 6 ne s'ouvre pas dans une version de Poulpe Design qui ne connaît que la version 5.
