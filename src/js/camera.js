// camera.js — suivi de camera, pilote a la main chaque frame.
// scene-jeu.js appelle MettreAJourCamera(this, TempsEcoule) au debut de update().
// Avec un joueur 2, deux cameras suivent chacune un joueur et l'ecran se
// separe en douceur quand ils s'eloignent (voir camera-separee.js).
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
  DecalageAnticipationCameraMax, ZoomCamera,
} from './config.js';
import { MettreAJourEcranSepare, EcranEntierObligatoire } from './camera-separee.js';

// Vitesse de suivi des cameras (lerp, comme VitesseSuiviCameraX/Y de config.js)
// quand l'ecran est separe. Plus vive que le suivi normal : pendant que la 2e
// moitie apparait, les deux cameras doivent rattraper vite "leur" joueur, sinon
// leur retard laisserait un joueur brievement hors de vue. Le suivi normal
// (plus doux) reste utilise tant que l'ecran n'est pas separe.
const VitesseSuiviCameraSeparee = 0.35;

// --- Quel point une camera doit-elle regarder ? ---------------------------
//
// Chaque camera a un joueur "a elle" : la camera principale suit le joueur 1,
// la 2e camera suit le joueur 2. Ce qu'elle regarde depend de la separation de
// l'ecran (Scene.PartSeparation, de 0 a 1, voir camera-separee.js) :
//
//   PartSeparation = 0 -> il n'y a qu'UN ecran : on regarde le MILIEU entre
//                         les deux joueurs ;
//   PartSeparation = 1 -> l'ecran est coupe en deux moities : chaque camera
//                         est centree sur SON joueur ;
//   entre les deux     -> transition. Deux regles se combinent :
//
//   REGLE 1, "raccord" : au debut de la separation, les deux cameras doivent
//   montrer exactement ce que montrerait un ecran unique centre sur le milieu
//   des joueurs, simplement decoupe en deux (comme si on tirait un rideau).
//   Sinon on verrait un decalage brutal le long de la ligne de separation.
//
//   REGLE 2, "jamais perdu" : un joueur doit TOUJOURS etre visible dans SA
//   camera. Si la regle 1 le sortirait (ou le collerait) du cadre, on decale la
//   camera juste ce qu'il faut pour qu'il reste dedans.
//
//   Puis, vers la fin de la separation, la camera glisse doucement pour
//   CENTRER son joueur (c'est l'etat final a PartSeparation = 1).
//
// `SonJoueur` est le joueur que cette camera suit (Scene.Personnage pour la
// camera principale, Scene.Joueur2 pour la 2e).
//
// Renvoie { X, Y, Anticipation } :
//   - X, Y         : le point du monde a mettre au centre de la camera ;
//   - Anticipation : de 0 a 1, a quel point la camera a le droit de "regarder
//                    un peu devant" le joueur qui marche (voir
//                    SuivrePointAvecCamera). Avec un seul joueur c'est 1 ;
//                    entre deux joueurs proches c'est 0 (decaler le milieu de
//                    deux joueurs selon la marche d'un seul n'a aucun sens).
function PointSuiviParCamera(Scene, SonJoueur) {
  const Joueur1 = Scene.Personnage;
  const Joueur2 = Scene.Joueur2;

  // Pas de joueur 2 sur cette carte, ou scene qui ne concerne que le joueur 1
  // (voyage en train, ecran de mort...) : la camera ne regarde que le joueur 1.
  if (!Joueur2 || !Joueur2.active || EcranEntierObligatoire(Scene)) {
    return { X: Joueur1.x, Y: Joueur1.y, Anticipation: 1 };
  }

  // Le milieu des deux joueurs.
  const MilieuX = (Joueur1.x + Joueur2.x) / 2;
  const MilieuY = (Joueur1.y + Joueur2.y) / 2;
  const Part = Scene.PartSeparation || 0;

  // Un seul ecran : on regarde simplement le milieu.
  if (Part <= 0) return { X: MilieuX, Y: MilieuY, Anticipation: 0 };

  // Cette camera est-elle celle de GAUCHE ou de DROITE de l'ecran ? (La camera
  // de gauche est celle du joueur le plus a gauche dans le monde, voir
  // Scene.Joueur1ACote dans camera-separee.js.)
  const EstCameraGauche = SonJoueur === Joueur1 ? Scene.Joueur1ACote : !Scene.Joueur1ACote;

  // Taille du monde visible quand l'ecran est ENTIER (en pixels du monde).
  const LargeurMondeEntier = Scene.scale.width / ZoomCamera;
  const HauteurMondeEntiere = Scene.scale.height / ZoomCamera;

  // REGLE 1 (raccord) : le centre que cette camera aurait si l'ecran unique,
  // centre sur le milieu, etait simplement decoupe. La camera de gauche occupe
  // la partie gauche de l'ecran (elle se retrecit de Part/2 vers la droite),
  // celle de droite le reste a droite : leurs centres sont decales du milieu.
  const DecalageRaccord = EstCameraGauche
    ? -LargeurMondeEntier * Part / 4
    :  LargeurMondeEntier * (0.5 - Part / 4);
  let X = MilieuX + DecalageRaccord;
  let Y = MilieuY;

  // REGLE 2 (jamais perdu) : on ne laisse pas le centre s'eloigner du joueur
  // de plus de 70 % de la demi-taille de la camera, donc le joueur reste dans
  // le cadre, avec une marge. La camera de droite est une bande etroite au
  // debut : la marge y est petite, mais elle grandit avec la bande.
  const DemiLargeurCamera = LargeurMondeEntier * (EstCameraGauche ? 1 - Part / 2 : Part / 2) / 2;
  const DemiHauteurCamera = HauteurMondeEntiere / 2;
  const LimiteX = 0.7 * DemiLargeurCamera;
  const LimiteY = 0.7 * DemiHauteurCamera;
  X = Phaser.Math.Clamp(X, SonJoueur.x - LimiteX, SonJoueur.x + LimiteX);
  Y = Phaser.Math.Clamp(Y, SonJoueur.y - LimiteY, SonJoueur.y + LimiteY);

  // Vers la fin de la separation (Part de 0.6 a 1), on glisse peu a peu vers
  // le CENTRAGE complet sur son joueur. Poids de 0 a 1, adouci ("smoothstep").
  const Avancement = Phaser.Math.Clamp((Part - 0.6) / 0.4, 0, 1);
  const Poids = Avancement * Avancement * (3 - 2 * Avancement);
  // Phaser.Math.Linear(depart, arrivee, part) = depart + (arrivee - depart) * part.
  X = Phaser.Math.Linear(X, SonJoueur.x, Poids);
  Y = Phaser.Math.Linear(Y, SonJoueur.y, Poids);

  return { X, Y, Anticipation: Part };
}


// --- Faire regarder un point du monde a UNE camera ---------------------
//
// Sert a la camera principale ET a la 2e camera (ecran separe). Tout le
// calcul de scroll est ici, a un seul endroit.
//
//   Cam          : la camera a deplacer.
//   Point        : { X, Y, Anticipation } (voir PointSuiviParCamera).
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
  // camera). On raisonne donc sur le CENTRE de la vue (voir plus bas) puis on
  // le convertit en scroll — sinon, a fort zoom, la camera vise une zone vide
  // du monde (ecran noir garanti).

  // Anticipation : centre vise decale dans le sens du regard pendant la
  // marche. Scene.IntensiteMarche (0 a l'arret/en l'air, 1 en pleine marche)
  // sert de fondu — le lerp sur scrollX ci-dessous suffit a lisser.
  // Elle ne concerne que la camera du joueur 1 (la principale), et elle est
  // multipliee par Point.Anticipation : pleine avec un seul joueur, nulle
  // entre deux joueurs proches (decaler le milieu de deux joueurs selon le
  // sens de marche d'un seul n'aurait aucun sens), qui revient peu a peu
  // pendant la separation. La 2e camera n'en a pas.
  const SensRegard = Scene.Orientation === 'gauche' ? -1 : 1;
  const Anticipation = Cam === Scene.cameras.main
    ? SensRegard * DecalageAnticipationCameraMax * (Scene.IntensiteMarche || 0) * Point.Anticipation
    : 0;

  // Vitesse de suivi : celle de config.js tant que l'ecran n'est pas separe,
  // puis de plus en plus vive des que PartSeparation monte (a fond des 0.2).
  const PartReactive = Phaser.Math.Clamp((Scene.PartSeparation || 0) * 5, 0, 1);
  const VitesseX = Phaser.Math.Linear(VitesseSuiviCameraX, VitesseSuiviCameraSeparee, PartReactive);
  const VitesseY = Phaser.Math.Linear(VitesseSuiviCameraY, VitesseSuiviCameraSeparee, PartReactive);

  // On fait glisser le CENTRE de la vue, pas scrollX/scrollY. Le centre de la
  // vue (en pixels du monde) vaut
  //   centreX = scrollX + Cam.width  / 2
  //   centreY = scrollY + Cam.height / 2
  // et ne depend ni du zoom ni de la taille de la camera : si on faisait
  // glisser scrollX directement, un changement de largeur de la camera (la
  // 2e moitie qui apparait, un joueur dont la camera se retrecit) changerait
  // brutalement scrollX de plusieurs centaines de pixels sans que la vue ne
  // bouge, et le glissement traverserait n'importe quelle zone de la carte.
  //
  // Ce centre est AUSSI memorise sur la camera d'une frame a l'autre
  // (Cam.CentreXMemo / CentreYMemo) : si on le recalculait chaque frame depuis
  // scrollX, il "sauterait" des qu'on change la largeur de la camera juste
  // avant (voir camera-separee.js), puisque scrollX n'a pas encore ete
  // mis a jour pour la nouvelle taille. La toute premiere fois, on le calcule.
  const CentreXActuel = Cam.CentreXMemo !== undefined ? Cam.CentreXMemo : Cam.scrollX + Cam.width / 2;
  const CentreYActuel = Cam.CentreYMemo !== undefined ? Cam.CentreYMemo : Cam.scrollY + Cam.height / 2;

  // Position voulue du centre, gardee a l'interieur de la carte (la vue ne
  // doit pas depasser les bords : sinon on verrait du noir).
  const CentreXVoulu = Phaser.Math.Clamp(
    Point.X + Anticipation,
    LargeurVueMonde / 2,
    Math.max(LargeurVueMonde / 2, Scene.LargeurMondeCarte - LargeurVueMonde / 2),
  );
  const CentreYVoulu = Phaser.Math.Clamp(
    Point.Y + DecalageVerticalCadrageCamera,
    HauteurVueMonde / 2,
    Math.max(HauteurVueMonde / 2, Scene.HauteurMondeCarte - HauteurVueMonde / 2),
  );

  // Saut instantane (voyage en train, portail), suivi doux sinon.
  const NouveauCentreX = SautDirect ? CentreXVoulu : Phaser.Math.Linear(CentreXActuel, CentreXVoulu, VitesseX);
  const NouveauCentreY = SautDirect ? CentreYVoulu : Phaser.Math.Linear(CentreYActuel, CentreYVoulu, VitesseY);

  // On repasse du centre au scroll de Phaser (formule inverse).
  Cam.scrollX = NouveauCentreX - Cam.width / 2;
  Cam.scrollY = NouveauCentreY - Cam.height / 2;
  Cam.CentreXMemo = NouveauCentreX;
  Cam.CentreYMemo = NouveauCentreY;
}


// --- Appele une fois par frame (scene-jeu.js, debut de update) -------------

export function MettreAJourCamera(Scene, TempsEcoule) {
  // 1) Calcule la separation de l'ecran (PartSeparation) et regle la taille
  //    des deux cameras. Sans effet s'il n'y a pas de joueur 2 sur la carte.
  MettreAJourEcranSepare(Scene, TempsEcoule);

  // 2) Camera principale : elle suit le joueur 1 (plus ou moins vers le milieu
  //    des joueurs, selon PartSeparation). Saut instantane pendant un voyage en
  //    train ou un portail (Scene.CameraDoitSauter), suivi doux sinon.
  SuivrePointAvecCamera(
    Scene, Scene.cameras.main, PointSuiviParCamera(Scene, Scene.Personnage), Scene.CameraDoitSauter,
  );

  // 3) 2e camera : elle suit le joueur 2 de la meme facon. On la met a jour
  //    a chaque frame meme quand elle est cachee (PartSeparation = 0), pour
  //    qu'elle soit deja bien placee au moment ou elle apparait.
  if (Scene.CameraJoueur2 && Scene.Joueur2 && Scene.Joueur2.active) {
    SuivrePointAvecCamera(
      Scene, Scene.CameraJoueur2, PointSuiviParCamera(Scene, Scene.Joueur2), Scene.CameraDoitSauter,
    );
  }
}
