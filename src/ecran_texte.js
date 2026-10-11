// ecran_texte.js — un grand ecran noir avec du texte blanc par-dessus le jeu.
//
// C'est un <div> HTML (pas un objet du jeu) : il couvre tout l'ecran, quelle
// que soit la camera. Deux usages :
//   - afficher_phrases(scene, [...], quand_fini) : des phrases qui s'ecrivent
//     lettre par lettre ; un clic finit la phrase en cours, puis passe a la
//     suivante (le voyage en train, voir gare.js) ;
//   - afficher_texte(scene, "...", quand_clic) : un texte affiche d'un coup,
//     jusqu'au prochain clic (l'ecran d'effondrement du college, voir phrases.js).

import { t } from "./langue.js";

var delai_par_lettre = 70; // ms : l'effet "machine a ecrire"
var taille_de_police = 28; // px : la taille normale du texte
var taille_minimum = 12; // px : on ne le rend pas plus petit que ca

// Si le texte deborde de l'ecran (fenetre petite), on reduit la police jusqu'a ce
// que tout tienne : rien ne doit etre coupe.
function faire_tenir(ecran) {
  var taille = taille_de_police;
  ecran.style.fontSize = taille + "px";
  while (ecran.scrollHeight > ecran.clientHeight && taille > taille_minimum) {
    taille = taille - 2;
    ecran.style.fontSize = taille + "px";
  }
}


// l'ecran noir (cree la premiere fois, ensuite reutilise)
function obtenir_l_ecran(scene) {
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
    ecran.style.whiteSpace = "pre-line"; // les retours a la ligne ("\n") sont respectes
    ecran.style.fontFamily = "DeltaruneExtended, monospace";
    ecran.style.fontSize = "28px";
    ecran.style.padding = "40px";
    ecran.style.cursor = "pointer";
    ecran.style.zIndex = "10"; // au-dessus de tout (les voiles...)
    // un clic sur cet ecran ne doit pas "traverser" jusqu'au jeu (sinon il declenche
    // le bouton ou l'objet qui se trouve dessous)
    ["mousedown", "mouseup", "pointerdown", "pointerup", "touchstart", "touchend"].forEach(function (evenement) {
      ecran.addEventListener(evenement, function (e) {
        e.stopPropagation();
      });
    });
    scene.game.canvas.parentElement.style.position = "relative";
    scene.game.canvas.parentElement.appendChild(ecran);
  }
  ecran.style.display = "flex";
  ecran.style.fontSize = taille_de_police + "px";
  ecran.style.flexDirection = "";
  ecran.style.alignItems = "center";
  ecran.style.justifyContent = "center";
  ecran.style.gap = "";
  ecran.style.textAlign = "center";
  ecran.textContent = "";

  // si la scene s'arrete avant la fin, on referme l'ecran
  scene.events.once("shutdown", function () {
    ecran.style.display = "none";
    ecran.onclick = null;
  });
  return ecran;
}

function refermer(ecran) {
  ecran.style.display = "none";
  ecran.onclick = null;
}


// --- Des phrases qui s'ecrivent, puis `quand_fini` --------------------------------

export function afficher_phrases(scene, phrases, quand_fini) {
  phrases = phrases.map(t); // dans la langue choisie
  var ecran = obtenir_l_ecran(scene);

  var indice_phrase = 0; // quelle phrase
  var nombre_de_lettres = 0; // combien de lettres sont deja ecrites

  // la phrase en entier d'abord (pour regler la taille de la police), puis on la vide
  function mesurer_la_phrase() {
    ecran.textContent = phrases[indice_phrase];
    faire_tenir(ecran);
    ecran.textContent = "";
  }
  mesurer_la_phrase();

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
      refermer(ecran);
      quand_fini();
      return;
    }
    mesurer_la_phrase();
  };
}


// --- Un texte affiche d'un coup, jusqu'au prochain clic ---------------------------

export function afficher_texte(scene, texte, quand_clic) {
  var ecran = obtenir_l_ecran(scene);
  ecran.textContent = t(texte);
  faire_tenir(ecran);
  ecran.onclick = function () {
    refermer(ecran);
    quand_clic();
  };
}


// --- Un dialogue entre les deux parts du personnage, sur l'ecran noir ----------------
//
// lignes = [ { qui: "j1", texte: "..." }, { qui: "j2", texte: "..." }, ... ]
// Les repliques s'ecrivent lettre par lettre, l'une apres l'autre, et RESTENT a
// l'ecran : on lit la conversation en entier. Les repliques de J1 sont a gauche
// (blanc sur noir) ; celles de J2 sont a droite, en couleurs inversees (noir sur
// blanc), comme le personnage lui-meme. Un clic finit la replique en cours, puis
// passe a la suivante ; apres la derniere, un clic ferme l'ecran.

export function afficher_dialogue(scene, lignes, quand_fini) {
  // les repliques dans la langue choisie
  var lignes_traduites = [];
  for (var i = 0; i < lignes.length; i++) {
    lignes_traduites.push({ qui: lignes[i].qui, texte: t(lignes[i].texte) });
  }
  lignes = lignes_traduites;
  var ecran = obtenir_l_ecran(scene);
  ecran.style.flexDirection = "column";
  ecran.style.alignItems = "stretch";
  ecran.style.justifyContent = "center";
  ecran.style.gap = "28px";
  ecran.style.textAlign = "left";
  ecran.innerHTML = "";

  var indice = 0; // quelle replique
  var nombre_de_lettres = 0; // combien de lettres sont deja ecrites
  var bloc = null; // l'element de la replique en cours

  function nouvelle_replique() {
    bloc = document.createElement("div");
    bloc.style.maxWidth = "62%";
    bloc.style.padding = "10px 16px";
    if (lignes[indice].qui == "j2") {
      bloc.style.alignSelf = "flex-end"; // J2 : a droite, couleurs inversees
      bloc.style.background = "#ffffff";
      bloc.style.color = "#000000";
      bloc.style.textAlign = "left";
    } else {
      bloc.style.alignSelf = "flex-start"; // J1 : a gauche
      bloc.style.border = "2px solid #ffffff";
    }
    ecran.appendChild(bloc);
    bloc.textContent = lignes[indice].texte; // d'abord en entier, pour mesurer
    faire_tenir(ecran);
    bloc.textContent = "";
    nombre_de_lettres = 0;
  }
  nouvelle_replique();

  var minuteur = scene.time.addEvent({
    delay: delai_par_lettre / 2,
    loop: true,
    callback: function () {
      if (nombre_de_lettres < lignes[indice].texte.length) {
        nombre_de_lettres = nombre_de_lettres + 1;
        bloc.textContent = lignes[indice].texte.slice(0, nombre_de_lettres);
      }
    }
  });

  ecran.onclick = function () {
    if (nombre_de_lettres < lignes[indice].texte.length) {
      nombre_de_lettres = lignes[indice].texte.length;
      bloc.textContent = lignes[indice].texte;
      return;
    }
    indice = indice + 1;
    if (indice >= lignes.length) {
      minuteur.remove();
      refermer(ecran);
      // on remet l'ecran dans sa forme habituelle (les autres usages)
      ecran.style.flexDirection = "";
      ecran.style.alignItems = "center";
      ecran.style.justifyContent = "center";
      ecran.style.gap = "";
      ecran.style.textAlign = "center";
      quand_fini();
      return;
    }
    nouvelle_replique();
  };
}

// Les pensees entre deux niveaux : une liste de phrases (une apres l'autre), ou un
// dialogue entre J1 et J2 (si les elements sont { qui, texte }).
export function afficher_pensees(scene, pensees, quand_fini) {
  if (typeof pensees[0] == "object") {
    afficher_dialogue(scene, pensees, quand_fini);
  } else {
    afficher_phrases(scene, pensees, quand_fini);
  }
}
