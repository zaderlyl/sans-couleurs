// config.js — reglages generaux du jeu (hors personnage : voir playerConfig.js).
//
// Charge en tout premier : aucune dependance. Regroupe les valeurs qu'on
// ajuste "au feeling" — camera, sons, couleurs, styles de texte — pour ne
// pas avoir a les chercher dans le code.


// --- Modes ---------------------------------------------------------
// A false, l'ancien mode "prototype" tourne (ligne bicolore + rectangle blanc).
const UtiliseCarteTiled = true;
const UtiliseSpritePersonnage = true;


// --- Camera -------------------------------------------------------
// Suivi entierement manuel chaque frame (voir MettreAJourCamera dans
// src/js/camera.js).
const ZoomCamera = 5;                    // pixel art de 16px, sinon minuscule a l'ecran
const CentreVerticalCadrageCamera = 140; // point du monde vise au milieu de l'ecran
                                         // (augmenter = faire monter l'horizon)
const VitesseSuiviCameraX = 0.1;         // lerp horizontal (0 = fige, 1 = colle au joueur)
const DecalageAnticipationCameraMax = 14; // px monde : la camera regarde un peu plus
                                          // loin devant dans le sens de la marche


// --- Sons (synthetises via Web Audio, voir src/js/sons.js) --------
const VolumeSonAmbiance = 0.07;      // drone de fond continu
const FrequenceSonAmbiance = 52;     // Hz, grave
const VolumeSonPas = 0.1;
const VolumeSonAtterrissage = 0.2;


// --- Style des textes poses dans le monde ----------------------
// Reutilise par la feature "textes de zone" ET par le dialogue PNJ : ce sont
// des objets du monde au-dessus des personnages, pas une interface a l'ecran.
// Pixel art oblige : petite police (x ZoomCamera a l'affichage) + contour
// noir + resolution interne plus haute (sinon flou/crenele une fois agrandi).
// NomPoliceTexteDeZone : le nom choisi dans le @font-face d'index.html.
const NomPoliceTexteDeZone = 'DeltaruneExtended';

const StyleTexteDeZone = {
  fontFamily: `'${NomPoliceTexteDeZone}', monospace`, // repli tant que la police charge
  fontSize: '6px',
  color: '#ffffff',
  stroke: '#000000',
  strokeThickness: 2,
  align: 'center',
  wordWrap: { width: 120 },
  resolution: ZoomCamera,
};

// Les mots a glisser du dialogue PNJ : un fond derriere chaque mot, comme une
// petite etiquette (repere de l'espace pris, et aide a les distinguer).
const StyleMotDialogue = {
  fontFamily: `'${NomPoliceTexteDeZone}', monospace`,
  fontSize: '6px',
  color: '#ffffff',
  stroke: '#000000',
  strokeThickness: 1,
  backgroundColor: 'rgba(0, 0, 0, 0.55)',
  padding: { x: 2, y: 1 },
  resolution: ZoomCamera,
};


// --- Mode prototype (seulement si UtiliseCarteTiled = false) --------
const LargeurMondeParDefaut = 4000;
const HauteurMondeParDefaut = 540;
const HauteurSol = 460;

// Duotone du monde : le personnage (blanc) tranche sur ces deux teintes.
const CouleurSol = 0x2c3e50;        // bleu-ardoise sourd
const CouleurAccent = 0x5a1a2e;     // lie-de-vin sourd
const CouleurPersonnage = 0xffffff;
