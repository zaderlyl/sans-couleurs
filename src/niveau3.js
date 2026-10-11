// niveau3.js — le niveau 3 : le college (la carte "map-3-college").
// Tout ce qui est commun a tous les niveaux est dans niveau.js. Ici : ce qui
// est propre au college : le glitch (le bruit de pixels de couleur) et la gare
// (on y arrive en train, mais on ne peut pas repartir).
//
// La carte est un long couloir de casiers (120 tuiles) : la cour avec de
// l'herbe, puis le couloir, avec des trous dans le mur (les portes de classe),
// et la gare tout au bout.

import niveau from "./niveau.js";
import { creer_gare, mettre_a_jour_gare } from "./gare.js";
import { creer_glitch, mettre_a_jour_glitch } from "./glitch.js";
import { creer_phrases, mettre_a_jour_phrases } from "./phrases.js";

// les colonnes des trous dans le mur (les portes de classe) : si le glitch frappe,
// le joueur souris est ramene au dernier trou qu'il a passe (ou au depart)
var colonnes_de_reprise = [40, 66, 92];

export default class niveau3 extends niveau {
  constructor() {
    // la cle de la scene, et le nom de la carte Tiled
    super("niveau3", "map-3-college");
  }

  creer_particularites() {
    this.glitch_par_phrases = true; // le glitch monte avec les phrases (voir phrases.js)
    creer_phrases(this); // apres creer_tir (fait dans niveau.js)
    creer_gare(this, { niveau_suivant: null, sortie_active: false });
    creer_glitch(this); // le glitch (ici il monte avec les phrases, pas avec des zones)
  }

  mettre_a_jour_particularites(temps, delta) {
    mettre_a_jour_phrases(this);
    mettre_a_jour_gare(this);
    mettre_a_jour_glitch(this, delta);
  }

  // appelee par glitch.js quand le glitch frappe : le dernier trou passe, sinon le depart
  point_de_reprise() {
    var reprise = this.point_depart;
    for (var i = 0; i < colonnes_de_reprise.length; i++) {
      var x = colonnes_de_reprise[i] * 16 + 8;
      if (x < this.joueur_souris.x) {
        reprise = { x: x, y: this.point_depart.y };
      }
    }
    return reprise;
  }
}
