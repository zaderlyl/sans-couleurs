// features/portails.js — teleportation instantanee entre deux cases d'UNE
// MEME carte, declenchee par le joueur (touche E), dans les deux sens.
//
// Contrairement a `teleportation.js` (contact automatique, change de carte),
// ici le joueur choisit : une icone "E" apparait sur chaque case du duo, et
// le declenchement le renvoie a l'autre case — d'ou il peut "faire demi-tour"
// de la meme facon.
//
// Une carte declare ses duos dans sa config :
//   portails: [{ colonneA, rangeeA, colonneB, rangeeB }]

import { ConfigCarte, TailleTuile } from '../maps/cartes.js';
import { CreerIconeInteraction, TailleIconeInteraction } from '../icone-interaction.js';

const DureeFonduPortail = 250; // ms, fondu court : c'est instantane, pas un voyage


export const Portails = {
  nom: 'portails',

  installer(Scene) {
    const Config = ConfigCarte(Scene.NomCarteActuelle).portails || [];
    // Chaque duo garde ses 2 points + sa propre icone a chaque bout (le
    // joueur peut arriver par n'importe quel cote).
    Scene.Portails = Config.map((Duo) => ({
      A: { Colonne: Duo.colonneA, Rangee: Duo.rangeeA },
      B: { Colonne: Duo.colonneB, Rangee: Duo.rangeeB },
      IconeA: CreerIconePortail(Scene, Duo.colonneA, Duo.rangeeA),
      IconeB: CreerIconePortail(Scene, Duo.colonneB, Duo.rangeeB),
    }));
    Scene.PortailEnCours = false; // verrou : un seul voyage a la fois
  },

  miseAJour(Scene) {
    if (Scene.Portails.length === 0) return;
    // Un voyage est deja en cours : on laisse sa sequence (icone "E qui
    // eclate" puis fondu) se terminer sans qu'on revienne ecraser l'icone
    // avec "iconeAttente" entre-temps (le joueur est encore sur la case de
    // depart jusqu'a la fin du fondu).
    if (Scene.PortailEnCours) return;
    // Pas de portail pendant un voyage en train ou un dialogue (joueur fige).
    const Fige = Scene.EtatGare === 'enCours' || Scene.DialogueOuvert;

    const Colonne = Math.floor(Scene.Personnage.x / TailleTuile);
    const Rangee = Math.floor(Scene.Personnage.y / TailleTuile);

    for (const Portail of Scene.Portails) {
      const SurA = Colonne === Portail.A.Colonne && Rangee === Portail.A.Rangee;
      const SurB = Colonne === Portail.B.Colonne && Rangee === Portail.B.Rangee;

      GererIconePortail(Scene, Portail.IconeA, SurA && !Fige);
      GererIconePortail(Scene, Portail.IconeB, SurB && !Fige);

      if (Fige) continue;
      if (!Phaser.Input.Keyboard.JustDown(Scene.ToucheInteraction)) continue;

      if (SurA) DeclencherPortail(Scene, Portail.IconeA, Portail.B);
      else if (SurB) DeclencherPortail(Scene, Portail.IconeB, Portail.A);
    }
  },
};


// --- Interne ------------------------------------------------------

// Icone posee juste au-dessus de la case, cachee tant que le joueur n'y est pas.
function CreerIconePortail(Scene, Colonne, Rangee) {
  return CreerIconeInteraction(
    Scene,
    (Colonne + 0.5) * TailleTuile,
    Rangee * TailleTuile - TailleIconeInteraction,
  );
}

// Affiche/anime l'icone d'un point du duo selon si le joueur y est.
function GererIconePortail(Scene, Icone, DansLaZone) {
  if (!DansLaZone) {
    Icone.setVisible(false);
    return;
  }
  Icone.setVisible(true);
  Icone.play('iconeAttente', true); // true : ne relance pas si deja en cours
}

// Joue "E qui eclate" sur l'icone de depart, puis fondu -> deplacement
// instantane vers `Destination` -> fondu inverse. Le joueur peut repartir
// aussitot dans l'autre sens (meme mecanique, cote oppose).
function DeclencherPortail(Scene, IconeDepart, Destination) {
  Scene.PortailEnCours = true;

  IconeDepart.play('iconePressee');
  IconeDepart.once('animationcomplete', () => {
    IconeDepart.setVisible(false);
    Scene.cameras.main.fadeOut(DureeFonduPortail, 0, 0, 0);
    Scene.cameras.main.once('camerafadeoutcomplete', () => {
      Scene.Personnage.setPosition(
        (Destination.Colonne + 0.5) * TailleTuile,
        Destination.Rangee * TailleTuile,
      );
      Scene.Personnage.body.setVelocity(0, 0);
      Scene.CameraDoitSauterEnX = true; // recadrage instantane, pas de glissement

      Scene.cameras.main.fadeIn(DureeFonduPortail, 0, 0, 0);
      Scene.PortailEnCours = false;
    });
  });
}
