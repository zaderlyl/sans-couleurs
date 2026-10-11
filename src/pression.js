// pression.js — la PRESSION qui s'accumule dans le niveau 5 (le lycee).
//
// Chaque coup (voir niveau5.js) fait monter la pression. On la VOIT (un voile noir
// et flou qui s'epaissit sur les bords de l'ecran) et on l'ENTEND (la musique
// ralentit, devient plus grave). Elle redescend doucement quand les deux joueurs
// restent l'un a cote de l'autre (J2 est la part de lui qui l'aide a avancer),
// mais jamais jusqu'a zero : il reste des sequelles, qui augmentent a chaque coup.
//
// Comment s'en servir :
//   creer_pression(scene);                  // dans create
//   mettre_a_jour_pression(scene, delta);   // dans update
//   ajouter_pression(scene, 0.2);           // quand un coup est recu

import { peser_sur_la_musique } from "./sons.js";

var duree_de_descente = 12000; // ms pour perdre toute la pression "oubliable" quand on est ensemble
var distance_ensemble = 40; // pixels : "l'un a cote de l'autre"
var part_qui_reste = 0.4; // quelle part de chaque coup ne s'oublie jamais (les sequelles)
var id_voile = "voile-pression";


export function creer_pression(scene) {
  scene.pression_en_cours = 0; // la partie qui peut redescendre
  scene.pression_qui_reste = 0; // les sequelles : elle ne redescend jamais
  var voile = document.getElementById(id_voile);
  if (voile == null) {
    voile = document.createElement("div");
    voile.id = id_voile;
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
  scene.voile_de_pression = voile;
  scene.events.once("shutdown", function () {
    voile.style.display = "none";
    peser_sur_la_musique(0);
  });
}

// un coup : la pression monte (dont une part qui reste pour toujours)
export function ajouter_pression(scene, valeur) {
  scene.pression_qui_reste = Math.min(0.6, scene.pression_qui_reste + valeur * part_qui_reste);
  scene.pression_en_cours = Math.min(1 - scene.pression_qui_reste, scene.pression_en_cours + valeur * (1 - part_qui_reste));
}

// la pression totale, de 0 a 1
export function pression_totale(scene) {
  return Math.min(1, scene.pression_en_cours + scene.pression_qui_reste);
}

export function mettre_a_jour_pression(scene, delta) {
  // les deux joueurs l'un a cote de l'autre : la pression qui peut redescendre redescend
  var ecart = Phaser.Math.Distance.Between(scene.joueur_souris.x, scene.joueur_souris.y, scene.joueur_clavier.x, scene.joueur_clavier.y);
  if (ecart < distance_ensemble) {
    scene.pression_en_cours = Math.max(0, scene.pression_en_cours - delta / duree_de_descente);
  }

  // le joueur souris est ralenti par la pression (le joueur clavier aussi, un peu moins)
  var p = pression_totale(scene);
  scene.joueur_souris.facteur_vitesse = 1 - 0.55 * p;
  scene.joueur_clavier.facteur_vitesse = 1 - 0.35 * p;

  // le voile (flou, sombre sur les bords) et la musique plus grave
  var voile = scene.voile_de_pression;
  if (p <= 0.01) {
    voile.style.display = "none";
  } else {
    voile.style.display = "block";
    voile.style.background = "radial-gradient(ellipse at center, rgba(0,0,0,0) " + Math.round(62 - 42 * p) + "%, rgba(0,0,0," + (0.3 + 0.65 * p).toFixed(2) + ") 100%)";
    voile.style.backdropFilter = "blur(" + (p * 1.4).toFixed(1) + "px) brightness(" + (1 - 0.3 * p).toFixed(2) + ") contrast(" + (1 - 0.35 * p).toFixed(2) + ")";
  }
  if (Math.abs(p - (scene.pression_musique_envoyee || 0)) > 0.02) {
    scene.pression_musique_envoyee = p;
    peser_sur_la_musique(p);
  }
}
