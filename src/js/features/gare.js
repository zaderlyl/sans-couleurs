// features/gare.js — la gare et le voyage en train.
//
// Le joueur entre dans la zone de la gare, appuie sur E : le train (sprite
// anime gare.png) demarre, l'ecran devient noir, puis SOIT il change de carte
// (si la config de la carte a une `suivante`), SOIT il ressort de l'autre
// cote du "tunnel" de la meme carte (calque "derriere", un miroir de la gare)
// et peut repartir dans l'autre sens.
//
// Rien n'est code en dur : position/zone de la gare et de sa sortie sont
// calculees depuis les calques "gare" et "derriere" de la carte active
// (CalculerBoiteTuiles). Le calque "gare" pose dans Tiled n'est jamais
// affiche : le SpriteGare (fige sur la frame 0 au repos) le remplace, y
// compris a l'arret, pour s'aligner au pixel pres pendant les animations.


// --- Spritesheet (gare.png) ---
// Grille 8x8 = 64 frames de 256x256, fond transparent.

import { ChargerFeuille } from '../loading.js';
import { CreerIconeInteraction } from '../icone-interaction.js';
import { CalculerBoiteTuiles, CalqueEstFlippe, TailleTuile, CleCarteSuivante, ConfigCarte } from '../maps/cartes.js';
import { Secouer, CreerAnim } from '../util.js';

const CleGare = 'animationGare';
const CheminGare = 'assets/sprites/environment/gare.png';
const TailleImageGare = 256;
const NombreImagesGare = 64;

// Calibration (etablie sur "debut"/"map1") : le bloc de tuiles de la gare a
// ete decoupe dans gare.png a partir du pixel (80, 208) de chaque frame. Le
// pixel (80, 240) d'une frame = coin bas-gauche du bloc, quelle que soit la
// carte.
const AncrageImageGareX = 80;
const AncrageImageGareY = 240;
const OrigineContenuGareX = AncrageImageGareX / TailleImageGare;
const OrigineContenuGareY = AncrageImageGareY / TailleImageGare;

// Le dessin utile d'une frame va de AncrageImageGareX a TailleImageGare
// (176px) et touche le bord droit (pas centre). Pour centrer ce contenu sur
// un bloc de tuiles dont on connait le centre, on retranche un decalage qui
// depend du sens du sprite ("flippe PUIS place") :
//   - non flippe : contenu [X .. X+176], centre X+88  -> X = centre - 88
//   - flippe     : contenu [X-80 .. X+96], centre X+8 -> X = centre - 8
const LargeurContenuGare = TailleImageGare - AncrageImageGareX;
const DecalageCentreGareNonFlippe = LargeurContenuGare / 2;               // 88
const DecalageCentreGareFlippe = LargeurContenuGare / 2 - AncrageImageGareX; // 8

const HauteurIconeGareY = 80; // hauteur fixe de l'icone E au-dessus du sol


export const Gare = {
  nom: 'gare',

  precharger(Scene) {
    ChargerFeuille(Scene, CleGare, CheminGare, TailleImageGare);
  },

  // Appele pendant create(), avant le personnage : pose PositionArrivee* que
  // create() lit ensuite pour faire apparaitre le joueur sur la gare quand il
  // arrive en train.
  installer(Scene, Ctx) {
    const { Carte, JeuDeTuiles } = Ctx;

    // Calque "gare" : garde comme flag "cette carte a une gare", jamais affiche.
    Scene.CalqueGare = Carte.createLayer('gare', JeuDeTuiles, 0, 0);
    if (Scene.CalqueGare) Scene.CalqueGare.setVisible(false);

    // Sens de la mosaique "gare" de CETTE carte (ex: "enfance" la dessine
    // retournee) : le SpriteGare doit etre flippe pareil.
    Scene.GareFlippee = CalqueEstFlippe(Carte, 'gare');

    CalculerPositionsGare(Scene, Carte);
    CalculerPositionsSortie(Scene, Carte, JeuDeTuiles);
    CreerAnimsGare(Scene);

    Scene.SpriteGare = Scene.add.sprite(Scene.PositionGareX, Scene.PositionGareY, CleGare, 0);
    Scene.SpriteGare.setOrigin(OrigineContenuGareX, OrigineContenuGareY);
    Scene.SpriteGare.setDepth(5);
    // Visible (frame 0) : c'est lui la "gare au repos" — sauf si la carte n'a
    // pas de calque "gare" exploitable (PositionGareX reste undefined).
    Scene.SpriteGare.setVisible(Scene.PositionGareX !== undefined);
    Scene.SpriteGare.setFlipX(Scene.GareFlippee);

    Scene.IconeInteraction = CreerIconeInteraction(Scene, Scene.PositionIconeInteractionX, HauteurIconeGareY);
    Scene.IconeInteractionRetour = CreerIconeInteraction(Scene, Scene.PositionIconeInteractionRetourX, HauteurIconeGareY);

    Scene.EtatGare = 'attente'; // attente -> enCours -> (retourAttente)

    // Sortie en train : desactivable carte par carte (`sortieGare: false`).
    // Sur le college, on arrive en train mais on ne peut pas repartir (pas
    // encore). Absent = true, pour ne rien changer aux autres cartes.
    Scene.SortieGareActive = ConfigCarte(Scene.NomCarteActuelle).sortieGare !== false;
  },

  // Appele en toute fin de create() : si on arrive en train, joue l'animation
  // d'arrivee (scene entierement prete).
  apresChargement(Scene) {
    if (Scene.ArriveeParTrain && Scene.PositionGareX !== undefined) {
      JouerArriveeEnTrain(Scene);
    }
  },

  miseAJour(Scene) {
    if (!Scene.CalqueGare) return;

    // Interaction gare : icone qui suit dans la zone, E pour lancer. La
    // sequence ne demarre qu'a la fin de l'anim "E qui eclate", mais on passe
    // EtatGare a 'enCours' DES l'appui (verrou immediat contre un 2e appui).
    if (Scene.EtatGare === 'attente' && Scene.SortieGareActive) {
      const Presse = GererZoneInteraction(Scene, Scene.ZoneGare, Scene.IconeInteraction, () => DemarrerSequenceGare(Scene));
      if (Presse) Scene.EtatGare = 'enCours';
    }

    // Interaction retour : symetrique, une fois arrive de l'autre cote.
    if (Scene.EtatGare === 'retourAttente') {
      const Presse = GererZoneInteraction(Scene, Scene.ZoneRetour, Scene.IconeInteractionRetour, () => DemarrerRetourGare(Scene));
      if (Presse) Scene.EtatGare = 'enCours';
    }
  },
};


// --- Calcul des positions depuis les calques Tiled ---------------

function CalculerPositionsGare(Scene, Carte) {
  const Boite = CalculerBoiteTuiles(Carte, 'gare');
  if (!Boite) {
    // Pas de calque "gare" : interactivite desactivee (CalqueGare undefined).
    Scene.ZoneGare = { XMin: 0, XMax: 0, YMin: 0, YMax: 0 };
    return;
  }
  const { ColMin, ColMax, RangeeMin, RangeeMax } = Boite;
  const CentreGareX = (ColMin * TailleTuile + (ColMax + 1) * TailleTuile) / 2;

  Scene.PositionGareX = CentreGareX - (Scene.GareFlippee ? DecalageCentreGareFlippe : DecalageCentreGareNonFlippe);
  Scene.PositionGareY = RangeeMax * TailleTuile;
  Scene.PositionIconeInteractionX = CentreGareX;
  // Point d'apparition du joueur en arrivant en train : centre du bloc, rangee
  // du haut — la gravite le fait retomber sur le sol.
  Scene.PositionArriveeX = CentreGareX;
  Scene.PositionArriveeY = RangeeMin * TailleTuile;
  // Zone d'interaction : quelques cases centrees, a la rangee du bas.
  const ColCentre = ColMin + Math.floor((ColMax - ColMin) / 2);
  Scene.ZoneGare = {
    XMin: (ColCentre - 1) * TailleTuile,
    XMax: (ColCentre + 3) * TailleTuile,
    YMin: RangeeMax * TailleTuile,
    YMax: (RangeeMax + 1) * TailleTuile,
  };
}

// Le calque "derriere" (miroir de "gare", flip oppose) sert de sortie de
// tunnel. Absent sur certaines cartes (ex: "debut", qui change de carte au
// lieu de ressortir sur place).
function CalculerPositionsSortie(Scene, Carte, JeuDeTuiles) {
  const Boite = CalculerBoiteTuiles(Carte, 'derriere', !Scene.GareFlippee);
  Scene.ArriveeTrainConfiguree = !!Boite;

  if (!Boite) {
    // IconeInteractionRetour est quand meme creee (cachee) : position valide,
    // meme si ZoneRetour ne sera jamais atteinte.
    Scene.PositionIconeInteractionRetourX = 0;
    Scene.ZoneRetour = { XMin: 0, XMax: 0, YMin: 0, YMax: 0 };
    return;
  }

  Carte.createLayer('derriere', JeuDeTuiles, 0, 0).setVisible(false);
  const { ColMin, ColMax, RangeeMin, RangeeMax } = Boite;
  const CentreDerriereX = (ColMin * TailleTuile + (ColMax + 1) * TailleTuile) / 2;

  // Sprite centre sur ce bloc, dans le sens oppose a "gare".
  Scene.PositionGareInverseeX = CentreDerriereX - (Scene.GareFlippee ? DecalageCentreGareNonFlippe : DecalageCentreGareFlippe);
  Scene.PositionGareInverseeY = RangeeMax * TailleTuile;
  Scene.PositionSortieTunnelX = CentreDerriereX;
  Scene.PositionSortieTunnelY = RangeeMin * TailleTuile;
  Scene.ZoneRetour = {
    XMin: Scene.PositionSortieTunnelX - 32,
    XMax: Scene.PositionSortieTunnelX + 32,
    YMin: RangeeMax * TailleTuile,
    YMax: (RangeeMax + 1) * TailleTuile,
  };
  Scene.PositionIconeInteractionRetourX = Scene.PositionSortieTunnelX;
}

function CreerAnimsGare(Scene) {
  // clignoteGare : frames 2 et 3, 2 fois, lentement.
  CreerAnim(Scene, {
    key: 'clignoteGare',
    frames: [{ key: CleGare, frame: 2 }, { key: CleGare, frame: 3 }],
    frameRate: 2,
    repeat: 1,
  });
  // resteGare : frames 5 a 63, une fois (le train demarre).
  CreerAnim(Scene, {
    key: 'resteGare',
    frames: Scene.anims.generateFrameNumbers(CleGare, { start: 5, end: NombreImagesGare - 1 }),
    frameRate: 10,
    repeat: 0,
  });
  // arriveeGare : les memes a l'envers (le train arrive en douceur).
  const FramesArrivee = [];
  for (let i = NombreImagesGare - 1; i >= 5; i--) FramesArrivee.push({ key: CleGare, frame: i });
  CreerAnim(Scene, { key: 'arriveeGare', frames: FramesArrivee, frameRate: 10, repeat: 0 });
}


// --- Interaction ------------------------------------------------

// Icone qui suit dans `Zone` ; sur E, joue l'anim "E qui eclate" puis appelle
// `AuDeclenchement`. Renvoie true si E vient d'etre presse (pour que
// l'appelant pose son verrou tout de suite).
function GererZoneInteraction(Scene, Zone, Icone, AuDeclenchement) {
  const Perso = Scene.Personnage;
  const DansLaZone =
    Perso.x > Zone.XMin && Perso.x < Zone.XMax &&
    Perso.y > Zone.YMin && Perso.y < Zone.YMax;

  if (!DansLaZone) {
    Icone.setVisible(false);
    return false;
  }

  Icone.setVisible(true);
  Icone.play('iconeAttente', true); // true : ne relance pas si deja en cours

  if (!Phaser.Input.Keyboard.JustDown(Scene.ToucheInteraction)) return false;

  Icone.play('iconePressee');
  Icone.once('animationcomplete', () => {
    Icone.setVisible(false);
    AuDeclenchement();
  });
  return true;
}


// --- Sequences de voyage ---------------------------------------

// Depart : clignote -> tremble -> resteGare -> ecran noir, puis changement de
// carte (si `suivante`) ou sortie de l'autre cote du tunnel (calque
// "derriere"), ou retour sur place si ni l'un ni l'autre.
function DemarrerSequenceGare(Scene) {
  Scene.EtatGare = 'enCours';
  // Retenu pour ramener le joueur exactement ici au retour.
  Scene.PositionAvantVoyage = { x: Scene.Personnage.x, y: Scene.Personnage.y };

  GelerJoueur(Scene);
  // Remise a plat : au cas ou ce serait un 2e aller, le sprite a ete laisse
  // flippe/repositionne la fois d'avant.
  Scene.SpriteGare.setFlipX(Scene.GareFlippee);
  Scene.SpriteGare.setPosition(Scene.PositionGareX, Scene.PositionGareY);
  Scene.SpriteGare.setVisible(true);
  Scene.SpriteGare.play('clignoteGare');

  Scene.SpriteGare.once('animationcomplete', () => {
    Secouer(Scene, Scene.SpriteGare, 600, 1, () => {
      Scene.SpriteGare.play('resteGare');
      Scene.SpriteGare.once('animationcomplete', () => {
        Scene.cameras.main.fadeOut(500, 0, 0, 0);
        Scene.cameras.main.once('camerafadeoutcomplete', () => {
          if (!Scene.ArriveeTrainConfiguree) {
            const CarteApres = CleCarteSuivante(Scene.NomCarteActuelle);
            if (CarteApres) {
              // Redemarre la scene avec la carte suivante (ecran deja noir).
              Scene.scene.restart({ carte: CarteApres, arrivee: true });
              return;
            }
            // Le train ne mene nulle part : le joueur revient ou il etait.
            Scene.SpriteGare.setFrame(0);
            Scene.Personnage.setPosition(Scene.PositionAvantVoyage.x, Scene.PositionAvantVoyage.y);
            DegelerJoueur(Scene);
            Scene.cameras.main.fadeIn(500, 0, 0, 0);
            Scene.EtatGare = 'attente';
            return;
          }

          // Sortie de l'autre cote du tunnel de la MEME carte.
          Scene.SpriteGare.setVisible(false);
          Scene.Personnage.setPosition(Scene.PositionSortieTunnelX, Scene.PositionSortieTunnelY);
          Scene.CameraDoitSauter = true; // recadrage instantane

          Scene.SpriteGare.setFlipX(!Scene.GareFlippee);
          Scene.SpriteGare.setPosition(Scene.PositionGareInverseeX, Scene.PositionGareInverseeY);
          Scene.SpriteGare.setVisible(true);
          Scene.SpriteGare.play('arriveeGare');
          Scene.cameras.main.fadeIn(500, 0, 0, 0);

          Scene.SpriteGare.once('animationcomplete', () => {
            Scene.CameraDoitSauter = false;
            Scene.SpriteGare.setFrame(0); // reste visible, fige (train a l'arret)
            DegelerJoueur(Scene);
            Scene.EtatGare = 'retourAttente'; // le joueur peut repartir
          });
        });
      });
    });
  });
}

// Retour : meme sequence, inversee. Le sprite est deja sur place (flippe) ; il
// "repart" d'ici puis "arrive" a l'origine pendant que l'ecran se rallume.
function DemarrerRetourGare(Scene) {
  Scene.EtatGare = 'enCours';
  GelerJoueur(Scene);

  Scene.SpriteGare.setVisible(true);
  Scene.SpriteGare.play('clignoteGare');

  Scene.SpriteGare.once('animationcomplete', () => {
    Secouer(Scene, Scene.SpriteGare, 600, 1, () => {
      Scene.SpriteGare.play('resteGare');
      Scene.SpriteGare.once('animationcomplete', () => {
        Scene.cameras.main.fadeOut(500, 0, 0, 0);
        Scene.cameras.main.once('camerafadeoutcomplete', () => {
          Scene.SpriteGare.setVisible(false);
          Scene.Personnage.setPosition(Scene.PositionAvantVoyage.x, Scene.PositionAvantVoyage.y);
          Scene.CameraDoitSauter = true;

          Scene.SpriteGare.setFlipX(Scene.GareFlippee); // sprite a l'endroit
          Scene.SpriteGare.setPosition(Scene.PositionGareX, Scene.PositionGareY);
          Scene.SpriteGare.setVisible(true);
          Scene.SpriteGare.play('arriveeGare');
          Scene.cameras.main.fadeIn(500, 0, 0, 0);

          Scene.SpriteGare.once('animationcomplete', () => {
            Scene.CameraDoitSauter = false;
            Scene.SpriteGare.setFrame(0);
            DegelerJoueur(Scene);
            Scene.EtatGare = 'attente'; // un nouvel aller est possible
          });
        });
      });
    });
  });
}

// Arrivee sur cette carte depuis la precedente (scene.restart avec
// { arrivee: true }). Ecran deja noir ; l'anim d'arrivee joue sur le bloc
// "gare", puis le sprite reste fige sur la frame 0 (= gare au repos).
function JouerArriveeEnTrain(Scene) {
  Scene.cameras.main.fadeOut(0, 0, 0, 0);
  Scene.EtatGare = 'enCours';
  GelerJoueur(Scene);

  Scene.SpriteGare.setFlipX(Scene.GareFlippee);
  Scene.SpriteGare.setPosition(Scene.PositionGareX, Scene.PositionGareY);
  Scene.SpriteGare.setVisible(true);
  Scene.SpriteGare.play('arriveeGare');
  Scene.cameras.main.fadeIn(500, 0, 0, 0);

  Scene.SpriteGare.once('animationcomplete', () => {
    Scene.SpriteGare.setFrame(0);
    DegelerJoueur(Scene);
    Scene.EtatGare = 'attente';
  });
}

function GelerJoueur(Scene) {
  Scene.Personnage.setVisible(false);
  Scene.Personnage.body.setVelocity(0, 0);
  Scene.Personnage.body.enable = false;
}
function DegelerJoueur(Scene) {
  Scene.Personnage.setVisible(true);
  Scene.Personnage.body.enable = true;
}
