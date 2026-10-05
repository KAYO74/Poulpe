# Version 1.0 : état et organisation du code

5 octobre 2026

La v1.0 ajoute à Poulpe ce qui fait gagner du temps dans Illustrator, Photoshop et Affinity : transformer une image en dessin vectoriel, détourer un sujet d'un clic, enregistrer ses gestes en macros, choisir ses raccourcis et étendre l'appli avec des extensions. L'appli de bureau se met à jour toute seule, et tout est prêt pour signer les installeurs. Tout se calcule sur l'ordinateur, sans connexion et sans service payant.

## Ce que voit l'utilisateur

- **Vectoriser l'image** (Calque > Vectoriser l'image…, comme « Vectorisation de l'image » d'Illustrator). On choisit un préréglage (logo, noir et blanc, croquis, niveaux de gris, photo peu ou très détaillée) ou on règle soi-même le nombre de couleurs, le seuil, les taches ignorées, le lissage et les angles vifs ; l'aperçu avant / après se met à jour en direct. Le résultat est un groupe de tracés, une couleur par tracé, posé au-dessus de l'image (qui est masquée, gardée ou supprimée, au choix). Les tracés se modifient ensuite à l'outil Nœud.
- **Supprimer l'arrière-plan** (menu Calque) : le fond d'une photo disparaît sous un masque de calque, qu'on peut retoucher au pinceau, désactiver ou supprimer (rien n'est perdu).
- **Sélectionner le sujet** (menu Sélection, Persona Photo) : sélectionne la personne, l'animal ou l'objet principal ; la sélection se combine avec les modes ajouter, retirer, intersection.
- **Macros** (onglet Macros du Studio, à côté de l'Historique ; Extensions > Enregistrer une macro). Enregistrer, faire ses gestes, Arrêter. Sont notés : les commandes des menus et des raccourcis, les filtres avec leurs réglages, les calques de réglage avec leurs réglages définitifs, le décalage de tracé, la modification de sélection, la vectorisation, les déplacements au clavier et les commandes d'extensions. La macro se rejoue d'un clic sur une autre image ou un autre objet ; les étapes qui ne s'appliquent pas sont sautées et signalées. On la renomme (double-clic), on retire une étape, on l'enregistre dans un fichier `.poulpemacro` pour la partager, on ouvre celle d'un autre.
- **Raccourcis personnalisables** (Aide > Raccourcis clavier). Chaque commande, macro ou commande d'extension a un bouton : on clique, on appuie sur les touches voulues. Un raccourci déjà pris est retiré de l'autre commande (avec un message), Retour arrière retire un raccourci, « Défaut » et « Tout réinitialiser » reviennent aux raccourcis d'origine. Les lettres seules restent aux outils.
- **Extensions** (nouveau menu Extensions > Gérer les extensions…). Une extension est un fichier JavaScript qui ajoute des commandes au menu Extensions. Trois exemples sont livrés : Grille de formes, Couleurs au hasard, Rosace. Une commande d'extension forme une seule étape d'historique (Ctrl+Z l'annule en entier) et peut demander des réglages dans une petite fenêtre. Pour écrire une extension : [extensions.md](extensions.md).
- **Mises à jour automatiques** (appli de bureau). Au lancement, Poulpe regarde discrètement s'il existe une version plus récente et propose « Installer et redémarrer ». Aide > Rechercher les mises à jour… fait la même chose à la demande. L'option « Chercher au démarrage » se décoche dans la fenêtre de mise à jour.

## Organisation du code

| Où                                     | Quoi                                                                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/core/src/trace.ts`           | Vectorisation : réduction des couleurs (k-moyennes), fusion des taches, contours des pixels, coins, courbes de Bézier (Schneider), empilement.   |
| `packages/core/src/matte.ts`           | Détourage : préparation de l'image pour le modèle, agrandissement de sa réponse et affinage des bords par filtre guidé.                          |
| `apps/editor/src/smart/`               | Vectorisation et détourage dans l'éditeur, leurs Web Workers et la fenêtre « Vectoriser l'image ».                                               |
| `apps/editor/scripts/fetch-models.mjs` | Télécharge le modèle de détourage (44 Mo, empreinte SHA-256 vérifiée) avant la compilation ; il n'est pas gardé dans Git.                        |
| `apps/editor/src/macros/`              | Enregistreur (`recorder.ts`, sans dépendance), macros et lecture (`macros.ts`), onglet du Studio.                                                |
| `apps/editor/src/shortcuts.ts`         | Raccourcis personnalisés, gardés dans le navigateur ou l'appli.                                                                                  |
| `apps/editor/src/registry.ts`          | Commandes ajoutées pendant l'exécution (macros, extensions) ; `commands.ts` les réunit avec celles de l'appli et passe tout par `runCommand`.    |
| `apps/editor/src/extensions/`          | Hôte des extensions (`host.ts`, QuickJS), ce qu'elles peuvent faire au document (`api.ts`), l'objet `poulpe` (`prelude.js`), exemples, fenêtres. |
| `apps/editor/src/updater.ts`           | Recherche, téléchargement et installation des mises à jour, puis redémarrage.                                                                    |
| `apps/desktop/src-tauri/`              | Greffons Tauri `updater` et `process`, clé publique des mises à jour dans `tauri.conf.json`.                                                     |
| `.github/workflows/desktop.yml`        | Signature des mises à jour, de macOS et de Windows, chacune activée seulement si ses secrets existent.                                           |
| `packaging/flathub/`                   | Manifeste Flatpak, fiche AppStream et raccourci de bureau, prêts pour une demande sur Flathub.                                                   |

Le format de fichier ne change pas (version 6) : la vectorisation crée des tracés et le détourage un masque de calque, qui existaient déjà. Les macros, raccourcis et extensions sont gardés à part, dans l'appli.

## Choix et écarts

- **Vectorisation écrite pour Poulpe.** Potrace et ses portages sont sous licence GPL, incompatible avec la MPL-2.0 : l'algorithme est écrit ici, à partir des méthodes publiées (k-moyennes, suivi des bords de pixels, ajustement de Schneider). Les couleurs sont « empilées » comme le mode Empilé d'Illustrator : chaque tracé couvre aussi la place des couleurs posées au-dessus de lui, ce qui évite les fentes blanches entre deux couleurs.
- **Détourage par IA, sur l'ordinateur.** Le modèle est U²-Net dans sa version « silueta » (44 Mo, publiée par le projet rembg sous licence MIT, U²-Net étant sous licence Apache 2.0), exécuté par ONNX Runtime en WebAssembly dans un Web Worker. Il a été comparé à u2netp (4,6 Mo, nettement moins précis sur les bras et les cheveux) et à IS-Net (178 Mo, le plus précis, mais trop lourd pour l'installeur ; sa version compressée laisse des taches). Compter 1 à 4 secondes par photo. Les bords sont affinés par un filtre guidé sur la photo à 1024 pixels.
- **Taille de l'appli.** Le modèle (44 Mo) et ONNX Runtime (14 Mo) sont embarqués : l'installeur grossit d'environ 50 Mo, en échange d'un détourage qui marche sans connexion. Le site web ne les télécharge qu'au premier détourage.
- **Extensions isolées.** Une extension tourne dans QuickJS (un interpréteur JavaScript compilé en WebAssembly), pas dans la page : elle n'a ni fenêtre, ni réseau, ni fichiers, ni accès à l'appli de bureau, et elle est arrêtée après 5 secondes de calcul ou 64 Mo de mémoire. Elle ne voit que des copies du document et passe par les fonctions de `api.ts`. Les panneaux d'extension avec leur propre interface sont reportés : une commande demande ses réglages dans une fenêtre décrite par l'extension.
- **Macros.** Les gestes à la souris sur le canevas (tracer une forme, peindre) ne sont pas enregistrés, comme dans Affinity ; les réglages faits dans les panneaux Transformation, Couleur et Contour non plus pour l'instant. Une macro se rejoue comme plusieurs étapes d'historique.
- **Raccourcis des outils** (lettres seules) : pas encore personnalisables.
- **Signature des installeurs.** Elle demande des comptes payants ou une demande d'adhésion ; tout est prêt dans le workflow, voir [signature-et-mises-a-jour.md](signature-et-mises-a-jour.md). Les mises à jour automatiques ont besoin que les versions soient téléchargeables publiquement : tant que le dépôt est privé, l'appli ne trouve pas de mise à jour (sans message d'erreur au lancement).
- **Reporté** : accessibilité WCAG 2.2 AA vérifiée, documentation utilisateur complète en anglais, performances sur très gros fichiers (prévus en v1.x).

## Tests

- `packages/core/test/v10.test.ts` : vectorisation d'un carré (quatre coins nets, segments droits), d'un disque (quelques courbes qui restent sur le cercle), d'un anneau (trou en pair-impair, fond empilé), réduction des couleurs et fusion des taches, contours avec trou, pixels transparents ; tenseur du modèle, agrandissement, filtre guidé, masque final.
- `apps/editor/e2e/smart.spec.ts` : vectorisation en couleurs et en noir et blanc (disque retrouvé à 4 pixels près), suppression de l'arrière-plan avec le vrai modèle (sujet opaque, fond transparent), sélection du sujet.
- `apps/editor/e2e/automation.spec.ts` : enregistrement puis lecture d'une macro sur un autre objet, changement de raccourci (l'ancien ne marche plus, le menu affiche le nouveau), installation d'une extension d'exemple et sa commande avec réglages (une étape d'historique, toujours là après rechargement), les deux autres exemples, et l'isolement (pas de `window`, `fetch` ni accès à Tauri ; une boucle sans fin est arrêtée).

## Licences des composants ajoutés

ONNX Runtime Web (MIT, Microsoft), modèle U²-Net « silueta » (Apache 2.0 pour U²-Net, Xuebin Qin et coll. ; MIT pour la version rembg, Daniel Gatis), QuickJS (MIT, Fabrice Bellard et Charlie Gordon) et quickjs-emscripten (MIT, Jake Teton-Landis), greffons Tauri `updater` et `process` (MIT ou Apache 2.0). Les mentions sont livrées avec l'appli dans `LICENCES-TIERS.txt`.
