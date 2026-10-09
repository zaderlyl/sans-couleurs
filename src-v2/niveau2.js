// niveau2.js — le niveau 2 : l'enfance (la carte "map-2-enfance").
// Tout ce qui est commun a tous les niveaux est dans niveau.js. Ici : ce qui
// est propre a l'enfance : les enfants (PNJ) a qui on parle, la gare (le train
// ne mene nulle part pour l'instant), et un passage vers le college.

import niveau from "./niveau.js";
import { creer_dialogue } from "./dialogue.js";
import { creer_pnjs, mettre_a_jour_pnjs } from "./pnj.js";
import { creer_gare, mettre_a_jour_gare } from "./gare.js";
import { creer_passages, mettre_a_jour_passages } from "./passage.js";

export default class niveau2 extends niveau {
  constructor() {
    // la cle de la scene, et le nom de la carte Tiled
    super("niveau2", "map-2-enfance");
  }

  creer_particularites() {
    creer_dialogue(this); // les gestes sur les mots (avant les PNJ)
    creer_pnjs(this);
    creer_gare(this, { niveau_suivant: null, sortie_active: true });
    // la case (51, 9) mene au college
    creer_passages(this, [{ colonne: 51, rangee: 9, vers: "niveau3" }]);
  }

  mettre_a_jour_particularites(temps, delta) {
    mettre_a_jour_pnjs(this);
    mettre_a_jour_gare(this);
    mettre_a_jour_passages(this);
  }
}
