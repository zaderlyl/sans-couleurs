// sons.js — les sons du jeu. Ils sont tous SYNTHETISES avec Web Audio (le
// navigateur fabrique les sons avec des oscillateurs) : aucun fichier audio.
//
// - demarrer_la_musique() : la musique de fond, continue, a lancer au premier
//   clic du joueur (un navigateur interdit les sons avant un geste du joueur) ;
// - jouer_son_pas(), jouer_son_atterrissage() : les bruitages des joueurs ;
// - jouer_son_mot_pris(), jouer_son_mot_pose(rang), jouer_son_mot_refuse() : le
//   dialogue ;
// - jouer_son_tir(), jouer_son_impact(), jouer_son_cible() : le tir et les cibles ;
// - jouer_son_portail(), jouer_son_chute() : les portails et la chute dans le vide.
//
// Tant que le joueur n'a pas encore clique, les bruitages restent muets (sans
// erreur) : le navigateur garde le contexte audio "suspendu".

// --- Reglages ------------------------------------------------------------

var volume_musique = 0.07; // le bourdon grave de la musique de fond
var frequence_bourdon = 52; // Hz
var volume_notes = 0.03; // les petites notes douces par-dessus
var gamme = [196, 220, 261.6, 293.7, 329.6]; // Hz : sol, la, do, re, mi (une gamme calme)
var delai_entre_notes = 2400; // ms
var volume_pas = 0.1;
var volume_atterrissage = 0.2;


// --- Le contexte audio (un seul pour tout le jeu) -----------------------------

var contexte = null;

// le contexte audio, cree au premier besoin
function obtenir_le_contexte() {
  if (contexte == null) {
    contexte = new (window.AudioContext || window.webkitAudioContext)();
  }
  return contexte;
}

// le contexte s'il est pret a jouer, ou null (pas de son avant le premier clic)
function contexte_pret() {
  var c = obtenir_le_contexte();
  if (c.state == "running") {
    return c;
  }
  return null;
}

// une note courte qui glisse de `frequence_debut` a `frequence_fin` (en Hz),
// `duree` secondes, au volume `volume`, avec une forme d'onde `type`
function jouer_une_note(frequence_debut, frequence_fin, duree, volume, type) {
  var c = contexte_pret();
  if (c == null) {
    return;
  }
  var oscillateur = c.createOscillator();
  oscillateur.type = type;
  oscillateur.frequency.setValueAtTime(frequence_debut, c.currentTime);
  oscillateur.frequency.exponentialRampToValueAtTime(frequence_fin, c.currentTime + duree);

  // le volume descend vite vers 0 : le son s'eteint tout seul
  var gain = c.createGain();
  gain.gain.setValueAtTime(volume, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duree);

  oscillateur.connect(gain);
  gain.connect(c.destination);
  oscillateur.start();
  oscillateur.stop(c.currentTime + duree + 0.01);
}


// --- 1. La musique de fond ---------------------------------------------------------
//
// Un bourdon grave continu, avec une pulsation lente, et de temps en temps une
// petite note douce d'une gamme calme. Elle ne s'arrete jamais, meme quand on
// change de niveau.

var musique_lancee = false;

export function demarrer_la_musique() {
  var c = obtenir_le_contexte();
  c.resume(); // (le clic du joueur autorise le son)
  if (musique_lancee == true) {
    return;
  }
  musique_lancee = true;

  // le bourdon : une onde pure, grave
  var bourdon = c.createOscillator();
  bourdon.type = "sine";
  bourdon.frequency.value = frequence_bourdon;
  var volume = c.createGain();
  volume.gain.value = volume_musique;
  bourdon.connect(volume);
  volume.connect(c.destination);
  bourdon.start();

  // la pulsation : un 2e oscillateur tres lent fait monter et descendre le
  // volume du bourdon (environ une pulsation toutes les 8 secondes)
  var pulsation = c.createOscillator();
  pulsation.type = "sine";
  pulsation.frequency.value = 0.12;
  var amplitude = c.createGain();
  amplitude.gain.value = 0.04;
  pulsation.connect(amplitude);
  amplitude.connect(volume.gain);
  pulsation.start();

  // une petite note douce de la gamme, toutes les 2,4 secondes
  setInterval(function () {
    var note = gamme[Math.floor(Math.random() * gamme.length)];
    jouer_une_note(note, note * 0.99, 1.8, volume_notes, "sine");
  }, delai_entre_notes);
}


// --- 2. Les joueurs ---------------------------------------------------------------------

// un pas : un tout petit grain de bruit filtre
export function jouer_son_pas() {
  var c = contexte_pret();
  if (c == null) {
    return;
  }
  var duree = 0.05;
  var tampon = c.createBuffer(1, c.sampleRate * duree, c.sampleRate);
  var donnees = tampon.getChannelData(0);
  for (var i = 0; i < donnees.length; i++) {
    donnees[i] = Math.random() * 2 - 1; // du bruit
  }
  var bruit = c.createBufferSource();
  bruit.buffer = tampon;

  var filtre = c.createBiquadFilter();
  filtre.type = "bandpass";
  filtre.frequency.value = 1200;

  var gain = c.createGain();
  gain.gain.setValueAtTime(volume_pas, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duree);

  bruit.connect(filtre);
  filtre.connect(gain);
  gain.connect(c.destination);
  bruit.start();
}

// l'atterrissage : un petit "thud" grave
export function jouer_son_atterrissage() {
  jouer_une_note(140, 60, 0.1, volume_atterrissage, "sine");
}


// --- 3. Le dialogue ---------------------------------------------------------------------------

// un mot attrape : un petit "bloop" montant
export function jouer_son_mot_pris() {
  jouer_une_note(380, 620, 0.07, 0.06, "square");
}

// un mot pose dans un trou : un "pop" de plus en plus haut (rang 0, 1, 2...) :
// remplir une phrase joue une petite melodie
export function jouer_son_mot_pose(rang) {
  var base = 440 * Math.pow(2, Math.min(rang, 7) / 6);
  jouer_une_note(base, base * 1.5, 0.11, 0.08, "triangle");
}

// un depot impossible : un "bzzz" grave
export function jouer_son_mot_refuse() {
  jouer_une_note(150, 90, 0.12, 0.07, "sawtooth");
}


// --- 4. Le tir et les cibles --------------------------------------------------------------------

// le tir : un "pew"
export function jouer_son_tir() {
  jouer_une_note(820, 320, 0.09, 0.06, "square");
}

// le projectile eclate : un "plop" grave
export function jouer_son_impact() {
  jouer_une_note(260, 90, 0.12, 0.08, "triangle");
}

// une cible touchee : deux notes qui montent (une couleur est revenue)
export function jouer_son_cible() {
  jouer_une_note(520, 780, 0.12, 0.08, "triangle");
  setTimeout(function () {
    jouer_une_note(780, 1170, 0.18, 0.08, "triangle");
  }, 90);
}


// --- 5. Le reste ----------------------------------------------------------------------------------

// un portail : un "wouch" qui monte
export function jouer_son_portail() {
  jouer_une_note(200, 900, 0.25, 0.07, "sine");
}

// une chute dans le vide : un son qui tombe
export function jouer_son_chute() {
  jouer_une_note(600, 70, 0.6, 0.1, "sawtooth");
}
