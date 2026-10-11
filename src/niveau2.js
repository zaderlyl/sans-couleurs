// niveau2.js — le niveau 2 : l'enfance (la carte "map-2-enfance").
// Tout ce qui est commun a tous les niveaux est dans niveau.js. Ici : ce qui
// est propre a l'enfance : les enfants (PNJ) a qui on parle, la gare (le train
// d'arrivee, et un train de depart vers le college), et les
// pastilles (un seul ecran : un joueur sorti du cadre devient une pastille).

import niveau from "./niveau.js";
import { creer_dialogue, mettre_a_jour_dialogue } from "./dialogue.js";
import { creer_pnjs, mettre_a_jour_pnjs } from "./pnj.js";
import { creer_gare, creer_train_d_arrivee, mettre_a_jour_gare } from "./gare.js";
import { pensees } from "./pensees.js";
import { creer_pastilles, mettre_a_jour_pastilles } from "./pastilles.js";

export default class niveau2 extends niveau {
  constructor() {
    // la cle de la scene, et le nom de la carte Tiled
    super("niveau2", "map-2-enfance");
  }

  creer_particularites() {
    creer_pastilles(this);
    creer_dialogue(this); // les gestes sur les mots (avant les PNJ)
    creer_pnjs(this);
    // la gare de depart (calque "gare_depart", au bout du monde) : le train mene au college
    creer_gare(this, { niveau_suivant: "niveau3", sortie_active: true, calque: "gare_depart", arrivee: false, pensees: pensees.de_2_vers_3 });
    // la gare ou on arrive (calque "gare", au debut) : le train arrive et reste la, pas de demi-tour
    creer_train_d_arrivee(this);
  }

  mettre_a_jour_particularites(temps, delta) {
    mettre_a_jour_pastilles(this);
    mettre_a_jour_dialogue(this, delta); // la recolte des mots (phase 1 d'un dialogue)
    mettre_a_jour_pnjs(this);
    mettre_a_jour_gare(this);
  }
}
