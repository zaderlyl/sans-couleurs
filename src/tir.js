// tir.js — le tir des deux joueurs.
//
// - Joueur souris : on maintient Ctrl (ou Cmd sur Mac) et on clique. Un
//   projectile (une goutte de couleur) part du joueur et vole en ligne droite
//   jusqu'a l'endroit clique, ou il eclate en une petite tache.
// - Joueur clavier : la barre espace tire devant lui, dans le sens ou il regarde.
//
// Un projectile eclate aussi quand il touche un mur. Les couleurs se suivent :
// rouge, vert, bleu, rouge...
//
// Comment s'en servir :
//   dans preload() : this.load.image("img_goutte", "assets/sprites/props/goutte.png");
//   dans create()  : creer_tir(this);
//   dans update()  : mettre_a_jour_tir(this);
//   dans le clic   : if (est_un_clic_de_tir(pointeur)) tirer_a_la_souris(this, pointeur.x, pointeur.y);
//
// La scene doit avoir this.joueur_souris, this.joueur_clavier, this.clavier
// (les fleches, avec la barre espace), this.calque_sol et this.carte.

import { point_monde } from "./ecran_separe.js";
import { jouer_son_tir, jouer_son_impact } from "./sons.js";


// --- Reglages ------------------------------------------------------------

var vitesse_projectile = 260; // pixels du monde par seconde
var portee_max = 400; // un tir ne va jamais plus loin
var delai_entre_tirs = 250; // millisecondes entre deux tirs d'un meme joueur
var portee_clavier = 160; // le joueur clavier tire "devant lui" jusqu'a cette distance
var couleurs_tir = [0xff2a4a, 0x2aff6a, 0x2a7bff]; // rouge, vert, bleu


// --- 1. Mise en place (dans create) ------------------------------------------

export function creer_tir(scene) {
  // les projectiles en vol ; allowGravity: false = ils volent droit, sans tomber
  scene.groupe_projectiles = scene.physics.add.group({ allowGravity: false });

  // un projectile qui touche une tuile solide du sol eclate
  scene.physics.add.collider(scene.groupe_projectiles, scene.calque_sol, function (projectile) {
    eclater(scene, projectile);
  });

  // chaque joueur peut tirer au debut (voir tirer_vers : un timer le remet a true)
  scene.joueur_souris.peutTirer = true;
  scene.joueur_clavier.peutTirer = true;

  scene.couleur_tir = 0; // la prochaine couleur, dans couleurs_tir

  // Ctrl + clic est un clic droit sur Mac : on empeche le menu du navigateur
  scene.input.mouse.disableContextMenu();

  // les touches Ctrl et Cmd (juste pour changer le curseur en viseur).
  // Le "false" = Phaser ne bloque pas ces touches : Cmd + R doit continuer a
  // recharger la page.
  scene.touche_ctrl = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.CTRL, false);
  scene.touche_cmd_gauche = scene.input.keyboard.addKey(91, false); // 91 = Cmd gauche
  scene.touche_cmd_droite = scene.input.keyboard.addKey(93, false); // 93 = Cmd droite
}


// --- 2. Mise a jour (dans update) ----------------------------------------------

export function mettre_a_jour_tir(scene) {
  // le curseur devient un viseur tant que Ctrl ou Cmd est maintenu
  var en_mode_tir = scene.touche_ctrl.isDown || scene.touche_cmd_gauche.isDown || scene.touche_cmd_droite.isDown;
  scene.input.setDefaultCursor(en_mode_tir ? "crosshair" : "default");
  scene.en_mode_tir = en_mode_tir; // les autres fichiers (portails...) peuvent le lire

  // le joueur clavier tire avec la barre espace (JustDown : un tir par appui)
  if (Phaser.Input.Keyboard.JustDown(scene.clavier.space) == true) {
    var joueur = scene.joueur_clavier;
    // il tire dans le sens ou il regarde : a gauche si son image est retournee
    var sens = 1;
    if (joueur.flipX == true) {
      sens = -1;
    }
    tirer_vers(scene, joueur, joueur.x + sens * portee_clavier, joueur.y - 2);
  }

  // les projectiles en vol : sortie de la carte, arrivee a destination
  var projectiles = scene.groupe_projectiles.getChildren().slice(); // une copie : on en detruit en route
  for (var i = 0; i < projectiles.length; i++) {
    var projectile = projectiles[i];

    // sorti de la carte : il disparait
    if (projectile.x < 0 || projectile.x > scene.carte.widthInPixels ||
        projectile.y < 0 || projectile.y > scene.carte.heightInPixels) {
      projectile.destroy();
    } else {
      // arrive ? (assez proche pour atteindre le point d'arrivee en une image)
      var reste = Phaser.Math.Distance.Between(projectile.x, projectile.y, projectile.arrivee_x, projectile.arrivee_y);
      if (reste <= vitesse_projectile / 60) {
        eclater(scene, projectile);
      }
    }
  }
}


// --- 3. Le clic de tir du joueur souris ----------------------------------------

// true si ce clic est un clic de tir (Ctrl ou Cmd maintenu), pas un clic pour marcher
export function est_un_clic_de_tir(pointeur) {
  return pointeur.event.ctrlKey == true || pointeur.event.metaKey == true;
}

// tire vers l'endroit de l'ecran (x_ecran, y_ecran) ou on a clique
export function tirer_a_la_souris(scene, x_ecran, y_ecran) {
  var cible = point_monde(scene, x_ecran, y_ecran); // l'endroit du MONDE (voir ecran_separe.js)
  tirer_vers(scene, scene.joueur_souris, cible.x, cible.y);
}


// --- 4. Tirer et eclater ---------------------------------------------------

// un projectile part de `joueur` vers le point (cible_x, cible_y) du monde
function tirer_vers(scene, joueur, cible_x, cible_y) {
  // pas de tir pendant un dialogue ou un voyage, ni avant la fin du delai entre deux tirs
  if (scene.est_fige() == true || joueur.peutTirer == false) {
    return;
  }
  joueur.peutTirer = false;
  // le timer rend le droit de tirer dans 250 ms ("null, scene" : comme dans le tutoriel des timers)
  scene.time.delayedCall(delai_entre_tirs, function () {
    joueur.peutTirer = true;
  }, null, scene);

  // la direction : l'angle du joueur vers le point vise
  var depart_x = joueur.x;
  var depart_y = joueur.y - 2; // vers le milieu du corps
  var angle = Phaser.Math.Angle.Between(depart_x, depart_y, cible_x, cible_y);
  var distance = Math.min(Phaser.Math.Distance.Between(depart_x, depart_y, cible_x, cible_y), portee_max);

  // le projectile apparait un peu devant le joueur
  var projectile = scene.groupe_projectiles.create(
    depart_x + Math.cos(angle) * 6,
    depart_y + Math.sin(angle) * 6,
    "img_goutte"
  );
  projectile.setDepth(18); // au-dessus du decor
  projectile.setTint(couleurs_tir[scene.couleur_tir]);
  projectile.body.setVelocity(Math.cos(angle) * vitesse_projectile, Math.sin(angle) * vitesse_projectile);

  // ou il doit eclater, et sa couleur : retenus sur le projectile lui-meme
  projectile.arrivee_x = depart_x + Math.cos(angle) * distance;
  projectile.arrivee_y = depart_y + Math.sin(angle) * distance;
  projectile.couleur = couleurs_tir[scene.couleur_tir];

  // couleur suivante : rouge, vert, bleu, rouge...
  scene.couleur_tir = (scene.couleur_tir + 1) % couleurs_tir.length;
  jouer_son_tir();
}

// le projectile disparait et laisse une petite tache qui grossit en s'effacant
export function eclater(scene, projectile) {
  if (projectile.active == false) {
    return; // deja eclate (un mur et l'arrivee en meme temps)
  }
  var tache = scene.add.circle(projectile.x, projectile.y, 2, projectile.couleur);
  tache.setDepth(18);
  scene.tweens.add({
    targets: tache,
    scale: 3,
    alpha: 0,
    duration: 280,
    onComplete: function () {
      tache.destroy();
    }
  });
  jouer_son_impact();
  projectile.destroy();
}
