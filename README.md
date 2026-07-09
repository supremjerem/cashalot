# Cashalot

Dashboard personnel pour suivre revenus, dépenses et épargne — pensé pour remplacer un tableur. Édition en place (ajout/suppression/édition de lignes), calculs en direct (reste à vivre, lissage des charges annuelles/trimestrielles), et deux vues (Cartes / Compact) sur les mêmes données.

## Stack

Aucune dépendance de build : Vue 3 (Composition API) chargé en module ES, vendorisé localement dans `vendor/`. Le site est 100 % statique — `index.html` + `src/`.

## Démarrer en local

```bash
npm install   # outils de dev (lint, format) uniquement — aucune dépendance runtime
npm run dev   # sert le site sur http://localhost:8080
```

`app.js` étant un module ES, ouvrir `index.html` directement en `file://` ne fonctionne pas : il faut un serveur (`npm run dev`, ou tout autre serveur statique).

## Scripts

| Commande               | Effet                                  |
| ----------------------- | --------------------------------------- |
| `npm run dev`           | Sert le site en local                   |
| `npm run lint`          | ESLint sur `src/` et `scripts/`         |
| `npm run format`        | Formate avec Prettier                   |
| `npm run format:check`  | Vérifie le formatage sans modifier      |

## Structure

```
index.html          Structure + template Vue (vues Cartes et Compact)
src/
  app.js            État réactif, calculs, persistance, animations
  style.css         Design tokens et styles
vendor/
  vue.esm-browser.prod.js   Vue 3, vendorisé (pas de dépendance réseau au runtime)
scripts/
  dev-server.mjs    Petit serveur statique Node (zéro dépendance)
.github/workflows/  CI (lint/format) + déploiement GitHub Pages
```

## Données & vie privée

Toutes les données (revenus, dépenses, crédits, épargne...) vivent **uniquement dans le `localStorage` du navigateur** — rien n'est envoyé à un serveur, rien n'est commité dans le code. Les données d'exemple embarquées dans `src/app.js` (`seedData`) sont fictives.

Le `localStorage` est vidé si tu effaces les données de navigation. Utilise les boutons **Exporter** / **Importer** en haut du dashboard pour sauvegarder/restaurer tes données en JSON.
