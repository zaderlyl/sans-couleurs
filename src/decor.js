// decor.js — le decor qui reagit aux joueurs : le tunnel et l'herbe.
//
// Deux calques de la carte Tiled :
//
//   - "tunnel" : un calque dessine DEVANT les joueurs (il cache ce qu'il y a
//     derriere). Quand un joueur entre dans son emprise, le calque devient
//     presque transparent, pour ne pas le cacher completement ; il redevient
//     opaque quand il ressort.
//
//   - "devant" : des brins d'herbe. On ne l'affiche pas comme des tuiles
//     figees : a la place de chaque tuile on pose une petite image animee, qui
//     PLIE quand un joueur passe dessus (penche a droite s'il marche vers la
//     droite, a gauche sinon) et se redresse quand il s'en va.
//
// Comment s'en servir (dans niveau.js) :
//   creer_decor(this);           // dans create, AVANT de creer les joueurs
//   mettre_a_jour_decor(this);   // dans update
//
// La scene doit avoir this.carte, this.tuiles (le jeu de tuiles), et apres
// creer_decor : this.joueur_souris et this.joueur_clavier. L'image
// "img_herbe" est chargee par niveau.js.

// --- Reglages ------------------------------------------------------------

var transparence_tunnel = 0.15; // jamais totalement invisible : on voit qu'il est la
var vitesse_fondu_tunnel = 0.08; // vitesse du fondu, a chaque image

var images_par_variante = 3; // une brin d'herbe : [debout, penche a droite, penche a gauche]
var nombre_de_variantes = 4; // il y a 4 sortes de brins d'herbe
var rayon_de_reaction = 20; // pixels : a cette distance, l'herbe reagit au joueur


// --- 1. Mise en place (dans create) ------------------------------------------

export function creer_decor(scene) {
  creer_le_tunnel(scene);
  creer_l_herbe(scene);
}

function creer_le_tunnel(scene) {
  scene.calque_tunnel = scene.carte.createLayer("tunnel", scene.tuiles, 0, 0);
  scene.tunnel_x_min = null;
  scene.tunnel_x_max = null;
  if (scene.calque_tunnel == null) {
    return; // cette carte n'a pas de calque "tunnel"
  }
  scene.calque_tunnel.setDepth(3); // devant les joueurs

  // l'emprise du tunnel : de la tuile la plus a gauche a la plus a droite
  var calque = scene.carte.getLayer("tunnel");
  var x_min = Infinity;
  var x_max = -Infinity;
  for (var r = 0; r < calque.data.length; r++) {
    for (var c = 0; c < calque.data[r].length; c++) {
      var tuile = calque.data[r][c];
      if (tuile != null && tuile.index !== -1) {
        x_min = Math.min(x_min, tuile.pixelX);
        x_max = Math.max(x_max, tuile.pixelX + tuile.width);
      }
    }
  }
  if (x_min <= x_max) { // le calque a bien des tuiles (sur certaines cartes il est vide)
    scene.tunnel_x_min = x_min;
    scene.tunnel_x_max = x_max;
  }
}

function creer_l_herbe(scene) {
  scene.brins_d_herbe = [];

  var calque = scene.carte.getLayer("devant");
  if (calque == null) {
    return; // pas de calque "devant" : pas d'herbe
  }

  // Les 4 sortes de brins sont 4 numeros de tuile qui se suivent. Le premier
  // bouge des qu'on ajoute une tuile dans le jeu de tuiles : on le retrouve en
  // prenant le plus petit numero present dans le calque, plutot que de le figer.
  var premier_numero = Infinity;
  for (var r = 0; r < calque.data.length; r++) {
    for (var c = 0; c < calque.data[r].length; c++) {
      var tuile = calque.data[r][c];
      if (tuile.index > 0 && tuile.index < premier_numero) {
        premier_numero = tuile.index;
      }
    }
  }

  for (var r2 = 0; r2 < calque.data.length; r2++) {
    for (var c2 = 0; c2 < calque.data[r2].length; c2++) {
      var t = calque.data[r2][c2];
      if (t.index <= 0) {
        continue; // case vide
      }
      var variante = t.index - premier_numero;
      if (variante < 0 || variante >= nombre_de_variantes) {
        continue; // une tuile egaree : on l'ignore
      }

      // 3 images empilees (debout, penche a droite, penche a gauche) ; seule
      // celle qui correspond a l'etat du brin est visible, les autres sont
      // transparentes. Changer d'etat = un fondu entre elles (pas d'a-coup).
      var brin = { x: t.pixelX + 8, etat: 0, images: [] };
      for (var i = 0; i < images_par_variante; i++) {
        var image = scene.add.sprite(t.pixelX, t.pixelY, "img_herbe", variante * images_par_variante + i);
        image.setOrigin(0, 0); // meme ancrage qu'une tuile : pile a sa place
        if (i != 0) {
          image.setAlpha(0);
        }
        brin.images.push(image);
      }
      scene.brins_d_herbe.push(brin);
    }
  }
}


// --- 2. Mise a jour (dans update) ---------------------------------------------

export function mettre_a_jour_decor(scene) {
  mettre_a_jour_le_tunnel(scene);
  mettre_a_jour_l_herbe(scene);
}

function mettre_a_jour_le_tunnel(scene) {
  if (scene.tunnel_x_min == null) {
    return;
  }
  // l'un des deux joueurs est-il dans l'emprise horizontale du tunnel ?
  var dedans = false;
  var joueurs = [scene.joueur_souris, scene.joueur_clavier];
  for (var i = 0; i < joueurs.length; i++) {
    if (joueurs[i].visible == true && joueurs[i].x > scene.tunnel_x_min && joueurs[i].x < scene.tunnel_x_max) {
      dedans = true;
    }
  }
  var transparence = 1;
  if (dedans == true) {
    transparence = transparence_tunnel;
  }
  // le calque glisse doucement vers la transparence voulue
  scene.calque_tunnel.alpha = Phaser.Math.Linear(scene.calque_tunnel.alpha, transparence, vitesse_fondu_tunnel);
}

// Un brin se penche des qu'un joueur marche dessus (dans le sens de sa marche),
// et reste penche tant que le joueur est sur la tuile (meme immobile) ; il ne se
// redresse que quand le joueur s'en va.
function mettre_a_jour_l_herbe(scene) {
  var joueurs = [scene.joueur_souris, scene.joueur_clavier];

  for (var i = 0; i < scene.brins_d_herbe.length; i++) {
    var brin = scene.brins_d_herbe[i];
    var nouvel_etat = 0; // debout, sauf si un joueur est dessus

    for (var j = 0; j < joueurs.length; j++) {
      var joueur = joueurs[j];
      if (joueur.visible == false || Math.abs(brin.x - joueur.x) >= rayon_de_reaction) {
        continue; // ce joueur est trop loin (ou cache)
      }
      // le joueur est sur le brin : il le penche dans le sens ou il avance
      if (joueur.body.velocity.x > 0) {
        nouvel_etat = 1; // penche a droite
      } else if (joueur.body.velocity.x < 0) {
        nouvel_etat = 2; // penche a gauche
      } else {
        nouvel_etat = brin.etat; // immobile sur la tuile : il garde sa position
      }
    }

    pencher_le_brin(scene, brin, nouvel_etat);
  }
}

// change l'etat d'un brin (0 debout, 1 droite, 2 gauche) avec un fondu de 120 ms
function pencher_le_brin(scene, brin, etat) {
  if (brin.etat == etat) {
    return; // rien ne change
  }
  brin.etat = etat;
  for (var i = 0; i < brin.images.length; i++) {
    scene.tweens.killTweensOf(brin.images[i]); // on arrete le fondu en cours de cette image
    var visible = 0;
    if (i == etat) {
      visible = 1; // l'image de ce nouvel etat apparait, les autres disparaissent
    }
    scene.tweens.add({ targets: brin.images[i], alpha: visible, duration: 120 });
  }
}
