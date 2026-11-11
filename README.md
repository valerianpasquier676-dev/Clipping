# Clipping

Site web qui transforme une vidéo longue (lien YouTube ou autre, ou fichier) en clips verticaux prêts pour TikTok, avec des titres accrocheurs, une description et des hashtags.

## Ce que fait le site

1. **Télécharge** la vidéo depuis son lien (YouTube, Twitch, etc. via `yt-dlp`) ou prend un fichier envoyé depuis l'appareil.
2. **Repère les meilleurs moments** en croisant trois signaux : la courbe « moments les plus revus » de YouTube quand elle existe, l'intensité sonore (réactions, explosions, musique) et le rythme du montage (changements de plan).
3. **Coupe proprement** : le début et la fin de chaque clip sont recalés sur les phrases quand la vidéo a des sous-titres, sinon sur les changements de plan, pour ne couper ni une phrase ni une scène.
4. **Découpe** chaque passage en 1080×1920 (fond flouté ou zoom plein écran), avec une accroche incrustée en haut si tu le souhaites.
5. **Écrit des textes adaptés à chaque clip** : 3 titres, une description avec hashtags et le crédit de la chaîne d'origine. Un clic sur un titre le copie.

### Comment les textes s'adaptent

- **Sans réglage (analyse automatique)** : le site regarde ce que contient chaque clip — le chapitre, les phrases prononcées (une citation marquante devient un titre), le thème abordé (carte, police, véhicules, date de sortie, graphismes…), et la situation (scène d'action, montée en tension, moment intense, plan calme). Deux clips ne reçoivent jamais le même titre.
- **Avec l'IA** : Claude reçoit trois images de chaque passage et ce qui s'y dit. Il décrit ce qui se passe, note chaque passage, garde les meilleurs parmi deux fois plus de candidats, et écrit des titres et une accroche sur mesure.

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

## Activer l'IA

Crée une clé API sur <https://console.anthropic.com> (service payant à l'usage), puis au choix :

- colle-la sur le site, dans « Titres par IA » (elle reste dans ton navigateur et n'est envoyée qu'à ton serveur) ;
- ou lance le serveur avec `ANTHROPIC_API_KEY=sk-ant-... npm start`.

Si la clé est refusée ou le service injoignable, le site le signale et repasse sur l'analyse automatique.

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
