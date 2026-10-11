// tuto.js — le mini-tuto du niveau 1 : des panneaux le long du chemin qui
// apprennent les commandes. Un panneau apparait (en fondu) quand un joueur
// s'approche, et s'efface quand les deux s'en eloignent.
//
// Comment s'en servir (dans un niveau, voir niveau1.js) :
//   creer_tuto(this, [ { x: 90, lignes: ["premiere ligne", "deuxieme ligne"] }, ... ]);
//   mettre_a_jour_tuto(this);   // dans mettre_a_jour_particularites

import { style_mot } from "./styles.js";

var distance_pour_apparaitre = 70; // px : un joueur plus pres que ca fait apparaitre le panneau
var distance_pour_disparaitre = 100; // px : plus loin que ca (les deux joueurs), il disparait
var hauteur_du_panneau = 104; // y du monde : au-dessus de la tete des joueurs


export function creer_tuto(scene, panneaux) {
  scene.panneaux_du_tuto = [];
  for (var i = 0; i < panneaux.length; i++) {
    var texte = scene.add.text(panneaux[i].x, hauteur_du_panneau, panneaux[i].lignes.join("\n"), style_mot);
    texte.setOrigin(0.5, 1);
    texte.setAlign("center");
    texte.setDepth(20);
    texte.setAlpha(0);
    // pixelArt: true met les textures en NEAREST : flou pour un texte agrandi.
    texte.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    scene.panneaux_du_tuto.push({ x: panneaux[i].x, texte: texte, visible: false });
  }
}

export function mettre_a_jour_tuto(scene) {
  for (var i = 0; i < scene.panneaux_du_tuto.length; i++) {
    var panneau = scene.panneaux_du_tuto[i];
    var distance = Math.min(Math.abs(scene.joueur_souris.x - panneau.x), Math.abs(scene.joueur_clavier.x - panneau.x));

    if (panneau.visible == false && distance < distance_pour_apparaitre) {
      panneau.visible = true;
      scene.tweens.add({ targets: panneau.texte, alpha: 1, duration: 300 });
    } else if (panneau.visible == true && distance > distance_pour_disparaitre) {
      panneau.visible = false;
      scene.tweens.add({ targets: panneau.texte, alpha: 0, duration: 400 });
    }
  }
}
