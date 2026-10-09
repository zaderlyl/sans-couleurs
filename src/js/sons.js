// sons.js — sons du jeu, entierement synthetises via Web Audio (aucun
// fichier audio). Les volumes/frequences principaux sont dans config.js.
//
// - DemarrerSonAmbiance() : le drone de fond, une seule fois, au premier
//   geste du joueur (voir create()).
// - JouerSonPas() / JouerSonAtterrissage() : appeles depuis player.js.
// - ObtenirContexteAudio() : l'AudioContext partage (feature tele comprise).

import { VolumeSonAmbiance, FrequenceSonAmbiance, VolumeSonPas, VolumeSonAtterrissage } from './config.js';


// Un seul AudioContext pour tout le jeu, cree au premier besoin.
let ContexteAudioPartage = null;
export function ObtenirContexteAudio() {
  if (!ContexteAudioPartage) {
    ContexteAudioPartage = new (window.AudioContext || window.webkitAudioContext)();
  }
  return ContexteAudioPartage;
}


// --- Ambiance : drone grave continu, avec une pulsation lente ---
let SonAmbianceDemarre = false; // garde-fou : une seule instance du drone

export function DemarrerSonAmbiance() {
  if (SonAmbianceDemarre) return;
  SonAmbianceDemarre = true;

  const Contexte = ObtenirContexteAudio();

  const Oscillateur = Contexte.createOscillator();
  Oscillateur.type = 'sine'; // son pur, sans harmoniques agressives
  Oscillateur.frequency.value = FrequenceSonAmbiance;

  const Volume = Contexte.createGain();
  Volume.gain.value = VolumeSonAmbiance;

  Oscillateur.connect(Volume);
  Volume.connect(Contexte.destination);
  Oscillateur.start(); // boucle indefiniment par nature

  // Pulsation lente : un 2e oscillateur tres basse frequence module le volume
  // du premier au lieu de produire un son audible.
  const OscillateurLent = Contexte.createOscillator();
  OscillateurLent.type = 'sine';
  OscillateurLent.frequency.value = 0.12; // ~1 pulsation toutes les 8 s

  const VolumeOscillateurLent = Contexte.createGain();
  VolumeOscillateurLent.gain.value = 0.04; // amplitude de la pulsation

  OscillateurLent.connect(VolumeOscillateurLent);
  VolumeOscillateurLent.connect(Volume.gain);
  OscillateurLent.start();
}


// --- Pas : bref grain de bruit filtre, tres court et discret ---
export function JouerSonPas() {
  const Contexte = ObtenirContexteAudio();
  const Duree = 0.05;

  const Tampon = Contexte.createBuffer(1, Contexte.sampleRate * Duree, Contexte.sampleRate);
  const Donnees = Tampon.getChannelData(0);
  for (let i = 0; i < Donnees.length; i++) Donnees[i] = Math.random() * 2 - 1;

  const Bruit = Contexte.createBufferSource();
  Bruit.buffer = Tampon;

  const Filtre = Contexte.createBiquadFilter();
  Filtre.type = 'bandpass';
  Filtre.frequency.value = 1200;
  Filtre.Q.value = 1;

  const Volume = Contexte.createGain();
  Volume.gain.setValueAtTime(VolumeSonPas, Contexte.currentTime);
  Volume.gain.exponentialRampToValueAtTime(0.001, Contexte.currentTime + Duree);

  Bruit.connect(Filtre);
  Filtre.connect(Volume);
  Volume.connect(Contexte.destination);
  Bruit.start();
}


// --- Atterrissage : petit "thud" grave et court ---
export function JouerSonAtterrissage() {
  const Contexte = ObtenirContexteAudio();
  const Oscillateur = Contexte.createOscillator();
  Oscillateur.type = 'sine';
  Oscillateur.frequency.setValueAtTime(140, Contexte.currentTime);
  Oscillateur.frequency.exponentialRampToValueAtTime(60, Contexte.currentTime + 0.09);

  const Volume = Contexte.createGain();
  Volume.gain.setValueAtTime(VolumeSonAtterrissage, Contexte.currentTime);
  Volume.gain.exponentialRampToValueAtTime(0.001, Contexte.currentTime + 0.1);

  Oscillateur.connect(Volume);
  Volume.connect(Contexte.destination);
  Oscillateur.start();
  Oscillateur.stop(Contexte.currentTime + 0.11);
}


// --- Dialogue a trous : petits bips "ludiques" ---
// Une note courte qui glisse de FrequenceDebut a FrequenceFin (Hz).
function JouerNote(FrequenceDebut, FrequenceFin, Duree, Volume, Type = 'square') {
  const Contexte = ObtenirContexteAudio();
  const Oscillateur = Contexte.createOscillator();
  Oscillateur.type = Type;
  Oscillateur.frequency.setValueAtTime(FrequenceDebut, Contexte.currentTime);
  Oscillateur.frequency.exponentialRampToValueAtTime(FrequenceFin, Contexte.currentTime + Duree);

  const Gain = Contexte.createGain();
  Gain.gain.setValueAtTime(Volume, Contexte.currentTime);
  Gain.gain.exponentialRampToValueAtTime(0.001, Contexte.currentTime + Duree);

  Oscillateur.connect(Gain);
  Gain.connect(Contexte.destination);
  Oscillateur.start();
  Oscillateur.stop(Contexte.currentTime + Duree + 0.01);
}

// Mot attrape : petit "bloop" montant.
export function JouerSonMotPris() {
  JouerNote(380, 620, 0.07, 0.06);
}

// Mot pose dans un trou : "pop" dont la hauteur monte avec le nombre de trous
// deja remplis (Rang 0, 1, 2...) -> la phrase se "joue" comme une melodie.
export function JouerSonMotPose(Rang) {
  const Base = 440 * Math.pow(2, Math.min(Rang, 7) / 6);
  JouerNote(Base, Base * 1.5, 0.11, 0.08, 'triangle');
}

// Depot impossible : bzzz grave.
export function JouerSonMotRefuse() {
  JouerNote(150, 90, 0.12, 0.07, 'sawtooth');
}


// --- Tir : un "pew" montant-descendant au depart, un "plop" a l'impact ---
export function JouerSonTir() {
  JouerNote(820, 320, 0.09, 0.06, 'square');
}

export function JouerSonImpactTir() {
  JouerNote(260, 90, 0.12, 0.08, 'triangle');
}
