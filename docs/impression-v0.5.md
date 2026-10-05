# Impression et ouverture de fichiers v0.5 (deuxième partie) : état et organisation du code

Suite de [mise-en-page-v0.5.md](mise-en-page-v0.5.md). Cette deuxième partie termine la v0.5 de la [feuille de route](feuille-de-route.md) : couleurs CMJN, PDF/X-4 pour l'imprimerie, épreuvage à l'écran, ouverture des fichiers Photoshop, PDF et Illustrator, export PSD et export par lots.

## Ce que voit l'utilisateur

- **Document en CMJN.** Document › Réglages du document › Couleurs : « RVB (écran) » ou « CMJN (impression) ». En CMJN, le sélecteur de couleur s'ouvre sur les curseurs C, M, J, N et signale les couleurs qu'une imprimante ne sait pas reproduire. Une valeur tapée en CMJN (par exemple 100 % cyan) est gardée telle quelle jusque dans le PDF.
- **Épreuvage à l'écran** (Affichage › Épreuvage CMJN, Ctrl+Y, ou le bouton de la Persona Mise en page) : l'écran montre les couleurs telles qu'elles sortiront à l'impression, plus ternes pour les couleurs vives.
- **PDF pour l'imprimerie.** Dans Exporter › PDF : couleurs « CMJN » et case « PDF/X-4 ». Le PDF contient alors seulement des couleurs CMJN, le profil de l'imprimerie (FOGRA39, papier couché), les zones de coupe et de fond perdu. Si une police ou une photo JPEG empêchent la conformité stricte, un message le dit.
- **Ouvrir un fichier Photoshop (.psd)** : les calques, groupes, masques, opacités, modes de fusion et les principaux calques de réglage (luminosité et contraste, niveaux, courbes, exposition, vibrance, teinte et saturation, négatif, postérisation, seuil) restent modifiables. Le document s'ouvre dans la Persona Photo.
- **Ouvrir un PDF ou un fichier Illustrator (.ai)** : chaque page devient une page Poulpe, avec ses formes, ses traits, ses dégradés, ses textes et ses images en objets modifiables. Un fichier Illustrator s'ouvre par sa partie PDF (option « Créer un fichier compatible PDF », cochée par défaut dans Illustrator) ; sinon un message explique quoi faire.
- **Exporter en PSD** : un calque Photoshop par objet, groupes et masques d'écrêtage compris.
- **Exporter par lots** (Fichier › Exporter par lots…) : plusieurs pages, plusieurs formats (PNG, JPEG, SVG, PDF, PSD) et plusieurs tailles (1x, 2x, 3x…) d'un coup, dans un fichier ZIP.

## Organisation du code

| Où                                       | Quoi                                                                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/core/src/cmyk.ts`              | Modèle d'impression (Neugebauer, engraissement, Yule-Nielsen, limite d'encrage 320 %), RVB ↔ CMJN, épreuvage, hors gamme, valeurs exactes. |
| `packages/core/src/icc.ts`               | Profil ICC CMJN calculé à partir du même modèle (incorporé dans les PDF/X).                                                                |
| `packages/core/src/pdfPrint.ts`          | Réécrit le PDF de jsPDF : couleurs, dégradés et images en CMJN, puis PDF/X-4 (OutputIntent, XMP, TrimBox et BleedBox).                     |
| `apps/editor/src/importers/psd.ts`       | Lecture et écriture des PSD (avec la bibliothèque ag-psd, licence MIT).                                                                    |
| `apps/editor/src/importers/pdf.ts`       | Lecture des PDF et des AI (avec pdf.js, licence Apache 2.0), page par page, en objets modifiables.                                         |
| `apps/editor/src/io.ts`                  | Ouverture selon l'extension, PDF CMJN et PDF/X, export PSD, export par lots en ZIP.                                                        |
| `apps/editor/src/panels/ColorPicker.tsx` | Curseurs CMJN et alerte hors gamme.                                                                                                        |
| `apps/editor/src/canvas/controller.ts`   | Épreuvage à l'écran.                                                                                                                       |
| `apps/editor/src/components/Dialogs.tsx` | Couleurs du document, options PDF CMJN et PDF/X, export PSD, fenêtre d'export par lots.                                                    |

Le format de fichier passe en version 6 (voir [format-poulpe.md](format-poulpe.md)) : `colorMode` et `cmyk` dans `layout`, tous deux facultatifs.

## Choix et écarts

- **Profil CMJN approché.** Le profil officiel FOGRA39 ne peut pas être redistribué librement ; Poulpe calcule le sien avec un modèle d'impression offset sur papier couché, proche de FOGRA39. Le PDF/X annonce la condition FOGRA39, que les imprimeurs connaissent tous. Pour une couleur critique (logo, charte), il vaut mieux taper la valeur CMJN exacte : elle est gardée telle quelle.
- **Pas encore de niveaux de gris ni de tons directs (Pantone).** Ils viendront avec les nuanciers.
- **Photos JPEG.** Converties en CMJN dans un PDF/X ; un JPEG gardé en RVB dans un PDF simple est signalé.
- **PDF et AI ouverts.** Les zones de détourage (clipping) ne sont pas encore reprises, les textes sont refaits avec des polices proches, et une page trop chargée (plus de 20 000 objets) ou illisible est ouverte comme une image à 300 dpi.
- **PSD.** Les calques de texte et les styles de calque Photoshop arrivent en pixels ; à l'export, les textes et les formes deviennent des calques de pixels.
- **Épreuvage plus lent.** Il recalcule chaque image affichée ; il est donc désactivé par défaut.
- **pdf.js** est chargé seulement à la première ouverture d'un PDF, dans sa version « legacy » (la version moderne utilise des fonctions JavaScript que WebKitGTK, le moteur de l'appli Linux, n'a pas encore).

## Tests

- `packages/core/test/print.test.ts` : gris en noir seul, aller-retour RVB → CMJN → RVB, limite d'encrage, valeur CMJN gardée, hors gamme, épreuvage, en-tête du profil ICC, conversion d'un PDF fait main en CMJN et en PDF/X-4.
- `apps/editor/e2e/print.spec.ts` : PDF ouvert en objets modifiables sur deux pages, fichier AI (et ancien AI sans partie PDF), PSD à calques ouvert puis réexporté, PDF/X-4 CMJN avec une valeur saisie en CMJN, épreuvage à l'écran, export par lots en ZIP.
- Vérifié à la main : le profil ICC est accepté par LittleCMS, et les PDF/X-4 passent la vérification de syntaxe de qpdf ; `pdfinfo` les reconnaît comme PDF/X-4.
