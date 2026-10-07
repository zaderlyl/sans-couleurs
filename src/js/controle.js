// controle.js — entrees clavier.
// InstallerControles(this) : une fois, depuis create().
// LireDeplacement(this)    : chaque frame (player.js, et MettreAJourHerbe dans la feature herbe).

import { DirectionAutoMarche } from './auto-marche.js';

// Joueur 1 : fleches (ou A/Q et D si un joueur 2 est la). Joueur 2 : fleches. Les actions se declenchent a la souris,
// voir interaction-souris.js.
export function InstallerControles(Scene) {
  Scene.Fleches = Scene.input.keyboard.createCursorKeys();
  Scene.ToucheA = Scene.input.keyboard.addKey('A');
  Scene.ToucheD = Scene.input.keyboard.addKey('D');
  Scene.ToucheQ = Scene.input.keyboard.addKey('Q'); // gauche sur un clavier AZERTY
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

  // Quand le joueur 2 existe (feature joueur2), les fleches sont a lui :
  // le joueur 1 garde A/Q et D.
  const FlechesLibres = !Scene.Joueur2;
  return {
    Gauche: (FlechesLibres && Scene.Fleches.left.isDown) || Scene.ToucheA.isDown || Scene.ToucheQ.isDown,
    Droite: (FlechesLibres && Scene.Fleches.right.isDown) || Scene.ToucheD.isDown,
  };
}

// Intention de deplacement du joueur 2 : fleches gauche / droite uniquement.
export function LireDeplacementJoueur2(Scene) {
  return {
    Gauche: Scene.Fleches.left.isDown,
    Droite: Scene.Fleches.right.isDown,
  };
}
