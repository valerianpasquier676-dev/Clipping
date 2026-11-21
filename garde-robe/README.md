# Ma garde-robe

Site pour répertorier tes vêtements et laisser un algorithme préparer **chaque jour de la semaine** des tenues variées, adaptées à la **météo**, à ta **morphologie** et à ton **style**. Fonctionne sur ordinateur et téléphone (installable comme une application depuis le navigateur).

## Ce que ça fait

- **Garde-robe** : t-shirts, chemises, polos, pulls, sweats, vestes, manteaux, doudounes, K-way, pantalons, jeans, shorts, jupes, robes, baskets, chaussures de ville, bottes, bottines, claquettes, tongs, sandales, chaussettes, caleçons, lunettes, casquettes, chapeaux, bonnets, écharpes, gants, ceintures, montres, colliers, bracelets, bagues, boucles d'oreilles, sacs à dos et sacs. Pour chaque pièce : photo, marque, couleurs, motif, coupe, taille, matière, formalité, chaleur, imperméable/coupe-vent, saisons, style, favori, « au sale ».
- **Scan** : photo ou caméra → le fond est retiré automatiquement (réglable : sensibilité, toucher le fond pour le corriger), les couleurs dominantes et le motif sont détectés, la fiche est pré-remplie.
- **Semaine** : 7 jours avec météo réelle (Open-Meteo, gratuit) ou saisie à la main. Pour chaque jour un **thème** (casual, streetwear, smart casual, business, minimaliste, sport, soirée, rétro, outdoor, cosy, été, color pop), un **contexte** (travail, loisirs, soirée, sport, voyage), la tenue complète avec accessoires, l'explication du choix, les conseils météo (pluie, vent, UV, écart matin/soir, froid, canicule), « Varier cette tenue », échange de n'importe quelle pièce, « Je la porte » (suivi des pièces portées, chaussettes et sous-vêtements mis au sale).
- **Simulation** : mannequin **3D** dimensionné d'après tes mesures et habillé avec les pièces (couleurs, rayures, carreaux, coupe, longueurs, accessoires), à faire tourner ; ou **planche** avec tes vraies photos détourées ; vue d'ensemble de la semaine.
- **Moi** : analyse morphologique d'après tes mesures (sablier, poire, triangle inversé, rectangle, rond, athlétique) avec ce qui te valorise, ce qui est à manier avec précaution, astuces taille/jambes/épaules ; forme du visage (lunettes, chapeaux), sous-ton et palette de couleurs, dress code, sensibilité au froid.
- **Accessoires** : cohérence des métaux, montre selon la tenue, bijoux, sac, ceinture/chaussures, écharpe, lunettes selon le soleil.
- **Parfums** : ta collection, le meilleur choix du jour selon température, pluie, thème et contexte, dosage, familles olfactives, guide d'application.
- **Marques** : les marques indépendantes préchargées (Stuque Divin by Divin, NoClout, Cynique d'Avril, Supply Vicinity) sont des noms saisis tels que donnés : corrige l'orthographe dans *Garde-robe → Marques*. Le style et la coupe d'une marque préremplissent les nouvelles pièces et orientent vers les bons thèmes (streetwear…).

## Modèles 3D réalistes (optionnel)

Le mannequin habille les pièces avec des vêtements simplifiés. Pour un rendu plus réaliste, modélise tes propres vêtements dans Blender (gratuit, sans compte) : voir `models/GUIDE-BLENDER.md`. Le mannequin de référence à utiliser pour modéliser est `models/mannequin-reference.glb`, et `viewer.html` permet de tester un fichier `.glb` porté par le mannequin avant de le déclarer dans `models/models.json`.

## Lancer

```bash
npm run garde-robe   # puis http://localhost:3200
npm test             # inclut les tests de garde-robe/
```

Aucune dépendance à installer (Three.js est embarqué dans `vendor/`). Le dossier peut être hébergé tel quel sur un hébergement statique (HTTPS requis pour la caméra et l'installation sur téléphone).

## Vie privée

Tout est stocké dans le navigateur (IndexedDB), photos comprises : rien n'est envoyé à un serveur. Seul le **nom de la ville** est envoyé à Open-Meteo pour la météo. L'analyse morphologique part de mesures saisies, jamais d'une photo de toi. Vider les données du navigateur efface tout : utilise *Moi → Sauvegarder (JSON)*, qui permet aussi de passer de l'ordinateur au téléphone.

## Limites

- Sans modèles GLB fournis, la 3D est une **simulation stylisée** (mannequin paramétrique), pas une reconstruction photo-réaliste du vêtement. Pour le réalisme, la planche utilise tes vraies photos.
- Le détourage fonctionne mieux sur fond uni et contrasté ; blanc sur blanc est signalé comme peu fiable.
- Les conseils de morphologie, de couleurs et de parfums sont des repères de style généraux.

## Fichiers

`engine.js` (moteur de tenues), `morph.js` (morphologie, accessoires, parfums), `scan.js` (détourage et couleurs), `weather.js`, `mannequin3d.js`, `data.js` (catégories, thèmes, conseils), `ui/` (écrans), `store.js` (IndexedDB), `sw.js` + `manifest.webmanifest` (installation et hors ligne).
