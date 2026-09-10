// index.js — configuration Phaser et demarrage. Charge en dernier : tout le
// reste (constantes, fonctions, classe ScenePrincipale) est deja defini.

const Configuration = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#000000',
  pixelArt: true, // rendu net, sans interpolation
  scale: {
    // Le canvas occupe tout #game-container (100% de la fenetre via le CSS)
    // et se redimensionne avec lui. On ne lit pas window.innerWidth ici : la
    // fenetre n'a pas forcement sa taille definitive a ce moment.
    mode: Phaser.Scale.RESIZE,
    width: '100%',
    height: '100%',
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 900 },
      debug: false, // true pour visualiser les corps physiques
    },
  },
  scene: ScenePrincipale,
};

// On attend la police des textes de zone avant de demarrer, sinon le premier
// rendu utilise la police de repli. Garde-fou : sur reseau lent,
// document.fonts.load() peut ne jamais se resoudre — le delai max evite de
// rester bloque sur un ecran noir.
const DelaiMaxChargementPolice = new Promise((Resoudre) => setTimeout(Resoudre, 2000));
Promise.race([
  document.fonts.load(`16px '${NomPoliceTexteDeZone}'`).catch(() => {}),
  DelaiMaxChargementPolice,
]).finally(() => {
  new Phaser.Game(Configuration);
});
