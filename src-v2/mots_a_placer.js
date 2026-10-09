// mots_a_placer.js — les gestes du joueur sur les mots d'un dialogue.
//
// Pendant un dialogue, le joueur remplit les trous d'une phrase avec des mots.
// Il peut le faire de deux facons :
//   - CLIQUER sur un mot : il vole tout seul jusqu'au premier trou libre
//     (recliquer sur un mot deja pose le renvoie dans la liste) ;
//   - le GLISSER avec la souris : le trou vise s'illumine, et un mot lache
//     pres d'un trou y est aspire (pas besoin de viser au pixel).
// Les mots de la liste se balancent doucement et grossissent au survol.
//
// Les mots et les trous sont crees par dialogue.js. Ce fichier ne s'occupe que
// de leurs gestes. L'etat du dialogue est dans scene.dialogue (voir dialogue.js) :
//   scene.dialogue.trous                   : la liste des trous de la page
//   scene.dialogue.quand_un_mot_est_pose() : appelee a chaque mot pose (une fonction)
//
// Un MOT est un objet texte avec ces proprietes ajoutees :
//   est_un_mot, trou_actuel (le trou ou il est, ou null), x_liste / y_liste (sa
//   place dans la liste), x_repos / y_repos (ou il revient s'il est lache dans
//   le vide), a_ete_glisse (le clic etait-il en fait un glisser ?).
// Un TROU est un rectangle avec : mot_dedans (le mot qu'il contient, ou null).


// --- 1. Les gestes de la souris (une fois, dans create) --------------------------

export function creer_gestes_des_mots(scene) {
  // en dessous de ce deplacement (en pixels d'ecran), c'est un clic et pas un glisser
  scene.input.dragDistanceThreshold = 3;

  // on commence a glisser un mot : il grossit et s'incline
  scene.input.on("dragstart", function (pointeur, objet) {
    if (objet.est_un_mot != true) {
      return;
    }
    objet.a_ete_glisse = true;
    arreter_balancement(objet);
    objet.setDepth(30); // au-dessus des autres mots
    scene.tweens.add({ targets: objet, scale: 1.3, angle: 6, duration: 90 });
  });

  // on glisse : le mot suit la souris
  scene.input.on("drag", function (pointeur, objet, x, y) {
    if (objet.est_un_mot != true) {
      return;
    }
    objet.x = x;
    objet.y = y;
  });

  // le mot arrive au-dessus d'un trou libre : le trou s'illumine
  scene.input.on("dragenter", function (pointeur, objet, trou) {
    if (objet.est_un_mot != true) {
      return;
    }
    if (trou.mot_dedans == null || trou.mot_dedans == objet) {
      style_du_trou(trou, "vise");
    }
  });
  scene.input.on("dragleave", function (pointeur, objet, trou) {
    if (objet.est_un_mot != true) {
      return;
    }
    style_du_trou(trou, "normal");
  });

  // on lache le mot sur un trou
  scene.input.on("drop", function (pointeur, objet, trou) {
    if (objet.est_un_mot != true) {
      return;
    }
    if (trou.mot_dedans != null && trou.mot_dedans != objet) {
      // trou deja occupe : le mot retourne ou il etait
      style_du_trou(trou, "normal");
      renvoyer_le_mot(scene, objet, objet.x_repos, objet.y_repos, null);
      return;
    }
    poser_le_mot(scene, objet, trou);
  });

  // fin du geste : s'il a ete lache dans le vide, on regarde s'il est pres d'un trou
  scene.input.on("dragend", function (pointeur, objet, depose) {
    if (objet.est_un_mot != true) {
      return;
    }
    objet.setDepth(25);
    if (depose == true) {
      return; // deja pose par "drop"
    }
    var proche = trou_libre_le_plus_proche(scene, objet, 16);
    if (proche != null) {
      poser_le_mot(scene, objet, proche); // aspire par le trou
    } else {
      renvoyer_le_mot(scene, objet, objet.x_repos, objet.y_repos, null);
    }
  });
}


// --- 2. Preparer un mot (appele pour chaque mot cree par dialogue.js) -------------

// rend le mot cliquable et glissable ; `retard` decale son balancement (ms)
export function preparer_le_mot(scene, mot, retard) {
  mot.est_un_mot = true;
  mot.trou_actuel = null;
  mot.a_ete_glisse = false;
  mot.x_liste = mot.x; // sa place dans la liste
  mot.y_liste = mot.y;
  mot.x_repos = mot.x;
  mot.y_repos = mot.y;

  mot.setInteractive({ draggable: true, useHandCursor: true });
  scene.input.setDraggable(mot);

  // la souris dessus : le mot grossit un peu ("attrape-moi")
  mot.on("pointerover", function () {
    if (mot.a_ete_glisse == false) {
      scene.tweens.add({ targets: mot, scale: 1.15, duration: 80 });
    }
  });
  mot.on("pointerout", function () {
    if (mot.a_ete_glisse == false) {
      scene.tweens.add({ targets: mot, scale: 1, duration: 80 });
    }
  });

  // un simple clic (sans glisser) : le mot vole tout seul vers son trou
  mot.on("pointerdown", function () {
    mot.a_ete_glisse = false;
  });
  mot.on("pointerup", function () {
    if (mot.a_ete_glisse == true) {
      mot.a_ete_glisse = false; // c'etait la fin d'un glisser, pas un clic
      return;
    }
    clic_sur_un_mot(scene, mot);
  });

  balancer_le_mot(scene, mot, retard);
}


// --- 3. Poser, renvoyer, cliquer ------------------------------------------------

// pose `mot` dans `trou` : il arrive en grossi puis se tasse sur le trou
function poser_le_mot(scene, mot, trou) {
  arreter_balancement(mot);

  // il quitte son ancien trou, s'il en avait un
  if (mot.trou_actuel != null && mot.trou_actuel != trou) {
    mot.trou_actuel.mot_dedans = null;
    style_du_trou(mot.trou_actuel, "normal");
  }

  // le milieu du trou (son origine est a gauche : x est son bord gauche)
  var milieu_x = trou.x + trou.width / 2;
  var milieu_y = trou.y;
  mot.x_repos = milieu_x; // s'il est reprise puis lache dans le vide, il revient ici
  mot.y_repos = milieu_y;
  trou.mot_dedans = mot;
  mot.trou_actuel = trou;
  style_du_trou(trou, "rempli");

  mot.setScale(1.35);
  scene.tweens.add({
    targets: mot, x: milieu_x, y: milieu_y, scale: 1, angle: 0,
    duration: 160, ease: "Back.easeOut"
  });

  // le dialogue verifie si tous les trous sont remplis
  scene.dialogue.quand_un_mot_est_pose();
}

// glisse le mot vers (x, y), taille et inclinaison normales
function renvoyer_le_mot(scene, mot, x, y, apres_le_retour) {
  scene.tweens.add({
    targets: mot, x: x, y: y, scale: 1, angle: 0,
    duration: 140, ease: "Cubic.easeOut",
    onComplete: apres_le_retour
  });
}

// clic simple sur un mot
function clic_sur_un_mot(scene, mot) {
  // il est dans un trou : il retourne dans la liste
  if (mot.trou_actuel != null) {
    var ancien = mot.trou_actuel;
    ancien.mot_dedans = null;
    mot.trou_actuel = null;
    style_du_trou(ancien, "normal");
    mot.x_repos = mot.x_liste;
    mot.y_repos = mot.y_liste;
    renvoyer_le_mot(scene, mot, mot.x_liste, mot.y_liste, function () {
      if (mot.trou_actuel == null && mot.active == true) {
        balancer_le_mot(scene, mot, 0);
      }
    });
    return;
  }

  // sinon il vole vers le premier trou libre (dans l'ordre de lecture)
  var trous = scene.dialogue.trous;
  for (var i = 0; i < trous.length; i++) {
    if (trous[i].mot_dedans == null) {
      poser_le_mot(scene, mot, trous[i]);
      return;
    }
  }
}

// le trou libre (ou deja le sien) le plus proche du mot, a moins de `distance_max`
function trou_libre_le_plus_proche(scene, mot, distance_max) {
  var meilleur = null;
  var meilleure_distance = distance_max;
  var trous = scene.dialogue.trous;
  for (var i = 0; i < trous.length; i++) {
    if (trous[i].mot_dedans != null && trous[i].mot_dedans != mot) {
      continue; // occupe par un autre mot
    }
    var distance = Phaser.Math.Distance.Between(mot.x, mot.y, trous[i].x + trous[i].width / 2, trous[i].y);
    if (distance < meilleure_distance) {
      meilleur = trous[i];
      meilleure_distance = distance;
    }
  }
  return meilleur;
}


// --- 4. Le trou et le balancement ------------------------------------------------

// l'apparence d'un trou : "normal" (vide), "vise" (un mot est dessus), "rempli"
export function style_du_trou(trou, etat) {
  if (etat == "vise") {
    trou.setFillStyle(0xffe600, 0.45);
    trou.setStrokeStyle(1, 0xffe600, 1);
  } else if (etat == "rempli" || trou.mot_dedans != null) {
    trou.setFillStyle(0xffffff, 0.05);
    trou.setStrokeStyle(1, 0xffffff, 0.25);
  } else {
    trou.setFillStyle(0xffffff, 0.15);
    trou.setStrokeStyle(1, 0xffffff, 0.6);
  }
}

// les mots de la liste se balancent doucement : ca donne envie de les attraper
function balancer_le_mot(scene, mot, retard) {
  mot.balancement = scene.tweens.add({
    targets: mot,
    angle: { from: -3, to: 3 },
    duration: 700,
    yoyo: true, // aller puis retour
    repeat: -1, // sans fin
    ease: "Sine.easeInOut",
    delay: retard
  });
}

function arreter_balancement(mot) {
  if (mot.balancement) {
    mot.balancement.remove();
    mot.balancement = null;
  }
}
