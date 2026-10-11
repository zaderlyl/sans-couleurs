// phrases.js — les mots du college. Ils arrivent par VAGUES, comme la sonnerie :
// toutes les 25 secondes, une cloche sonne, puis une vague de mots traverse le
// couloir, UN MOT APRES L'AUTRE (pour qu'on lise chacun) ; entre deux vagues,
// c'est calme.
//
// Deux sortes de mots :
//   - les mots CLAIRS : des moqueries legeres. Ils pesent 1 ;
//   - les mots FONCES : des mots vraiment mechants, des insultes. Ils pesent 2.
//
// On ne peut PAS les effacer : un mot qui touche un joueur s'accroche au-dessus
// de sa tete et reste. Chaque point de poids le ralentit un peu plus, jusqu'a ce
// qu'il n'avance presque plus.
//
// Ce qui les fait partir : l'AUTRE joueur. Quand les deux joueurs restent l'un a
// cote de l'autre, les mots se detachent un par un (chaque joueur en perd un a
// chaque fois). Un mot fonce s'eclaircit d'abord (il devient une moquerie legere),
// puis se detache ; en partant, un mot se change en une phrase plus douce.
// Seul, le poids s'accumule. A deux, il s'allege. Il n'y a ni tir ni ennemi.
//
// Plus un joueur porte de poids, plus SON ecran s'assombrit sur les bords (un
// voile noir, flou et sans contraste) et plus la musique devient grave : le poids
// se ressent sans texte.
//
// ECHEC : un joueur qui porte le poids maximum pendant 8 secondes d'affilee
// s'effondre : fondu au noir, un texte, un clic, et les deux joueurs repartent de
// la derniere porte de classe passee, sans aucun mot. L'autre joueur peut le
// sauver en venant tout contre lui (les mots se detachent).
//
// Un TIMER RECURRENT lance la vague toutes les 25 s. Les mots cessent (et tout
// s'allege) quand les deux joueurs arrivent a la gare.
//
// Comment s'en servir (dans un niveau, voir niveau3.js) :
//   creer_phrases(this);                    // apres creer_tir
//   mettre_a_jour_phrases(this, delta);     // dans mettre_a_jour_particularites

import { style_texte } from "./styles.js";
import { afficher_texte } from "./ecran_texte.js";
import { jouer_son_mot_refuse, jouer_son_mot_pose, jouer_son_sonnerie, peser_sur_la_musique } from "./sons.js";

// les mots clairs : des moqueries legeres
var clairs = [
  "T'es bizarre, quand même.",
  "Pourquoi tu es comme ça ?",
  "Tu fais exprès.",
  "Encore toi.",
  "Il parle jamais, lui.",
  "Regardez-le, tout seul.",
  "Cette place est prise.",
  "Il se croit où ?"
];
// les mots fonces : vraiment mechants
var fonces = [
  "T'es nul.",
  "Tu sers à rien.",
  "Personne ne t'aime.",
  "Dégage.",
  "T'es dégoûtant.",
  "Tu fais pitié.",
  "T'es de trop ici.",
  "Ferme-la."
];
// ce que devient un mot quand il se detache
var douces = ["Je suis là.", "Tu n'es pas seul.", "Ça va aller.", "On avance."];

var delai_vague = 25000; // ms entre deux vagues (timer recurrent)
var premiere_vague = 8000; // ms avant la premiere vague
var delai_avertissement = 1300; // ms entre la sonnerie et l'arrivee des mots
var mots_par_vague = 6;
var delai_entre_mots = 1800; // ms entre deux mots d'une meme vague : ils arrivent UN PAR UN
var distance_devant = 150; // un mot apparait a cette distance devant le joueur le plus avance
var hauteurs = [126, 136]; // y du monde : deux lignes qui alternent, pour qu'on lise chaque mot
var vitesse_vague = 34; // px/s : les mots clairs avancent vers la gauche
var vitesse_vague_foncee = 44; // px/s : les mots fonces vont plus vite
var maximum_portes = 6; // un joueur ne porte jamais plus de poids que ca (clair = 1, fonce = 2)
var perte_de_vitesse = 0.16; // chaque point de poids retire ca a la vitesse (1 = normale)
var vitesse_minimum = 0.1; // il avance toujours un peu : jamais bloque pour de bon
var distance_ensemble = 40; // pixels : "l'un a cote de l'autre"
var delai_detache = 1800; // ms entre deux mots qui se detachent quand on est ensemble
var hauteur_pile = 7; // pixels entre deux mots empiles au-dessus de la tete
var duree_avant_effondrement = 8000; // ms au poids maximum avant de s'effondrer
var texte_effondrement = "Tu n'as pas pu avancer.\n\nClique pour continuer";
// les portes de classe (colonnes) : si un joueur s'effondre, on repart de la derniere passee
var colonnes_de_reprise = [40, 71, 88];
var colonne_de_fin = 98; // quand les deux joueurs l'ont depassee, plus de mots

var id_indice = "indice-phrases";


// --- 1. Mise en place (dans create) ------------------------------------------

export function creer_phrases(scene) {
  scene.groupe_phrases = scene.physics.add.group({ allowGravity: false }); // les mots qui flottent
  scene.phrases_actives = true;
  scene.effondrement = false; // un joueur vient de s'effondrer (le jeu est fige : voir est_fige)
  scene.joueur_souris.temps_au_maximum = 0; // depuis combien de temps il porte le poids maximum
  scene.joueur_clavier.temps_au_maximum = 0;
  scene.temps_ensemble = 0; // depuis combien de temps les joueurs sont l'un a cote de l'autre
  scene.joueur_souris.mots = []; // les mots que chaque joueur porte
  scene.joueur_clavier.mots = [];
  scene.tir_desactive = true; // pas de tir dans ce niveau (voir tir.js)

  // un mot qui touche un joueur s'accroche a lui
  scene.physics.add.overlap(scene.groupe_phrases, scene.joueur_souris, function (a, b) {
    accrocher(scene, scene.joueur_souris, a.active == true && a.text != undefined ? a : b);
  });
  scene.physics.add.overlap(scene.groupe_phrases, scene.joueur_clavier, function (a, b) {
    accrocher(scene, scene.joueur_clavier, a.active == true && a.text != undefined ? a : b);
  });

  // TIMER RECURRENT : une vague toutes les 25 s (la premiere au bout de 8 s)
  scene.time.addEvent({
    delay: delai_vague,
    startAt: delai_vague - premiere_vague,
    loop: true,
    callback: function () {
      lancer_la_vague(scene);
    }
  });

  creer_les_voiles(scene);
  afficher_l_indice(scene);
}

// la vague : la sonnerie, un petit tremblement, puis les mots arrivent un par un
function lancer_la_vague(scene) {
  if (scene.phrases_actives == false || scene.est_fige() == true) {
    return;
  }
  jouer_son_sonnerie();
  scene.cameras.main.shake(400, 0.003);

  // un mot toutes les 1,8 s (un timer simple par mot)
  for (var i = 0; i < mots_par_vague; i++) {
    scene.time.delayedCall(delai_avertissement + i * delai_entre_mots, envoyer_un_mot, [scene, i], scene);
  }
}

// un mot arrive par la droite, devant le joueur le plus avance (i = son numero dans la vague)
function envoyer_un_mot(scene, i) {
  if (scene.phrases_actives == false || scene.est_fige() == true) {
    return;
  }
  var x = Math.max(scene.joueur_souris.x, scene.joueur_clavier.x) + distance_devant;
  if (x > colonne_de_fin * 16) {
    return; // trop pres de la gare
  }
  // un mot clair deux fois sur trois, un mot fonce une fois sur trois ; deux lignes qui alternent
  var est_fonce = i % 3 == 2;
  var liste = est_fonce ? fonces : clairs;
  var style = Object.assign({}, style_texte, {
    color: est_fonce ? "#000000" : "#ffffff",
    stroke: est_fonce ? "#ffffff" : "#000000",
    fontSize: est_fonce ? "7px" : "6px"
  });
  var mot = scene.add.text(x, hauteurs[i % 2], Phaser.Utils.Array.GetRandom(liste), style);
  mot.poids = est_fonce ? 2 : 1;
  mot.setOrigin(0.5, 0.5);
  mot.setDepth(15);
  scene.groupe_phrases.add(mot);
  mot.body.setSize(mot.width, mot.height);
  mot.body.setVelocity(est_fonce ? -vitesse_vague_foncee : -vitesse_vague, 0);
  mot.decalage = Phaser.Math.Between(0, 6000); // pour qu'il balance a son rythme une fois porte

  // il apparait en fondu
  mot.setAlpha(0);
  scene.tweens.add({ targets: mot, alpha: 1, duration: 400 });
}


// --- 2. Porter un mot, le lacher ----------------------------------------------

// le mot s'accroche au-dessus de la tete du joueur (sauf s'il en porte deja le maximum)
function accrocher(scene, joueur, mot) {
  if (mot.accroche == true || poids_porte(joueur) >= maximum_portes) {
    return;
  }
  mot.accroche = true;
  mot.body.enable = false;
  scene.groupe_phrases.remove(mot); // il ne flotte plus : il est porte
  mot.setOrigin(0.5, 1);
  joueur.mots.push(mot);
  jouer_son_mot_refuse(); // un "bzzz" grave : ca pese
}

// le poids que porte un joueur : 1 par mot clair, 2 par mot fonce
function poids_porte(joueur) {
  var total = 0;
  for (var i = 0; i < joueur.mots.length; i++) {
    total = total + joueur.mots[i].poids;
  }
  return total;
}

// le plus ancien mot porte s'allege : un mot fonce devient d'abord une moquerie
// legere ; un mot clair se detache, devient une phrase douce, puis s'efface
function detacher(scene, joueur, rang) {
  if (joueur.mots.length == 0) {
    return;
  }
  var mot = joueur.mots[0];
  if (mot.poids == 2) {
    mot.poids = 1;
    mot.setText(Phaser.Utils.Array.GetRandom(clairs));
    mot.setColor("#ffffff");
    mot.setStroke("#000000", 2);
    mot.setFontSize(6);
    jouer_son_mot_pose(rang);
    return;
  }
  joueur.mots.shift();
  mot.setText(Phaser.Utils.Array.GetRandom(douces));
  mot.setColor("#ffffff");
  mot.setStroke("#000000", 2);
  jouer_son_mot_pose(rang);
  scene.tweens.add({
    targets: mot,
    y: mot.y - 14,
    alpha: 0,
    duration: 900,
    onComplete: function () {
      mot.destroy();
    }
  });
}


// un joueur s'effondre : fondu au noir, le texte, puis les deux joueurs repartent de
// la derniere porte de classe passee, sans aucun mot
function s_effondrer(scene, joueur) {
  scene.effondrement = true; // fige le jeu (voir est_fige dans niveau.js)
  var camera = scene.cameras.main;
  camera.fadeOut(600, 0, 0, 0);
  camera.once("camerafadeoutcomplete", function () {
    camera.resetFX(); // le texte est un <div> par-dessus le jeu : on leve le fondu
    afficher_texte(scene, texte_effondrement, function () {
      repartir(scene, joueur);
    });
  });
}

function repartir(scene, joueur) {
  // la derniere porte de classe passee par le joueur qui s'est effondre (sinon le depart)
  var x = scene.point_depart.x;
  for (var i = 0; i < colonnes_de_reprise.length; i++) {
    if (colonnes_de_reprise[i] * 16 + 8 < joueur.x) {
      x = colonnes_de_reprise[i] * 16 + 8;
    }
  }

  // plus aucun mot : ceux qui flottent, et ceux que les joueurs portent
  var flottants = scene.groupe_phrases.getChildren().slice();
  for (var f = 0; f < flottants.length; f++) {
    flottants[f].destroy();
  }
  var joueurs = [scene.joueur_souris, scene.joueur_clavier];
  for (var j = 0; j < joueurs.length; j++) {
    while (joueurs[j].mots.length > 0) {
      joueurs[j].mots.shift().destroy();
    }
    joueurs[j].temps_au_maximum = 0;
    joueurs[j].setVelocity(0, 0);
  }
  scene.joueur_souris.setPosition(x, scene.point_depart.y);
  scene.joueur_clavier.setPosition(x + 24, scene.point_depart.y);
  scene.destination_x = null; // le joueur souris ne continue pas vers son ancienne destination
  scene.sauter_camera = true; // les cameras se placent d'un coup
  scene.temps_ensemble = 0;
  scene.cameras.main.fadeIn(500, 0, 0, 0);
  scene.time.delayedCall(100, function () {
    scene.sauter_camera = false;
    scene.effondrement = false; // le jeu repart
  }, null, scene);
}


// --- 3. Mise a jour (dans update) ----------------------------------------------

export function mettre_a_jour_phrases(scene, delta) {
  var joueurs = [scene.joueur_souris, scene.joueur_clavier];

  // chaque joueur : plus il porte de mots, plus il est lent ; ses mots flottent au-dessus de sa tete
  for (var j = 0; j < joueurs.length; j++) {
    var joueur = joueurs[j];
    joueur.facteur_vitesse = Math.max(vitesse_minimum, 1 - poids_porte(joueur) * perte_de_vitesse);
    for (var m = 0; m < joueur.mots.length; m++) {
      var balancement = Math.sin((scene.time.now + joueur.mots[m].decalage) / 500) * 1.5;
      joueur.mots[m].setPosition(joueur.x + balancement, joueur.y - 14 - m * hauteur_pile);
    }
  }

  // un joueur au poids maximum depuis trop longtemps s'effondre
  for (var e = 0; e < joueurs.length; e++) {
    if (poids_porte(joueurs[e]) >= maximum_portes) {
      joueurs[e].temps_au_maximum = joueurs[e].temps_au_maximum + delta;
    } else {
      joueurs[e].temps_au_maximum = 0;
    }
    if (joueurs[e].temps_au_maximum >= duree_avant_effondrement && scene.effondrement == false) {
      s_effondrer(scene, joueurs[e]);
    }
  }

  // les deux joueurs l'un a cote de l'autre : un mot se detache de chacun toutes les secondes
  var ecart = Phaser.Math.Distance.Between(joueurs[0].x, joueurs[0].y, joueurs[1].x, joueurs[1].y);
  if (ecart < distance_ensemble) {
    scene.temps_ensemble = scene.temps_ensemble + delta;
    if (scene.temps_ensemble >= delai_detache) {
      scene.temps_ensemble = 0;
      scene.rang_detache = (scene.rang_detache || 0) + 1;
      detacher(scene, joueurs[0], scene.rang_detache % 8);
      detacher(scene, joueurs[1], scene.rang_detache % 8);
    }
  } else {
    scene.temps_ensemble = 0;
  }

  // la gare : les deux joueurs ont depasse la zone des mots, tout s'allege
  var limite = colonne_de_fin * 16;
  if (scene.phrases_actives == true && scene.joueur_souris.x > limite && scene.joueur_clavier.x > limite) {
    scene.phrases_actives = false;
    var flottants = scene.groupe_phrases.getChildren().slice();
    for (var f = 0; f < flottants.length; f++) {
      flottants[f].destroy();
    }
    for (var k = 0; k < joueurs.length; k++) {
      while (joueurs[k].mots.length > 0) {
        joueurs[k].mots[0].poids = 1; // a la gare, tout s'allege d'un coup
        detacher(scene, joueurs[k], joueurs[k].mots.length);
      }
    }
  }

  // les mots de la vague continuent tout droit ; ceux deja loin derriere disparaissent
  var arriere = Math.min(joueurs[0].x, joueurs[1].x) - 260;
  var phrases = scene.groupe_phrases.getChildren().slice();
  for (var i = 0; i < phrases.length; i++) {
    if (phrases[i].x < arriere) {
      phrases[i].destroy();
    }
  }

  mettre_a_jour_les_voiles(scene);
}


// --- 4. Le poids se voit et s'entend : le voile sur les bords de l'ecran ----------

var id_voile_poids = "voile-poids";

// un <div> pose sur l'ecran, cache au debut
function creer_les_voiles(scene) {
  var voile = document.getElementById(id_voile_poids);
  if (voile == null) {
    voile = document.createElement("div");
    voile.id = id_voile_poids;
    voile.style.position = "absolute";
    voile.style.left = "0";
    voile.style.top = "0";
    voile.style.width = "100%";
    voile.style.height = "100%";
    voile.style.pointerEvents = "none";
    scene.game.canvas.parentElement.style.position = "relative";
    scene.game.canvas.parentElement.appendChild(voile);
  }
  voile.style.display = "none";
  scene.voile_du_poids = voile;
  scene.events.once("shutdown", function () {
    voile.style.display = "none";
    peser_sur_la_musique(0);
  });
}

// le voile suit le joueur le plus charge (il n'y a qu'un ecran)
function mettre_a_jour_les_voiles(scene) {
  var joueurs = [scene.joueur_souris, scene.joueur_clavier];
  var plus_lourd = 0;
  for (var j = 0; j < joueurs.length; j++) {
    var poids = Math.min(poids_porte(joueurs[j]) / maximum_portes, 1); // de 0 a 1
    plus_lourd = Math.max(plus_lourd, poids);
  }

  var voile = scene.voile_du_poids;
  if (plus_lourd <= 0) {
    voile.style.display = "none";
  } else {
    voile.style.display = "block";
    // le noir monte des bords vers le centre ; l'image se floute et perd son contraste
    voile.style.background = "radial-gradient(ellipse at center, rgba(0,0,0,0) " + Math.round(60 - 40 * plus_lourd) + "%, rgba(0,0,0," + (0.35 + 0.6 * plus_lourd).toFixed(2) + ") 100%)";
    voile.style.backdropFilter = "blur(" + (plus_lourd * 1.2).toFixed(1) + "px) brightness(" + (1 - 0.3 * plus_lourd).toFixed(2) + ") contrast(" + (1 - 0.35 * plus_lourd).toFixed(2) + ")";
  }

  // la musique devient plus grave (seulement si le poids a change : pas a chaque image)
  if (Math.abs(plus_lourd - (scene.poids_musique_envoye || 0)) > 0.02) {
    scene.poids_musique_envoye = plus_lourd;
    peser_sur_la_musique(plus_lourd);
  }
}


// --- 5. L'indice (un <div> HTML en haut, qui s'efface) --------------------------

function afficher_l_indice(scene) {
  var indice = document.getElementById(id_indice);
  if (indice == null) {
    indice = document.createElement("div");
    indice.id = id_indice;
    indice.style.position = "absolute";
    indice.style.top = "16px";
    indice.style.left = "50%";
    indice.style.transform = "translateX(-50%)";
    indice.style.color = "#ffffff";
    indice.style.background = "#000000";
    indice.style.padding = "6px 12px";
    indice.style.border = "2px solid #ffffff";
    indice.style.fontFamily = "DeltaruneExtended, monospace";
    indice.style.fontSize = "16px";
    indice.style.textAlign = "center";
    indice.style.pointerEvents = "none";
    indice.style.transition = "opacity 1.5s";
    scene.game.canvas.parentElement.style.position = "relative";
    scene.game.canvas.parentElement.appendChild(indice);
  }
  indice.innerHTML = "Une sonnerie, et les mots arrivent.<br>Restez l'un près de l'autre.";
  indice.style.opacity = "1";
  indice.style.display = "block";

  // il s'efface au bout de 9 s (timer simple), et disparait si la scene s'arrete
  scene.time.delayedCall(9000, function () {
    indice.style.opacity = "0";
  }, null, scene);
  scene.events.once("shutdown", function () {
    indice.style.display = "none";
  });
}
