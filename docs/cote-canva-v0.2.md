# Côté Canva v0.2 : état et organisation du code

5 octobre 2026

La v0.2 ajoute à Poulpe ce qui permet de faire un joli visuel en quelques clics, sans partir d'une page blanche : des modèles, une bibliothèque d'éléments libres, des styles prêts à l'emploi et le redimensionnement d'un design vers un autre format.

## Ce que voit l'utilisateur

- **Écran d'accueil.** Au lancement, la fenêtre « Bienvenue dans Poulpe » propose les modèles (filtrables par format), les formats vides par usage (réseaux sociaux, impression, écran), une taille personnalisée et l'ouverture d'un fichier. La case « Afficher au lancement » le désactive. Il s'ouvre aussi par Fichier > Nouveau.
- **Panneau Bibliothèque** (bouton de la barre d'outils, Affichage > Bibliothèque, ou Ctrl+Maj+L). Il s'ancre du côté opposé au Studio et suit donc la disposition choisie. Trois onglets :
  - **Modèles** : 19 modèles, avec recherche et filtre par catégorie. Un modèle remplit le plan de travail actif s'il est vide, sinon il arrive dans un nouveau plan de travail à droite.
  - **Éléments** : 3 styles de texte (titre, sous-titre, corps), 33 formes, 7 cadres photo, 12 illustrations et 172 icônes rangées en 10 catégories, avec une recherche en français et en anglais (sans tenir compte des accents). Un clic ajoute l'élément au centre de la vue, un glisser-déposer le pose où on le lâche. Les formes et icônes prennent la couleur de remplissage courante.
  - **Styles** : 18 palettes et 8 combinaisons de polices. Une palette s'applique à la sélection, ou à tout le plan de travail (fond compris) sans sélection ; un nouveau clic propose une autre répartition des mêmes couleurs. Le bouton « + » ajoute la palette au nuancier. Une combinaison de polices met la police de titre sur les grands textes et la police de corps sur les autres.
- **Cadres photo.** Une image déposée sur un cadre, ou importée quand un cadre est sélectionné, le remplit en étant recadrée pour le couvrir. On la recadre ensuite comme toute image (double-clic).
- **Formats.** 20 formats, dont 10 pour les réseaux sociaux (Instagram carré et portrait, story, Facebook, LinkedIn, X, Pinterest, YouTube), 7 pour l'impression (A3, A4, A5, Letter, carte de visite, carte postale, invitation) et 3 pour l'écran.
- **Redimensionner le design** (Document > Redimensionner le design…, ou le bouton du panneau Bibliothèque) : choix d'un format ou d'une taille, en copie à côté de l'original (par défaut) ou sur place.

## Organisation du code

| Où                                       | Quoi                                                                                                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/path.ts`              | Lecture des tracés SVG (`d`), conversion des arcs en courbes de Bézier, boîte englobante.                                                                                             |
| `packages/core/src/resize.ts`            | `resizeArtboard` : redimensionnement « intelligent » d'un plan de travail.                                                                                                            |
| `packages/core/src/recolor.ts`           | Contraste, clarté, `designColors` et `applyPalette`.                                                                                                                                  |
| `packages/core/src/factory.ts`           | Formats (`FORMAT_PRESETS`, avec une catégorie), `createPath`.                                                                                                                         |
| `packages/library/`                      | Contenu de la bibliothèque : modèles, formes, cadres, illustrations, icônes, palettes, polices. Tout est décrit en code (petit langage dans `src/dsl.ts`), en français et en anglais. |
| `apps/editor/src/libraryActions.ts`      | Ce que font les boutons de la bibliothèque sur le document.                                                                                                                           |
| `apps/editor/src/panels/Library.tsx`     | Le panneau Bibliothèque.                                                                                                                                                              |
| `apps/editor/src/components/Thumb.tsx`   | Aperçus des modèles et des éléments, dessinés par le moteur de rendu lui-même.                                                                                                        |
| `apps/editor/src/components/Dialogs.tsx` | Écran d'accueil et fenêtre de redimensionnement.                                                                                                                                      |

Le nouveau type d'objet `path` (forme libre décrite par un tracé SVG) fait passer le format de fichier en version 2 ; voir [format-poulpe.md](format-poulpe.md). Les fichiers de la v0.1 s'ouvrent sans changement.

### Redimensionnement d'un design

Chaque axe est traité à part, avec `k`, le plus petit des deux rapports d'échelle (le texte n'est donc jamais déformé) :

1. Un objet qui couvre presque tout un côté (90 % ou plus, sauf un texte) est étiré sur cet axe : fonds, bandeaux. Une image garde ses proportions et est recadrée pour couvrir.
2. Un objet qui touche un bord (à 2 % près) ou déborde reste collé à ce bord : logos dans un coin, badges.
3. Un objet posé sur un autre (contenu dans un objet plus grand, qui n'est ni un texte ni un fond) suit cet objet en gardant sa position relative : un texte sur un bandeau.
4. Les autres objets forment un bloc, réduit ou agrandi de `k`, dont le centre garde sa place relative dans la page. Ils gardent ainsi leur mise en page entre eux.

Les épaisseurs de contour et les arrondis sont multipliés par `k`.

### Palettes

Les couleurs du design sont rangées de la plus sombre à la plus claire, et chacune prend la couleur de la palette qui occupe la même position relative. Le texte sombre sur fond clair reste donc sombre sur fond clair, ce qui garde le contraste. L'opacité d'origine est conservée.

## Licences du contenu

- Modèles, formes, cadres, illustrations, palettes et combinaisons : faits pour Poulpe, sous MPL-2.0 comme le reste du code.
- Icônes : [Phosphor Icons](https://phosphoricons.com), licence MIT, voir [`packages/library/LICENSE-icons.md`](../packages/library/LICENSE-icons.md). Les tracés sont extraits de `@phosphor-icons/core` par `pnpm --filter @poulpe/library icons` (liste et mots-clés français dans `scripts/icons-list.json`).
- Polices : uniquement celles déjà fournies avec Poulpe (licence OFL).

## Limites connues

- **Pas encore de photos libres intégrées.** La v0.2 permet d'importer ses propres photos et de les mettre dans des cadres, mais n'embarque pas de banque d'images CC0. Les sources envisagées (Openverse, Wikimedia Commons, Unsplash, Pexels) demandent soit un accès réseau depuis l'appli, soit un tri des licences image par image. C'est reporté à une version suivante.
- Les modèles et éléments sont figés dans le code : on ne peut pas encore enregistrer ses propres modèles.
- Le redimensionnement suit des règles simples : un design très chargé peut demander des retouches après coup.

## Tests

- `packages/core/test/v02.test.ts` : tracés, migration de la version 1, formats, redimensionnement, palettes.
- `packages/library/test/library.test.ts` : identifiants uniques, chaque modèle se construit dans les deux langues, icônes et recherche.
- `apps/editor/e2e/library.spec.ts` : écran d'accueil, modèles, éléments, cadre photo, glisser-déposer, palettes et polices, redimensionnement, panneau en anglais.
