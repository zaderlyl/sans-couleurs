// niveau3.js — le niveau 3 : le college (la carte "map-3-debut-college").
// Tout ce qui est commun a tous les niveaux est dans niveau.js. Ici : ce qui
// est propre au college : les portails et les faux casiers.

import niveau from "./niveau.js";
import { creer_portails, mettre_a_jour_portails } from "./portails.js";
import { creer_casiers_faux, mettre_a_jour_casiers_faux } from "./casiers_faux.js";

// Les portails du college : chaque ligne est une paire de cases reliees (un
// portail de A vers B, et de B vers A). colonne / rangee = la position de la
// case dans la carte Tiled (une tuile fait 16 pixels).
var portails_du_college = [
  { colonne_a: 24, rangee_a: 8, colonne_b: 46, rangee_b: 18 },
  { colonne_a: 39, rangee_a: 18, colonne_b: 68, rangee_b: 18 },
  { colonne_a: 76, rangee_a: 18, colonne_b: 7, rangee_b: 18 },
  { colonne_a: 16, rangee_a: 18, colonne_b: 95, rangee_b: 18 },
  { colonne_a: 89, rangee_a: 18, colonne_b: 59, rangee_b: 8 },
  { colonne_a: 42, rangee_a: 18, colonne_b: 2, rangee_b: 18 },
  { colonne_a: 0, rangee_a: 18, colonne_b: 12, rangee_b: 8 },
  { colonne_a: 12, rangee_a: 18, colonne_b: 40, rangee_b: 18 },
  { colonne_a: 64, rangee_a: 18, colonne_b: 33, rangee_b: 18 },
  { colonne_a: 41, rangee_a: 8, colonne_b: 93, rangee_b: 18 },
  { colonne_a: 8, rangee_a: 18, colonne_b: 45, rangee_b: 8 }
];

export default class niveau3 extends niveau {
  constructor() {
    // la cle de la scene, et le nom de la carte Tiled
    super("niveau3", "map-3-debut-college");
  }

  creer_particularites() {
    creer_portails(this, portails_du_college);
    creer_casiers_faux(this); // apres les portails : les casiers de portail ne changent pas
  }

  mettre_a_jour_particularites(temps, delta) {
    mettre_a_jour_portails(this);
    mettre_a_jour_casiers_faux(this);
  }
}
