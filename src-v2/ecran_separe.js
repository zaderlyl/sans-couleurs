// ecran_separe.js — l'ecran qui se separe en deux quand les deux joueurs
// s'eloignent l'un de l'autre.
//
// === Le principe (a lire en premier) =======================================
//
// On garde UN nombre, scene.part_separation, qui va de 0 a 1 :
//
//   0   -> les joueurs sont proches : un seul ecran, centre entre eux ;
//   1   -> les joueurs sont loin : l'ecran est coupe en deux moities, chaque
//          camera est centree sur son joueur ;
//   0 a 1 -> entre les deux : la camera du joueur QUI S'ELOIGNE apparait par le
//          bord de l'ecran vers lequel il part, et grandit petit a petit,
//          pendant que la camera de l'autre joueur se retrecit.
//
// Ce nombre depend de la DISTANCE entre les joueurs, et il rejoint sa valeur
// doucement (lissage) : la transition est fluide.
//
// Il y a deux cameras : scene.cameras.main (celle du joueur souris) et
// scene.camera2 (celle du joueur clavier).
//
// === Comment s'en servir ====================================================
//
//   dans create() :  creer_ecran_separe(this);
//   dans update() :  mettre_a_jour_ecran_separe(this, delta);
//   pour une souris : point_monde(this, pointeur.x, pointeur.y)
//
// La scene doit avoir this.joueur_souris et this.joueur_clavier, et
// this.carte (la carte Tiled). Une scene qui doit occuper tout l'ecran (un
// voyage en train...) met this.forcer_ecran_entier = true le temps qu'il faut.


// --- Reglages ------------------------------------------------------------

// Distance entre les joueurs, en "parts d'ecran entier" (1 = la largeur ou la
// hauteur du monde visible quand l'ecran est entier) :
//   - moins de seuil_debut : un seul ecran ;
//   - entre seuil_debut et seuil_fin : la separation se fait petit a petit ;
//   - plus de seuil_fin : deux moities egales.
var seuil_debut = 0.25;
var seuil_fin = 0.55;

// Vitesse du lissage (0.1 = doux, 0.3 = vif).
var lissage = 0.12;

// Vitesse des cameras : normale, puis plus vive pendant la separation (sinon
// elles prennent du retard et un joueur sort brievement du cadre).
var vitesse_camera = 0.1;
var vitesse_camera_separee = 0.35;

// La camera regarde un peu plus bas que le joueur (il remonte a l'ecran).
var decalage_vertical = 4;

// Demi-taille d'un personnage (il fait 16 x 16 pixels).
var demi_taille_joueur = 8;

var id_ligne = "ligne-separation-ecran"; // le <div> noir au milieu
var epaisseur_ligne = 4; // pixels d'ecran


// --- 1. Mise en place (dans create) ------------------------------------------

export function creer_ecran_separe(scene) {
  // la 2e camera : meme zoom que la principale, cachee tant qu'il n'y a pas de separation
  scene.camera2 = scene.cameras.add(0, 0, scene.scale.width, scene.scale.height);
  scene.camera2.setZoom(scene.cameras.main.zoom);
  scene.camera2.setBackgroundColor("#000000");
  scene.camera2.setVisible(false);

  scene.part_separation = 0; // 0 = un seul ecran
  scene.joueur_bande = scene.joueur_clavier; // le joueur dont la camera est la "bande" (voir plus bas)
  scene.bande_a_gauche = false; // la bande apparait-elle a gauche (sinon a droite) ?
  scene.historique_x = []; // les positions recentes des joueurs (pour savoir qui s'eloigne)
  scene.forcer_ecran_entier = false;

  // la ligne noire entre les deux moities : un <div> HTML pose sur le jeu
  var ligne = document.getElementById(id_ligne);
  if (ligne == null) {
    ligne = document.createElement("div");
    ligne.id = id_ligne;
    ligne.style.position = "absolute";
    ligne.style.top = "0";
    ligne.style.bottom = "0";
    ligne.style.width = epaisseur_ligne + "px";
    ligne.style.background = "#000000";
    ligne.style.pointerEvents = "none"; // ne bloque pas les clics sur le jeu
    var conteneur = scene.game.canvas.parentElement;
    conteneur.style.position = "relative";
    conteneur.appendChild(ligne);
  }
  ligne.style.display = "none";
}


// --- 2. Mise a jour (dans update, une fois par image) -------------------------

export function mettre_a_jour_ecran_separe(scene, delta) {
  // a) on retient les positions des joueurs (pour savoir qui s'eloigne)
  scene.historique_x.push({ souris: scene.joueur_souris.x, clavier: scene.joueur_clavier.x });
  if (scene.historique_x.length > 30) {
    scene.historique_x.shift(); // on garde environ la derniere demi-seconde
  }

  // b) a quel point faut-il separer l'ecran ? Et on s'en approche doucement.
  var voulue = separation_voulue(scene);
  var avant = scene.part_separation;
  // le "pow" rend la vitesse identique a 60 Hz et a 144 Hz (16.67 ms = une image a 60 Hz)
  var pas = 1 - Math.pow(1 - lissage, Math.min(delta, 100) / 16.67);
  scene.part_separation = scene.part_separation + (voulue - scene.part_separation) * pas;
  if (scene.part_separation < 0.001) {
    scene.part_separation = 0;
  }

  // c) la separation vient de commencer : on decide qui s'eloigne et de quel cote
  if (avant == 0 && scene.part_separation > 0) {
    decider_qui_s_eloigne(scene);
  }

  // d) on regle la taille des deux cameras, puis ce que chacune regarde
  placer_les_cameras(scene);
  deplacer_la_camera(scene, scene.cameras.main, point_regarde(scene, scene.cameras.main, scene.joueur_souris));
  deplacer_la_camera(scene, scene.camera2, point_regarde(scene, scene.camera2, scene.joueur_clavier));

  // e) un joueur ne doit pas apparaitre deux fois a l'ecran
  masquer_les_doublons(scene);
}


// --- 3. A quel point separer l'ecran ? ---------------------------------------

// Renvoie un nombre de 0 (un seul ecran) a 1 (deux moities), d'apres la
// distance entre les joueurs.
function separation_voulue(scene) {
  // une scene plein ecran est en cours (voyage en train...) : un seul ecran
  if (scene.forcer_ecran_entier == true) {
    return 0;
  }

  // taille du monde visible quand l'ecran est ENTIER (en pixels du monde)
  var zoom = scene.cameras.main.zoom;
  var largeur_monde = scene.scale.width / zoom;
  var hauteur_monde = scene.scale.height / zoom;

  // distance entre les joueurs, en "parts d'ecran" : la plus grande des deux
  // (un joueur tres haut au-dessus de l'autre separe aussi l'ecran)
  var part_horizontale = Math.abs(scene.joueur_souris.x - scene.joueur_clavier.x) / largeur_monde;
  var part_verticale = Math.abs(scene.joueur_souris.y - scene.joueur_clavier.y) / hauteur_monde;
  var eloignement = Math.max(part_horizontale, part_verticale);

  // avancement de 0 a 1 entre les deux seuils
  var avancement = Phaser.Math.Clamp((eloignement - seuil_debut) / (seuil_fin - seuil_debut), 0, 1);
  // on adoucit les deux bouts de la courbe (smoothstep)
  return avancement * avancement * (3 - 2 * avancement);
}


// --- 4. Qui s'eloigne ? ----------------------------------------------------

// Remplit scene.joueur_bande (le joueur qui s'eloigne) et scene.bande_a_gauche.
// Choisi une seule fois, au debut de la separation : les cameras ne
// s'echangent pas ensuite si les joueurs se croisent.
function decider_qui_s_eloigne(scene) {
  var souris = scene.joueur_souris;
  var clavier = scene.joueur_clavier;

  // distance parcourue par chacun depuis la plus ancienne position gardee
  var ancienne = scene.historique_x[0];
  var distance_souris = Math.abs(souris.x - ancienne.souris);
  var distance_clavier = Math.abs(clavier.x - ancienne.clavier);

  // celui qui s'eloigne = celui qui a le plus bouge (a egalite : le clavier)
  var autre;
  if (distance_souris > distance_clavier) {
    scene.joueur_bande = souris;
    autre = clavier;
  } else {
    scene.joueur_bande = clavier;
    autre = souris;
  }

  // la bande est du cote ou il se trouve par rapport a l'autre joueur
  scene.bande_a_gauche = scene.joueur_bande.x < autre.x;
}


// --- 5. Taille et position des deux cameras a l'ecran ------------------------
//
//   part = 0   : [ l'autre camera : TOUT l'ecran ][ bande : rien ]
//   part = 0.5 : [ l'autre camera : 75 %       ][ bande : 25 % ]
//   part = 1   : [ l'autre camera : 50 %      ][ bande : 50 % ]
//
// La "bande" est la camera du joueur qui s'eloigne ; elle est collee au bord
// de l'ecran vers lequel il part. Sur le schema elle est a droite ; a gauche,
// c'est le meme dessin en miroir.

function placer_les_cameras(scene) {
  var largeur = scene.scale.width;
  var hauteur = scene.scale.height;
  var principale = scene.cameras.main;
  var camera2 = scene.camera2;
  var ligne = document.getElementById(id_ligne);
  var part = scene.part_separation;

  // pas de separation : la camera principale prend tout l'ecran, la 2e est cachee
  if (part <= 0) {
    principale.setViewport(0, 0, largeur, hauteur);
    camera2.setVisible(false);
    ligne.style.display = "none";
    return;
  }

  // la bande est la camera du joueur qui s'eloigne
  var camera_bande = camera2;
  var camera_autre = principale;
  if (scene.joueur_bande == scene.joueur_souris) {
    camera_bande = principale;
    camera_autre = camera2;
  }

  // la bande grandit de rien (part = 0) jusqu'a la moitie de l'ecran (part = 1)
  var largeur_bande = Math.max(1, Math.round(largeur * 0.5 * part));
  var largeur_autre = largeur - largeur_bande;

  // setViewport(x, y, largeur, hauteur) : ou la camera dessine sur l'ecran
  var frontiere; // la position de la ligne noire
  if (scene.bande_a_gauche == true) {
    camera_bande.setViewport(0, 0, largeur_bande, hauteur);
    camera_autre.setViewport(largeur_bande, 0, largeur_autre, hauteur);
    frontiere = largeur_bande;
  } else {
    camera_autre.setViewport(0, 0, largeur_autre, hauteur);
    camera_bande.setViewport(largeur_autre, 0, largeur_bande, hauteur);
    frontiere = largeur_autre;
  }
  camera2.setVisible(true);

  // la ligne suit la frontiere ; elle apparait en fondu avec la separation
  ligne.style.display = "block";
  ligne.style.left = frontiere - epaisseur_ligne / 2 + "px";
  ligne.style.opacity = String(Math.min(1, part * 4));
}


// --- 6. Que regarde chaque camera ? -------------------------------------------
//
// Sans separation : le MILIEU entre les deux joueurs.
// Avec separation, trois regles se combinent :
//   1) RACCORD : au debut, les deux cameras montrent exactement ce que
//      montrerait un ecran unique centre sur le milieu, simplement decoupe en
//      deux (sinon on verrait un decalage le long de la ligne) ;
//   2) JAMAIS PERDU : un joueur reste toujours dans le cadre de SA camera ;
//   3) CENTRAGE : vers la fin, chaque camera se recentre sur son joueur.

function point_regarde(scene, camera, son_joueur) {
  var souris = scene.joueur_souris;
  var clavier = scene.joueur_clavier;
  var milieu_x = (souris.x + clavier.x) / 2;
  var milieu_y = (souris.y + clavier.y) / 2;
  var part = scene.part_separation;

  // un seul ecran : le milieu
  if (part <= 0) {
    return { x: milieu_x, y: milieu_y };
  }

  var zoom = scene.cameras.main.zoom;
  var largeur_monde = scene.scale.width / zoom;
  var hauteur_monde = scene.scale.height / zoom;

  // REGLE 1 (raccord). La camera occupe une region de l'ecran : son milieu est
  // a (camera.x + camera.width / 2). Par rapport au milieu de l'ecran entier,
  // ce decalage (divise par le zoom) donne le decalage dans le monde.
  var milieu_region = camera.x + camera.width / 2;
  var x = milieu_x + (milieu_region - scene.scale.width / 2) / zoom;
  var y = milieu_y;

  // REGLE 2 (jamais perdu). Le centre ne s'eloigne pas du joueur de plus de
  // 70 % de la demi-taille de la camera : le joueur reste dans le cadre.
  var limite_x = 0.7 * (camera.width / zoom / 2);
  var limite_y = 0.7 * (hauteur_monde / 2);
  x = Phaser.Math.Clamp(x, son_joueur.x - limite_x, son_joueur.x + limite_x);
  y = Phaser.Math.Clamp(y, son_joueur.y - limite_y, son_joueur.y + limite_y);

  // REGLE 3 (centrage). De part = 0.6 a 1, on glisse vers le centrage complet
  // sur son joueur. "poids" va de 0 a 1 (adouci).
  var avancement = Phaser.Math.Clamp((part - 0.6) / 0.4, 0, 1);
  var poids = avancement * avancement * (3 - 2 * avancement);
  x = Phaser.Math.Linear(x, son_joueur.x, poids); // Linear(a, b, p) = a + (b - a) * p
  y = Phaser.Math.Linear(y, son_joueur.y, poids);

  return { x: x, y: y };
}

// Fait glisser une camera vers le point (x, y) du monde, sans sortir de la carte.
//
// On raisonne sur le CENTRE de la vue, qu'on retient sur la camera
// (camera.centre_x / centre_y) : quand la largeur d'une camera change, la
// valeur "scrollX" de Phaser saute de plusieurs centaines de pixels alors que
// la vue ne bouge pas ; le centre, lui, ne depend pas de la taille.
function deplacer_la_camera(scene, camera, point) {
  var demi_largeur = camera.width / camera.zoom / 2;
  var demi_hauteur = camera.height / camera.zoom / 2;

  // le centre voulu, garde dans la carte (on ne voit jamais le noir autour)
  var voulu_x = Phaser.Math.Clamp(point.x, demi_largeur, Math.max(demi_largeur, scene.carte.widthInPixels - demi_largeur));
  var voulu_y = Phaser.Math.Clamp(point.y + decalage_vertical, demi_hauteur, Math.max(demi_hauteur, scene.carte.heightInPixels - demi_hauteur));

  // la toute premiere fois, on se place d'un coup (sinon la camera glisserait
  // depuis le coin de la carte jusqu'au joueur)
  if (camera.centre_x === undefined) {
    camera.centre_x = voulu_x;
    camera.centre_y = voulu_y;
  }

  // vitesse : douce normalement, vive pendant la separation
  var envie = Phaser.Math.Clamp(scene.part_separation * 5, 0, 1);
  var vitesse = Phaser.Math.Linear(vitesse_camera, vitesse_camera_separee, envie);

  camera.centre_x = Phaser.Math.Linear(camera.centre_x, voulu_x, vitesse);
  camera.centre_y = Phaser.Math.Linear(camera.centre_y, voulu_y, vitesse);

  // scrollX / scrollY = le centre moins la moitie de la taille de la camera
  camera.scrollX = camera.centre_x - camera.width / 2;
  camera.scrollY = camera.centre_y - camera.height / 2;
}


// --- 7. Un joueur ne doit jamais apparaitre deux fois --------------------------
//
// Pendant la separation, un joueur peut etre dans le champ des deux cameras :
// par exemple celui qui s'eloigne est visible au bord de la grande camera ET
// dans sa propre bande. On le verrait deux fois.
//
// Regle, pour chaque joueur (sa camera = "la sienne") :
//   - la SIENNE le dessine s'il est ENTIEREMENT dans son champ, ou s'il n'est
//     pas non plus dans le champ de l'autre (il faut bien le dessiner) ;
//   - l'AUTRE camera ne le dessine PAS s'il est entierement dans la sienne.

function masquer_les_doublons(scene) {
  appliquer_regle_doublon(scene, scene.joueur_souris, scene.cameras.main, scene.camera2);
  appliquer_regle_doublon(scene, scene.joueur_clavier, scene.camera2, scene.cameras.main);
}

function appliquer_regle_doublon(scene, joueur, camera_sienne, camera_autre) {
  // pas de separation : la 2e camera est cachee, tout le monde est visible
  if (scene.part_separation <= 0) {
    camera_dessine(joueur, camera_sienne, true);
    camera_dessine(joueur, camera_autre, true);
    return;
  }
  var entier_dans_sienne = dans_le_champ(camera_sienne, joueur, -demi_taille_joueur); // sprite en entier
  var visible_dans_autre = dans_le_champ(camera_autre, joueur, demi_taille_joueur); // au moins un bout

  camera_dessine(joueur, camera_sienne, entier_dans_sienne || !visible_dans_autre);
  camera_dessine(joueur, camera_autre, !entier_dans_sienne);
}

// true si le centre de l'objet est dans le champ de la camera, avec une marge
// (marge > 0 : champ agrandi ; marge < 0 : champ reduit).
function dans_le_champ(camera, objet, marge) {
  var demi_largeur = camera.width / camera.zoom / 2 + marge;
  var demi_hauteur = camera.height / camera.zoom / 2 + marge;
  return Math.abs(objet.x - camera.centre_x) <= demi_largeur && Math.abs(objet.y - camera.centre_y) <= demi_hauteur;
}

// Phaser garde pour chaque objet un masque de bits des cameras qui l'IGNORENT
// (cameraFilter) : mettre le bit de la camera = elle l'ignore, le retirer =
// elle le dessine.
function camera_dessine(objet, camera, dessine) {
  if (dessine == true) {
    objet.cameraFilter = objet.cameraFilter & ~camera.id;
  } else {
    objet.cameraFilter = objet.cameraFilter | camera.id;
  }
}


// --- 8. La souris et les deux cameras -----------------------------------------
//
// Quand l'ecran est separe, un meme point de l'ecran correspond a un endroit
// DIFFERENT du monde selon la camera qui est dessous. Pour savoir ou on a
// clique, on trouve d'abord la camera sous la souris, puis on convertit avec elle.

export function point_monde(scene, x_ecran, y_ecran) {
  var camera = scene.cameras.main;
  var camera2 = scene.camera2;
  if (camera2.visible == true && x_ecran >= camera2.x && x_ecran < camera2.x + camera2.width) {
    camera = camera2;
  }
  return camera.getWorldPoint(x_ecran, y_ecran);
}
