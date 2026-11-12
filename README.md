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
- **Avec une IA** (gratuite ou payante, voir plus bas) : elle reçoit des images de chaque passage et ce qui s'y dit. Elle décrit ce qui se passe, note chaque passage, garde les meilleurs parmi deux fois plus de candidats, et écrit des titres et une accroche sur mesure.

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

Tout se règle sur le site, dans « Titres par IA ». L'IA reçoit une image de chaque passage et ce qui s'y dit, note les passages, garde les meilleurs et écrit titres et accroche.

| IA | Coût | Mise en route |
|---|---|---|
| **Ollama** | Gratuit et illimité, tourne sur ton ordinateur | Installe [Ollama](https://ollama.com), puis `ollama pull gemma3:4b`. Pas de clé. 8 Go de mémoire conseillés. |
| **Groq** | Gratuit avec une limite par jour | Clé sur [console.groq.com](https://console.groq.com) |
| **Gemini** | Gratuit avec une limite par jour | Clé sur [aistudio.google.com](https://aistudio.google.com) |
| **OpenRouter** | Modèles gratuits avec limite | Clé sur [openrouter.ai](https://openrouter.ai) |
| **Claude** | Payant à l'usage, le plus précis | Clé sur [console.anthropic.com](https://console.anthropic.com) |
| **Autre** | Selon le service | Adresse d'un service compatible OpenAI (LM Studio, llama.cpp…) |

Le modèle est choisi automatiquement (tu peux en imposer un). Si l'IA est injoignable, refuse la clé ou atteint sa limite, le site le signale et les passages concernés gardent leurs titres d'analyse automatique.

Les clés restent dans ton navigateur et ne sont envoyées qu'à ton serveur. Pour fixer une IA par défaut côté serveur : `AI_PROVIDER` (`ollama`, `groq`, `gemini`, `openrouter`, `claude`, `custom`), `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL`.

Avec Docker, Ollama tourne hors du conteneur : ajoute `-e OLLAMA_URL=http://host.docker.internal:11434/v1`.

## Automatisation

Dans la partie « Automatisation » du site :

1. ajoute l'adresse d'une ou plusieurs chaînes (ou playlists) à surveiller ;
2. indique des mots-clés pour ne garder que certaines vidéos (par exemple `gta 6, gta vi`) ;
3. coche « Automatisation activée » et enregistre : les réglages de découpage et l'IA choisis en haut de la page sont repris.

Le site vérifie ensuite les chaînes à intervalle régulier. À chaque nouvelle vidéo, il la télécharge, la découpe et prépare titres et descriptions ; le résultat apparaît dans « Mes clips » avec l'étiquette « auto ». À l'ajout d'une chaîne, seule sa vidéo la plus récente est traitée, pas tout son historique.

Le serveur doit rester allumé pour que la veille tourne. Les réglages (y compris la clé de l'IA choisie) sont enregistrés dans `data/watch.json` sur ta machine, et les clips sont gardés 72 h.

La publication sur TikTok reste manuelle : tu télécharges le clip, tu copies la description, tu publies.

## Réglages

| Variable | Rôle | Défaut |
|---|---|---|
| `PORT` | Port du site | `3000` |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL` | IA par défaut du serveur | aucune |
| `ANTHROPIC_API_KEY` | Raccourci pour utiliser Claude par défaut | — |
| `CLIPPING_MODEL` | Modèle Claude utilisé | `claude-opus-5-5` |
| `OLLAMA_URL` | Adresse d'Ollama | `http://localhost:11434/v1` |
| `MAX_VIDEO_SECONDS` | Durée maximale d'une vidéo source | `10800` (3 h) |
| `MAX_UPLOAD_MB` | Taille maximale d'un fichier envoyé | `2048` |
| `KEEP_HOURS` | Durée de conservation des clips | `72` |
| `DATA_DIR` | Dossier de travail | `./data` |

## Bon à savoir

- YouTube bloque souvent les téléchargements depuis les hébergeurs cloud : le site marche le mieux lancé sur ton ordinateur. Garde `yt-dlp` à jour (`pip install -U yt-dlp`).
- Les vidéos sont traitées une par une ; les clips sont gardés 72 h puis supprimés.
- Republie uniquement des vidéos que tu as le droit d'utiliser (les tiennes ou avec l'accord du créateur) et laisse le crédit dans la description.

## Tests

```bash
npm test
```
