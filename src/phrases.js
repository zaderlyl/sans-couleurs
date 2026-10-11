// phrases.js — les phrases du college. Elles flottent dans le couloir, lentement,
// et pesent sur les deux joueurs. Deux sortes, que chaque joueur est SEUL a
// pouvoir effacer :
//   - les VOIX (en noir) : ce qu'on lui dit. Seuls les tirs du joueur souris les
//     effacent (elles flottent a toutes les hauteurs : il peut viser n'importe ou) ;
//   - les SILENCES (en gris) : ce qu'on ne lui dit pas. Seuls les tirs du joueur
//     clavier les effacent (elles sont a hauteur d'epaule : il tire devant lui).
// Un tir de l'autre joueur les traverse sans rien faire.
//
// Une phrase qui touche un joueur le RALENTIT (il perd de la vitesse un moment).
// Plus il y a de phrases pres des joueurs, plus la "pression" monte, et avec elle
// le glitch (voir glitch.js) : a son maximum, le joueur souris est ramene en arriere.
//
// Deux TIMERS RECURRENTS : une voix toutes les 4 s, un silence toutes les 5 s.
// Les phrases cessent quand les deux joueurs arrivent a la gare.
//
// Comment s'en servir (dans un niveau, voir niveau3.js) :
//   this.glitch_par_phrases = true;   // le glitch monte avec les phrases
//   creer_phrases(this);              // apres creer_tir
//   mettre_a_jour_phrases(this);      // dans mettre_a_jour_particularites
// et un niveau qui veut un point de reprise plus proche definit point_de_reprise().

import { style_texte } from "./styles.js";
import { jouer_son_cible } from "./sons.js";

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

var delai_voix = 4000; // ms entre deux voix (timer recurrent)
var delai_silence = 5000; // ms entre deux silences (timer recurrent)
var maximum = 10; // jamais plus de phrases que ca en meme temps
var distance_devant = [110, 170]; // les phrases apparaissent a cette distance devant un joueur
var hauteur_voix = [100, 130]; // y du monde : toutes les hauteurs, jusqu'a celle de la tete
var hauteur_silence = [130, 140]; // y du monde : a hauteur d'epaule du joueur clavier
var vitesse_derive = 6; // px/s : elles reculent tres lentement vers la gauche
var duree_ralentissement = 1500; // ms de ralentissement apres un contact
var facteur_ralenti = 0.35; // la vitesse d'un joueur ralenti (1 = normale)
var distance_pression = 130; // une phrase pese si elle est a moins de ca d'un joueur
var phrases_pour_pression_max = 6; // la pression vaut 1 avec ce nombre de phrases pres des joueurs
var colonne_de_fin = 98; // quand les deux joueurs l'ont depassee, plus de phrases

var id_indice = "indice-phrases";


// --- 1. Mise en place (dans create) ------------------------------------------

export function creer_phrases(scene) {
  scene.groupe_phrases = scene.physics.add.group({ allowGravity: false });
  scene.pression_phrases = 0; // de 0 a 1 : lue par glitch.js
  scene.phrases_actives = true;

  // une phrase qui touche un joueur le ralentit
  scene.physics.add.overlap(scene.groupe_phrases, scene.joueur_souris, function () {
    ralentir(scene, scene.joueur_souris);
  });
  scene.physics.add.overlap(scene.groupe_phrases, scene.joueur_clavier, function () {
    ralentir(scene, scene.joueur_clavier);
  });

  // un tir qui touche une phrase : il l'efface seulement si c'est le bon joueur
  scene.physics.add.overlap(scene.groupe_projectiles, scene.groupe_phrases, function (projectile, phrase) {
    if (projectile.tireur == phrase.efface_par) {
      projectile.destroy();
      effacer(scene, phrase);
    }
  });

  // TIMERS RECURRENTS : une voix, un silence, chacun a son rythme
  scene.time.addEvent({ delay: delai_voix, loop: true, callback: function () {
    faire_apparaitre(scene, voix, hauteur_voix, "#000000", "#ffffff", scene.joueur_souris);
  } });
  scene.time.addEvent({ delay: delai_silence, loop: true, callback: function () {
    faire_apparaitre(scene, silences, hauteur_silence, "#aaaaaa", "#000000", scene.joueur_clavier);
  } });

  afficher_l_indice(scene);
}

// une phrase apparait devant un des deux joueurs, au hasard
function faire_apparaitre(scene, liste, hauteur, couleur, contour, efface_par) {
  if (scene.phrases_actives == false || scene.est_fige() == true || scene.groupe_phrases.getLength() >= maximum) {
    return;
  }
  var joueur = scene.joueur_souris;
  if (Phaser.Math.Between(0, 1) == 1) {
    joueur = scene.joueur_clavier;
  }
  var x = joueur.x + Phaser.Math.Between(distance_devant[0], distance_devant[1]);
  var y = Phaser.Math.Between(hauteur[0], hauteur[1]);
  if (x > colonne_de_fin * 16) {
    return; // trop pres de la gare
  }

  var style = Object.assign({}, style_texte, { color: couleur, stroke: contour });
  var phrase = scene.add.text(x, y, Phaser.Utils.Array.GetRandom(liste), style);
  phrase.setOrigin(0.5, 0.5);
  phrase.setDepth(15);
  scene.groupe_phrases.add(phrase);
  phrase.body.setSize(phrase.width, phrase.height);
  phrase.efface_par = efface_par; // le seul joueur dont les tirs l'effacent
  phrase.decalage = Phaser.Math.Between(0, 6000); // pour que chacune flotte a son rythme

  // elle apparait en fondu
  phrase.setAlpha(0);
  scene.tweens.add({ targets: phrase, alpha: 1, duration: 500 });
}

// la phrase se brouille (des signes a la place des lettres) puis disparait
function effacer(scene, phrase) {
  if (phrase.efface == true) {
    return;
  }
  phrase.efface = true;
  phrase.body.enable = false;
  var brouille = "";
  for (var i = 0; i < phrase.text.length; i++) {
    brouille = brouille + Phaser.Utils.Array.GetRandom(["#", "/", "%", "_", "|"]);
  }
  phrase.setText(brouille);
  jouer_son_cible();
  scene.tweens.add({
    targets: phrase,
    alpha: 0,
    scale: 1.3,
    duration: 320,
    onComplete: function () {
      phrase.destroy();
    }
  });
}

function ralentir(scene, joueur) {
  joueur.ralenti_jusqua = scene.time.now + duree_ralentissement;
}


// --- 2. Mise a jour (dans update) ----------------------------------------------

export function mettre_a_jour_phrases(scene) {
  var joueurs = [scene.joueur_souris, scene.joueur_clavier];

  // chaque joueur : ralenti (et un peu transparent) jusqu'a la fin du ralentissement
  for (var j = 0; j < joueurs.length; j++) {
    var ralenti = joueurs[j].ralenti_jusqua != undefined && joueurs[j].ralenti_jusqua > scene.time.now;
    joueurs[j].facteur_vitesse = ralenti ? facteur_ralenti : 1;
    joueurs[j].setAlpha(ralenti ? 0.6 : 1);
  }

  // fin du niveau : les deux joueurs ont depasse la zone des phrases
  var limite = colonne_de_fin * 16;
  if (scene.phrases_actives == true && scene.joueur_souris.x > limite && scene.joueur_clavier.x > limite) {
    scene.phrases_actives = false;
    var restantes = scene.groupe_phrases.getChildren().slice();
    for (var r = 0; r < restantes.length; r++) {
      effacer(scene, restantes[r]);
    }
  }

  // chaque phrase flotte : elle recule doucement et monte / descend lentement
  var phrases = scene.groupe_phrases.getChildren();
  var pesent = 0; // combien de phrases sont pres d'un joueur
  for (var i = 0; i < phrases.length; i++) {
    var phrase = phrases[i];
    if (phrase.efface == true) {
      continue;
    }
    phrase.body.setVelocity(-vitesse_derive, Math.cos((scene.time.now + phrase.decalage) / 700) * 5);
    var pres = Phaser.Math.Distance.Between(phrase.x, phrase.y, scene.joueur_souris.x, scene.joueur_souris.y) < distance_pression ||
               Phaser.Math.Distance.Between(phrase.x, phrase.y, scene.joueur_clavier.x, scene.joueur_clavier.y) < distance_pression;
    if (pres == true) {
      pesent = pesent + 1;
    }
  }
  scene.pression_phrases = Math.min(pesent / phrases_pour_pression_max, 1);
}


// --- 3. L'indice (un <div> HTML en haut, qui s'efface) --------------------------

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
  indice.innerHTML = "Souris : Ctrl + clic efface les voix<br>Clavier : Espace efface les silences";
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
