// casiers_faux.js — les casiers qui ne teleportent pas "glitchent" : quand on
// passe dessus en gardant le clic enfonce, ils changent de modele.
//
// Un casier fait 2 tuiles de haut sur le calque "bg2" : une tuile du haut, une
// du bas. Dans le jeu de tuiles (tileset), il y a 8 modeles de casiers cote a
// cote ; les tuiles du haut ont les numeros 351 a 358, celles du bas 386 a 393
// (le modele 0 = 351 et 386, le modele 1 = 352 et 387, etc.).
//
// Les casiers qui servent de portail ne changent jamais (la case du portail
// est la tuile du BAS du casier). Un casier ne change qu'une fois par clic
// maintenu, sinon il clignoterait a chaque image.
//
// Comment s'en servir (dans un niveau) :
//   creer_casiers_faux(this);            // apres creer_portails
//   mettre_a_jour_casiers_faux(this);    // dans mettre_a_jour_particularites

import { point_monde } from "./ecran_separe.js";

var premier_numero_haut = 351; // le haut du modele 0
var premier_numero_bas = 386; // le bas du modele 0
var nombre_de_modeles = 8;
var modeles_de_remplacement = [2, 3, 4, 5]; // par quels modeles un casier peut etre remplace


export function creer_casiers_faux(scene) {
  scene.casiers_deja_changes = {}; // les casiers deja changes pendant ce clic maintenu
}

export function mettre_a_jour_casiers_faux(scene) {
  var souris = scene.input.activePointer;

  // clic relache : tous les casiers peuvent a nouveau changer
  if (souris.isDown == false) {
    scene.casiers_deja_changes = {};
    return;
  }
  // pas de changement en mode tir (la souris sert a viser) ni pendant un voyage
  if (scene.en_mode_tir == true || scene.portail_en_cours == true) {
    return;
  }

  // la tuile du calque "bg2" qui est sous la souris
  var point = point_monde(scene, souris.x, souris.y);
  var tuile = scene.calque_bg2.getTileAtWorldXY(point.x, point.y);
  if (tuile == null) {
    return;
  }

  // est-ce une tuile de casier ? Si oui, c'est le haut ou le bas, et de quel modele ?
  var est_le_haut = tuile.index >= premier_numero_haut && tuile.index < premier_numero_haut + nombre_de_modeles;
  var est_le_bas = tuile.index >= premier_numero_bas && tuile.index < premier_numero_bas + nombre_de_modeles;
  if (est_le_haut == false && est_le_bas == false) {
    return;
  }
  var modele_actuel;
  var rangee_bas; // la rangee de la tuile du bas : elle identifie le casier
  if (est_le_haut == true) {
    modele_actuel = tuile.index - premier_numero_haut;
    rangee_bas = tuile.y + 1;
  } else {
    modele_actuel = tuile.index - premier_numero_bas;
    rangee_bas = tuile.y;
  }

  // un casier de portail, ou deja change pendant ce clic : on n'y touche pas
  var cle = tuile.x + "," + rangee_bas;
  if (est_un_casier_de_portail(scene, tuile.x, rangee_bas) == true || scene.casiers_deja_changes[cle] == true) {
    return;
  }

  // les deux tuiles (haut et bas) doivent bien etre un casier entier du meme modele
  var haut = scene.calque_bg2.getTileAt(tuile.x, rangee_bas - 1);
  var bas = scene.calque_bg2.getTileAt(tuile.x, rangee_bas);
  if (haut == null || bas == null) {
    return;
  }
  if (haut.index != premier_numero_haut + modele_actuel || bas.index != premier_numero_bas + modele_actuel) {
    return;
  }

  // on choisit un autre modele au hasard, et on remplace les deux tuiles
  var choix = [];
  for (var i = 0; i < modeles_de_remplacement.length; i++) {
    if (modeles_de_remplacement[i] != modele_actuel) {
      choix.push(modeles_de_remplacement[i]);
    }
  }
  var nouveau = choix[Phaser.Math.Between(0, choix.length - 1)];
  scene.calque_bg2.putTileAt(premier_numero_haut + nouveau, tuile.x, rangee_bas - 1);
  scene.calque_bg2.putTileAt(premier_numero_bas + nouveau, tuile.x, rangee_bas);
  scene.casiers_deja_changes[cle] = true;
}

// true si la case (colonne, rangee) est la case d'un portail
function est_un_casier_de_portail(scene, colonne, rangee) {
  for (var i = 0; i < scene.portails.length; i++) {
    var rectangle = scene.portails[i].rectangle;
    if (rectangle.x / 16 == colonne && rectangle.y / 16 == rangee) {
      return true;
    }
  }
  return false;
}
