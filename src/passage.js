// passage.js — un passage d'un niveau a un autre : une case de la carte qui,
// quand le joueur souris marche dessus, l'emmene dans un autre niveau.
//
// Exemple : au bout de l'enfance, une case mene au college.
//
// Comment s'en servir (dans un niveau, voir niveau2.js) :
//   creer_passages(this, [ { colonne: 51, rangee: 9, vers: "niveau3" } ]);   // dans creer_particularites
//   mettre_a_jour_passages(this);                                             // dans mettre_a_jour_particularites
//
// colonne / rangee = la position de la case dans la carte Tiled (une tuile fait
// 16 pixels) ; vers = la cle du niveau ou on arrive.

export function creer_passages(scene, liste) {
  scene.passages = liste;
  scene.passage_en_cours = false; // un seul passage a la fois
}

export function mettre_a_jour_passages(scene) {
  if (scene.passage_en_cours == true || scene.est_fige() == true) {
    return;
  }

  // la case ou se trouve le joueur souris (une tuile fait 16 pixels)
  var colonne = Math.floor(scene.joueur_souris.x / 16);
  var rangee = Math.floor(scene.joueur_souris.y / 16);

  for (var i = 0; i < scene.passages.length; i++) {
    var passage = scene.passages[i];
    if (passage.colonne == colonne && passage.rangee == rangee) {
      prendre_le_passage(scene, passage);
      return;
    }
  }
}

// l'ecran devient noir, puis on demarre l'autre niveau
function prendre_le_passage(scene, passage) {
  scene.passage_en_cours = true;
  scene.joueur_souris.body.setVelocity(0, 0);

  scene.camera2.fadeOut(400, 0, 0, 0);
  scene.cameras.main.fadeOut(400, 0, 0, 0);
  scene.cameras.main.once("camerafadeoutcomplete", function () {
    scene.scene.start(passage.vers); // sans "arrivee_en_train" : on arrive au point de depart du niveau
  });
}
