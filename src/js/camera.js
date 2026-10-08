// camera.js — suivi de camera, pilote a la main chaque frame.
// scene-jeu.js appelle MettreAJourCamera(this) au debut de update().
//
// Pourquoi manuel plutot que startFollow : dans cette version de Phaser, le
// follow natif recalcule scrollY tout seul a chaque redimensionnement de la
// fenetre (meme avec lerpY=0), ce qui reintroduisait un decalage apres coup.
// En recalculant depuis la taille ACTUELLE de la camera chaque frame, ce
// suivi est insensible aux redimensionnements.
//
// X et Y suivent tous les deux le joueur (meme logique, lerp + saut
// instantane sur Scene.CameraDoitSauter) : au debut, Y etait fige sur un
// point du monde fixe, ce qui marchait tant que le joueur restait a peu pres
// a la meme hauteur — mais le sortait carrement du cadre sur les cartes avec
// beaucoup de relief vertical (ex: les portails du college, cases tres
// eloignees en hauteur). Reglages dans config.js.

import {
  VitesseSuiviCameraX, VitesseSuiviCameraY, DecalageVerticalCadrageCamera,
  DecalageAnticipationCameraMax,
} from './config.js';

// --- Quel point la camera doit-elle regarder ? -----------------------
//
// Avec UN seul joueur : le joueur lui-meme (le personnage souris).
// Avec DEUX joueurs : le MILIEU entre les deux, pour que les deux restent
// visibles tant qu'ils ne sont pas trop eloignes. (Quand ils s'eloigneront
// trop, l'ecran se separera en deux : etape suivante, pas encore faite.)
//
// Renvoie { X, Y, AMarcheSeul } :
//   - X, Y        : le point du monde a mettre au centre de l'ecran ;
//   - AMarcheSeul : true s'il n'y a qu'un joueur, car l'"anticipation" (la
//                   camera qui regarde un peu devant le joueur, voir plus
//                   bas) n'a de sens que pour un seul joueur.
function PointSuiviCamera(Scene) {
  const Joueur1 = Scene.Personnage;
  const Joueur2 = Scene.Joueur2;

  // Pas de joueur 2 sur cette carte (ou pas encore cree) : on suit le joueur 1.
  if (!Joueur2 || !Joueur2.active) {
    return { X: Joueur1.x, Y: Joueur1.y, AMarcheSeul: true };
  }

  // Deux joueurs : le point au milieu = la moyenne de leurs positions.
  return {
    X: (Joueur1.x + Joueur2.x) / 2,
    Y: (Joueur1.y + Joueur2.y) / 2,
    AMarcheSeul: false,
  };
}

export function MettreAJourCamera(Scene) {
  const Cam = Scene.cameras.main;
  const LargeurVueMonde = Cam.width / Cam.zoom;
  const HauteurVueMonde = Cam.height / Cam.zoom;

  // scrollX/scrollY de Phaser ne sont PAS le coin haut-gauche du monde
  // visible des que le zoom != 1 : en interne Phaser fait
  //   worldView.x = scrollX + (Cam.width  - LargeurVueMonde) / 2
  //   worldView.y = scrollY + (Cam.height - HauteurVueMonde) / 2
  // (le zoom s'applique autour du centre, avec la taille PLEINE de la
  // camera). On calcule donc la position voulue du worldView, puis on la
  // convertit en scroll avec la formule inverse — sinon, a fort zoom, la
  // camera vise une zone vide du monde (ecran noir garanti).

  // Le point regarde par la camera : un joueur, ou le milieu des deux.
  const Point = PointSuiviCamera(Scene);

  // Anticipation : centre vise decale dans le sens du regard pendant la
  // marche. Scene.IntensiteMarche (0 a l'arret/en l'air, 1 en pleine marche)
  // sert de fondu — le lerp sur scrollX ci-dessous suffit a lisser.
  // Elle ne s'applique qu'avec un seul joueur (sinon on decalerait le milieu
  // des deux dans le sens de marche du joueur 1 seulement, ce qui n'aurait
  // aucun sens).
  const SensRegard = Scene.Orientation === 'gauche' ? -1 : 1;
  const Anticipation = Point.AMarcheSeul
    ? SensRegard * DecalageAnticipationCameraMax * (Scene.IntensiteMarche || 0)
    : 0;

  const VueXVoulue = Phaser.Math.Clamp(
    Point.X + Anticipation - LargeurVueMonde / 2,
    0,
    Math.max(0, Scene.LargeurMondeCarte - LargeurVueMonde),
  );
  const ScrollXVoulu = VueXVoulue + (LargeurVueMonde - Cam.width) / 2;
  // Saut instantane pendant le voyage en train ou un portail (Scene.CameraDoitSauter),
  // suivi doux sinon.
  Cam.scrollX = Scene.CameraDoitSauter
    ? ScrollXVoulu
    : Phaser.Math.Linear(Cam.scrollX, ScrollXVoulu, VitesseSuiviCameraX);

  const VueYVoulue = Phaser.Math.Clamp(
    Point.Y + DecalageVerticalCadrageCamera - HauteurVueMonde / 2,
    0,
    Math.max(0, Scene.HauteurMondeCarte - HauteurVueMonde),
  );
  const ScrollYVoulu = VueYVoulue + (HauteurVueMonde - Cam.height) / 2;
  Cam.scrollY = Scene.CameraDoitSauter
    ? ScrollYVoulu
    : Phaser.Math.Linear(Cam.scrollY, ScrollYVoulu, VitesseSuiviCameraY);
}
