// pastilles.js — quand un joueur sort de l'ecran, il apparait en "pastille" au bord.
//
// La camera (voir camera.js) est unique : elle ne montre pas toujours les deux
// joueurs. Si l'un est trop loin, il sort du cadre. A la place, une petite
// pastille ronde, avec SON visage, se pose au bord de l'ecran du cote ou il se
// trouve, avec une fleche qui montre la direction. Elle disparait des qu'il
// revient a l'ecran.
//
// Une pastille est un <div> HTML pose sur le jeu (comme le voile du poids de phrases.js).
//
// Comment s'en servir (dans un niveau, voir niveau3.js) :
//   creer_pastilles(this);              // dans creer_particularites
//   mettre_a_jour_pastilles(this);      // dans mettre_a_jour_particularites

var taille = 40; // pixels : le diametre d'une pastille
var marge = 32; // pixels : la distance au bord de l'ecran
var echelle = 2; // le visage du personnage est agrandi 2 fois (16 pixels -> 32)
var image_d_un_joueur = ["img_perso", "img_perso2"]; // les images des deux joueurs (voir niveau.js)
var image_debout = 3; // le numero de l'image "debout" de la feuille du personnage


export function creer_pastilles(scene) {
  scene.pastilles = [];
  var joueurs = [scene.joueur_souris, scene.joueur_clavier];
  for (var i = 0; i < joueurs.length; i++) {
    scene.pastilles.push(creer_une_pastille(scene, "pastille-joueur-" + i, image_d_un_joueur[i]));
  }
  scene.events.once("shutdown", function () {
    for (var j = 0; j < scene.pastilles.length; j++) {
      scene.pastilles[j].cache.style.display = "none";
    }
  });
}

function creer_une_pastille(scene, id, cle_image) {
  var conteneur = scene.game.canvas.parentElement;
  conteneur.style.position = "relative";
  var pastille = {};

  // la fleche : un petit triangle, dans un bloc de la taille de la pastille qu'on fait tourner
  pastille.cache = document.getElementById(id);
  if (pastille.cache == null) {
    var bloc = document.createElement("div");
    bloc.id = id;
    bloc.style.position = "absolute";
    bloc.style.width = taille + "px";
    bloc.style.height = taille + "px";
    bloc.style.pointerEvents = "none"; // ne bloque pas les clics sur le jeu
    bloc.style.display = "none";

    // la fleche (derriere la pastille), du cote droit puis tournee
    var fleche_bloc = document.createElement("div");
    fleche_bloc.style.position = "absolute";
    fleche_bloc.style.left = "0";
    fleche_bloc.style.top = "0";
    fleche_bloc.style.width = taille + "px";
    fleche_bloc.style.height = taille + "px";
    fleche_bloc.innerHTML = '<div style="position:absolute;left:' + (taille + 1) + 'px;top:' + (taille / 2 - 8) + 'px;width:0;height:0;' +
      'border-top:8px solid transparent;border-bottom:8px solid transparent;border-left:12px solid #000;"></div>';
    bloc.appendChild(fleche_bloc);

    // la pastille : un rond blanc a double cadre (noir, blanc, noir) avec le visage dedans
    var rond = document.createElement("div");
    rond.style.position = "absolute";
    rond.style.left = "0";
    rond.style.top = "0";
    rond.style.width = taille - 6 + "px";
    rond.style.height = taille - 6 + "px";
    rond.style.borderRadius = "50%";
    rond.style.background = "#ffffff";
    rond.style.border = "3px solid #000000";
    rond.style.boxShadow = "0 0 0 2px #ffffff, 0 0 0 4px #000000";
    rond.style.overflow = "hidden";
    bloc.appendChild(rond);
    pastille.rond = rond;
    pastille.fleche = fleche_bloc;

    conteneur.appendChild(bloc);
    pastille.cache = bloc;
  } else {
    pastille.rond = pastille.cache.children[1];
    pastille.fleche = pastille.cache.children[0];
  }

  // le visage : l'image "debout" de la feuille du personnage, copiee dans un petit
  // canvas (16 x 16) puis agrandie sans flou
  var image = scene.textures.get(cle_image).getSourceImage();
  var colonnes = Math.floor(image.width / 16);
  var colonne = image_debout % colonnes;
  var rangee = Math.floor(image_debout / colonnes);
  var visage = document.createElement("canvas");
  visage.width = 16;
  visage.height = 16;
  visage.getContext("2d").drawImage(image, colonne * 16, rangee * 16, 16, 16, 0, 0, 16, 16);
  pastille.rond.style.backgroundImage = "url(" + visage.toDataURL() + ")";
  pastille.rond.style.backgroundRepeat = "no-repeat";
  pastille.rond.style.imageRendering = "pixelated";
  pastille.rond.style.backgroundSize = 16 * echelle + "px " + 16 * echelle + "px";
  pastille.rond.style.backgroundPosition = (taille - 6 - 16 * echelle) / 2 + "px " + (taille - 6 - 16 * echelle) / 2 + "px";
  return pastille;
}


// chaque image : la pastille d'un joueur sorti de l'ecran se pose au bord, du cote ou il est
export function mettre_a_jour_pastilles(scene) {
  var camera = scene.cameras.main;
  var joueurs = [scene.joueur_souris, scene.joueur_clavier];
  for (var i = 0; i < joueurs.length; i++) {
    var pastille = scene.pastilles[i];
    var joueur = joueurs[i];

    // ou est le joueur a l'ecran (en pixels de l'ecran) ?
    var ecran_x = (joueur.x - camera.worldView.x) * camera.zoom + camera.x;
    var ecran_y = (joueur.y - camera.worldView.y) * camera.zoom + camera.y;
    var dans_l_ecran = ecran_x >= camera.x && ecran_x <= camera.x + camera.width && ecran_y >= camera.y && ecran_y <= camera.y + camera.height;
    if (dans_l_ecran == true || joueur.visible == false) {
      pastille.cache.style.display = "none";
      continue;
    }

    // la pastille se pose au bord (a `marge` pixels), la fleche tourne vers le joueur
    var x = Phaser.Math.Clamp(ecran_x, camera.x + marge, camera.x + camera.width - marge);
    var y = Phaser.Math.Clamp(ecran_y, camera.y + marge, camera.y + camera.height - marge);
    var angle = Phaser.Math.Angle.Between(x, y, ecran_x, ecran_y); // en radians
    pastille.cache.style.display = "block";
    pastille.cache.style.left = x - taille / 2 + "px";
    pastille.cache.style.top = y - taille / 2 + "px";
    pastille.fleche.style.transform = "rotate(" + angle + "rad)";
  }
}
