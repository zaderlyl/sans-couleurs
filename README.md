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
dependance a installer : un fichier `index.html`, un fichier `game.js`, et
des assets exportes depuis [Tiled](https://www.mapeditor.org/). Les cartes,
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
http://localhost:8765/?carte=enfance
```

## Structure du depot

```
.
├── index.html              Page d'entree du jeu
├── game.js                 Toute la logique du jeu (scene, physique,
│                            camera, dialogues, gare/train...)
├── assets/
│   ├── maps/                Cartes Tiled (.tmx sources + .json exportes)
│   ├── tilesets/             Images de tuiles utilisees par les cartes
│   ├── sprites/               Feuilles de sprites (personnage, herbe...)
│   ├── font/                    Police utilisee pour les textes de zone
│   └── UI/                        Elements d'interface (icone d'interaction)
├── docs/
│   └── index.html            Panel admin des issues, publie via GitHub Pages
└── .github/
    └── ISSUE_TEMPLATE/       Formulaires de creation d'issue
```

## Cartes et niveaux

Chaque carte est un fichier Tiled independant dans `assets/maps/`. Les
niveaux s'enchainent via la gare : arrive au bout d'une carte, le joueur
prend un train qui charge la carte suivante (voir la constante
`CarteSuivante` dans `game.js`). La position et la zone d'interaction de la
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

Ce depot ne comporte pas de fichier de licence : tous droits sont donc
reserves. Le code source est visible publiquement, mais sa reutilisation,
sa modification ou sa redistribution ne sont pas autorisees sans
l'accord explicite de l'auteur.
