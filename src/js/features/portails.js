// features/portails.js — teleportation instantanee entre deux cases d'UNE
// MEME carte, declenchee par le joueur (clic souris), dans les deux sens.
//
// Contrairement a `teleportation.js` (contact automatique, change de carte),
// ici le joueur choisit : une icone "E" apparait sur chaque case du duo au
// survol de la souris, et le clic le renvoie a l'autre case — d'ou il peut
// "faire demi-tour" de la meme facon.
//
// Une carte declare ses duos dans sa config :
//   portails: [{ colonneA, rangeeA, colonneB, rangeeB, iconeEnBas? }]
// iconeEnBas (optionnel, false par defaut) : l'icone "E" se pose sous le
// joueur au lieu d'au-dessus (utile si un plafond bas cache l'icone du dessus).

import { ConfigCarte, TailleTuile } from '../maps/cartes.js';
import { CreerIconeInteraction, TailleIconeInteraction } from '../icone-interaction.js';
import { EnregistrerInteractionSouris } from '../interaction-souris.js';
import { CameraDuJoueur } from '../camera-separee.js';

const DureeFonduPortail = 250; // ms, fondu court : c'est instantane, pas un voyage


export const Portails = {
  nom: 'portails',

  installer(Scene) {
    const Config = ConfigCarte(Scene.NomCarteActuelle).portails || [];
    // Chaque duo garde ses 2 points + sa propre icone a chaque bout (le
    // joueur peut arriver par n'importe quel cote). Un seul voyage a la fois
    // pour toute la carte (Scene.PortailEnCours), comme avant.
    Scene.PortailEnCours = false;
    Scene.Portails = Config.map((Duo) => {
      const A = { Colonne: Duo.colonneA, Rangee: Duo.rangeeA };
      const B = { Colonne: Duo.colonneB, Rangee: Duo.rangeeB };
      const IconeA = CreerIconePortail(Scene, Duo.colonneA, Duo.rangeeA, Duo.iconeEnBas);
      const IconeB = CreerIconePortail(Scene, Duo.colonneB, Duo.rangeeB, Duo.iconeEnBas);

      // Pas de sprite dedie pour un portail : la Cible de survol doit couvrir
      // a la fois la case (le point de rendez-vous, "Zone") ET l'icone
      // elle-meme (dessinee au-dessus OU en-dessous de la case selon
      // iconeEnBas) — sinon la souris doit survoler un endroit vide (la
      // case) different d'ou l'icone est reellement affichee.
      const CaseA = ZoneDeLaCase(A);
      const CaseB = ZoneDeLaCase(B);
      EnregistrerInteractionSouris(Scene, {
        Zone: CaseA,
        Cible: ZoneSurvolPortail(CaseA, Duo.colonneA, Duo.rangeeA, Duo.iconeEnBas),
        Icone: IconeA,
        EstActive: () => !Scene.PortailEnCours,
        PourJoueur2: true,
        OnDeclenchement: (Acteur) => DeclencherPortail(Scene, IconeA, B, Acteur),
      });
      EnregistrerInteractionSouris(Scene, {
        Zone: CaseB,
        Cible: ZoneSurvolPortail(CaseB, Duo.colonneB, Duo.rangeeB, Duo.iconeEnBas),
        Icone: IconeB,
        EstActive: () => !Scene.PortailEnCours,
        PourJoueur2: true,
        OnDeclenchement: (Acteur) => DeclencherPortail(Scene, IconeB, A, Acteur),
      });

      return { A, B, IconeA, IconeB };
    });
  },
};


// --- Interne ------------------------------------------------------

// Rectangle exact d'une case (colonne, rangee) : le joueur doit s'y tenir
// pile, comme avant (pas juste "a proximite").
function ZoneDeLaCase({ Colonne, Rangee }) {
  return {
    XMin: Colonne * TailleTuile,
    XMax: (Colonne + 1) * TailleTuile,
    YMin: Rangee * TailleTuile,
    YMax: (Rangee + 1) * TailleTuile,
  };
}

// Icone au-dessus (par defaut) ou en-dessous (iconeEnBas) de la case, cachee
// tant que le joueur n'y est pas.
function CreerIconePortail(Scene, Colonne, Rangee, EnBas) {
  const Y = EnBas
    ? (Rangee + 1) * TailleTuile + TailleIconeInteraction // sous le sol, sous le joueur
    : Rangee * TailleTuile - TailleIconeInteraction;      // au-dessus de la tete (comportement habituel)
  return CreerIconeInteraction(Scene, (Colonne + 0.5) * TailleTuile, Y);
}

// Rectangle de survol d'un portail : `Case` (la case elle-meme) etendu
// jusqu'a englober l'icone (meme calcul de position que CreerIconePortail),
// qui se dessine hors de la case (au-dessus ou en-dessous selon EnBas).
function ZoneSurvolPortail(Case, Colonne, Rangee, EnBas) {
  const CentreIconeY = EnBas
    ? (Rangee + 1) * TailleTuile + TailleIconeInteraction
    : Rangee * TailleTuile - TailleIconeInteraction;
  const IconeYMin = CentreIconeY - TailleIconeInteraction / 2;
  const IconeYMax = CentreIconeY + TailleIconeInteraction / 2;
  return {
    XMin: Case.XMin,
    XMax: Case.XMax,
    YMin: Math.min(Case.YMin, IconeYMin),
    YMax: Math.max(Case.YMax, IconeYMax),
  };
}

// Fondu -> deplacement instantane vers `Destination` -> fondu inverse. Le
// joueur peut repartir aussitot dans l'autre sens (meme mecanique, cote
// oppose). L'anim "E qui eclate" est deja jouee par interaction-souris.js
// avant d'appeler cette fonction.
// `Acteur` : le joueur qui voyage (joueur souris par defaut, ou le joueur 2).
function DeclencherPortail(Scene, IconeDepart, Destination, Acteur = Scene.Personnage) {
  Scene.PortailEnCours = true;

  // Le fondu se fait sur l'ecran du joueur qui voyage : sa moitie si l'ecran
  // est separe, tout l'ecran sinon (voir camera-separee.js).
  const CameraVoyageur = CameraDuJoueur(Scene, Acteur);
  CameraVoyageur.fadeOut(DureeFonduPortail, 0, 0, 0);
  CameraVoyageur.once('camerafadeoutcomplete', () => {
    Acteur.setPosition(
      (Destination.Colonne + 0.5) * TailleTuile,
      Destination.Rangee * TailleTuile,
    );
    Acteur.body.setVelocity(0, 0);
    // Recadrage instantane (X et Y) : sans ca, la camera glisserait
    // doucement vers le joueur et le laisserait hors champ un instant
    // (les 2 cases d'un portail peuvent etre tres eloignees). Ca vaut pour
    // la camera principale ET la 2e s'il y a un ecran separe : chacune lit ce
    // meme indicateur (voir camera.js).
    Scene.CameraDoitSauter = true;

    CameraVoyageur.fadeIn(DureeFonduPortail, 0, 0, 0);
    CameraVoyageur.once('camerafadeincomplete', () => {
      Scene.CameraDoitSauter = false; // retour au suivi doux normal
    });
    Scene.PortailEnCours = false;
  });
}
