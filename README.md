# Projet Poulpe

> Nom provisoire. Extension des fichiers : `.poulpe`.

Application libre et gratuite de création graphique qui réunit la puissance d'Affinity, Illustrator et Photoshop (vectoriel, retouche photo, mise en page) et la simplicité de Canva (modèles, glisser-déposer). Interface moderne, épurée et ergonomique, proche d'Affinity.

**Statut :** cadrage terminé, développement du moteur d'édition (v0.1) à venir. Le dépôt est privé pour l'instant.

## En bref

- **Application de bureau installable** sur Windows, macOS et Linux avec [Tauri](https://v2.tauri.app/), qui embarque le même code web. Une version navigateur reste disponible sans installation.
- **Local d'abord** : les fichiers restent sur l'appareil, l'appli fonctionne hors ligne, aucun serveur n'est nécessaire pour éditer.
- **Interface façon Affinity** : thème sombre, barre contextuelle, Studios ancrables, espaces de travail Dessin, Photo et Mise en page. Les outils sont à droite par défaut, côté et disposition personnalisables.
- **Français et anglais**, au choix de l'utilisateur dans l'appli.
- **Format ouvert** : `.poulpe` est une archive ZIP contenant un document JSON versionné et ses ressources. Export PNG, JPEG, SVG et PDF.

## Stack technique

| Couche | Choix |
| --- | --- |
| Langage | TypeScript strict, monorepo pnpm |
| Rendu | CanvasKit (Skia en WebAssembly) sur WebGL 2 |
| Interface | React, Vite, Radix UI |
| Bureau | Tauri 2 (Electron en solution de repli) |
| Tests | Vitest, Playwright |

## Documentation

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
