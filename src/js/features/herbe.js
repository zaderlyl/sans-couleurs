// features/herbe.js — brins d'herbe qui plient au passage du joueur.
//
// Le calque Tiled "devant" n'est pas rendu comme des tuiles figees : on lit
// ses positions et on pose a la place, a chaque emplacement, deux sprites
// superposes ("Avant" visible, "Arriere" cache) qu'on echange en fondu pour
// passer d'une frame a l'autre sans a-coup.
//
// animated_grass.png reprend les 4 variantes de brin de grass.png, mais avec
// 3 frames chacune : [statique, penche a droite, penche a gauche].


import { ChargerFeuille } from '../loading.js';
import { LireDeplacement } from '../controle.js';

const CleHerbe = 'herbeAnimee';
const CheminHerbe = 'assets/sprites/environment/animated_grass.png';
const TailleImageHerbe = 16;
const ImagesParVariante = 3;      // statique, droite, gauche
const NombreVariantesHerbe = 4;   // les 4 plus petits GID d'affilee sur "devant"
const RayonReactionHerbe = 20;    // px monde : distance a laquelle l'herbe reagit au joueur


export const Herbe = {
  nom: 'herbe',

  precharger(Scene) {
    ChargerFeuille(Scene, CleHerbe, CheminHerbe, TailleImageHerbe);
  },

  installer(Scene, Ctx) {
    CreerBrinsHerbe(Scene, Ctx.Carte);
  },

  miseAJour(Scene) {
    if (Scene.BrinsHerbe) MettreAJourHerbe(Scene);
  },
};


function CreerBrinsHerbe(Scene, Carte) {
  Scene.BrinsHerbe = [];

  const Calque = Carte.getLayer('devant');
  if (!Calque) return; // carte sans calque "devant" : pas d'herbe

  // Le GID de la variante 0 bouge a chaque ajout de tuile dans Tileset.png :
  // on le lit depuis la map (plus petit GID present) au lieu de le figer.
  let IdentifiantDepartHerbe = Infinity;
  for (const Ligne of Calque.data) {
    for (const Tuile of Ligne) {
      if (Tuile.index > 0 && Tuile.index < IdentifiantDepartHerbe) IdentifiantDepartHerbe = Tuile.index;
    }
  }

  for (const Ligne of Calque.data) {
    for (const Tuile of Ligne) {
      if (Tuile.index <= 0) continue; // case vide

      const Variante = Tuile.index - IdentifiantDepartHerbe;
      if (Variante < 0 || Variante >= NombreVariantesHerbe) continue; // tuile egaree, on l'ignore
      const ImageStatique = Variante * ImagesParVariante;

      const Avant = Scene.add.sprite(Tuile.pixelX, Tuile.pixelY, CleHerbe, ImageStatique);
      Avant.setOrigin(0, 0); // meme ancrage qu'une tuile, alignement pixel-perfect
      const Arriere = Scene.add.sprite(Tuile.pixelX, Tuile.pixelY, CleHerbe, ImageStatique);
      Arriere.setOrigin(0, 0);
      Arriere.setAlpha(0);
      Arriere.setDepth(Avant.depth + 1);

      Scene.BrinsHerbe.push({
        Avant,
        Arriere,
        PositionX: Tuile.pixelX + TailleImageHerbe / 2,
        ImageStatique,
        ImageCible: ImageStatique,
        DirectionActuelle: null, // null = debout, 'droite'/'gauche' = penche
        AnimationFondu: null,
      });
    }
  }
}

// Un brin penche des que le joueur marche dessus, et le reste tant qu'il
// reste sur la tuile (meme immobile) ; il ne se redresse qu'au depart.
function MettreAJourHerbe(Scene) {
  const { Gauche: SeDeplaceAGauche, Droite: SeDeplaceADroite } = LireDeplacement(Scene);

  for (const Brin of Scene.BrinsHerbe) {
    const Distance = Math.abs(Brin.PositionX - Scene.Personnage.x);

    if (Distance < RayonReactionHerbe) {
      if (SeDeplaceADroite) Brin.DirectionActuelle = 'droite';
      else if (SeDeplaceAGauche) Brin.DirectionActuelle = 'gauche';
      // sinon : joueur sur la tuile mais immobile -> on garde le dernier sens
    } else {
      Brin.DirectionActuelle = null; // le joueur a quitte la tuile
    }

    const Image =
      Brin.DirectionActuelle === 'droite'
        ? Brin.ImageStatique + 1
        : Brin.DirectionActuelle === 'gauche'
          ? Brin.ImageStatique + 2
          : Brin.ImageStatique;

    DefinirImageHerbe(Scene, Brin, Image);
  }
}

// Fait apparaitre `Image` en fondu (120 ms) par-dessus la frame actuelle. Ne
// relance pas de fondu si `Image` est deja la cible en cours.
function DefinirImageHerbe(Scene, Brin, Image) {
  if (Brin.ImageCible === Image) return;
  Brin.ImageCible = Image;

  if (Brin.AnimationFondu) Brin.AnimationFondu.stop();

  Brin.Arriere.setFrame(Image);
  Brin.Arriere.setAlpha(0);
  Brin.Arriere.setDepth(Brin.Avant.depth + 1);

  Brin.AnimationFondu = Scene.tweens.add({
    targets: Brin.Arriere,
    alpha: 1,
    duration: 120,
    onComplete: () => {
      Brin.Arriere.setAlpha(1); // etat final garanti meme si le tween est interrompu
      Brin.Avant.setAlpha(0);
      const Temporaire = Brin.Avant;
      Brin.Avant = Brin.Arriere;
      Brin.Arriere = Temporaire;
      Brin.AnimationFondu = null;
    },
  });
}
