// controle.js — entrees clavier.
// InstallerControles(this) : une fois, depuis create().
// LireDeplacement(this)    : chaque frame (player.js, et MettreAJourHerbe dans la feature herbe).

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
export function LireDeplacement(Scene) {
  return {
    Gauche: Scene.Fleches.left.isDown || Scene.ToucheA.isDown,
    Droite: Scene.Fleches.right.isDown || Scene.ToucheD.isDown,
  };
}
