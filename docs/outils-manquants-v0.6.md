# Outils Photoshop et Affinity manquants (v0.6) : état et organisation du code

5 octobre 2026

Les versions 0.3 et 0.4 avaient laissé de côté une série d'outils pour aller plus vite sur l'essentiel. La v0.6 les ajoute : tout ce que les versions précédentes annonçaient comme « reporté » dans le vectoriel et dans la photo est en place, et les deux limites connues de la v0.4 sont levées.

## Ce que voit l'utilisateur

### Persona Photo

- **Lasso polygonal** (P) : on clique les sommets, un double-clic ou Entrée ferme la sélection.
- **Sélection rapide** (Q) : on peint sur le sujet, la sélection s'étend aux pixels voisins de même couleur.
- **Correcteur** (Y) : Alt+clic choisit la source, puis on peint ; la texture de la source est posée en gardant la lumière de la zone corrigée (séparation de fréquences), ce qui efface une ride ou une poussière sans tache visible.
- **Doigt** (U) : étire les couleurs comme un doigt sur de la peinture fraîche.
- **Fluidité** (K) : pousser, tourbillonner, gonfler ou pincer les pixels, au choix dans la barre contextuelle.
- **Redressement** : on trace une ligne sur ce qui devrait être horizontal, la photo pivote d'autant.
- **Perspective** : quatre poignées aux coins, on les pose sur un rectangle réel (une façade, un tableau) et l'image se redresse.
- **Table LUT** : un nouveau calque de réglage. Six looks sont intégrés (sarcelle et orange, pellicule chaude, froid, délavé, sépia, noir et blanc contrasté) et un fichier `.cube` d'un autre logiciel s'ouvre directement.
- **Taille de l'image** et **taille de la zone de travail** (menu Document) : la première rééchantillonne, la seconde agrandit ou recadre le plan de travail autour d'une ancre.
- **La sélection de pixels fait désormais partie de l'historique** : Ctrl+Z annule une sélection comme une retouche.
- **Les calques de réglage appliquent tous les modes de fusion**, et plus seulement « normal ».

### Persona Dessin

- **Ciseaux** (C) : un clic sur le contour d'une forme l'ouvre à cet endroit (la forme devient une courbe).
- **Cutter** (K) : on trace une ligne en travers d'une forme, elle devient deux objets séparés. Sans rien de sélectionné, le cutter coupe tout ce que la ligne traverse ; un tracé ouvert est simplement séparé en morceaux.
- **Outil Coin** (X) : on glisse depuis un angle pour l'arrondir, Alt pour tous les angles du tracé à la fois. La barre contextuelle choisit entre arrondi et chanfrein, et un rayon appliqué d'un simple clic.
- **Constructeur de formes** (U) : on trace une ligne en travers de plusieurs formes pour les réunir, Alt pour soustraire.
- **Symboles** (menu Calque > Symboles et styles, panneau Bibliothèque > Styles) : créer un symbole depuis la sélection, poser d'autres instances, mettre le symbole à jour depuis une instance, détacher une instance. Modifier le symbole met à jour toutes ses instances.
- **Styles enregistrés** (même endroit) : « Enregistrer le style » met de côté l'apparence de l'objet sélectionné (remplissage, contours, effets, opacité, mode de fusion, et les réglages de caractère pour un texte) ; un clic l'applique ailleurs.
- **Dégradé conique** et **motif** dans l'onglet Couleur : le conique tourne autour d'un centre réglable, le motif répète une image à la taille et à l'angle voulus.
- **Contours multiples et à largeur variable** dans l'onglet Contour : « Contours en plus » empile plusieurs traits sous le contour principal (une bordure doublée en une fois), « Largeur » donne un profil calligraphique (pointue aux deux bouts, renflée, resserrée…), « Position » place le trait au centre, à l'intérieur ou à l'extérieur du tracé.
- **Biseau et estampage** dans l'onglet Effets : profondeur, angle de la lumière, adoucissement, intensité, couleurs de lumière et d'ombre.
- **Colonnes de texte** et **fonctions OpenType** dans l'onglet Caractère : nombre de colonnes et gouttière pour un cadre de largeur fixe ; petites capitales, ligatures, chiffres elzéviriens, fractions et variantes stylistiques.

Tout s'annule avec Ctrl+Z, s'enregistre dans le fichier `.poulpe` et apparaît dans les exports PNG, JPEG, SVG et PDF.

## Organisation du code

| Où                                        | Quoi                                                                                                                             |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/lut.ts`                | Tables de correspondance 3D : lecture et écriture des fichiers `.cube`, rangement compact dans le document, looks calculés.      |
| `packages/core/src/retouch.ts`            | Mathématiques de la retouche : homographie et redressement de perspective, déformations de fluidité, correcteur, rééchantillon.  |
| `packages/core/src/pathCut.ts`            | Ciseaux (couper un tracé en un point), cutter sur un tracé ouvert, outil Coin (arrondi et chanfrein).                            |
| `packages/core/src/boolean.ts`            | `applyKnife` coupe une forme pleine en deux par intersection avec deux demi-plans.                                               |
| `packages/core/src/strokeProfile.ts`      | Contours à largeur variable : profils proposés et contour transformé en forme pleine.                                            |
| `packages/core/src/symbols.ts`            | Symboles : contenu d'une instance ramené dans sa boîte, liste des instances.                                                     |
| `packages/core/src/styles.ts`             | Styles enregistrés : prendre l'apparence d'un objet, la reposer sur un autre.                                                    |
| `packages/core/src/editor.ts`             | `setExtraState` et `mark` : l'historique peut porter un état qui n'est pas dans le document (la sélection de pixels).            |
| `packages/core/src/text.ts`               | Colonnes de texte et fonctions OpenType dans la mise en lignes.                                                                  |
| `packages/core/src/svg.ts`                | Export du conique (par secteurs), des motifs, du biseau, des contours variables et du contenu des symboles.                      |
| `packages/render/src/index.ts`            | Rendu : peintures conique et motif, contours multiples et variables, biseau, instances de symbole, modes de fusion des réglages. |
| `apps/editor/src/photo/photoTools.ts`     | Lasso polygonal, sélection rapide, correcteur, doigt, fluidité, redressement, perspective.                                       |
| `apps/editor/src/photo/retouchActions.ts` | Commandes LUT, taille de l'image et de la zone de travail.                                                                       |
| `apps/editor/src/photo/selection.ts`      | La sélection de pixels, copiée par plages pour tenir dans l'historique.                                                          |
| `apps/editor/src/canvas/pathTools.ts`     | Ciseaux, cutter, outil Coin et constructeur de formes sur la toile.                                                              |
| `apps/editor/src/symbolActions.ts`        | Commandes des symboles et des styles enregistrés.                                                                                |
| `apps/editor/src/vectorActions.ts`        | Contours en plus, profils de largeur, motifs.                                                                                    |

Le format de fichier passe en version 7 (voir [format-poulpe.md](format-poulpe.md)) : objets `symbol`, `symbols` et `styles` du document, peintures `conic` et `pattern`, `align`, `profile` et `strokes` des contours, effet `bevel`, `features` et `columns` des textes, réglage `lut`. Les fichiers des versions 1 à 6 s'ouvrent sans changement.

## Choix et écarts

- **Le cutter d'une forme pleine passe par les booléens.** Couper une forme en deux revient à l'intersecter avec deux demi-plans très grands, de chaque côté de la ligne : le résultat est juste même sur des formes à trous ou à plusieurs sous-tracés, sans écrire un découpage géométrique de plus.
- **Dégradé conique.** La toile du navigateur sait le dessiner (`createConicGradient`) ; là où elle ne sait pas, Poulpe le remplace par des secteurs. SVG n'a pas de dégradé conique du tout : l'export l'approche aussi par des secteurs, à l'œil identique.
- **Fonctions OpenType : seules `smcp`, `c2sc` et `kern` changent le texte à l'écran**, car le Canvas 2D ne sait pas activer les autres. Les autres sont gardées dans le document et appliquées à l'export SVG et PDF ainsi qu'à la conversion en courbes ; l'onglet Caractère le dit quand c'est le cas.
- **Contours à largeur variable.** Le contour devient une forme pleine calculée par Poulpe, pour que la toile et le SVG donnent exactement le même dessin. Les pointillés et les flèches ne s'appliquent pas à un contour de largeur variable.
- **Biseau.** Le relief est simulé par deux copies décalées de la forme, l'une en lumière et l'autre en ombre, découpées à l'intérieur de la forme. C'est l'approche d'un effet de calque, pas un calcul d'éclairage : le résultat est net et rapide, sans WebGL.
- **Remplissage maillage :** pas dans cette version. Un vrai dégradé de maillage demande une grille de points de contrôle et un rendu dédié ; le conique, le radial et les motifs couvrent la plupart des besoins en attendant.
- **Reporté (v1.0) :** vectorisation d'images, détourage par IA locale, macros et extensions, mise à jour automatique.

## Tests

- `packages/core/test/v06.test.ts` : tables LUT (lecture `.cube`, aller-retour, interpolation, looks), homographie et redressement de perspective, fluidité, correcteur, rééchantillonnage, sélection de pixels dans l'historique, modes de fusion des calques de réglage.
- `packages/core/test/v07.test.ts` : ciseaux, cutter (tracé ouvert et forme pleine), outil Coin, profils de largeur, symboles (instances, SVG, symbole absent), styles enregistrés (objets et textes), colonnes de texte, fonctions OpenType, enregistrement et réouverture d'un fichier de version 7, ouverture d'un fichier de version 6.
- `apps/editor/e2e/photo-pro.spec.ts` : lasso polygonal, sélection rapide, annulation d'une sélection, correcteur, fluidité, redressement, perspective, look LUT, taille de l'image.
- `apps/editor/e2e/vector-pro.spec.ts` : ciseaux, cutter, constructeur de formes, outil Coin, symboles (créer, poser, détacher), styles enregistrés, contours en plus et profil, biseau et dégradé conique, colonnes et petites capitales.
