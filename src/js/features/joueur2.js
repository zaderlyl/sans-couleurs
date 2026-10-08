// features/joueur2.js — le joueur CLAVIER : fleches gauche / droite pour marcher,
// E pour interagir. (Le joueur 1, lui, ne joue qu'a la souris : clic = marcher
// ou interagir, voir interaction-souris.js et auto-marche.js.)
//
// Meme personnage que le joueur 1 mais aux couleurs INVERSEES : on fabrique
// une copie du spritesheet dont les canaux R, G, B sont inverses (l'alpha ne
// change pas). Le joueur 2 est independant (sa propre physique, son propre
// deplacement) et les deux joueurs se traversent sans se bloquer.
//
// Il interagit avec la touche E (portails, tele ; voir PourJoueur2 dans
// interaction-souris.js). La camera ne suit que le joueur 1 pour l'instant :
// le joueur 2 peut sortir de l'ecran (l'ecran separe en deux viendra apres).

import {
  ClePersonnage, FramePersoImmobile, FramePersoMarcheDebut, FramePersoMarcheFin,
  LargeurImagePersonnage, HauteurImagePersonnage, VitesseMarchePersonnage,
} from '../playerConfig.js';
import { LireDeplacementJoueur2 } from '../controle.js';
import { CreerAnim } from '../util.js';

const ClePersonnage2 = 'personnage2';
const DecalageDepartX = 24;  // px a droite du joueur 1 au depart / au rattrapage (> largeur d'un perso : pas colle)


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
    // Pas de collider entre les deux joueurs : ils se traversent, sans se cogner.
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
    const VeutGauche = Entrees.Gauche;
    const VeutDroite = Entrees.Droite && !Entrees.Gauche;

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
