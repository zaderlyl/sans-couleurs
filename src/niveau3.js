// niveau3.js — le niveau 3 : le college (la carte "map-3-college").
// Tout ce qui est commun a tous les niveaux est dans niveau.js. Ici : ce qui
// est propre au college : les phrases (voir phrases.js), les pastilles (voir
// pastilles.js : un seul ecran, un joueur sorti du cadre devient une pastille)
// et la gare du bout du couloir (le train mene au niveau 4, la fin).
//
// La carte est un long couloir de casiers (120 tuiles) : la cour avec de
// l'herbe et un nounours oublie, puis le couloir (des casiers forces, trois
// portes de classe sombres avec un ecran au-dessus), et la gare tout au bout.

import niveau from "./niveau.js";
import { creer_gare, creer_train_d_arrivee, mettre_a_jour_gare } from "./gare.js";
import { creer_phrases, mettre_a_jour_phrases } from "./phrases.js";
import { creer_pastilles, mettre_a_jour_pastilles } from "./pastilles.js";
import { pensees } from "./pensees.js";

export default class niveau3 extends niveau {
  constructor() {
    // la cle de la scene, et le nom de la carte Tiled
    super("niveau3", "map-3-college");
  }

  creer_particularites() {
    creer_pastilles(this);
    creer_phrases(this); // apres creer_tir (fait dans niveau.js)
    // le train du bout du couloir mene a la fin (arrivee: false : on n'arrive pas par CETTE gare)
    creer_gare(this, { niveau_suivant: "niveau4", sortie_active: true, arrivee: false, pensees: pensees.de_3_vers_4 });

    // on arrive du train du niveau 2 : l'ecran noir de la conversation, puis le train
    // (calque "gare_arrivee", au debut) arrive et reste la
    creer_train_d_arrivee(this, "gare_arrivee");
  }

  mettre_a_jour_particularites(temps, delta) {
    mettre_a_jour_pastilles(this);
    mettre_a_jour_phrases(this, delta);
    mettre_a_jour_gare(this);
  }
}
