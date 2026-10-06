# Retouche photo v0.4 : état et organisation du code

5 octobre 2026

La v0.4 ajoute à Poulpe Design une **Persona Photo**, comme dans Affinity Photo : on retouche une photo avec des pinceaux, des sélections, une gomme magique, des calques de réglage, des filtres et des masques. Tout fonctionne sur l'ordinateur, sans connexion et sans service payant.

## Ce que voit l'utilisateur

- **Personas.** Les boutons en haut à gauche de la barre d'outils passent de la Persona Dessin à la Persona Photo. Chacune a ses outils, ses raccourcis, ses onglets de Studio et ses boutons. Fichier > Ouvrir une photo… (Ctrl+Alt+O, ou depuis l'écran d'accueil) crée un document à la taille de la photo et passe en Persona Photo.
- **Outils de la Persona Photo** (colonne de droite) :
  - Sélection rectangle (M), ellipse, lasso (L) et baguette magique (W). Maj ajoute à la sélection, Alt retire, Maj+Alt garde l'intersection ; la barre contextuelle propose les mêmes modes, le contour progressif, la tolérance et « Pixels contigus ». La sélection s'affiche en pointillés animés.
  - Pinceau (B), gomme (E) et pot de peinture (G). Le pinceau suit la pression du stylet. Taille, dureté, opacité et flux se règlent dans la barre contextuelle et dans l'onglet Pinceau ; [ et ] changent la taille, X échange les deux couleurs, D remet noir et blanc. Peindre sans calque de pixels sélectionné en crée un.
  - **Gomme magique** (J) : on peint sur ce qui doit disparaître (en rouge), on relâche, et Poulpe Design le remplace par ce qui l'entoure. Édition > Remplir d'après le contenu fait la même chose sur la sélection.
  - Tampon de duplication (S, Alt+clic pour choisir la source), densité + et − (O), flou et netteté au pinceau (R).
  - Texte, pipette (qui prend la couleur du pinceau), main et zoom, comme en Persona Dessin.
- **Menu Sélection** : tout sélectionner (Ctrl+A), désélectionner (Ctrl+D), inverser (Ctrl+Maj+I), contour progressif, dilater, contracter, sélectionner d'après un calque.
- **Calques de pixels** : nouveau calque de pixels (Ctrl+Maj+N), copier la sélection sur un nouveau calque (Ctrl+J), effacer la sélection (Suppr), pixelliser, fusionner les calques visibles sur un nouveau calque (Ctrl+Alt+Maj+E).
- **Calques de réglage** (menu Réglages, bouton de la barre d'outils, panneau Calques) : luminosité et contraste, niveaux, courbes (par canal, avec histogramme), exposition, teinte-saturation-luminosité, vibrance, balance des blancs, balance des couleurs, noir et blanc, filtre photo, dégradé de couleurs, négatif, seuil, postérisation, et niveaux automatiques. Ils agissent sur tous les calques du dessous, se règlent à tout moment dans l'onglet Réglage du Studio, et se dosent avec l'opacité.
- **Filtres** : flou gaussien, netteté (accentuation), clarté, bruit, vignettage et pixellisation. Le menu Filtres les applique aux pixels du calque avec un aperçu en direct ; Réglages > Filtres dynamiques les ajoute en calque, modifiables à tout moment.
- **Masques de calque** (menu Calque > Masque, bouton de la barre d'outils) : ajouter (d'après la sélection s'il y en a une), activer ou désactiver, inverser, supprimer. Un clic sur la vignette du masque dans le panneau Calques passe en mode « peindre le masque » : le noir cache, le blanc montre.
- **Onglet Histogramme** dans le Studio, en Persona Photo.

Les retouches s'annulent avec Ctrl+Z comme le reste, s'enregistrent dans le fichier `.poulpe` et apparaissent dans les exports PNG, JPEG, SVG et PDF.

## Organisation du code

| Où                                            | Quoi                                                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `packages/core/src/adjust.ts`                 | Les réglages et filtres sur des pixels (tables de correspondance, courbes, flou, netteté…), histogramme, niveaux auto.   |
| `packages/core/src/inpaint.ts`                | La gomme magique : reconstruction d'une zone par PatchMatch multi-échelle (Barnes 2009, Wexler 2007), sans modèle d'IA.  |
| `packages/core/src/pixelMask.ts`              | Baguette magique (remplissage par tolérance) et contour d'une sélection.                                                 |
| `packages/render/src/bitmaps.ts`              | Les pixels retouchés restent en mémoire et sont encodés en PNG en arrière-plan ; ils sont écrits avant l'enregistrement. |
| `packages/render/src/index.ts`                | Rendu des masques et des calques de réglage (avec cache).                                                                |
| `apps/editor/src/photo/photoTools.ts`         | Outils de sélection, pinceaux, gomme magique, tampon, pot de peinture.                                                   |
| `apps/editor/src/photo/photoActions.ts`       | Commandes : masques, calques de réglage, filtres, calques de pixels, ouverture d'une photo.                              |
| `apps/editor/src/photo/selection.ts`          | La sélection de pixels (un masque à la résolution de la photo) et ses opérations.                                        |
| `apps/editor/src/photo/pixels.ts`             | Passage entre coordonnées du document et pixels d'un calque, enregistrement des pixels modifiés dans l'historique.       |
| `apps/editor/src/photo/inpaint.worker.ts`     | La gomme magique tourne dans un Web Worker : l'interface reste fluide pendant le calcul.                                 |
| `apps/editor/src/panels/AdjustmentPanel.tsx`  | Onglet Réglage (curseurs, éditeur de courbes, histogramme).                                                              |
| `apps/editor/src/components/PhotoContext.tsx` | Barre contextuelle des outils photo.                                                                                     |

Le format de fichier passe en version 4 (voir [format-poulpe.md](format-poulpe.md)) : calques de réglage et masques. Les fichiers des versions 1 à 3 s'ouvrent sans changement.

## Choix et écarts

- **Gomme magique sans IA.** Elle reconstruit la zone à partir de morceaux de la photo elle-même (la méthode du « remplissage d'après le contenu » de Photoshop avant l'IA). C'est gratuit, hors ligne et rapide (une à deux secondes pour un objet moyen). Elle est très bonne sur les fonds (ciel, herbe, mur, sable) et les petits objets ; elle invente moins bien les grandes structures (un visage, un bâtiment caché). Une version par modèle d'IA local (LaMa) pourra s'ajouter plus tard en option.
- **Reporté :** détourage automatique et sélection du sujet (modèles d'IA locaux, prévus en v1.0), sélection rapide, lasso polygonal, correcteur, doigt, liquéfier et déformations, tables LUT, redressement, perspective, taille de l'image et de la zone de travail.
- **Limites connues :** les calques de réglage n'appliquent que le mode de fusion normal ; la sélection de pixels ne fait pas partie de l'historique (Ctrl+Z annule les retouches, pas les sélections) ; un masque posé sur un groupe suit sa boîte et peut se décaler si le groupe change de taille.
- **Pas encore de CanvasKit ni de WebGL.** Le Canvas 2D suffit pour des photos de 20 à 30 mégapixels ; les réglages sont calculés sur la zone visible, à la résolution de l'écran, et gardés en cache.

## Tests

- `packages/core/test/v04.test.ts` : chaque réglage, flou, netteté, vignettage, pixellisation, bruit, histogramme et niveaux auto, baguette magique et contour, gomme magique (fond uni, rayures, pixels hors zone intacts), enregistrement d'un fichier avec masque et réglage, ouverture d'un fichier de version 3, export SVG d'un masque.
- `apps/editor/e2e/photo.spec.ts` : changement de Persona, pinceau et gomme sur un nouveau calque, sélection rectangle et effacement, baguette magique, gomme magique, calque de réglage et masque, enregistrement puis réouverture, exports, flou gaussien.
