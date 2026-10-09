// ecran_texte.js — un grand ecran noir avec du texte blanc par-dessus le jeu.
//
// C'est un <div> HTML (pas un objet du jeu) : il couvre tout l'ecran, quelle
// que soit la camera. Deux usages :
//   - afficher_phrases(scene, [...], quand_fini) : des phrases qui s'ecrivent
//     lettre par lettre ; un clic finit la phrase en cours, puis passe a la
//     suivante (le voyage en train, voir gare.js) ;
//   - afficher_texte(scene, "...", quand_clic) : un texte affiche d'un coup,
//     jusqu'au prochain clic (l'ecran de mort, voir glitch.js).

var delai_par_lettre = 70; // ms : l'effet "machine a ecrire"


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
    scene.game.canvas.parentElement.style.position = "relative";
    scene.game.canvas.parentElement.appendChild(ecran);
  }
  ecran.style.display = "flex";
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
  var ecran = obtenir_l_ecran(scene);

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
      refermer(ecran);
      quand_fini();
    }
  };
}


// --- Un texte affiche d'un coup, jusqu'au prochain clic ---------------------------

export function afficher_texte(scene, texte, quand_clic) {
  var ecran = obtenir_l_ecran(scene);
  ecran.textContent = texte;
  ecran.onclick = function () {
    refermer(ecran);
    quand_clic();
  };
}
