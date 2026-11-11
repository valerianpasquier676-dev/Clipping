# Clipping

Site web qui transforme une vidéo longue (lien YouTube ou autre, ou fichier) en clips verticaux prêts pour TikTok, avec des titres accrocheurs, une description et des hashtags.

## Ce que fait le site

1. **Télécharge** la vidéo depuis son lien (YouTube, Twitch, etc. via `yt-dlp`) ou prend un fichier envoyé depuis l'appareil.
2. **Repère les meilleurs moments** : courbe « moments les plus revus » de YouTube quand elle existe, combinée à l'énergie sonore (réactions, explosions, musique).
3. **Découpe** chaque passage en 1080×1920 (fond flouté ou zoom plein écran), avec le titre incrusté en haut si tu le souhaites.
4. **Propose 3 titres par clip**, une description avec hashtags et le crédit de la chaîne d'origine. Un clic sur un titre le copie.

## Lancer le site

Il faut [Node.js 20+](https://nodejs.org), [ffmpeg](https://ffmpeg.org) et [yt-dlp](https://github.com/yt-dlp/yt-dlp) installés.

```bash
npm install
npm start
```

Puis ouvre <http://localhost:3000>.

Avec Docker (tout est inclus) :

```bash
docker build -t clipping .
docker run -p 3000:3000 clipping
```

## Titres écrits par IA (optionnel)

Sans réglage, les titres viennent de modèles d'accroches intégrés. Pour des titres écrits à partir de ce qui se dit vraiment dans chaque clip (sous-titres, chapitres), fournis une clé API Anthropic :

```bash
ANTHROPIC_API_KEY=sk-ant-... npm start
```

## Réglages

| Variable | Rôle | Défaut |
|---|---|---|
| `PORT` | Port du site | `3000` |
| `ANTHROPIC_API_KEY` | Active les titres IA | — |
| `CLIPPING_MODEL` | Modèle utilisé pour les titres | `claude-opus-5-5` |
| `MAX_VIDEO_SECONDS` | Durée maximale d'une vidéo source | `10800` (3 h) |
| `MAX_UPLOAD_MB` | Taille maximale d'un fichier envoyé | `2048` |
| `KEEP_HOURS` | Durée de conservation des clips | `24` |
| `DATA_DIR` | Dossier de travail | `./data` |

## Bon à savoir

- YouTube bloque souvent les téléchargements depuis les hébergeurs cloud : le site marche le mieux lancé sur ton ordinateur. Garde `yt-dlp` à jour (`pip install -U yt-dlp`).
- Les vidéos sont traitées une par une ; les clips sont gardés 24 h puis supprimés.
- Republie uniquement des vidéos que tu as le droit d'utiliser (les tiennes ou avec l'accord du créateur) et laisse le crédit dans la description.

## Tests

```bash
npm test
```
