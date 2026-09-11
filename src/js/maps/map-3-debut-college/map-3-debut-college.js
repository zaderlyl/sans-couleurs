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
import { Portails } from '../../features/portails.js';
import { Glitch } from '../../features/glitch.js';
import { DialoguePNJ } from '../../features/dialogue-pnj.js';

EnregistrerCarte({
  cle: 'map-3-debut-college',
  numero: 3,
  nom: 'debut-college',
  // suivante: a definir quand l'enchainement des niveaux sera decide
  sortieGare: false, // on arrive en train, on ne repart pas (pas encore)
  // Portails aller-retour (touche E), meme logique pour chaque duo :
  // iconeEnBas pose l'icone E sous le joueur plutot qu'au-dessus.
  // (39,19) demande par le user corrige en (39,18) : (39,19) tombe en plein
  // dans le sol (case solide), le joueur ne peut pas s'y tenir - (39,18) est
  // la case juste au-dessus, comme tous les autres duos de cette carte.
  portails: [
    { colonneA: 24, rangeeA: 8, colonneB: 46, rangeeB: 18, iconeEnBas: true },
    { colonneA: 39, rangeeA: 18, colonneB: 68, rangeeB: 18, iconeEnBas: true },
    { colonneA: 76, rangeeA: 18, colonneB: 7, rangeeB: 18, iconeEnBas: true },
    { colonneA: 16, rangeeA: 18, colonneB: 95, rangeeB: 18, iconeEnBas: true },
    { colonneA: 89, rangeeA: 18, colonneB: 59, rangeeB: 8, iconeEnBas: true },
  ],
  features: [Gare, TextesDeZone, Herbe, Tunnel, Teleportation, Portails, DialoguePNJ, Glitch],
});
