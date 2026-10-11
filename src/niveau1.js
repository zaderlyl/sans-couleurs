// niveau1.js — le niveau 1 (la carte "map-1-debut", faite avec Tiled).
// Tout ce qui est commun a tous les niveaux est dans niveau.js. Ici, il ne
// reste que ce qui est propre au niveau 1 : les cibles a toucher, et la gare
// (le train mene au niveau 2).

import niveau from "./niveau.js";
import { creer_cibles } from "./cibles.js";
import { creer_gare, mettre_a_jour_gare } from "./gare.js";

export default class niveau1 extends niveau {
  constructor() {
    // la cle de la scene, et le nom de la carte Tiled
    super("niveau1", "map-1-debut");
  }

  creer_particularites() {
    creer_cibles(this);
    creer_gare(this, { niveau_suivant: "niveau2", sortie_active: true });
  }

  mettre_a_jour_particularites(temps, delta) {
    mettre_a_jour_gare(this);
  }
}
