# Moteur d'édition v0.1 : état et organisation du code

4 octobre 2026

Cette page dit ce que contient le code de la v0.1, ce qui reste à faire pour fermer le jalon, et comment le code est découpé.

## Lancer Poulpe

Il faut Node 20 ou plus et pnpm 10 (`corepack enable` suffit).

```sh
pnpm install
pnpm dev            # éditeur dans le navigateur : http://localhost:5173
pnpm test           # tests du moteur
pnpm e2e            # tests de bout en bout dans Chromium
```

Appli de bureau : il faut en plus [Rust et les dépendances système de Tauri](https://v2.tauri.app/start/prerequisites/).

```sh
pnpm desktop:dev    # fenêtre de bureau qui recharge le code à chaud
pnpm desktop:build  # installeurs pour le système courant (dans apps/desktop/src-tauri/target/release/bundle)
```

Les installeurs des trois systèmes sont produits par GitHub Actions (`.github/workflows/desktop.yml`), lancé à la main, sur une étiquette `v*` ou quand une PR touche l'appli de bureau.

## Organisation

| Dossier | Rôle |
| --- | --- |
| `packages/core` | Modèle de document, géométrie, couleurs, mise en page du texte, commandes et historique, export SVG, fichier `.poulpe`. Aucune dépendance au navigateur : testé avec Vitest. |
| `packages/render` | Rendu du document sur un canevas, export PNG et JPEG. |
| `apps/editor` | L'interface (React + Vite) : fenêtre façon Affinity, outils, panneaux, menus, raccourcis, entrées et sorties de fichiers. |
| `apps/desktop` | L'appli de bureau Tauri 2 qui embarque `apps/editor` : fenêtre, association des fichiers `.poulpe`, polices installées. |

Un geste devient une commande, la commande modifie le document, et le canevas se redessine. Les documents sont immuables (immer) : chaque commande produit un nouveau document qui partage tout ce qui n'a pas changé avec le précédent, ce qui rend l'annulation illimitée et peu coûteuse. Un geste (glisser, redimensionner, régler une couleur au curseur) ne laisse qu'une seule entrée dans l'historique.

## Ce que fait la v0.1

- **Fenêtre façon Affinity** : menus, barre d'outils, barre contextuelle, colonne d'outils à droite (ou à gauche), Studio à onglets (Couleur, Contour, Transformation, Caractère, Calques, Historique) à droite ou à gauche, thème sombre ou clair, français ou anglais. Les réglages sont mémorisés.
- **Outils** : déplacer, sélection directe (dans les groupes), plan de travail, rectangle (coins arrondis), ellipse, polygone, étoile, ligne, texte, image, pipette, main, zoom. Raccourcis clavier à une touche comme dans Affinity.
- **Objets** : sélection au clic et au lasso, déplacement, redimensionnement (Maj garde les proportions, Alt depuis le centre), rotation (Maj par pas de 15°), duplication par Alt + glisser, alignement, répartition, retournement, rotation de 90°, magnétisme sur les bords et centres des objets et des plans de travail, règles et grille.
- **Calques** : arbre des plans de travail et des objets, glisser-déposer pour réordonner ou ranger dans un groupe, groupes, verrouillage, visibilité, renommage, opacité, 16 modes de fusion, masque d'écrêtage simple.
- **Couleur** : remplissage et contour, sélecteur TSV avec teinte et opacité, saisie hexadécimale, RVB ou TSL, couleurs récentes, nuancier du document, dégradés linéaires et radiaux avec éditeur d'arrêts.
- **Texte** : texte artistique (clic) ou bloc de texte (glisser), édition sur le canevas, police (7 polices libres fournies et polices installées), graisse, taille, italique, souligné, barré, majuscules, interlettrage, interligne, alignement et justification.
- **Document** : plusieurs plans de travail, formats prédéfinis, annuler et rétablir illimités avec panneau Historique, copier, couper, coller, dupliquer.
- **Fichiers** : enregistrement et ouverture du format `.poulpe` ([spécification](format-poulpe.md)), import d'images (menu ou glisser-déposer), export PNG et JPEG (échelle, qualité, fond transparent), SVG vectoriel et PDF vectoriel multipage.
- **Bureau** : appli Tauri, installeurs Windows, macOS et Linux, double-clic sur un `.poulpe` pour l'ouvrir, liste des polices installées.

## Écarts avec le cadrage, assumés pour cette première version

- **Rendu en Canvas 2D au lieu de CanvasKit.** Tout le dessin passe par `packages/render`, si bien que CanvasKit pourra le remplacer sans toucher au reste. Canvas 2D suffit pour la v0.1, utilise directement les polices du système et ne charge pas 7 Mo de WebAssembly ; CanvasKit devient utile en v0.3 pour les opérations booléennes.
- **PDF par jsPDF et svg2pdf au lieu de pdf-lib.** Le PDF est fabriqué à partir de l'export SVG, ce qui garde les dégradés et les tracés vectoriels ; pdf-lib ne sait pas dessiner de dégradés.
- **Menus dans la fenêtre** plutôt que menus natifs du système, identiques dans le navigateur et sur le bureau.

## Reste à faire pour fermer la v0.1

- Recadrage d'image.
- Repères tirés depuis les règles.
- Brouillons enregistrés automatiquement (IndexedDB) pour ne rien perdre si l'onglet se ferme.
- Polices embarquées dans le PDF : pour l'instant, le PDF utilise une police standard proche.
- Édition du texte caractère par caractère (styles différents dans un même texte).
- Mesure des performances de l'appli de bureau sous Linux (WebKitGTK), prévue par le cadrage.
