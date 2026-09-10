// controle.js — entrees clavier.
// InstallerControles(this) : une fois, depuis create().
// LireDeplacement(this)    : chaque frame (player.js, et MettreAJourHerbe dans la feature herbe).

// Fleches + WASD pour se deplacer, E pour interagir (gare, tele, PNJ).
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
