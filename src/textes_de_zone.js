// textes_de_zone.js — des phrases fixes dans le monde, qui s'ecrivent quand un
// joueur entre dans leur zone (effet "machine a ecrire").
//
// Tout est defini dans Tiled : un rectangle sur le calque d'objets, avec une
// propriete "texte" (la phrase). Le texte s'ecrit au-dessus du rectangle, reste
// lisible un moment, puis se dissipe en s'effacant et en se floutant. Une seule
// fois par texte : une fois dissipe, il ne rejoue plus.
// Si le joueur sort de la zone AVANT la fin de l'ecriture, le texte disparait
// et recommencera quand il reviendra.
//
// Comment s'en servir (dans niveau.js) :
//   creer_textes_de_zone(this);          // dans create
//   mettre_a_jour_textes_de_zone(this);  // dans update

import { style_texte } from "./styles.js";

var delai_par_lettre = 70; // ms entre deux lettres
var duree_affichage = 1800; // ms : le texte reste lisible une fois ecrit
var duree_disparition = 1000; // ms : il s'efface et se floute
var intensite_du_flou = 6;


export function creer_textes_de_zone(scene) {
  scene.textes_de_zone = [];

  var objets = scene.carte.getObjectLayer("Calque d'Objets 1").objects;
  for (var i = 0; i < objets.length; i++) {
    // la phrase : la propriete "texte" de l'objet (s'il en a une)
    var phrase = null;
    var proprietes = objets[i].properties || [];
    for (var j = 0; j < proprietes.length; j++) {
      if (proprietes[j].name == "texte") {
        phrase = proprietes[j].value;
      }
    }
    if (phrase == null || phrase == "") {
      continue; // cet objet n'est pas un texte de zone
    }

    // le texte : au-dessus du milieu du rectangle, cache au depart
    var objet = scene.add.text(objets[i].x + objets[i].width / 2, objets[i].y, "", style_texte);
    objet.setOrigin(0.5, 1);
    objet.setDepth(20);
    objet.setVisible(false);
    // pixelArt: true met les textures en NEAREST : flou pour un texte agrandi.
    // On repasse celui-ci en LINEAR.
    objet.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);

    // un flou, pour la disparition (si la carte graphique ne sait pas le faire,
    // on s'en passe : ce n'est que du decor)
    var flou = null;
    try {
      flou = objet.postFX.addBlur(0, 0.5, 0.5, 0, 0xffffff, 4);
    } catch (erreur) {
      flou = null;
    }

    scene.textes_de_zone.push({
      zone: new Phaser.Geom.Rectangle(objets[i].x, objets[i].y, objets[i].width, objets[i].height),
      phrase: phrase,
      objet: objet,
      flou: flou,
      // "inactif" (jamais entre, ou ressorti avant la fin), "ecriture",
      // "fini" (ecrit, il reste lisible), "termine" (dissipe : plus jamais)
      etat: "inactif",
      minuteur: null // le timer qui ajoute une lettre
    });
  }
}

export function mettre_a_jour_textes_de_zone(scene) {
  var joueurs = [scene.joueur_souris, scene.joueur_clavier];

  for (var i = 0; i < scene.textes_de_zone.length; i++) {
    var texte = scene.textes_de_zone[i];
    if (texte.etat == "fini" || texte.etat == "termine") {
      continue; // plus rien a decider : il se dissipe tout seul
    }

    // L'UN des deux joueurs est-il dans la zone ?
    var dedans = false;
    for (var j = 0; j < joueurs.length; j++) {
      if (Phaser.Geom.Rectangle.Contains(texte.zone, joueurs[j].x, joueurs[j].y)) {
        dedans = true;
      }
    }

    if (dedans == true && texte.etat == "inactif") {
      commencer_a_ecrire(scene, texte);
    } else if (dedans == false && texte.etat == "ecriture") {
      // sorti avant la fin : on arrete tout, ca recommencera au retour
      texte.minuteur.remove();
      texte.etat = "inactif";
      texte.objet.setVisible(false);
    }
  }
}

// la premiere lettre apparait tout de suite, les suivantes toutes les 70 ms
function commencer_a_ecrire(scene, texte) {
  texte.etat = "ecriture";
  texte.objet.setAlpha(1);
  texte.objet.setVisible(true);
  var nombre_de_lettres = 1;
  texte.objet.setText(texte.phrase.slice(0, nombre_de_lettres));

  texte.minuteur = scene.time.addEvent({
    delay: delai_par_lettre,
    loop: true,
    callback: function () {
      nombre_de_lettres = nombre_de_lettres + 1;
      texte.objet.setText(texte.phrase.slice(0, nombre_de_lettres));
      if (nombre_de_lettres >= texte.phrase.length) {
        // tout est ecrit : il reste lisible un moment, puis il se dissipe
        texte.minuteur.remove();
        texte.etat = "fini";
        scene.time.delayedCall(duree_affichage, function () {
          dissiper(scene, texte);
        }, null, scene);
      }
    }
  });

  // une phrase d'une seule lettre : deja finie
  if (texte.phrase.length <= 1) {
    texte.minuteur.remove();
    texte.etat = "fini";
    scene.time.delayedCall(duree_affichage, function () {
      dissiper(scene, texte);
    }, null, scene);
  }
}

// le texte s'efface et se floute, puis disparait pour de bon
function dissiper(scene, texte) {
  scene.tweens.add({
    targets: texte.objet,
    alpha: 0,
    duration: duree_disparition,
    ease: "Sine.easeIn",
    onComplete: function () {
      texte.etat = "termine";
      texte.objet.setVisible(false);
    }
  });
  if (texte.flou != null) {
    scene.tweens.add({
      targets: texte.flou,
      strength: intensite_du_flou,
      duration: duree_disparition,
      ease: "Sine.easeIn"
    });
  }
}
