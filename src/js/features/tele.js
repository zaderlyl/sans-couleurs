// features/tele.js — ecran de tele avec cardiogramme : le joueur s'en
// approche, appuie 4 fois sur E pour accelerer le rythme, et au 5e la ligne
// devient plate (ecran mort + bip continu).
//
// Feature branchee par les cartes qui la listent dans leur `features`. Pour
// l'instant seule map-TEST-map1 l'utilise. Position posee dans Tiled sur les
// cases (2,7)-(3,8).


// --- Ecran (tele.png) ---
// Grille 6x3 de 32x32 ; 13 frames dessinees = un battement du cardiogramme.
const CleTele = 'ecranTele';
const CheminTele = 'assets/sprites/props/tele.png';
const TailleImageTele = 32;
const NombreImagesTele = 13;
const PositionTeleX = 2 * 16;
const PositionTeleY = 7 * 16;

// Ecran "mort" au 5e appui : 12 frames, boucle lente.
const CleTeleMort = 'ecranTeleMort';
const CheminTeleMort = 'assets/sprites/props/tele_death.png';
const NombreImagesTeleMort = 12;

// Zone d'interaction : un peu plus large que la tele.
const ZoneTele = {
  XMin: PositionTeleX - 16,
  XMax: PositionTeleX + TailleImageTele + 16,
  YMin: PositionTeleY,
  YMax: PositionTeleY + TailleImageTele,
};

// frameRate du cardiogramme apres le 1er..4e appui. ~46 -> 190 bpm.
const VitessesCardiogramme = [10, 15, 22, 30, 41];

// Attenuation du son selon la distance joueur <-> tele.
const DistanceSonTeleMin = 40;
const DistanceSonTeleMax = 250;


const Tele = {
  nom: 'tele',

  // preload() : les feuilles de la tele, chargees seulement pour les cartes
  // qui listent cette feature.
  precharger(Scene) {
    ChargerFeuille(Scene, CleTele, CheminTele, TailleImageTele);
    ChargerFeuille(Scene, CleTeleMort, CheminTeleMort, TailleImageTele);
  },

  // create() : appele avant l'herbe et le personnage, donc le SpriteTele
  // garde le meme ordre d'affichage (au-dessus du decor, sous l'herbe et le
  // personnage — pas de depth forcee, c'est l'ordre de creation).
  installer(Scene) {
    Scene.anims.create({
      key: 'cardiogramme',
      frames: Scene.anims.generateFrameNumbers(CleTele, { start: 0, end: NombreImagesTele - 1 }),
      frameRate: 10, // 13 frames / 10 = ~46 bpm avant tout appui
      repeat: -1,
    });
    Scene.anims.create({
      key: 'ecranMort',
      frames: Scene.anims.generateFrameNumbers(CleTeleMort, { start: 0, end: NombreImagesTeleMort - 1 }),
      frameRate: 8,
      repeat: -1,
    });

    Scene.SpriteTele = Scene.add.sprite(PositionTeleX, PositionTeleY, CleTele, 0);
    Scene.SpriteTele.setOrigin(0, 0); // ancrage tuile, cale sur la case (2,7)
    Scene.SpriteTele.play('cardiogramme');
    // 'animationrepeat' = la boucle repart : trait complet a l'ecran, le point
    // naturel du battement. Le bip reste synchro quel que soit le frameRate.
    Scene.SpriteTele.on('animationrepeat', () => {
      JouerSonCardiogramme(VolumeSonSelonDistanceTele(Scene.Personnage.x, Scene.Personnage.y));
    });

    // 2e instance de l'icone d'interaction (memes anims que la gare),
    // au-dessus de la tele. Depth 20 : l'ordre de creation n'importe pas.
    Scene.IconeInteractionTele = Scene.add.sprite(
      PositionTeleX + TailleImageTele / 2,
      PositionTeleY - TailleIconeInteraction,
      CleIconeInteraction,
      0,
    );
    Scene.IconeInteractionTele.setDepth(20);
    Scene.IconeInteractionTele.setVisible(false);

    Scene.CompteurAppuisTele = 0;
    Scene.TeleHS = false;
    Scene.IconeTeleEnCours = false; // true pendant que 'iconePressee' joue
  },

  // update() : chaque appui sur E a proximite accelere le cardiogramme (+
  // tremblement) ; au 5e, ligne plate. L'icone E ne disparait qu'au 5e appui.
  miseAJour(Scene) {
    // Ligne plate continue : volume reajuste image par image selon la distance.
    if (Scene.GainLignePlate) {
      Scene.GainLignePlate.gain.value = 0.09 * VolumeSonSelonDistanceTele(Scene.Personnage.x, Scene.Personnage.y);
    }

    if (!Scene.SpriteTele || Scene.TeleHS) return;

    const Perso = Scene.Personnage;
    const DansZone =
      Perso.x > ZoneTele.XMin && Perso.x < ZoneTele.XMax &&
      Perso.y > ZoneTele.YMin && Perso.y < ZoneTele.YMax;

    if (!DansZone) {
      Scene.IconeInteractionTele.setVisible(false);
      return;
    }

    Scene.IconeInteractionTele.setVisible(true);
    if (!Scene.IconeTeleEnCours) {
      Scene.IconeInteractionTele.play('iconeAttente', true); // true : ne relance pas si en cours
    }

    if (!Phaser.Input.Keyboard.JustDown(Scene.ToucheInteraction)) return;

    Scene.CompteurAppuisTele++;
    Scene.IconeTeleEnCours = true;
    Scene.IconeInteractionTele.play('iconePressee');
    Scene.IconeInteractionTele.once('animationcomplete', () => {
      Scene.IconeTeleEnCours = false;
      if (Scene.TeleHS) Scene.IconeInteractionTele.setVisible(false);
    });

    if (Scene.CompteurAppuisTele < VitessesCardiogramme.length) {
      Scene.SpriteTele.play({ key: 'cardiogramme', frameRate: VitessesCardiogramme[Scene.CompteurAppuisTele], repeat: -1 });
      Scene.Secouer(Scene.SpriteTele, 200, 1, () => {});
    } else {
      DeclencherLignePlateTele(Scene);
    }
  },
};


// --- Sons (Web Audio) ---

// Facteur 0..1 selon la distance du joueur a la tele.
function VolumeSonSelonDistanceTele(PositionJoueurX, PositionJoueurY) {
  const CentreTeleX = PositionTeleX + TailleImageTele / 2;
  const CentreTeleY = PositionTeleY + TailleImageTele / 2;
  const Distance = Phaser.Math.Distance.Between(PositionJoueurX, PositionJoueurY, CentreTeleX, CentreTeleY);
  const Portee = DistanceSonTeleMax - DistanceSonTeleMin;
  return Phaser.Math.Clamp(1 - (Distance - DistanceSonTeleMin) / Portee, 0, 1);
}

// Bip bref et aigu, cale sur la boucle de l'anim. `Volume` (voir ci-dessus)
// attenue selon la distance au moment du bip.
function JouerSonCardiogramme(Volume) {
  if (Volume <= 0) return; // trop loin : inutile

  const Contexte = ObtenirContexteAudio();
  const Oscillateur = Contexte.createOscillator();
  Oscillateur.type = 'square'; // net, electronique
  Oscillateur.frequency.value = 880;

  const VolumeNode = Contexte.createGain();
  VolumeNode.gain.setValueAtTime(0.1 * Volume, Contexte.currentTime);
  VolumeNode.gain.exponentialRampToValueAtTime(0.001, Contexte.currentTime + 0.08);

  Oscillateur.connect(VolumeNode);
  VolumeNode.connect(Contexte.destination);
  Oscillateur.start();
  Oscillateur.stop(Contexte.currentTime + 0.09);
}

// Ligne plate (tele HS) : bip continu, grave et etouffe. Pas de stop() : il
// dure jusqu'a la fin de la partie. Renvoie le noeud de gain pour que le
// volume soit reajuste chaque frame selon la distance (voir miseAJour).
function JouerSonLignePlate() {
  const Contexte = ObtenirContexteAudio();
  const Oscillateur = Contexte.createOscillator();
  Oscillateur.type = 'sawtooth';
  Oscillateur.frequency.value = 300;

  const Filtre = Contexte.createBiquadFilter();
  Filtre.type = 'lowpass';
  Filtre.frequency.value = 500; // coupe les aigus : son sourd

  const Volume = Contexte.createGain();
  Volume.gain.value = 0; // ajuste des la 1ere frame

  Oscillateur.connect(Filtre);
  Filtre.connect(Volume);
  Volume.connect(Contexte.destination);
  Oscillateur.start();

  return Volume;
}

// 5e appui : le cardiogramme laisse place a l'ecran mort et au bip continu.
function DeclencherLignePlateTele(Scene) {
  Scene.TeleHS = true;
  Scene.SpriteTele.play('ecranMort');
  Scene.GainLignePlate = JouerSonLignePlate();
}
