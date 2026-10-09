// cibles.js — des taches grises a toucher avec les projectiles.
//
// Une tache touchee reprend la couleur du projectile, puis disparait : on a
// "rendu une couleur" au monde. Le compteur en haut a gauche dit combien il en
// reste (un petit texte HTML pose sur le jeu).
//
// Comment s'en servir :
//   dans preload() : this.load.image("img_cible", "assets/sprites/props/cible.png");
//   dans create()  : creer_cibles(this);   (apres creer_tir)

// Ou poser les cibles : x, y du monde (la carte fait 16 pixels par tuile).
// Pour en ajouter ou en deplacer, il suffit de changer cette liste.
var positions_cibles = [
  { x: 200, y: 100 },
  { x: 300, y: 112 },
  { x: 420, y: 90 },
  { x: 520, y: 118 },
  { x: 640, y: 100 }
];

var id_compteur = "compteur-cibles";


export function creer_cibles(scene) {
  scene.groupe_cibles = scene.physics.add.staticGroup(); // des objets immobiles
  for (var i = 0; i < positions_cibles.length; i++) {
    scene.groupe_cibles.create(positions_cibles[i].x, positions_cibles[i].y, "img_cible");
  }

  scene.cibles_touchees = 0;

  // le compteur : un <div> en haut a gauche
  var compteur = document.getElementById(id_compteur);
  if (compteur == null) {
    compteur = document.createElement("div");
    compteur.id = id_compteur;
    compteur.style.position = "absolute";
    compteur.style.top = "16px";
    compteur.style.left = "20px";
    compteur.style.color = "#000000";
    compteur.style.background = "#ffffff";
    compteur.style.padding = "4px 10px";
    compteur.style.border = "2px solid #000000";
    compteur.style.fontFamily = "DeltaruneExtended, monospace";
    compteur.style.fontSize = "20px";
    compteur.style.pointerEvents = "none"; // ne bloque pas les clics
    scene.game.canvas.parentElement.style.position = "relative";
    scene.game.canvas.parentElement.appendChild(compteur);
  }
  compteur.style.display = "block";
  afficher_compteur(scene);

  // un projectile qui chevauche une cible : on appelle toucher_cible
  scene.physics.add.overlap(scene.groupe_projectiles, scene.groupe_cibles, function (projectile, cible) {
    toucher_cible(scene, projectile, cible);
  });

  // quand la scene s'arrete, on cache le compteur
  scene.events.once("shutdown", function () {
    compteur.style.display = "none";
  });
}

// un projectile touche une cible
function toucher_cible(scene, projectile, cible) {
  cible.body.enable = false; // elle ne peut plus etre touchee
  cible.setTint(projectile.couleur); // elle prend la couleur du projectile...
  projectile.destroy();

  // ... puis elle grossit un peu en s'effacant, et disparait
  scene.tweens.add({
    targets: cible,
    scale: 1.4,
    alpha: 0,
    duration: 600,
    onComplete: function () {
      cible.destroy();
    }
  });

  scene.cibles_touchees = scene.cibles_touchees + 1;
  afficher_compteur(scene);
}

function afficher_compteur(scene) {
  var texte = "Couleurs rendues : " + scene.cibles_touchees + " / " + positions_cibles.length;
  if (scene.cibles_touchees == positions_cibles.length) {
    texte = "Toutes les couleurs sont revenues !";
  }
  document.getElementById(id_compteur).textContent = texte;
}
