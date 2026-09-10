// map-3-debut-college — le college.
// Memes features que les autres cartes, SAUF Gare : l'animation du train
// (arrivee / depart) n'est pas encore prete. A rajouter ici quand ce sera fait :
//   import { Gare } from '../../features/gare.js';
//   ... features: [Gare, TextesDeZone, ...]
// Le reste (musique d'ambiance, camera, controles, personnage) tourne
// globalement dans scene-jeu.js pour toute carte enregistree : rien a ajouter.

import { EnregistrerCarte } from '../cartes.js';
import { TextesDeZone } from '../../features/textes-de-zone.js';
import { Herbe } from '../../features/herbe.js';
import { Tunnel } from '../../features/tunnel.js';
import { DialoguePNJ } from '../../features/dialogue-pnj.js';

EnregistrerCarte({
  cle: 'map-3-debut-college',
  numero: 3,
  nom: 'debut-college',
  // suivante: a definir quand l'enchainement des niveaux sera decide
  features: [TextesDeZone, Herbe, Tunnel, DialoguePNJ],
});
