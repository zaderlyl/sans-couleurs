// niveau4.js — le niveau 4 : la fin (la carte "map-4-fin"), le point de cesure
// entre le college et le lycee.
//
// Une plaine vide. D'un cote, l'epave du train : le train ne repart plus, la
// vie a casse. De l'autre, trois televisions qui montrent un cardiogramme, et
// dont on entend le bip, de plus en plus fort quand on s'approche.
//
// Quand le joueur souris interagit avec une television, le cardiogramme
// s'emballe (il va plus vite, les bips se rapprochent) et un ecran gris plein
// ecran apparait, dechire par des fissures de plus en plus nombreuses ; la
// television disparait. Ca se repete trois fois. A la troisieme, le cardiogramme
// s'arrete sur un ton sourd et continu, l'ecran est tout dechire, puis un fondu
// au noir mene a l'ecran final.
//
// Le joueur clavier est present mais ne peut rien faire : il n'agit pas sur les
// televisions.

import niveau from "./niveau.js";
import { creer_pastilles, mettre_a_jour_pastilles } from "./pastilles.js";
import { afficher_texte, afficher_phrases } from "./ecran_texte.js";
import { montrer_l_ecran_dechire, cacher_l_ecran_dechire, effacer_l_ecran_dechire } from "./ecran_dechire.js";
import { changer_la_musique, demarrer_les_bips, accelerer_les_bips, bip_sourd_continu, arreter_les_bips, jouer_son_dechirure } from "./sons.js";
import { est_un_clic_de_tir } from "./tir.js";
import { pensees } from "./pensees.js";


// --- Reglages ------------------------------------------------------------

var sol_y = 144; // le haut du sol (en pixels du monde)
var position_epave = 150; // x de l'epave du train
var positions_des_teles = [600, 690, 780]; // x des trois televisions

// pour la 1re, 2e, 3e interaction :
var vitesse_du_cardiogramme = [1.8, 3.2, 5]; // la vitesse de l'animation (1 = normale)
var intervalle_des_bips = [650, 400, 250]; // ms entre deux bips (au debut : 1100)
var dechirures_au_total = [6, 16, 40]; // le nombre de dechirures a l'ecran (elles s'accumulent)

var distance_pour_entendre = 260; // px : au-dela, on n'entend pas les bips
var fichier_musique = "assets/audio/ambiance-monde4.mp3";

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
    if (this.textures.exists("img_tele") == true) {
      return; // deja charge (le niveau a deja ete joue)
    }
    // la television : 13 images du cardiogramme ; puis 12 images de la ligne qui devient plate
    this.load.spritesheet("img_tele", "assets/sprites/props/tele.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("img_tele_eteinte", "assets/sprites/props/tele_death.png", { frameWidth: 32, frameHeight: 32 });
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
    this.nombre_d_interactions = 0;
    this.interaction_en_cours = false;
    this.fige_par_le_niveau = false;

    // les bips du cardiogramme : on les entend de plus en plus en s'approchant
    var scene = this;
    demarrer_les_bips(function () {
      return scene.volume_des_bips();
    });
    this.events.once("shutdown", function () {
      arreter_les_bips();
      effacer_l_ecran_dechire();
    });

    this.debuter();
  }

  mettre_a_jour_particularites(temps, delta) {
    mettre_a_jour_pastilles(this);
  }

  // le volume des bips (0 a 1) : plus un joueur est pres d'une television encore la, plus c'est fort
  volume_des_bips() {
    var plus_pres = Infinity;
    for (var i = 0; i < this.teles.length; i++) {
      if (this.teles[i].disparue == true) {
        continue;
      }
      var d = Math.min(Math.abs(this.joueur_souris.x - this.teles[i].x), Math.abs(this.joueur_clavier.x - this.teles[i].x));
      plus_pres = Math.min(plus_pres, d);
    }
    if (plus_pres == Infinity) {
      return 0.6; // plus de television : le ton sourd reste audible
    }
    return Phaser.Math.Clamp(1 - plus_pres / distance_pour_entendre, 0, 1);
  }

  // une television : elle joue le cardiogramme. On voit qu'on peut interagir : au
  // survol, la souris devient une main, la television tremble et l'icone "E"
  // apparait au-dessus (comme pour la gare). Un clic du joueur souris : il y
  // marche, puis interagit.
  creer_une_tele(indice, x) {
    var scene = this;
    var tele = this.add.sprite(x, sol_y, "img_tele", 0);
    tele.setOrigin(0.5, 1);
    tele.setDepth(5);
    tele.play("anim_tele");
    tele.setInteractive({ useHandCursor: true });
    tele.disparue = false;
    tele.souris_dessus = false;
    tele.x_repos = x;

    // l'icone "E" au-dessus de la tele (cachee au depart)
    tele.icone = this.add.sprite(x, sol_y - 44, "img_icone_e", 0);
    tele.icone.setDepth(20);
    tele.icone.setVisible(false);

    tele.on("pointerover", function () {
      tele.souris_dessus = true;
    });
    tele.on("pointerout", function () {
      tele.souris_dessus = false;
      tele.setX(tele.x_repos);
      tele.icone.setVisible(false);
    });
    tele.on("pointerdown", function (pointeur) {
      if (est_un_clic_de_tir(pointeur) == true || scene.est_fige() == true || scene.interaction_en_cours == true || tele.disparue == true) {
        return;
      }
      scene.aller_vers(tele.x - 24, function () {
        scene.interagir_avec_la_tele(indice);
      });
    });
    this.teles.push(tele);
  }

  // chaque image : la tele survolee tremble et montre son icone
  update(temps, delta) {
    super.update(temps, delta);
    for (var i = 0; i < this.teles.length; i++) {
      var tele = this.teles[i];
      if (tele.souris_dessus == true && tele.disparue == false && this.interaction_en_cours == false) {
        tele.setX(tele.x_repos + Phaser.Math.Between(-1, 1));
        tele.icone.setVisible(true);
        tele.icone.anims.play("anim_icone_attente", true);
      }
    }
  }


  // --- Le debut : les pensees (si on arrive en train), la musique ---

  debuter() {
    var scene = this;
    var commencer = function () {
      changer_la_musique(fichier_musique);
    };
    if (this.arrivee_en_train == true) {
      this.fige_par_le_niveau = true;
      afficher_phrases(this, this.pensees || pensees.de_3_vers_4, function () {
        scene.fige_par_le_niveau = false;
        commencer();
      });
    } else {
      commencer();
    }
  }


  // --- Interagir avec une television ---

  // L'icone "E" eclate ; le cardiogramme s'emballe ; l'ecran gris dechire apparait ;
  // la tele disparait (ou, la 3e fois, le cardiogramme s'arrete)
  interagir_avec_la_tele(indice) {
    if (this.interaction_en_cours == true) {
      return;
    }
    this.interaction_en_cours = true;
    this.fige_par_le_niveau = true; // les joueurs ne bougent plus
    var scene = this;
    var tele = this.teles[indice];
    var etape = this.nombre_d_interactions; // 0, 1 ou 2

    // 1) l'icone "E" eclate au-dessus de la tele
    tele.setX(tele.x_repos);
    tele.icone.setVisible(true);
    tele.icone.play("anim_icone_pressee");
    tele.icone.once("animationcomplete", function () {
      tele.icone.setVisible(false);

      // 2) le cardiogramme de toutes les teles s'emballe, les bips se rapprochent
      for (var i = 0; i < scene.teles.length; i++) {
        if (scene.teles[i].disparue == false) {
          scene.teles[i].anims.timeScale = vitesse_du_cardiogramme[etape];
        }
      }
      accelerer_les_bips(intervalle_des_bips[etape]);

      // 3) l'ecran gris, de plus en plus dechire
      montrer_l_ecran_dechire(scene, dechirures_au_total[etape], function () {
        jouer_son_dechirure();
        scene.apres_les_dechirures(indice, etape);
      });
    });
  }

  apres_les_dechirures(indice, etape) {
    var scene = this;
    var tele = this.teles[indice];
    this.nombre_d_interactions = this.nombre_d_interactions + 1;

    // la 3e fois : le cardiogramme s'arrete, un ton sourd et continu ; l'ecran reste dechire
    if (etape == 2) {
      for (var i = 0; i < this.teles.length; i++) {
        if (this.teles[i].disparue == false) {
          this.teles[i].anims.timeScale = 1;
          this.teles[i].play("anim_tele_eteinte");
        }
      }
      bip_sourd_continu();
      this.time.delayedCall(3500, function () {
        scene.finir();
      }, null, this);
      return;
    }

    // la 1re et la 2e fois : le gris s'efface, et la tele disparait
    this.time.delayedCall(900, function () {
      cacher_l_ecran_dechire(scene, function () {
        scene.tweens.add({
          targets: tele,
          alpha: 0,
          duration: 1600,
          onComplete: function () {
            tele.disparue = true;
            tele.destroy();
            tele.icone.destroy();
            scene.interaction_en_cours = false;
            scene.fige_par_le_niveau = false; // on peut interagir avec la suivante
          }
        });
      });
    }, null, this);
  }


  // --- La fin ---

  // un fondu au noir, puis l'ecran final
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
      arreter_les_bips(); // le ton sourd continue jusqu'au clic
      effacer_l_ecran_dechire();
      scene.scene.start("accueil");
    });
  }
}
