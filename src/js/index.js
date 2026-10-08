// index.js — point d'entree. Configure Phaser et demarre le jeu.
// Charge par <script type="module"> dans index.html ; le navigateur suit
// ensuite tout seul le graphe d'`import`.

import { SceneJeu } from '../scene-jeu.js';
import { NomPoliceTexteDeZone } from './config.js';
import './maps/toutes-les-cartes.js'; // enregistre les cartes (effet de bord)

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
      // Pas de pas fixe a 60 Hz : sur un ecran 120/144 Hz la physique ne
      // bougeait le personnage qu'une image sur deux alors que la camera
      // glissait a chaque image -> le perso semblait vibrer / flou en marchant.
      // Avec un pas variable, il avance a chaque image affichee.
      fixedStep: false,
      debug: false, // true pour visualiser les corps physiques
    },
  },
  scene: SceneJeu,
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
  window.__jeu = new Phaser.Game(Configuration);
});
