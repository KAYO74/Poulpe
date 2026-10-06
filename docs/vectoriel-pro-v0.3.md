# Vectoriel pro v0.3 : état et organisation du code

5 octobre 2026

La v0.3 donne à Poulpe Design les outils de dessin vectoriel d'Illustrator et d'Affinity Designer : dessiner et modifier des courbes, combiner des formes, régler finement les contours, ajouter des effets, écrire le long d'une courbe et ouvrir des fichiers SVG.

## Ce que voit l'utilisateur

- **Plume** (P). Un clic pose un nœud net, un glisser pose une courbe. Un clic sur le premier nœud ferme le tracé, Entrée ou Échap le laisse ouvert, Retour arrière retire le dernier nœud.
- **Crayon** (N). Dessin à main levée, lissé au relâchement. Le curseur « Lissage » de la barre contextuelle règle la force du lissage.
- **Outil Nœud** (A, anciennement « Sélection directe »). Sur un tracé, il montre les nœuds et leurs poignées. On déplace un nœud ou une poignée, on clique sur un segment pour ajouter un nœud, on glisse un segment pour le courber, Suppr retire les nœuds choisis, un double-clic passe un nœud de net à lisse. La barre contextuelle propose Net, Lisse, Supprimer et Fermer / ouvrir. Sur une forme qui n'est pas un tracé, elle propose « Convertir en courbes ».
- **Géométrie** (Calque > Géométrie et cinq boutons de la barre d'outils) : union, soustraction, intersection, exclusion et division. Comme dans Affinity, le résultat prend le style de l'objet du dessous.
- **Calque** : Convertir en courbes (Ctrl+Entrée, textes compris), Contour en tracé (le contour devient une forme pleine) et Décaler le tracé… (agrandir ou rétrécir une forme d'une distance donnée).
- **Panneau Contour** : style plein ou pointillé (avec longueurs du trait et de l'espace), extrémités, jonctions, et flèches au début et à la fin des tracés ouverts.
- **Panneau Effets** (nouvel onglet du Studio) : ombre portée, ombre interne, lueur externe, lueur interne et flou, chacun avec sa case, sa couleur, son opacité, son décalage et son adoucissement. Les effets se voient aussi dans les exports PNG, JPEG et SVG ; dans le PDF, l'objet qui porte un effet est inclus en image.
- **Texte sur tracé** (menu Texte) : on sélectionne un texte et une forme, puis « Placer le texte sur le tracé ». Sur un cercle, le texte part du haut et se centre. Un curseur de la barre contextuelle le fait glisser le long de la courbe, et « Retirer du tracé » le remet à plat. Le texte reste modifiable, et peut aussi être converti en courbes.
- **Import SVG** : Fichier > Importer une image ou un SVG…, ou un glisser-déposer. Le SVG arrive en objets modifiables (tracés, formes, textes simples, dégradés, images intégrées), groupés et réduits s'ils dépassent le plan de travail.

## Organisation du code

| Où                                        | Quoi                                                                                                                             |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/bezier.ts`             | Calculs sur les courbes de Bézier : point, découpe, boîte exacte, point le plus proche, aplatissement.                           |
| `packages/core/src/pathEdit.ts`           | Modèle d'édition des tracés (sous-tracés, nœuds, poignées) et ses opérations.                                                    |
| `packages/core/src/vector.ts`             | Contours (extrémités, pointillés, flèches), conversion en tracé, mise en page du texte sur tracé.                                |
| `packages/core/src/boolean.ts`            | Opérations booléennes, décalage, contour en tracé et lissage, avec [Paper.js](http://paperjs.org) (MIT) et paperjs-offset (MIT). |
| `packages/core/src/effects.ts`            | Réglages par défaut des effets et marge qu'ils ajoutent autour d'un objet.                                                       |
| `packages/core/src/svgImport.ts`          | Lecture d'un fichier SVG en objets Poulpe Design.                                                                                |
| `packages/core/src/svg.ts`                | Export SVG : contours avancés, flèches, filtres d'effets, texte sur tracé.                                                       |
| `packages/render/src/index.ts`            | Rendu des contours avancés, du texte sur tracé et des effets (calques hors écran).                                               |
| `apps/editor/src/canvas/pathTools.ts`     | Plume, crayon et outil Nœud.                                                                                                     |
| `apps/editor/src/vectorActions.ts`        | Ce que font les commandes vectorielles sur le document.                                                                          |
| `apps/editor/src/textToCurves.ts`         | Conversion d'un texte en courbes à partir du fichier de sa police, avec [opentype.js](https://opentype.js.org) (MIT).            |
| `apps/editor/src/panels/StrokePanel.tsx`  | Panneau Contour.                                                                                                                 |
| `apps/editor/src/panels/EffectsPanel.tsx` | Panneau Effets.                                                                                                                  |

Le format de fichier passe en version 3 (voir [format-poulpe.md](format-poulpe.md)). Tous les nouveaux champs sont facultatifs : les fichiers des versions 1 et 2 s'ouvrent sans changement.

## Choix et écarts

- **Pas encore de CanvasKit.** La feuille de route prévoyait de passer le rendu à CanvasKit en v0.3 pour les opérations booléennes. Paper.js les fait très bien sans toucher au rendu, et le Canvas 2D actuel dessine tous les nouveaux contours et effets. CanvasKit ajouterait 7 Mo et une question de performance encore ouverte sous Linux ; on le garde pour quand il apportera un vrai gain (la retouche photo en v0.4, ou les gros fichiers).
- **Reporté à une v0.3.x :** symboles, styles de calque et de texte, dégradés coniques et de forme (mesh), motifs, épaisseur variable et contours multiples, OpenType avancé, colonnes et habillage, Shape Builder, ciseaux, couteau, outil coin, biseau. L'import SVG ignore pour l'instant les masques, les chemins d'écrêtage et les filtres.

## Tests

- `packages/core/test/v03.test.ts` : édition des tracés, opérations booléennes, décalage, import et export SVG, texte sur tracé, conversion en courbes.
- `apps/editor/e2e/vector.spec.ts` : plume, outil Nœud, crayon, géométrie, conversion et décalage, pointillés, flèches et effets, texte sur un cercle puis vectorisé, import SVG.
