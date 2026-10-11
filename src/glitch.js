// glitch.js — l'effet de "greselement" (le bruit d'une vieille tele cathodique),
// mais en pixels de couleur RVB au lieu du gris habituel.
//
// Les zones sont placees dans Tiled : des rectangles sur le calque d'objets, avec
// une propriete "name" qui vaut "glitch" ou "glitch2". Quand le joueur souris est
// dans une zone, le bruit monte petit a petit (de 0 a 1) tant qu'il y reste ;
// quand il en sort, il redescend. A 1 (le bruit couvre presque tout) :
//   - zone "glitch"  : le glitch "avale" le joueur, qui revient au point de
//                      depart du niveau (un flash blanc, sans ecran de mort) ;
//   - zone "glitch2" : le joueur "meurt" : ecran noir avec un texte, puis un
//                      clic le fait reapparaitre au depart du MEME niveau.
//
// Le bruit est un <canvas> HTML pose sur la moitie d'ecran du joueur souris
// (sa camera) : un seul pixel de bruit = un pixel du monde, donc le meme grain
// que les sprites.
//
// Comment s'en servir (dans un niveau, voir niveau3.js) :
//   creer_glitch(this);              // dans creer_particularites
//   mettre_a_jour_glitch(this, delta);   // dans mettre_a_jour_particularites

import { afficher_texte } from "./ecran_texte.js";


// --- Reglages ------------------------------------------------------------

var duree_montee = 6000; // ms pour monter de 0 a 1 en restant dans une zone
var duree_descente = 900; // ms pour redescendre de 1 a 0 en sortant
var opacite_min = 0.12; // l'opacite du voile quand l'intensite est faible...
var opacite_max = 0.85; // ... et quand elle est presque au maximum
var intervalle_min = 140; // ms entre deux images de bruit, intensite 0
var intervalle_max = 45; // ... intensite 1 (le bruit saccade plus vite)
var densite_min = 0.06; // part de pixels "allumes" dans le grain fin, intensite 0
var densite_max = 0.35; // ... intensite 1
var bandes_min = 1; // bandes de dechirure horizontales, intensite 0
var bandes_max = 7; // ... intensite 1
var duree_flash = 350; // ms du flash blanc du retour au depart
var duree_fondu_mort = 500; // ms du fondu au noir de la mort
var texte_de_mort = "[ SIGNAL PERDU ]\n\n( texte a definir )\n\nClique pour reapparaitre";

// couleurs franches des bandes de dechirure (pas des teintes ternes : c'est ce
// qui fait "un vrai signal qui deconne" et pas de la simple neige)
var couleurs_bandes = ["#ff0040", "#00ffea", "#39ff14", "#ff00ff", "#ffffff", "#ffe600"];

var id_voile = "voile-glitch";


// --- 1. Mise en place (dans create) ---------------------------------------------

export function creer_glitch(scene) {
  scene.zones_glitch = lire_les_zones(scene.carte);
  scene.intensite_glitch = 0; // de 0 (rien) a 1 (le glitch frappe)
  scene.type_de_zone_glitch = null; // "glitch" ou "glitch2" : la derniere zone traversee
  scene.minuteur_bruit = 0;
  scene.glitch_renvoi_en_cours = false; // le flash du retour au depart est en cours
  scene.glitch_fin = null; // null, "enCours" (fondu) ou "attente" (ecran de mort, on attend le clic)

  // le <canvas> du bruit (cree la premiere fois, ensuite reutilise), cache
  var voile = document.getElementById(id_voile);
  if (voile == null) {
    voile = document.createElement("canvas");
    voile.id = id_voile;
    voile.style.position = "absolute";
    voile.style.pointerEvents = "none"; // ne bloque pas les clics sur le jeu
    voile.style.imageRendering = "pixelated"; // pixels nets, pas floutes
    scene.game.canvas.parentElement.style.position = "relative";
    scene.game.canvas.parentElement.appendChild(voile);
  }
  voile.style.display = "none";

  // si la scene s'arrete (changement de niveau...), on cache le bruit
  scene.events.once("shutdown", function () {
    voile.style.display = "none";
  });
}

// Les rectangles Tiled "glitch" / "glitch2" : { x_min, x_max, y_min, y_max, type }
function lire_les_zones(carte) {
  var zones = [];
  var objets = carte.getObjectLayer("Calque d'Objets 1").objects;
  for (var i = 0; i < objets.length; i++) {
    var proprietes = objets[i].properties || [];
    for (var j = 0; j < proprietes.length; j++) {
      if (proprietes[j].name == "name" && (proprietes[j].value == "glitch" || proprietes[j].value == "glitch2")) {
        zones.push({
          x_min: objets[i].x,
          x_max: objets[i].x + objets[i].width,
          y_min: objets[i].y,
          y_max: objets[i].y + objets[i].height,
          type: proprietes[j].value
        });
      }
    }
  }
  return zones;
}


// --- 2. Mise a jour (dans update) -------------------------------------------------

export function mettre_a_jour_glitch(scene, delta) {
  if (scene.zones_glitch.length == 0) {
    return;
  }
  var voile = document.getElementById(id_voile);

  // la mort ou le retour au depart sont en cours, ou le train roule : on ne
  // fait plus monter le bruit
  if (scene.glitch_fin != null || scene.glitch_renvoi_en_cours == true || scene.etat_gare == "enCours") {
    return;
  }

  // le joueur souris est-il dans une zone ?
  var joueur = scene.joueur_souris;
  var zone = null;
  for (var i = 0; i < scene.zones_glitch.length; i++) {
    var z = scene.zones_glitch[i];
    if (joueur.x > z.x_min && joueur.x < z.x_max && joueur.y > z.y_min && joueur.y < z.y_max) {
      zone = z;
    }
  }
  if (zone != null) {
    scene.type_de_zone_glitch = zone.type; // retenu : a pleine intensite, c'est lui qui decide
  }

  // UNE seule jauge, quelle que soit la zone : passer d'un "glitch" a un "glitch2"
  // voisin ne la remet pas a zero, elle continue de monter
  var vitesse = -1 / duree_descente; // il redescend...
  if (zone != null) {
    vitesse = 1 / duree_montee; // ... sauf s'il est dans une zone : il monte
  }
  scene.intensite_glitch = Phaser.Math.Clamp(scene.intensite_glitch + delta * vitesse, 0, 1);

  if (scene.intensite_glitch <= 0) {
    voile.style.display = "none";
    return;
  }

  // a pleine intensite : le glitch frappe
  if (scene.intensite_glitch >= 1) {
    if (scene.type_de_zone_glitch == "glitch2") {
      mourir(scene, voile);
    } else {
      renvoyer_au_depart(scene, voile);
    }
    return;
  }

  // sinon, le bruit est a l'ecran : il change de plus en plus vite avec l'intensite
  voile.style.display = "block";
  placer_le_voile(scene, voile);
  scene.minuteur_bruit = scene.minuteur_bruit + delta;
  var intervalle = Phaser.Math.Linear(intervalle_min, intervalle_max, scene.intensite_glitch);
  if (scene.minuteur_bruit >= intervalle) {
    scene.minuteur_bruit = 0;
    dessiner_le_bruit(scene, voile);
  }
}


// --- 3. Le bruit ------------------------------------------------------------------------

// pose le <canvas> exactement sur la moitie d'ecran du joueur souris (sa camera)
function placer_le_voile(scene, voile) {
  var camera = scene.cameras.main;
  voile.style.left = camera.x + "px";
  voile.style.top = camera.y + "px";
  voile.style.width = camera.width + "px";
  voile.style.height = camera.height + "px";
}

// redessine une image de bruit : un grain fin de pixels RVB epars (pas tous : le
// reste est transparent, comme de la vraie neige) + quelques bandes de
// dechirure. Les deux s'intensifient avec scene.intensite_glitch.
function dessiner_le_bruit(scene, voile) {
  var camera = scene.cameras.main;
  var intensite = scene.intensite_glitch;

  // un pixel de bruit = un pixel du monde (la camera est zoomee x5)
  var largeur = Math.max(1, Math.ceil(camera.width / camera.zoom));
  var hauteur = Math.max(1, Math.ceil(camera.height / camera.zoom));
  if (voile.width != largeur || voile.height != hauteur) {
    voile.width = largeur; // (changer la taille efface aussi le dessin)
    voile.height = hauteur;
  }
  var contexte = voile.getContext("2d");
  contexte.clearRect(0, 0, largeur, hauteur);

  // le grain : une fraction des pixels, chacun d'une couleur RVB au hasard
  var densite = Phaser.Math.Linear(densite_min, densite_max, intensite);
  var image = contexte.createImageData(largeur, hauteur);
  for (var i = 0; i < image.data.length; i += 4) { // [R, V, B, A] par pixel
    if (Math.random() < densite) {
      image.data[i] = Phaser.Math.Between(0, 255);
      image.data[i + 1] = Phaser.Math.Between(0, 255);
      image.data[i + 2] = Phaser.Math.Between(0, 255);
      image.data[i + 3] = 255; // opaque
    }
  }
  contexte.putImageData(image, 0, 0);

  // les bandes : des lignes fines, sur un morceau horizontal au hasard, en couleur vive
  var nombre_de_bandes = Math.round(Phaser.Math.Linear(bandes_min, bandes_max, intensite));
  for (var b = 0; b < nombre_de_bandes; b++) {
    var epaisseur = Phaser.Math.Between(1, 2);
    var y = Phaser.Math.Between(0, Math.max(0, hauteur - epaisseur));
    var longueur = Phaser.Math.Between(Math.round(largeur * 0.15), largeur);
    var x = Phaser.Math.Between(-Math.round(longueur * 0.3), largeur - Math.round(longueur * 0.7));
    contexte.fillStyle = couleurs_bandes[Phaser.Math.Between(0, couleurs_bandes.length - 1)];
    contexte.fillRect(x, y, longueur, epaisseur);
  }

  // l'opacite du voile suit l'intensite, avec un petit tremblement (effet instable)
  var opacite = Phaser.Math.Linear(opacite_min, opacite_max, intensite);
  var tremblement = 0.15 * intensite;
  opacite = opacite + Phaser.Math.FloatBetween(-tremblement, tremblement);
  voile.style.opacity = String(Phaser.Math.Clamp(opacite, 0, 1));
}


// --- 4. Quand le glitch frappe ---------------------------------------------------------

// "glitch" : un flash blanc, et le joueur revient au point de depart du niveau
function renvoyer_au_depart(scene, voile) {
  scene.glitch_renvoi_en_cours = true;
  scene.intensite_glitch = 0;
  cacher_le_joueur(scene.joueur_souris);

  var camera = scene.cameras.main;
  camera.fadeOut(duree_flash, 255, 255, 255); // flash blanc : plus "electrique" qu'un fondu au noir
  camera.once("camerafadeoutcomplete", function () {
    voile.style.display = "none";
    scene.joueur_souris.setPosition(scene.point_depart.x, scene.point_depart.y);
    scene.sauter_camera = true; // les cameras se placent d'un coup

    camera.fadeIn(duree_flash, 255, 255, 255);
    camera.once("camerafadeincomplete", function () {
      scene.sauter_camera = false;
      montrer_le_joueur(scene.joueur_souris);
      scene.glitch_renvoi_en_cours = false;
    });
  });
}

// "glitch2" : fondu au noir, ecran de texte, puis un clic fait recommencer le niveau
function mourir(scene, voile) {
  scene.glitch_fin = "enCours"; // les joueurs sont figes (voir est_fige dans niveau.js)
  scene.forcer_ecran_entier = true;
  scene.intensite_glitch = 0;
  voile.style.display = "none";
  cacher_le_joueur(scene.joueur_souris);

  scene.camera2.fadeOut(duree_fondu_mort, 0, 0, 0);
  scene.cameras.main.fadeOut(duree_fondu_mort, 0, 0, 0);
  scene.cameras.main.once("camerafadeoutcomplete", function () {
    // l'ecran de texte est un <div> par-dessus le jeu : on leve le fondu des cameras
    scene.cameras.main.resetFX();
    scene.camera2.resetFX();
    scene.glitch_fin = "attente";
    afficher_texte(scene, texte_de_mort, function () {
      scene.glitch_fin = null;
      scene.scene.start(scene.scene.key); // le meme niveau, depuis le debut
    });
  });
}

// le joueur est "avale" : invisible et sans physique
function cacher_le_joueur(joueur) {
  joueur.setVisible(false);
  joueur.body.setVelocity(0, 0);
  joueur.body.enable = false;
}
function montrer_le_joueur(joueur) {
  joueur.setVisible(true);
  joueur.body.enable = true;
}
