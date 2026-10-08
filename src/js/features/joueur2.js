// features/joueur2.js — un second joueur, controle avec les fleches gauche /
// droite (le joueur 1 passe sur A/Q et D, voir controle.js).
//
// Meme personnage que le joueur 1 mais aux couleurs INVERSEES : on fabrique
// une copie du spritesheet dont les canaux R, G, B sont inverses (l'alpha ne
// change pas). Le joueur 2 est independant (sa propre physique, son propre
// deplacement) et les deux joueurs se bloquent l'un l'autre.
//
// La camera ne suit que le joueur 1 : le joueur 2 ne peut pas sortir de
// l'ecran, et s'il est laisse trop loin derriere (ou si le joueur 1 se
// teleporte), il est ramene a cote du joueur 1.

import {
  ClePersonnage, FramePersoImmobile, FramePersoMarcheDebut, FramePersoMarcheFin,
  LargeurImagePersonnage, HauteurImagePersonnage, VitesseMarchePersonnage,
} from '../playerConfig.js';
import { LireDeplacementJoueur2 } from '../controle.js';
import { CreerAnim } from '../util.js';

const ClePersonnage2 = 'personnage2';
const DecalageDepartX = 24;  // px a droite du joueur 1 au depart / au rattrapage (> largeur d'un perso : pas colle)
const MargeEcran = 6;        // px : le joueur 2 reste a l'interieur de l'ecran
const DistanceRattrapage = 40; // px au-dela de l'ecran : on le ramene au joueur 1


export const Joueur2 = {
  nom: 'joueur2',

  // Fin de create() : le joueur 1 et le collider du sol existent deja.
  apresChargement(Scene) {
    CreerTextureInversee(Scene);

    const Perso1 = Scene.Personnage;
    Scene.Joueur2 = Scene.physics.add.sprite(Perso1.x + DecalageDepartX, Perso1.y, ClePersonnage2, FramePersoImmobile);
    Scene.Joueur2.setDepth(Perso1.depth);
    Scene.Joueur2.body.setCollideWorldBounds(true);
    Scene.Joueur2.OrientationGauche = false;

    CreerAnim(Scene, {
      key: 'marche2',
      frames: Scene.anims.generateFrameNumbers(ClePersonnage2, { start: FramePersoMarcheDebut, end: FramePersoMarcheFin }),
      frameRate: 8,
      repeat: -1,
    });

    Scene.physics.add.collider(Scene.Joueur2, Scene.CalqueCollision);
    Scene.physics.add.collider(Scene.Joueur2, Perso1); // les deux joueurs se bloquent
  },

  miseAJour(Scene) {
    const J2 = Scene.Joueur2;
    if (!J2 || !J2.active) return;

    // Meme gel que le joueur 1 : voyage en train, dialogue, ecran de fin.
    if (Scene.EtatGare === 'enCours' || Scene.DialogueOuvert || Scene.GlitchEtatFin) {
      J2.body.setVelocityX(0);
      J2.anims.stop();
      J2.setFrame(FramePersoImmobile);
      return;
    }

    const Entrees = LireDeplacementJoueur2(Scene);
    const Vue = Scene.cameras.main.worldView;

    // Trop loin de l'ecran (joueur 1 teleporte ou parti loin) : retour a cote de lui.
    if (J2.x < Vue.left - DistanceRattrapage || J2.x > Vue.right + DistanceRattrapage ||
        J2.y < Vue.top - DistanceRattrapage || J2.y > Vue.bottom + DistanceRattrapage) {
      J2.setPosition(Scene.Personnage.x + DecalageDepartX, Scene.Personnage.y);
      J2.body.setVelocity(0, 0);
      return;
    }

    // Ne sort pas de l'ecran : on coupe l'elan vers le bord.
    const AuBordGauche = J2.x <= Vue.left + MargeEcran;
    const AuBordDroit = J2.x >= Vue.right - MargeEcran;
    const VeutGauche = Entrees.Gauche && !AuBordGauche;
    const VeutDroite = Entrees.Droite && !AuBordDroit && !Entrees.Gauche;

    if (VeutGauche || VeutDroite) {
      J2.body.setVelocityX(VeutGauche ? -VitesseMarchePersonnage : VitesseMarchePersonnage);
      J2.OrientationGauche = VeutGauche;
      J2.setFlipX(VeutGauche);
      J2.anims.play('marche2', true);
    } else {
      J2.body.setVelocityX(0);
      J2.anims.stop();
      J2.setFlipX(J2.OrientationGauche);
      J2.setFrame(FramePersoImmobile);
    }
  },
};


// --- Interne ------------------------------------------------------

// Copie le spritesheet du joueur 1 dans un canvas en inversant R, G, B.
function CreerTextureInversee(Scene) {
  if (Scene.textures.exists(ClePersonnage2)) return;

  const Image = Scene.textures.get(ClePersonnage).getSourceImage();
  const Toile = Scene.textures.createCanvas(ClePersonnage2, Image.width, Image.height);
  const Contexte = Toile.getContext();
  Contexte.drawImage(Image, 0, 0);

  const Donnees = Contexte.getImageData(0, 0, Image.width, Image.height);
  const Pixels = Donnees.data;
  for (let i = 0; i < Pixels.length; i += 4) { // [R, G, B, A] par pixel
    Pixels[i] = 255 - Pixels[i];
    Pixels[i + 1] = 255 - Pixels[i + 1];
    Pixels[i + 2] = 255 - Pixels[i + 2];
  }
  Contexte.putImageData(Donnees, 0, 0);
  Toile.refresh();

  // Une canvas-texture n'a qu'une frame : on redecoupe les frames 16x16 comme
  // le spritesheet d'origine (numerotees 0, 1, 2...).
  const NombreFrames = Math.floor(Image.width / LargeurImagePersonnage);
  for (let i = 0; i < NombreFrames; i++) {
    Toile.add(i, 0, i * LargeurImagePersonnage, 0, LargeurImagePersonnage, HauteurImagePersonnage);
  }
}
