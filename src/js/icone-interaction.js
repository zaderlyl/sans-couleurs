// icone-interaction.js — l'icone "E" affichee quand le joueur peut interagir.
// Partagee par la gare, la tele et les PNJ : chacun cree sa propre instance,
// mais les animations sont communes (creees une fois par la scene).
//
// E_animated.png : 11 frames de 16x16. Les 3 premieres (E plein encadre puis
// pointille) = l'invite en boucle. Les 8 suivantes = le E qui eclate quand on
// appuie, jouees une fois.

import { CreerAnim } from './util.js';

export const CleIconeInteraction = 'iconeInteraction';
export const CheminIconeInteraction = 'assets/ui/E_animated.png';
export const TailleIconeInteraction = 16;

// Anims communes, a creer une fois dans create() (voir scene-jeu.js).
export function CreerAnimsIconeInteraction(Scene) {
  CreerAnim(Scene, {
    key: 'iconeAttente',
    frames: Scene.anims.generateFrameNumbers(CleIconeInteraction, { start: 0, end: 2 }),
    frameRate: 4,
    repeat: -1,
  });
  CreerAnim(Scene, {
    key: 'iconePressee',
    frames: Scene.anims.generateFrameNumbers(CleIconeInteraction, { start: 3, end: 10 }),
    frameRate: 14,
    repeat: 0,
  });
}

// Une instance : sprite cache, depth 20 (au-dessus de tout). Renvoie le sprite.
export function CreerIconeInteraction(Scene, X, Y) {
  const Icone = Scene.add.sprite(X, Y, CleIconeInteraction, 0);
  Icone.setDepth(20);
  Icone.setVisible(false);
  return Icone;
}
