// camera-separee.js — l'ecran separe en deux quand les joueurs s'eloignent.
//
// Principe general :
//   - Tant que les deux joueurs sont proches : UNE seule camera (la camera
//     principale de Phaser, Scene.cameras.main), centree entre eux, sur tout
//     l'ecran. C'est ce que fait camera.js.
//   - Quand ils s'eloignent trop : on separe l'ecran en deux moities.
//       * la camera principale (Scene.cameras.main) suit le joueur 1 ;
//       * une 2e camera (Scene.CameraJoueur2) suit le joueur 2 ;
//       * celui qui est le plus a gauche dans le monde est dans la moitie
//         gauche de l'ecran, l'autre dans la moitie droite ;
//       * une fine ligne noire (un <div> HTML) separe les deux moities (noire
//         et pas blanche : le decor du jeu est surtout blanc).
//   - Quand ils se rapprochent a nouveau : retour a une seule camera.
//
// Ce fichier decide QUAND separer (MettreAJourEcranSepare) et COMMENT
// disposer les deux cameras sur l'ecran (AppliquerDispositionCameras).
// Faire suivre un joueur a une camera (le calcul du scroll) se fait dans
// camera.js.
//
// Etat garde sur la scene :
//   Scene.CameraJoueur2    : la 2e camera (creee une seule fois, au depart).
//   Scene.EcranSepare      : true quand l'ecran est coupe en deux.
//   Scene.Joueur1ACote     : quand l'ecran est coupe, true si le joueur 1 est
//                            dans la moitie GAUCHE (sinon il est a droite).
//   Scene.Camera2DoitSauter: true une frame apres une separation, pour que la
//                            2e camera se place d'un coup sur le joueur 2
//                            (au lieu de glisser depuis sa position de depart).

import { ZoomCamera } from './config.js';

// Quand separer, quand rejoindre ?
//
// On compare la distance entre les joueurs a la taille du monde visible quand
// l'ecran est entier (largeur ou hauteur), exprimee en "parts" de cette taille :
//   - on SEPARE au-dela de 0.8 (les joueurs sont presque aux bords de l'ecran) ;
//   - on REJOINT en dessous de 0.55 (chacun tient dans une moitie d'ecran).
// Les deux seuils sont differents expres (marge appelee "hysteresis") : sinon,
// des joueurs a la distance exacte du seuil feraient clignoter l'ecran entre
// "un" et "deux" a chaque frame.
const SeuilSeparation = 0.8;
const SeuilRetourEcranEntier = 0.55;

// La ligne de separation (un <div> HTML pose par-dessus le jeu).
const IdLigneSeparation = 'ligne-separation-ecran';
const EpaisseurLigneSeparation = 4; // pixels d'ecran


// --- Mise en place (une fois, quand le joueur 2 est cree) --------------

export function InstallerCameraSeparee(Scene) {
  // Une 2e camera, de la taille de l'ecran pour l'instant ; sa position et sa
  // taille reelles seront reglees par AppliquerDispositionCameras.
  const Camera2 = Scene.cameras.add(0, 0, Scene.scale.width, Scene.scale.height);
  Camera2.setZoom(ZoomCamera);                // meme zoom que la camera principale
  Camera2.setBackgroundColor('#000000');
  Camera2.setVisible(false);                  // cachee tant que l'ecran n'est pas separe
  Scene.CameraJoueur2 = Camera2;

  Scene.EcranSepare = false;
  Scene.Joueur1ACote = true;
  Scene.Camera2DoitSauter = false;

  CreerLigneSeparation(Scene);
  AppliquerDispositionCameras(Scene);
}

// Cree le <div> de la ligne noire (ou le reutilise s'il existe deja, par
// exemple apres un scene.restart) et le cache.
function CreerLigneSeparation(Scene) {
  let Ligne = document.getElementById(IdLigneSeparation);
  if (!Ligne) {
    Ligne = document.createElement('div');
    Ligne.id = IdLigneSeparation;
    Ligne.style.position = 'absolute';
    Ligne.style.top = '0';
    Ligne.style.bottom = '0';
    Ligne.style.left = '50%';
    Ligne.style.width = `${EpaisseurLigneSeparation}px`;
    Ligne.style.marginLeft = `-${EpaisseurLigneSeparation / 2}px`;
    Ligne.style.background = '#000000';
    Ligne.style.pointerEvents = 'none'; // ne bloque jamais les clics sur le jeu
    Ligne.style.display = 'none';

    // La ligne se place par rapport au conteneur du jeu : il doit etre
    // "positionne" pour que `left: 50%` veuille dire "milieu du jeu".
    const Conteneur = Scene.game.canvas.parentElement;
    Conteneur.style.position = 'relative';
    Conteneur.appendChild(Ligne);
  }
  Ligne.style.display = 'none';
}


// --- Decision : separer ou pas (a appeler une fois par frame) -----------

export function MettreAJourEcranSepare(Scene) {
  const J1 = Scene.Personnage;
  const J2 = Scene.Joueur2;
  if (!Scene.CameraJoueur2 || !J2 || !J2.active) return;

  // Taille du monde visible quand l'ecran est ENTIER (pas la taille d'une moitie).
  const LargeurMondeVisible = Scene.scale.width / ZoomCamera;
  const HauteurMondeVisible = Scene.scale.height / ZoomCamera;

  // Distances entre les joueurs, en "parts d'ecran entier".
  const PartHorizontale = Math.abs(J1.x - J2.x) / LargeurMondeVisible;
  const PartVerticale = Math.abs(J1.y - J2.y) / HauteurMondeVisible;
  const Eloignement = Math.max(PartHorizontale, PartVerticale);

  if (!Scene.EcranSepare && Eloignement > SeuilSeparation) {
    SeparerEcran(Scene);
  } else if (Scene.EcranSepare && Eloignement < SeuilRetourEcranEntier) {
    RejoindreEcran(Scene);
  }
}

function SeparerEcran(Scene) {
  Scene.EcranSepare = true;
  // Le joueur le plus a gauche dans le monde va dans la moitie gauche.
  Scene.Joueur1ACote = Scene.Personnage.x <= Scene.Joueur2.x;
  Scene.Camera2DoitSauter = true; // la 2e camera se place d'un coup sur le joueur 2
  AppliquerDispositionCameras(Scene);
}

function RejoindreEcran(Scene) {
  Scene.EcranSepare = false;
  AppliquerDispositionCameras(Scene);
}


// --- Disposition des cameras sur l'ecran -----------------------------
//
// A rappeler a chaque changement : separation, retour a l'ecran entier, et
// redimensionnement de la fenetre (scene-jeu.js l'appelle dans ce cas).

export function AppliquerDispositionCameras(Scene) {
  const Principale = Scene.cameras.main;
  const Largeur = Scene.scale.width;
  const Hauteur = Scene.scale.height;
  const Camera2 = Scene.CameraJoueur2;

  // Pas de joueur 2 sur cette carte : la camera principale occupe tout l'ecran.
  if (!Camera2) {
    Principale.setViewport(0, 0, Largeur, Hauteur);
    return;
  }

  const Ligne = document.getElementById(IdLigneSeparation);

  if (!Scene.EcranSepare) {
    // Un seul ecran : la camera principale prend toute la place, la 2e est cachee.
    Principale.setViewport(0, 0, Largeur, Hauteur);
    Camera2.setVisible(false);
    if (Ligne) Ligne.style.display = 'none';
    return;
  }

  // Ecran separe : deux moities de meme taille.
  const LargeurMoitie = Math.floor(Largeur / 2);
  const XMoitieGauche = 0;
  const XMoitieDroite = Largeur - LargeurMoitie;

  // setViewport(x, y, largeur, hauteur) = ou la camera dessine sur l'ecran.
  const XPrincipale = Scene.Joueur1ACote ? XMoitieGauche : XMoitieDroite;
  const XCamera2 = Scene.Joueur1ACote ? XMoitieDroite : XMoitieGauche;
  Principale.setViewport(XPrincipale, 0, LargeurMoitie, Hauteur);
  Camera2.setViewport(XCamera2, 0, LargeurMoitie, Hauteur);
  Camera2.setVisible(true);
  if (Ligne) Ligne.style.display = 'block';
}


// --- La souris et les deux cameras ------------------------------------
//
// Quand l'ecran est separe, un meme point de l'ecran correspond a un endroit
// DIFFERENT du monde selon la moitie ou il se trouve (chaque moitie montre une
// partie differente de la carte). Pour savoir ce que la souris survole ou
// clique, il faut donc d'abord trouver LA camera qui est sous la souris, puis
// convertir avec cette camera-la.

// La camera dont la zone d'affichage contient la souris (la principale si
// l'ecran n'est pas separe, ou si on ne trouve rien).
export function CameraSousLaSouris(Scene) {
  const Souris = Scene.input.activePointer;
  const Camera2 = Scene.CameraJoueur2;

  // Seule la 2e camera visible (= ecran separe) peut etre sous la souris.
  if (Camera2 && Camera2.visible && SourisDansCamera(Souris, Camera2)) return Camera2;
  return Scene.cameras.main;
}

// true si le point (Souris.x, Souris.y) est dans le rectangle d'affichage de la camera.
function SourisDansCamera(Souris, Camera) {
  return Souris.x >= Camera.x && Souris.x < Camera.x + Camera.width
      && Souris.y >= Camera.y && Souris.y < Camera.y + Camera.height;
}

// L'endroit du MONDE sous la souris, vu par la bonne camera.
// (Camera.getWorldPoint accepte directement les coordonnees d'ecran de la
// souris : pas besoin de retirer le decalage de la moitie droite.)
export function PointMondeSouris(Scene) {
  const Souris = Scene.input.activePointer;
  return CameraSousLaSouris(Scene).getWorldPoint(Souris.x, Souris.y);
}
