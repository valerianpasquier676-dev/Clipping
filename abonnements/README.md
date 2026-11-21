# Mes abonnements

Petit site pour retracer tous les abonnements (mensuels, annuels…) prélevés sur tes cartes.

- **Cartes** : tu enregistres tes cartes (nom + 4 derniers chiffres + couleur, jamais le numéro complet).
- **Abonnements** : nom, montant, fréquence (semaine, mois, trimestre, semestre, année), un jour de prélèvement connu, carte, catégorie, statut (actif / en pause / résilié), lien de résiliation, notes.
- **Résumé** : coût par mois et par an (les abonnements annuels sont ramenés au mois), nombre d'abonnements actifs, ce qui sera prélevé dans les 30 prochains jours.
- **Répartition** par carte et par catégorie, filtres, recherche, tri.
- **Données** : sauvegarde / restauration JSON, export CSV pour un tableur.

Tout est stocké dans le navigateur (`localStorage`) : aucun serveur, aucune donnée envoyée. Fais une sauvegarde de temps en temps, car vider les données du navigateur efface tout. Les montants sont en euros.

## Lancer

```bash
npm run abonnements     # puis http://localhost:3100
npm test                # inclut les tests de abonnements/logic.test.js
```

Aucune dépendance : ça peut aussi être hébergé tel quel sur n'importe quel hébergement statique (GitHub Pages, Netlify…) en publiant le dossier `abonnements/`.

## Fichiers

- `logic.js` : calculs (prochain prélèvement, totaux, import/export), sans DOM, testé.
- `app.js`, `index.html`, `style.css` : l'interface.
- `serve.js` : serveur local minimal.
