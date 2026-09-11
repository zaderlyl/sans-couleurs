// features/glitch.js — effet de "greselement" (bruit de vieille tele
// cathodique), mais en pixels colores RVB au lieu du gris habituel.
//
// Zones definies dans Tiled : rectangles sur le calque objets, avec une
// propriete "name" valant "glitch" ou "glitch2". Des que le joueur entre
// dans l'une d'elles, un voile de bruit colore recouvre l'ecran ; il
// disparait des qu'il en ressort.

import { NomCoucheObjets } from '../maps/cartes.js';

const CleTextureBruit = 'bruitGlitch';
// Basse def puis agrandie a la taille de l'ecran : avec pixelArt: true (rendu
// NEAREST, voir index.js), chaque pixel de la texture devient un gros bloc
// net a l'ecran — l'aspect "gros pixels colores" d'un ecran qui grésille.
const LargeurTextureBruit = 64;
const HauteurTextureBruit = 48;
const IntervalleRafraichissementMs = 40; // ~25 images de bruit/seconde : assez saccade pour glitcher
const OpaciteMin = 0.35; // le joueur doit encore deviner ce qu'il y a derriere
const OpaciteMax = 0.75;


export const Glitch = {
  nom: 'glitch',

  installer(Scene, Ctx) {
    Scene.ZonesGlitch = LireZonesGlitch(Ctx.Carte);
    Scene.DansUneZoneGlitch = false;
    Scene.MinuteurBruitGlitch = 0;
    if (Scene.ZonesGlitch.length === 0) return; // carte sans glitch : rien a poser

    CreerTextureBruit(Scene);
    Scene.SpriteGlitch = Scene.add.image(0, 0, CleTextureBruit);
    Scene.SpriteGlitch.setOrigin(0, 0);
    Scene.SpriteGlitch.setDepth(1000); // au-dessus de tout (perso, herbe, icones...)
    Scene.SpriteGlitch.setVisible(false);
  },

  miseAJour(Scene, Temps, TempsEcoule) {
    if (Scene.ZonesGlitch.length === 0) return;

    const DansUneZone = Scene.ZonesGlitch.some((Zone) =>
      Scene.Personnage.x > Zone.XMin && Scene.Personnage.x < Zone.XMax &&
      Scene.Personnage.y > Zone.YMin && Scene.Personnage.y < Zone.YMax,
    );
    Scene.DansUneZoneGlitch = DansUneZone;
    Scene.SpriteGlitch.setVisible(DansUneZone);
    if (!DansUneZone) return;

    // Calque plein ecran calque sur la vue camera actuelle (memes formules
    // que MettreAJourCamera) : un sprite normal (pas scrollFactor 0) suit le
    // zoom naturellement, pas besoin d'une 2e camera pour un HUD.
    PositionnerSurCamera(Scene, Scene.SpriteGlitch);

    Scene.MinuteurBruitGlitch += TempsEcoule;
    if (Scene.MinuteurBruitGlitch < IntervalleRafraichissementMs) return;
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

// Texture canvas creee une fois par scene ; RafraichirBruit() la redessine
// avec de nouveaux pixels aleatoires a chaque "image" de bruit.
function CreerTextureBruit(Scene) {
  if (Scene.textures.exists(CleTextureBruit)) Scene.textures.remove(CleTextureBruit);
  Scene.textures.createCanvas(CleTextureBruit, LargeurTextureBruit, HauteurTextureBruit);
}

// Remplit la texture de pixels rouge/vert/bleu independants (pas du gris :
// c'est ça qui donne l'aspect "colore" plutot que la neige classique) et fait
// varier l'opacite du voile a chaque rafraichissement pour un effet instable.
function RafraichirBruit(Scene) {
  const Texture = Scene.textures.get(CleTextureBruit);
  const Contexte = Texture.getContext();
  const Image = Contexte.createImageData(LargeurTextureBruit, HauteurTextureBruit);

  for (let i = 0; i < Image.data.length; i += 4) {
    Image.data[i] = Phaser.Math.Between(0, 255);     // rouge
    Image.data[i + 1] = Phaser.Math.Between(0, 255); // vert
    Image.data[i + 2] = Phaser.Math.Between(0, 255); // bleu
    Image.data[i + 3] = 255;                         // alpha du pixel (l'opacite globale est sur le sprite)
  }

  Contexte.putImageData(Image, 0, 0);
  Texture.refresh();

  Scene.SpriteGlitch.setAlpha(Phaser.Math.FloatBetween(OpaciteMin, OpaciteMax));
}
