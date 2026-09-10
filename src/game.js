// "Sans Couleurs" — coeur du jeu (scene Phaser unique).
// Un personnage blanc, seul, avance dans un decor bicolore, discute avec des
// PNJ et prend un train pour changer de niveau.
//
// ── Decoupage du code (src/) ─────────────────────────────────────────────
// Tous les fichiers sont des <script> classiques charges dans l'ordre par
// index.html — meme portee globale, pas de module ni d'etape de build. Ordre :
//   js/config.js                reglages generaux (modes, camera, sons,
//                               couleurs, styles de texte)
//   js/playerConfig.js          reglages du personnage
//   js/sons.js                  sons synthetises (ambiance, pas, atterrissage)
//   js/maps/cartes.js           registre des cartes + helpers Tiled communs
//   js/camera.js                MettreAJourCamera() — suivi de camera
//   js/features/*.js            une grosse feature chacun (tele, textes de
//                               zone...), objet { precharger, installer, miseAJour }
//   js/maps/map-*/map-*.js      une carte chacun : config + tableau `features`
//   js/loading.js               PrechargerAssets() — phase preload()
//   js/controle.js              InstallerControles() / LireDeplacement()
//   js/player.js                CreerPersonnage() / MettreAJourDeplacement()
//   game.js  (ce fichier)       le reste : gare/train, herbe, tunnel, PNJ,
//                               ScenePrincipale
//   js/index.js                 config Phaser + demarrage (charge en dernier)
// Ce fichier sera decoupe davantage au fil des passes suivantes.
//
// ── Structure des assets ─────────────────────────────────────────────────
//   assets/tilesets/<nom>.png           -> image de tileset referencee par une map
//   assets/maps/<nom>.json              -> map exportee depuis Tiled (File > Export As > JSON)
//   assets/sprites/characters/<nom>.png -> feuilles de sprites des personnages
//   assets/sprites/environment/<nom>.png-> herbe animee, train (gare)
//   assets/sprites/props/<nom>.png      -> objets animes (ecrans tele...)
//   assets/ui/<nom>.png                 -> elements d'interface (icone d'interaction)
//   assets/fonts/<nom>.otf              -> polices (voir le @font-face d'index.html)
//   Les sources d'edition (.tmx Tiled, images de travail) vivent dans tiled/,
//   hors du dossier assets/ qui ne contient que ce qui est charge au runtime.
//
// Reglages generaux (modes, camera, sons, couleurs, styles de texte) :
// src/js/config.js. Personnage : src/js/playerConfig.js + src/js/player.js.
// Cartes / helpers Tiled : src/js/maps/cartes.js (+ un dossier par carte).
// Sons : src/js/sons.js. Suivi camera : src/js/camera.js.
// Les calques bg, bg2, devant... sont purement visuels ; toutes les cartes
// n'ont pas les memes (ex: seule map-TEST-map1 a "derriere"), donc create()
// verifie leur presence avant de s'en servir.

// Herbe animee : feature src/js/features/herbe.js. Tunnel : feature
// src/js/features/tunnel.js.

// CalculerBoitePixels / CalculerBoiteTuiles / CalqueEstFlippe /
// ValeurNombreTiled / ValeurBooleenneTiled : voir src/js/maps/cartes.js.

// --- Interactivite gare (calques "gare" et "derriere", n'importe quelle
// carte) ---
// Ni la position/zone de la gare, ni celles de sa mosaique de sortie ne sont
// codees en dur : chaque carte peut les placer a des cases differentes (ex:
// "enfance" n'est pas du tout aux memes colonnes que "debut"/"map1") — voir
// CalculerBoiteTuiles et son usage dans create() (this.PositionGareX/Y,
// this.ZoneGare, this.PositionIconeInteractionX pour "gare" ;
// this.PositionGareInverseeX/Y, this.PositionSortieTunnelX/Y, this.ZoneRetour,
// this.PositionIconeInteractionRetourX pour "derriere"), calcules depuis le
// contenu reel de chaque calque plutot que fixes pour une seule carte.
const TailleTuile = 16;

// --- Icone d'interaction (E_animated.png) ---
// 11 frames de 16x16 : les 3 premieres (E encadre plein, puis pointille) sont
// l'invite affichee quand le joueur est a portee, jouee en boucle. Les 8
// suivantes montrent le E qui eclate une fois la touche pressee, jouees une
// fois — la sequence de la gare ne demarre qu'a la toute fin de cette anim.
const CleIconeInteraction = 'iconeInteraction';
const CheminIconeInteraction = 'assets/ui/E_animated.png';
const TailleIconeInteraction = 16;
// Hauteur fixe au-dessus de la gare (this.PositionIconeInteractionX suit lui
// la position de la gare de la carte active — voir plus haut).
const PositionIconeInteractionY = 80;

// --- Spritesheet d'animation de la gare (gare.png) ---
// Grille 8x8 = 64 frames de 256x256px, fond transparent, toutes remplies.
const CleGare = 'animationGare';
const CheminGare = 'assets/sprites/environment/gare.png';
const TailleImageGare = 256;
const NombreImagesGare = 64; // grille 8x8

// Calibration exacte (plutot que tatonner au pixel pres), etablie a l'origine
// sur "debut"/"map1" (tuile locale 37 du tileset posee en case (35,8) du
// calque "gare", donc au pixel monde (560, 128)) : ce bloc de tuiles a ete
// decoupe directement dans gare.png a partir du pixel (80, 208) de chaque
// frame 256x256 (coin superieur-gauche du bloc de 11x3 tuiles qui compose la
// gare). Le pixel (80, 208 + 2*16) = (80, 240) d'une frame correspond donc au
// COIN BAS-GAUCHE du bloc de tuiles, quelle que soit la carte — voir
// CalculerBoiteTuiles (this.PositionGareX = ColMin*16, this.PositionGareY =
// RangeeMax*16, generalisation de (35*16, 8*16) = (560, 128)).
const AncrageImageGareX = 80;
const AncrageImageGareY = 240;

const OrigineContenuGareX = AncrageImageGareX / TailleImageGare;
const OrigineContenuGareY = AncrageImageGareY / TailleImageGare;
// Largeur (en px) du dessin utile dans une frame de gare.png : il occupe
// [AncrageImageGareX .. TailleImageGare], soit 176px.
const LargeurContenuGare = TailleImageGare - AncrageImageGareX;
// Pour poser le sprite de sorte que son contenu utile soit centre sur un
// bloc de tuiles dont on connait le centre (en px monde), il faut retrancher
// a ce centre un decalage qui depend du sens du sprite (le contenu n'est PAS
// centre dans la frame : il touche le bord droit) :
//   - NON flippe : contenu a [X .. X+176], centre a X + 88  -> X = centre - 88
//   - flippe      : contenu a [X-80 .. X+96], centre a X + 8 -> X = centre - 8
// (verifie sur le bloc "derriere" de map1 : 176px, cols 73-83, centre 1256,
//  1256 - 8 = 1248, la valeur historique).
const DecalageCentreGareNonFlippe = LargeurContenuGare / 2; // 88
const DecalageCentreGareFlippe = LargeurContenuGare / 2 - AncrageImageGareX; // 8

// --- Sortie du "tunnel" (voyage en train) ---
// Le calque "derriere" (purement visuel/repere, jamais rendu — voir
// create()) forme, quand il existe, un miroir horizontal exact de la
// mosaique de depart ("gare") : memes tuiles, juste retournees et dans
// l'ordre inverse. On reutilise donc le meme sprite gare.png pour l'arrivee,
// juste flippe (setFlipX), plutot qu'un second asset (voir
// DemarrerSequenceGare et JouerArriveeEnTrain). Sa position n'est PAS codee
// en dur : comme pour le calque "gare" (voir CalculerBoiteTuiles plus bas),
// elle est calculee depuis le contenu reel du calque "derriere" de la carte
// active — this.PositionGareInverseeX/Y (sprite flippe), this.PositionSortieTunnelX/Y
// (point d'apparition du joueur), this.ZoneRetour et this.PositionIconeInteractionRetourX,
// tous calcules dans create().
const PositionIconeInteractionRetourY = 80; // meme hauteur au-dessus du sol que celle de la gare

// Le mini-jeu de dialogue PNJ est une feature : src/js/features/dialogue-pnj.js
// (format des proprietes Tiled documente en tete de ce fichier).

// Sons du jeu (ambiance, pas, atterrissage + AudioContext partage) :
// src/js/sons.js. Sons de la tele : src/js/features/tele.js.
// Styles de texte, couleurs, reglages du mode prototype : src/js/config.js.

class ScenePrincipale extends Phaser.Scene {
  // Appele a chaque demarrage/redemarrage de la scene (le tout premier lancement
  // ET chaque this.scene.restart(...), voir DemarrerSequenceGare) — AVANT
  // preload(). "data" est absent au tout premier lancement (on prend alors la
  // carte de depart, ou ?carte=<cle> en test — voir CleCarteDeDepart) ; il
  // contient { carte, arrivee } quand on arrive d'une autre carte via le train
  // (voir CleCarteSuivante). this.ArriveeParTrain pilote JouerArriveeEnTrain,
  // appele en toute fin de create().
  init(Donnees) {
    this.NomCarteActuelle = (Donnees && Donnees.carte) || CleCarteDeDepart();
    this.ArriveeParTrain = !!(Donnees && Donnees.arrivee);
  }

  preload() {
    // Tout le prechargement est dans src/js/loading.js.
    PrechargerAssets(this);
  }

  create() {
    this.cameras.main.setBackgroundColor('#000000');

    // En mode d'echelle RESIZE, Phaser ne redimensionne pas la camera tout
    // seul : sans ca, elle reste a 0x0 et rien ne s'affiche. Pas besoin de
    // rien recalculer d'autre ici : MettreAJourCamera (voir update()) relit
    // la taille de la camera a chaque frame, donc un redimensionnement se
    // repercute tout seul des la frame suivante.
    this.cameras.main.setSize(this.scale.width, this.scale.height);
    this.scale.on('resize', (TailleJeu) => {
      this.cameras.main.setSize(TailleJeu.width, TailleJeu.height);
    });

    let Sol; // le collider du sol/decor, quel que soit le mode
    let LargeurMonde = LargeurMondeParDefaut;
    let HauteurMonde = HauteurMondeParDefaut;
    let PositionDepartX = 120;
    let PositionDepartY = HauteurSol - 30;

    if (UtiliseCarteTiled) {
      // ── Mode Tiled ──────────────────────────────────────────────────
      // this.make.tilemap lit les donnees JSON chargees en preload()
      const Carte = this.make.tilemap({ key: this.NomCarteActuelle });
      // Associe l'image de tileset chargee au tileset declare dans le JSON
      const JeuDeTuiles = Carte.addTilesetImage(NomTuilesDansTiled, CleTuiles);

      // Cree chaque calque de map1.json, dans l'ordre (le premier cree
      // s'affiche en dessous des suivants). Adapte cette liste si tu
      // renommes/ajoutes des calques dans Tiled.
      Carte.createLayer('bg', JeuDeTuiles, 0, 0);
      Carte.createLayer('bg2', JeuDeTuiles, 0, 0);

      // Reference gardee (this.CalqueGare sert de simple flag "cette carte a
      // une gare" un peu partout, voir les gardes "if (this.CalqueGare ...)"
      // plus bas) mais JAMAIS affiche : la mosaique statique posee dans
      // Tiled ne s'alignait pas exactement au pixel pres avec le sprite
      // anime (this.SpriteGare) qui se superpose dessus pendant les
      // sequences, ce qui causait un leger decalage visible au moment de
      // basculer de l'un a l'autre. this.SpriteGare (fige sur la frame 0 en
      // dehors des sequences, voir plus bas) le remplace entierement, y
      // compris au repos.
      this.CalqueGare = Carte.createLayer('gare', JeuDeTuiles, 0, 0);
      if (this.CalqueGare) this.CalqueGare.setVisible(false);
      const CalqueSol = Carte.createLayer(NomCalqueSol, JeuDeTuiles, 0, 0); // 'sol'

      // Sens de la mosaique "gare" de CETTE carte : certaines cartes (ex:
      // "enfance") la dessinent retournee par rapport a "debut"/"map1", pour
      // que le train fasse face au bon sens compte tenu du reste du decor.
      // this.SpriteGare (voir plus bas) doit alors etre flippe pareil pour
      // rester coherent avec la mosaique statique qu'il remplace au repos
      // (voir this.CalqueGare juste au-dessus) — jamais un sens fixe pour
      // toutes les cartes.
      this.GareFlippee = CalqueEstFlippe(Carte, 'gare');

      // Position/zone de la gare, calculees depuis le calque "gare" REEL de
      // la carte active (voir CalculerBoiteTuiles) plutot que codees en dur —
      // chaque carte peut placer sa gare a des cases differentes (ex:
      // "enfance" n'est pas du tout aux memes colonnes que "debut"/"map1").
      const BoiteGare = CalculerBoiteTuiles(Carte, 'gare');
      if (BoiteGare) {
        const { ColMin, ColMax, RangeeMin, RangeeMax } = BoiteGare;
        // Centre du bloc, en pixels monde (englobe toute la largeur, jusqu'au
        // bord droit inclus).
        const CentreGareX = (ColMin * TailleTuile + (ColMax + 1) * TailleTuile) / 2;
        // Position du sprite gare (this.SpriteGare) : son contenu utile doit
        // etre centre sur le bloc. Le decalage a retrancher au centre depend
        // du sens du sprite (this.GareFlippee), le sprite etant "flippe PUIS
        // place" et non l'inverse — voir DecalageCentreGareFlippe/NonFlippe.
        // Pour un bloc de 11 tuiles (176px) non flippe, ca redonne ColMin*16,
        // la valeur historique.
        this.PositionGareX = CentreGareX - (this.GareFlippee ? DecalageCentreGareFlippe : DecalageCentreGareNonFlippe);
        this.PositionGareY = RangeeMax * TailleTuile;
        this.PositionIconeInteractionX = CentreGareX;
        // Point d'apparition du joueur en arrivant en train sur CETTE carte
        // (voir JouerArriveeEnTrain) : centre du bloc, rangee du haut — la
        // gravite le fait retomber tout seul sur le sol, comme au spawn normal.
        this.PositionArriveeX = CentreGareX;
        this.PositionArriveeY = RangeeMin * TailleTuile;
        // Zone d'interaction : quelques cases centrees sur le bloc, a sa
        // rangee du bas (meme gabarit relatif que l'ancien ZoneGare fixe,
        // cases 39-43 sur un bloc 35-45 centre en 40).
        const ColCentre = ColMin + Math.floor((ColMax - ColMin) / 2);
        this.ZoneGare = {
          XMin: (ColCentre - 1) * TailleTuile,
          XMax: (ColCentre + 3) * TailleTuile,
          YMin: RangeeMax * TailleTuile,
          YMax: (RangeeMax + 1) * TailleTuile,
        };
      } else {
        // Pas de calque "gare" sur cette carte : desactive toute l'interactivite
        // liee (this.CalqueGare reste undefined de toute facon, voir les
        // gardes "if (this.CalqueGare ...)" plus bas).
        this.ZoneGare = { XMin: 0, XMax: 0, YMin: 0, YMax: 0 };
      }

      // 'derriere' n'existe pas forcement sur toutes les cartes (ex: "debut"
      // n'en a pas encore), et sert souvent a plusieurs choses a la fois sur
      // celles qui l'ont (repere pour la tele, autres decors...), EN PLUS de
      // la mosaique miroir d'arrivee du train (voir DemarrerSequenceGare et
      // JouerArriveeEnTrain) — jamais affiche lui-meme. On isole cette
      // mosaique du reste via son etat de flip HORIZONTAL OPPOSE a celui de
      // "gare" sur cette meme carte (!this.GareFlippee, voir juste au-dessus) :
      // cette mosaique est justement construite en reprenant les tuiles de
      // "gare" et en les retournant une fois de plus dans Tiled, ce qui la
      // rend facilement identifiable independamment de sa position exacte,
      // qui elle n'est PAS codee en dur (varie d'une carte a l'autre comme
      // pour le calque "gare" ci-dessus).
      const BoiteDerriere = CalculerBoiteTuiles(Carte, 'derriere', !this.GareFlippee);
      this.ArriveeTrainConfiguree = !!BoiteDerriere;
      if (BoiteDerriere) {
        Carte.createLayer('derriere', JeuDeTuiles, 0, 0).setVisible(false);
        const { ColMin, ColMax, RangeeMin, RangeeMax } = BoiteDerriere;
        const CentreDerriereX = (ColMin * TailleTuile + (ColMax + 1) * TailleTuile) / 2;
        // Sprite centre sur ce bloc, dans le sens oppose a "gare" (la mosaique
        // miroir — voir setFlipX(!this.GareFlippee) dans DemarrerSequenceGare) :
        // le decalage a retrancher au centre depend donc de ce sens.
        this.PositionGareInverseeX = CentreDerriereX - (this.GareFlippee ? DecalageCentreGareNonFlippe : DecalageCentreGareFlippe);
        this.PositionGareInverseeY = RangeeMax * TailleTuile; // meme convention que PositionGareY, sur SA propre rangee
        // Point d'apparition du joueur a l'arrivee : centre du bloc, rangee
        // du haut — la gravite le fait retomber tout seul sur le sol, comme
        // au spawn normal.
        this.PositionSortieTunnelX = CentreDerriereX;
        this.PositionSortieTunnelY = RangeeMin * TailleTuile;
        // Zone de retour (EtatGare "retourAttente", voir DemarrerSequenceGare
        // et DemarrerRetourGare) : meme gabarit que ZoneGare, centree sur le
        // point d'arrivee.
        this.ZoneRetour = {
          XMin: this.PositionSortieTunnelX - 32,
          XMax: this.PositionSortieTunnelX + 32,
          YMin: RangeeMax * TailleTuile,
          YMax: (RangeeMax + 1) * TailleTuile,
        };
        this.PositionIconeInteractionRetourX = this.PositionSortieTunnelX;
      } else {
        // Pas de calque "derriere" sur cette carte : this.IconeInteractionRetour
        // est quand meme cree juste apres (toujours cache) et a besoin d'une
        // position numerique valide, meme si ZoneRetour ne sera jamais
        // atteignable (EtatGare ne passe a "retourAttente" que via une
        // arrivee sur un calque "derriere" existant).
        this.PositionIconeInteractionRetourX = 0;
        this.ZoneRetour = { XMin: 0, XMax: 0, YMin: 0, YMax: 0 };
      }

      // Features de la carte active (voir sa config + src/js/features/).
      // Installees ICI, avant l'herbe et le personnage : les sprites poses
      // par une feature (ex: la tele) gardent le meme ordre d'affichage.
      InstallerFeaturesCarte(this, { Carte, JeuDeTuiles });

      // (l'herbe du calque "devant" et le calque "tunnel" sont des features,
      // installees par InstallerFeaturesCarte ci-dessus.)

      // Sprite anime de la gare : cache au depart, superpose a la mosaique
      // statique de tuiles et affiche uniquement pendant l'interaction (voir
      // DemarrerSequenceGare). L'origine est calibree sur le centre du dessin
      // utile dans chaque frame (pas le centre du canevas 256x256), pour
      // s'aligner pile sur la mosaique.
      // clignoteGare : frames 3 et 4 (index 2 et 3), jouees 2 fois, lentement.
      this.anims.create({
        key: 'clignoteGare',
        frames: [
          { key: CleGare, frame: 2 },
          { key: CleGare, frame: 3 },
        ],
        frameRate: 2, // lent : une frame toutes les 500ms
        repeat: 1, // rejoue la sequence une fois de plus (2 fois au total)
      });
      // resteGare : le reste de la feuille (index 5 a 63), jouee une fois,
      // apres le tremblement.
      this.anims.create({
        key: 'resteGare',
        frames: this.anims.generateFrameNumbers(CleGare, { start: 5, end: NombreImagesGare - 1 }),
        frameRate: 10,
        repeat: 0,
      });
      // arriveeGare : les memes frames que resteGare, mais a l'envers — le
      // train (parti vite) arrive en douceur puis s'arrete. Jouee a la sortie
      // du tunnel, sur le sprite flippe (voir DemarrerSequenceGare).
      const FramesArriveeGare = [];
      for (let i = NombreImagesGare - 1; i >= 5; i--) FramesArriveeGare.push({ key: CleGare, frame: i });
      this.anims.create({
        key: 'arriveeGare',
        frames: FramesArriveeGare,
        frameRate: 10,
        repeat: 0,
      });
      this.SpriteGare = this.add.sprite(this.PositionGareX, this.PositionGareY, CleGare, 0);
      this.SpriteGare.setOrigin(OrigineContenuGareX, OrigineContenuGareY);
      this.SpriteGare.setDepth(5);
      // Visible par defaut (frame 0) : c'est lui qui tient lieu de mosaique
      // "au repos" en dehors des sequences (voir this.CalqueGare plus haut)
      // — sauf si la carte n'a pas de calque "gare" exploitable
      // (this.PositionGareX resterait alors undefined, voir CalculerBoiteTuiles).
      // Flippe pareil que la mosaique statique qu'il remplace (this.GareFlippee).
      this.SpriteGare.setVisible(this.PositionGareX !== undefined);
      this.SpriteGare.setFlipX(this.GareFlippee);

      // Icone d'interaction : suit le joueur au-dessus de sa tete tant qu'il
      // est dans ZoneGare. iconeAttente boucle (invite), iconePressee joue
      // une fois quand la touche est pressee (voir update()).
      this.anims.create({
        key: 'iconeAttente',
        frames: this.anims.generateFrameNumbers(CleIconeInteraction, { start: 0, end: 2 }),
        frameRate: 4,
        repeat: -1,
      });
      this.anims.create({
        key: 'iconePressee',
        frames: this.anims.generateFrameNumbers(CleIconeInteraction, { start: 3, end: 10 }),
        frameRate: 14,
        repeat: 0,
      });
      this.IconeInteraction = this.add.sprite(this.PositionIconeInteractionX, PositionIconeInteractionY, CleIconeInteraction, 0);
      this.IconeInteraction.setDepth(20); // au-dessus de tout le reste
      this.IconeInteraction.setVisible(false);

      // (l'icone au-dessus de la tele, this.IconeInteractionTele, est creee
      // par le hook auChargement de map-TEST-map1)

      // 2e instance : invite du trajet retour, a l'arrivee (voir ZoneRetour
      // et DemarrerRetourGare). Meme fonctionnement que celle de la gare
      // (disparait definitivement une fois la sequence lancee).
      this.IconeInteractionRetour = this.add.sprite(this.PositionIconeInteractionRetourX, PositionIconeInteractionRetourY, CleIconeInteraction, 0);
      this.IconeInteractionRetour.setDepth(20);
      this.IconeInteractionRetour.setVisible(false);


      // Aucune propriete "collides" definie pour l'instant dans Tiled : on
      // rend donc solide toute case non vide (-1) du calque de sol. Si tu
      // preferes du cas par cas plus tard, utilise plutot
      // CalqueSol.setCollisionByProperty({ collides: true }) avec des
      // proprietes posees tuile par tuile dans Tiled.
      CalqueSol.setCollisionByExclusion([-1]);

      Sol = CalqueSol;
      LargeurMonde = Carte.widthInPixels;
      HauteurMonde = Carte.heightInPixels;

      // Le pixel art (tuiles 16px) est minuscule sans zoom sur un canvas de 960px
      this.cameras.main.setZoom(ZoomCamera);

      // Point de spawn place dans Tiled (calque d'objets "Calque d'Objets 1",
      // objet ponctuel nomme "spawn"). Si jamais il est absent/renomme, on
      // retombe sur une position par defaut au-dessus du sol.
      const PointDepart = Carte.findObject("Calque d'Objets 1", (Objet) => Objet.name === 'spawn');
      PositionDepartX = PointDepart ? PointDepart.x : 250;
      PositionDepartY = PointDepart ? PointDepart.y : 120;

      // Arrivee en train depuis une autre carte (voir init() et
      // CarteSuivante) : le joueur apparait sur le bloc "gare" de cette carte
      // (this.PositionArriveeX/Y) plutot qu'au spawn normal — voir
      // JouerArriveeEnTrain, appele en toute fin de create() une fois le reste
      // de la scene pret. Si la carte n'a pas de gare, on retombe sur le spawn
      // normal ci-dessus.
      if (this.ArriveeParTrain && this.PositionArriveeX !== undefined) {
        PositionDepartX = this.PositionArriveeX;
        PositionDepartY = this.PositionArriveeY;
      }
    } else {
      // ── Mode prototype (sans Tiled) : la ligne droite bicolore actuelle ──
      Sol = this.add.rectangle(LargeurMonde / 2, HauteurSol + 40, LargeurMonde, 80, CouleurSol);
      this.physics.add.existing(Sol, true); // true = corps statique (ne bouge jamais)

      // Liseré d'accent purement visuel, sans collision
      this.add.rectangle(LargeurMonde / 2, HauteurSol, LargeurMonde, 4, CouleurAccent);
    }

    this.physics.world.setBounds(0, 0, LargeurMonde, HauteurMonde);
    // Pas de this.cameras.main.setBounds(...) : rentre en conflit avec notre
    // suivi manuel (voir MettreAJourCamera) — teste et confirme que ce n'est
    // PAS ce qui cause l'ecran noir (present avec ou sans), donc pas la
    // peine de garder ce conflit pour rien.

    // ── Personnage ──────────────────────────────────────────────────────
    // Creation + emetteur de poussiere + etat de deplacement : voir
    // CreerPersonnage dans src/js/player.js.
    CreerPersonnage(this, PositionDepartX, PositionDepartY);
    this.physics.add.collider(this.Personnage, Sol);

    // Suivi de camera entierement manuel (voir MettreAJourCamera dans
    // update()), plutot que startFollow(...) : constate a l'usage que
    // Phaser recalcule scrollY tout seul a chaque redimensionnement de la
    // fenetre, meme avec lerpY=0 (cense le "geler" definitivement) — un
    // comportement surprenant de cette version qui rendait tout correctif
    // applique une seule fois ecrase peu apres. Piloter nous-memes scrollX
    // ET scrollY chaque frame evite ce probleme une bonne fois pour toutes.
    this.HauteurMondeCarte = HauteurMonde;
    this.LargeurMondeCarte = LargeurMonde;
    // true force un recadrage horizontal instantane dans MettreAJourCamera
    // (utilise pendant le voyage en train, voir
    // DemarrerSequenceGare/DemarrerRetourGare) ; remis a false une fois
    // arrive pour retrouver le suivi doux normal.
    this.CameraDoitSauterEnX = false;

    // Entrees clavier : voir InstallerControles dans src/js/controle.js.
    InstallerControles(this);

    // Etat de la sequence gare : attente -> enCours -> termine.
    // this.CalqueGare n'existe qu'en mode Tiled (voir plus haut) ; en mode
    // prototype il reste undefined et l'interaction ne se declenche jamais.
    this.EtatGare = 'attente';

    // (le dialogue PNJ est une feature : creation des PNJ, etat et handlers
    // glisser-deposer sont dans src/js/features/dialogue-pnj.js, installes
    // par InstallerFeaturesCarte plus haut. this.DialogueOuvert, pose par la
    // feature, gele le mouvement du joueur dans update().)

    // Le son ne peut demarrer qu'apres une premiere interaction utilisateur
    // (restriction des navigateurs) : on l'accroche au premier clic OU la premiere touche
    this.input.once('pointerdown', DemarrerSonAmbiance);
    this.input.keyboard.once('keydown', DemarrerSonAmbiance);

    // Arrivee en train (voir init()/CarteSuivante) : declenchee en tout
    // dernier, une fois le reste de la scene entierement pret (calques,
    // joueur, camera, PNJ...), pour que l'animation d'arrivee se joue sur une
    // scene complete plutot qu'a moitie construite. L'animation se joue sur
    // le calque "gare" de la carte d'arrivee (this.PositionGareX/Y) — il
    // suffit donc que la carte ait une gare.
    if (this.ArriveeParTrain && this.PositionGareX !== undefined) {
      this.JouerArriveeEnTrain();
    }
  }

  update(Temps, TempsEcoule) {
    if (this.LargeurMondeCarte) MettreAJourCamera(this);

    // Interaction gare : tant que rien n'a ete declenche (EtatGare
    // "attente"), l'icone suit le joueur et boucle son invite des qu'il entre
    // dans ZoneGare. Sur appui de E, elle joue une fois son animation
    // "E qui eclate" — la sequence de la gare elle-meme ne demarre qu'a la
    // toute fin de cette animation (voir DemarrerSequenceGare plus bas).
    if (this.CalqueGare && this.EtatGare === 'attente') {
      const DansLaZone =
        this.Personnage.x > this.ZoneGare.XMin &&
        this.Personnage.x < this.ZoneGare.XMax &&
        this.Personnage.y > this.ZoneGare.YMin &&
        this.Personnage.y < this.ZoneGare.YMax;

      if (DansLaZone) {
        this.IconeInteraction.setVisible(true);
        this.IconeInteraction.play('iconeAttente', true); // true : ne relance pas si deja en cours

        if (Phaser.Input.Keyboard.JustDown(this.ToucheInteraction)) {
          this.EtatGare = 'enCours'; // verrouille tout de suite, empeche un second appui pendant l'anim
          this.IconeInteraction.play('iconePressee');
          this.IconeInteraction.once('animationcomplete', () => {
            this.IconeInteraction.setVisible(false);
            this.DemarrerSequenceGare();

            
          });
        }
      } else {
        this.IconeInteraction.setVisible(false);
      }
    }

    // Interaction retour : symetrique de la gare, une fois arrive de l'autre
    // cote du tunnel (EtatGare "retourAttente", voir DemarrerSequenceGare).
    // Meme mecanique (icone qui suit, E pour declencher), mais renvoie vers
    // DemarrerRetourGare plutot que DemarrerSequenceGare.
    if (this.CalqueGare && this.EtatGare === 'retourAttente') {
      const DansZoneRetour =
        this.Personnage.x > this.ZoneRetour.XMin &&
        this.Personnage.x < this.ZoneRetour.XMax &&
        this.Personnage.y > this.ZoneRetour.YMin &&
        this.Personnage.y < this.ZoneRetour.YMax;

      if (DansZoneRetour) {
        this.IconeInteractionRetour.setVisible(true);
        this.IconeInteractionRetour.play('iconeAttente', true);

        if (Phaser.Input.Keyboard.JustDown(this.ToucheInteraction)) {
          this.EtatGare = 'enCours';
          this.IconeInteractionRetour.play('iconePressee');
          this.IconeInteractionRetour.once('animationcomplete', () => {
            this.IconeInteractionRetour.setVisible(false);
            this.DemarrerRetourGare();
          });
        }
      } else {
        this.IconeInteractionRetour.setVisible(false);
      }
    }

    // Mise a jour des features de la carte active (tele, textes de zone...).
    MettreAJourFeaturesCarte(this, Temps, TempsEcoule);

    // (l'interaction PNJ est dans la feature dialogue-pnj, mise a jour par
    // MettreAJourFeaturesCarte ci-dessus.)

    // Aucun controle pendant le voyage en train (voir DemarrerSequenceGare)
    // ni pendant un dialogue PNJ (voir OuvrirDialoguePNJ) : le corps physique
    // est desactive, mais sans ce garde-fou les touches tenues enfoncees
    // continueraient quand meme a jouer bruits de pas sur un personnage
    // invisible ou fige. Tout le deplacement est dans MettreAJourDeplacement
    // (src/js/player.js).
    if (this.EtatGare !== 'enCours' && !this.DialogueOuvert) {
      MettreAJourDeplacement(this, Temps, TempsEcoule);
    }
  }

  // Le joueur disparait et devient immobile pour de vrai (corps physique
  // desactive, sinon la gravite continue de s'appliquer meme invisible), la
  // mosaique statique cede la place au sprite anime : clignoteGare (frames 3
  // et 4, deux fois, lentement) -> tremblement -> resteGare (le train
  // demarre, index 5 a la fin). Ecran noir pendant le trajet, puis SOIT
  // reapparition a l'autre bout du tunnel de LA MEME carte (mosaique inversee
  // du calque "derriere", si present — voir this.ArriveeTrainConfiguree), SOIT
  // (carte sans calque "derriere", ex: "debut") un vrai changement de carte
  // si CarteSuivante en configure une (voir this.scene.restart(...) plus bas
  // et JouerArriveeEnTrain, symetrique cote carte d'arrivee).
  DemarrerSequenceGare() {
    this.EtatGare = 'enCours';

    // Position avant le voyage : retenue pour y ramener le joueur au retour
    // (voir DemarrerRetourGare), sans dependre d'une case en dur qui ne
    // correspondrait pas forcement a l'endroit exact ou il a embarque.
    this.PositionAvantVoyage = { x: this.Personnage.x, y: this.Personnage.y };

    this.Personnage.setVisible(false);
    this.Personnage.body.setVelocity(0, 0);
    this.Personnage.body.enable = false;
    // Remise a plat de l'orientation/position du sprite : au cas ou ce
    // serait un 2e aller (apres un retour), il a ete laisse flippe et
    // repositionne a l'arrivee la fois precedente (voir plus bas). Sens
    // normal de la gare de CETTE carte (this.GareFlippee), pas un sens fixe.
    this.SpriteGare.setFlipX(this.GareFlippee);
    this.SpriteGare.setPosition(this.PositionGareX, this.PositionGareY);
    this.SpriteGare.setVisible(true);
    this.SpriteGare.play('clignoteGare');

    this.SpriteGare.once('animationcomplete', () => {
      this.Secouer(this.SpriteGare, 600, 1, () => {
        this.SpriteGare.play('resteGare');
        this.SpriteGare.once('animationcomplete', () => {
          // Le train est parti : ecran noir le temps du trajet.
          this.cameras.main.fadeOut(500, 0, 0, 0);
          this.cameras.main.once('camerafadeoutcomplete', () => {
            // Cette carte n'a pas (encore) de destination configuree ICI
            // (pas de calque "derriere" — voir this.ArriveeTrainConfiguree
            // dans create()) : deux cas possibles — soit une carte suivante
            // existe (voir CarteSuivante) et on change vraiment de carte,
            // soit non et le train ne mene nulle part pour l'instant (le
            // joueur reapparait simplement la ou il etait).
            if (!this.ArriveeTrainConfiguree) {
              const CarteApres = CleCarteSuivante(this.NomCarteActuelle);
              if (CarteApres) {
                // La scene entiere redemarre avec la carte suivante (voir
                // init() et JouerArriveeEnTrain, appele depuis le create()
                // de la nouvelle instance). Ecran deja noir a cet instant
                // (fadeOut ci-dessus) : aucune coupure visible.
                this.scene.restart({ carte: CarteApres, arrivee: true });
                return;
              }
              this.SpriteGare.setFrame(0);
              this.Personnage.setPosition(this.PositionAvantVoyage.x, this.PositionAvantVoyage.y);
              this.Personnage.setVisible(true);
              this.Personnage.body.enable = true;
              this.cameras.main.fadeIn(500, 0, 0, 0);
              this.EtatGare = 'attente';
              return;
            }

            this.SpriteGare.setVisible(false);

            // Teleportation pendant que l'ecran est noir. CameraDoitSauterEnX
            // force MettreAJourCamera a se recadrer instantanement sur la
            // nouvelle position au lieu de mettre plusieurs frames a
            // "rattraper" le suivi doux habituel (voir remise a false plus
            // bas, une fois arrive).
            this.Personnage.setPosition(this.PositionSortieTunnelX, this.PositionSortieTunnelY);
            this.CameraDoitSauterEnX = true;

            this.SpriteGare.setFlipX(!this.GareFlippee);
            this.SpriteGare.setPosition(this.PositionGareInverseeX, this.PositionGareInverseeY);
            this.SpriteGare.setVisible(true);
            this.SpriteGare.play('arriveeGare');

            this.cameras.main.fadeIn(500, 0, 0, 0);

            this.SpriteGare.once('animationcomplete', () => {
              this.CameraDoitSauterEnX = false; // suivi doux normal pour la suite
              // Reste visible, fige sur la frame 0 (train a l'arret) plutot
              // que de disparaitre : la sortie du tunnel n'a pas de mosaique
              // statique equivalente a CalqueGare, donc pas de "dessous" vers
              // lequel revenir a cet endroit.
              this.SpriteGare.setFrame(0);
              this.Personnage.setVisible(true);
              this.Personnage.body.enable = true;
              // "retourAttente" plutot que "termine" : le joueur peut
              // desormais declencher le trajet retour (voir ZoneRetour dans
              // update() et DemarrerRetourGare).
              this.EtatGare = 'retourAttente';
            });
          });
        });
      });
    });
  }

  // Trajet retour : exactement la meme sequence que l'aller
  // (DemarrerSequenceGare), juste inversee. Le sprite est deja sur place a
  // l'arrivee (flippe, laisse par l'aller) : il "repart" donc d'ici
  // (clignote -> tremble -> resteGare, comme au tout premier depart) puis
  // "arrive" a l'origine (arriveeGare, sprite remis a l'endroit) pendant que
  // l'ecran se rallume. Ramene le joueur exactement a sa position d'avant le
  // voyage (voir PositionAvantVoyage dans DemarrerSequenceGare), puis remet
  // EtatGare a "attente" pour permettre un nouvel aller-retour.
  DemarrerRetourGare() {
    this.EtatGare = 'enCours';

    this.Personnage.setVisible(false);
    this.Personnage.body.setVelocity(0, 0);
    this.Personnage.body.enable = false;

    this.SpriteGare.setVisible(true);
    this.SpriteGare.play('clignoteGare');

    this.SpriteGare.once('animationcomplete', () => {
      this.Secouer(this.SpriteGare, 600, 1, () => {
        this.SpriteGare.play('resteGare');
        this.SpriteGare.once('animationcomplete', () => {
          // Le train repart de l'arrivee : ecran noir le temps du trajet.
          this.cameras.main.fadeOut(500, 0, 0, 0);
          this.cameras.main.once('camerafadeoutcomplete', () => {
            this.SpriteGare.setVisible(false);

            this.Personnage.setPosition(this.PositionAvantVoyage.x, this.PositionAvantVoyage.y);
            this.CameraDoitSauterEnX = true; // recadrage instantane, meme principe qu'a l'aller

            this.SpriteGare.setFlipX(this.GareFlippee); // a l'origine, sprite a l'endroit
            this.SpriteGare.setPosition(this.PositionGareX, this.PositionGareY);
            this.SpriteGare.setVisible(true);
            this.SpriteGare.play('arriveeGare');

            this.cameras.main.fadeIn(500, 0, 0, 0);

            this.SpriteGare.once('animationcomplete', () => {
              this.CameraDoitSauterEnX = false; // suivi doux normal pour la suite
              // Reste visible, fige sur la frame 0 (train a l'arret), au lieu
              // de disparaitre — meme logique qu'a l'arrivee (voir plus haut).
              // CalqueGare (la mosaique statique d'origine) reste cachee pour
              // de bon : ce sprite occupe deja exactement le meme endroit.
              this.SpriteGare.setFrame(0);
              this.Personnage.setVisible(true);
              this.Personnage.body.enable = true;
              this.EtatGare = 'attente'; // un nouvel aller est de nouveau possible
            });
          });
        });
      });
    });
  }

  // Arrivee en train sur CETTE carte, depuis la precedente (voir init(),
  // CarteSuivante et le this.scene.restart(...) dans DemarrerSequenceGare).
  // Le train anime (arriveeGare) joue directement sur le bloc "gare" de la
  // carte d'arrivee (this.PositionGareX/Y), dans le meme sens que ce bloc a
  // ete dessine dans Tiled (this.GareFlippee) — "flippe PUIS place" : la
  // position tient compte du sens (voir DecalageCentreGare* dans create()).
  // A la fin, le sprite reste EXACTEMENT la, fige sur la frame 0 : c'est le
  // meme endroit et le meme sens que la gare "au repos" de cette carte, donc
  // rien a rebasculer. Le joueur est deja pose dessus (this.PositionArriveeX/Y,
  // voir create()). Ecran deja noir au demarrage de cette carte (voir
  // DemarrerSequenceGare, fadeOut avant le restart) : fadeOut(0) ici garantit
  // qu'aucune frame ne s'affiche entre-temps meme si ce n'etait pas deja le
  // cas (ex: carte ouverte directement via ?carte=... en test).
  JouerArriveeEnTrain() {
    this.cameras.main.fadeOut(0, 0, 0, 0);
    this.EtatGare = 'enCours';

    this.Personnage.setVisible(false);
    this.Personnage.body.setVelocity(0, 0);
    this.Personnage.body.enable = false;

    this.SpriteGare.setFlipX(this.GareFlippee);
    this.SpriteGare.setPosition(this.PositionGareX, this.PositionGareY);
    this.SpriteGare.setVisible(true);
    this.SpriteGare.play('arriveeGare');

    this.cameras.main.fadeIn(500, 0, 0, 0);

    this.SpriteGare.once('animationcomplete', () => {
      this.SpriteGare.setFrame(0); // reste visible, fige, au meme endroit
      this.Personnage.setVisible(true);
      this.Personnage.body.enable = true;
      // "attente" : cette gare redevient utilisable normalement (le sprite est
      // deja pile a l'endroit et dans le bon sens pour un depart ulterieur).
      this.EtatGare = 'attente';
    });
  }

  // Secoue un objet (petits decalages aleatoires de position) pendant
  // `Duree` ms avec une amplitude de `Intensite` px, puis le remet en place
  // et appelle `ALaFin`.
  Secouer(Cible, Duree, Intensite, ALaFin) {
    const PositionInitialeX = Cible.x;
    const PositionInitialeY = Cible.y;

    const MinuteurTremblement = this.time.addEvent({
      delay: 40,
      loop: true,
      callback: () => {
        Cible.x = PositionInitialeX + Phaser.Math.Between(-Intensite, Intensite);
        Cible.y = PositionInitialeY + Phaser.Math.Between(-Intensite, Intensite);
      },
    });

    this.time.delayedCall(Duree, () => {
      MinuteurTremblement.remove();
      Cible.x = PositionInitialeX;
      Cible.y = PositionInitialeY;
      ALaFin();
    });
  }

  // Camera : MettreAJourCamera(this), dans src/js/camera.js.
  // Herbe / tunnel / textes de zone / tele / dialogue PNJ : features, dans
  // src/js/features/. Config Phaser + demarrage : src/js/index.js.
}
