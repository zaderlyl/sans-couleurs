// gare.js — la gare et le voyage en train.
//
// Le joueur souris clique sur la gare : il y marche, le train clignote, tremble,
// demarre, l'ecran devient noir, puis on passe au niveau suivant (ou, si ce
// niveau n'a pas de suite, le joueur revient ou il etait).
// Dans le niveau d'arrivee, un ecran noir affiche quelques phrases ("Le train
// quitte la gare..."), puis le train arrive en douceur et les joueurs descendent.
//
// La gare n'est pas placee a la main : on la retrouve dans la carte Tiled, grace
// au calque "gare" (un bloc de tuiles qui dessine la gare). On ne l'affiche pas :
// une image animee (le train, 64 images) la remplace, posee exactement au meme endroit.
//
// Comment s'en servir (dans un niveau) :
//   creer_gare(this, { niveau_suivant: "niveau2", sortie_active: true });  // dans creer_particularites
//   mettre_a_jour_gare(this);                                              // dans mettre_a_jour_particularites
//
//   - niveau_suivant : la cle du niveau ou mene le train (ou null : il ne mene nulle part) ;
//   - sortie_active  : false si on peut arriver ici en train mais pas repartir.
//
// Etat garde sur la scene : scene.etat_gare vaut "attente" (rien ne se passe) ou
// "enCours" (le train est en route : les joueurs sont figes, voir niveau.js).

// --- Reglages : la calibration de l'image du train ---------------------------
//
// gare.png : 64 images de 256 x 256. Le bloc de tuiles de la gare a ete decoupe
// dans chaque image a partir du pixel (80, 240) (son coin bas-gauche). On pose
// donc l'image avec ce point comme point de reference ("origine").
var taille_image = 256;
var nombre_images = 64;
var ancrage_x = 80;
var ancrage_y = 240;

// Le dessin utile d'une image va de ancrage_x jusqu'au bord droit (176 pixels
// de large), il n'est pas centre. Pour le centrer sur le bloc de tuiles, on
// retire un decalage, qui depend du sens de l'image (flippee ou non) :
//   - normale  : le dessin va de X a X + 176, son centre est X + 88 -> X = centre - 88
//   - flippee  : le dessin va de X - 80 a X + 96, son centre est X + 8 -> X = centre - 8
var decalage_normal = 88;
var decalage_flippe = 8;

var hauteur_icone = 80; // l'icone "E" est a cette hauteur fixe au-dessus du sol

var phrases_du_voyage = [
  "Le train quitte la gare.",
  "Les paysages defilent derriere la vitre.",
  "Quelques instants plus tard..."
];
var delai_par_lettre = 70; // ms : l'effet "machine a ecrire" de l'ecran du voyage


// --- 1. Mise en place (dans create) ---------------------------------------------

export function creer_gare(scene, options) {
  scene.etat_gare = "attente";
  scene.gare = null;

  // le bloc de tuiles "gare" de la carte : colonnes et rangees min / max
  var boite = boite_des_tuiles(scene.carte, "gare");
  if (boite == null) {
    return; // cette carte n'a pas de gare
  }

  // la gare est-elle dessinee retournee dans cette carte ? (la carte 2 le fait)
  var flippe = le_calque_est_retourne(scene.carte, "gare");

  var gare = {};
  gare.options = options;
  // le milieu du bloc de tuiles
  gare.centre_x = (boite.col_min * 16 + (boite.col_max + 1) * 16) / 2;
  gare.bas_y = boite.rangee_max * 16;
  gare.haut_y = boite.rangee_min * 16;
  gare.flippe = flippe;
  gare.souris_dessus = false;
  gare.pressee = false; // l'animation "E qui eclate" est-elle en cours ?

  // ou le joueur souris marche avant de partir : le milieu de la zone de la gare
  var col_centre = boite.col_min + Math.floor((boite.col_max - boite.col_min) / 2);
  gare.x_depart = (boite.col_min * 16 + (col_centre + 4) * 16) / 2;

  // --- l'image du train, posee sur le bloc de tuiles ---
  creer_les_animations(scene);
  var decalage = decalage_normal;
  if (flippe == true) {
    decalage = decalage_flippe;
  }
  gare.sprite = scene.add.sprite(gare.centre_x - decalage, gare.bas_y, "img_gare", 0);
  gare.sprite.setOrigin(ancrage_x / taille_image, ancrage_y / taille_image);
  gare.sprite.setDepth(5);
  gare.sprite.setFlipX(flippe);
  // "pixelPerfect" : seul le dessin reagit a la souris, pas le grand carre transparent
  gare.sprite.setInteractive({ pixelPerfect: true, useHandCursor: true });
  gare.x_sprite = gare.sprite.x;
  gare.y_sprite = gare.sprite.y;

  // l'icone "E" au-dessus de la gare
  gare.icone = scene.add.sprite(gare.centre_x, hauteur_icone, "img_icone_e", 0);
  gare.icone.setDepth(20);
  gare.icone.setVisible(false);

  scene.gare = gare;

  // la souris entre / sort de la gare
  gare.sprite.on("pointerover", function () {
    gare.souris_dessus = true;
  });
  gare.sprite.on("pointerout", function () {
    gare.souris_dessus = false;
  });

  // clic sur la gare : le joueur souris y marche, puis le train part
  gare.sprite.on("pointerdown", function (pointeur) {
    if (pointeur.event.ctrlKey == true || pointeur.event.metaKey == true) {
      return; // Ctrl / Cmd : c'est un tir
    }
    if (peut_partir(scene) == false) {
      return;
    }
    scene.aller_vers(gare.x_depart, function () {
      appuyer_sur_l_icone_puis(scene, partir);
    });
  });

  // on arrive en train : l'animation d'arrivee
  if (scene.arrivee_en_train == true) {
    arriver_en_train(scene);
  }
}

// peut-on prendre le train maintenant ?
function peut_partir(scene) {
  return scene.gare != null && scene.gare.options.sortie_active == true
    && scene.etat_gare == "attente" && scene.est_fige() == false && scene.gare.pressee == false;
}

// les 3 animations du train
function creer_les_animations(scene) {
  if (scene.anims.exists("anim_gare_clignote") == true) {
    return;
  }
  // le train clignote : images 2 et 3, deux fois, lentement
  scene.anims.create({
    key: "anim_gare_clignote",
    frames: [{ key: "img_gare", frame: 2 }, { key: "img_gare", frame: 3 }],
    frameRate: 2,
    repeat: 1
  });
  // le train demarre : images 5 a 63, une fois
  scene.anims.create({
    key: "anim_gare_roule",
    frames: scene.anims.generateFrameNumbers("img_gare", { start: 5, end: nombre_images - 1 }),
    frameRate: 10,
    repeat: 0
  });
  // le train arrive : les memes images a l'envers
  var images_arrivee = [];
  for (var i = nombre_images - 1; i >= 5; i--) {
    images_arrivee.push({ key: "img_gare", frame: i });
  }
  scene.anims.create({
    key: "anim_gare_arrive",
    frames: images_arrivee,
    frameRate: 10,
    repeat: 0
  });
}


// --- 2. Mise a jour (dans update) -----------------------------------------------------

export function mettre_a_jour_gare(scene) {
  var gare = scene.gare;
  if (gare == null) {
    return;
  }

  // la souris sur la gare : l'icone apparait et le train tremble ("on peut cliquer")
  var survole = gare.souris_dessus == true && peut_partir(scene) == true && scene.en_mode_tir != true;

  if (scene.etat_gare == "attente" && gare.pressee == false) {
    gare.icone.setVisible(survole);
    if (survole == true) {
      gare.icone.anims.play("anim_icone_attente", true);
    }
    var tremblement_x = 0;
    var tremblement_y = 0;
    if (survole == true) {
      tremblement_x = Phaser.Math.Between(-1, 1);
      tremblement_y = Phaser.Math.Between(-1, 1);
    }
    gare.sprite.setPosition(gare.x_sprite + tremblement_x, gare.y_sprite + tremblement_y);
  }
}


// --- 3. Le depart ------------------------------------------------------------------------

// le joueur est arrive devant la gare : le E eclate, puis on appelle `suite`
function appuyer_sur_l_icone_puis(scene, suite) {
  var gare = scene.gare;
  gare.pressee = true; // (pendant ce temps, l'icone n'est pas remise en "attente")
  gare.sprite.setPosition(gare.x_sprite, gare.y_sprite); // le train arrete de trembler
  gare.icone.setVisible(true);
  gare.icone.play("anim_icone_pressee");
  gare.icone.once("animationcomplete", function () {
    gare.icone.setVisible(false);
    gare.pressee = false;
    suite(scene);
  });
}

// La suite du voyage, etape par etape :
//   le train clignote -> il tremble -> il demarre -> l'ecran devient noir -> niveau suivant
function partir(scene) {
  var gare = scene.gare;
  scene.etat_gare = "enCours"; // les joueurs sont figes
  scene.forcer_ecran_entier = true; // pas d'ecran separe pendant le voyage

  // le joueur souris "monte dans le train" : on ne le voit plus. On retient ou
  // il etait, pour le ramener si le train ne mene nulle part.
  var avant_x = scene.joueur_souris.x;
  var avant_y = scene.joueur_souris.y;
  cacher_le_joueur(scene.joueur_souris);

  // 1) le train clignote
  gare.sprite.play("anim_gare_clignote");
  gare.sprite.once("animationcomplete", function () {
    // 2) il tremble pendant 0,6 s
    trembler(scene, gare.sprite, 600, 1, function () {
      // 3) il demarre (64 images)
      gare.sprite.play("anim_gare_roule");
      gare.sprite.once("animationcomplete", function () {
        // 4) l'ecran devient noir, puis on change de niveau
        fondu_au_noir(scene, function () {
          changer_de_niveau(scene, avant_x, avant_y);
        });
      });
    });
  });
}

// Fin du voyage. Le niveau suivant, s'il y en a un ; sinon le train ne mene
// nulle part : le joueur revient ou il etait.
function changer_de_niveau(scene, avant_x, avant_y) {
  var gare = scene.gare;

  if (gare.options.niveau_suivant != null) {
    // on demarre le niveau suivant (l'ecran est deja noir). On lui dit qu'on
    // arrive en train, avec l'ecran de texte.
    scene.scene.start(gare.options.niveau_suivant, { arrivee_en_train: true, avec_transition: true });
    return;
  }

  gare.sprite.setFrame(0);
  scene.joueur_souris.setPosition(avant_x, avant_y);
  montrer_le_joueur(scene.joueur_souris);
  scene.cameras.main.fadeIn(500, 0, 0, 0);
  scene.camera2.fadeIn(500, 0, 0, 0);
  scene.etat_gare = "attente";
  scene.forcer_ecran_entier = false;
}

// les deux cameras s'assombrissent en 0,5 s, puis on appelle `suite`
function fondu_au_noir(scene, suite) {
  scene.camera2.fadeOut(500, 0, 0, 0);
  scene.cameras.main.fadeOut(500, 0, 0, 0);
  scene.cameras.main.once("camerafadeoutcomplete", suite);
}


// --- 4. L'arrivee ---------------------------------------------------------------------------

// On vient d'arriver dans ce niveau en train : ecran noir avec des phrases (sauf
// si scene.avec_transition est false), puis le train arrive et les joueurs descendent.
function arriver_en_train(scene) {
  var gare = scene.gare;
  scene.etat_gare = "enCours"; // figes pendant l'arrivee
  scene.forcer_ecran_entier = true;

  // les joueurs sont dans le train, sur le bloc de la gare : le joueur clavier
  // un peu plus loin, et le joueur souris invisible jusqu'a la fin de l'arrivee
  scene.joueur_souris.setPosition(gare.centre_x, gare.haut_y);
  scene.joueur_clavier.setPosition(gare.centre_x + 24, gare.haut_y);
  cacher_le_joueur(scene.joueur_souris);

  // on cache le monde (ecran noir) jusqu'a la fin des phrases
  scene.cameras.main.fadeOut(0, 0, 0, 0);
  scene.camera2.fadeOut(0, 0, 0, 0);

  if (scene.avec_transition == true) {
    afficher_les_phrases(scene, phrases_du_voyage, function () {
      jouer_l_arrivee(scene);
    });
  } else {
    jouer_l_arrivee(scene);
  }
}

// le train arrive en douceur, l'ecran se rallume, les joueurs sont libres
function jouer_l_arrivee(scene) {
  var gare = scene.gare;
  scene.cameras.main.resetFX(); // enleve le noir pose plus haut
  scene.camera2.resetFX();
  scene.cameras.main.fadeIn(500, 0, 0, 0);
  scene.camera2.fadeIn(500, 0, 0, 0);

  gare.sprite.play("anim_gare_arrive");
  gare.sprite.once("animationcomplete", function () {
    gare.sprite.setFrame(0); // le train reste la, a l'arret
    montrer_le_joueur(scene.joueur_souris);
    scene.etat_gare = "attente";
    scene.forcer_ecran_entier = false;
  });
}


// --- 5. L'ecran de texte du voyage ----------------------------------------------------------
//
// Un grand rectangle noir (un <div> HTML pose sur le jeu) avec une phrase qui
// s'ecrit lettre par lettre. Un clic termine la phrase en cours, puis passe a
// la suivante ; apres la derniere, on appelle `quand_fini`. Un <div> plutot
// qu'un objet du jeu : il couvre tout l'ecran, quelle que soit la camera.

function afficher_les_phrases(scene, phrases, quand_fini) {
  var ecran = document.getElementById("ecran-texte");
  if (ecran == null) {
    ecran = document.createElement("div");
    ecran.id = "ecran-texte";
    ecran.style.position = "absolute";
    ecran.style.top = "0";
    ecran.style.left = "0";
    ecran.style.right = "0";
    ecran.style.bottom = "0";
    ecran.style.background = "#000000";
    ecran.style.color = "#ffffff";
    ecran.style.display = "flex";
    ecran.style.alignItems = "center";
    ecran.style.justifyContent = "center";
    ecran.style.textAlign = "center";
    ecran.style.fontFamily = "DeltaruneExtended, monospace";
    ecran.style.fontSize = "28px";
    ecran.style.padding = "40px";
    ecran.style.cursor = "pointer";
    scene.game.canvas.parentElement.style.position = "relative";
    scene.game.canvas.parentElement.appendChild(ecran);
  }
  ecran.style.display = "flex";
  ecran.textContent = "";

  var indice_phrase = 0; // quelle phrase
  var nombre_de_lettres = 0; // combien de lettres sont deja ecrites

  // toutes les 70 ms : une lettre de plus
  var minuteur = scene.time.addEvent({
    delay: delai_par_lettre,
    loop: true,
    callback: function () {
      if (nombre_de_lettres < phrases[indice_phrase].length) {
        nombre_de_lettres = nombre_de_lettres + 1;
        ecran.textContent = phrases[indice_phrase].slice(0, nombre_de_lettres);
      }
    }
  });

  // un clic : finit la phrase en cours, ou passe a la suivante
  ecran.onclick = function () {
    if (nombre_de_lettres < phrases[indice_phrase].length) {
      nombre_de_lettres = phrases[indice_phrase].length;
      ecran.textContent = phrases[indice_phrase];
      return;
    }
    indice_phrase = indice_phrase + 1;
    nombre_de_lettres = 0;
    ecran.textContent = "";
    if (indice_phrase >= phrases.length) {
      // plus de phrase : on referme l'ecran noir
      minuteur.remove();
      ecran.style.display = "none";
      ecran.onclick = null;
      quand_fini();
    }
  };

  // si la scene s'arrete avant la fin, on referme l'ecran
  scene.events.once("shutdown", function () {
    ecran.style.display = "none";
    ecran.onclick = null;
  });
}


// --- 6. Outils ---------------------------------------------------------------------------------------

// Boite des tuiles non vides d'un calque : { col_min, col_max, rangee_min, rangee_max }, ou null
function boite_des_tuiles(carte, nom_calque) {
  var calque = carte.getLayer(nom_calque);
  if (calque == null) {
    return null;
  }
  var boite = { col_min: Infinity, col_max: -Infinity, rangee_min: Infinity, rangee_max: -Infinity };
  for (var r = 0; r < calque.data.length; r++) {
    for (var c = 0; c < calque.data[r].length; c++) {
      var tuile = calque.data[r][c];
      if (tuile != null && tuile.index !== -1) {
        boite.col_min = Math.min(boite.col_min, tuile.x);
        boite.col_max = Math.max(boite.col_max, tuile.x);
        boite.rangee_min = Math.min(boite.rangee_min, tuile.y);
        boite.rangee_max = Math.max(boite.rangee_max, tuile.y);
      }
    }
  }
  if (boite.col_min > boite.col_max) {
    return null; // calque vide
  }
  return boite;
}

// le calque est-il dessine retourne ? On regarde sa premiere tuile non vide.
function le_calque_est_retourne(carte, nom_calque) {
  var calque = carte.getLayer(nom_calque);
  for (var r = 0; r < calque.data.length; r++) {
    for (var c = 0; c < calque.data[r].length; c++) {
      var tuile = calque.data[r][c];
      if (tuile != null && tuile.index !== -1) {
        return tuile.flipX == true;
      }
    }
  }
  return false;
}

// secoue un objet de petits decalages pendant `duree` ms, puis le remet en place
// et appelle `apres`
function trembler(scene, objet, duree, intensite, apres) {
  var x = objet.x;
  var y = objet.y;
  var minuteur = scene.time.addEvent({
    delay: 40,
    loop: true,
    callback: function () {
      objet.setPosition(x + Phaser.Math.Between(-intensite, intensite), y + Phaser.Math.Between(-intensite, intensite));
    }
  });
  scene.time.delayedCall(duree, function () {
    minuteur.remove();
    objet.setPosition(x, y);
    apres();
  }, null, scene);
}

// un joueur "dans le train" : invisible et sans physique (il ne tombe pas)
function cacher_le_joueur(joueur) {
  joueur.setVisible(false);
  joueur.body.setVelocity(0, 0);
  joueur.body.enable = false;
}
function montrer_le_joueur(joueur) {
  joueur.setVisible(true);
  joueur.body.enable = true;
}
