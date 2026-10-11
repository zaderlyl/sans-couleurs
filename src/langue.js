// langue.js — la langue du jeu (francais par defaut, ou anglais). Le choix est
// retenu dans le navigateur (localStorage) et la page se recharge quand on le
// change : ainsi toutes les phrases sont lues dans la bonne langue des le depart.
//
// Pour traduire un texte, on l'ecrit en francais dans le code et on l'entoure :
//   t("Le train quitte la gare.")
// En anglais, t() cherche cette phrase dans traductions.js ; si elle n'y est pas,
// le texte francais reste tel quel.

import { traductions } from "./traductions.js";

var langue = "fr";
try {
  if (window.localStorage.getItem("langue") == "en") {
    langue = "en";
  }
} catch (erreur) {
  langue = "fr"; // pas de stockage disponible : on reste en francais
}
document.documentElement.lang = langue;

// "fr" ou "en"
export function lire_langue() {
  return langue;
}

// change la langue et recharge la page
export function choisir_langue(nouvelle) {
  try {
    window.localStorage.setItem("langue", nouvelle);
  } catch (erreur) {
    // tant pis : la page se rechargera dans la langue actuelle
  }
  window.location.reload();
}

// le texte dans la langue choisie
export function t(texte) {
  if (langue == "en" && traductions[texte] != undefined) {
    return traductions[texte];
  }
  return texte;
}
