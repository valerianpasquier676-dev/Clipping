# Mes abonnements

Petit site pour retracer tous les abonnements (mensuels, annuels…) prélevés sur tes cartes.

- **Cartes** : tu enregistres tes cartes (nom + 4 derniers chiffres + couleur, jamais le numéro complet).
- **Abonnements** : nom, montant, fréquence (semaine, mois, trimestre, semestre, année), un jour de prélèvement connu, carte, catégorie, statut (actif / en pause / résilié), lien de résiliation, notes.
- **Résumé** : coût par mois et par an (les abonnements annuels sont ramenés au mois), nombre d'abonnements actifs, ce qui sera prélevé dans les 30 prochains jours.
- **Répartition** par carte et par catégorie, filtres, recherche, tri.
- **Détection automatique** : *Données → Importer un relevé bancaire*. Tu fournis l'export CSV ou OFX de l'historique de ta banque (6 à 12 mois idéalement) et le site repère les paiements récurrents (même commerçant, rythme régulier, montant stable), propose nom, montant, fréquence, dernière date et catégorie, puis ajoute ceux que tu coches. Les services courants (Netflix, Spotify, Orange, salle de sport…) sont reconnus d'office ; les anciens abonnements qui ne sont plus prélevés sont signalés, et un nouvel import ne crée pas de doublons.
- **Données** : sauvegarde / restauration JSON, export CSV pour un tableur.

Le relevé est analysé dans le navigateur et n'est jamais envoyé. Limites : les abonnements annuels ne sont repérés que si le relevé couvre plus d'un an, et la détection peut se tromper (d'où la liste à cocher). Un numéro de carte seul ne permet de rien retrouver : seul l'historique de la banque le permet.

Tout est stocké dans le navigateur (`localStorage`) : aucun serveur, aucune donnée envoyée. Fais une sauvegarde de temps en temps, car vider les données du navigateur efface tout. Les montants sont en euros.

## Lancer

```bash
npm run abonnements     # puis http://localhost:3100
npm test                # inclut les tests de abonnements/logic.test.js
```

Aucune dépendance : ça peut aussi être hébergé tel quel sur n'importe quel hébergement statique (GitHub Pages, Netlify…) en publiant le dossier `abonnements/`.

## Fichiers

- `detect.js` : lecture des relevés (CSV/OFX) et détection des paiements récurrents, testée.
- `logic.js` : calculs (prochain prélèvement, totaux, import/export), sans DOM, testé.
- `app.js`, `index.html`, `style.css` : l'interface.
- `serve.js` : serveur local minimal.
