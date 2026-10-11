// ecran_dechire.js — un ecran gris plein ecran dechire par des fissures qui
// apparaissent de plus en plus (le monde 4).
//
// C'est un <canvas> HTML pose sur tout le jeu, dessine en BASSE resolution (un
// pixel dessine = 5 pixels de l'ecran, comme le zoom du jeu) puis agrandi sans
// lissage : les dechirures ont le meme grain que les sprites.
//
// Les dechirures s'ACCUMULENT : celles d'une fois restent la fois suivante, on en
// ajoute d'autres. Une dechirure est une ligne en zigzag : un bord blanc (le
// papier dechire) et un coeur noir (le vide derriere).
//
// Comment s'en servir :
//   montrer_l_ecran_dechire(scene, 14, quand_fini);  // le fond gris apparait, puis des dechirures jusqu'a en avoir 14
//   cacher_l_ecran_dechire(scene, quand_fini);       // il s'efface

var id_ecran = "ecran-dechire";
var echelle = 5; // un pixel dessine = 5 pixels d'ecran
var gris = "#8a8a8a";
var duree_apparition = 600; // ms
var delai_entre_dechirures = 130; // ms

var dechirures = []; // toutes les dechirures faites jusqu'ici : { points: [{x, y}, ...] } (en pixels dessines)
var avancee = []; // pour chacune, a quel point elle est dessinee (0 a 1)


function obtenir_le_canvas(scene) {
  var canvas = document.getElementById(id_ecran);
  if (canvas == null) {
    canvas = document.createElement("canvas");
    canvas.id = id_ecran;
    canvas.style.position = "absolute";
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.imageRendering = "pixelated"; // pixels nets, pas floutes
    canvas.style.pointerEvents = "none"; // ne bloque pas les clics
    canvas.style.zIndex = "5"; // sous l'ecran de texte (voir ecran_texte.js)
    canvas.style.opacity = "0";
    canvas.style.transition = "opacity " + duree_apparition + "ms";
    canvas.style.display = "none";
    scene.game.canvas.parentElement.style.position = "relative";
    scene.game.canvas.parentElement.appendChild(canvas);
  }
  return canvas;
}

// une nouvelle dechirure : une ligne en zigzag qui traverse l'ecran
function nouvelle_dechirure(largeur, hauteur) {
  var x = Phaser.Math.Between(0, largeur);
  var y = Phaser.Math.Between(0, hauteur);
  var angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
  var longueur = Phaser.Math.Between(Math.floor(largeur * 0.4), Math.floor(largeur * 1.1));
  var points = [{ x: x, y: y }];
  var parcouru = 0;
  while (parcouru < longueur) {
    var pas = Phaser.Math.Between(3, 7);
    angle = angle + Phaser.Math.FloatBetween(-0.7, 0.7); // le zigzag
    x = x + Math.cos(angle) * pas;
    y = y + Math.sin(angle) * pas;
    points.push({ x: Math.round(x), y: Math.round(y) });
    parcouru = parcouru + pas;
  }
  return { points: points };
}

// trace une ligne en pixels carres (pas de lissage) : un carre de `taille` pixels a chaque pas
function trait(ctx, x0, y0, x1, y1, taille, couleur) {
  ctx.fillStyle = couleur;
  var pas = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (var i = 0; i <= pas; i++) {
    var x = Math.round(x0 + ((x1 - x0) * i) / pas);
    var y = Math.round(y0 + ((y1 - y0) * i) / pas);
    ctx.fillRect(x - Math.floor(taille / 2), y - Math.floor(taille / 2), taille, taille);
  }
}

function dessiner(canvas) {
  var ctx = canvas.getContext("2d");
  ctx.fillStyle = gris;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // chaque dechirure : d'abord le bord blanc (le papier dechire), par-dessus le coeur noir (le vide)
  var etapes = [{ taille: 4, couleur: "#ffffff" }, { taille: 2, couleur: "#000000" }];
  for (var i = 0; i < dechirures.length; i++) {
    var points = dechirures[i].points;
    var jusqu_a = Math.max(2, Math.floor(points.length * avancee[i]));
    for (var j = 0; j < etapes.length; j++) {
      for (var k = 1; k < jusqu_a; k++) {
        trait(ctx, points[k - 1].x, points[k - 1].y, points[k].x, points[k].y, etapes[j].taille, etapes[j].couleur);
      }
    }
  }
}

// le fond gris apparait en fondu ; des dechirures s'ajoutent (une toutes les 130 ms,
// chacune se dessine en grandissant) jusqu'a en avoir `total` ; puis `quand_fini`
export function montrer_l_ecran_dechire(scene, total, quand_fini) {
  var canvas = obtenir_le_canvas(scene);
  canvas.width = Math.ceil(canvas.clientWidth / echelle) || 160;
  canvas.height = Math.ceil(canvas.clientHeight / echelle) || 120;
  canvas.style.display = "block";
  dessiner(canvas);
  // (un instant plus tard : sinon le fondu ne se declenche pas)
  setTimeout(function () {
    canvas.style.opacity = "1";
  }, 20);

  scene.time.addEvent({
    delay: delai_entre_dechirures,
    repeat: Math.max(0, total - dechirures.length - 1),
    callback: function () {
      dechirures.push(nouvelle_dechirure(canvas.width, canvas.height));
      avancee.push(0);
    }
  });

  // chaque dechirure grandit petit a petit ; on redessine
  var minuteur = scene.time.addEvent({
    delay: 40,
    loop: true,
    callback: function () {
      var fini = dechirures.length >= total;
      for (var i = 0; i < dechirures.length; i++) {
        avancee[i] = Math.min(1, avancee[i] + 0.12);
        if (avancee[i] < 1) {
          fini = false;
        }
      }
      dessiner(canvas);
      if (fini == true) {
        minuteur.remove();
        quand_fini();
      }
    }
  });
}

// le gris s'efface en fondu (les dechirures sont gardees pour la fois suivante)
export function cacher_l_ecran_dechire(scene, quand_fini) {
  var canvas = obtenir_le_canvas(scene);
  canvas.style.opacity = "0";
  setTimeout(function () {
    canvas.style.display = "none";
    quand_fini();
  }, duree_apparition);
}

// remet tout a zero (a appeler a la fin du niveau)
export function effacer_l_ecran_dechire() {
  dechirures = [];
  avancee = [];
  var canvas = document.getElementById(id_ecran);
  if (canvas != null) {
    canvas.style.display = "none";
    canvas.style.opacity = "0";
  }
}
