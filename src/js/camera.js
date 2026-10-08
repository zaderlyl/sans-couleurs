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
import { MettreAJourEcranSepare, EcranEntierObligatoire } from './camera-separee.js';

// --- Quel point la camera principale doit-elle regarder ? ------------
//
// Avec UN seul joueur : le joueur lui-meme (le personnage souris).
// Avec DEUX joueurs proches : le MILIEU entre les deux, pour que les deux
// restent visibles.
// Avec DEUX joueurs eloignes (ecran separe en deux, voir camera-separee.js) :
// la camera principale ne suit QUE le joueur 1 ; la 2e camera suit le joueur 2.
//
// Renvoie { X, Y, AMarcheSeul } :
//   - X, Y        : le point du monde a mettre au centre de la camera ;
//   - AMarcheSeul : true quand la camera ne regarde qu'UN joueur, car
//                   l'"anticipation" (la camera qui regarde un peu devant le
//                   joueur, voir SuivrePointAvecCamera) n'a de sens que dans
//                   ce cas.
function PointSuiviCameraPrincipale(Scene) {
  const Joueur1 = Scene.Personnage;
  const Joueur2 = Scene.Joueur2;

  // Pas de joueur 2 sur cette carte (ou pas encore cree), ecran separe, ou
  // scene qui ne concerne que le joueur 1 (voyage en train, ecran de mort...) :
  // la camera principale ne regarde que le joueur 1.
  if (!Joueur2 || !Joueur2.active || Scene.EcranSepare || EcranEntierObligatoire(Scene)) {
    return { X: Joueur1.x, Y: Joueur1.y, AMarcheSeul: true };
  }

  // Deux joueurs, un seul ecran : le point au milieu = la moyenne de leurs positions.
  return {
    X: (Joueur1.x + Joueur2.x) / 2,
    Y: (Joueur1.y + Joueur2.y) / 2,
    AMarcheSeul: false,
  };
}


// --- Faire regarder un point du monde a UNE camera ---------------------
//
// Sert a la camera principale ET a la 2e camera (ecran separe). Tout le
// calcul de scroll est ici, a un seul endroit.
//
//   Cam          : la camera a deplacer.
//   Point        : { X, Y, AMarcheSeul } (voir plus haut).
//   SautDirect   : true = placer la camera d'un coup sur le point (sinon elle
//                  glisse doucement vers lui, "lerp").
function SuivrePointAvecCamera(Scene, Cam, Point, SautDirect) {
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

  // Anticipation : centre vise decale dans le sens du regard pendant la
  // marche. Scene.IntensiteMarche (0 a l'arret/en l'air, 1 en pleine marche)
  // sert de fondu — le lerp sur scrollX ci-dessous suffit a lisser.
  // Elle ne s'applique que quand la camera regarde UN seul joueur (le joueur
  // 1) : decaler le milieu de deux joueurs selon le sens de marche d'un seul
  // n'aurait aucun sens, et la 2e camera n'en a pas non plus.
  const SensRegard = Scene.Orientation === 'gauche' ? -1 : 1;
  const Anticipation = Point.AMarcheSeul && Cam === Scene.cameras.main
    ? SensRegard * DecalageAnticipationCameraMax * (Scene.IntensiteMarche || 0)
    : 0;

  const VueXVoulue = Phaser.Math.Clamp(
    Point.X + Anticipation - LargeurVueMonde / 2,
    0,
    Math.max(0, Scene.LargeurMondeCarte - LargeurVueMonde),
  );
  const ScrollXVoulu = VueXVoulue + (LargeurVueMonde - Cam.width) / 2;
  // Saut instantane (voyage en train, portail, 2e camera qui vient d'apparaitre),
  // suivi doux sinon.
  Cam.scrollX = SautDirect
    ? ScrollXVoulu
    : Phaser.Math.Linear(Cam.scrollX, ScrollXVoulu, VitesseSuiviCameraX);

  const VueYVoulue = Phaser.Math.Clamp(
    Point.Y + DecalageVerticalCadrageCamera - HauteurVueMonde / 2,
    0,
    Math.max(0, Scene.HauteurMondeCarte - HauteurVueMonde),
  );
  const ScrollYVoulu = VueYVoulue + (HauteurVueMonde - Cam.height) / 2;
  Cam.scrollY = SautDirect
    ? ScrollYVoulu
    : Phaser.Math.Linear(Cam.scrollY, ScrollYVoulu, VitesseSuiviCameraY);
}


// --- Appele une fois par frame (scene-jeu.js, debut de update) -------------

export function MettreAJourCamera(Scene) {
  // 1) Faut-il separer l'ecran (ou le rejoindre) ? Sans effet s'il n'y a pas
  //    de joueur 2 sur la carte.
  MettreAJourEcranSepare(Scene);

  // 2) Camera principale : le joueur 1, ou le milieu des deux joueurs.
  //    Saut instantane pendant un voyage en train ou un portail
  //    (Scene.CameraDoitSauter), suivi doux sinon.
  SuivrePointAvecCamera(Scene, Scene.cameras.main, PointSuiviCameraPrincipale(Scene), Scene.CameraDoitSauter);

  // 3) 2e camera (seulement quand l'ecran est separe) : le joueur 2. Elle se
  //    place d'un coup la toute premiere frame de la separation.
  if (Scene.CameraJoueur2 && Scene.EcranSepare) {
    const Joueur2 = Scene.Joueur2;
    const PointJoueur2 = { X: Joueur2.x, Y: Joueur2.y, AMarcheSeul: true };
    SuivrePointAvecCamera(Scene, Scene.CameraJoueur2, PointJoueur2, Scene.Camera2DoitSauter || Scene.CameraDoitSauter);
    Scene.Camera2DoitSauter = false;
  }
}
