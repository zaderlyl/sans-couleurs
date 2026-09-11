// features/glitch.js — effet de "greselement" (bruit de vieille tele
// cathodique), mais en pixels colores RVB au lieu du gris habituel.
//
// Zones definies dans Tiled : rectangles sur le calque objets, avec une
// propriete "name" valant "glitch" ou "glitch2". Le joueur dedans -> l'effet
// monte progressivement (Scene.IntensiteGlitch, 0 a 1) tant qu'il y reste, et
// redescend en douceur des qu'il en ressort — les 2 noms de zone comptent
// pareil, donc passer de l'une a l'autre ne coupe rien, la montee continue.
// A pleine intensite, le glitch "avale" le joueur : retour au spawn de la carte.

import { NomCoucheObjets } from '../maps/cartes.js';

const CleTextureBruit = 'bruitGlitch';
// Palette de bandes de "dechirure" (voir RafraichirBruit) : des couleurs
// franches et satures, pas des teintes ternes — c'est ce qui lit comme un
// vrai signal qui deconne plutot que de la simple neige.
const CouleursBandes = ['#ff0040', '#00ffea', '#39ff14', '#ff00ff', '#ffffff', '#ffe600'];

// Intensite (0..1) : le temps pour monter au max en restant dans une zone,
// et pour redescendre a 0 en sortant (plus rapide -> transition legere mais
// pas trainante). Plus l'intensite est haute, plus l'effet est fort ET rapide.
const DureeMonteeMs = 6000;
const DureeDescenteMs = 900;
const OpaciteMin = 0.12;   // a peine visible en entrant : la montee doit se sentir
const OpaciteMax = 0.85;   // presque aveuglant juste avant le retour au spawn
const IntervalleRafraichissementMin = 140; // ms entre 2 images de bruit, intensite 0
const IntervalleRafraichissementMax = 45;  // ms entre 2 images de bruit, intensite 1 (saccade)
const DensiteGrainMin = 0.06; // part de pixels "allumes" dans le grain fin, intensite 0
const DensiteGrainMax = 0.35; // ... intensite 1
const NombreBandesMin = 1; // bandes de dechirure horizontales, intensite 0
const NombreBandesMax = 7; // ... intensite 1
const DureeFonduRetourSpawn = 350;


export const Glitch = {
  nom: 'glitch',

  installer(Scene, Ctx) {
    Scene.ZonesGlitch = LireZonesGlitch(Ctx.Carte);
    Scene.IntensiteGlitch = 0; // 0 (rien) a 1 (renvoi au spawn)
    Scene.MinuteurBruitGlitch = 0;
    Scene.GlitchRenvoiEnCours = false;
    Scene.TailleTextureGlitch = null; // { Largeur, Hauteur } de la derniere texture creee
    if (Scene.ZonesGlitch.length === 0) return; // carte sans glitch : rien a poser

    Scene.SpriteGlitch = Scene.add.image(0, 0, '__DEFAULT'); // texture reelle posee au 1er RafraichirBruit
    Scene.SpriteGlitch.setOrigin(0, 0);
    Scene.SpriteGlitch.setDepth(1000); // au-dessus de tout (perso, herbe, icones...)
    Scene.SpriteGlitch.setVisible(false);
    Scene.SpriteGlitch.setAlpha(0); // evite un flash a pleine opacite avant le 1er RafraichirBruit
  },

  miseAJour(Scene, Temps, TempsEcoule) {
    if (Scene.ZonesGlitch.length === 0 || Scene.GlitchRenvoiEnCours) return;

    const DansUneZone = Scene.ZonesGlitch.some((Zone) =>
      Scene.Personnage.x > Zone.XMin && Scene.Personnage.x < Zone.XMax &&
      Scene.Personnage.y > Zone.YMin && Scene.Personnage.y < Zone.YMax,
    );

    // Une seule jauge continue, quelle que soit la zone precise : passer
    // directement d'un "glitch" a un "glitch2" voisin ne fait pas retomber
    // l'intensite a 0, elle continue simplement de monter.
    const Vitesse = DansUneZone ? 1 / DureeMonteeMs : -1 / DureeDescenteMs;
    Scene.IntensiteGlitch = Phaser.Math.Clamp(Scene.IntensiteGlitch + TempsEcoule * Vitesse, 0, 1);

    if (Scene.IntensiteGlitch <= 0) {
      Scene.SpriteGlitch.setVisible(false);
      return;
    }

    if (Scene.IntensiteGlitch >= 1) {
      RenvoyerAuSpawn(Scene);
      return;
    }

    Scene.SpriteGlitch.setVisible(true);
    // Calque plein ecran cale sur la vue camera actuelle (memes formules que
    // MettreAJourCamera) : un sprite normal (pas scrollFactor 0) suit le
    // zoom naturellement, pas besoin d'une 2e camera pour un HUD.
    PositionnerSurCamera(Scene, Scene.SpriteGlitch);

    // Plus l'intensite monte, plus le bruit change vite (saccade).
    Scene.MinuteurBruitGlitch += TempsEcoule;
    const Intervalle = Phaser.Math.Linear(IntervalleRafraichissementMin, IntervalleRafraichissementMax, Scene.IntensiteGlitch);
    if (Scene.MinuteurBruitGlitch < Intervalle) return;
    Scene.MinuteurBruitGlitch = 0;
    RafraichirBruit(Scene);
  },
};


// --- Interne ------------------------------------------------------

// Rectangles Tiled portant une propriete "name" = "glitch" ou "glitch2".
function LireZonesGlitch(Carte) {
  const CoucheObjets = Carte.getObjectLayer(NomCoucheObjets);
  const Objets = CoucheObjets ? CoucheObjets.objects : [];

  return Objets
    .map((Objet) => {
      const Propriete = (Objet.properties || []).find((P) => P.name === 'name');
      const Valeur = Propriete && Propriete.value;
      if (Valeur !== 'glitch' && Valeur !== 'glitch2') return null;
      return { XMin: Objet.x, XMax: Objet.x + Objet.width, YMin: Objet.y, YMax: Objet.y + Objet.height };
    })
    .filter(Boolean);
}

// Deplace/redimensionne `GameObject` pour qu'il couvre exactement la zone du
// monde actuellement visible par la camera (meme calcul que camera.js).
function PositionnerSurCamera(Scene, GameObject) {
  const Cam = Scene.cameras.main;
  const LargeurVueMonde = Cam.width / Cam.zoom;
  const HauteurVueMonde = Cam.height / Cam.zoom;
  const VueX = Cam.scrollX + (Cam.width - LargeurVueMonde) / 2;
  const VueY = Cam.scrollY + (Cam.height - HauteurVueMonde) / 2;

  GameObject.setPosition(VueX, VueY);
  GameObject.setDisplaySize(LargeurVueMonde, HauteurVueMonde);
}

// Un texel de bruit = un pixel du MONDE (pas de l'ecran) : a ce zoom, ça
// donne le meme grain que les sprites du jeu (gros pixels nets, mais pas plus
// gros qu'eux) — c'est ce qui evite l'effet "mur de gros cubes" d'une texture
// trop basse def etiree sur tout l'ecran.
function TailleTextureVoulue(Scene) {
  const Cam = Scene.cameras.main;
  return {
    Largeur: Math.max(1, Math.ceil(Cam.width / Cam.zoom)),
    Hauteur: Math.max(1, Math.ceil(Cam.height / Cam.zoom)),
  };
}

// (Re)cree la texture canvas seulement si sa taille a change (redimensionner
// la fenetre change LargeurVueMonde/HauteurVueMonde) — evite de la recreer a
// chaque rafraichissement de bruit (25 a 40 fois par seconde).
function TextureGlitchAJour(Scene) {
  const Taille = TailleTextureVoulue(Scene);
  const Actuelle = Scene.TailleTextureGlitch;
  if (Actuelle && Actuelle.Largeur === Taille.Largeur && Actuelle.Hauteur === Taille.Hauteur) {
    return Scene.textures.get(CleTextureBruit);
  }

  if (Scene.textures.exists(CleTextureBruit)) Scene.textures.remove(CleTextureBruit);
  const Texture = Scene.textures.createCanvas(CleTextureBruit, Taille.Largeur, Taille.Hauteur);
  Scene.TailleTextureGlitch = Taille;
  Scene.SpriteGlitch.setTexture(CleTextureBruit);
  return Texture;
}

// Redessine la texture : un grain fin de pixels RVB epars (pas un pixel sur
// un, sinon ça redevient un bloc plein) + quelques bandes horizontales pleine
// couleur decalees, comme une image qui dechire — les deux s'intensifient
// avec Scene.IntensiteGlitch. L'opacite globale du voile suit aussi la meme
// intensite, avec un peu de tremblement pour un effet instable.
function RafraichirBruit(Scene) {
  const Texture = TextureGlitchAJour(Scene);
  const { Largeur, Hauteur } = Scene.TailleTextureGlitch;
  const Contexte = Texture.getContext();
  const Intensite = Scene.IntensiteGlitch;

  Contexte.clearRect(0, 0, Largeur, Hauteur);

  // Grain fin : pixel par pixel, mais seulement une fraction d'entre eux —
  // le reste reste transparent (voir l'ecran a travers), comme une vraie
  // neige de recepteur plutot qu'un aplat.
  const Densite = Phaser.Math.Linear(DensiteGrainMin, DensiteGrainMax, Intensite);
  const Image = Contexte.createImageData(Largeur, Hauteur);
  for (let i = 0; i < Image.data.length; i += 4) {
    if (Math.random() >= Densite) continue; // pixel laisse transparent
    Image.data[i] = Phaser.Math.Between(0, 255);     // rouge
    Image.data[i + 1] = Phaser.Math.Between(0, 255); // vert
    Image.data[i + 2] = Phaser.Math.Between(0, 255); // bleu
    Image.data[i + 3] = 255;
  }
  Contexte.putImageData(Image, 0, 0);

  // Bandes de dechirure : quelques lignes fines, sur un segment horizontal
  // aleatoire (pas forcement toute la largeur), en couleur vive et pleine.
  const NombreBandes = Math.round(Phaser.Math.Linear(NombreBandesMin, NombreBandesMax, Intensite));
  for (let i = 0; i < NombreBandes; i++) {
    const HauteurBande = Phaser.Math.Between(1, 2);
    const Y = Phaser.Math.Between(0, Math.max(0, Hauteur - HauteurBande));
    const LargeurBande = Phaser.Math.Between(Math.round(Largeur * 0.15), Largeur);
    const X = Phaser.Math.Between(-Math.round(LargeurBande * 0.3), Largeur - Math.round(LargeurBande * 0.7));
    Contexte.fillStyle = CouleursBandes[Phaser.Math.Between(0, CouleursBandes.length - 1)];
    Contexte.fillRect(X, Y, LargeurBande, HauteurBande);
  }

  Texture.refresh();

  const OpaciteCentrale = Phaser.Math.Linear(OpaciteMin, OpaciteMax, Intensite);
  const Tremblement = 0.15 * Intensite;
  Scene.SpriteGlitch.setAlpha(
    Phaser.Math.Clamp(OpaciteCentrale + Phaser.Math.FloatBetween(-Tremblement, Tremblement), 0, 1),
  );
}

// Intensite au maximum : petit flash puis retour au point de spawn de la
// carte (Scene.PositionSpawnX/Y, pose par scene-jeu.js), comme si le glitch
// avait fini par "avaler" le joueur.
function RenvoyerAuSpawn(Scene) {
  Scene.GlitchRenvoiEnCours = true;
  Scene.IntensiteGlitch = 0;

  Scene.cameras.main.fadeOut(DureeFonduRetourSpawn, 255, 255, 255); // flash blanc, plus "electrique" qu'un fondu au noir
  Scene.cameras.main.once('camerafadeoutcomplete', () => {
    Scene.SpriteGlitch.setVisible(false);
    Scene.Personnage.setPosition(Scene.PositionSpawnX, Scene.PositionSpawnY);
    Scene.Personnage.body.setVelocity(0, 0);
    Scene.CameraDoitSauter = true; // recadrage instantane (voir camera.js)

    Scene.cameras.main.fadeIn(DureeFonduRetourSpawn, 255, 255, 255);
    Scene.cameras.main.once('camerafadeincomplete', () => {
      Scene.CameraDoitSauter = false;
      Scene.GlitchRenvoiEnCours = false;
    });
  });
}
