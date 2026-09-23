// controle.js — entrees clavier.
// InstallerControles(this) : une fois, depuis create().
// LireDeplacement(this)    : chaque frame (player.js, et MettreAJourHerbe dans la feature herbe).

import { DirectionAutoMarche } from './auto-marche.js';

// Fleches + WASD pour se deplacer. E ne sert plus qu'a avancer une page de
// dialogue PNJ deja ouverte (dialogue-pnj.js) — gare/tele/portails/PNJ se
// declenchent maintenant a la souris, voir interaction-souris.js.
export function InstallerControles(Scene) {
  Scene.Fleches = Scene.input.keyboard.createCursorKeys();
  Scene.ToucheA = Scene.input.keyboard.addKey('A');
  Scene.ToucheD = Scene.input.keyboard.addKey('D');
  Scene.ToucheInteraction = Scene.input.keyboard.addKey('E');
}

// Intention de deplacement du joueur, { Gauche, Droite }. Source unique,
// pour ne pas relire les touches a plusieurs endroits.
//
// Une auto-marche en cours (voir auto-marche.js — clic sur un element
// interactif trop loin pour l'atteindre tout de suite) remplace le clavier :
// le joueur marche tout seul vers la cible jusqu'a l'arrivee.
export function LireDeplacement(Scene) {
  const VersCible = DirectionAutoMarche(Scene);
  if (VersCible) return VersCible;

  return {
    Gauche: Scene.Fleches.left.isDown || Scene.ToucheA.isDown,
    Droite: Scene.Fleches.right.isDown || Scene.ToucheD.isDown,
  };
}
