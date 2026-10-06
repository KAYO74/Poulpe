# Version 1.1

La version 1.1 réunit tout ce qui a été ajouté depuis la 1.0 : le nouveau nom Poulpe Design, la gestion avancée des calques ([calques.md](calques.md)), la fenêtre Préférences et la page Diagnostic, l'optimisation du rendu ([performances.md](performances.md)), la colonne d'outils à la carte ([panneaux-libres.md](panneaux-libres.md)) et le choix de la langue à l'installation, décrit ici. Les installations 1.0 se mettent à jour toutes seules.

## Langue choisie à l'installation

- **Windows (installeur `.exe`)** : l'assistant d'installation demande d'abord la langue (français ou anglais). Un petit script de l'installeur, `apps/desktop/src-tauri/windows/langue.nsh`, écrit ce choix dans `langue.txt`, à côté de `Poulpe.exe`. Au lancement, l'appli le lit (commande `installer_language` de `src-tauri/src/lib.rs`) et l'applique.
  - Le choix de l'installeur est appliqué une seule fois : les mises à jour automatiques reprennent la même langue sans redemander, et ne défont donc pas un changement fait ensuite dans les Préférences. Une réinstallation avec une autre langue la change.
  - La mise à jour depuis la 1.0 demande la langue une fois, puisque l'ancien installeur ne l'avait pas enregistrée.
- **macOS, Linux et installeur `.msi`** : sans assistant qui pose la question, une fenêtre bilingue la demande au tout premier lancement (`apps/editor/src/startLanguage.ts`). Quelqu'un qui utilisait déjà l'appli garde sa langue sans être dérangé.
- **Version navigateur** : la langue du navigateur, comme avant.

La langue est choisie avant l'écran d'accueil, qui s'affiche donc directement dans la bonne langue.

## Langue et thème dans les Préférences seulement

Les boutons de langue et de thème de la barre d'outils, et les sous-menus Affichage > Thème et Affichage > Langue, sont retirés. Les deux réglages se trouvent dans **Édition > Préférences** : la langue dans Général, le thème sombre ou clair dans Affichage.
