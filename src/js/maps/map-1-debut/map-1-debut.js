// map-1-debut — premiere carte du jeu (le point de depart).

import { EnregistrerCarte } from '../cartes.js';
import { Gare } from '../../features/gare.js';
import { TextesDeZone } from '../../features/textes-de-zone.js';
import { Herbe } from '../../features/herbe.js';
import { Tunnel } from '../../features/tunnel.js';
import { Teleportation } from '../../features/teleportation.js';
import { Portails } from '../../features/portails.js';
import { DialoguePNJ } from '../../features/dialogue-pnj.js';

EnregistrerCarte({
  cle: 'map-1-debut',
  numero: 1,
  nom: 'debut',
  depart: true,               // ouverte au lancement, sauf ?carte=<autre>
  suivante: 'map-2-enfance',   // le train mene a enfance
  features: [Gare, TextesDeZone, Herbe, Tunnel, Teleportation, Portails, DialoguePNJ],
});
