// playerConfig.js — reglages du personnage (spritesheet + ressenti de
// deplacement). Aucune dependance : ce fichier est charge en premier, ses
// constantes sont ensuite lues par loading.js (prechargement), player.js
// (creation + deplacement) et game.js (camera).
//
// Portee globale : comme tous les fichiers de src/js/, c'est un <script>
// classique (pas de module). Les `const` de premier niveau sont donc
// visibles par nom depuis les autres fichiers.

// --- Spritesheet du personnage ---
const ClePersonnage = 'personnage'; // nom interne, libre
const CheminPersonnage = 'assets/sprites/characters/player.png'; // feuille de sprites
const LargeurImagePersonnage = 16; // largeur en pixels d'une frame (player.png = 96x16 -> 6 frames de 16)
const HauteurImagePersonnage = 16; // hauteur en pixels d'une frame
// Repartition des 6 frames (indices 0 a 5) — voir animations dans player.js :
//   1 (index 0) : inutilisee pour l'instant
//   2 (index 1) : reprise a l'atterrissage (pas de saut : seule la chute
//                 en marchant hors d'une plateforme declenche l'etat "en l'air")
//   3 (index 2) : inutilisee pour l'instant (ancien frame de saut)
//   4 (index 3) : immobile (standby), et pendant la chute
//   5 et 6 (index 4-5) : cycle de marche
// Un seul jeu de frames pour les deux sens : gauche/droite s'obtient par
// setFlipX, applique uniformement a tous les etats.

// Vitesse horizontale du personnage (px/s).
const VitesseMarchePersonnage = 70;
// Cadence des pas (bruit + nuage de poussiere), en ms — independante du
// framerate (voir MettreAJourDeplacement). Sert aussi de base a la periode
// du tangage ci-dessous.
const IntervalleParPasMs = 260;

// --- Pseudo-realisme du deplacement ---
// this.IntensiteMarche (0 = immobile, 1 = pleine marche) monte/descend en
// fondu plutot que de s'enclencher/s'arreter d'un coup (voir
// MettreAJourDeplacement dans player.js), et sert de base a plusieurs petits
// effets synchronises sur la marche : tangage du personnage, anticipation de
// la camera dans le sens du regard (voir MettreAJourCamera dans game.js).
const VitesseFonduMarche = 0.15; // vitesse de montee/descente de l'intensite, par frame

// Tangage du personnage : leger balancement de rotation, comme une demarche
// naturelle. Periode calquee sur la cadence des pas : un cycle complet du
// tangage dure deux pas.
const AmplitudeTangagePersonnage = 0.06; // radians (~3.4 degres) a pleine intensite
const PeriodeTangagePersonnage = IntervalleParPasMs * 2; // ms — deux pas = un cycle complet
const FrequenceTangagePersonnage = (2 * Math.PI) / PeriodeTangagePersonnage;
