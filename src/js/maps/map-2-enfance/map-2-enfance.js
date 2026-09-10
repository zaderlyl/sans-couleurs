// map-2-enfance — deuxieme carte (on y arrive en train depuis map-1-debut).

import { EnregistrerCarte } from '../cartes.js';
import { Gare } from '../../features/gare.js';
import { TextesDeZone } from '../../features/textes-de-zone.js';
import { Herbe } from '../../features/herbe.js';
import { Tunnel } from '../../features/tunnel.js';
import { DialoguePNJ } from '../../features/dialogue-pnj.js';

EnregistrerCarte({
  cle: 'map-2-enfance',
  numero: 2,
  nom: 'enfance',
  // pas de carte suivante pour l'instant
  features: [Gare, TextesDeZone, Herbe, Tunnel, DialoguePNJ],
});
