// camera-separee.js — l'ecran qui se separe EN DOUCEUR en deux quand les
// joueurs s'eloignent.
//
// === L'idee : une valeur continue, pas un interrupteur ====================
//
// On n'a pas "un ecran" OU "deux ecrans" : on a une valeur
//
//     Scene.PartSeparation   (de 0 a 1)
//
//   0   -> les joueurs sont proches : UNE seule camera, sur tout l'ecran,
//          centree entre eux.
//   1   -> les joueurs sont loin : l'ecran est coupe en DEUX moities egales,
//          chaque camera centree sur "son" joueur.
//   0 < x < 1 -> entre les deux : la camera du joueur de DROITE apparait par
//          le bord droit de l'ecran et grandit petit a petit, pendant que la
//          camera du joueur de GAUCHE se retrecit. Ce que chaque camera regarde
//          (raccord avec l'ecran unique au debut, joueur toujours visible,
//          centrage sur son joueur a la fin) est decide dans camera.js
//          (voir PointSuiviParCamera).
//
// PartSeparation depend de la DISTANCE entre les joueurs (voir
// CalculerSeparationVoulue) : elle commence a monter bien avant qu'un joueur
// soit pres du bord de l'ecran, donc personne n'est jamais coupe ou perdu de
// vue. Et elle est lissee dans le temps (voir MettreAJourEcranSepare) pour
// que meme un saut brusque (un portail...) donne une transition douce.
//
// Ce fichier calcule PartSeparation et regle la taille/position des deux
// cameras. Le fait de "suivre" un joueur (le scroll) est dans camera.js.
//
// Etat garde sur la scene :
//   Scene.CameraJoueur2   : la 2e camera (creee au depart, voir joueur2.js).
//   Scene.PartSeparation  : la valeur 0..1 decrite ci-dessus.
//   Scene.Joueur1ACote    : quand l'ecran commence a se separer, true si le
//                           joueur 1 est a GAUCHE dans le monde (donc sa camera
//                           est la moitie gauche), false s'il est a droite.
//                           Fige pendant toute la separation, pour que les
//                           cameras ne s'echangent pas si les joueurs se croisent.

import { ZoomCamera } from './config.js';

// --- Reglages ------------------------------------------------------------

// Distance entre les joueurs, en "parts d'ecran entier" (1 = la largeur ou la
// hauteur de monde visible quand l'ecran est entier) :
//   - jusqu'a DebutSeparation : un seul ecran (PartSeparation = 0) ;
//   - de DebutSeparation a FinSeparation : l'ecran se separe petit a petit ;
//   - au-dela de FinSeparation : deux moities egales (PartSeparation = 1).
// FinSeparation reste bien < 1 pour que la separation soit finie AVANT que
// les joueurs soient aux bords de l'ecran : les cameras suivent avec un petit
// retard (lissage), il faut de la marge pour que personne ne sorte de vue
// pendant la transition.
const DebutSeparation = 0.35;
const FinSeparation = 0.75;

// Vitesse du lissage de PartSeparation : part de l'ecart comblee a chaque
// "frame de reference" (1/60 s). 0.1 = assez doux, 0.3 = plus vif.
const VitesseLissageSeparation = 0.12;

// La ligne de separation (un <div> HTML pose par-dessus le jeu).
const IdLigneSeparation = 'ligne-separation-ecran';
const EpaisseurLigneSeparation = 4; // pixels d'ecran


// --- Mise en place (une fois, quand le joueur 2 est cree) --------------

export function InstallerCameraSeparee(Scene) {
  // Une 2e camera, de la taille de l'ecran pour l'instant ; sa position et sa
  // taille reelles sont reglees a chaque frame par AppliquerDispositionCameras.
  const Camera2 = Scene.cameras.add(0, 0, Scene.scale.width, Scene.scale.height);
  Camera2.setZoom(ZoomCamera);                // meme zoom que la camera principale
  Camera2.setBackgroundColor('#000000');
  Camera2.setVisible(false);                  // cachee tant que PartSeparation vaut 0
  Scene.CameraJoueur2 = Camera2;

  Scene.PartSeparation = 0;
  Scene.Joueur1ACote = true;

  CreerLigneSeparation(Scene);
  AppliquerDispositionCameras(Scene);
}

// Cree le <div> de la ligne noire (ou le reutilise s'il existe deja, par
// exemple apres un scene.restart) et le cache. Noire et pas blanche : le
// decor du jeu est surtout blanc.
function CreerLigneSeparation(Scene) {
  let Ligne = document.getElementById(IdLigneSeparation);
  if (!Ligne) {
    Ligne = document.createElement('div');
    Ligne.id = IdLigneSeparation;
    Ligne.style.position = 'absolute';
    Ligne.style.top = '0';
    Ligne.style.bottom = '0';
    Ligne.style.width = `${EpaisseurLigneSeparation}px`;
    Ligne.style.background = '#000000';
    Ligne.style.pointerEvents = 'none'; // ne bloque jamais les clics sur le jeu

    // La ligne se place par rapport au conteneur du jeu : il doit etre
    // "positionne" pour que `left` soit relatif a lui.
    const Conteneur = Scene.game.canvas.parentElement;
    Conteneur.style.position = 'relative';
    Conteneur.appendChild(Ligne);
  }
  Ligne.style.display = 'none';
}


// --- Quelle separation voulons-nous ? ----------------------------------

// A quel point faudrait-il separer l'ecran, d'apres la distance entre les
// joueurs ? Renvoie un nombre de 0 (un seul ecran) a 1 (deux moities).
function CalculerSeparationVoulue(Scene) {
  // Certaines scenes doivent couvrir TOUT l'ecran (voir EcranEntierObligatoire) :
  // on vise un ecran entier tant qu'elles durent.
  if (EcranEntierObligatoire(Scene)) return 0;

  const J1 = Scene.Personnage;
  const J2 = Scene.Joueur2;

  // Taille du monde visible quand l'ecran est ENTIER (pas la taille d'une moitie).
  const LargeurMondeVisible = Scene.scale.width / ZoomCamera;
  const HauteurMondeVisible = Scene.scale.height / ZoomCamera;

  // Distances entre les joueurs, en "parts d'ecran entier". On prend la plus
  // grande des deux (horizontale ou verticale) : un joueur tres haut au-dessus
  // de l'autre doit aussi separer l'ecran.
  const PartHorizontale = Math.abs(J1.x - J2.x) / LargeurMondeVisible;
  const PartVerticale = Math.abs(J1.y - J2.y) / HauteurMondeVisible;
  const Eloignement = Math.max(PartHorizontale, PartVerticale);

  // Avancement entre DebutSeparation (0) et FinSeparation (1), borne a [0, 1]...
  const Avancement = Phaser.Math.Clamp(
    (Eloignement - DebutSeparation) / (FinSeparation - DebutSeparation), 0, 1,
  );
  // ... puis adouci aux deux bouts ("smoothstep") pour qu'il n'y ait pas
  // d'a-coup quand ca demarre ou quand ca finit.
  return Avancement * Avancement * (3 - 2 * Avancement);
}


// --- Mise a jour (a appeler une fois par frame) --------------------------

export function MettreAJourEcranSepare(Scene, TempsEcoule) {
  const J2 = Scene.Joueur2;
  if (!Scene.CameraJoueur2 || !J2 || !J2.active) return;

  const Voulue = CalculerSeparationVoulue(Scene);

  // Lissage : PartSeparation rejoint la valeur voulue en douceur, au lieu d'y
  // sauter. "Pow" rend la vitesse independante du nombre de frames par
  // seconde : meme douceur a 60 Hz qu'a 144 Hz. (16.67 ms = une frame a 60 Hz)
  const Delta = Math.min(TempsEcoule || 16.67, 100); // plafonne : un gros lag ne fait pas "sauter" la transition
  const Part = 1 - Math.pow(1 - VitesseLissageSeparation, Delta / 16.67);
  const AvantPart = Scene.PartSeparation;
  Scene.PartSeparation += (Voulue - Scene.PartSeparation) * Part;
  if (Scene.PartSeparation < 0.001) Scene.PartSeparation = 0; // evite de trainer "presque 0" pour toujours

  // Qui est a gauche ? On le decide au moment ou la separation demarre (on
  // passe de 0 a "un peu plus que 0") et on ne le change plus ensuite, pour
  // que les deux cameras ne s'echangent pas d'un coup si les joueurs se croisent.
  if (AvantPart === 0 && Scene.PartSeparation > 0) {
    Scene.Joueur1ACote = Scene.Personnage.x <= J2.x;
  }

  AppliquerDispositionCameras(Scene);
}

// true pendant les scenes qui doivent occuper tout l'ecran et ne concernent
// que le joueur 1 : le voyage en train (fondu au noir + trajet), le passage
// d'une carte a l'autre par un tunnel (teleportation) et l'ecran de mort du
// glitch2 (fond noir + texte). Avec l'ecran coupe en deux, ces effets ne
// couvriraient que la moitie du joueur 1.
export function EcranEntierObligatoire(Scene) {
  return Scene.EtatGare === 'enCours' || !!Scene.GlitchEtatFin || !!Scene.TeleportationEnCours;
}

// true si la 2e camera est visible, c'est-a-dire si l'ecran est (un peu ou
// completement) separe.
export function EcranEstSepare(Scene) {
  return !!Scene.CameraJoueur2 && Scene.PartSeparation > 0;
}

// La camera qui montre un joueur donne, pour faire un fondu "sur son ecran" :
// la 2e camera pour le joueur 2 si l'ecran est separe a plus de moitie (c'est
// alors elle qui le montre), la camera principale dans tous les autres cas.
export function CameraDuJoueur(Scene, Joueur) {
  if (Joueur === Scene.Joueur2 && EcranEstSepare(Scene) && Scene.PartSeparation >= 0.5) {
    return Scene.CameraJoueur2;
  }
  return Scene.cameras.main;
}


// --- Disposition des cameras sur l'ecran -----------------------------
//
// Appelee a chaque frame (par MettreAJourEcranSepare) et a chaque
// redimensionnement de la fenetre (par scene-jeu.js). Elle traduit
// PartSeparation en tailles de cameras :
//
//   PartSeparation = 0   : [ camera gauche : TOUT l'ecran ][ droite : rien ]
//   PartSeparation = 0.5 : [ camera gauche : 75 %   ][ droite : 25 % ]
//   PartSeparation = 1   : [ camera gauche : 50 %  ][ droite : 50 % ]
//
// La camera "gauche" est celle du joueur le plus a gauche dans le monde
// (voir Scene.Joueur1ACote).

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
  const Part = Scene.PartSeparation;

  // Pas separe du tout : la camera principale prend toute la place, la 2e est cachee.
  if (Part <= 0) {
    Principale.setViewport(0, 0, Largeur, Hauteur);
    Camera2.setVisible(false);
    if (Ligne) Ligne.style.display = 'none';
    return;
  }

  // Largeur de la camera de gauche : tout l'ecran (Part = 0) -> la moitie (Part = 1).
  const LargeurGauche = Math.round(Largeur * (1 - 0.5 * Part));
  const LargeurDroite = Largeur - LargeurGauche;

  const CameraGauche = Scene.Joueur1ACote ? Principale : Camera2;
  const CameraDroite = Scene.Joueur1ACote ? Camera2 : Principale;

  // setViewport(x, y, largeur, hauteur) = ou la camera dessine sur l'ecran.
  CameraGauche.setViewport(0, 0, LargeurGauche, Hauteur);
  CameraDroite.setViewport(LargeurGauche, 0, Math.max(LargeurDroite, 1), Hauteur);
  Camera2.setVisible(true);

  // La ligne suit la frontiere entre les deux cameras, et apparait en fondu :
  // invisible au tout debut (frontiere au bord de l'ecran), pleine des que la
  // separation est bien entamee.
  if (Ligne) {
    Ligne.style.display = 'block';
    Ligne.style.left = `${LargeurGauche - EpaisseurLigneSeparation / 2}px`;
    Ligne.style.opacity = String(Math.min(1, Part * 4));
  }
}


// --- La souris et les deux cameras ------------------------------------
//
// Quand l'ecran est separe, un meme point de l'ecran correspond a un endroit
// DIFFERENT du monde selon la camera sous la souris (chaque camera montre une
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
