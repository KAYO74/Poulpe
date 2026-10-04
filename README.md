# Projet Poulpe

> Nom provisoire. Extension des fichiers : `.poulpe`.

Application libre et gratuite de création graphique qui réunit la puissance d'Affinity, Illustrator et Photoshop (vectoriel, retouche photo, mise en page) et la simplicité de Canva (modèles, glisser-déposer). Interface moderne, épurée et ergonomique, proche d'Affinity.

**Statut :** moteur d'édition v0.1 en cours : formes, texte, calques, couleurs et dégradés, export PNG, JPEG, SVG et PDF, appli de bureau. Le dépôt est privé pour l'instant.

## En bref

- **Application de bureau installable** sur Windows, macOS et Linux avec [Tauri](https://v2.tauri.app/), qui embarque le même code web. Une version navigateur reste disponible sans installation.
- **Local d'abord** : les fichiers restent sur l'appareil, l'appli fonctionne hors ligne, aucun serveur n'est nécessaire pour éditer.
- **Interface façon Affinity** : thème sombre, barre contextuelle, Studios ancrables, espaces de travail Dessin, Photo et Mise en page. Les outils sont à droite par défaut, côté et disposition personnalisables.
- **Français et anglais**, au choix de l'utilisateur dans l'appli.
- **Format ouvert** : `.poulpe` est une archive ZIP contenant un document JSON versionné et ses ressources. Export PNG, JPEG, SVG et PDF.

## Lancer Poulpe

Il faut Node 20 ou plus et pnpm 10 (`corepack enable`).

```sh
pnpm install
pnpm dev            # éditeur dans le navigateur : http://localhost:5173
pnpm test           # tests du moteur
pnpm e2e            # tests de bout en bout
pnpm desktop:dev    # appli de bureau (Rust et dépendances Tauri requis)
```

Le détail est dans [Moteur d'édition v0.1](docs/moteur-v0.1.md).

## Organisation du code

| Dossier | Rôle |
| --- | --- |
| `packages/core` | Modèle de document, commandes, historique, export SVG, format `.poulpe` |
| `packages/render` | Rendu sur canevas, export PNG et JPEG |
| `apps/editor` | Interface façon Affinity (React + Vite) |
| `apps/desktop` | Appli de bureau Tauri 2 |

## Stack technique

| Couche | Choix |
| --- | --- |
| Langage | TypeScript strict, monorepo pnpm |
| Rendu | Canvas 2D derrière une interface de rendu ; CanvasKit (Skia en WebAssembly) prévu pour la v0.3 |
| Interface | React, Vite, Radix UI |
| Bureau | Tauri 2 (Electron en solution de repli) |
| Tests | Vitest, Playwright |

## Documentation

- [Moteur d'édition v0.1 : état et organisation du code](docs/moteur-v0.1.md)
- [Format de fichier `.poulpe`](docs/format-poulpe.md)
- [Cadrage et architecture](docs/cadrage-architecture.md)
- [Feuille de route des fonctionnalités](docs/feuille-de-route.md)
- [Maquette de l'interface v3](design/maquette-v3.html) : prototype interactif à ouvrir dans un navigateur (voir [design/README.md](design/README.md))

## Feuille de route

| Jalon | Contenu |
| --- | --- |
| v0.1 | Moteur d'édition de base, installeurs de bureau |
| v0.2 | Côté Canva : modèles, bibliothèque d'éléments, formats réseaux sociaux |
| v0.3 | Vectoriel pro (Illustrator, Affinity Designer) |
| v0.4 | Retouche photo (Photoshop, Affinity Photo) |
| v0.5 | Mise en page et export pro (Affinity Publisher, impression) |
| v1.0 | Version stable, appli signée avec mises à jour automatiques |

## Licence

Le code est distribué sous [Mozilla Public License 2.0](LICENSE).
