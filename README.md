# Sans Couleurs

Jeu de plateforme 2D en pixel art pour **deux joueurs**, developpe avec Phaser 3.
C'est l'histoire de la vie d'un personnage qui a mal vecu son enfance : un
monde gris, des enfants qui le trouvent "different", des mots qui pesent. Un
joueur joue a la souris, l'autre au clavier : on n'avance qu'ensemble (le train
ne part que si les deux sont dans la gare, et les mots du college ne
s'allegent que si les deux restent cote a cote).

## Sommaire

- [Apercu](#apercu)
- [Stack technique](#stack-technique)
- [Lancer le projet en local](#lancer-le-projet-en-local)
- [Structure du depot](#structure-du-depot)
- [Cartes et niveaux](#cartes-et-niveaux)
- [Le niveau 3 : porter les mots a deux](#le-niveau-3--porter-les-mots-a-deux)
- [Le niveau 4 : la fin](#le-niveau-4--la-fin)
- [Le niveau 5 : le lycee](#le-niveau-5--le-lycee)
- [Commandes](#commandes)
- [Systeme de dialogue](#systeme-de-dialogue)
- [Signaler un bug ou proposer une idee](#signaler-un-bug-ou-proposer-une-idee)
- [Licence](#licence)

## Apercu

Le jeu tourne entierement dans le navigateur, sans etape de build ni
dependance a installer : un fichier `index.html`, le code dans `src/` (modules
ES, un seul point d'entree, **une scene Phaser par fichier**, ecrit simplement
comme dans les tutoriels) et des assets exportes depuis
[Tiled](https://www.mapeditor.org/). Les cartes, les textes de zone, les
personnages non-joueurs et leurs dialogues sont definis depuis Tiled plutot que
codes en dur.

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
│   ├── niveau1.js              Niveau 1 : mini-tuto (panneaux + cible d'entrainement) + gare
│   ├── niveau2.js              Niveau 2 (enfance) : PNJ + gare + passage
│   ├── niveau3.js              Niveau 3 (college) : mots a porter, pastilles, gare
│   ├── niveau4.js              Niveau 4 (la fin) : plaine, epave du train, trois televisions
│   ├── niveau5.js, pression.js Niveau 5 (le lycee) : pieces, coups suggeres, pression
│   ├── pensees.js              Les pensees du personnage (ecrans noirs entre les niveaux)
│   ├── camera.js               La camera : un seul ecran qui suit les deux joueurs
│   ├── tir.js, cibles.js, tuto.js   Le tir (souris / clavier), la cible d'entrainement + timers, les panneaux du tuto
│   ├── phrases.js, pastilles.js    Niveau 3 : les mots du college ; pastille d'un joueur hors cadre (tous les niveaux)
│   ├── gare.js, passage.js         Interactions et changements de niveau
│   ├── pnj.js, dialogue.js, mots_a_placer.js               PNJ et dialogues a trous
│   ├── ecran_texte.js, decor.js, textes_de_zone.js         Ambiance
│   ├── chute.js                Tomber dans le vide (bords du monde)
│   ├── sons.js                 Musique de fond (fichier) + bruitages synthetises
│   └── styles.js, zone_cliquable.js   Petits utilitaires partages
├── assets/                     Fichiers charges par le jeu au runtime, et rien d'autre
│   ├── maps/                    Cartes exportees depuis Tiled (map-*.json)
│   ├── tilesets/                Images de tuiles (Tileset.png ; Tileset-college.png pour le niveau 3 ; Tileset-enfance.png pour le niveau 2)
│   ├── sprites/                 Personnages, train, herbe animee, cible...
│   ├── ui/                      Icone d'interaction
│   ├── fonts/                   Polices (voir le @font-face d'index.html)
│   └── audio/                   ambiance.mp3 : la musique de fond (les bruitages sont synthetises via Web Audio)
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
Tiled est chargee par nom (`map-1-debut`, `map-2-enfance`, `map-3-college`, `map-4-fin`, `map-5-lycee`).
Une carte peut avoir un deuxieme jeu de tuiles : le college a le sien (portes,
horloge, bancs...) et l'enfance aussi (balancoire, toboggan, arbre, bac a sable,
portail de l'ecole...), dessines pour eux. Cote fichiers Tiled : la source `.tmx` dans
`tiled/maps/`, l'export `.json` charge par le jeu dans `assets/maps/`.

Les niveaux s'enchainent : niveau 1 → (train) → niveau 2 → (passage) → niveau 3 →
(train) → niveau 4 → niveau 5. Entre deux niveaux, un ecran noir affiche les pensees du
personnage (a ecrire dans `src/pensees.js`).
La position de la gare n'est pas codee en dur : elle est recalculee depuis le
calque `gare` de la carte.

## Commandes

| | Joueur souris (J1) | Joueur clavier (J2) |
|---|---|---|
| Marcher | clic dans le vide | fleches gauche / droite |
| Interagir | clic sur l'element (PNJ, gare) | touche E dans la gare ; se placer a cote de l'autre joueur (mots du niveau 3) |
| Tirer (niveaux 1 et 2) | Ctrl ou Cmd + clic (vers le point clique) | barre espace (devant lui) |

Le niveau 1 sert de mini-tuto : des panneaux le long du chemin apprennent les
commandes (marcher, tirer sur une cible d'entrainement, prendre le train).

Le train ne part que si les **deux** joueurs agissent dessus : le joueur souris
clique sur la gare, le joueur clavier se place dedans et appuie sur E. On ne
peut pas revenir en arriere (le train du niveau 2 ne repart pas). Il n'y a pas de
tir dans le niveau 3.

## Le niveau 3 : porter les mots a deux

Le college est un long couloir (120 tuiles : la cour, l'entree, trois classes,
la sortie de secours, puis la gare). Il n'y a ni ennemi ni tir :

- toutes les 25 secondes, une sonnerie retentit et des mots arrivent **un par
  un** ; les mots **clairs** sont des moqueries legeres (poids 1), les mots
  **fonces** des insultes (poids 2) ;
- un mot qui touche un joueur **s'accroche au-dessus de sa tete** : chaque point
  de poids le ralentit, son ecran s'assombrit sur les bords et la musique devient
  plus grave ;
- on ne peut pas effacer les mots : ils ne se detachent que si **l'autre joueur
  reste a cote** (moins de 40 pixels). Un mot fonce s'eclaircit d'abord, puis
  se detache en devenant une phrase douce ;
- un joueur qui porte le poids maximum pendant 8 secondes **s'effondre** : fondu
  au noir, « Tu n'as pas pu avancer. », puis les deux joueurs repartent de la
  derniere porte de classe passee ;
- la camera est unique (comme dans tous les niveaux) : un joueur sorti du cadre apparait en **pastille** (un
  rond avec son visage et une fleche) au bord de l'ecran.

Les reglages (rythme des vagues, poids, delais...) sont tout en haut de
`src/phrases.js`.

## Le niveau 4 : la fin

Le point de cesure entre le college et le lycee. Une plaine immense et vide ;
d'un cote l'epave du train (le train ne repart plus), tres loin de l'autre trois
televisions espacees qui montrent un cardiogramme : on entend leur bip, de plus
en plus fort quand on s'approche. Au survol (ou en se mettant a cote), une
television tremble et montre une icone « E ».

Chaque television reagit a 4 interactions (un clic du joueur souris, ou la touche
E du joueur clavier a cote d'elle) : le cardiogramme va doucement, puis moyen,
puis rapide, puis la ligne devient plate, en boucle, avec un ton continu (la television reste la).
Quand les trois sont plates, un fondu au noir mene a l'ecran final. Le niveau a
sa propre ambiance sonore.

Le jeu aborde des sujets sensibles : un ecran d'avertissement, avec le 3114
(numero national de prevention du suicide), s'affiche tout au debut du jeu, avant
l'accueil, et l'ecran final le rappelle.

## Le niveau 5 : le lycee

Une suite de pieces (une salle de cours, une chambre, la rue, un tribunal, la
chambre la nuit) separees par de grands passages tout blancs (des tuiles
blanches, rien d'autre). Dans chaque piece, une scene de violence que l'on ne
montre jamais : on la fait ressentir. Une ombre arrive, on entend le choc, le
personnage tombe, les oreilles sifflent, la piece garde la trace (un pupitre
renverse, une lampe cassee, une vitre fendue). Le joueur ne subit rien de plus :
au bout de quelques secondes, le personnage se releve.

La pression monte a chaque coup : un voile sombre et flou sur les bords de
l'ecran, une musique plus lente et plus grave, des mouvements plus lents. Le
joueur clavier est une part du personnage lui-meme, un allie interieur, qui a
deux voix : une rationnelle, une emotionnelle. Quand les deux joueurs restent
l'un a cote de l'autre, la pression redescend, mais jamais tout a fait : il reste
des sequelles. Au tribunal, des accusations fausses s'accrochent au personnage,
puis « Classe sans suite ». La derniere piece, la nuit, ramene les coups en
ombres silencieuses : il faut rester ensemble pour tenir.

## Systeme de dialogue

Chaque reponse se fait **en deux phases, a deux joueurs** : le joueur souris
choisit l'enfant a qui parler, mais n'a pas encore de mots pour repondre. Les
mots **tombent du ciel** et c'est le **joueur clavier** qui les attrape en
marchant dessous (fleches) ; chaque mot attrape arrive dans la liste du joueur
souris, qui n'a plus qu'a les placer dans les trous de la phrase. Il y a
toujours plus de mots que de trous (des mots d'enfant en plus), et le joueur
clavier reste libre de marcher pendant tout le dialogue. Quels que soient les
mots, l'enfant est mal a l'aise, repond, et rit.

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

Les musiques d'ambiance (`assets/audio/ambiance.mp3` et `ambiance-monde4.mp3`)
sont des morceaux de tiers (telecharges sous les noms
« tunetank-dark-ambient-soundscape-music » et « cosmic-scapes-soft-brown-noise ») :
ils ne sont pas couverts par la licence MIT du code et restent soumis a la
licence de leurs auteurs.
