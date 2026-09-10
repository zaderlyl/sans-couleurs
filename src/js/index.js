// index.js — point d'entree : configuration Phaser et demarrage du jeu.
// Charge en dernier (voir index.html), une fois que tous les autres fichiers
// ont defini leurs constantes, fonctions et la classe ScenePrincipale
// (game.js).

const Configuration = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#000000',
  pixelArt: true, // pas de flou d'interpolation sur les textures en pixel art
  scale: {
    // RESIZE + largeur/hauteur en % : le canvas occupe tout son parent
    // (ici #game-container, cale sur 100% de la fenetre par le CSS) et se
    // redimensionne automatiquement. On evite de lire window.innerWidth ici
    // directement : au moment ou ce script s'execute, la fenetre peut ne pas
    // encore avoir sa taille definitive.
    mode: Phaser.Scale.RESIZE,
    width: '100%',
    height: '100%',
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 900 },
      debug: false, // passe a true pour visualiser les corps physiques (utile en debug de map Tiled)
    },
  },
  scene: ScenePrincipale,
};

// Attend que la police custom des textes de zone soit chargee avant de
// demarrer le jeu, sinon le tout premier rendu utiliserait la police de
// repli (monospace) le temps qu'elle arrive (@font-face defini dans
// index.html). Course avec un delai maximum (DelaiMaxChargementPolice) :
// sur un reseau lent, document.fonts.load() peut ne jamais se resoudre du
// tout (ni succes ni echec, donc ni .then() ni .catch() ne se declenchent
// jamais) — sans ce filet, le jeu resterait bloque sur un ecran noir
// indefiniment plutot que de demarrer avec la police de repli.
const DelaiMaxChargementPolice = new Promise((Resoudre) => setTimeout(Resoudre, 2000));
Promise.race([
  document.fonts.load(`16px '${NomPoliceTexteDeZone}'`).catch(() => {}),
  DelaiMaxChargementPolice,
]).finally(() => {
  new Phaser.Game(Configuration);
});
