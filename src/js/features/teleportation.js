// features/teleportation.js — passages d'une carte a l'autre par simple contact.
//
// Une carte declare ses passages dans sa config :
//   teleportations: [{ colonne, rangee, versCarte, arrivee? }]
// Des que le centre du joueur entre dans la tuile (colonne, rangee), l'ecran
// fond au noir et la scene redemarre sur `versCarte`. `arrivee: true` fait
// jouer l'animation d'arrivee en train sur la carte cible (feature gare) —
// a n'utiliser que si la carte cible a une gare, sinon l'ecran reste noir.

import { ConfigCarte, TailleTuile } from '../maps/cartes.js';

const DureeFonduTeleportation = 400; // ms du fondu au noir avant le changement

export const Teleportation = {
  nom: 'teleportation',

  installer(Scene) {
    Scene.Teleportations = ConfigCarte(Scene.NomCarteActuelle).teleportations || [];
    Scene.TeleportationEnCours = false;
  },

  miseAJour(Scene) {
    if (Scene.TeleportationEnCours) return;
    if (Scene.Teleportations.length === 0) return;
    // Pas pendant une sequence de gare ou un dialogue (joueur fige).
    if (Scene.EtatGare === 'enCours' || Scene.DialogueOuvert) return;

    const Colonne = Math.floor(Scene.Personnage.x / TailleTuile);
    const Rangee = Math.floor(Scene.Personnage.y / TailleTuile);
    const Cible = Scene.Teleportations.find(
      (Passage) => Passage.colonne === Colonne && Passage.rangee === Rangee,
    );
    if (!Cible) return;

    Scene.TeleportationEnCours = true; // verrou : ne se declenche qu'une fois
    Scene.Personnage.body.setVelocity(0, 0);
    Scene.cameras.main.fadeOut(DureeFonduTeleportation, 0, 0, 0);
    Scene.cameras.main.once('camerafadeoutcomplete', () => {
      Scene.scene.restart({ carte: Cible.versCarte, arrivee: !!Cible.arrivee });
    });
  },
};
