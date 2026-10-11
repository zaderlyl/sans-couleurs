// niveau5.js — le niveau 5 : le lycee (la carte "map-5-lycee").
//
// Une suite de PIECES (une salle de cours, une chambre, la rue, un tribunal, la
// chambre la nuit), separees par de grands passages tout BLANCS (des tuiles
// blanches, rien d'autre). Dans chaque piece, une scene de violence. On ne la
// montre jamais : on la fait RESSENTIR. Une ombre arrive, on entend le choc, le
// personnage tombe, les oreilles sifflent, la piece garde la trace.
//
// Les coups sont GRADUELS, comme dans la vraie vie : au debut c'est presque rien,
// il en rit ; puis c'est plus fort, il se pose des questions, il trouve des
// excuses ; puis il ne dit plus rien, par habitude ; puis il pleure, il ne sait
// plus quoi faire. Pendant chaque scene, les deux joueurs sont VRAIMENT figes.
//
// Les textes sont separes par qui parle, et SUIVENT leur personnage : ce que dit
// J1 (un cadre noir), la voix rationnelle de J2 (blanc, contour noir), sa voix
// emotionnelle (noir, contour blanc), et au tribunal le juge et l'avocat.
//
// La PRESSION (voir pression.js) monte a chaque coup. J2 est une part du
// personnage lui-meme, un allie interieur : quand les deux joueurs restent l'un a
// cote de l'autre, elle redescend, mais jamais tout a fait (les sequelles).

import niveau from "./niveau.js";
import { creer_pastilles, mettre_a_jour_pastilles } from "./pastilles.js";
import { creer_pression, mettre_a_jour_pression, ajouter_pression } from "./pression.js";
import { afficher_texte, afficher_pensees } from "./ecran_texte.js";
import { jouer_son_coup, jouer_son_sifflement, jouer_son_verre, jouer_son_tampon, jouer_son_marteau } from "./sons.js";
import { style_texte, style_mot } from "./styles.js";
import { pensees } from "./pensees.js";
import { t } from "./langue.js";


// --- Reglages ------------------------------------------------------------

var sol_y = 144; // le haut du sol

// ou chaque scene se declenche (colonne que le joueur souris depasse) :
// la salle, la chambre, la rue, le tribunal, la nuit
var colonnes_des_scenes = [22, 57, 93, 149, 178];

// les numeros de tuiles du jeu de tuiles du lycee (voir Tileset-lycee.png)
var tuile_chaise_renversee = [465, 466];
var tuile_lampe_cassee = 479;
var tuile_miroir_fele = [481, 497];
var tuile_vitre_cassee = [523, 524, 539, 540];

// Les trois coups, de plus en plus violents.
//   duree_ombre : combien de temps l'ombre met a arriver (plus violent = plus vite)
//   force       : le bruit du coup (0 a 1)
//   chute       : l'angle de la chute (12 = il trebuche, 80 = il est a terre)
//   decalage    : de combien il est projete (pixels)
//   secousse    : [duree en ms, intensite] de l'ecran
//   sifflement  : duree des oreilles qui sifflent (0 = aucun)
//   a_terre     : combien de temps il reste a terre (ms)
//   pression    : combien la pression monte
//   j1 / j2     : ce que disent J1 et les deux voix de J2, avec le delai (ms) apres le coup
var coups = [
  // 1. presque rien : il trouve ca drole
  { duree_ombre: 1300, force: 0.2, chute: 12, decalage: 5, secousse: [110, 0.004], sifflement: 0, a_terre: 500, pression: 0.04,
    j1: [{ texte: "Haha. Arrête.", delai: 700 }],
    j2: [{ qui: "emotionnelle", texte: "C'est rien. Elle plaisante.", delai: 1900 }, { qui: "rationnelle", texte: "Ça ne devrait pas arriver.", delai: 3900 }] },
  // 2. plus fort : il se pose des questions, il trouve des excuses
  { duree_ombre: 1000, force: 0.55, chute: 55, decalage: 12, secousse: [260, 0.009], sifflement: 1.4, a_terre: 1700, pression: 0.15,
    j1: [{ texte: "Pourquoi ?", delai: 800 }, { texte: "J'ai dû faire quelque chose.", delai: 2900 }],
    j2: [{ qui: "emotionnelle", texte: "Elle était fatiguée.", delai: 1500 }, { qui: "rationnelle", texte: "Non. Ce n'est pas une excuse.", delai: 4400 }] },
  // 3. violent : il ne dit plus rien, par habitude
  { duree_ombre: 750, force: 0.9, chute: 80, decalage: 20, secousse: [380, 0.014], sifflement: 3.2, a_terre: 2600, pression: 0.26,
    j1: [{ texte: "...", delai: 1400 }],
    j2: [{ qui: "emotionnelle", texte: "Je ne dis plus rien. Ça ne sert à rien.", delai: 1200 }, { qui: "rationnelle", texte: "Tu peux partir.", delai: 4200 }] }
];

// Au tribunal, la camera recule et chaque personne parle dans SA ligne (hauteur du
// bas du texte, en pixels du monde) : rien ne se recouvre.
var zoom_du_tribunal = 3.6;
var lignes_du_tribunal = { j1: 128, rationnelle: 82, emotionnelle: 82, avocat: 68, juge: 54 };
var hauteur_de_la_pile = 120; // les accusations : la 1re est ici, les suivantes au-dessus (9 px chacune)

var delai_entre_cauchemars = 7000; // ms (la nuit)
var duree_pour_tenir = 6000; // ms a rester l'un a cote de l'autre pour finir la nuit

var texte_de_fin = [
  t("Une plainte. Une audience. Des mots qu'on a mis dans ta bouche."),
  t("Le dossier a été classé sans suite : rien n'a été prouvé, rien n'a été réparé."),
  t("Il reste les nuits."),
  t("Si tu as vécu de la violence dans une relation, tu n'es pas seul. Le 116 006 (aide aux victimes) et le 3114 répondent gratuitement."),
  t("Clique pour revenir à l'accueil.")
].join("\n\n");


export default class niveau5 extends niveau {
  constructor() {
    // la cle de la scene, et le nom de la carte Tiled
    super("niveau5", "map-5-lycee");
  }

  preload() {
    super.preload(); // la carte, les tuiles, les personnages...
    if (this.textures.exists("img_ombre") == false) {
      // l'ombre : 5 images (debout, 2 de marche, bras leve, bras tendu) ; le tribunal : juge, avocat
      this.load.spritesheet("img_ombre", "assets/sprites/characters/ombre.png", { frameWidth: 16, frameHeight: 32 });
      this.load.spritesheet("img_tribunal", "assets/sprites/characters/tribunal.png", { frameWidth: 16, frameHeight: 32 });
    }
  }

  creer_particularites() {
    creer_pastilles(this);
    creer_pression(this);
    this.scene_jouee = [false, false, false, false, false]; // quelle scene a deja eu lieu
    this.temps_ensemble_nuit = 0;
    this.nuit_commencee = false;
    this.fin_en_cours = false;
    this.textes_suivis = []; // les textes qui suivent un personnage (voir dire)
    this.joueur_souris.haut_texte = 14; // la hauteur des textes au-dessus de chaque joueur :
    this.joueur_clavier.haut_texte = 30; // ceux de J2 sont plus hauts, pour ne pas recouvrir ceux de J1

    // le juge, derriere son bureau (on ne voit que son buste)
    this.juge = this.add.sprite(2440, 124, "img_tribunal", 0);
    this.juge.setCrop(0, 0, 16, 16);
    this.juge.setDepth(6);
    this.juge.haut_texte = 22;

    this.fige_par_le_niveau = false;
    var scene = this;
    if (this.arrivee_en_train == true) {
      this.fige_par_le_niveau = true;
      afficher_pensees(this, this.pensees || pensees.de_4_vers_5, function () {
        scene.fige_par_le_niveau = false;
      });
    }
  }

  mettre_a_jour_particularites(temps, delta) {
    mettre_a_jour_pastilles(this);
    mettre_a_jour_pression(this, delta);
    this.suivre_les_textes(delta);

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

  jouer_la_scene(i) {
    if (i == 3) {
      this.scene_du_tribunal();
    } else if (i == 4) {
      this.commencer_la_nuit();
    } else {
      this.coup(i);
    }
  }


  // --- Figer les deux joueurs POUR DE VRAI, puis les liberer ---

  // plus de mouvement, plus de physique, plus d'ordre de marche : rien ne peut les deplacer
  figer_les_joueurs() {
    var joueurs = [this.joueur_souris, this.joueur_clavier];
    for (var i = 0; i < joueurs.length; i++) {
      joueurs[i].y_repos = joueurs[i].y; // le sol : ou ils reviendront
      joueurs[i].body.setVelocity(0, 0);
      joueurs[i].body.enable = false;
      joueurs[i].anims.stop();
      joueurs[i].setFrame(3);
    }
    this.destination_x = null;
    this.apres_arrivee = null;
    this.fige_par_le_niveau = true;
  }

  // ils reviennent exactement au sol, droits, et la physique repart
  liberer_les_joueurs() {
    var joueurs = [this.joueur_souris, this.joueur_clavier];
    for (var i = 0; i < joueurs.length; i++) {
      this.tweens.killTweensOf(joueurs[i]);
      joueurs[i].setAngle(0);
      joueurs[i].clearTint();
      joueurs[i].body.reset(joueurs[i].x, joueurs[i].y_repos);
      joueurs[i].body.enable = true;
    }
    this.fige_par_le_niveau = false;
  }


  // --- Les textes : separes par qui parle, et qui SUIVENT leur personnage ---

  // qui : "j1", "rationnelle", "emotionnelle", "juge" ou "avocat" ; apres `delai` ms
  dire(qui, contenu, delai, duree) {
    var scene = this;
    var duree_du_texte = duree == undefined ? 2800 : duree;
    this.time.delayedCall(delai, function () {
      var cible = scene.joueur_souris;
      contenu = t(contenu);
      var style = Object.assign({}, style_mot, { fontSize: "6px", color: "#ffffff", wordWrap: { width: 110 }, align: "center" });
      if (qui == "rationnelle") {
        cible = scene.joueur_clavier;
        style = Object.assign({}, style_texte, { color: "#ffffff", stroke: "#000000", wordWrap: { width: 100 } });
      } else if (qui == "emotionnelle") {
        cible = scene.joueur_clavier;
        style = Object.assign({}, style_texte, { color: "#000000", stroke: "#ffffff", wordWrap: { width: 100 } });
      } else if (qui == "juge") {
        cible = scene.juge;
        style = Object.assign({}, style_mot, { fontSize: "6px", color: "#ffffff", wordWrap: { width: 130 }, align: "center" });
      } else if (qui == "avocat") {
        cible = scene.avocat;
        style = Object.assign({}, style_mot, { fontSize: "6px", color: "#ffffff", wordWrap: { width: 130 }, align: "center" });
      }
      var texte = scene.add.text(cible.x, cible.y, contenu, style);
      texte.setOrigin(0.5, 1);
      texte.setDepth(25);
      texte.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      texte.setAlpha(0);
      // au tribunal : une ligne fixe pour chacun (sinon, juste au-dessus de sa cible)
      var y_fixe = scene.tribunal_actif == true ? lignes_du_tribunal[qui] : undefined;
      scene.textes_suivis.push({ texte: texte, cible: cible, age: 0, duree: duree_du_texte, y_fixe: y_fixe });
    }, null, this);
  }

  // chaque image : chaque texte se place au-dessus de SA cible, la ou elle est maintenant
  suivre_les_textes(delta) {
    for (var i = this.textes_suivis.length - 1; i >= 0; i--) {
      var t = this.textes_suivis[i];
      t.age = t.age + delta;
      var haut = t.cible.haut_texte == undefined ? 14 : t.cible.haut_texte;
      var montee = Math.min(10, t.age / 250);
      // le texte reste toujours entierement dans l'ecran (sur le bord, il se decale)
      var vue = this.cameras.main.worldView;
      var demi = t.texte.displayWidth / 2 + 3;
      var x = Phaser.Math.Clamp(t.cible.x, vue.left + demi, vue.right - demi);
      var y = t.y_fixe == undefined ? t.cible.y - haut - montee : t.y_fixe - montee / 2;
      t.texte.setPosition(x, y);
      // en fondu a l'arrivee (300 ms), puis en fondu a la fin (600 ms)
      var alpha = Math.min(1, t.age / 300);
      if (t.age > t.duree - 600) {
        alpha = Math.max(0, (t.duree - t.age) / 600);
      }
      t.texte.setAlpha(alpha);
      if (t.age >= t.duree) {
        t.texte.destroy();
        this.textes_suivis.splice(i, 1);
      }
    }
  }


  // --- Un coup (suggere, jamais montre) : i = 0 (salle), 1 (chambre), 2 (rue) ---

  coup(i) {
    var scene = this;
    var j = this.joueur_souris;
    var c = coups[i];
    this.figer_les_joueurs();

    // 1) l'ombre arrive en marchant, par derriere : debout, puis le pas, puis le bras leve
    var ombre = this.add.sprite(j.x - 110, sol_y, "img_ombre", 0);
    ombre.setOrigin(0.5, 1);
    ombre.setDepth(8);
    ombre.setAlpha(0);
    this.tweens.add({ targets: ombre, alpha: 0.9, duration: 300 });
    var pas = 0;
    var minuteur_de_pas = this.time.addEvent({
      delay: 150,
      loop: true,
      callback: function () {
        pas = pas + 1;
        ombre.setFrame(1 + (pas % 2));
      }
    });
    this.tweens.add({
      targets: ombre,
      x: j.x - 14,
      duration: c.duree_ombre,
      ease: "Quad.easeIn",
      onComplete: function () {
        minuteur_de_pas.remove();
        ombre.setFrame(3); // le bras leve
        scene.time.delayedCall(140, function () {
          ombre.setFrame(4); // le bras tendu : le coup
          scene.choc(i, ombre);
        }, null, scene);
      }
    });
  }

  // le choc : un son, un flash sur le personnage, il tombe ou trebuche, la piece change
  choc(i, ombre) {
    var scene = this;
    var j = this.joueur_souris;
    var c = coups[i];
    jouer_son_coup(c.force);
    if (c.sifflement > 0) {
      jouer_son_sifflement(c.sifflement);
    }
    this.cameras.main.shake(c.secousse[0], c.secousse[1]);
    j.setTintFill(0xffffff);
    this.time.delayedCall(90, function () {
      j.clearTint();
    }, null, this);

    // il est projete : il trebuche (petit coup) ou tombe (gros coup)
    this.tweens.add({ targets: j, x: j.x + c.decalage, y: j.y_repos + (c.chute > 40 ? 6 : 0), angle: c.chute, duration: 170, ease: "Quad.easeOut" });

    this.laisser_une_trace(i);
    ajouter_pression(this, c.pression);

    // l'ombre disparait
    this.time.delayedCall(450, function () {
      scene.tweens.add({ targets: ombre, alpha: 0, duration: 400, onComplete: function () { ombre.destroy(); } });
    }, null, this);

    // ce que dit J1, et les deux voix de J2
    for (var k = 0; k < c.j1.length; k++) {
      this.dire("j1", c.j1[k].texte, c.j1[k].delai, 2300);
    }
    for (var m = 0; m < c.j2.length; m++) {
      this.dire(c.j2[m].qui, c.j2[m].texte, c.j2[m].delai, 2600);
    }

    // il se releve, doucement, puis les joueurs sont liberes
    this.time.delayedCall(c.a_terre, function () {
      scene.tweens.add({ targets: j, angle: 0, y: j.y_repos, duration: 500, ease: "Quad.easeInOut" });
    }, null, this);
    var fin = Math.max(c.a_terre + 900, c.j2[c.j2.length - 1].delai + 2800);
    this.time.delayedCall(fin, function () {
      scene.liberer_les_joueurs();
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


  // --- Le tribunal : la gravite. Un juge, un avocat, des accusations, un classement. ---

  scene_du_tribunal() {
    var scene = this;
    var j = this.joueur_souris;
    this.figer_les_joueurs();
    this.tribunal_actif = true;
    this.tweens.add({ targets: this.cameras.main, zoom: zoom_du_tribunal, duration: 1000, ease: "Sine.easeInOut" }); // la camera recule

    // l'avocat apparait a cote du personnage
    this.avocat = this.add.sprite(j.x - 26, sol_y, "img_tribunal", 1);
    this.avocat.setOrigin(0.5, 1);
    this.avocat.setDepth(8);
    this.avocat.haut_texte = 36;
    this.avocat.setAlpha(0);
    this.tweens.add({ targets: this.avocat, alpha: 1, duration: 600 });

    // le juge ouvre l'audience
    this.dire("juge", "Audience du tribunal correctionnel.", 600, 3000);
    this.time.delayedCall(700, function () { jouer_son_marteau(); }, null, this);
    this.dire("juge", "Vous êtes poursuivi pour violences volontaires sur conjoint.", 3800, 3600);

    // les accusations tombent sur lui, une a une, et s'empilent au-dessus de sa tete
    var mots = [];
    var accusations = [t("Il ment."), t("Il est dangereux."), t("Il l'a menacée."), t("Il ne dit rien.")];
    for (var k = 0; k < accusations.length; k++) {
      this.time.delayedCall(7600 + k * 1000, function (indice) {
        var mot = scene.add.text(j.x, hauteur_de_la_pile - indice * 9, accusations[indice], Object.assign({}, style_texte, { color: "#000000", stroke: "#ffffff" }));
        mot.setOrigin(0.5, 1);
        mot.setDepth(25);
        mot.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
        mots.push({ texte: mot, rang: indice });
        jouer_son_coup(0.35);
        scene.cameras.main.shake(120, 0.004);
        ajouter_pression(scene, 0.04);
      }, [k], this);
    }
    // les accusations suivent le personnage (empilees)
    this.piles_du_tribunal = mots;

    // la defense
    this.dire("avocat", "Mon client conteste les faits.", 12200, 3000);
    this.dire("j1", "...", 12500, 2600);

    // la decision
    this.dire("juge", "Après examen du dossier, la procédure est classée sans suite.", 15600, 4200);
    this.time.delayedCall(15900, function () { jouer_son_marteau(); }, null, this);

    // le tampon : « CLASSE SANS SUITE »
    this.time.delayedCall(19600, function () {
      var plaque = scene.add.text(j.x, 42, t("CLASSÉ SANS SUITE"), Object.assign({}, style_mot, { fontSize: "8px" }));
      plaque.setOrigin(0.5, 1);
      plaque.setDepth(26);
      plaque.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      plaque.setScale(1.7);
      scene.tweens.add({ targets: plaque, scale: 1, duration: 130, ease: "Quad.easeIn" });
      jouer_son_tampon();
      scene.cameras.main.shake(260, 0.01);
      ajouter_pression(scene, 0.12);
      scene.plaque_du_tribunal = plaque;
    }, null, this);

    // les deux voix de J2
    this.dire("rationnelle", "Tu n'as rien fait.", 20800, 2800);
    this.dire("emotionnelle", "Alors pourquoi je me sens coupable ?", 23200, 3400);

    // tout s'efface doucement : mais les sequelles restent
    this.time.delayedCall(26800, function () {
      var a_effacer = [scene.plaque_du_tribunal];
      for (var m = 0; m < mots.length; m++) {
        a_effacer.push(mots[m].texte);
      }
      scene.tweens.add({ targets: a_effacer, alpha: 0, duration: 1500, onComplete: function () {
        for (var n = 0; n < a_effacer.length; n++) {
          a_effacer[n].destroy();
        }
        scene.piles_du_tribunal = [];
      } });
      scene.tweens.add({ targets: scene.avocat, alpha: 0, duration: 1500 });
      scene.tribunal_actif = false;
      scene.tweens.add({ targets: scene.cameras.main, zoom: 5, duration: 1500, ease: "Sine.easeInOut" }); // la camera revient
      scene.liberer_les_joueurs();
    }, null, this);
  }


  // --- La nuit : il pleure, il ne sait plus quoi faire. Les coups reviennent en ombres. ---

  commencer_la_nuit() {
    var scene = this;
    this.nuit_commencee = true;
    this.dire("j1", "Je ne sais plus quoi faire.", 700, 3600);
    this.dire("emotionnelle", "J'ai peur de m'endormir.", 2400, 3000);
    this.dire("rationnelle", "Je suis là.", 5000, 3000);

    // des larmes : de petits pixels qui coulent du visage, tant que la nuit dure
    this.time.addEvent({
      delay: 380,
      loop: true,
      callback: function () {
        if (scene.fin_en_cours == true) {
          return;
        }
        var larme = scene.add.circle(scene.joueur_souris.x + Phaser.Math.Between(-2, 2), scene.joueur_souris.y - 4, 1.2, 0xffffff);
        larme.setStrokeStyle(0.8, 0x000000);
        larme.setDepth(20);
        scene.tweens.add({ targets: larme, y: larme.y + 12, alpha: 0, duration: 900, onComplete: function () { larme.destroy(); } });
      }
    });

    // toutes les 7 s : une ombre traverse la piece en silence, un choc lointain
    this.time.addEvent({
      delay: delai_entre_cauchemars,
      loop: true,
      callback: function () {
        if (scene.fin_en_cours == true) {
          return;
        }
        var depart = scene.joueur_souris.x + 130;
        var ombre = scene.add.sprite(depart, sol_y, "img_ombre", 3);
        ombre.setOrigin(0.5, 1);
        ombre.setDepth(8);
        ombre.setAlpha(0.45);
        scene.tweens.add({ targets: ombre, x: depart - 270, alpha: 0, duration: 2800, onComplete: function () { ombre.destroy(); } });
        scene.time.delayedCall(1400, function () {
          jouer_son_coup(0.3);
          scene.cameras.main.shake(160, 0.006);
          ajouter_pression(scene, 0.07);
        }, null, scene);
      }
    });
  }

  // chaque image (la nuit) : si les deux joueurs restent l'un a cote de l'autre assez
  // longtemps, la nuit se termine
  mettre_a_jour_la_nuit(delta) {
    // les accusations du tribunal suivent le personnage (empilees au-dessus de sa tete)
    if (this.piles_du_tribunal != undefined) {
      for (var p = 0; p < this.piles_du_tribunal.length; p++) {
        var pile = this.piles_du_tribunal[p];
        pile.texte.setPosition(this.joueur_souris.x, hauteur_de_la_pile - pile.rang * 9);
      }
      if (this.plaque_du_tribunal != undefined && this.plaque_du_tribunal.active) {
        this.plaque_du_tribunal.setPosition(this.joueur_souris.x, 42);
      }
    }

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
