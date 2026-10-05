# Format de fichier `.poulpe` (version 1)

Un document Poulpe est une archive ZIP. Tout y est lisible avec des outils standard : un logiciel de décompression suffit pour récupérer les images d'origine et le document en JSON.

```
affiche.poulpe (ZIP)
├── manifest.json        version du format, appli d'origine, liste des fichiers (non compressé, en premier)
├── document.json        le document
├── assets/images/       images importées, telles quelles (jamais recompressées)
└── thumbnail.png        aperçu du premier plan de travail, 256 px au plus (facultatif)
```

Le code de lecture et d'écriture est dans [`packages/core/src/file.ts`](../packages/core/src/file.ts), et les types dans [`packages/core/src/types.ts`](../packages/core/src/types.ts).

## manifest.json

```json
{
  "format": "poulpe",
  "version": 1,
  "generator": "Poulpe 0.1.0",
  "created": "2026-10-04T09:43:00.000Z",
  "files": ["document.json", "assets/images/img_1a2b3c.png", "thumbnail.png"]
}
```

## document.json

| Champ | Type | Contenu |
| --- | --- | --- |
| `format` | `"poulpe"` | Toujours `poulpe`. |
| `version` | entier | Version du format. Poulpe migre les anciennes versions et refuse proprement une version plus récente que la sienne. |
| `id`, `name` | texte | Identifiant stable et nom du document. |
| `artboards` | liste | Plans de travail, chacun avec `x`, `y`, `width`, `height`, `background` (peinture) et `children`. |
| `swatches` | liste de couleurs | Nuancier du document. |
| `assets` | objet | Images, par identifiant : `mime`, `width`, `height` et `path` dans l'archive. |
| `guides` | objet, facultatif | Repères tirés depuis les règles : `x` (repères verticaux) et `y` (repères horizontaux), listes de positions dans l'espace du document. |

Toutes les coordonnées sont en pixels dans l'espace du document : un objet n'est pas relatif à son plan de travail. Chaque objet est une boîte `x`, `y`, `width`, `height` tournée de `rotation` degrés autour de son centre. Les listes `children` vont du dessous vers le dessus.

### Objets

Champs communs : `id`, `name`, `x`, `y`, `width`, `height`, `rotation`, `opacity` (0 à 1), `blendMode`, `visible`, `locked`.

| `type` | Champs propres |
| --- | --- |
| `rect` | `fill`, `stroke`, `cornerRadius` |
| `ellipse` | `fill`, `stroke` |
| `polygon` | `fill`, `stroke`, `sides` |
| `star` | `fill`, `stroke`, `points`, `innerRatio` |
| `line` | `stroke`, `direction` (1 : haut gauche vers bas droit, -1 : bas gauche vers haut droit) |
| `text` | `text`, `style`, `fill`, `stroke`, `autoWidth`, `runs` (facultatif) |
| `image` | `assetId`, `crop` (facultatif) |
| `group` | `children`, `clip` (l'objet du dessous sert de masque d'écrêtage) |

`style` d'un texte : `fontFamily`, `fontSize`, `fontWeight`, `italic`, `align` (`left`, `center`, `right`, `justify`), `lineHeight` (multiplicateur), `letterSpacing` (px), `underline`, `strike`, `uppercase`.

`runs` d'un texte : styles par caractère, triés et sans chevauchement. Chaque plage vaut `{ "start": 8, "end": 12, "style": { … } }` : elle couvre les caractères `start` à `end - 1` (indices UTF-16 de `text`) et ne contient que ce qui diffère du `style` du texte, parmi `fontFamily`, `fontSize`, `fontWeight`, `italic`, `underline`, `strike`, `letterSpacing` et `color` (couleur unie qui remplace le remplissage). L'alignement, l'interligne et les capitales valent pour tout le texte.

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

Un contour vaut `{ "paint": <peinture>, "width": <px> }`, centré sur le tracé.
