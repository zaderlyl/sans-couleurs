// cibles.js — des taches grises a toucher avec les projectiles.
//
// Une tache touchee reprend la couleur du projectile, puis disparait : on a
// "rendu une couleur" au monde. Le compteur en haut a gauche dit combien de
// couleurs sont rendues (un petit texte HTML pose sur le jeu).
//
// Deux TIMERS (voir le tutoriel des timers) :
//   - un timer SIMPLE : les taches n'apparaissent que 1,5 s apres le debut du
//     niveau (this.time.delayedCall) ;
//   - un timer RECURRENT : toutes les 8 s, le gris reprend du terrain : une
//     tache deja effacee reapparait, et le compteur baisse d'un
//     (this.time.addEvent avec loop: true).
//
// Comment s'en servir :
//   dans preload() : this.load.image("img_cible", "assets/sprites/props/cible.png");
//   dans create()  : creer_cibles(this);   (apres creer_tir)

import { jouer_son_cible } from "./sons.js";

// Ou poser les cibles : x, y du monde (la carte fait 16 pixels par tuile).
// Pour en ajouter ou en deplacer, il suffit de changer cette liste.
var positions_cibles = [
  { x: 200, y: 100 },
  { x: 300, y: 112 },
  { x: 420, y: 90 },
  { x: 520, y: 118 },
  { x: 640, y: 100 }
];

var delai_apparition = 1500; // ms avant l'apparition des taches (timer simple)
var delai_retour_du_gris = 8000; // ms entre deux retours du gris (timer recurrent)

var id_compteur = "compteur-cibles";


export function creer_cibles(scene) {
  scene.groupe_cibles = scene.physics.add.staticGroup(); // des objets immobiles
  scene.cibles_touchees = 0; // combien de couleurs sont rendues
  // une case par position : la cible qui y est, ou null si elle a ete touchee
  scene.cible_a_la_position = [];
  for (var i = 0; i < positions_cibles.length; i++) {
    scene.cible_a_la_position.push(null);
  }

  creer_le_compteur(scene);
  afficher_compteur(scene);

  // un projectile qui chevauche une cible : on appelle toucher_cible
  scene.physics.add.overlap(scene.groupe_projectiles, scene.groupe_cibles, function (projectile, cible) {
    toucher_cible(scene, projectile, cible);
  });

  // TIMER SIMPLE : dans 1,5 s, toutes les taches apparaissent
  scene.time.delayedCall(delai_apparition, function () {
    for (var j = 0; j < positions_cibles.length; j++) {
      faire_apparaitre_une_cible(scene, j);
    }
  }, null, scene);

  // TIMER RECURRENT : toutes les 8 s, le gris revient
  scene.time.addEvent({
    delay: delai_retour_du_gris,
    callback: le_gris_revient,
    callbackScope: scene,
    loop: true // pour toujours
  });
}

// fait apparaitre la cible n° `indice` (elle grandit de rien, petit "pop")
function faire_apparaitre_une_cible(scene, indice) {
  var cible = scene.groupe_cibles.create(positions_cibles[indice].x, positions_cibles[indice].y, "img_cible");
  cible.indice = indice;
  scene.cible_a_la_position[indice] = cible;
  cible.setScale(0);
  scene.tweens.add({ targets: cible, scale: 1, duration: 300, ease: "Back.easeOut" });
}

// appelee toutes les 8 s : une tache effacee reapparait au hasard
function le_gris_revient() {
  var scene = this; // callbackScope: scene
  // les positions ou il n'y a plus de cible
  var libres = [];
  for (var i = 0; i < scene.cible_a_la_position.length; i++) {
    if (scene.cible_a_la_position[i] == null) {
      libres.push(i);
    }
  }
  // aucune cible n'a ete touchee (ou elles ne sont pas encore apparues) : rien a faire
  if (libres.length == 0 || scene.cibles_touchees == 0) {
    return;
  }
  faire_apparaitre_une_cible(scene, Phaser.Utils.Array.GetRandom(libres));
  scene.cibles_touchees = scene.cibles_touchees - 1;
  afficher_compteur(scene);
}

// un projectile touche une cible
function toucher_cible(scene, projectile, cible) {
  cible.body.enable = false; // elle ne peut plus etre touchee
  scene.cible_a_la_position[cible.indice] = null;
  cible.setTint(projectile.couleur); // elle prend la couleur du projectile...
  projectile.destroy();
  jouer_son_cible();

  // ... puis elle grossit un peu en s'effacant, et disparait
  scene.tweens.add({
    targets: cible,
    scale: 1.4,
    alpha: 0,
    duration: 600,
    onComplete: function () {
      cible.destroy();
    }
  });

  scene.cibles_touchees = scene.cibles_touchees + 1;
  afficher_compteur(scene);
}


// --- Le compteur (un <div> HTML en haut a gauche) -------------------------------------

function creer_le_compteur(scene) {
  var compteur = document.getElementById(id_compteur);
  if (compteur == null) {
    compteur = document.createElement("div");
    compteur.id = id_compteur;
    compteur.style.position = "absolute";
    compteur.style.top = "16px";
    compteur.style.left = "20px";
    compteur.style.color = "#000000";
    compteur.style.background = "#ffffff";
    compteur.style.padding = "4px 10px";
    compteur.style.border = "2px solid #000000";
    compteur.style.fontFamily = "DeltaruneExtended, monospace";
    compteur.style.fontSize = "20px";
    compteur.style.pointerEvents = "none"; // ne bloque pas les clics
    scene.game.canvas.parentElement.style.position = "relative";
    scene.game.canvas.parentElement.appendChild(compteur);
  }
  compteur.style.display = "block";

  // quand la scene s'arrete, on cache le compteur
  scene.events.once("shutdown", function () {
    compteur.style.display = "none";
  });
}

function afficher_compteur(scene) {
  var texte = "Couleurs rendues : " + scene.cibles_touchees + " / " + positions_cibles.length;
  if (scene.cibles_touchees == positions_cibles.length) {
    texte = "Toutes les couleurs sont revenues !";
  }
  document.getElementById(id_compteur).textContent = texte;
}
