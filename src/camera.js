// camera.js — la camera du jeu : UN SEUL ecran, qui suit les deux joueurs.
//
// - tant que les deux joueurs tiennent dans l'ecran, la camera regarde le MILIEU
//   entre eux ;
// - s'ils s'eloignent trop, elle suit celui qui est le plus avance (le plus a
//   droite), a 40 pixels du bord de l'ecran. L'autre, sorti du cadre, est montre
//   par une pastille au bord de l'ecran (voir pastilles.js).
//
// Comment s'en servir (dans une scene) :
//   dans create() : creer_camera(this);
//   dans update() : mettre_a_jour_camera(this);
//   pour une souris : point_monde(this, pointeur.x, pointeur.y)
//
// La scene doit avoir this.joueur_souris, this.joueur_clavier et this.carte (la
// carte Tiled). Apres un portail ou une chute, scene.sauter_camera = true le temps
// d'une image fait placer la camera d'un coup (sinon elle glisserait de loin).


// --- Reglages ------------------------------------------------------------

// Vitesse de la camera (0.1 = douce, 0.3 = vive).
var vitesse_camera = 0.1;

// La camera regarde un peu plus bas que les joueurs (ils remontent a l'ecran).
var decalage_vertical = 4;

// Le joueur le plus avance reste a cette distance du bord droit de l'ecran (pixels du monde).
var marge_du_premier = 40;


// --- 1. Mise en place (dans create) ------------------------------------------

export function creer_camera(scene) {
  scene.sauter_camera = false; // true = la camera se place d'un coup
}


// --- 2. Mise a jour (dans update, une fois par image) -------------------------

export function mettre_a_jour_camera(scene) {
  var camera = scene.cameras.main;
  // la fenetre peut etre redimensionnee : la camera occupe toujours tout l'ecran
  camera.setViewport(0, 0, scene.scale.width, scene.scale.height);
  deplacer_la_camera(scene, camera, point_regarde(scene));
}


// --- 3. Que regarde la camera ? ----------------------------------------------

function point_regarde(scene) {
  var souris = scene.joueur_souris;
  var clavier = scene.joueur_clavier;
  var milieu_x = (souris.x + clavier.x) / 2;
  var milieu_y = (souris.y + clavier.y) / 2;

  // les deux joueurs tiennent dans l'ecran (avec une marge) : le milieu
  var largeur_vue = scene.scale.width / scene.cameras.main.zoom;
  if (Math.abs(souris.x - clavier.x) <= largeur_vue - 2 * marge_du_premier) {
    return { x: milieu_x, y: milieu_y };
  }

  // sinon : le plus avance, a 40 pixels du bord droit
  var premier = souris;
  if (clavier.x > souris.x) {
    premier = clavier;
  }
  return { x: premier.x - (largeur_vue / 2 - marge_du_premier), y: milieu_y };
}

// Fait glisser la camera vers le point (x, y) du monde, sans sortir de la carte.
//
// On raisonne sur le CENTRE de la vue, qu'on retient sur la camera
// (camera.centre_x / centre_y) : quand la largeur de la camera change (la fenetre
// est redimensionnee), la valeur "scrollX" de Phaser saute de plusieurs centaines
// de pixels alors que la vue ne bouge pas ; le centre, lui, ne depend pas de la taille.
function deplacer_la_camera(scene, camera, point) {
  var demi_largeur = camera.width / camera.zoom / 2;
  var demi_hauteur = camera.height / camera.zoom / 2;

  // le centre voulu, garde dans la carte (on ne voit jamais le noir autour)
  var voulu_x = Phaser.Math.Clamp(point.x, demi_largeur, Math.max(demi_largeur, scene.carte.widthInPixels - demi_largeur));
  var voulu_y = Phaser.Math.Clamp(point.y + decalage_vertical, demi_hauteur, Math.max(demi_hauteur, scene.carte.heightInPixels - demi_hauteur));

  // la toute premiere fois (ou apres un portail : scene.sauter_camera), on se
  // place d'un coup, sinon la camera glisserait depuis son ancienne place
  if (camera.centre_x === undefined || scene.sauter_camera == true) {
    camera.centre_x = voulu_x;
    camera.centre_y = voulu_y;
  }

  camera.centre_x = Phaser.Math.Linear(camera.centre_x, voulu_x, vitesse_camera);
  camera.centre_y = Phaser.Math.Linear(camera.centre_y, voulu_y, vitesse_camera);

  // scrollX / scrollY = le centre moins la moitie de la taille de la camera
  camera.scrollX = camera.centre_x - camera.width / 2;
  camera.scrollY = camera.centre_y - camera.height / 2;
}


// --- 4. La souris -------------------------------------------------------------

// l'endroit du MONDE sous un point de l'ecran (la camera est zoomee et decalee)
export function point_monde(scene, x_ecran, y_ecran) {
  return scene.cameras.main.getWorldPoint(x_ecran, y_ecran);
}
