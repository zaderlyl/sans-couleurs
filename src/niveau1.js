// niveau1.js — le niveau 1 (la carte "map-1-debut", faite avec Tiled).
// Tout ce qui est commun a tous les niveaux est dans niveau.js. Ici, il ne
// reste que ce qui est propre au niveau 1 : le mini-tuto (des panneaux qui
// apprennent les commandes, et une cible d'entrainement pour le tir), la gare
// (le train mene au niveau 2), et les pastilles (un seul ecran : un joueur sorti
// du cadre devient une pastille).

import niveau from "./niveau.js";
import { creer_cible } from "./cibles.js";
import { creer_tuto, mettre_a_jour_tuto } from "./tuto.js";
import { creer_gare, mettre_a_jour_gare } from "./gare.js";
import { creer_pastilles, mettre_a_jour_pastilles } from "./pastilles.js";

export default class niveau1 extends niveau {
  constructor() {
    // la cle de la scene, et le nom de la carte Tiled
    super("niveau1", "map-1-debut");
  }

  creer_particularites() {
    creer_pastilles(this);
    creer_gare(this, { niveau_suivant: "niveau2", sortie_active: true });

    // la cible d'entrainement, au milieu du chemin, a hauteur du corps
    creer_cible(this, 270, 130);

    // les panneaux du tuto, le long du chemin ; le dernier est devant la gare
    creer_tuto(this, [
      { x: 90, lignes: ["Souris : clique pour marcher.", "Clavier : fleches gauche et droite."] },
      { x: 200, lignes: ["Tirer sur la cible.", "Souris : Ctrl (ou Cmd) + clic.", "Clavier : barre espace."] },
      { x: this.gare.centre_x - 110, lignes: ["Le train : la souris clique sur la gare,", "le clavier appuie sur E dans la gare.", "Il faut etre deux pour partir."] }
    ]);
  }

  mettre_a_jour_particularites(temps, delta) {
    mettre_a_jour_pastilles(this);
    mettre_a_jour_tuto(this);
    mettre_a_jour_gare(this);
  }
}
