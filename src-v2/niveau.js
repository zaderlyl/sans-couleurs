// niveau.js — ce que TOUS les niveaux ont en commun.
//
// Un niveau (niveau1.js, niveau3.js...) est une classe qui HERITE de celle-ci :
//
//   export default class niveau1 extends niveau {
//     constructor() { super("niveau1", "map-1-debut"); }  // la cle de la scene, la carte Tiled
//     creer_particularites() { ... }                      // ce qui n'existe que dans ce niveau
//     mettre_a_jour_particularites(temps, delta) { ... }  // idem, a chaque image
//   }
//
// Ici, on trouve : la carte, les deux joueurs (souris et clavier), leurs
// deplacements, les cameras (ecran separe) et le tir. Les deux methodes
// creer_particularites() et mettre_a_jour_particularites() sont VIDES ici : un
// niveau les remplace par les siennes (sinon elles ne font rien).

import { creer_ecran_separe, mettre_a_jour_ecran_separe, point_monde } from "./ecran_separe.js";
import { creer_tir, mettre_a_jour_tir, est_un_clic_de_tir, tirer_a_la_souris } from "./tir.js";

export default class niveau extends Phaser.Scene {
  // cle = l'identifiant de la scene ; nom_carte = le fichier Tiled (sans .json)
  constructor(cle, nom_carte) {
    super({
      key: cle
    });
    this.nom_carte = nom_carte;
  }

  // Appelee par Phaser avant preload(), a chaque fois que la scene demarre.
  // `donnees` = ce qu'on a passe a this.scene.start("niveauX", donnees) : ici,
  // si on arrive en train ({ arrivee_en_train: true }), et avec l'ecran de
  // texte du voyage ({ avec_transition: true }). Voir gare.js.
  init(donnees) {
    this.arrivee_en_train = donnees.arrivee_en_train == true;
    this.avec_transition = donnees.avec_transition == true;
    // Piege de Phaser : si on demarre une scene SANS donnees, il lui redonne
    // celles du demarrage precedent. On les efface ici, pour qu'une scene
    // demarree sans donnees (depuis l'accueil, un passage...) ne rejoue pas
    // l'arrivee en train d'une visite d'avant.
    this.sys.settings.data = {};
  }

  preload() {
    // l'image des tuiles, la carte Tiled (au format JSON) et les personnages
    this.load.image("img_tuiles", "assets/tilesets/Tileset.png");
    this.load.tilemapTiledJSON(this.nom_carte, "assets/maps/" + this.nom_carte + ".json");
    this.load.spritesheet("img_perso", "assets/sprites/characters/player.png", {
      frameWidth: 16,
      frameHeight: 16
    });
    // le meme personnage, avec les couleurs inversees : c'est le joueur clavier
    this.load.spritesheet("img_perso2", "assets/sprites/characters/player_inverse.png", {
      frameWidth: 16,
      frameHeight: 16
    });
    // la goutte du tir, et les taches grises a toucher
    this.load.image("img_goutte", "assets/sprites/props/goutte.png");
    this.load.image("img_cible", "assets/sprites/props/cible.png");
    // l'icone "E" : 11 images de 16 x 16 (voir portails.js et pnj.js)
    this.load.spritesheet("img_icone_e", "assets/ui/E_animated.png", {
      frameWidth: 16,
      frameHeight: 16
    });
    // la gare et son train : 64 images de 256 x 256 (voir gare.js)
    this.load.spritesheet("img_gare", "assets/sprites/environment/gare.png", {
      frameWidth: 256,
      frameHeight: 256
    });
    // les personnages non joueurs (feuille de 4 enfants, voir pnj.js)
    this.load.spritesheet("img_pnj", "assets/sprites/characters/other_child.png", {
      frameWidth: 16,
      frameHeight: 16
    });
  }

  create() {
    // --- la carte ---
    this.carte = this.make.tilemap({ key: this.nom_carte });
    // "Tileset" = le nom du jeu de tuiles dans Tiled, "img_tuiles" = l'image chargee
    var tuiles = this.carte.addTilesetImage("Tileset", "img_tuiles");

    // les calques, du plus loin au plus proche (le dernier cree est dessus)
    this.calque_bg = this.carte.createLayer("bg", tuiles, 0, 0);
    this.calque_bg2 = this.carte.createLayer("bg2", tuiles, 0, 0);
    this.calque_sol = this.carte.createLayer("sol", tuiles, 0, 0);
    // toute tuile non vide du calque "sol" est solide
    this.calque_sol.setCollisionByExclusion([-1]);

    // --- le personnage (joueur souris) ---
    // il apparait au point "spawn" pose dans Tiled
    var depart = this.carte.findObject("Calque d'Objets 1", function (objet) {
      return objet.name === "spawn";
    });
    this.joueur_souris = this.physics.add.sprite(depart.x, depart.y, "img_perso");
    this.physics.add.collider(this.joueur_souris, this.calque_sol);

    // le monde fait la taille de la carte, le personnage ne peut pas en sortir
    this.physics.world.setBounds(0, 0, this.carte.widthInPixels, this.carte.heightInPixels);
    this.joueur_souris.setCollideWorldBounds(true);

    // --- le joueur clavier (2e personnage) ---
    // meme chose que le joueur souris, mais un peu a droite, avec l'image
    // inversee. Les deux joueurs se traversent : on ne declare aucune
    // collision entre eux.
    this.joueur_clavier = this.physics.add.sprite(depart.x + 24, depart.y, "img_perso2");
    this.physics.add.collider(this.joueur_clavier, this.calque_sol);
    this.joueur_clavier.setCollideWorldBounds(true);

    // les fleches du clavier, et la touche E (pour interagir)
    this.clavier = this.input.keyboard.createCursorKeys();
    this.touche_e = this.input.keyboard.addKey("E");

    // --- l'animation de marche (images 4 et 5 de la feuille du personnage) ---
    // les animations sont partagees par tout le jeu : on ne la cree qu'une fois
    if (this.anims.exists("anim_marche") == false) {
      this.anims.create({
        key: "anim_marche",
        frames: this.anims.generateFrameNumbers("img_perso", { start: 4, end: 5 }),
        frameRate: 8,
        repeat: -1
      });
    }
    // la meme animation pour le joueur clavier (avec son image inversee)
    if (this.anims.exists("anim_marche2") == false) {
      this.anims.create({
        key: "anim_marche2",
        frames: this.anims.generateFrameNumbers("img_perso2", { start: 4, end: 5 }),
        frameRate: 8,
        repeat: -1
      });
    }

    // --- les animations de l'icone "E" (communes a tout ce qui est interactif) ---
    // l'invite (images 0 a 2, en boucle), puis le E qui eclate (images 3 a 10, une fois)
    if (this.anims.exists("anim_icone_attente") == false) {
      this.anims.create({
        key: "anim_icone_attente",
        frames: this.anims.generateFrameNumbers("img_icone_e", { start: 0, end: 2 }),
        frameRate: 4,
        repeat: -1
      });
      this.anims.create({
        key: "anim_icone_pressee",
        frames: this.anims.generateFrameNumbers("img_icone_e", { start: 3, end: 10 }),
        frameRate: 14,
        repeat: 0
      });
    }

    // --- les cameras ---
    // pixel art de 16 pixels : on zoome x5, sinon tout est minuscule
    this.cameras.main.setZoom(5);
    // une 2e camera et la separation de l'ecran (voir ecran_separe.js)
    creer_ecran_separe(this);

    // --- le tir ---
    creer_tir(this);

    // --- ce qui est propre a ce niveau (portails, cibles, ...) ---
    this.creer_particularites();

    // --- le clic de souris ---
    // la ou le joueur souris doit aller (null = il n'y va nulle part), et ce
    // qu'il fait en arrivant (une fonction, ou null)
    this.destination_x = null;
    this.apres_arrivee = null;
    this.input.on("pointerdown", this.cliquer, this);
  }

  update(temps, delta) {
    // --- un dialogue est ouvert, ou le train est en route : les joueurs sont figes ---
    // (le reste de update continue : cameras, ce qui est propre au niveau...)
    if (this.est_fige() == true) {
      this.destination_x = null;
      this.apres_arrivee = null;
      this.joueur_souris.setVelocityX(0);
      this.joueur_souris.anims.stop();
      this.joueur_souris.setFrame(3);
      this.joueur_clavier.setVelocityX(0);
      this.joueur_clavier.anims.stop();
      this.joueur_clavier.setFrame(3);
    }

    // --- le joueur souris marche vers la destination ---
    if (this.destination_x !== null) {
      // ecart > 0 : la destination est a droite ; ecart < 0 : a gauche
      var ecart = this.destination_x - this.joueur_souris.x;

      // bloque par un mur dans le sens ou il marche ?
      var corps = this.joueur_souris.body;
      var bloque = (ecart > 0 && corps.blocked.right) || (ecart < 0 && corps.blocked.left);

      if (Math.abs(ecart) < 4 || bloque == true) {
        // arrive (a 4 pixels pres) ou bloque : il s'arrete, et fait ce qui etait
        // prevu en arrivant (par exemple prendre un portail)
        var action = this.apres_arrivee;
        this.destination_x = null;
        this.apres_arrivee = null;
        if (action !== null) {
          action.call(this);
        }
      } else if (ecart < 0) {
        this.joueur_souris.setVelocityX(-70);
        this.joueur_souris.setFlipX(true); // regarde a gauche
        this.joueur_souris.anims.play("anim_marche", true);
      } else {
        this.joueur_souris.setVelocityX(70);
        this.joueur_souris.setFlipX(false); // regarde a droite
        this.joueur_souris.anims.play("anim_marche", true);
      }
    }

    // pas de destination : le joueur souris est immobile
    if (this.destination_x === null) {
      this.joueur_souris.setVelocityX(0);
      this.joueur_souris.anims.stop();
      this.joueur_souris.setFrame(3); // l'image "debout"
    }

    // --- le joueur clavier : les fleches gauche et droite ---
    if (this.est_fige() == true) {
      // fige (voir plus haut)
    } else if (this.clavier.left.isDown) {
      this.joueur_clavier.setVelocityX(-70);
      this.joueur_clavier.setFlipX(true); // regarde a gauche
      this.joueur_clavier.anims.play("anim_marche2", true);
    } else if (this.clavier.right.isDown) {
      this.joueur_clavier.setVelocityX(70);
      this.joueur_clavier.setFlipX(false); // regarde a droite
      this.joueur_clavier.anims.play("anim_marche2", true);
    } else {
      this.joueur_clavier.setVelocityX(0);
      this.joueur_clavier.anims.stop();
      this.joueur_clavier.setFrame(3); // l'image "debout"
    }

    // --- les cameras ---
    // un seul ecran quand les joueurs sont proches, deux quand ils s'eloignent :
    // le calcul est dans ecran_separe.js
    mettre_a_jour_ecran_separe(this, delta);

    // --- le tir ---
    mettre_a_jour_tir(this);

    // --- ce qui est propre a ce niveau ---
    this.mettre_a_jour_particularites(temps, delta);
  }

  // Ces deux methodes sont vides : un niveau les remplace par les siennes.
  creer_particularites() {}
  mettre_a_jour_particularites(temps, delta) {}

  // true quand les joueurs ne doivent plus bouger ni tirer : un dialogue est
  // ouvert (voir dialogue.js) ou le train est en route (voir gare.js)
  est_fige() {
    return this.dialogue_ouvert == true || this.etat_gare == "enCours";
  }

  // Le joueur souris va jusqu'a l'abscisse x, puis fait `action` (une fonction,
  // ou null) en arrivant. Sert aux clics sur un portail, une porte...
  aller_vers(x, action) {
    this.destination_x = x;
    this.apres_arrivee = action;
  }

  // appelee a chaque clic de souris ; `sous_la_souris` = la liste des objets
  // cliquables (setInteractive) qui sont sous la souris
  cliquer(pointeur, sous_la_souris) {
    // fige (dialogue, voyage en train) : la souris ne sert pas a marcher ni a tirer
    if (this.est_fige() == true) {
      return;
    }

    // Ctrl (ou Cmd) maintenu : c'est un clic de TIR, pas un clic pour marcher
    if (est_un_clic_de_tir(pointeur) == true) {
      tirer_a_la_souris(this, pointeur.x, pointeur.y);
      return;
    }

    // clic sur un objet cliquable (un portail...) : c'est cet objet qui s'en
    // occupe, ce n'est pas un simple deplacement
    if (sous_la_souris.length > 0) {
      return;
    }

    // pointeur.x / pointeur.y : l'endroit de l'ECRAN ou on a clique. On le
    // convertit en endroit du MONDE (la camera est zoomee et decalee, et
    // l'ecran peut etre separe en deux cameras : voir ecran_separe.js).
    var clic = point_monde(this, pointeur.x, pointeur.y);
    this.aller_vers(clic.x, null);

    // un petit anneau montre ou on a clique : il grossit et s'efface
    var anneau = this.add.circle(clic.x, clic.y, 3);
    anneau.setStrokeStyle(1, 0xffffff);
    this.tweens.add({
      targets: anneau,
      scale: 2.2,
      alpha: 0,
      duration: 450,
      onComplete: function () {
        anneau.destroy();
      }
    });
  }
}
