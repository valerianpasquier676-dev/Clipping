# Guide : modéliser un hoodie (ou autre) dans Blender pour le site

Blender est **gratuit et sans compte** : télécharge la version **Portable** (.zip) sur blender.org, décompresse-la où tu veux (clé USB, dossier perso) et lance `blender.exe`. Aucune installation, aucun droit administrateur.

Ce que tu produis : **un fichier `.glb` par type de vêtement** (ex. `sweat.glb` pour tous les hoodies). La couleur de chaque pièce de ta garde-robe est appliquée dessus par le site : tu n'as donc pas besoin d'un modèle par couleur.

## 1. Partir du mannequin de référence

1. Blender → `Fichier > Importer > glTF 2.0 (.glb)` → `models/mannequin-reference.glb`.
2. Ne **déplace pas, ne tourne pas, ne redimensionne pas** le mannequin : le vêtement doit rester exactement à sa place. 1 unité = 1 mètre, le mannequin mesure 1,75 m, ses pieds sont à zéro. (Blender affiche l'axe Z vers le haut : c'est normal, l'export remettra l'axe Y vers le haut.)

## 2. Modéliser le hoodie

Méthode simple et rapide (≈ 1 h) :

1. **Corps et manches** : sélectionne le mannequin, passe en mode Édition (Tab), sélectionne les faces du torse et des bras (de l'épaule au poignet), `Maj+D` puis `Échap` pour dupliquer sur place, puis `P > Sélection` pour séparer en un nouvel objet. Nomme-le `sweat`.
2. Ajoute les modificateurs (clé à molette) : **Solidify** (épaisseur 0,01 à 0,015 m, offset 1) puis **Subdivision Surface** (niveau 1). Agrandis légèrement l'objet le long des normales (`Alt+S` en mode Édition) pour qu'il ne traverse pas le corps : prévois 1,5 à 3 cm d'aisance pour un hoodie, davantage pour un oversize.
3. **Capuche** : ajoute un cylindre ou un tore aplati autour du cou, étire-le vers l'arrière, creuse l'ouverture ; ou modélise-la en plan avec Solidify.
4. **Poche kangourou, bandes de bas et de poignets** : plans extrudés légèrement, côtelé sculpté ou texturé.
5. **Cordons** : courbes (Ajouter > Courbe > Bézier) avec « Profondeur » > 0,004 m dans les propriétés de la courbe.
6. **Plis réalistes** (optionnel) : mode Sculpt → pinceau **Cloth** ou **Crease** ; ou active la physique **Cloth** sur le vêtement avec le mannequin en **Collision**, lance la simulation 50 à 100 images, puis applique le modificateur Cloth.
   Pour des vêtements très réalistes, **Marvelous Designer** ou **CLO 3D** (patrons simulés) sont plus rapides ; exporte en OBJ ou GLB et nettoie dans Blender.
7. Allège : `Modificateur Decimate` jusqu'à **moins de 20 000 triangles** (le site l'affiche dans le visualiseur).

## 3. UV et matériaux

1. UV : mode Édition, tout sélectionner, `U > Smart UV Project`.
2. **Matériau principal du tissu : nomme-le `couleur_principale`** (ou tout nom commençant par `couleur`, `color` ou `tissu`). C'est lui qui prend la couleur de ta pièce. Base-le sur un **Principled BSDF** : Roughness 0,8, Metallic 0, pas d'émission.
3. Les autres éléments (cordons, œillets, logo, étiquette) : **donne-leur d'autres noms** (`cordon`, `logo`…) : ils garderont leur couleur et leur texture.
4. Une texture sur le tissu (côtelé, grain) ? Utilise-la en **Normal map** ou en **Roughness**, pas en couleur : la teinte du site se multiplie avec la couleur du matériau.

## 4. Exporter

1. **Supprime ou masque le mannequin de référence** (ou sélectionne uniquement ton vêtement).
2. `Ctrl+A > Toutes les transformations` sur le vêtement. Ne déplace pas son origine.
3. `Fichier > Exporter > glTF 2.0` :
   - Format : **glTF binaire (.glb)**
   - Inclure : **Objets sélectionnés**
   - Transformation : **+Y vers le haut**
   - Géométrie : **Appliquer les modificateurs**, UV, Normales
   - Matériaux : Exporter
   - **Pas de compression Draco** (le site ne la décode pas).
4. Enregistre sous `sweat.glb` (nom libre).

## 5. Tester puis brancher

1. Lance le site (`npm run garde-robe`) et ouvre **http://localhost:3200/viewer.html**.
2. Choisis ton fichier, la catégorie (« Sweat / hoodie »), une couleur : tu vois le vêtement porté, tu peux changer les mensurations pour tester l'ajustement. Le visualiseur affiche le nombre de triangles et le nombre de matériaux teintés.
3. Satisfait ? Copie le fichier dans `models/` et déclare-le dans `models/models.json` :

```json
{ "sweat": "sweat.glb", "tshirt": "tshirt.glb" }
```

Recharge le site : toutes les pièces de cette catégorie utilisent ton modèle, les autres gardent le vêtement simplifié. Un exemple de structure est fourni : `models/exemples/exemple-sweat.glb`.

## Catégories (clé à utiliser dans `models.json`)

| Hauts | Vestes | Bas | Chaussures | Accessoires |
|---|---|---|---|---|
| `tshirt` `debardeur` `polo` `chemise` `pull` `sweat` `gilet` | `veste` `blouson` `manteau` `doudoune` `impermeable` `coupevent` | `pantalon` `jean` `jogging` `short` `bermuda` `jupe` `robe` | `baskets` `ville` `bottines` `bottes` `sandales` `claquettes` `tongs` | `casquette` `chapeau` `bonnet` `echarpe` `gants` `ceinture` `lunettes` `montre` `collier` `bracelet` `bague` `boucles` `sacados` `sac` |

## Bon à savoir

- **Mise à l'échelle** : le modèle est ajusté sur le mannequin de référence puis étiré selon les mesures de la personne (poitrine pour les hauts, hanches pour les bas, taille pour le reste). C'est approximatif sur des morphologies très éloignées de la référence.
- **Superpositions** : si tu modélises un hoodie **et** une veste, fais la veste 2 à 4 cm plus grande pour qu'elle ne traverse pas le hoodie.
- **Chaussettes, chaussures, lunettes, casquettes** : modélise-les à leur place sur le mannequin de référence (pieds au sol, tête en place).
- **Scanner un vrai vêtement** (Polycam, Luma, KIRI Engine, ou Meshroom sur PC) : possible, mais un tissu souple, brillant ou noir se scanne mal. Importe le résultat dans Blender, recale-le sur le mannequin, simplifie-le (Decimate / Remesh) et renomme le matériau principal comme ci-dessus.
