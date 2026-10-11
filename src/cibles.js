// cibles.js — la cible d'entrainement du tuto (niveau 1) : une cible a toucher
// avec un projectile. Une fois touchee, elle disparait, puis REVIENT toute seule
// quelques secondes plus tard : on peut s'entrainer autant qu'on veut.
//
// Deux TIMERS (voir le tutoriel des timers) :
//   - un timer SIMPLE : la cible n'apparait que 1,5 s apres le debut du niveau
//     (this.time.delayedCall) ;
//   - un timer RECURRENT : toutes les 6 s, si la cible a ete touchee, elle revient
//     (this.time.addEvent avec loop: true).
//
// Comment s'en servir :
//   dans preload() : this.load.image("img_cible", "assets/sprites/props/cible.png");
//   dans create()  : creer_cible(this, x, y);   (apres creer_tir)

import { jouer_son_cible } from "./sons.js";
import { style_mot } from "./styles.js";

var delai_apparition = 1500; // ms avant l'apparition de la cible (timer simple)
var delai_retour = 6000; // ms entre deux retours de la cible (timer recurrent)


export function creer_cible(scene, x, y) {
  scene.groupe_cibles = scene.physics.add.staticGroup(); // des objets immobiles
  scene.cible = null; // la cible actuelle (null tant qu'elle n'est pas la)
  scene.cible_x = x;
  scene.cible_y = y;

  // un projectile qui chevauche la cible : on appelle toucher_cible
  scene.physics.add.overlap(scene.groupe_projectiles, scene.groupe_cibles, function (projectile, cible) {
    toucher_cible(scene, projectile, cible);
  });

  // TIMER SIMPLE : dans 1,5 s, la cible apparait
  scene.time.delayedCall(delai_apparition, function () {
    faire_apparaitre_la_cible(scene);
  }, null, scene);

  // TIMER RECURRENT : toutes les 6 s, une cible touchee revient
  scene.time.addEvent({
    delay: delai_retour,
    callback: la_cible_revient,
    callbackScope: scene,
    loop: true // pour toujours
  });
}

// la cible grandit de rien (petit "pop")
function faire_apparaitre_la_cible(scene) {
  if (scene.cible != null) {
    return;
  }
  var cible = scene.groupe_cibles.create(scene.cible_x, scene.cible_y, "img_cible");
  scene.cible = cible;
  cible.setScale(0);
  scene.tweens.add({ targets: cible, scale: 1, duration: 300, ease: "Back.easeOut" });
}

// appelee toutes les 6 s : si la cible a ete touchee, elle revient
function la_cible_revient() {
  var scene = this; // callbackScope: scene
  faire_apparaitre_la_cible(scene);
}

// un projectile touche la cible
function toucher_cible(scene, projectile, cible) {
  cible.body.enable = false; // elle ne peut plus etre touchee
  scene.cible = null;
  projectile.destroy();
  jouer_son_cible();

  // elle grossit un peu en s'effacant, et disparait
  scene.tweens.add({
    targets: cible,
    scale: 1.5,
    alpha: 0,
    duration: 400,
    onComplete: function () {
      cible.destroy();
    }
  });

  // un petit "Touche." qui monte et s'efface
  var texte = scene.add.text(cible.x, cible.y - 12, "Touche.", style_mot);
  texte.setOrigin(0.5, 1);
  texte.setDepth(25);
  texte.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  scene.tweens.add({
    targets: texte,
    y: texte.y - 10,
    alpha: 0,
    duration: 900,
    onComplete: function () {
      texte.destroy();
    }
  });
}
