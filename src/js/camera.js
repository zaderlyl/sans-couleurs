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

  // Anticipation : centre vise decale dans le sens du regard pendant la
  // marche. Scene.IntensiteMarche (0 a l'arret/en l'air, 1 en pleine marche)
  // sert de fondu — le lerp sur scrollX ci-dessous suffit a lisser.
  const SensRegard = Scene.Orientation === 'gauche' ? -1 : 1;
  const Anticipation = SensRegard * DecalageAnticipationCameraMax * (Scene.IntensiteMarche || 0);

  const VueXVoulue = Phaser.Math.Clamp(
    Scene.Personnage.x + Anticipation - LargeurVueMonde / 2,
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
    Scene.Personnage.y + DecalageVerticalCadrageCamera - HauteurVueMonde / 2,
    0,
    Math.max(0, Scene.HauteurMondeCarte - HauteurVueMonde),
  );
  const ScrollYVoulu = VueYVoulue + (HauteurVueMonde - Cam.height) / 2;
  Cam.scrollY = Scene.CameraDoitSauter
    ? ScrollYVoulu
    : Phaser.Math.Linear(Cam.scrollY, ScrollYVoulu, VitesseSuiviCameraY);
}
