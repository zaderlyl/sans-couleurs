// niveau4.js — le niveau 4 : la fin (la carte "map-4-fin"), le point de cesure
// entre le college et le lycee.
//
// Une plaine vide. D'un cote, l'epave du train : le train ne repart plus, la
// vie a casse. De l'autre, trois televisions qui montrent un cardiogramme. Quand
// le joueur souris en eteint une, la ligne devient plate, puis un coeur en
// pixels apparait au-dessus et se brise : un peu la premiere fois, davantage la
// deuxieme, completement la troisieme. On ne montre jamais plus que ca.
//
// Au debut, un ecran d'avertissement (avec le 3114) : un clic pour continuer,
// Echap pour passer le niveau. A la fin, un ecran noir, puis l'accueil.
//
// Le joueur clavier est present mais ne peut rien faire : il n'agit pas sur les
// televisions.

import niveau from "./niveau.js";
import { creer_pastilles, mettre_a_jour_pastilles } from "./pastilles.js";
import { afficher_texte, afficher_phrases } from "./ecran_texte.js";
import { changer_la_musique, jouer_son_bip_plat, jouer_son_coeur_brise } from "./sons.js";
import { est_un_clic_de_tir } from "./tir.js";
import { pensees } from "./pensees.js";


// --- Reglages ------------------------------------------------------------

var sol_y = 144; // le haut du sol (en pixels du monde)
var position_epave = 150; // x de l'epave du train
var positions_des_teles = [600, 690, 780]; // x des trois televisions

// pour la tele n° 0, 1, 2 : l'image du coeur au debut, et apres qu'il s'est brise
var coeur_avant = [0, 1, 2];
var coeur_apres = [1, 2, 3]; // (la 3e tele va jusqu'a l'image 4 : tout est tombe)

var fichier_musique = "assets/audio/ambiance-monde4.mp3";

var texte_avertissement = "Ce niveau parle d'un moment très sombre de la vie du personnage : le mal-être, et l'envie d'en finir.\n\n" +
  "Si tu traverses quelque chose de difficile, tu n'es pas seul. En France, le 3114 (numéro national de prévention du suicide) répond gratuitement, 24 h sur 24.\n\n" +
  "Clique pour continuer.\nÉchap : passer ce niveau.";

var texte_de_fin = "Fin du niveau.\n\n" +
  "Si tu te reconnais dans cette histoire, parles-en à quelqu'un. 3114 : gratuit, 24 h sur 24.\n\n" +
  "Clique pour revenir à l'accueil.";


export default class niveau4 extends niveau {
  constructor() {
    // la cle de la scene, et le nom de la carte Tiled
    super("niveau4", "map-4-fin");
  }

  preload() {
    super.preload(); // la carte, les tuiles, les personnages...
    // la television : 13 images du cardiogramme ; puis 12 images de la ligne qui devient plate
    this.load.spritesheet("img_tele", "assets/sprites/props/tele.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("img_tele_eteinte", "assets/sprites/props/tele_death.png", { frameWidth: 32, frameHeight: 32 });
    // le coeur : 5 images (entier, une fissure, deux fissures, en deux, tombe en morceaux)
    this.load.spritesheet("img_coeur", "assets/sprites/props/coeur.png", { frameWidth: 28, frameHeight: 24 });
    this.load.image("img_epave", "assets/sprites/environment/epave_train.png");
  }

  creer_particularites() {
    this.tir_desactive = true; // pas de tir dans ce niveau
    creer_pastilles(this);

    // les animations des televisions
    if (this.anims.exists("anim_tele") == false) {
      this.anims.create({
        key: "anim_tele",
        frames: this.anims.generateFrameNumbers("img_tele", { start: 0, end: 12 }),
        frameRate: 7,
        repeat: -1
      });
      this.anims.create({
        key: "anim_tele_eteinte",
        frames: this.anims.generateFrameNumbers("img_tele_eteinte", { start: 0, end: 11 }),
        frameRate: 8,
        repeat: 0
      });
    }

    // l'epave du train, d'un cote
    var epave = this.add.image(position_epave, sol_y, "img_epave");
    epave.setOrigin(0.5, 1);
    epave.setDepth(5);

    // les trois televisions, de l'autre
    this.teles = [];
    for (var i = 0; i < positions_des_teles.length; i++) {
      this.creer_une_tele(i, positions_des_teles[i]);
    }
    this.nombre_de_teles_eteintes = 0;
    this.tele_en_cours = false; // une tele est en train de s'eteindre (animation)

    // l'ecran d'avertissement, puis le niveau
    this.fige_par_le_niveau = true;
    this.debuter();
  }

  mettre_a_jour_particularites(temps, delta) {
    mettre_a_jour_pastilles(this);
  }

  // une television : elle joue le cardiogramme ; un clic du joueur souris l'eteint
  creer_une_tele(indice, x) {
    var scene = this;
    var tele = this.add.sprite(x, sol_y, "img_tele", 0);
    tele.setOrigin(0.5, 1);
    tele.setDepth(5);
    tele.play("anim_tele");
    tele.setInteractive({ useHandCursor: true });
    tele.eteinte = false;

    tele.on("pointerdown", function (pointeur) {
      if (est_un_clic_de_tir(pointeur) == true || scene.est_fige() == true || tele.eteinte == true) {
        return;
      }
      // le joueur souris marche jusqu'a la tele, puis l'eteint
      scene.aller_vers(tele.x - 24, function () {
        scene.eteindre_la_tele(indice);
      });
    });
    this.teles.push(tele);
  }


  // --- Le debut : les pensees (si on arrive en train), l'avertissement, la musique ---

  debuter() {
    var scene = this;
    var apres_les_pensees = function () {
      scene.montrer_l_avertissement();
    };
    if (this.arrivee_en_train == true) {
      afficher_phrases(this, this.pensees || pensees.de_3_vers_4, apres_les_pensees);
    } else {
      apres_les_pensees();
    }
  }

  montrer_l_avertissement() {
    var scene = this;
    afficher_texte(this, texte_avertissement, function () {
      scene.fige_par_le_niveau = false; // le niveau commence
      changer_la_musique(fichier_musique);
    });
    // Echap : on passe le niveau, directement a l'ecran final
    this.input.keyboard.once("keydown-ESC", function () {
      scene.montrer_la_fin();
    });
  }


  // --- Eteindre une television, puis le coeur qui se brise ---

  eteindre_la_tele(indice) {
    if (this.tele_en_cours == true) {
      return;
    }
    this.tele_en_cours = true;
    this.fige_par_le_niveau = true; // les joueurs ne bougent plus pendant l'animation
    var scene = this;
    var tele = this.teles[indice];
    tele.eteinte = true;

    // la ligne du cardiogramme devient plate (12 images), avec un long "biiip"
    tele.setTexture("img_tele_eteinte", 0);
    tele.play("anim_tele_eteinte");
    jouer_son_bip_plat();
    tele.once("animationcomplete", function () {
      scene.casser_le_coeur(indice);
    });
  }

  // un coeur apparait au-dessus de la tele, tremble, puis se brise
  casser_le_coeur(indice) {
    var scene = this;
    var tele = this.teles[indice];
    var coeur = this.add.sprite(tele.x, sol_y - 56, "img_coeur", coeur_avant[indice]);
    coeur.setDepth(10);
    coeur.setAlpha(0);
    this.tweens.add({ targets: coeur, alpha: 1, duration: 700 });

    // il tremble, puis se brise
    this.time.delayedCall(900, function () {
      scene.tweens.add({ targets: coeur, x: coeur.x + 1, duration: 60, yoyo: true, repeat: 7 });
    }, null, this);
    this.time.delayedCall(1600, function () {
      jouer_son_coeur_brise();
      coeur.setFrame(coeur_apres[indice]);
      scene.cameras.main.shake(250, 0.002);
    }, null, this);

    // la 3e tele : le coeur est completement casse, ses morceaux tombent
    var duree = 3000;
    if (indice == 2) {
      this.time.delayedCall(2500, function () {
        jouer_son_coeur_brise();
        coeur.setFrame(4);
        scene.tweens.add({ targets: coeur, y: coeur.y + 8, duration: 700, ease: "Quad.easeIn" });
      }, null, this);
      duree = 4200;
    }

    this.time.delayedCall(duree, function () {
      scene.tele_en_cours = false;
      scene.nombre_de_teles_eteintes = scene.nombre_de_teles_eteintes + 1;
      if (scene.nombre_de_teles_eteintes >= scene.teles.length) {
        scene.finir();
      } else {
        scene.fige_par_le_niveau = false; // on peut eteindre la suivante
      }
    }, null, this);
  }

  // les trois televisions sont eteintes : un fondu au noir, puis l'ecran final
  finir() {
    var scene = this;
    this.cameras.main.fadeOut(2000, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", function () {
      scene.cameras.main.resetFX();
      scene.montrer_la_fin();
    });
  }

  montrer_la_fin() {
    var scene = this;
    this.fige_par_le_niveau = true;
    afficher_texte(this, texte_de_fin, function () {
      scene.scene.start("accueil");
    });
  }
}
