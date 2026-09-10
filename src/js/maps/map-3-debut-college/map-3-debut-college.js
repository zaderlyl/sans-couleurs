// map-3-debut-college — le college.
// Memes features que les autres cartes. La gare est presente mais en
// "entree seule" : on arrive en train (animation d'arrivee), on ne peut
// pas repartir -> `sortieGare: false` (voir features/gare.js).
// Musique d'ambiance, camera, controles et personnage tournent
// globalement dans scene-jeu.js pour toute carte enregistree.

import { EnregistrerCarte } from '../cartes.js';
import { Gare } from '../../features/gare.js';
import { TextesDeZone } from '../../features/textes-de-zone.js';
import { Herbe } from '../../features/herbe.js';
import { Tunnel } from '../../features/tunnel.js';
import { Teleportation } from '../../features/teleportation.js';
import { DialoguePNJ } from '../../features/dialogue-pnj.js';

EnregistrerCarte({
  cle: 'map-3-debut-college',
  numero: 3,
  nom: 'debut-college',
  // suivante: a definir quand l'enchainement des niveaux sera decide
  sortieGare: false, // on arrive en train, on ne repart pas (pas encore)
  features: [Gare, TextesDeZone, Herbe, Tunnel, Teleportation, DialoguePNJ],
});
