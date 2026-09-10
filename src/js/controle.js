// controle.js — entrees clavier du joueur.
// InstallerControles(this) est appele depuis create() ; LireDeplacement(this)
// est appele a chaque frame par MettreAJourDeplacement (player.js) et par
// MettreAJourHerbe (game.js).

// Fleches directionnelles + WASD en alternative, plus la touche E
// d'interaction (gare, tele, PNJ). Pose Scene.Fleches / Scene.ToucheA /
// Scene.ToucheD / Scene.ToucheInteraction.
function InstallerControles(Scene) {
  Scene.Fleches = Scene.input.keyboard.createCursorKeys();
  Scene.ToucheA = Scene.input.keyboard.addKey('A');
  Scene.ToucheD = Scene.input.keyboard.addKey('D');
  Scene.ToucheInteraction = Scene.input.keyboard.addKey('E');
}

// Etat courant du deplacement horizontal : { Gauche, Droite } (booleens).
// Une seule source de verite pour "le joueur veut aller a gauche/droite",
// reutilisee partout plutot que de repeter la lecture des touches.
function LireDeplacement(Scene) {
  return {
    Gauche: Scene.Fleches.left.isDown || Scene.ToucheA.isDown,
    Droite: Scene.Fleches.right.isDown || Scene.ToucheD.isDown,
  };
}
