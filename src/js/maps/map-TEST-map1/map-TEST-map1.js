// map-TEST-map1 — carte de test (la toute premiere, prototype).
// Seule carte a porter l'ecran de tele.
//
// L'ordre du tableau `features` = ordre d'installation : mettre en premier ce
// qui doit s'afficher derriere (la tele n'a pas de depth forcee, elle doit
// etre creee avant l'herbe).

import { EnregistrerCarte } from '../cartes.js';
import { Gare } from '../../features/gare.js';
import { TextesDeZone } from '../../features/textes-de-zone.js';
import { Herbe } from '../../features/herbe.js';
import { Tunnel } from '../../features/tunnel.js';
import { DialoguePNJ } from '../../features/dialogue-pnj.js';
import { Tele } from '../../features/tele.js';

EnregistrerCarte({
  cle: 'map-TEST-map1',
  numero: 'TEST',
  nom: 'map1',
  // pas de carte suivante
  features: [Gare, TextesDeZone, Tele, Herbe, Tunnel, DialoguePNJ],
});
