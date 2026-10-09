// index.js — point d'entree de la version 2 : on importe les scenes, on
// configure Phaser, on lance le jeu.

// chargement des scenes (une scene = un fichier)
import accueil from "./accueil.js";
import niveau1 from "./niveau1.js";

// configuration generale du jeu
var config = {
  type: Phaser.AUTO,
  parent: "game-container", // le <div> de index-v2.html
  backgroundColor: "#000000",
  pixelArt: true, // rendu net (pas de lissage), c'est du pixel art
  scale: {
    // le jeu occupe toute la fenetre et se redimensionne avec elle
    mode: Phaser.Scale.RESIZE,
    width: "100%",
    height: "100%"
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 900 },
      // la physique avance a chaque image affichee : sinon le personnage
      // semble vibrer sur les ecrans 120/144 Hz
      fixedStep: false,
      debug: false // true pour voir les hitbox
    }
  },
  // la premiere scene de la liste est lancee automatiquement
  scene: [accueil, niveau1]
};

// On attend que la police du jeu soit chargee avant de creer le jeu, sinon les
// textes s'afficheraient avec une autre police. Si elle met plus de 2 secondes
// (reseau lent), on lance quand meme.
var attente_police = document.fonts.load("16px 'DeltaruneExtended'");
var attente_max = new Promise(function (resolve) {
  setTimeout(resolve, 2000);
});

Promise.race([attente_police, attente_max]).finally(function () {
  // creation et lancement du jeu a partir de la configuration
  new Phaser.Game(config);
});
