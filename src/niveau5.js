// niveau5.js — le niveau 5 : le lycee (la carte "map-5-lycee").
//
// Une suite de PIECES (une salle de cours, une chambre, la rue, un tribunal, la
// chambre la nuit), separees par de grands passages tout BLANCS (des tuiles
// blanches, rien d'autre). Dans chaque piece, une scene de violence. On ne la
// montre jamais : on la fait RESSENTIR. Une ombre arrive, on entend le choc, le
// personnage tombe, les oreilles sifflent, la piece garde la trace (une chaise
// renversee, une lampe cassee, une vitre fendue). Le joueur ne subit rien de
// plus : au bout de quelques secondes, il se releve.
//
// La PRESSION monte a chaque coup (voir pression.js : voile, musique grave, lenteur).
// Le joueur clavier (J2) est une part du personnage lui-meme, un allie interieur :
// il a deux voix, l'une RATIONNELLE, l'autre EMOTIONNELLE, qui se contredisent.
// Quand les deux joueurs restent l'un a cote de l'autre, la pression redescend,
// mais jamais tout a fait : il reste des sequelles.
//
// Le tribunal : des accusations fausses s'accrochent au personnage ; puis
// « Classe sans suite. » La derniere piece, la nuit : les cauchemars. Les coups
// reviennent en ombres silencieuses ; il faut rester ensemble pour tenir.

import niveau from "./niveau.js";
import { creer_pastilles, mettre_a_jour_pastilles } from "./pastilles.js";
import { creer_pression, mettre_a_jour_pression, ajouter_pression } from "./pression.js";
import { afficher_texte, afficher_phrases } from "./ecran_texte.js";
import { jouer_son_coup, jouer_son_sifflement, jouer_son_verre, jouer_son_tampon } from "./sons.js";
import { style_texte, style_mot } from "./styles.js";
import { pensees } from "./pensees.js";


// --- Reglages ------------------------------------------------------------

var sol_y = 144; // le haut du sol

// ou chaque scene se declenche (colonne que le joueur souris depasse)
var colonnes_des_scenes = [22, 57, 93, 138, 178];

// les numeros de tuiles du jeu de tuiles du lycee (voir Tileset-lycee.png)
var tuile_chaise_renversee = [465, 466];
var tuile_lampe_cassee = 479;
var tuile_miroir_fele = [481, 497];
var tuile_vitre_cassee = [523, 524, 539, 540];

// les voix de J2 : { qui: "rationnelle" ou "emotionnelle", texte }, apres chaque scene
var voix = [
  [{ qui: "emotionnelle", texte: "Ce n'est rien. Elle était en colère." }, { qui: "rationnelle", texte: "Non. Ce n'est pas rien." }],
  [{ qui: "emotionnelle", texte: "Je l'aime encore." }, { qui: "rationnelle", texte: "Ça recommence." }],
  [{ qui: "emotionnelle", texte: "Elle va s'excuser. Comme d'habitude." }, { qui: "rationnelle", texte: "Tu peux partir." }],
  [{ qui: "rationnelle", texte: "Tu n'as rien fait." }, { qui: "emotionnelle", texte: "Pourquoi on ne me croit pas ?" }],
  [{ qui: "emotionnelle", texte: "J'ai peur de m'endormir." }, { qui: "rationnelle", texte: "Je suis là." }]
];

var accusations = ["Il ment.", "Il est dangereux.", "Il l'a menacée.", "Il ne dit rien."];

var delai_entre_cauchemars = 7000; // ms (la nuit)
var duree_pour_tenir = 6000; // ms a rester l'un a cote de l'autre pour finir la nuit

var texte_de_fin = "Classé sans suite. Mais les nuits, elles, continuent.\n\n" +
  "Si tu as vécu de la violence dans une relation, tu n'es pas seul. Le 116 006 (aide aux victimes) et le 3114 répondent gratuitement.\n\n" +
  "Clique pour revenir à l'accueil.";


export default class niveau5 extends niveau {
  constructor() {
    // la cle de la scene, et le nom de la carte Tiled
    super("niveau5", "map-5-lycee");
  }

  preload() {
    super.preload(); // la carte, les tuiles, les personnages...
    if (this.textures.exists("img_ombre") == false) {
      this.load.image("img_ombre", "assets/sprites/characters/ombre.png");
    }
  }

  creer_particularites() {
    this.tir_desactive = true; // pas de tir dans ce niveau
    creer_pastilles(this);
    creer_pression(this);
    this.scene_jouee = [false, false, false, false, false]; // quelle scene a deja eu lieu
    this.temps_ensemble_nuit = 0;
    this.nuit_commencee = false;
    this.fin_en_cours = false;

    this.fige_par_le_niveau = false;
    var scene = this;
    if (this.arrivee_en_train == true) {
      this.fige_par_le_niveau = true;
      afficher_phrases(this, this.pensees || pensees.de_4_vers_5, function () {
        scene.fige_par_le_niveau = false;
      });
    }
  }

  mettre_a_jour_particularites(temps, delta) {
    mettre_a_jour_pastilles(this);
    mettre_a_jour_pression(this, delta);

    // chaque scene se declenche quand le joueur souris passe sa colonne (une seule fois)
    if (this.fige_par_le_niveau == false) {
      for (var i = 0; i < colonnes_des_scenes.length; i++) {
        if (this.scene_jouee[i] == false && this.joueur_souris.x > colonnes_des_scenes[i] * 16) {
          this.scene_jouee[i] = true;
          this.jouer_la_scene(i);
          break;
        }
      }
    }

    this.mettre_a_jour_la_nuit(delta);
  }


  // --- Une scene : le coup (suggere, jamais montre) ---

  jouer_la_scene(i) {
    if (i == 3) {
      this.scene_du_tribunal();
    } else if (i == 4) {
      this.commencer_la_nuit();
    } else {
      this.coup(i);
    }
  }

  // Une ombre arrive derriere le personnage ; on entend le choc ; il tombe ; la
  // piece garde la trace ; il se releve. i = 0 (salle), 1 (chambre), 2 (rue).
  coup(i) {
    var scene = this;
    var j = this.joueur_souris;
    this.fige_par_le_niveau = true;
    j.body.setVelocity(0, 0);
    this.destination_x = null;

    // 1) l'ombre arrive en glissant, par derriere
    var ombre = this.add.sprite(j.x - 100, sol_y, "img_ombre");
    ombre.setOrigin(0.5, 1);
    ombre.setDepth(8);
    ombre.setAlpha(0);
    this.tweens.add({ targets: ombre, alpha: 0.85, duration: 350 });
    this.tweens.add({
      targets: ombre,
      x: j.x - 8,
      duration: 900,
      ease: "Quad.easeIn",
      onComplete: function () {
        scene.choc(i, ombre);
      }
    });
  }

  // le choc : un son sourd, un flash sur le personnage, il tombe, la piece change
  choc(i, ombre) {
    var scene = this;
    var j = this.joueur_souris;
    this.tweens.add({ targets: ombre, alpha: 0, duration: 120, onComplete: function () { ombre.destroy(); } });
    jouer_son_coup();
    jouer_son_sifflement();
    this.cameras.main.shake(380, 0.014);
    j.setTintFill(0xffffff);
    this.time.delayedCall(90, function () {
      j.clearTint();
    }, null, this);

    // il tombe (le corps ne bouge plus tout seul pendant ce temps)
    j.body.enable = false;
    this.tweens.add({ targets: j, x: j.x + 18, y: j.y + 6, angle: 80, duration: 170, ease: "Quad.easeOut" });

    // la trace dans la piece
    this.laisser_une_trace(i);
    ajouter_pression(this, 0.22);

    // les deux voix de J2, l'une apres l'autre
    this.dire(voix[i][0], 700);
    this.dire(voix[i][1], 3000);

    // il se releve, doucement
    this.time.delayedCall(2600, function () {
      scene.tweens.add({
        targets: j,
        angle: 0,
        y: j.y - 6,
        duration: 600,
        ease: "Quad.easeInOut",
        onComplete: function () {
          j.body.reset(j.x, j.y);
          j.body.enable = true;
        }
      });
    }, null, this);
    this.time.delayedCall(4400, function () {
      scene.fige_par_le_niveau = false;
    }, null, this);
  }

  // ce que le coup change dans la piece (des tuiles de la carte)
  laisser_une_trace(i) {
    var calque = this.calque_bg2;
    if (i == 0) {
      // la salle : le pupitre est renverse
      calque.putTileAt(tuile_chaise_renversee[0], 24, 8);
      calque.putTileAt(tuile_chaise_renversee[1], 25, 8);
    } else if (i == 1) {
      // la chambre : la lampe de chevet est tombee et cassee, le miroir est fele
      calque.removeTileAt(54, 6);
      calque.removeTileAt(54, 7);
      calque.putTileAt(tuile_lampe_cassee, 55, 8);
      calque.putTileAt(tuile_miroir_fele[0], 59, 7);
      calque.putTileAt(tuile_miroir_fele[1], 59, 8);
      jouer_son_verre();
    } else if (i == 2) {
      // la rue : une vitre de l'immeuble se brise
      calque.putTileAt(tuile_vitre_cassee[0], 92, 3);
      calque.putTileAt(tuile_vitre_cassee[1], 93, 3);
      calque.putTileAt(tuile_vitre_cassee[2], 92, 4);
      calque.putTileAt(tuile_vitre_cassee[3], 93, 4);
      jouer_son_verre();
    }
  }


  // --- Les voix de J2 : une part de lui, rationnelle ou emotionnelle ---

  dire(voix_de_j2, delai) {
    var scene = this;
    this.time.delayedCall(delai, function () {
      var rationnelle = voix_de_j2.qui == "rationnelle";
      var style = Object.assign({}, style_texte, {
        color: rationnelle ? "#ffffff" : "#000000",
        stroke: rationnelle ? "#000000" : "#ffffff",
        wordWrap: { width: 90 }
      });
      var texte = scene.add.text(scene.joueur_clavier.x, scene.joueur_clavier.y - 22, voix_de_j2.texte, style);
      texte.setOrigin(0.5, 1);
      texte.setDepth(25);
      texte.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      texte.setAlpha(0);
      scene.tweens.add({ targets: texte, alpha: 1, duration: 300 });
      scene.tweens.add({ targets: texte, y: texte.y - 10, duration: 2400 });
      scene.tweens.add({ targets: texte, alpha: 0, delay: 1900, duration: 700, onComplete: function () { texte.destroy(); } });
    }, null, this);
  }


  // --- Le tribunal : des accusations fausses, puis « classe sans suite » ---

  scene_du_tribunal() {
    var scene = this;
    var j = this.joueur_souris;
    this.fige_par_le_niveau = true;
    j.body.setVelocity(0, 0);
    this.destination_x = null;

    // les accusations tombent sur lui, une a une, et s'empilent au-dessus de sa tete
    var mots = [];
    for (var k = 0; k < accusations.length; k++) {
      this.time.delayedCall(k * 900, function (indice) {
        var mot = scene.add.text(j.x, j.y - 40, accusations[indice], Object.assign({}, style_texte, { color: "#000000", stroke: "#ffffff" }));
        mot.setOrigin(0.5, 1);
        mot.setDepth(25);
        mot.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
        mots.push(mot);
        scene.tweens.add({ targets: mot, y: j.y - 14 - indice * 8, duration: 350, ease: "Quad.easeIn" });
        jouer_son_coup();
        ajouter_pression(scene, 0.05);
      }, [k], this);
    }

    // le tampon : « Classe sans suite. »
    this.time.delayedCall(accusations.length * 900 + 800, function () {
      var plaque = scene.add.text(j.x, j.y - 60, "CLASSÉ SANS SUITE", Object.assign({}, style_mot, { fontSize: "8px" }));
      plaque.setOrigin(0.5, 1);
      plaque.setDepth(26);
      plaque.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      plaque.setScale(1.6);
      scene.tweens.add({ targets: plaque, scale: 1, duration: 120, ease: "Quad.easeIn" });
      jouer_son_tampon();
      scene.cameras.main.shake(180, 0.006);
      ajouter_pression(scene, 0.1);
      scene.dire(voix[3][0], 400);
      scene.dire(voix[3][1], 2600);
      // tout s'efface doucement : mais les sequelles restent
      scene.time.delayedCall(4500, function () {
        scene.tweens.add({ targets: mots.concat([plaque]), alpha: 0, duration: 1500, onComplete: function () {
          for (var m = 0; m < mots.length; m++) {
            mots[m].destroy();
          }
          plaque.destroy();
        } });
        scene.fige_par_le_niveau = false;
      }, null, scene);
    }, null, this);
  }


  // --- La nuit : les cauchemars. Il faut rester ensemble pour tenir. ---

  commencer_la_nuit() {
    var scene = this;
    this.nuit_commencee = true;
    this.dire(voix[4][0], 600);
    this.dire(voix[4][1], 3000);
    // toutes les 7 s : une ombre traverse la piece en silence, un choc lointain
    this.time.addEvent({
      delay: delai_entre_cauchemars,
      loop: true,
      callback: function () {
        if (scene.fin_en_cours == true) {
          return;
        }
        var depart = scene.joueur_souris.x + 120;
        var ombre = scene.add.sprite(depart, sol_y, "img_ombre");
        ombre.setOrigin(0.5, 1);
        ombre.setDepth(8);
        ombre.setAlpha(0.5);
        scene.tweens.add({ targets: ombre, x: depart - 260, alpha: 0, duration: 2600, onComplete: function () { ombre.destroy(); } });
        scene.time.delayedCall(1300, function () {
          jouer_son_coup();
          scene.cameras.main.shake(160, 0.006);
          ajouter_pression(scene, 0.08);
        }, null, scene);
      }
    });
  }

  // chaque image (la nuit) : si les deux joueurs restent l'un a cote de l'autre assez
  // longtemps, la nuit se termine
  mettre_a_jour_la_nuit(delta) {
    if (this.nuit_commencee == false || this.fin_en_cours == true) {
      return;
    }
    var ecart = Phaser.Math.Distance.Between(this.joueur_souris.x, this.joueur_souris.y, this.joueur_clavier.x, this.joueur_clavier.y);
    if (ecart < 40 && this.joueur_souris.x > 186 * 16) {
      this.temps_ensemble_nuit = this.temps_ensemble_nuit + delta;
    } else {
      this.temps_ensemble_nuit = 0;
    }
    if (this.temps_ensemble_nuit >= duree_pour_tenir) {
      this.finir();
    }
  }

  finir() {
    var scene = this;
    this.fin_en_cours = true;
    this.fige_par_le_niveau = true;
    this.cameras.main.fadeOut(2500, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", function () {
      scene.cameras.main.resetFX();
      afficher_texte(scene, texte_de_fin, function () {
        scene.scene.start("accueil");
      });
    });
  }
}
