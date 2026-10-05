# Format de fichier `.poulpe` (version 4)

Un document Poulpe est une archive ZIP. Tout y est lisible avec des outils standard : un logiciel de décompression suffit pour récupérer les images d'origine et le document en JSON.

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
  "version": 3,
  "generator": "Poulpe 0.2.0",
  "created": "2026-10-04T09:43:00.000Z",
  "files": ["document.json", "assets/images/img_1a2b3c.png", "thumbnail.png"]
}
```

## document.json

| Champ        | Type              | Contenu                                                                                                                                |
| ------------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `format`     | `"poulpe"`        | Toujours `poulpe`.                                                                                                                     |
| `version`    | entier            | Version du format. Poulpe migre les anciennes versions et refuse proprement une version plus récente que la sienne.                    |
| `id`, `name` | texte             | Identifiant stable et nom du document.                                                                                                 |
| `artboards`  | liste             | Plans de travail, chacun avec `x`, `y`, `width`, `height`, `background` (peinture) et `children`.                                      |
| `swatches`   | liste de couleurs | Nuancier du document.                                                                                                                  |
| `assets`     | objet             | Images, par identifiant : `mime`, `width`, `height` et `path` dans l'archive.                                                          |
| `guides`     | objet, facultatif | Repères tirés depuis les règles : `x` (repères verticaux) et `y` (repères horizontaux), listes de positions dans l'espace du document. |

Toutes les coordonnées sont en pixels dans l'espace du document : un objet n'est pas relatif à son plan de travail. Chaque objet est une boîte `x`, `y`, `width`, `height` tournée de `rotation` degrés autour de son centre. Les listes `children` vont du dessous vers le dessus.

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

`style` d'un texte : `fontFamily`, `fontSize`, `fontWeight`, `italic`, `align` (`left`, `center`, `right`, `justify`), `lineHeight` (multiplicateur), `letterSpacing` (px), `underline`, `strike`, `uppercase`.

`runs` d'un texte : styles par caractère, triés et sans chevauchement. Chaque plage vaut `{ "start": 8, "end": 12, "style": { … } }` : elle couvre les caractères `start` à `end - 1` (indices UTF-16 de `text`) et ne contient que ce qui diffère du `style` du texte, parmi `fontFamily`, `fontSize`, `fontWeight`, `italic`, `underline`, `strike`, `letterSpacing` et `color` (couleur unie qui remplace le remplissage). L'alignement, l'interligne et les capitales valent pour tout le texte.

`d` d'un tracé : données de tracé SVG (commandes `M L H V C S Q T A Z`, absolues ou relatives), dans le repère `viewBox` (`{ "x", "y", "width", "height" }`). Le tracé est étiré pour remplir la boîte de l'objet. `fillRule` vaut `nonzero` (par défaut) ou `evenodd`.

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
```

L'angle d'un dégradé linéaire est en degrés (0 : de gauche à droite, 90 : de haut en bas) et la ligne du dégradé couvre toute la boîte, comme en CSS. Le centre et le rayon d'un dégradé radial sont des fractions de la boîte (le rayon, de sa plus grande dimension).

Un contour vaut `{ "paint": <peinture>, "width": <px> }`, centré sur le tracé. Champs facultatifs (version 3) :

| Champ          | Valeurs                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| `cap`          | `butt`, `round` (par défaut), `square` : extrémités des traits                                         |
| `join`         | `miter`, `round` (par défaut), `bevel` : jonctions des traits                                          |
| `dash`         | longueurs alternées trait / espace, en multiples de l'épaisseur (`[3, 2]`) ; absent : trait plein      |
| `start`, `end` | `none`, `triangle`, `arrow`, `circle`, `square`, `bar` : flèche au début et à la fin d'un tracé ouvert |

### Effets

`effects` est une liste d'au plus un effet de chaque type, dessinés dans cet ordre : ombre portée et lueur externe sous l'objet, l'objet lui-même (flouté par `blur`), puis ombre interne et lueur interne à l'intérieur de l'objet. Chaque effet a `type` et `enabled` (un effet désactivé est gardé avec ses réglages). Couleurs avec transparence (`#rrggbbaa`), distances en pixels.

```json
{ "type": "dropShadow", "enabled": true, "color": "#00000066", "x": 4, "y": 6, "blur": 10 }
{ "type": "innerShadow", "enabled": true, "color": "#00000066", "x": 2, "y": 3, "blur": 6 }
{ "type": "outerGlow", "enabled": true, "color": "#ffd166cc", "blur": 12 }
{ "type": "innerGlow", "enabled": true, "color": "#ffffffaa", "blur": 8 }
{ "type": "blur", "enabled": true, "radius": 4 }
```

### Masques de calque

`mask` vaut `{ "assetId": "img_…", "enabled": true }`. L'image désignée (PNG) est étirée sur la boîte de l'objet, comme une image ; seule son opacité compte : opaque, l'objet est visible, transparent, il est caché. Un masque désactivé (`enabled: false`) est gardé mais n'agit pas.

Un objet `image` retouché (pinceau, gomme, gomme magique, filtres) pointe simplement vers une nouvelle image PNG dans `assets` : l'image d'origine n'est jamais modifiée sur place.

### Calques de réglage

Un objet `adjustment` modifie tout ce qui est dessous lui dans le même parent (plan de travail ou groupe), sans toucher aux pixels : on peut le régler, le masquer ou le supprimer à tout moment. Son `opacity` dose l'effet, son `mask` le limite à une zone. Seul le mode de fusion `normal` est appliqué pour l'instant. Le champ `adjustment` a un `kind` et ses réglages :

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

## Versions

- **1** (Poulpe 0.1) : version initiale.
- **2** (Poulpe 0.2) : ajout des objets `path`. Un fichier de version 1 s'ouvre sans changement ; un fichier de version 2 ne s'ouvre pas dans Poulpe 0.1.
- **3** (Poulpe 0.3) : contours avancés (`cap`, `join`, `dash`, `start`, `end`), `effects` sur tous les objets, `path` sur les textes. Tous ces champs sont facultatifs : un fichier de version 1 ou 2 s'ouvre sans changement ; un fichier de version 3 ne s'ouvre pas dans Poulpe 0.2.
- **4** (Poulpe 0.4) : objets `adjustment` (calques de réglage et filtres dynamiques) et `mask` sur tous les objets. Un fichier des versions 1 à 3 s'ouvre sans changement ; un fichier de version 4 ne s'ouvre pas dans Poulpe 0.3.
