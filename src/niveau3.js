// niveau3.js — le niveau 3 : le college (la carte "map-3-college").
// Tout ce qui est commun a tous les niveaux est dans niveau.js. Ici : ce qui
// est propre au college : les phrases (voir phrases.js) et la gare (on y arrive
// en train, mais on ne peut pas repartir).
//
// La carte est un long couloir de casiers (120 tuiles) : la cour avec de
// l'herbe et un nounours oublie, puis le couloir (des casiers forces, trois
// portes de classe sombres avec un ecran au-dessus), et la gare tout au bout.

import niveau from "./niveau.js";
import { creer_gare, mettre_a_jour_gare } from "./gare.js";
import { creer_phrases, mettre_a_jour_phrases } from "./phrases.js";

export default class niveau3 extends niveau {
  constructor() {
    // la cle de la scene, et le nom de la carte Tiled
    super("niveau3", "map-3-college");
  }

  creer_particularites() {
    creer_phrases(this); // apres creer_tir (fait dans niveau.js)
    creer_gare(this, { niveau_suivant: null, sortie_active: false });
  }

  mettre_a_jour_particularites(temps, delta) {
    mettre_a_jour_phrases(this);
    mettre_a_jour_gare(this);
  }
}
