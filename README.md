# Sans Couleurs

Jeu de plateforme 2D en pixel art pour **deux joueurs**, developpe avec Phaser 3.
C'est l'histoire de la vie d'un personnage qui a mal vecu son enfance : un
monde gris, des enfants qui le trouvent "different", un glitch de pixels de
couleur. Un joueur joue a la souris, l'autre au clavier : le train ne part que
si les deux sont dans la gare.

## Sommaire

- [Apercu](#apercu)
- [Stack technique](#stack-technique)
- [Lancer le projet en local](#lancer-le-projet-en-local)
- [Structure du depot](#structure-du-depot)
- [Cartes et niveaux](#cartes-et-niveaux)
- [Commandes](#commandes)
- [Systeme de dialogue](#systeme-de-dialogue)
- [Signaler un bug ou proposer une idee](#signaler-un-bug-ou-proposer-une-idee)
- [Licence](#licence)

## Apercu

Le jeu tourne entierement dans le navigateur, sans etape de build ni
dependance a installer : un fichier `index.html`, le code dans `src/` (modules
ES, un seul point d'entree, **une scene Phaser par fichier**, ecrit simplement
comme dans les tutoriels) et des assets exportes depuis
[Tiled](https://www.mapeditor.org/). Les cartes, les zones de glitch, les textes
de zone, les personnages non-joueurs et leurs dialogues sont definis depuis
Tiled plutot que codes en dur.

## Stack technique

- [Phaser 3](https://phaser.io/) (charge depuis un CDN, aucune installation
  necessaire) pour le moteur de jeu (rendu WebGL, physique, animations,
  audio).
- JavaScript vanilla en modules ES (`import` / `export`), sans framework ni
  etape de build (pas de webpack, pas de bundler).
- [Tiled](https://www.mapeditor.org/) pour l'edition des cartes, exportees
  en JSON.
- Un panel d'administration statique (voir plus bas) pour la gestion des
  issues, publie via GitHub Pages.

## Lancer le projet en local

Le jeu doit etre servi par un serveur HTTP local (le navigateur bloque les
modules ES et le chargement des assets en `file://`). L'ideal en dev est
l'extension **Live Server** de VS Code : elle ne met rien en cache et
recharge la page a chaque sauvegarde. Sinon, avec Python :

```bash
python3 -m http.server 8765
```

Puis ouvrir `http://localhost:8765`. Avec un serveur qui met en cache (comme
`http.server`), recharger en force apres modification d'un fichier `.js`
(Cmd/Ctrl + Maj + R).

## Structure du depot

```
.
├── LICENSE                     Licence MIT
├── index.html                  Page d'entree : <script type="module" src="src/index.js">
├── src/                        Code du jeu (modules ES, un fichier = un sujet)
│   ├── index.js                Config Phaser + liste des scenes
│   ├── accueil.js              Page d'accueil (titre + boutons)
│   ├── niveau.js               Classe de base des niveaux (carte, 2 joueurs, tir, decor)
│   ├── niveau1.js              Niveau 1 : cibles + gare
│   ├── niveau2.js              Niveau 2 (enfance) : PNJ + gare + passage
│   ├── niveau3.js              Niveau 3 (college) : portails, casiers, glitch, gare
│   ├── ecran_separe.js         L'ecran qui se separe en deux (2 cameras)
│   ├── tir.js, cibles.js       Le tir (souris / clavier) et les cibles + timers
│   ├── portails.js, casiers_faux.js, gare.js, passage.js   Interactions
│   ├── pnj.js, dialogue.js, mots_a_placer.js               PNJ et dialogues a trous
│   ├── glitch.js, ecran_texte.js, decor.js, textes_de_zone.js   Ambiance
│   ├── chute.js                Tomber dans le vide (bords du monde)
│   ├── sons.js                 Sons synthetises (musique de fond + bruitages)
│   └── styles.js, zone_cliquable.js   Petits utilitaires partages
├── assets/                     Fichiers charges par le jeu au runtime, et rien d'autre
│   ├── maps/                    Cartes exportees depuis Tiled (map-*.json)
│   ├── tilesets/                Images de tuiles referencees par les cartes
│   ├── sprites/                 Personnages, train, herbe animee, cibles...
│   ├── ui/                      Icone d'interaction
│   ├── fonts/                   Polices (voir le @font-face d'index.html)
│   └── audio/                   Reserve : les sons sont synthetises via Web Audio
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

Chaque niveau est une scene Phaser (un fichier `niveauN.js`) qui herite de la
classe de base `niveau.js` et ne contient que ce qui lui est propre. La carte
Tiled est chargee par nom (`map-1-debut`, `map-2-enfance`,
`map-3-debut-college`). Cote fichiers Tiled : la source `.tmx` dans
`tiled/maps/`, l'export `.json` charge par le jeu dans `assets/maps/`.

Les niveaux s'enchainent : niveau 1 → (train) → niveau 2 → (passage) → niveau 3.
La position de la gare n'est pas codee en dur : elle est recalculee depuis le
calque `gare` de la carte.

## Commandes

| | Joueur souris (J1) | Joueur clavier (J2) |
|---|---|---|
| Marcher | clic dans le vide | fleches gauche / droite |
| Interagir | clic sur l'element (PNJ, gare, portail) | touche E (portails) |
| Tirer | Ctrl ou Cmd + clic (vers le point clique) | barre espace (devant lui) |

Le train ne part que si les deux joueurs sont dans la gare.

## Systeme de dialogue

Les personnages non-joueurs et leurs dialogues sont entierement definis
depuis des proprietes personnalisees sur les objets Tiled (calque
`Calque d'Objets 1`) : ligne affichee au-dessus de la tete, phrase a trous
avec les mots a glisser-deposer, sprite et frame a utiliser. Aucune
modification de code n'est necessaire pour ajouter ou modifier un
personnage. Le format exact des proprietes est documente en tete de
`src/pnj.js`.

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
