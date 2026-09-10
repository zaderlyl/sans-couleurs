// map-3-debut-college — le college.
// Calques standard (gare mais pas de "derriere" : le train change de carte).

import { EnregistrerCarte } from '../cartes.js';
import { Gare } from '../../features/gare.js';
import { TextesDeZone } from '../../features/textes-de-zone.js';
import { Herbe } from '../../features/herbe.js';
import { Tunnel } from '../../features/tunnel.js';
import { DialoguePNJ } from '../../features/dialogue-pnj.js';

EnregistrerCarte({
  cle: 'map-3-debut-college',
  numero: 3,
  nom: 'debut-college',
  // suivante: a definir quand l'enchainement des niveaux sera decide
  features: [Gare, TextesDeZone, Herbe, Tunnel, DialoguePNJ],
});
