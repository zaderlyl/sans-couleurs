// map-2-enfance — deuxieme carte (on y arrive en train depuis map-1-debut).

import { EnregistrerCarte } from '../cartes.js';
import { Gare } from '../../features/gare.js';
import { TextesDeZone } from '../../features/textes-de-zone.js';
import { Herbe } from '../../features/herbe.js';
import { Tunnel } from '../../features/tunnel.js';
import { Teleportation } from '../../features/teleportation.js';
import { Portails } from '../../features/portails.js';
import { DialoguePNJ } from '../../features/dialogue-pnj.js';

EnregistrerCarte({
  cle: 'map-2-enfance',
  numero: 2,
  nom: 'enfance',
  // pas de carte suivante en train pour l'instant
  // Passage vers le college : le joueur marche jusqu'a la case (51, 9).
  teleportations: [
    { colonne: 51, rangee: 9, versCarte: 'map-3-debut-college', arrivee: true },
  ],
  features: [Gare, TextesDeZone, Herbe, Tunnel, Teleportation, Portails, DialoguePNJ],
});
