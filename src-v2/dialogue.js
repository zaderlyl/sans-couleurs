// dialogue.js — le dialogue avec un PNJ : un petit jeu de phrases a trous.
//
// Deroulement :
//   1. le PNJ dit sa phrase (au-dessus de lui) ;
//   2. le joueur "repond" : une phrase a trous s'affiche au-dessus de lui, et
//      les mots proposes sont en bas de l'ecran ; il les place dans les trous
//      (voir mots_a_placer.js pour les gestes) ;
//   3. s'il y a plusieurs pages, un clic passe a la suivante une fois la page remplie ;
//   4. peu importe les mots choisis, la reaction est la meme : le PNJ est mal a
//      l'aise (le joueur lui parait "different"). Il recule, dit "...", puis une
//      replique qui depend du dernier mot place, et il s'en va.
//
// Comment s'en servir (dans un niveau, voir niveau2.js) :
//   dans create() : creer_dialogue(this);
//   puis, pour parler a un PNJ (voir pnj.js) :
//     ouvrir_dialogue(this, pnj, function (sens) { ... le dialogue est fini ... });
//
// Un PNJ (voir pnj.js) a un champ "dialogue" :
//   { ligne, intro, pages, repliques }
//   - ligne     : ce que dit le PNJ ;
//   - intro     : une courte reponse automatique du joueur avant les pages ("" s'il n'y en a pas) ;
//   - pages     : une liste de pages, chacune { jetons, mots } ; un jeton est
//                 { trou: true } ou { texte: "un mot" }, et "mots" sont les
//                 mots proposes pour cette page ;
//   - repliques : { "mot": "ce que dit le PNJ" } (mots en minuscules).
//
// L'etat du dialogue en cours est dans scene.dialogue ; scene.dialogue_ouvert
// est true tant qu'il dure (les joueurs sont alors figes, voir niveau.js).

import { creer_gestes_des_mots, preparer_le_mot } from "./mots_a_placer.js";


// --- Reglages ------------------------------------------------------------

// l'aspect des textes poses dans le monde (petite police, agrandie par le zoom :
// "resolution" = le zoom, sinon le texte est flou)
var style_texte = {
  fontFamily: "DeltaruneExtended, monospace",
  fontSize: "6px",
  color: "#ffffff",
  stroke: "#000000",
  strokeThickness: 2,
  align: "center",
  wordWrap: { width: 120 },
  resolution: 5
};

// l'aspect d'un mot a placer : un petit fond derriere, comme une etiquette
var style_mot = {
  fontFamily: "DeltaruneExtended, monospace",
  fontSize: "6px",
  color: "#ffffff",
  stroke: "#000000",
  strokeThickness: 1,
  backgroundColor: "rgba(0, 0, 0, 0.55)",
  padding: { x: 2, y: 1 },
  resolution: 5
};

// les repliques du PNJ quand aucune n'est ecrite pour le mot choisi
// ("{mot}" est remplace par le mot que le joueur a place)
var repliques_generales = [
  "« {mot} » ? Tu dis ca bizarrement...",
  "Pourquoi tu parles comme ca ?",
  "« {mot} »... Euh... d'accord.",
  "Personne ne dit « {mot} » comme ca..."
];

var delai_affichage = 900; // ms : combien de temps on lit la phrase du PNJ, l'intro


// --- 1. Mise en place (une fois, dans create) ---------------------------------

export function creer_dialogue(scene) {
  scene.dialogue_ouvert = false;
  scene.dialogue = null;

  // les gestes sur les mots (clic, glisser) : voir mots_a_placer.js
  creer_gestes_des_mots(scene);

  // un clic dans le vide passe a la page suivante, quand la page est remplie.
  // "sous_la_souris" = les objets cliquables sous la souris : un clic sur un mot
  // ne compte pas.
  scene.input.on("pointerdown", function (pointeur, sous_la_souris) {
    var d = scene.dialogue;
    if (d != null && d.attend_un_clic == true && sous_la_souris.length == 0) {
      page_suivante(scene);
    }
  });
}


// --- 2. Ouvrir le dialogue --------------------------------------------------------

// quand_fini(sens) est appelee a la fin ; sens = -1 si le PNJ s'eloigne vers la
// gauche, 1 vers la droite
export function ouvrir_dialogue(scene, pnj, quand_fini) {
  scene.dialogue_ouvert = true; // les joueurs sont figes
  scene.dialogue = {
    pnj: pnj,
    quand_fini: quand_fini,
    elements: [], // tout ce qu'on a ajoute au monde (pour le retirer a la fin)
    trous: [], // les trous de la page
    mots: [], // les mots de la page
    ligne_du_joueur: [], // les mots et trous de la phrase du joueur
    indice_page: 0,
    mots_choisis: [], // tous les mots places, dans l'ordre (toutes pages)
    attend_un_clic: false, // la page est remplie, on attend un clic pour la suivante
    indicateur: null, // le petit triangle "continuer"
    fin_programmee: false,
    quand_un_mot_est_pose: function () {
      verifier_la_page(scene);
    }
  };

  // 1) le PNJ parle, au-dessus de lui
  var ligne = creer_texte(scene, pnj.dialogue.ligne, style_texte);
  ligne.setOrigin(0.5, 1);
  ligne.setPosition(pnj.x, pnj.y - 16 - 6);

  // 2) un instant plus tard : l'intro du joueur s'il y en a une, puis la 1re page
  scene.time.delayedCall(delai_affichage, function () {
    retirer(scene, ligne);
    if (pnj.dialogue.intro != "") {
      var intro = creer_texte(scene, pnj.dialogue.intro, style_texte);
      intro.setOrigin(0.5, 1);
      intro.setPosition(scene.joueur_souris.x, scene.joueur_souris.y - 16);
      scene.time.delayedCall(delai_affichage, function () {
        retirer(scene, intro);
        afficher_la_page(scene, 0);
      }, null, scene);
    } else {
      afficher_la_page(scene, 0);
    }
  }, null, scene);
}


// --- 3. Afficher une page ---------------------------------------------------------

function afficher_la_page(scene, indice) {
  var d = scene.dialogue;
  var page = d.pnj.dialogue.pages[indice];
  d.indice_page = indice;
  d.trous = [];
  d.mots = [];
  d.ligne_du_joueur = [];

  // la zone du monde reellement visible par la camera du joueur souris : sert a
  // poser les mots en bas de l'ecran, et a limiter la largeur de la phrase
  var vue = scene.cameras.main.worldView;
  var largeur_max = Math.min(vue.width - 20, 150);

  // 1) les mots (des maintenant : le trou prend la largeur du plus long mot)
  var melanges = Phaser.Utils.Array.Shuffle(page.mots.slice());
  var etiquettes = [];
  var largeur_trou = 18;
  for (var i = 0; i < melanges.length; i++) {
    var etiquette = creer_texte(scene, melanges[i], style_mot);
    etiquette.setOrigin(0.5, 0.5);
    etiquettes.push(etiquette);
    largeur_trou = Math.max(largeur_trou, etiquette.width + 4);
  }

  // 2) les morceaux de la phrase : des mots a lire et des trous
  var morceaux = []; // chacun : { objet, largeur }
  for (var j = 0; j < page.jetons.length; j++) {
    var jeton = page.jetons[j];
    var objet;
    var largeur;
    if (jeton.trou == true) {
      // un trou : un rectangle ou on peut deposer un mot
      objet = scene.add.rectangle(0, 0, largeur_trou, 8, 0xffffff, 0.15);
      objet.setStrokeStyle(1, 0xffffff, 0.6);
      objet.setInteractive({ dropZone: true });
      objet.mot_dedans = null;
      objet.setDepth(25);
      d.elements.push(objet);
      d.trous.push(objet);
      largeur = largeur_trou;
    } else {
      objet = creer_texte(scene, jeton.texte, style_texte);
      largeur = objet.width;
    }
    objet.setOrigin(0, 0.5);
    d.ligne_du_joueur.push(objet);
    morceaux.push({ objet: objet, largeur: largeur });
  }

  // 3) on regroupe les morceaux en lignes (retour a la ligne si c'est trop large)
  var espace = 4; // entre deux morceaux
  var lignes = [[]];
  var largeur_ligne = 0;
  for (var k = 0; k < morceaux.length; k++) {
    var ligne_courante = lignes[lignes.length - 1];
    var avec_espace = 0;
    if (ligne_courante.length > 0) {
      avec_espace = espace;
    }
    if (ligne_courante.length > 0 && largeur_ligne + avec_espace + morceaux[k].largeur > largeur_max) {
      lignes.push([morceaux[k]]); // nouvelle ligne
      largeur_ligne = morceaux[k].largeur;
    } else {
      ligne_courante.push(morceaux[k]);
      largeur_ligne = largeur_ligne + avec_espace + morceaux[k].largeur;
    }
  }

  // 4) on place chaque ligne, centree sur le joueur ; la derniere est juste au-dessus
  // de sa tete, les autres remontent
  var y_joueur = scene.joueur_souris.y - 16;
  for (var n = 0; n < lignes.length; n++) {
    var largeur_totale = 0;
    for (var m = 0; m < lignes[n].length; m++) {
      largeur_totale = largeur_totale + lignes[n][m].largeur;
      if (m > 0) {
        largeur_totale = largeur_totale + espace;
      }
    }
    var x = scene.joueur_souris.x - largeur_totale / 2;
    var y = y_joueur - (lignes.length - 1 - n) * 10;
    for (var p = 0; p < lignes[n].length; p++) {
      if (p > 0) {
        x = x + espace;
      }
      lignes[n][p].objet.setPosition(x, y);
      x = x + lignes[n][p].largeur;
    }
  }

  // 5) les mots a placer : une rangee centree, en bas de la zone visible
  var ecart_mots = 6;
  var largeur_mots = 0;
  for (var q = 0; q < etiquettes.length; q++) {
    largeur_mots = largeur_mots + etiquettes[q].width;
    if (q > 0) {
      largeur_mots = largeur_mots + ecart_mots;
    }
  }
  var x_mot = vue.centerX - largeur_mots / 2;
  for (var r = 0; r < etiquettes.length; r++) {
    etiquettes[r].setPosition(x_mot + etiquettes[r].width / 2, vue.bottom - 14);
    x_mot = x_mot + etiquettes[r].width + ecart_mots;
    preparer_le_mot(scene, etiquettes[r], r * 120); // le mot devient cliquable et glissable
    d.mots.push(etiquettes[r]);
  }

  // une page sans trou (juste du texte) : rien ne sera depose, on verifie tout de suite
  verifier_la_page(scene);
}


// --- 4. La page est-elle remplie ? -------------------------------------------------

function verifier_la_page(scene) {
  var d = scene.dialogue;

  // un trou vide : on continue d'attendre
  for (var i = 0; i < d.trous.length; i++) {
    if (d.trous[i].mot_dedans == null) {
      return;
    }
  }

  var est_la_derniere = d.indice_page >= d.pnj.dialogue.pages.length - 1;

  if (est_la_derniere == false) {
    // il reste des pages : un petit triangle dit "clique pour continuer"
    d.attend_un_clic = true;
    var dernier = d.ligne_du_joueur[d.ligne_du_joueur.length - 1];
    d.indicateur = creer_texte(scene, " ▶", style_texte);
    d.indicateur.setOrigin(0, 0.5);
    d.indicateur.setPosition(dernier.x + dernier.width, scene.joueur_souris.y - 16);
    return;
  }

  // derniere page remplie : la reaction du PNJ, apres un court instant. Une
  // seule fois, et les mots ne bougent plus.
  if (d.fin_programmee == true) {
    return;
  }
  d.fin_programmee = true;
  for (var j = 0; j < d.mots.length; j++) {
    d.mots[j].disableInteractive();
  }
  scene.time.delayedCall(600, function () {
    jouer_la_reaction(scene);
  }, null, scene);
}

// clic pour passer a la page suivante : on efface la page et on affiche la suivante
function page_suivante(scene) {
  var d = scene.dialogue;
  noter_les_mots_choisis(scene);
  d.attend_un_clic = false;
  d.indicateur = null;
  retirer_tout(scene); // la page entiere : phrase, trous, mots, triangle
  afficher_la_page(scene, d.indice_page + 1);
}

// ajoute les mots poses dans les trous de la page a d.mots_choisis
function noter_les_mots_choisis(scene) {
  var d = scene.dialogue;
  for (var i = 0; i < d.trous.length; i++) {
    if (d.trous[i].mot_dedans != null) {
      d.mots_choisis.push(d.trous[i].mot_dedans.text);
    }
  }
}


// --- 5. La reaction du PNJ ------------------------------------------------------------

// Le PNJ est mal a l'aise : la phrase du joueur s'estompe, il recule d'un pas,
// une bulle "..." puis une replique (selon le dernier mot place). Ensuite tout
// disparait et le PNJ s'en va.
function jouer_la_reaction(scene) {
  var d = scene.dialogue;
  var pnj = d.pnj;

  // la phrase du joueur et ses mots s'estompent (le silence gene)
  var du_joueur = d.ligne_du_joueur.concat(d.mots);
  for (var i = 0; i < du_joueur.length; i++) {
    scene.tweens.killTweensOf(du_joueur[i]); // arrete les balancements
    du_joueur[i].setAngle(0);
    du_joueur[i].setScale(1);
  }
  scene.tweens.add({ targets: du_joueur, alpha: 0.4, duration: 300 });

  // le PNJ recule d'un pas, a l'oppose du joueur
  var sens = 1;
  if (pnj.sprite.x < scene.joueur_souris.x) {
    sens = -1;
  }
  scene.tweens.add({ targets: pnj.sprite, x: pnj.sprite.x + sens * 8, duration: 250, ease: "Sine.easeOut" });

  // la bulle : d'abord "...", puis la replique du dernier mot place
  noter_les_mots_choisis(scene);
  var replique = choisir_la_replique(pnj, d.mots_choisis[d.mots_choisis.length - 1]);
  var bulle = creer_texte(scene, "...", style_texte);
  bulle.setOrigin(0.5, 1);
  bulle.setPosition(pnj.sprite.x + sens * 8, pnj.y - 16 - 6);
  scene.time.delayedCall(700, function () {
    bulle.setText(replique);
  }, null, scene);

  // on laisse le temps de lire (plus la replique est longue, plus on attend)
  var duree = Math.max(1600, 700 + 50 * replique.length);
  scene.time.delayedCall(duree, function () {
    retirer_tout(scene);
    scene.dialogue_ouvert = false; // les joueurs sont libres
    scene.dialogue = null;
    d.quand_fini(sens); // le PNJ s'en va (voir pnj.js)
  }, null, scene);
}

// la replique ecrite dans Tiled pour ce mot, sinon une replique generale au hasard
function choisir_la_replique(pnj, mot) {
  if (mot != undefined && pnj.dialogue.repliques[mot.toLowerCase()] != undefined) {
    return pnj.dialogue.repliques[mot.toLowerCase()];
  }
  var modele = Phaser.Utils.Array.GetRandom(repliques_generales);
  if (mot == undefined) {
    mot = "...";
  }
  return modele.replace("{mot}", mot);
}


// --- 6. Les textes poses dans le monde ----------------------------------------------------

// cree un texte dans le monde (au-dessus de tout), retenu dans scene.dialogue.elements
function creer_texte(scene, texte, style) {
  var objet = scene.add.text(0, 0, texte, style);
  // pixelArt: true met les textures en "NEAREST" : parfait pour les sprites,
  // flou pour un texte agrandi. On repasse ce texte en "LINEAR".
  objet.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  objet.setDepth(25);
  scene.dialogue.elements.push(objet);
  return objet;
}

// retire un seul element
function retirer(scene, objet) {
  scene.tweens.killTweensOf(objet);
  var d = scene.dialogue;
  d.elements.splice(d.elements.indexOf(objet), 1);
  objet.destroy();
}

// retire tout ce que le dialogue a ajoute au monde
function retirer_tout(scene) {
  var d = scene.dialogue;
  for (var i = 0; i < d.elements.length; i++) {
    scene.tweens.killTweensOf(d.elements[i]);
    d.elements[i].destroy();
  }
  d.elements = [];
  d.trous = [];
  d.mots = [];
  d.ligne_du_joueur = [];
}
