# Tympan — blind test multijoueur

Blind test en ligne jusqu'à **8 joueurs** par salon. Chaque joueur écoute l'extrait sur son propre appareil (synchronisé par le serveur) et tape sa réponse. Les extraits de 30 secondes viennent de l'API publique Deezer : aucune clé ni compte nécessaire.

## Modes de jeu

| Mode | Règle |
|---|---|
| **Classique** | Titre (+100) et artiste (+100), points réduits jusqu'à moitié selon le temps écoulé. |
| **Rapidité** | Seul le titre compte : 300 pts au premier, 220 au deuxième, 170, 130… |
| **QCM** | 4 propositions, une seule tentative. 100 pts + bonus de vitesse jusqu'à 100. |
| **Survie** | 3 vies, chaque titre non trouvé en coûte une. Le dernier en vie gagne. |

Les réponses tolèrent accents, majuscules, ponctuation et petites fautes de frappe. On peut taper le titre, l'artiste, ou les deux d'un coup (« one more time - daft punk »).

## Playlists

- **Par année** : années 70, 80, 90, 2000, 2010, 2020 (~30 titres chacune, avec l'année affichée à la révélation)
- **Par style** : Rap FR, Rap US, Rock, Électro & Dance, Variété française
- **Par artiste** : 18 artistes populaires (top Deezer de l'artiste ; seul le titre est à trouver, et il vaut double)
- **Spécial** : Mix total, Hits du moment (classement Deezer en direct), Artiste au choix (n'importe quel nom)

Pour ajouter ou modifier une playlist, édite `playlists.js` : chaque morceau est une ligne `['Artiste', 'Titre', année]`.

## Lancer en local

Il faut Node.js 18 ou plus récent.

```bash
npm install
npm start
```

Puis ouvre http://localhost:3000. Pour jouer à plusieurs sur le même Wi‑Fi, les autres ouvrent `http://<ip-de-ton-pc>:3000`.

`npm run mock` lance un mode test sans réseau ni son (titres fictifs), utile pour tester l'interface.

## Mettre en ligne (gratuit)

Le jeu a besoin d'un serveur Node qui reste allumé (WebSocket), donc pas d'hébergement statique type Netlify/GitHub Pages.

**Render** (le plus simple)
1. Pousse ce dossier sur un dépôt GitHub.
2. Sur render.com : *New* → *Web Service* → choisis le dépôt.
3. Build command : `npm install` · Start command : `npm start` · Plan : Free.
4. Partage l'URL fournie (`https://ton-jeu.onrender.com`).

Le plan gratuit de Render met le serveur en veille après 15 min sans visite : la première ouverture prend ~30 s, ensuite tout est fluide.

**Railway / Fly.io / un VPS** fonctionnent aussi : même commande `npm start`, le port est lu dans la variable `PORT`.

## Bon à savoir

- **Son** : le navigateur exige un clic avant de jouer de l'audio ; les boutons « Créer » / « Rejoindre » s'en chargent. Si le son est bloqué (rechargement de page en pleine partie), un bouton « Activer le son » apparaît.
- **Reconnexion** : un joueur qui recharge la page revient dans son salon avec son score.
- **Hôte** : s'il quitte, le rôle passe au joueur suivant. L'hôte peut passer une manche ou terminer la partie.
- **Deezer** : l'API limite à 50 requêtes / 5 s par serveur. La préparation d'une partie prend 2 à 5 s ; un titre introuvable est simplement remplacé par un autre de la playlist.
- Les salons sont gardés en mémoire : redémarrer le serveur les vide.

## Structure

```
server.js      salons, déroulé des manches, scores (Socket.io)
deezer.js      recherche des extraits sur l'API Deezer
playlists.js   catalogue des playlists
match.js       comparaison tolérante des réponses
public/        interface (index.html, style.css, app.js)
```
