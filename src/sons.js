// sons.js — les sons du jeu. La musique de fond est un fichier audio
// (assets/audio/ambiance.mp3) ; tous les bruitages sont SYNTHETISES avec Web Audio
// (le navigateur fabrique les sons avec des oscillateurs).
//
// - demarrer_la_musique() : la musique de fond, continue, a lancer au premier
//   clic du joueur (un navigateur interdit les sons avant un geste du joueur) ;
// - peser_sur_la_musique(poids) : la musique devient plus lente et plus grave ;
// - jouer_son_pas(), jouer_son_atterrissage() : les bruitages des joueurs ;
// - jouer_son_mot_pris(), jouer_son_mot_pose(rang), jouer_son_mot_refuse() : le
//   dialogue ; jouer_son_rire_moqueur() : le PNJ rit apres une reponse ;
// - jouer_son_tir(), jouer_son_impact(), jouer_son_cible() : le tir et les cibles ;
// - jouer_son_chute() : la chute dans le vide ;
// - changer_la_musique(), jouer_un_bip(), creer_ton_continu() : le monde 4.
//
// Tant que le joueur n'a pas encore clique, les bruitages restent muets (sans
// erreur) : le navigateur garde le contexte audio "suspendu".

// --- Reglages ------------------------------------------------------------

var volume_musique = 0.4; // le volume de la musique de fond (0 a 1)
var volume_pas = 0.1;
var volume_rire = 0.6; // le rire moqueur des PNJ (avant : 0.18)
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
// Un fichier audio qui tourne en boucle. Elle ne s'arrete jamais, meme quand on
// change de niveau (l'objet audio vit en dehors des scenes).

var musique = null;

export function demarrer_la_musique() {
  var c = obtenir_le_contexte();
  c.resume(); // (le clic du joueur autorise le son)
  if (musique != null) {
    return;
  }
  musique = new Audio("assets/audio/ambiance.mp3");
  musique.loop = true;
  musique.volume = volume_musique;
  musique.play().catch(function () {
    musique = null; // le navigateur a refuse : on reessaiera au prochain clic
  });
}

// Change la musique de fond : l'ancienne s'arrete, la nouvelle (un fichier audio)
// tourne en boucle. Le monde 4 a sa propre ambiance.
export function changer_la_musique(fichier) {
  if (musique != null) {
    musique.pause();
  }
  musique = new Audio(fichier);
  musique.loop = true;
  musique.volume = volume_musique;
  musique.play().catch(function () {
    musique = null;
  });
}

// La musique s'alourdit : poids de 0 (normale) a 1 (plus lente, donc plus grave,
// et un peu plus forte). Appelee quand les joueurs portent des mots (voir phrases.js).
export function peser_sur_la_musique(poids) {
  if (musique == null) {
    return;
  }
  musique.preservesPitch = false; // la vitesse change aussi la hauteur : plus lent = plus grave
  musique.playbackRate = 1 - 0.3 * poids;
  musique.volume = Math.min(1, volume_musique * (1 + 0.5 * poids));
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

// le rire moqueur d'un PNJ apres une reponse : cinq "ha" qui s'eteignent
export function jouer_son_rire_moqueur() {
  var hauteurs = [330, 310, 320, 285, 260];
  for (var i = 0; i < hauteurs.length; i++) {
    setTimeout(un_ha, i * 150, hauteurs[i]);
  }
}

// un "ha" : une voix (onde en dents de scie) filtree comme une voyelle, qui retombe
function un_ha(hauteur) {
  var c = contexte_pret();
  if (c == null) {
    return;
  }
  var oscillateur = c.createOscillator();
  oscillateur.type = "sawtooth";
  oscillateur.frequency.setValueAtTime(hauteur, c.currentTime);
  oscillateur.frequency.exponentialRampToValueAtTime(hauteur * 0.72, c.currentTime + 0.13);
  var filtre = c.createBiquadFilter();
  filtre.type = "bandpass";
  filtre.frequency.value = 850;
  filtre.Q.value = 2.5;
  var gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.linearRampToValueAtTime(volume_rire, c.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.14);
  oscillateur.connect(filtre);
  filtre.connect(gain);
  gain.connect(c.destination);
  oscillateur.start();
  oscillateur.stop(c.currentTime + 0.16);
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

// une chute dans le vide : un son qui tombe
export function jouer_son_chute() {
  jouer_une_note(600, 70, 0.6, 0.1, "sawtooth");
}

// la sonnerie du college : une cloche sourde qui sonne six coups rapides
export function jouer_son_sonnerie() {
  for (var i = 0; i < 6; i++) {
    setTimeout(function () {
      jouer_une_note(1040, 960, 0.16, 0.07, "triangle");
    }, i * 110);
  }
}

// --- Le cardiogramme du monde 4 : les bips des televisions (planifies par niveau4.js) ---

// un bip de moniteur ; `volume` de 0 (rien) a 1
export function jouer_un_bip(volume) {
  if (volume > 0.02) {
    jouer_une_note(1000, 1000, 0.09, 0.22 * volume, "sine");
  }
}

// le cardiogramme s'arrete : un ton plat qui CONTINUE. Renvoie un objet avec
// regler(volume) (de 0 a 1 : plus on est pres, plus c'est fort) et arreter().
export function creer_ton_continu() {
  var c = contexte_pret();
  if (c == null) {
    return { regler: function () {}, arreter: function () {} };
  }
  var oscillateur = c.createOscillator();
  oscillateur.type = "sine";
  oscillateur.frequency.value = 880;
  var gain = c.createGain();
  gain.gain.value = 0;
  oscillateur.connect(gain);
  gain.connect(c.destination);
  oscillateur.start();
  return {
    regler: function (volume) {
      gain.gain.value = 0.14 * volume;
    },
    arreter: function () {
      oscillateur.stop();
    }
  };
}


// --- Le monde 5 : les coups (on ne les montre pas, on les entend) ---------------------

// un coup : un choc sourd, tres grave
export function jouer_son_coup() {
  jouer_une_note(140, 38, 0.3, 0.45, "triangle");
  setTimeout(function () {
    jouer_une_note(90, 30, 0.35, 0.3, "sine");
  }, 70);
}

// apres un coup : les oreilles qui sifflent, un son aigu et fin qui s'etire
export function jouer_son_sifflement() {
  jouer_une_note(3200, 3000, 3.2, 0.05, "sine");
}

// du verre qui se brise
export function jouer_son_verre() {
  for (var i = 0; i < 4; i++) {
    setTimeout(function () {
      jouer_une_note(Phaser.Math.Between(1800, 3200), 500, 0.18, 0.07, "sawtooth");
    }, i * 55);
  }
}

// un tampon sur un papier : un "toc" sec
export function jouer_son_tampon() {
  jouer_une_note(220, 70, 0.14, 0.35, "square");
}
