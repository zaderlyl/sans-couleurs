// portails.js — des portails qui relient deux endroits d'un niveau.
//
// Un portail est une paire de cases : se tenir sur l'une et "appuyer" envoie
// sur l'autre (et inversement). Les deux joueurs peuvent les prendre :
//   - le joueur clavier : il se place sur une case et appuie sur E ;
//   - le joueur souris : il clique sur la case, il y marche tout seul puis voyage.
// Une petite icone "E" apparait quand on peut interagir (survol de la souris,
// ou joueur clavier sur la case) ; la souris la fait trembler.
//
// Comment s'en servir (dans un niveau, voir niveau3.js) :
//   creer_portails(this, [ { colonne_a: 24, rangee_a: 8, colonne_b: 46, rangee_b: 18 }, ... ]);
//   mettre_a_jour_portails(this);   // dans mettre_a_jour_particularites
//
// colonne / rangee = la position de la case dans la carte Tiled (une tuile
// fait 16 pixels). La scene doit avoir "img_icone_e" (voir niveau.js).

import { est_un_clic_de_tir } from "./tir.js";
import { camera_du_joueur } from "./ecran_separe.js";

var taille_tuile = 16;
var duree_fondu = 250; // millisecondes : le voyage est instantane, juste un fondu court


// --- 1. Mise en place (dans create) ------------------------------------------

export function creer_portails(scene, duos) {
  scene.portail_en_cours = false; // un seul voyage a la fois
  scene.portails = []; // toutes les cases de portail (2 par duo)

  // les animations de l'icone "E" : l'invite (en boucle), puis le E qui eclate
  if (scene.anims.exists("anim_icone_attente") == false) {
    scene.anims.create({
      key: "anim_icone_attente",
      frames: scene.anims.generateFrameNumbers("img_icone_e", { start: 0, end: 2 }),
      frameRate: 4,
      repeat: -1
    });
    scene.anims.create({
      key: "anim_icone_pressee",
      frames: scene.anims.generateFrameNumbers("img_icone_e", { start: 3, end: 10 }),
      frameRate: 14,
      repeat: 0
    });
  }

  // pour chaque duo, deux cases ; chacune envoie vers l'autre
  for (var i = 0; i < duos.length; i++) {
    var case_a = creer_case(scene, duos[i].colonne_a, duos[i].rangee_a);
    var case_b = creer_case(scene, duos[i].colonne_b, duos[i].rangee_b);
    case_a.destination = case_b;
    case_b.destination = case_a;
    scene.portails.push(case_a);
    scene.portails.push(case_b);
  }
}

// cree une case de portail : sa zone cliquable, son icone, et ses reperes
function creer_case(scene, colonne, rangee) {
  var portail = {};
  portail.x = (colonne + 0.5) * taille_tuile; // le milieu de la case
  portail.y = rangee * taille_tuile; // le haut de la case

  // la case elle-meme (pour le joueur clavier : il doit etre dedans)
  portail.rectangle = new Phaser.Geom.Rectangle(colonne * taille_tuile, rangee * taille_tuile, taille_tuile, taille_tuile);

  // l'icone "E" est dessinee SOUS la case (sous le sol)
  portail.icone_y = (rangee + 2) * taille_tuile;
  portail.icone = scene.add.sprite(portail.x, portail.icone_y, "img_icone_e", 0);
  portail.icone.setDepth(20); // au-dessus de tout
  portail.icone.setVisible(false);

  // la zone cliquable de la souris : la case ET l'endroit ou l'icone est dessinee
  // (sinon la souris devrait survoler un endroit vide pour voir l'icone)
  var haut = rangee * taille_tuile;
  var bas = (rangee + 2) * taille_tuile + 8;
  portail.zone = scene.add.zone(portail.x, (haut + bas) / 2, taille_tuile, bas - haut);
  portail.zone.setInteractive({ useHandCursor: true });

  portail.souris_dessus = false; // la souris est-elle sur la zone ?
  portail.pressee = false; // l'animation "E qui eclate" est-elle en cours ?

  // la souris entre / sort de la zone
  portail.zone.on("pointerover", function () {
    portail.souris_dessus = true;
  });
  portail.zone.on("pointerout", function () {
    portail.souris_dessus = false;
  });

  // clic sur la zone : le joueur souris y marche, puis prend le portail
  portail.zone.on("pointerdown", function (pointeur) {
    if (est_un_clic_de_tir(pointeur) == true) {
      return; // Ctrl / Cmd : c'est un tir, pas un clic sur le portail
    }
    if (scene.portail_en_cours == true || portail.pressee == true) {
      return;
    }
    scene.aller_vers(portail.x, function () {
      prendre_le_portail(scene, scene.joueur_souris, portail);
    });
  });

  return portail;
}


// --- 2. Mise a jour (dans update) ----------------------------------------------

export function mettre_a_jour_portails(scene) {
  for (var i = 0; i < scene.portails.length; i++) {
    var portail = scene.portails[i];

    // le joueur clavier est-il sur la case ? (son centre est dans le rectangle)
    var clavier_dessus = Phaser.Geom.Rectangle.Contains(portail.rectangle, scene.joueur_clavier.x, scene.joueur_clavier.y);

    // il appuie sur E : il prend le portail
    if (clavier_dessus == true && Phaser.Input.Keyboard.JustDown(scene.touche_e) == true) {
      if (scene.portail_en_cours == false && portail.pressee == false) {
        prendre_le_portail(scene, scene.joueur_clavier, portail);
      }
    }

    // pas de survol en mode tir (la souris sert a viser)
    var souris_dessus = portail.souris_dessus == true && scene.en_mode_tir != true;

    // l'icone est visible si la souris est dessus ou si le joueur clavier est sur la case
    if (portail.pressee == false) {
      var visible = (souris_dessus == true || clavier_dessus == true) && scene.portail_en_cours == false;
      portail.icone.setVisible(visible);
      if (visible == true) {
        portail.icone.anims.play("anim_icone_attente", true);
      }
    }

    // la souris dessus : l'icone tremble ("c'est cliquable"). Sinon elle est bien en place.
    var tremblement_x = 0;
    var tremblement_y = 0;
    if (souris_dessus == true && portail.pressee == false) {
      tremblement_x = Phaser.Math.Between(-1, 1);
      tremblement_y = Phaser.Math.Between(-1, 1);
    }
    portail.icone.setPosition(portail.x + tremblement_x, portail.icone_y + tremblement_y);
  }
}


// --- 3. Le voyage -----------------------------------------------------------------

// `joueur` prend le portail : le E eclate, puis fondu, deplacement, fondu inverse
function prendre_le_portail(scene, joueur, portail) {
  portail.pressee = true;
  portail.icone.setVisible(true);
  portail.icone.play("anim_icone_pressee");

  // quand l'animation du E est finie : on voyage
  portail.icone.once("animationcomplete", function () {
    portail.icone.setVisible(false);
    portail.pressee = false;
    voyager(scene, joueur, portail.destination);
  });
}

// fondu au noir sur l'ecran du joueur, deplacement instantane, retour du fond
function voyager(scene, joueur, destination) {
  scene.portail_en_cours = true;

  // le fondu est sur l'ecran du joueur qui voyage (sa moitie si l'ecran est separe)
  var camera = camera_du_joueur(scene, joueur);
  camera.fadeOut(duree_fondu, 0, 0, 0);
  camera.once("camerafadeoutcomplete", function () {
    joueur.setPosition(destination.x, destination.y);
    joueur.body.setVelocity(0, 0);

    // les cameras se placent d'un coup (sinon elles glisseraient de loin) : le
    // temps du fondu de retour
    scene.sauter_camera = true;
    camera.fadeIn(duree_fondu, 0, 0, 0);
    camera.once("camerafadeincomplete", function () {
      scene.sauter_camera = false;
    });
    scene.portail_en_cours = false;
  });
}
