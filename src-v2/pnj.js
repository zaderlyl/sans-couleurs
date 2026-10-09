// pnj.js — les personnages non joueurs (PNJ) : des enfants qu'on peut interroger.
//
// Chaque PNJ est place dans Tiled : un objet "point" sur le calque
// "Calque d'Objets 1", avec ces proprietes :
//   - ligneNPJ (texte, obligatoire) : la phrase du PNJ, et le marqueur "ceci est un PNJ" ;
//   - intro (texte, optionnel) : une courte reponse automatique du joueur ;
//   - phrase (texte) : la reponse du joueur, avec "{}" pour chaque trou. Un
//     saut de ligne coupe en pages ;
//   - mots (texte) : les mots a placer, separes par des virgules, dans l'ordre
//     des trous (puis des pages) ;
//   - repliques (texte, optionnel) : ce que dit le PNJ selon le dernier mot
//     place, "mot: reponse | mot: reponse" ;
//   - frame (nombre, optionnel) : quel enfant dans la feuille d'images (0 a 3) ;
//   - ordre (nombre, optionnel) : le rang d'apparition (le plus petit d'abord ;
//     par defaut la position x, donc de gauche a droite).
//
// Les PNJ apparaissent UN A LA FOIS : au depart seul le premier est la. Une fois
// son dialogue termine, il s'en va en marchant, et le suivant apparait.
//
// Le joueur souris : survole un PNJ (l'icone "E" apparait et le PNJ tremble),
// clique, marche jusqu'a lui, puis le dialogue s'ouvre (voir dialogue.js).
//
// Comment s'en servir (dans un niveau, voir niveau2.js) :
//   creer_dialogue(this);  creer_pnjs(this);          // dans creer_particularites
//   mettre_a_jour_pnjs(this);                         // dans mettre_a_jour_particularites

import { ouvrir_dialogue } from "./dialogue.js";
import { est_un_clic_de_tir } from "./tir.js";


// --- 1. Mise en place (dans create) ------------------------------------------

export function creer_pnjs(scene) {
  scene.pnjs = [];

  // tous les objets du calque d'objets de la carte
  var objets = scene.carte.getObjectLayer("Calque d'Objets 1").objects;

  for (var i = 0; i < objets.length; i++) {
    var objet = objets[i];
    // un PNJ est un objet qui a la propriete "ligneNPJ"
    if (lire_propriete(objet, "ligneNPJ", null) == null) {
      continue;
    }
    scene.pnjs.push(creer_un_pnj(scene, objet));
  }

  // dans l'ordre d'apparition : le plus petit "ordre" d'abord
  scene.pnjs.sort(function (a, b) {
    return a.ordre - b.ordre;
  });

  // un seul est visible au depart : le premier
  montrer_seulement_le_pnj_actuel(scene);
}

// cree un PNJ a partir d'un objet de la carte Tiled
function creer_un_pnj(scene, objet) {
  var pnj = {};
  pnj.x = objet.x;
  pnj.y = objet.y;
  pnj.ordre = Number(lire_propriete(objet, "ordre", objet.x));
  pnj.termine = false; // true quand son dialogue est fini
  pnj.en_cours = false; // l'animation "E qui eclate" est en cours
  pnj.souris_dessus = false;

  // le personnage : ses pieds sont au point de l'objet
  pnj.sprite = scene.add.sprite(objet.x, objet.y, "img_pnj", Number(lire_propriete(objet, "frame", 0)));
  pnj.sprite.setOrigin(0.5, 1);
  pnj.sprite.setDepth(4);
  // "pixelPerfect" : seuls les pixels dessines du personnage reagissent a la
  // souris, pas le carre transparent autour de lui
  pnj.sprite.setInteractive({ pixelPerfect: true, useHandCursor: true });

  // l'icone "E", au-dessus de sa tete
  pnj.icone = scene.add.sprite(objet.x, objet.y - 32, "img_icone_e", 0);
  pnj.icone.setDepth(20);
  pnj.icone.setVisible(false);

  // ce qu'il dit
  pnj.dialogue = {
    ligne: lire_propriete(objet, "ligneNPJ", ""),
    intro: lire_propriete(objet, "intro", ""),
    pages: lire_les_pages(lire_propriete(objet, "phrase", ""), lire_propriete(objet, "mots", "")),
    repliques: lire_les_repliques(lire_propriete(objet, "repliques", ""))
  };

  // la souris entre / sort du PNJ
  pnj.sprite.on("pointerover", function () {
    pnj.souris_dessus = true;
  });
  pnj.sprite.on("pointerout", function () {
    pnj.souris_dessus = false;
  });

  // clic sur le PNJ : le joueur souris marche jusqu'a lui, puis lui parle
  pnj.sprite.on("pointerdown", function (pointeur) {
    if (est_un_clic_de_tir(pointeur) == true) {
      return; // Ctrl / Cmd : c'est un tir
    }
    if (pnj != pnj_actuel(scene) || scene.dialogue_ouvert == true) {
      return;
    }
    scene.aller_vers(pnj.x, function () {
      parler_au_pnj(scene, pnj);
    });
  });

  return pnj;
}

// la valeur d'une propriete d'un objet Tiled (ou `defaut` s'il ne l'a pas)
function lire_propriete(objet, nom, defaut) {
  var proprietes = objet.properties || [];
  for (var i = 0; i < proprietes.length; i++) {
    if (proprietes[i].name == nom) {
      return proprietes[i].value;
    }
  }
  return defaut;
}

// "Il sont {} , et {} ." + "blanc, froid"  ->  une liste de pages
// Une page : { jetons: [{texte:"Il"}, {texte:"sont"}, {trou:true}, ...], mots: ["blanc", "froid"] }
function lire_les_pages(phrase, mots_bruts) {
  // les mots, separes par des virgules, sans espaces autour
  var tous_les_mots = [];
  var morceaux_de_mots = mots_bruts.split(",");
  for (var i = 0; i < morceaux_de_mots.length; i++) {
    var mot = morceaux_de_mots[i].trim();
    if (mot.length > 0) {
      tous_les_mots.push(mot);
    }
  }

  var pages = [];
  var mots_deja_donnes = 0; // les mots sont distribues aux pages dans l'ordre
  var lignes = phrase.split("\n"); // un saut de ligne = une nouvelle page
  for (var j = 0; j < lignes.length; j++) {
    var jetons = [];
    var nombre_de_trous = 0;
    var parties = lignes[j].split("{}"); // chaque "{}" est un trou entre deux parties
    for (var k = 0; k < parties.length; k++) {
      // la partie de texte, mot par mot
      var mots_de_la_partie = parties[k].split(" ");
      for (var m = 0; m < mots_de_la_partie.length; m++) {
        if (mots_de_la_partie[m].length > 0) {
          jetons.push({ texte: mots_de_la_partie[m] });
        }
      }
      // puis le trou (sauf apres la derniere partie)
      if (k < parties.length - 1) {
        jetons.push({ trou: true });
        nombre_de_trous = nombre_de_trous + 1;
      }
    }
    // un mot par trou, pour cette page
    pages.push({
      jetons: jetons,
      mots: tous_les_mots.slice(mots_deja_donnes, mots_deja_donnes + nombre_de_trous)
    });
    mots_deja_donnes = mots_deja_donnes + nombre_de_trous;
  }
  return pages;
}

// "blanc: Pourquoi ? | froid: Bizarre..."  ->  { blanc: "Pourquoi ?", froid: "Bizarre..." }
function lire_les_repliques(texte) {
  var repliques = {};
  var morceaux = texte.split("|");
  for (var i = 0; i < morceaux.length; i++) {
    var coupure = morceaux[i].indexOf(":"); // le premier ":" separe le mot de la replique
    if (coupure == -1) {
      continue;
    }
    var mot = morceaux[i].slice(0, coupure).trim().toLowerCase();
    var replique = morceaux[i].slice(coupure + 1).trim();
    if (mot != "" && replique != "") {
      repliques[mot] = replique;
    }
  }
  return repliques;
}


// --- 2. Le PNJ du moment -----------------------------------------------------------

// le PNJ qu'on peut voir et interroger : le premier dont le dialogue n'est pas fini
function pnj_actuel(scene) {
  for (var i = 0; i < scene.pnjs.length; i++) {
    if (scene.pnjs[i].termine == false) {
      return scene.pnjs[i];
    }
  }
  return null;
}

// seul le PNJ actuel est visible et reagit a la souris
function montrer_seulement_le_pnj_actuel(scene) {
  var actuel = pnj_actuel(scene);
  for (var i = 0; i < scene.pnjs.length; i++) {
    var pnj = scene.pnjs[i];
    if (pnj.termine == false) {
      pnj.sprite.setVisible(pnj == actuel);
      pnj.sprite.input.enabled = (pnj == actuel);
    }
  }
}


// --- 3. Mise a jour (dans update) -----------------------------------------------------

export function mettre_a_jour_pnjs(scene) {
  var actuel = pnj_actuel(scene);
  if (actuel == null) {
    return;
  }

  // la souris sur le PNJ : l'icone apparait et le PNJ tremble ("on peut cliquer").
  // Pas en mode tir (la souris sert a viser), ni pendant un dialogue.
  var survole = actuel.souris_dessus == true && scene.en_mode_tir != true
    && scene.dialogue_ouvert != true && actuel.en_cours == false;

  if (actuel.en_cours == false) {
    actuel.icone.setVisible(survole);
    if (survole == true) {
      actuel.icone.anims.play("anim_icone_attente", true);
    }
  }

  if (scene.dialogue_ouvert != true) {
    var tremblement_x = 0;
    var tremblement_y = 0;
    if (survole == true) {
      tremblement_x = Phaser.Math.Between(-1, 1);
      tremblement_y = Phaser.Math.Between(-1, 1);
    }
    actuel.sprite.setPosition(actuel.x + tremblement_x, actuel.y + tremblement_y);
  }
}


// --- 4. Parler a un PNJ, puis le voir partir -------------------------------------------

// le joueur est arrive devant le PNJ : l'icone "E" eclate, puis le dialogue s'ouvre
function parler_au_pnj(scene, pnj) {
  pnj.en_cours = true;
  pnj.sprite.setPosition(pnj.x, pnj.y); // il arrete de trembler
  pnj.icone.setVisible(true);
  pnj.icone.play("anim_icone_pressee");

  pnj.icone.once("animationcomplete", function () {
    pnj.icone.setVisible(false);
    pnj.en_cours = false;
    ouvrir_dialogue(scene, pnj, function (sens) {
      pnj_a_fini(scene, pnj, sens);
    });
  });
}

// le dialogue est fini : le PNJ ne peut plus etre interroge ; il s'en va, puis le suivant apparait
function pnj_a_fini(scene, pnj, sens) {
  pnj.termine = true;
  pnj.icone.destroy();
  pnj.sprite.input.enabled = false;

  var sprite = pnj.sprite;
  sprite.setFlipX(sens < 0); // il se retourne : il regarde dans le sens ou il part

  // il s'eloigne a petits pas (de petits sauts : la feuille n'a pas d'animation
  // de marche) pendant 1,4 s, en s'effacant
  scene.tweens.add({
    targets: sprite, y: sprite.y - 1, duration: 120, yoyo: true, repeat: 5
  });
  scene.tweens.add({
    targets: sprite,
    x: sprite.x + sens * 36,
    alpha: 0,
    duration: 1400,
    ease: "Sine.easeIn",
    onComplete: function () {
      scene.tweens.killTweensOf(sprite);
      sprite.destroy();
      faire_apparaitre_le_suivant(scene);
    }
  });
}

// le PNJ suivant surgit en grandissant (un petit "pop")
function faire_apparaitre_le_suivant(scene) {
  var suivant = pnj_actuel(scene);
  if (suivant == null) {
    return; // plus aucun PNJ
  }
  montrer_seulement_le_pnj_actuel(scene);
  suivant.sprite.setScale(0);
  scene.tweens.add({ targets: suivant.sprite, scale: 1, duration: 350, ease: "Back.easeOut" });
}
