// niveau4.js — le niveau 4 : la fin (la carte "map-4-fin"), le point de cesure
// entre le college et le lycee.
//
// Une VRAIE plaine, immense et vide. D'un cote, l'epave du train (posee dans la
// carte Tiled) : le train ne repart plus, la vie a casse. Loin de l'autre, trois televisions tres espacees,
// qui montrent un cardiogramme et dont on entend le bip, de plus en plus fort
// quand on s'approche.
//
// Chaque television reagit a 4 interactions (un clic du joueur souris, ou la
// touche E du joueur clavier a cote d'elle) :
//   1) le cardiogramme va doucement ;  2) moyen ;  3) rapide ;
//   4) la ligne devient plate, avec un ton qui CONTINUE (l'animation et le son
//      ne s'arretent plus). La television ne disparait pas.
// Quand les trois sont plates, un fondu au noir mene a l'ecran final.

import niveau from "./niveau.js";
import { creer_pastilles, mettre_a_jour_pastilles } from "./pastilles.js";
import { afficher_texte, afficher_phrases } from "./ecran_texte.js";
import { changer_la_musique, jouer_un_bip, creer_ton_continu } from "./sons.js";
import { est_un_clic_de_tir } from "./tir.js";
import { pensees } from "./pensees.js";


// --- Reglages ------------------------------------------------------------

var sol_y = 144; // le haut du sol (en pixels du monde)
var positions_des_teles = [900, 1450, 2000]; // x des trois televisions (tres espacees)

// la vitesse du cardiogramme et le temps entre deux bips, selon le nombre
// d'interactions deja faites (0 = au repos, 1 = doucement, 2 = moyen, 3 = rapide)
var vitesse_du_cardiogramme = [0.5, 1, 2, 3.5];
var intervalle_des_bips = [1500, 1000, 600, 320]; // ms

var distance_pour_entendre = 320; // px : au-dela, on n'entend pas les bips
var distance_pour_interagir = 28; // px : le joueur clavier doit etre a cette distance d'une television
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
        repeat: -1 // la ligne plate tourne en boucle, sans fin
      });
    }

    // les trois televisions, loin de l'autre cote
    this.teles = [];
    for (var i = 0; i < positions_des_teles.length; i++) {
      this.creer_une_tele(i, positions_des_teles[i]);
    }
    this.interaction_en_cours = false; // le "E" d'une television est en train d'eclater
    this.teles_plates = 0; // combien de televisions sont arretees

    // les tons continus des televisions arretees : on les coupe a la fin du niveau
    var scene = this;
    this.events.once("shutdown", function () {
      for (var j = 0; j < scene.teles.length; j++) {
        if (scene.teles[j].ton != null) {
          scene.teles[j].ton.arreter();
        }
      }
    });

    this.debuter();
  }

  mettre_a_jour_particularites(temps, delta) {
    mettre_a_jour_pastilles(this);
    this.mettre_a_jour_les_teles(temps);
  }

  // une television : elle joue le cardiogramme, doucement. On voit qu'on peut
  // interagir : au survol, la souris devient une main, la television tremble et
  // l'icone "E" apparait au-dessus (comme pour la gare).
  creer_une_tele(indice, x) {
    var scene = this;
    var tele = this.add.sprite(x, sol_y, "img_tele", 0);
    tele.setOrigin(0.5, 1);
    tele.setDepth(5);
    tele.play("anim_tele");
    tele.anims.timeScale = vitesse_du_cardiogramme[0];
    tele.setInteractive({ useHandCursor: true });
    tele.clics = 0; // 0, 1, 2, 3 : le cardiogramme ; 4 : la ligne est plate
    tele.plate = false;
    tele.souris_dessus = false;
    tele.x_repos = x;
    tele.prochain_bip = 0; // le moment du prochain bip (temps du jeu)
    tele.ton = null; // le ton continu, une fois la ligne plate

    // l'icone "E" au-dessus de la tele (cachee au depart)
    tele.icone = this.add.sprite(x, sol_y - 44, "img_icone_e", 0);
    tele.icone.setDepth(20);
    tele.icone.setVisible(false);

    tele.on("pointerover", function () {
      tele.souris_dessus = true;
    });
    tele.on("pointerout", function () {
      tele.souris_dessus = false;
    });
    // le joueur souris clique : il marche jusqu'a la tele, puis interagit
    tele.on("pointerdown", function (pointeur) {
      if (est_un_clic_de_tir(pointeur) == true || scene.est_fige() == true || scene.interaction_en_cours == true || tele.plate == true) {
        return;
      }
      scene.aller_vers(tele.x - 24, function () {
        scene.interagir_avec_la_tele(indice);
      });
    });
    this.teles.push(tele);
  }

  // chaque image : les bips de chaque tele (plus forts quand on s'approche), le
  // survol, et la touche E du joueur clavier
  mettre_a_jour_les_teles(temps) {
    for (var i = 0; i < this.teles.length; i++) {
      var tele = this.teles[i];
      var d_souris = Math.abs(this.joueur_souris.x - tele.x);
      var d_clavier = Math.abs(this.joueur_clavier.x - tele.x);

      // le son de cette tele : plus fort si on est pres. Un bip toutes les
      // `intervalle` ms ; une fois la ligne plate, un ton continu.
      var volume = Phaser.Math.Clamp(1 - Math.min(d_souris, d_clavier) / distance_pour_entendre, 0, 1);
      if (tele.plate == false && temps >= tele.prochain_bip) {
        jouer_un_bip(volume);
        tele.prochain_bip = temps + intervalle_des_bips[tele.clics];
      }
      if (tele.ton != null) {
        tele.ton.regler(volume);
      }

      // le survol (souris) ou la proximite (clavier) : la tele tremble, l'icone "E" apparait
      var pret = tele.plate == false && this.interaction_en_cours == false && this.est_fige() == false;
      var clavier_pres = d_clavier < distance_pour_interagir;
      if (pret == true && (tele.souris_dessus == true || clavier_pres == true)) {
        tele.setX(tele.x_repos + Phaser.Math.Between(-1, 1));
        tele.icone.setVisible(true);
        tele.icone.anims.play("anim_icone_attente", true);
      } else if (this.interaction_en_cours == false) {
        tele.setX(tele.x_repos);
        tele.icone.setVisible(false);
      }

      // le joueur clavier, a cote de la tele, appuie sur E
      if (pret == true && clavier_pres == true && Phaser.Input.Keyboard.JustDown(this.touche_e) == true) {
        this.interagir_avec_la_tele(i);
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

  // L'icone "E" eclate, puis le cardiogramme de CETTE tele change : doucement,
  // moyen, rapide, et a la 4e fois un long bip (la ligne devient plate).
  interagir_avec_la_tele(indice) {
    var tele = this.teles[indice];
    if (this.interaction_en_cours == true || tele.plate == true) {
      return;
    }
    this.interaction_en_cours = true;
    var scene = this;
    tele.setX(tele.x_repos);
    tele.icone.setVisible(true);
    tele.icone.play("anim_icone_pressee");
    tele.icone.once("animationcomplete", function () {
      tele.icone.setVisible(false);
      scene.interaction_en_cours = false;
      tele.clics = tele.clics + 1;

      if (tele.clics < 4) {
        // plus vite a chaque fois
        tele.anims.timeScale = vitesse_du_cardiogramme[tele.clics];
        tele.prochain_bip = 0; // un bip tout de suite, au nouveau rythme
      } else {
        scene.arreter_la_tele(tele);
      }
    });
  }

  // la ligne devient plate, avec un ton qui continue ; la tele reste la
  arreter_la_tele(tele) {
    var scene = this;
    tele.plate = true;
    tele.anims.timeScale = 1;
    tele.play("anim_tele_eteinte"); // en boucle
    tele.ton = creer_ton_continu();

    this.teles_plates = this.teles_plates + 1;
    if (this.teles_plates >= this.teles.length) {
      // les trois sont arretees : un moment de silence, puis le noir
      this.fige_par_le_niveau = true;
      this.time.delayedCall(3500, function () {
        scene.finir();
      }, null, this);
    }
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
      scene.scene.start("accueil");
    });
  }
}
