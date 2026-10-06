# Mise en page v0.5 (première partie) : état et organisation du code

5 octobre 2026

Cette première partie de la v0.5 donne à Poulpe Design ce qui fait d'Affinity Publisher un logiciel de mise en page : des documents de plusieurs pages, des pages maîtres, des numéros de page, du texte qui coule d'un cadre à l'autre, et un PDF prêt pour l'imprimeur.

## Ce que voit l'utilisateur

- **Persona Mise en page.** Le troisième bouton en haut à gauche (à côté de Dessin) ouvre la Persona Mise en page. Le panneau Pages remplace la Bibliothèque, et la barre d'outils propose les actions de mise en page (ajouter une page, nouvelle page maître, réglages du document, cadre de texte, lier, délier, numéro de page). Les opérations booléennes restent dans la Persona Dessin. Un document de plusieurs pages s'ouvre directement dans la Persona Mise en page.
- **Nouveau document d'impression.** Dans « Nouveau document », les formats d'impression (A4, A5, A3, Lettre, carte de visite…) sont à 300 ppp, et on choisit le nombre de pages et les pages en vis-à-vis.
- **Panneau Pages.** Les pages maîtres en haut, les pages en dessous (en doubles pages si le document est en vis-à-vis), avec leur miniature, leur numéro et la lettre de leur page maître. Un clic affiche la page, un glisser la déplace, une page maître glissée sur une page s'y applique. En bas : la page maître de la page active, ajouter, dupliquer, supprimer, et réorganiser. Les pages se rangent toutes seules, en colonne ou en doubles pages.
- **Pages maîtres.** Ce qui est posé sur une page maître (bandeau, logo, numéro de page) apparaît sous le contenu de chaque page qui l'utilise, à l'écran, dans les miniatures et dans tous les exports.
- **Numéros de page.** Texte > Insérer le numéro de page : pendant la saisie, le champ `{page}` s'insère au curseur ; sinon, un numéro centré est posé en bas de la page active (pratique sur une page maître). Sur la page maître, il s'affiche « # » ; sur les pages, leur numéro. Le premier numéro se règle dans les réglages du document.
- **Cadres de texte.** Dans la Persona Mise en page, l'outil Texte trace des cadres : leur hauteur reste fixe et le texte en trop est caché. La case « Cadre » de la barre contextuelle transforme n'importe quel bloc de texte en cadre. Un carré rouge « + » en bas à droite signale un texte qui déborde.
- **Cadres liés.** Un clic sur le carré « + », puis un clic sur un autre texte (ou sur un endroit vide, pour créer un nouveau cadre de même taille) : le texte coule dans le cadre suivant, même sur une autre page. On peut aussi sélectionner deux textes et choisir Texte > Lier les cadres de texte. Le texte s'édite d'un seul tenant : un clic dans n'importe quel cadre de la chaîne y place le curseur, et les flèches passent d'un cadre à l'autre. Supprimer un cadre referme la chaîne sans perdre le texte ; « Sortir le cadre de la chaîne » le détache.
- **Réglages du document** (Document > Réglages du document…) : résolution (72 à 600 ppp), pages en vis-à-vis, premier numéro de page, marges (haut, bas, intérieur, extérieur) affichées en violet, et fond perdu affiché en pointillés rouges. Les longueurs se règlent en millimètres.
- **PDF d'impression.** Le PDF est à la taille réelle des pages (une page A4 à 300 ppp fait 210 × 297 mm), toutes les pages ou une plage (« 1-3, 5 »), sans les pages maîtres. On peut y inclure le fond perdu et des traits de coupe ; les boîtes TrimBox et BleedBox indiquent à l'imprimeur où couper.

## Organisation du code

| Où                                       | Quoi                                                                                                                                      |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/pages.ts`             | Pages et pages maîtres : numérotation, champs, marges, rangement en colonne ou en doubles pages, ajout, duplication, déplacement, unités. |
| `packages/core/src/flow.ts`              | Champs `{page}` / `{pages}` et cadres de texte liés : chaîne de cadres, répartition du texte (les indices restent ceux du texte entier).  |
| `packages/core/src/tree.ts`              | Supprimer un cadre referme sa chaîne ; copier des cadres ensemble garde leurs liens.                                                      |
| `packages/core/src/svg.ts`               | Export SVG (et donc PDF) avec page maître, champs, cadres liés et fond perdu.                                                             |
| `packages/render/src/index.ts`           | Rendu de la page maître sous la page, des champs et des cadres liés (mémorisé tant que le document ne change pas).                        |
| `apps/editor/src/layoutActions.ts`       | Ce que font les commandes de mise en page sur le document.                                                                                |
| `apps/editor/src/panels/PagesPanel.tsx`  | Panneau Pages.                                                                                                                            |
| `apps/editor/src/canvas/textParts.ts`    | Édition d'un texte réparti sur plusieurs cadres (curseur, clic, flèches).                                                                 |
| `apps/editor/src/canvas/controller.ts`   | Contour des cadres, indicateur de débordement, choix du cadre suivant, marges et fond perdu.                                              |
| `apps/editor/src/io.ts`                  | PDF à la taille réelle, fond perdu, traits de coupe, TrimBox et BleedBox, plage de pages.                                                 |
| `apps/editor/src/components/Dialogs.tsx` | Réglages du document, options PDF, pages et vis-à-vis dans « Nouveau document ».                                                          |

Le format de fichier passe en version 5 (voir [format-poulpe.md](format-poulpe.md)), juste après la version 4 de la retouche photo. Tous les nouveaux champs sont facultatifs : les fichiers des versions 1 à 4 s'ouvrent sans changement.

## Choix et écarts

- **Une page est un plan de travail.** Les pages gardent tout ce que savent faire les plans de travail (outils, calques, exports) ; une page maître est un plan de travail marqué `master`, rangé à gauche des pages. Les pages maîtres sont simples (une page, pas de double page maître) et ne s'imbriquent pas.
- **Le fond perdu est une marge commune aux quatre côtés.** En vis-à-vis, il n'est pas dessiné du côté de la reliure, mais le PDF l'exporte sur les quatre côtés de chaque page (c'est ce que demandent la plupart des imprimeurs pour des pages séparées).
- **Traits de coupe** en couleur de repérage (100 % de chaque encre), à 3 pt du fond perdu, longs de 12 pt.
- **CMJN dans la deuxième partie.** La gestion couleur (CMJN, profil ICC, épreuvage à l'écran), le PDF/X, l'ouverture des fichiers PSD, PDF et AI, l'export PSD et l'export par lots sont décrits dans [impression-v0.5.md](impression-v0.5.md).
- **Pas encore de styles de paragraphe, de colonnes ni d'habillage** : ils sont dans la liste de la v0.3.x (texte avancé).

## Tests

- `packages/core/test/v05.test.ts` : numérotation, rangement en colonne et en doubles pages, déplacement et duplication de pages (liens compris), marges en vis-à-vis, unités, champs, répartition du texte dans trois cadres, chaîne refermée après suppression, format v5 et migration, page maître et fond perdu dans le SVG.
- `apps/editor/e2e/layout.spec.ts` : document A4 de plusieurs pages, panneau Pages (dupliquer, ajouter, supprimer, annuler), page maître avec numéro de page et PDF à la taille réelle, texte qui coule d'un cadre à l'autre par l'indicateur de débordement, réglages du document et PDF avec fond perdu et traits de coupe.
