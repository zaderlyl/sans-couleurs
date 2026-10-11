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
import { est_un_clic_de_tir } from "./tir.js";
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
//   elle        : (facultatif) ce que dit l'ombre elle-meme, avec le delai ; ombre_reste : combien de
//                 temps elle reste visible apres le coup (ms, 450 par defaut)
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
  // (dans la rue, il vient de lui dire qu'il la quitte : elle le menace, avant de partir)
  { duree_ombre: 750, force: 0.9, chute: 80, decalage: 20, secousse: [380, 0.014], sifflement: 3.2, a_terre: 3600, pression: 0.26,
    ombre_reste: 5800,
    elle: [{ texte: "Si tu me quittes, je porte plainte.", delai: 600 }, { texte: "Tout le monde saura.", delai: 3000 }],
    j1: [{ texte: "...", delai: 4200 }],
    j2: [{ qui: "emotionnelle", texte: "Je ne dis plus rien. Ça ne sert à rien.", delai: 4000 }, { qui: "rationnelle", texte: "Tu peux partir.", delai: 6800 }] }
];

// Au tribunal, la camera recule et chaque personne parle dans SA ligne (hauteur du
// bas du texte, en pixels du monde) : rien ne se recouvre.
var zoom_du_tribunal = 3.6;
var lignes_du_tribunal = { j1: 128, rationnelle: 74, emotionnelle: 74, avocat: 68, juge: 54 };
var hauteur_de_la_pile = 112; // les accusations : la 1re est ici, les suivantes au-dessus (9 px chacune)

// La nuit : il se couche dans le lit, et elle vient le frapper quatre fois.
var x_du_lit = 2880; // le milieu du lit de la derniere piece (colonnes 178 a 181)
var delai_entre_les_coups_du_lit = 3200; // ms
var coups_du_lit = [
  { force: 0.45, pression: 0.05, voix: { qui: "emotionnelle", texte: "Ne bouge pas. Fais semblant de dormir." } },
  { force: 0.65, pression: 0.07, voix: { qui: "rationnelle", texte: "Ce n'est pas ta faute." } },
  { force: 0.85, pression: 0.09, voix: { qui: "emotionnelle", texte: "Pourquoi personne ne vient ?" } },
  { force: 1, pression: 0.12, voix: null } // le dernier coup : plus rien, le silence
];

var texte_de_fin = [
  t("Les douleurs les plus dures arrivent bien plus tard. Les cicatrices ne se referment jamais vraiment."),
  t("N'attends pas d'aller mal pour demander de l'aide : parle à quelqu'un autour de toi, un proche, un professionnel."),
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
      // le lit de la derniere piece : image 0 = vide, image 1 = lui dedans
      this.load.spritesheet("img_lit", "assets/sprites/props/lit.png", { frameWidth: 64, frameHeight: 32 });
    }
  }

  creer_particularites() {
    creer_pastilles(this);
    creer_pression(this);
    this.scene_jouee = [false, false, false, false, false]; // quelle scene a deja eu lieu
    this.lit_pris = false;
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

  // qui : "j1", "rationnelle", "emotionnelle", "elle" (l'ombre), "juge" ou "avocat" ; apres `delai` ms
  dire(qui, contenu, delai, duree) {
    var scene = this;
    var duree_du_texte = duree == undefined ? 2800 : duree;
    this.time.delayedCall(delai, function () {
      var cible = scene.joueur_souris;
      contenu = t(contenu);
      var largeur_j1 = scene.tribunal_actif == true ? 200 : 110; // au tribunal : sur une seule ligne
      var style = Object.assign({}, style_mot, { fontSize: "6px", color: "#ffffff", wordWrap: { width: largeur_j1 }, align: "center" });
      if (qui == "rationnelle") {
        cible = scene.joueur_clavier;
        style = Object.assign({}, style_texte, { color: "#ffffff", stroke: "#000000", wordWrap: { width: 100 } });
      } else if (qui == "emotionnelle") {
        cible = scene.joueur_clavier;
        style = Object.assign({}, style_texte, { color: "#000000", stroke: "#ffffff", wordWrap: { width: 100 } });
      } else if (qui == "elle") {
        cible = scene.ombre_courante;
        style = Object.assign({}, style_mot, { fontSize: "6px", color: "#ffffff", wordWrap: { width: 110 }, align: "center" });
      } else if (qui == "juge") {
        cible = scene.juge;
        style = Object.assign({}, style_mot, { fontSize: "6px", color: "#ffffff", wordWrap: { width: 200 }, align: "center" });
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
    ombre.haut_texte = 36;
    this.ombre_courante = ombre; // (c'est elle qui parle, voir dire)
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

    // l'ombre disparait (apres avoir parle, s'il y a lieu)
    var ombre_reste = c.ombre_reste == undefined ? 450 : c.ombre_reste;
    this.time.delayedCall(ombre_reste, function () {
      scene.tweens.add({ targets: ombre, alpha: 0, duration: 400, onComplete: function () { ombre.destroy(); } });
    }, null, this);

    // ce que dit elle (la menace), J1, et les deux voix de J2
    if (c.elle != undefined) {
      for (var e = 0; e < c.elle.length; e++) {
        this.dire("elle", c.elle[e].texte, c.elle[e].delai, 2600);
      }
    }
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


  // --- Le tribunal : la gravite. Le juge, ELLE (l'ombre) qui l'accuse, son avocat a lui, un classement. ---
  // Apres qu'il l'a quittee, elle a fait courir des rumeurs et porte plainte contre lui
  // pour viol. Ici, elle l'accuse : ses mots partent d'elle et viennent s'empiler au-dessus
  // de sa tete. Son avocat conteste, et le juge classe sans suite. (Rien n'est montre.)

  scene_du_tribunal() {
    var scene = this;
    var j = this.joueur_souris;
    this.figer_les_joueurs();
    this.tribunal_actif = true;
    this.tweens.add({ targets: this.cameras.main, zoom: zoom_du_tribunal, duration: 1000, ease: "Sine.easeInOut" }); // la camera recule

    // son avocat apparait a gauche du personnage ; elle (l'ombre, comme toujours), a droite du juge
    this.elle = this.add.sprite(2496, sol_y, "img_ombre", 0);
    this.elle.setOrigin(0.5, 1);
    this.elle.setDepth(8);
    this.elle.setAlpha(0);
    this.elle.haut_texte = 36;
    this.avocat = this.add.sprite(j.x - 26, sol_y, "img_tribunal", 1);
    this.avocat.setOrigin(0.5, 1);
    this.avocat.setDepth(8);
    this.avocat.haut_texte = 36;
    this.avocat.setAlpha(0);
    this.tweens.add({ targets: [this.elle, this.avocat], alpha: 1, duration: 600 });

    // le juge ouvre l'audience et dit de quoi il s'agit
    this.dire("juge", "Audience du tribunal correctionnel.", 600, 3000);
    this.time.delayedCall(700, function () { jouer_son_marteau(); }, null, this);
    this.dire("juge", "Plainte pour viol, déposée par Madame contre le prévenu.", 3800, 3600);

    // elle l'accuse : chaque mot part d'elle, vole jusqu'a lui et s'empile au-dessus de sa tete
    var mots = [];
    var accusations = [t("Il m'a forcée."), t("Il l'a fait."), t("Tout le monde le sait."), t("Il est dangereux.")];
    for (var k = 0; k < accusations.length; k++) {
      this.time.delayedCall(7600 + k * 1100, function (indice) {
        var mot = scene.add.text(scene.elle.x, hauteur_de_la_pile - 10, accusations[indice], Object.assign({}, style_texte, { color: "#000000", stroke: "#ffffff" }));
        mot.setOrigin(0.5, 1);
        mot.setDepth(25);
        mot.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
        var pile = { texte: mot, rang: indice, arrive: false };
        mots.push(pile);
        // le mot vole d'elle vers lui
        scene.tweens.add({ targets: mot, x: j.x, duration: 700, ease: "Quad.easeIn", onComplete: function () {
          pile.arrive = true;
          jouer_son_coup(0.35);
          scene.cameras.main.shake(120, 0.004);
          ajouter_pression(scene, 0.04);
        } });
      }, [k], this);
    }
    // les accusations, une fois arrivees, suivent le personnage (empilees)
    this.piles_du_tribunal = mots;

    // la defense : son avocat a lui
    this.dire("avocat", "Mon client conteste les faits.", 12000, 3000);
    this.dire("avocat", "Aucune preuve. Aucun témoin.", 14600, 2800);
    this.dire("j1", "Je ne lui ai jamais fait ça.", 16600, 2400);

    // la decision
    this.dire("juge", "Les faits ne sont pas établis : la plainte est classée sans suite.", 18000, 4200);
    this.time.delayedCall(18300, function () { jouer_son_marteau(); }, null, this);

    // le tampon : « CLASSE SANS SUITE »
    this.time.delayedCall(21800, function () {
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
    this.dire("rationnelle", "Tu n'as rien fait.", 23000, 2800);
    this.dire("emotionnelle", "Alors pourquoi je me sens coupable ?", 25400, 3400);

    // tout s'efface doucement : mais les sequelles restent
    this.time.delayedCall(29000, function () {
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
      scene.tweens.add({ targets: [scene.avocat, scene.elle], alpha: 0, duration: 1500 });
      scene.tribunal_actif = false;
      scene.tweens.add({ targets: scene.cameras.main, zoom: 5, duration: 1500, ease: "Sine.easeInOut" }); // la camera revient
      scene.liberer_les_joueurs();
    }, null, this);
  }


  // --- La nuit : il pleure, il ne sait plus quoi faire. Il se couche ; elle vient le frapper. Puis la fin. ---

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

    // le lit : on peut s'y coucher (clic de la souris)
    this.creer_le_lit();
  }

  // le lit est cliquable : il vibre quand la souris est dessus, et un petit texte l'indique.
  // C'est une image (le lit vide, puis le lit avec lui dedans), posee a la place des tuiles du lit.
  creer_le_lit() {
    var scene = this;
    // on retire les tuiles du lit de la carte (colonnes 178 a 181, rangees 7 et 8)
    for (var c = 178; c <= 181; c++) {
      this.calque_bg2.removeTileAt(c, 7);
      this.calque_bg2.removeTileAt(c, 8);
    }
    this.lit = this.add.sprite(178 * 16, 7 * 16, "img_lit", 0);
    this.lit.setOrigin(0, 0);
    this.lit.setDepth(4);
    this.lit.setInteractive({ useHandCursor: true });
    this.lit.survole = false;
    this.lit.on("pointerover", function () { scene.lit.survole = true; });
    this.lit.on("pointerout", function () { scene.lit.survole = false; });

    this.indice_du_lit = this.add.text(x_du_lit, sol_y - 34, t("Se coucher"), style_texte);
    this.indice_du_lit.setOrigin(0.5, 1);
    this.indice_du_lit.setDepth(25);
    this.indice_du_lit.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.tweens.add({ targets: this.indice_du_lit, alpha: 0.35, duration: 900, yoyo: true, repeat: -1 });

    this.lit.on("pointerdown", function (pointeur) {
      if (est_un_clic_de_tir(pointeur) == true || scene.lit_pris == true || scene.est_fige() == true) {
        return;
      }
      scene.lit_pris = true;
      scene.lit.survole = false;
      scene.aller_vers(x_du_lit - 8, function () {
        scene.se_coucher();
      });
    });
  }

  // chaque image : le lit vibre (un petit tremblement) quand la souris est dessus
  faire_vibrer_le_lit() {
    if (this.lit == undefined || this.lit.active == false || this.lit.vibre_fort == true) {
      return;
    }
    var x = 178 * 16;
    var y = 7 * 16;
    if (this.lit.survole == true) {
      x = x + Phaser.Math.Between(-1, 1);
      y = y + Phaser.Math.Between(-1, 1);
    }
    this.lit.setPosition(x, y);
  }

  // J1 se couche dans le lit (l'image du lit change : il est dedans) ; puis elle arrive et le frappe, quatre fois
  se_coucher() {
    var scene = this;
    var j = this.joueur_souris;
    this.figer_les_joueurs();
    this.lit.disableInteractive();
    this.indice_du_lit.destroy();
    // il est dans le lit : on ne voit plus le personnage, mais le lit avec lui dedans
    // (ses larmes partent de sa tete, sur l'oreiller)
    j.setPosition(x_du_lit - 22, sol_y - 12);
    j.setVisible(false);
    this.lit.setFrame(1);
    this.dire("j1", "Je n'ai plus la force.", 900, 2400);

    // elle arrive en marchant, depuis la droite, et s'arrete a cote du lit
    var elle = this.add.sprite(x_du_lit + 150, sol_y, "img_ombre", 0);
    elle.setOrigin(0.5, 1);
    elle.setDepth(8);
    elle.setAlpha(0);
    elle.haut_texte = 36;
    this.ombre_courante = elle;
    this.time.delayedCall(1800, function () {
      scene.tweens.add({ targets: elle, alpha: 0.9, duration: 300 });
      var pas = 0;
      var minuteur_de_pas = scene.time.addEvent({
        delay: 150,
        loop: true,
        callback: function () {
          pas = pas + 1;
          elle.setFrame(1 + (pas % 2));
        }
      });
      scene.tweens.add({
        targets: elle,
        x: x_du_lit + 44,
        duration: 2600,
        ease: "Sine.easeIn",
        onComplete: function () {
          minuteur_de_pas.remove();
          scene.frapper_dans_le_lit(0, elle);
        }
      });
    }, null, this);
  }

  // le coup numero n (0 a 3) : le bras se leve, le choc, une voix de J2 ; puis le suivant
  frapper_dans_le_lit(n, elle) {
    var scene = this;
    var j = this.joueur_souris;
    var c = coups_du_lit[n];
    elle.setFrame(3); // le bras leve
    this.time.delayedCall(450, function () {
      elle.setFrame(4); // le bras tendu : le coup
      jouer_son_coup(c.force);
      if (n >= 2) {
        jouer_son_sifflement(1 + n);
      }
      scene.cameras.main.shake(180 + 160 * c.force, 0.005 + 0.01 * c.force);
      // le lit prend le coup : un flash blanc et il tremble
      scene.lit.setTintFill(0xffffff);
      scene.time.delayedCall(90, function () { scene.lit.clearTint(); }, null, scene);
      scene.lit.vibre_fort = true;
      scene.tweens.add({ targets: scene.lit, x: scene.lit.x + 2, duration: 40, yoyo: true, repeat: 4, onComplete: function () {
        scene.lit.vibre_fort = false;
      } });
      ajouter_pression(scene, c.pression);
      if (c.voix != null) {
        scene.dire(c.voix.qui, c.voix.texte, 800, 2400);
      }
    }, null, this);

    if (n + 1 < coups_du_lit.length) {
      this.time.delayedCall(delai_entre_les_coups_du_lit, function () {
        scene.frapper_dans_le_lit(n + 1, elle);
      }, null, this);
    } else {
      // apres le dernier coup : le silence, elle s'en va, et c'est la fin
      this.time.delayedCall(2600, function () {
        scene.tweens.add({ targets: elle, alpha: 0, duration: 900, onComplete: function () { elle.destroy(); } });
      }, null, this);
      this.time.delayedCall(4600, function () {
        scene.finir();
      }, null, this);
    }
  }

  // chaque image (la nuit) : les accusations du tribunal suivent le personnage
  mettre_a_jour_la_nuit(delta) {
    this.faire_vibrer_le_lit();
    // les accusations du tribunal suivent le personnage (empilees au-dessus de sa tete)
    if (this.piles_du_tribunal != undefined) {
      for (var p = 0; p < this.piles_du_tribunal.length; p++) {
        var pile = this.piles_du_tribunal[p];
        if (pile.arrive == true) {
          pile.texte.setPosition(this.joueur_souris.x, hauteur_de_la_pile - pile.rang * 9);
        } else {
          pile.texte.y = hauteur_de_la_pile - pile.rang * 9;
        }
      }
      if (this.plaque_du_tribunal != undefined && this.plaque_du_tribunal.active) {
        this.plaque_du_tribunal.setPosition(this.joueur_souris.x, 42);
      }
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
