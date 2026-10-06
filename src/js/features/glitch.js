// features/glitch.js — effet de "greselement" (bruit de vieille tele
// cathodique), mais en pixels colores RVB au lieu du gris habituel.
//
// Zones definies dans Tiled : rectangles sur le calque objets, avec une
// propriete "name" valant "glitch" ou "glitch2". Le joueur dedans -> l'effet
// monte progressivement (Scene.IntensiteGlitch, 0 a 1) tant qu'il y reste, et
// redescend en douceur des qu'il en ressort — les 2 noms de zone comptent
// pareil pour la montee (passer de l'une a l'autre ne coupe rien), seul le
// type de la zone ou le joueur se trouve QUAND l'intensite atteint 1 change
// ce qui se passe ensuite :
//   - "glitch"  -> le glitch "avale" le joueur, retour au spawn de la carte,
//     sans coupure (pas d'ecran de mort).
//   - "glitch2" -> le joueur "meurt" : ecran noir, texte (placeholder, a
//     ecrire), puis clic pour reapparaitre au spawn de LA MEME carte.

import { NomCoucheObjets } from '../maps/cartes.js';
import { NomPoliceTexteDeZone } from '../config.js';
import { ConsommerClicSouris } from '../interaction-souris.js';

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
const OpaciteMax = 0.85;   // presque aveuglant juste avant le declenchement final
const IntervalleRafraichissementMin = 140; // ms entre 2 images de bruit, intensite 0
const IntervalleRafraichissementMax = 45;  // ms entre 2 images de bruit, intensite 1 (saccade)
const DensiteGrainMin = 0.06; // part de pixels "allumes" dans le grain fin, intensite 0
const DensiteGrainMax = 0.35; // ... intensite 1
const NombreBandesMin = 1; // bandes de dechirure horizontales, intensite 0
const NombreBandesMax = 7; // ... intensite 1
const DureeFonduRetourSpawn = 350;

// --- Mort "glitch2" : ecran noir + clic pour reapparaitre -----
// TODO : texte definitif pas encore decide.
const DureeFonduMortGlitch2 = 500;
const TextePlaceholderMortGlitch2 =
  '[ SIGNAL PERDU ]\n\n( texte a definir )\n\nClique pour reapparaitre';
const StyleTextePlaceholderMortGlitch2 = {
  fontFamily: `'${NomPoliceTexteDeZone}', monospace`,
  fontSize: '10px',
  color: '#ffffff',
  align: 'center',
  lineSpacing: 4,
  wordWrap: { width: 180 },
};


export const Glitch = {
  nom: 'glitch',

  installer(Scene, Ctx) {
    Scene.ZonesGlitch = LireZonesGlitch(Ctx.Carte);
    Scene.IntensiteGlitch = 0; // 0 (rien) a 1 (declenchement : spawn ou ecran de fin)
    Scene.TypeZoneGlitchActuelle = null; // 'glitch' ou 'glitch2', selon la derniere zone traversee
    Scene.MinuteurBruitGlitch = 0;
    Scene.GlitchRenvoiEnCours = false;
    Scene.GlitchEtatFin = null; // null | 'enCours' (fondu) | 'attente' (E pour continuer)
    Scene.TailleTextureGlitch = null; // { Largeur, Hauteur } de la derniere texture creee
    Scene.FondEcranMortGlitch2 = null;
    Scene.TextePlaceholderMortGlitch2 = null;
    if (Scene.ZonesGlitch.length === 0) return; // carte sans glitch : rien a poser

    Scene.SpriteGlitch = Scene.add.image(0, 0, '__DEFAULT'); // texture reelle posee au 1er RafraichirBruit
    Scene.SpriteGlitch.setOrigin(0, 0);
    Scene.SpriteGlitch.setDepth(1000); // au-dessus de tout (perso, herbe, icones...)
    Scene.SpriteGlitch.setVisible(false);
    Scene.SpriteGlitch.setAlpha(0); // evite un flash a pleine opacite avant le 1er RafraichirBruit
  },

  miseAJour(Scene, Temps, TempsEcoule) {
    if (Scene.ZonesGlitch.length === 0) return;

    // Ecran de mort glitch2 : plus rien d'autre a faire tant qu'on attend le clic.
    if (Scene.GlitchEtatFin === 'attente') {
      if (ConsommerClicSouris(Scene)) {
        RespawnApresMortGlitch2(Scene);
      }
      return;
    }
    if (Scene.GlitchEtatFin === 'enCours' || Scene.GlitchRenvoiEnCours) return;

    const ZoneActuelle = Scene.ZonesGlitch.find((Zone) =>
      Scene.Personnage.x > Zone.XMin && Scene.Personnage.x < Zone.XMax &&
      Scene.Personnage.y > Zone.YMin && Scene.Personnage.y < Zone.YMax,
    );
    if (ZoneActuelle) Scene.TypeZoneGlitchActuelle = ZoneActuelle.Type;

    // Une seule jauge continue, quelle que soit la zone precise : passer
    // directement d'un "glitch" a un "glitch2" voisin ne fait pas retomber
    // l'intensite a 0, elle continue simplement de monter.
    const Vitesse = ZoneActuelle ? 1 / DureeMonteeMs : -1 / DureeDescenteMs;
    Scene.IntensiteGlitch = Phaser.Math.Clamp(Scene.IntensiteGlitch + TempsEcoule * Vitesse, 0, 1);

    if (Scene.IntensiteGlitch <= 0) {
      Scene.SpriteGlitch.setVisible(false);
      return;
    }

    if (Scene.IntensiteGlitch >= 1) {
      if (Scene.TypeZoneGlitchActuelle === 'glitch2') DeclencherMortGlitch2(Scene);
      else RenvoyerAuSpawn(Scene);
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

// Rectangles Tiled portant une propriete "name" = "glitch" ou "glitch2" —
// garde aussi laquelle des deux, pour decider quoi faire a pleine intensite.
function LireZonesGlitch(Carte) {
  const CoucheObjets = Carte.getObjectLayer(NomCoucheObjets);
  const Objets = CoucheObjets ? CoucheObjets.objects : [];

  return Objets
    .map((Objet) => {
      const Propriete = (Objet.properties || []).find((P) => P.name === 'name');
      const Valeur = Propriete && Propriete.value;
      if (Valeur !== 'glitch' && Valeur !== 'glitch2') return null;
      return { XMin: Objet.x, XMax: Objet.x + Objet.width, YMin: Objet.y, YMax: Objet.y + Objet.height, Type: Valeur };
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

// Fige le joueur (invisible, corps desactive) — reutilise par les 2 issues
// possibles de la pleine intensite (RenvoyerAuSpawn / DeclencherMortGlitch2).
function GelerJoueur(Scene) {
  Scene.Personnage.setVisible(false);
  Scene.Personnage.body.setVelocity(0, 0);
  Scene.Personnage.body.enable = false;
}

// Intensite au maximum dans une zone "glitch" : petit flash puis retour au
// point de spawn de la carte (Scene.PositionSpawnX/Y, pose par scene-jeu.js),
// comme si le glitch avait fini par "avaler" le joueur.
function RenvoyerAuSpawn(Scene) {
  Scene.GlitchRenvoiEnCours = true;
  Scene.IntensiteGlitch = 0;
  GelerJoueur(Scene);

  Scene.cameras.main.fadeOut(DureeFonduRetourSpawn, 255, 255, 255); // flash blanc, plus "electrique" qu'un fondu au noir
  Scene.cameras.main.once('camerafadeoutcomplete', () => {
    Scene.SpriteGlitch.setVisible(false);
    Scene.Personnage.setPosition(Scene.PositionSpawnX, Scene.PositionSpawnY);
    Scene.CameraDoitSauter = true; // recadrage instantane (voir camera.js)

    Scene.cameras.main.fadeIn(DureeFonduRetourSpawn, 255, 255, 255);
    Scene.cameras.main.once('camerafadeincomplete', () => {
      Scene.CameraDoitSauter = false;
      Scene.Personnage.body.enable = true;
      Scene.Personnage.setVisible(true);
      Scene.GlitchRenvoiEnCours = false;
    });
  });
}

// Intensite au maximum dans une zone "glitch2" : le joueur "meurt" — fondu
// au noir (pas de flash blanc, contrairement au retour au spawn — ça ne
// "continue" pas discretement, ça marque un coup d'arret), texte plein
// ecran, puis clic pour reapparaitre au spawn de LA MEME carte.
function DeclencherMortGlitch2(Scene) {
  Scene.GlitchEtatFin = 'enCours';
  Scene.IntensiteGlitch = 0;
  Scene.SpriteGlitch.setVisible(false);
  GelerJoueur(Scene);

  Scene.cameras.main.fadeOut(DureeFonduMortGlitch2, 0, 0, 0);
  Scene.cameras.main.once('camerafadeoutcomplete', () => {
    // Le fondu de camera reste applique tel quel (un simple overlay) tant
    // qu'on ne le reinitialise pas : tout ce qu'on ajouterait par-dessus
    // resterait cache dessous. On le leve ici et on le remplace par un vrai
    // fond noir (objet de la scene, comme le voile de bruit) pour que le
    // texte puisse s'afficher DESSUS, pas en-dessous.
    Scene.cameras.main.resetFX();
    AfficherEcranMortGlitch2(Scene);
    Scene.GlitchEtatFin = 'attente';
  });
}

// Fond noir + texte, tous deux cales sur la vue actuelle de la camera (meme
// logique que PositionnerSurCamera) : des objets normaux (pas scrollFactor
// 0) suivent le zoom naturellement, comme le voile de bruit.
function AfficherEcranMortGlitch2(Scene) {
  const Cam = Scene.cameras.main;
  const LargeurVueMonde = Cam.width / Cam.zoom;
  const HauteurVueMonde = Cam.height / Cam.zoom;
  const VueX = Cam.scrollX + (Cam.width - LargeurVueMonde) / 2;
  const VueY = Cam.scrollY + (Cam.height - HauteurVueMonde) / 2;

  const Fond = Scene.add.rectangle(VueX, VueY, LargeurVueMonde, HauteurVueMonde, 0x000000, 1);
  Fond.setOrigin(0, 0);
  Fond.setDepth(1000); // meme niveau que le voile de bruit (deja cache derriere)

  const Texte = Scene.add.text(
    VueX + LargeurVueMonde / 2, VueY + HauteurVueMonde / 2,
    TextePlaceholderMortGlitch2, StyleTextePlaceholderMortGlitch2,
  );
  Texte.setOrigin(0.5, 0.5);
  Texte.setDepth(1001); // au-dessus du fond noir
  // pixelArt: true met toutes les textures en NEAREST : parfait pour les
  // sprites, flou pour ce texte anti-aliase agrandi. On repasse en LINEAR
  // (meme astuce que textes-de-zone.js).
  Texte.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);

  Scene.FondEcranMortGlitch2 = Fond;
  Scene.TextePlaceholderMortGlitch2 = Texte;
}

// E presse sur l'ecran de mort : nettoie fond + texte et redemarre la MEME
// carte (pas de "carte" dans les donnees -> scene-jeu.js relit CleCarteDeDepart,
// donc on passe explicitement Scene.NomCarteActuelle) : "meurt depuis la
// map 3, reapparait sur la map 3", au spawn normal (pas d'arrivee en train).
function RespawnApresMortGlitch2(Scene) {
  if (Scene.FondEcranMortGlitch2) {
    Scene.FondEcranMortGlitch2.destroy();
    Scene.FondEcranMortGlitch2 = null;
  }
  if (Scene.TextePlaceholderMortGlitch2) {
    Scene.TextePlaceholderMortGlitch2.destroy();
    Scene.TextePlaceholderMortGlitch2 = null;
  }
  Scene.GlitchEtatFin = null;
  Scene.scene.restart({ carte: Scene.NomCarteActuelle });
}
