# Moteur d'édition v0.1 : état et organisation du code

5 octobre 2026

Cette page dit ce que contient le code de la v0.1, comment le code est découpé, ce que donne la mesure des performances sous Linux et les limites connues.

## Lancer Poulpe Design

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

| Dossier           | Rôle                                                                                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core`   | Modèle de document, géométrie, couleurs, mise en page du texte, commandes et historique, export SVG, fichier `.poulpe`. Aucune dépendance au navigateur : testé avec Vitest. |
| `packages/render` | Rendu du document sur un canevas, export PNG et JPEG.                                                                                                                        |
| `apps/editor`     | L'interface (React + Vite) : fenêtre façon Affinity, outils, panneaux, menus, raccourcis, entrées et sorties de fichiers.                                                    |
| `apps/desktop`    | L'appli de bureau Tauri 2 qui embarque `apps/editor` : fenêtre, association des fichiers `.poulpe`, polices installées.                                                      |

Un geste devient une commande, la commande modifie le document, et le canevas se redessine. Les documents sont immuables (immer) : chaque commande produit un nouveau document qui partage tout ce qui n'a pas changé avec le précédent, ce qui rend l'annulation illimitée et peu coûteuse. Un geste (glisser, redimensionner, régler une couleur au curseur) ne laisse qu'une seule entrée dans l'historique.

## Ce que fait la v0.1

- **Fenêtre façon Affinity** : menus, barre d'outils, barre contextuelle, colonne d'outils à droite (ou à gauche), Studio à onglets (Couleur, Contour, Transformation, Caractère, Calques, Historique) à droite ou à gauche, thème sombre ou clair, français ou anglais. Les réglages sont mémorisés.
- **Outils** : déplacer, sélection directe (dans les groupes), plan de travail, rectangle (coins arrondis), ellipse, polygone, étoile, ligne, texte, image, pipette, main, zoom. Raccourcis clavier à une touche comme dans Affinity.
- **Objets** : sélection au clic et au lasso, déplacement, redimensionnement (Maj garde les proportions, Alt depuis le centre), rotation (Maj par pas de 15°), duplication par Alt + glisser, alignement, répartition, retournement, rotation de 90°, magnétisme sur les bords et centres des objets, des plans de travail et des repères, règles, repères et grille.
- **Repères** : glisser depuis une règle pour poser un repère, le glisser pour le déplacer, le ramener sur la règle pour le retirer ; Affichage > Effacer les repères. Ils sont enregistrés dans le document.
- **Calques** : arbre des plans de travail et des objets, glisser-déposer pour réordonner ou ranger dans un groupe, groupes, verrouillage, visibilité, renommage, opacité, 16 modes de fusion, masque d'écrêtage simple.
- **Couleur** : remplissage et contour, sélecteur TSV avec teinte et opacité, saisie hexadécimale, RVB ou TSL, couleurs récentes, nuancier du document, dégradés linéaires et radiaux avec éditeur d'arrêts.
- **Texte** : texte artistique (clic) ou bloc de texte (glisser), édition sur le canevas, police (7 polices libres fournies et polices installées), graisse, taille, italique, souligné, barré, majuscules, interlettrage, interligne, alignement et justification. Police, taille, graisse, italique, souligné, barré, interlettrage et couleur peuvent changer à l'intérieur d'un même texte : on sélectionne des caractères pendant l'édition et on règle le panneau Caractère ou Couleur ; sans sélection, le réglage vaut pour la suite de la saisie.
- **Images** : import, recadrage (double-clic sur l'image ou bouton Recadrer : les poignées changent le cadre, glisser déplace l'image dans le cadre, la partie cachée reste visible en transparence), retour à l'image entière.
- **Document** : plusieurs plans de travail, formats prédéfinis, annuler et rétablir illimités avec panneau Historique, copier, couper, coller, dupliquer.
- **Fichiers** : enregistrement et ouverture du format `.poulpe` ([spécification](format-poulpe.md)), import d'images (menu ou glisser-déposer), export PNG et JPEG (échelle, qualité, fond transparent), SVG vectoriel et PDF vectoriel multipage avec les polices intégrées.
- **Brouillons** : le document non enregistré est copié dans le navigateur (IndexedDB) peu après chaque modification. Si la fenêtre se ferme sans enregistrer, Poulpe Design propose de le rouvrir au lancement suivant. Le brouillon est effacé à l'enregistrement.
- **Polices du PDF** : les polices fournies avec Poulpe Design sont intégrées au PDF (lues dans leurs fichiers WOFF et converties en TrueType). Les polices installées le sont aussi dans l'appli de bureau, et dans le navigateur quand il donne accès aux polices locales (Chrome, Edge). Une police PostScript (OpenType CFF) ou introuvable est remplacée par une police standard, et Poulpe Design le signale à l'export.
- **Bureau** : appli Tauri, installeurs Windows, macOS et Linux, double-clic sur un `.poulpe` pour l'ouvrir, liste des polices installées.

## Écarts avec le cadrage, assumés pour cette première version

- **Rendu en Canvas 2D au lieu de CanvasKit.** Tout le dessin passe par `packages/render`, si bien que CanvasKit pourra le remplacer sans toucher au reste. Canvas 2D suffit pour la v0.1, utilise directement les polices du système et ne charge pas 7 Mo de WebAssembly ; CanvasKit devient utile en v0.3 pour les opérations booléennes.
- **PDF par jsPDF et svg2pdf au lieu de pdf-lib.** Le PDF est fabriqué à partir de l'export SVG, ce qui garde les dégradés et les tracés vectoriels ; pdf-lib ne sait pas dessiner de dégradés.
- **Menus dans la fenêtre** plutôt que menus natifs du système, identiques dans le navigateur et sur le bureau.

## Performances de l'appli de bureau sous Linux

Le cadrage demandait de mesurer l'appli de bureau sous Linux, où Tauri s'appuie sur WebKitGTK, avant de garder Tauri plutôt qu'Electron. La mesure est intégrée à Poulpe Design : `?bench` dans l'adresse de l'éditeur, ou `POULPE_BENCH=1 poulpe` pour l'appli de bureau, qui écrit son rapport sur la sortie standard. Elle dessine 1 000 objets (formes, dégradés, contours, rotations, 40 blocs de texte) sur un plan de travail 1920 × 1080 et chronomètre 60 images par scénario, en forçant la fin du dessin à chaque image.

Première mesure, le 5 octobre 2026, sur une machine virtuelle Linux sans carte graphique (Ubuntu 24.04, 4 cœurs Xeon à 2,8 GHz, écran virtuel Xvfb, fenêtre de 1056 × 718 px de canevas). Temps moyen pour dessiner une image, et nombre d'images par seconde correspondant :

| Scénario                        | Chromium 141     | Appli de bureau (WebKitGTK 2.52) | Écart |
| ------------------------------- | ---------------- | -------------------------------- | ----- |
| Redessin, 720 formes unies      | 16 ms (61 i/s)   | 74 ms (13 i/s)                   | × 4,5 |
| Redessin, 240 formes en dégradé | 8,9 ms (113 i/s) | 39 ms (26 i/s)                   | × 4,4 |
| Redessin, 40 blocs de texte     | 2,6 ms (381 i/s) | 25 ms (40 i/s)                   | × 9,5 |
| Redessin complet (1 000 objets) | 26 ms (38 i/s)   | 103 ms (10 i/s)                  | × 3,9 |
| Déplacement de 50 objets        | 32 ms (31 i/s)   | 121 ms (8 i/s)                   | × 3,8 |
| Zoom et défilement              | 58 ms (17 i/s)   | 186 ms (5 i/s)                   | × 3,2 |

Ce qu'on en retient :

- **Sans carte graphique, WebKitGTK dessine environ 4 fois plus lentement que Chromium**, et le texte jusqu'à 10 fois plus lentement. Le coût est proportionnel au nombre d'objets : environ 0,1 ms par objet dans l'appli de bureau contre 0,03 ms dans Chromium.
- Estimation tirée de ce coût par objet : un document courant (affiche, publication de réseau social : quelques dizaines d'objets) se dessine en moins de 16 ms, donc à 60 images par seconde, dans les deux cas ; dans l'appli de bureau, sur ce type de machine, la fluidité baisse au-delà de 150 à 200 objets.
- Ces chiffres sont un plancher : WebKitGTK n'a pas pu utiliser d'accélération graphique ici. Il faut refaire la mesure sur un vrai poste Linux (`POULPE_BENCH=1 poulpe`) avant de trancher entre Tauri et Electron.
- Déjà fait : la mise en page des textes et le tracé des formes sont mémorisés tant qu'un objet ne change pas (gain de 10 à 25 % sur le texte). Pistes suivantes, dans l'ordre : pendant un déplacement, garder en image les objets qui ne bougent pas et ne redessiner que la sélection ; puis le rendu CanvasKit (WebGL) prévu en v0.3, qui ne passe plus par le Canvas 2D de WebKitGTK.

## Reste à faire

La v0.1 est complète. Les limites connues, à reprendre dans les versions suivantes :

- L'export PDF n'intègre que les polices TrueType ; les polices PostScript (OpenType CFF) sont remplacées par une police standard.
- Les polices fournies ne couvrent que l'alphabet latin.
- Les flèches haut et bas, Début et Fin suivent la mise en page de Poulpe Design ; les raccourcis de mot (Ctrl + flèches) suivent ceux de la zone de saisie du système, qui peuvent différer légèrement sur un texte à plusieurs tailles.
