// map-4-a-definir — PLACEHOLDER : nom et contenu pas encore decides.
//
// Sert de destination provisoire au E de l'ecran de fin "glitch2" (voir
// features/glitch.js, CleCarteApresGlitch2). Le fichier Tiled est pour
// l'instant une copie de map-TEST-map1 (juste pour que le teleportation ne
// plante pas) — a remplacer par une vraie carte concue dans Tiled, avec son
// vrai nom, quand ce sera decide. Memes features que les autres en
// attendant.

import { EnregistrerCarte } from '../cartes.js';
import { Gare } from '../../features/gare.js';
import { TextesDeZone } from '../../features/textes-de-zone.js';
import { Herbe } from '../../features/herbe.js';
import { Tunnel } from '../../features/tunnel.js';
import { Teleportation } from '../../features/teleportation.js';
import { Portails } from '../../features/portails.js';
import { Glitch } from '../../features/glitch.js';
import { DialoguePNJ } from '../../features/dialogue-pnj.js';
import { Tele } from '../../features/tele.js';

EnregistrerCarte({
  cle: 'map-4-a-definir',
  numero: 4,
  nom: 'a-definir',
  // pas de carte suivante pour l'instant
  features: [Gare, TextesDeZone, Tele, Herbe, Tunnel, Teleportation, Portails, DialoguePNJ, Glitch],
});
