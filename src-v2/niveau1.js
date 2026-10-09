// niveau1.js — le niveau 1 (la carte "map-1-debut", faite avec Tiled).
// Tout ce qui est commun a tous les niveaux est dans niveau.js. Ici, il ne
// reste que ce qui est propre au niveau 1 : les cibles a toucher.

import niveau from "./niveau.js";
import { creer_cibles } from "./cibles.js";

export default class niveau1 extends niveau {
  constructor() {
    // la cle de la scene, et le nom de la carte Tiled
    super("niveau1", "map-1-debut");
  }

  creer_particularites() {
    creer_cibles(this);
  }
}
