// features/tunnel.js — le calque Tiled "tunnel", au premier plan (depth 3),
// se dessine devant le joueur pour cacher ce qu'il y a derriere. Quand le
// joueur entre dans son emprise horizontale (donc visuellement "derriere"),
// il s'estompe en fondu pour ne pas le cacher completement, puis redevient
// opaque une fois ressorti.
//
// L'emprise n'est pas codee en dur : calculee depuis les tuiles reellement
// posees sur ce calque (voir CalculerBoitePixels dans cartes.js).


import { CalculerBoitePixels } from '../maps/cartes.js';

const TunnelAlphaMin = 0.15;      // jamais totalement invisible : on voit qu'il est la
const TunnelVitesseFondu = 0.08;  // vitesse de transition vers l'alpha cible, par frame


export const Tunnel = {
  nom: 'tunnel',

  installer(Scene, Ctx) {
    Scene.CalqueTunnel = Ctx.Carte.createLayer('tunnel', Ctx.JeuDeTuiles, 0, 0);
    if (!Scene.CalqueTunnel) return; // carte sans calque "tunnel"
    Scene.CalqueTunnel.setDepth(3);

    const Boite = CalculerBoitePixels(Ctx.Carte, 'tunnel');
    Scene.TunnelXMin = Boite ? Boite.XMin : 0;
    Scene.TunnelXMax = Boite ? Boite.XMax : 0;
  },

  miseAJour(Scene) {
    if (!Scene.CalqueTunnel) return;
    const DansLeTunnel = Scene.Personnage.x > Scene.TunnelXMin && Scene.Personnage.x < Scene.TunnelXMax;
    const AlphaCible = DansLeTunnel ? TunnelAlphaMin : 1;
    Scene.CalqueTunnel.alpha = Phaser.Math.Linear(Scene.CalqueTunnel.alpha, AlphaCible, TunnelVitesseFondu);
  },
};
