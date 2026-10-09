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
//   0 < x < 1 -> entre les deux : la camera du joueur QUI S'ELOIGNE apparait
//          par le bord de l'ecran vers lequel il s'eloigne (a droite s'il part
//          vers la droite, a gauche s'il part vers la gauche) et grandit petit
//          a petit, pendant que la camera de l'autre joueur (celui qui reste)
//          se retrecit. Ce que chaque camera regarde
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
//   Scene.JoueurBande     : le joueur QUI S'ELOIGNE quand la separation demarre.
//                           Sa camera est la "bande" qui apparait par un bord
//                           de l'ecran et grandit. L'autre joueur garde la
//                           grande camera, qui se retrecit.
//   Scene.BandeAGauche    : true si la bande apparait a GAUCHE de l'ecran (le
//                           joueur qui s'eloigne part vers la gauche), false
//                           si elle apparait a DROITE.
//                           Ces deux valeurs sont fixees au debut de la
//                           separation et ne changent plus tant que l'ecran
//                           reste separe, pour que les cameras ne s'echangent
//                           pas si les joueurs se croisent.

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
const DebutSeparation = 0.25;
const FinSeparation = 0.55;

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

  // Le voile de bruit du glitch (feature glitch) est un objet du monde pose sur
  // la vue du JOUEUR 1 : la 2e camera ne doit pas le dessiner (sinon le bruit
  // du joueur 1 apparaitrait aussi sur l'ecran du joueur 2 des que leurs
  // zones du monde se recouvrent). Camera.ignore(objet) = "cette camera ne
  // dessine pas cet objet". (Les objets de l'ecran de mort glitch2, crees plus
  // tard, sont ignores de la meme facon dans glitch.js.)
  if (Scene.SpriteGlitch) Camera2.ignore(Scene.SpriteGlitch);

  Scene.PartSeparation = 0;
  Scene.JoueurBande = Scene.Joueur2;
  Scene.BandeAGauche = false;
  Scene.HistoriquePositionsX = []; // pour savoir qui s'eloigne (voir DeciderQuiSEloigne)

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

  // On retient les positions recentes des joueurs : elles servent a savoir
  // lequel des deux s'eloigne quand la separation demarre.
  NoterPositionsRecentes(Scene);

  // Quel joueur s'eloigne, et de quel cote ? On le decide au moment ou la
  // separation demarre (on passe de 0 a "un peu plus que 0") et on ne le
  // change plus ensuite, pour que les cameras ne s'echangent pas d'un coup si
  // les joueurs se croisent.
  if (AvantPart === 0 && Scene.PartSeparation > 0) {
    DeciderQuiSEloigne(Scene);
  }

  AppliquerDispositionCameras(Scene);
}

// --- Qui s'eloigne ? ----------------------------------------------------
//
// Quand la separation demarre, la nouvelle camera (la "bande") doit apparaitre
// du cote vers lequel PART le joueur qui s'eloigne : s'il s'en va vers la
// droite, la bande arrive par la droite ; vers la gauche, par la gauche.
// Pour savoir qui s'eloigne, on regarde lequel des deux joueurs a le plus
// BOUGE pendant la derniere demi-seconde (celui qui est reste sur place est
// celui qui "attend").

const NombreImagesHistorique = 30; // ~ une demi-seconde a 60 images par seconde

// Garde les positions x des deux joueurs sur les dernieres images.
function NoterPositionsRecentes(Scene) {
  const Historique = Scene.HistoriquePositionsX;
  Historique.push({ J1: Scene.Personnage.x, J2: Scene.Joueur2.x });
  if (Historique.length > NombreImagesHistorique) Historique.shift();
}

// Remplit Scene.JoueurBande et Scene.BandeAGauche (voir l'en-tete du fichier).
function DeciderQuiSEloigne(Scene) {
  const J1 = Scene.Personnage;
  const J2 = Scene.Joueur2;

  // Distance parcourue par chacun entre la plus ancienne position gardee et
  // maintenant. (Un portail qui teleporte un joueur donne une tres grande
  // distance : c'est bien lui qui "s'eloigne".)
  const Ancienne = Scene.HistoriquePositionsX[0];
  const DistanceJ1 = Math.abs(J1.x - Ancienne.J1);
  const DistanceJ2 = Math.abs(J2.x - Ancienne.J2);

  // Le joueur qui s'eloigne : celui qui a le plus bouge. A egalite (les deux
  // bougent autant, ou aucun), on prend le joueur 2.
  Scene.JoueurBande = DistanceJ1 > DistanceJ2 ? J1 : J2;
  const Autre = Scene.JoueurBande === J1 ? J2 : J1;

  // La bande est du cote vers lequel il s'eloigne, c'est-a-dire du cote ou il
  // se trouve par rapport a l'autre joueur : a gauche s'il est a gauche de
  // l'autre, a droite sinon.
  Scene.BandeAGauche = Scene.JoueurBande.x < Autre.x;
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
//   PartSeparation = 0   : [ l'autre camera : TOUT l'ecran ][ bande : rien ]
//   PartSeparation = 0.5 : [ l'autre camera : 75 %   ][ bande : 25 % ]
//   PartSeparation = 1   : [ l'autre camera : 50 %  ][ bande : 50 % ]
//
// La "bande" est la camera du joueur qui s'eloigne (Scene.JoueurBande) ; elle
// est collee au bord de l'ecran vers lequel il part (Scene.BandeAGauche). Sur
// ce schema elle est a droite ; a gauche, c'est le meme dessin en miroir.

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

  // La camera "bande" est celle du joueur qui s'eloigne (Scene.JoueurBande) :
  // elle grandit de rien (Part = 0) jusqu'a la moitie de l'ecran (Part = 1).
  // L'autre camera prend tout le reste de l'ecran.
  const CameraBande = Scene.JoueurBande === Scene.Personnage ? Principale : Camera2;
  const CameraAutre = CameraBande === Principale ? Camera2 : Principale;
  const LargeurBande = Math.max(1, Math.round(Largeur * 0.5 * Part));
  const LargeurAutre = Largeur - LargeurBande;

  // setViewport(x, y, largeur, hauteur) = ou la camera dessine sur l'ecran.
  // La bande est collee au bord de l'ecran vers lequel le joueur s'eloigne.
  let FrontiereX; // position de la ligne de separation (en pixels d'ecran)
  if (Scene.BandeAGauche) {
    CameraBande.setViewport(0, 0, LargeurBande, Hauteur);
    CameraAutre.setViewport(LargeurBande, 0, LargeurAutre, Hauteur);
    FrontiereX = LargeurBande;
  } else {
    CameraAutre.setViewport(0, 0, LargeurAutre, Hauteur);
    CameraBande.setViewport(LargeurAutre, 0, LargeurBande, Hauteur);
    FrontiereX = LargeurAutre;
  }
  Camera2.setVisible(true);

  // La ligne suit la frontiere entre les deux cameras, et apparait en fondu :
  // invisible au tout debut (frontiere au bord de l'ecran), pleine des que la
  // separation est bien entamee.
  if (Ligne) {
    Ligne.style.display = 'block';
    Ligne.style.left = `${FrontiereX - EpaisseurLigneSeparation / 2}px`;
    Ligne.style.opacity = String(Math.min(1, Part * 4));
  }
}


// --- Un joueur ne doit jamais apparaitre deux fois -----------------------
//
// Pendant la separation, un meme joueur peut se trouver dans le champ des deux
// cameras en meme temps : par exemple celui qui s'eloigne est visible a la fois
// au bord de la grande camera ET dans sa propre bande. On le verrait alors
// deux fois a l'ecran (ou, pire, un morceau de lui dans la bande fine et lui en
// entier dans la grande camera).
//
// Regle, pour chaque joueur (sa camera = "la sienne", l'autre = "l'autre") :
//   - la SIENNE le dessine s'il est ENTIEREMENT dans son champ, ou s'il n'est
//     dans le champ de l'autre camera non plus (il faut bien le dessiner
//     quelque part) ;
//   - l'AUTRE camera ne le dessine PAS s'il est entierement dans le champ de
//     la sienne.
// Resultat : au debut, quand la bande est trop fine pour contenir le joueur, il
// reste dessine par la grande camera ; des que la bande le contient en entier,
// la grande camera arrete de le dessiner. On ne le voit jamais deux fois.
//
// A appeler une fois par frame, apres le deplacement des deux cameras.

// Demi-largeur et demi-hauteur d'un joueur (le sprite fait 16 x 16 pixels).
const DemiTailleJoueur = 8;

export function MasquerJoueursEnDouble(Scene) {
  const J2 = Scene.Joueur2;
  const Camera2 = Scene.CameraJoueur2;
  if (!Camera2 || !J2 || !J2.active) return;

  const Principale = Scene.cameras.main;
  const Separe = Scene.PartSeparation > 0;

  RegleDoublon(Scene.Personnage, Principale, Camera2, Separe); // joueur 1 : sa camera = la principale
  RegleDoublon(J2, Camera2, Principale, Separe);               // joueur 2 : sa camera = la 2e
}

// Applique la regle ci-dessus a un joueur.
function RegleDoublon(Joueur, CameraSienne, CameraAutre, Separe) {
  // Pas separe : la 2e camera est cachee, personne a masquer (on remet tout a "visible").
  if (!Separe) {
    RegleVisibilite(Joueur, CameraSienne, true);
    RegleVisibilite(Joueur, CameraAutre, true);
    return;
  }

  const EntierDansSienne = DansLaVue(CameraSienne, Joueur, -DemiTailleJoueur); // sprite en entier dedans
  const VisibleDansAutre = DansLaVue(CameraAutre, Joueur, DemiTailleJoueur);   // au moins un bout dedans

  RegleVisibilite(Joueur, CameraSienne, EntierDansSienne || !VisibleDansAutre);
  RegleVisibilite(Joueur, CameraAutre, !EntierDansSienne);
}

// true si le CENTRE de l'objet est dans le champ de la camera, avec une marge :
//   marge > 0 : champ agrandi (un bout du sprite suffit : "au moins un bout") ;
//   marge < 0 : champ reduit  (tout le sprite doit etre dedans : "en entier").
// On se base sur le centre memorise de la camera (voir camera.js) plutot que
// sur worldView, qui n'est mis a jour qu'au moment du dessin.
function DansLaVue(Camera, Objet, Marge) {
  const CentreX = Camera.CentreXMemo !== undefined ? Camera.CentreXMemo : Camera.scrollX + Camera.width / 2;
  const CentreY = Camera.CentreYMemo !== undefined ? Camera.CentreYMemo : Camera.scrollY + Camera.height / 2;
  const DemiLargeur = Camera.width / Camera.zoom / 2 + Marge;
  const DemiHauteur = Camera.height / Camera.zoom / 2 + Marge;
  return Math.abs(Objet.x - CentreX) <= DemiLargeur && Math.abs(Objet.y - CentreY) <= DemiHauteur;
}

// Fait dessiner (Visible = true) ou non (false) l'objet par cette camera.
// Phaser garde pour chaque objet un masque de bits des cameras qui l'ignorent
// (cameraFilter) : mettre le bit de la camera = elle l'ignore ; le retirer = elle
// le dessine.
function RegleVisibilite(Objet, Camera, Visible) {
  if (Visible) Objet.cameraFilter &= ~Camera.id;
  else Objet.cameraFilter |= Camera.id;
}


// --- La souris et les deux cameras ------------------------------------
//
// Quand l'ecran est separe, un meme point de l'ecran correspond a un endroit
// DIFFERENT du monde selon la camera sous la souris (chaque camera montre une
// partie differente de la carte). Pour savoir ce que la souris survole ou
// clique, il faut donc d'abord trouver LA camera qui est sous la souris, puis
// convertir avec cette camera-la.

// La camera dont la zone d'affichage contient le point d'ecran (EcranX, EcranY)
// (la principale si l'ecran n'est pas separe, ou si on ne trouve rien).
function CameraSousLePoint(Scene, EcranX, EcranY) {
  const Camera2 = Scene.CameraJoueur2;

  // Seule la 2e camera visible (= ecran separe) peut etre sous le point.
  if (Camera2 && Camera2.visible
      && EcranX >= Camera2.x && EcranX < Camera2.x + Camera2.width
      && EcranY >= Camera2.y && EcranY < Camera2.y + Camera2.height) {
    return Camera2;
  }
  return Scene.cameras.main;
}

// L'endroit du MONDE qui est affiche au point d'ecran (EcranX, EcranY), vu par
// la bonne camera. Sert aussi a viser : on retient le point d'ecran du clic, puis
// on le convertit plus tard. (Camera.getWorldPoint accepte directement des
// coordonnees d'ecran : pas besoin de retirer le decalage de la moitie droite.)
export function PointMondeEcran(Scene, EcranX, EcranY) {
  return CameraSousLePoint(Scene, EcranX, EcranY).getWorldPoint(EcranX, EcranY);
}

// La camera sous la souris (voir CameraSousLePoint).
export function CameraSousLaSouris(Scene) {
  const Souris = Scene.input.activePointer;
  return CameraSousLePoint(Scene, Souris.x, Souris.y);
}

// L'endroit du MONDE sous la souris, vu par la bonne camera.
export function PointMondeSouris(Scene) {
  const Souris = Scene.input.activePointer;
  return PointMondeEcran(Scene, Souris.x, Souris.y);
}
