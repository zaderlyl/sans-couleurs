# Sans Couleurs

Jeu de plateforme 2D en pixel art, developpe avec Phaser 3. Le joueur incarne
un personnage seul, sans couleur, qui traverse un monde bicolore, discute
avec des personnages non-joueurs et emprunte un train pour passer d'un
niveau au suivant.

## Sommaire

- [Apercu](#apercu)
- [Stack technique](#stack-technique)
- [Lancer le projet en local](#lancer-le-projet-en-local)
- [Structure du depot](#structure-du-depot)
- [Cartes et niveaux](#cartes-et-niveaux)
- [Systeme de dialogue](#systeme-de-dialogue)
- [Signaler un bug ou proposer une idee](#signaler-un-bug-ou-proposer-une-idee)
- [Licence](#licence)

## Apercu

Le jeu tourne entierement dans le navigateur, sans etape de build ni
dependance a installer : un fichier `index.html`, le code dans `src/`
(plusieurs fichiers `.js` charges dans l'ordre, sans bundler) et des assets
exportes depuis [Tiled](https://www.mapeditor.org/). Les cartes,
les textes, les personnages non-joueurs et leurs dialogues sont tous
definis depuis Tiled plutot que codes en dur, pour pouvoir faire evoluer le
contenu du jeu sans toucher au code.

## Stack technique

- [Phaser 3](https://phaser.io/) (charge depuis un CDN, aucune installation
  necessaire) pour le moteur de jeu (rendu WebGL, physique, animations,
  audio).
- JavaScript vanilla, sans framework ni etape de build (pas de webpack, pas
  de bundler).
- [Tiled](https://www.mapeditor.org/) pour l'edition des cartes, exportees
  en JSON.
- Un panel d'administration statique (voir plus bas) pour la gestion des
  issues, publie via GitHub Pages.

## Lancer le projet en local

Le jeu doit etre servi par un serveur HTTP local (le navigateur bloque le
chargement des assets en ouvrant `index.html` directement en `file://`).
Par exemple, avec Python :

```bash
python3 -m http.server 8765
```

Puis ouvrir `http://localhost:8765` dans un navigateur.

Un parametre d'URL permet de charger directement une carte donnee pendant
les tests, sans repasser par tout le trajet en train depuis le debut :

```
http://localhost:8765/?carte=map-2-enfance
```

## Structure du depot

```
.
├── LICENSE                     Licence MIT
├── index.html                  Page d'entree : charge les fichiers de src/ dans l'ordre
├── src/                        Code du jeu (scripts classiques, portee globale partagee)
│   ├── js/
│   │   ├── config.js           Reglages generaux (modes, camera, sons, couleurs, styles)
│   │   ├── playerConfig.js     Reglages du personnage (spritesheet, vitesse, tangage)
│   │   ├── sons.js             Sons synthetises (ambiance, pas, atterrissage)
│   │   ├── camera.js           MettreAJourCamera() — suivi de camera chaque frame
│   │   ├── maps/
│   │   │   ├── cartes.js       Registre des cartes + helpers Tiled communs
│   │   │   └── map-*/map-*.js  Une carte chacun : config + tableau `features`
│   │   ├── features/           Une grosse feature par fichier (tele, textes de
│   │   │   └── *.js              zone...) : { precharger, installer, miseAJour }
│   │   ├── loading.js          Prechargement des assets (phase preload)
│   │   ├── controle.js         Entrees clavier
│   │   ├── player.js           Creation du personnage + deplacement par frame
│   │   └── index.js            Config Phaser + demarrage (charge en dernier)
│   └── game.js                 Le reste : gare/train, herbe, tunnel, PNJ,
│                                classe ScenePrincipale
├── assets/                     Fichiers charges par le jeu au runtime, et rien d'autre
│   ├── maps/                    Cartes exportees depuis Tiled (map-*.json)
│   ├── tilesets/                Images de tuiles referencees par les cartes
│   ├── sprites/
│   │   ├── characters/          Feuilles de sprites des personnages
│   │   ├── environment/         Herbe animee, train (gare)
│   │   └── props/               Objets animes (ecrans tele...)
│   ├── ui/                      Elements d'interface (icone d'interaction)
│   ├── fonts/                   Polices (voir le @font-face d'index.html)
│   └── audio/                   Reserve : les sons sont synthetises via Web Audio pour l'instant
├── tiled/                       Sources d'edition, jamais chargees par le jeu
│   ├── maps/                    Fichiers sources Tiled (.tmx)
│   └── art-source/              Images de travail et tuiles pas encore utilisees
├── docs/
│   └── index.html              Panel admin des issues, publie via GitHub Pages
└── .github/
    └── ISSUE_TEMPLATE/         Formulaires de creation d'issue
```

Regle : `assets/` ne contient que ce que le jeu charge reellement. Une image
de tuiles reste dans `tiled/art-source/` tant qu'aucune carte ne l'utilise ;
elle passe dans `assets/tilesets/` au moment ou on la branche.

## Cartes et niveaux

Chaque carte a un dossier `src/js/maps/map-<n>-<nom>/` (le numero suit
l'ordre de creation ; `map1`, la carte de test, garde `TEST`) ou elle
s'enregistre via `EnregistrerCarte(...)`. Sa config liste les `features`
qu'elle utilise (objets de `src/js/features/`) — on voit d'un coup d'oeil ce
qu'une carte contient, et une feature comme l'ecran de tele ne tourne que
sur les cartes qui la listent. Cote fichiers Tiled : la source `.tmx` dans
`tiled/maps/`, l'export `.json` charge par le jeu dans `assets/maps/`
(memes noms : `map-1-debut.json`, etc.).

Les niveaux s'enchainent via la gare : arrive au bout d'une carte, le joueur
prend un train qui charge la carte suivante (champ `suivante` de la config,
voir `src/js/maps/cartes.js`). La position et la zone d'interaction de la
gare ne sont pas codees en dur : elles sont recalculees depuis le calque
`gare` de chaque carte, donc une nouvelle carte n'a qu'a poser ce calque
pour que la gare fonctionne automatiquement.

## Systeme de dialogue

Les personnages non-joueurs et leurs dialogues sont entierement definis
depuis des proprietes personnalisees sur les objets Tiled (calque
`Calque d'Objets 1`) : ligne affichee au-dessus de la tete, phrase a trous
avec les mots a glisser-deposer, sprite et frame a utiliser. Aucune
modification de code n'est necessaire pour ajouter ou modifier un
personnage.

## Signaler un bug ou proposer une idee

Le depot utilise des formulaires d'issue structures plutot que des issues
libres :

- **Signalement de bug** — description, etapes de reproduction, gravite.
- **Proposition de fonctionnalite** — description, motivation, priorite.

Ces formulaires apparaissent automatiquement en cliquant sur "New issue"
sur GitHub.

Un panel d'administration dedie, publie via GitHub Pages a l'adresse
[zaderlyl.github.io/sans-couleurs](https://zaderlyl.github.io/sans-couleurs/),
permet de lister, filtrer, creer et gerer les issues (labels, etat,
commentaires) sans passer par l'interface par defaut de GitHub. Il est
reserve a la maintenance du depot et necessite un token d'acces personnel
GitHub pour s'y connecter.

## Licence

Ce projet est publie sous licence [MIT](LICENSE) : chacun peut l'utiliser, le
modifier et le redistribuer, y compris a des fins commerciales, a condition
de conserver la mention de copyright et le texte de la licence.

Copyright (c) 2026 Lilian Cornet.
