// phrases.js — les mots du college. Ils arrivent par VAGUES, comme la sonnerie :
// toutes les 25 secondes, une cloche sonne, puis une vague de mots traverse le
// couloir, UN MOT APRES L'AUTRE (pour qu'on lise chacun) ; entre deux vagues, c'est calme. On ne peut PAS les effacer : un mot qui touche un joueur s'accroche au-dessus de sa
// tete et reste. Chaque mot accroche le ralentit un peu plus, jusqu'a ce qu'il
// n'avance presque plus.
//
// Ce qui les fait partir : l'AUTRE joueur. Quand les deux joueurs restent l'un a
// cote de l'autre, les mots se detachent un par un (chaque joueur en perd un a
// chaque fois), et en partant un mot se change en une phrase plus douce.
// Seul, le poids s'accumule. A deux, il s'allege. Il n'y a ni tir ni ennemi.
//
// Deux sortes de mots : les VOIX (en noir : ce qu'on lui dit) et les SILENCES (en
// gris : ce qu'on ne lui dit pas). Elles pesent pareil.
//
// Plus un joueur porte de mots, plus SON ecran s'assombrit sur les bords (un
// voile noir, flou et sans contraste) et plus la musique devient grave : le poids
// se ressent sans texte.
//
// Un TIMER RECURRENT lance la vague toutes les 25 s. Les mots cessent (et tout
// s'allege) quand les deux joueurs arrivent a la gare.
//
// Comment s'en servir (dans un niveau, voir niveau3.js) :
//   creer_phrases(this);                    // apres creer_tir
//   mettre_a_jour_phrases(this, delta);     // dans mettre_a_jour_particularites

import { style_texte } from "./styles.js";
import { camera_du_joueur } from "./ecran_separe.js";
import { jouer_son_mot_refuse, jouer_son_mot_pose, jouer_son_sonnerie, peser_sur_la_musique } from "./sons.js";

var voix = [
  "Pourquoi tu es comme ça ?",
  "Tu fais exprès.",
  "T'es bizarre, quand même.",
  "Personne n'a demandé ton avis.",
  "Encore toi."
];
var silences = [
  "...",
  "Cette place est prise.",
  "On ne t'a pas attendu.",
  "Tout le monde a compris, sauf toi.",
  "Personne ne se retourne."
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
var vitesse_vague = 36; // px/s : les mots avancent vers la gauche
var maximum_portes = 6; // un joueur ne porte jamais plus de mots que ca
var perte_de_vitesse = 0.16; // chaque mot porte retire ca a la vitesse (1 = normale)
var vitesse_minimum = 0.1; // il avance toujours un peu : jamais bloque pour de bon
var distance_ensemble = 40; // pixels : "l'un a cote de l'autre"
var delai_detache = 1000; // ms entre deux mots qui se detachent quand on est ensemble
var hauteur_pile = 7; // pixels entre deux mots empiles au-dessus de la tete
var colonne_de_fin = 98; // quand les deux joueurs l'ont depassee, plus de mots

var id_indice = "indice-phrases";


// --- 1. Mise en place (dans create) ------------------------------------------

export function creer_phrases(scene) {
  scene.groupe_phrases = scene.physics.add.group({ allowGravity: false }); // les mots qui flottent
  scene.phrases_actives = true;
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
  scene.camera2.shake(400, 0.003);

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
  // une voix, puis un silence, puis une voix... sur deux lignes qui alternent
  var est_une_voix = i % 2 == 0;
  var liste = est_une_voix ? voix : silences;
  var style = Object.assign({}, style_texte, { color: est_une_voix ? "#000000" : "#aaaaaa", stroke: est_une_voix ? "#ffffff" : "#000000" });
  var mot = scene.add.text(x, est_une_voix ? hauteurs[0] : hauteurs[1], Phaser.Utils.Array.GetRandom(liste), style);
  mot.setOrigin(0.5, 0.5);
  mot.setDepth(15);
  scene.groupe_phrases.add(mot);
  mot.body.setSize(mot.width, mot.height);
  mot.body.setVelocity(-vitesse_vague, 0);
  mot.decalage = Phaser.Math.Between(0, 6000); // pour qu'il balance a son rythme une fois porte

  // il apparait en fondu
  mot.setAlpha(0);
  scene.tweens.add({ targets: mot, alpha: 1, duration: 400 });
}


// --- 2. Porter un mot, le lacher ----------------------------------------------

// le mot s'accroche au-dessus de la tete du joueur (sauf s'il en porte deja le maximum)
function accrocher(scene, joueur, mot) {
  if (mot.accroche == true || joueur.mots.length >= maximum_portes) {
    return;
  }
  mot.accroche = true;
  mot.body.enable = false;
  scene.groupe_phrases.remove(mot); // il ne flotte plus : il est porte
  mot.setOrigin(0.5, 1);
  joueur.mots.push(mot);
  jouer_son_mot_refuse(); // un "bzzz" grave : ca pese
}

// le plus ancien mot porte se detache : il devient une phrase douce, puis s'efface
function detacher(scene, joueur, rang) {
  if (joueur.mots.length == 0) {
    return;
  }
  var mot = joueur.mots.shift();
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


// --- 3. Mise a jour (dans update) ----------------------------------------------

export function mettre_a_jour_phrases(scene, delta) {
  var joueurs = [scene.joueur_souris, scene.joueur_clavier];

  // chaque joueur : plus il porte de mots, plus il est lent ; ses mots flottent au-dessus de sa tete
  for (var j = 0; j < joueurs.length; j++) {
    var joueur = joueurs[j];
    joueur.facteur_vitesse = Math.max(vitesse_minimum, 1 - joueur.mots.length * perte_de_vitesse);
    for (var m = 0; m < joueur.mots.length; m++) {
      var balancement = Math.sin((scene.time.now + joueur.mots[m].decalage) / 500) * 1.5;
      joueur.mots[m].setPosition(joueur.x + balancement, joueur.y - 14 - m * hauteur_pile);
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

var id_voile_poids = "voile-poids-";

// un <div> par camera (celle du joueur souris, celle du joueur clavier), cache au debut
function creer_les_voiles(scene) {
  scene.voiles_du_poids = [];
  for (var i = 0; i < 2; i++) {
    var voile = document.getElementById(id_voile_poids + i);
    if (voile == null) {
      voile = document.createElement("div");
      voile.id = id_voile_poids + i;
      voile.style.position = "absolute";
      voile.style.pointerEvents = "none";
      scene.game.canvas.parentElement.style.position = "relative";
      scene.game.canvas.parentElement.appendChild(voile);
    }
    voile.style.display = "none";
    scene.voiles_du_poids.push(voile);
  }
  scene.events.once("shutdown", function () {
    scene.voiles_du_poids[0].style.display = "none";
    scene.voiles_du_poids[1].style.display = "none";
    peser_sur_la_musique(0);
  });
}

function mettre_a_jour_les_voiles(scene) {
  var joueurs = [scene.joueur_souris, scene.joueur_clavier];
  var poids_camera = [0, 0]; // [camera principale, camera 2] : le poids du joueur qu'elle montre
  var cameras = [scene.cameras.main, scene.camera2];
  var plus_lourd = 0;
  for (var j = 0; j < joueurs.length; j++) {
    var poids = joueurs[j].mots.length / maximum_portes; // de 0 a 1
    var indice = camera_du_joueur(scene, joueurs[j]) == scene.camera2 ? 1 : 0;
    poids_camera[indice] = Math.max(poids_camera[indice], poids);
    plus_lourd = Math.max(plus_lourd, poids);
  }

  for (var i = 0; i < 2; i++) {
    var voile = scene.voiles_du_poids[i];
    var p = poids_camera[i];
    if (p <= 0 || cameras[i].visible == false) {
      voile.style.display = "none";
      continue;
    }
    voile.style.display = "block";
    voile.style.left = cameras[i].x + "px";
    voile.style.top = cameras[i].y + "px";
    voile.style.width = cameras[i].width + "px";
    voile.style.height = cameras[i].height + "px";
    // le noir monte des bords vers le centre ; l'image se floute et perd son contraste
    voile.style.background = "radial-gradient(ellipse at center, rgba(0,0,0,0) " + Math.round(60 - 40 * p) + "%, rgba(0,0,0," + (0.35 + 0.6 * p).toFixed(2) + ") 100%)";
    voile.style.backdropFilter = "blur(" + (p * 1.2).toFixed(1) + "px) brightness(" + (1 - 0.3 * p).toFixed(2) + ") contrast(" + (1 - 0.35 * p).toFixed(2) + ")";
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
