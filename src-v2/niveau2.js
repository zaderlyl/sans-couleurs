// niveau2.js — le niveau 2 : l'enfance (la carte "map-2-enfance").
// Tout ce qui est commun a tous les niveaux est dans niveau.js. Ici : ce qui
// est propre a l'enfance, c'est-a-dire les enfants (PNJ) a qui on parle.

import niveau from "./niveau.js";
import { creer_dialogue } from "./dialogue.js";
import { creer_pnjs, mettre_a_jour_pnjs } from "./pnj.js";

export default class niveau2 extends niveau {
  constructor() {
    // la cle de la scene, et le nom de la carte Tiled
    super("niveau2", "map-2-enfance");
  }

  creer_particularites() {
    creer_dialogue(this); // les gestes sur les mots (avant les PNJ)
    creer_pnjs(this);
  }

  mettre_a_jour_particularites(temps, delta) {
    mettre_a_jour_pnjs(this);
  }
}
