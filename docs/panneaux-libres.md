# Panneaux libres

Comme dans Photoshop, les fenêtres d'outils de Poulpe peuvent se détacher, se déplacer et se redimensionner.

## Pour l'utilisateur

- **Détacher un groupe du Studio** (Couleur, Contour… ou Calques, Historique) : glisser sa barre d'onglets hors du Studio, ou double-cliquer sur la barre (à côté des onglets).
- **Détacher la colonne d'outils** : glisser la petite poignée en haut de la colonne, ou double-cliquer dessus.
- **Déplacer** une fenêtre flottante : la glisser par sa barre de titre.
- **Redimensionner** : tirer un bord ou un coin. La palette d'outils flottante se réorganise en plusieurs colonnes quand on l'élargit.
- **Ré-ancrer** : ramener la fenêtre sur le Studio (ou contre son bord) ; la zone s'éclaire au survol. Le bouton d'ancrage ou le double-clic sur la barre de titre font de même.
- **Panneaux ancrés** : le bord intérieur du Studio et de la Bibliothèque se tire pour changer leur largeur, le séparateur entre les deux groupes du Studio règle leur hauteur. Double-clic sur un séparateur : taille par défaut.
- **Affichage › Réinitialiser les panneaux** remet la disposition d'origine (outils à droite, Studio ancré).

La disposition est mémorisée d'une session à l'autre.

## Pour le code

- `apps/editor/src/panels/panelLayout.ts` : magasin `panels` (clé `poulpe.panels` dans le stockage local), séparé des réglages pour qu'un glissement ne redessine pas tout l'éditeur ; fonctions de glissement, de redimensionnement et d'ancrage.
- `apps/editor/src/panels/FloatingFrame.tsx` : fenêtre flottante avec ses huit poignées.
- Les panneaux détachables sont `tools`, `studio-top` et `studio-bottom` ; le même identifiant sert dans les trois Personas.
- Tests : `apps/editor/e2e/panels.spec.ts`.
