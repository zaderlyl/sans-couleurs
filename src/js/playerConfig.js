// playerConfig.js — tous les reglages du personnage, au meme endroit.
//
// Charge en premier : aucune dependance. Lu par loading.js (prechargement),
// player.js (creation + deplacement) et game.js (camera).
// Fichier <script> classique : les `const` sont visibles par nom ailleurs.


// --- Spritesheet ---------------------------------------------------------

const ClePersonnage = 'personnage';                              // cle de cache Phaser (libre)
const CheminPersonnage = 'assets/sprites/characters/player.png'; // 96x16 -> 6 frames de 16x16
const LargeurImagePersonnage = 16;
const HauteurImagePersonnage = 16;

// Frames utiles (un seul jeu pour les deux sens, gauche/droite via setFlipX).
const FramePersoAtterrissage = 1; // bref, a la reception au sol
const FramePersoImmobile = 3;     // debout, et pendant une chute
const FramePersoMarcheDebut = 4;  // cycle de marche : 4 -> 5, en boucle
const FramePersoMarcheFin = 5;


// --- Deplacement -------------------------------------------------------

const VitesseMarchePersonnage = 70; // px/s
const IntervalleParPasMs = 260;     // delai entre deux pas (son + poussiere), independant du framerate


// --- Ressenti de marche ----------------------------------------------
// IntensiteMarche va de 0 (immobile) a 1 (pleine marche) en fondu, pour ne
// pas demarrer/couper net. Elle module le tangage (ici) et l'anticipation de
// la camera (game.js).

const VitesseFonduMarche = 0.15; // progression de IntensiteMarche par frame

// Tangage : leger roulis du sprite en marchant. Un cycle complet dure deux
// pas, pour rester cale sur la cadence.
const AmplitudeTangagePersonnage = 0.06; // radians (~3.4deg) a pleine intensite
const PeriodeTangagePersonnage = IntervalleParPasMs * 2;
const FrequenceTangagePersonnage = (2 * Math.PI) / PeriodeTangagePersonnage;


// --- Poussiere sous les pieds --------------------------------------
// Meme emetteur pour le nuage discret de la marche et l'impact a
// l'atterrissage, seule la quantite change.

const CouleurPoussiere = 0x999999;
const ProfondeurPoussiere = 4;          // derriere le personnage, devant le decor
const DecalagePoussiereY = 8;           // sous les pieds, par rapport au centre du sprite
const NbPoussiereParPas = 2;
const NbPoussiereAtterrissage = 6;

const ConfigEmetteurPoussiere = {
  speed: { min: 20, max: 60 },
  angle: { min: 200, max: 340 },        // eventail vers le haut (0 = droite, 90 = bas)
  lifespan: 300,
  scale: { start: 1, end: 0 },
  alpha: { start: 0.8, end: 0 },
  emitting: false,                       // rien en continu : on declenche a la demande
};
