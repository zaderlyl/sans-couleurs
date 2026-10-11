// chute.js — tomber dans le vide.
//
// Si un joueur tombe tout en bas de la carte (il n'y a plus de sol sous lui), il
// "meurt" : il devient rouge un instant, puis il est replace au point de depart
// du niveau. C'est la collision avec le BORD du monde qui le detecte.
//
// Comment ca marche (comme dans le tutoriel des bornes du monde) :
//   - setCollideWorldBounds(true) : le joueur se cogne contre les bords du monde
//     (c'est deja fait dans niveau.js) ;
//   - body.onWorldBounds = true : on demande a Phaser de nous PREVENIR quand il
//     se cogne ;
//   - on ecoute l'evenement "worldbounds" du monde : si c'est le BAS de la carte
//     qui est touche, le joueur est tombe.
//
// Comment s'en servir (dans un niveau) : creer_chute(this) dans create (niveau.js).
// La scene doit avoir this.joueur_souris, this.joueur_clavier et this.point_depart.

import { jouer_son_chute } from "./sons.js";

var delai_avant_retour = 800; // ms entre la chute et le retour au depart


export function creer_chute(scene) {
  var joueurs = [scene.joueur_souris, scene.joueur_clavier];
  for (var i = 0; i < joueurs.length; i++) {
    joueurs[i].body.onWorldBounds = true; // Phaser nous previent des collisions avec les bords
    joueurs[i].est_tombe = false; // evite de tomber plusieurs fois de suite
  }

  // l'ecouteur : corps = la hitbox qui a touche le bord ; haut, bas, gauche,
  // droite = de quel bord il s'agit
  scene.physics.world.on("worldbounds", function (corps, haut, bas, gauche, droite) {
    if (bas == false) {
      return; // seul le bord du BAS compte : on est tombe
    }
    for (var j = 0; j < joueurs.length; j++) {
      if (corps.gameObject == joueurs[j]) {
        tomber(scene, joueurs[j]);
      }
    }
  }, scene);
}

// le joueur est tombe : rouge, immobile, puis retour au depart
function tomber(scene, joueur) {
  if (joueur.est_tombe == true) {
    return;
  }
  joueur.est_tombe = true;
  joueur.setTint(0xff0000); // le personnage devient rouge
  joueur.body.setVelocity(0, 0);
  jouer_son_chute();
  if (joueur == scene.joueur_souris) {
    scene.destination_x = null; // il ne marche plus vers sa destination
    scene.apres_arrivee = null;
  }

  // un timer simple : dans 0,8 s, le joueur revient au depart
  scene.time.delayedCall(delai_avant_retour, function () {
    var decalage = 0; // le joueur clavier revient un peu a cote du joueur souris
    if (joueur == scene.joueur_clavier) {
      decalage = 24;
    }
    joueur.setPosition(scene.point_depart.x + decalage, scene.point_depart.y);
    joueur.body.setVelocity(0, 0);
    joueur.clearTint();
    joueur.est_tombe = false;

    // les cameras se placent d'un coup sur le depart (sinon elles glisseraient de loin)
    scene.sauter_camera = true;
    scene.time.delayedCall(200, function () {
      scene.sauter_camera = false;
    }, null, scene);
  }, null, scene);
}
