// solo.js — le MODE SOLO : un seul personnage visible (J1, souris ET fleches). J2 existe
// toujours mais il est INVISIBLE et dirige par l'ordinateur. Il suit
// J1, et fait tout seul ses gestes de coop : se placer dans la
// gare et appuyer sur E (voir gare.js), attraper les mots qui tombent (voir dialogue.js).
// Le choix se fait dans les Reglages du menu ; il est retenu dans le navigateur.

var solo = false;
try {
  solo = window.localStorage.getItem("solo") == "1";
} catch (erreur) {
  solo = false;
}

var distance_de_suivi = 10; // px : J2 (invisible) reste tout pres de J1
var precision_cible = 4; // px : quand il a une cible precise, il s'arrete a cette precision

export function mode_solo_actif() {
  return solo;
}

export function regler_mode_solo(actif) {
  solo = actif;
  try {
    window.localStorage.setItem("solo", actif ? "1" : "0");
  } catch (erreur) {
    // tant pis : le choix ne sera pas retenu
  }
}

// Chaque image (voir niveau.js) : dit si J2 doit aller a gauche ou a droite.
// `scene.cible_j2_x` : un endroit precis ou aller (mis par la gare ou le dialogue) ;
// sinon, il suit J1.
export function direction_de_j2(scene) {
  var j2 = scene.joueur_clavier;
  var cible = scene.cible_j2_x;
  var tolerance = precision_cible;
  if (cible == undefined) {
    cible = scene.joueur_souris.x;
    tolerance = distance_de_suivi;
  }
  var ecart = cible - j2.x;
  if (ecart > tolerance) {
    return 1; // a droite
  }
  if (ecart < -tolerance) {
    return -1; // a gauche
  }
  return 0;
}
