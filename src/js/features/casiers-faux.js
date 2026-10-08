// features/casiers-faux.js — les casiers qui ne teleportent pas "glitchent"
// quand on passe dessus en gardant le clic enfonce : ils sont remplaces par
// un autre modele de casier.
//
// Un casier fait 2 tuiles de haut sur le calque "bg2" (haut + bas, memes
// colonnes dans le tileset). Les casiers qui servent de portail (voir
// features/portails.js : la case du portail est la tuile du BAS) ne changent
// jamais : seuls les faux casiers reagissent. Chaque casier ne change qu'une
// fois par clic maintenu (sinon il clignoterait a chaque frame).

import { ConfigCarte } from '../maps/cartes.js';
import { PointMondeSouris } from '../camera-separee.js';

const NomCalqueCasiers = 'bg2';
// Tileset : les casiers occupent 2 rangees, une colonne par modele (0 a 7).
const PremierIndiceHaut = 351; // modele 0, tuile du haut
const PremierIndiceBas = 386;  // modele 0, tuile du bas
const NombreModeles = 8;
// Modeles proposes en remplacement (colonnes 2 a 5 du tileset).
const ModelesRemplacement = [2, 3, 4, 5];


export const CasiersFaux = {
  nom: 'casiers-faux',

  installer(Scene, Ctx) {
    const Calque = Ctx.Carte.getLayer(NomCalqueCasiers);
    Scene.CalqueCasiers = Calque ? Calque.tilemapLayer : null;
    Scene.CasiersPortails = new Set(
      (ConfigCarte(Scene.NomCarteActuelle).portails || []).flatMap((Duo) => [
        CleCasier(Duo.colonneA, Duo.rangeeA),
        CleCasier(Duo.colonneB, Duo.rangeeB),
      ]),
    );
    Scene.CasiersDejaChanges = new Set(); // remis a zero au relachement du clic
  },

  miseAJour(Scene) {
    if (!Scene.CalqueCasiers) return;
    const Souris = Scene.input.activePointer;
    if (!Souris.isDown) {
      Scene.CasiersDejaChanges.clear();
      return;
    }
    // Pas de changement pendant un voyage, un dialogue ou l'ecran de fin.
    if (Scene.EtatGare === 'enCours' || Scene.DialogueOuvert || Scene.GlitchEtatFin || Scene.PortailEnCours) return;

    const PointMonde = PointMondeSouris(Scene); // bonne camera si l'ecran est separe
    const Tuile = Scene.CalqueCasiers.getTileAtWorldXY(PointMonde.x, PointMonde.y);
    if (!Tuile) return;

    const Modele = ModeleDeTuile(Tuile.index);
    if (Modele === null) return;
    // Rangee de la tuile du bas : c'est elle qui identifie le casier (comme
    // la case d'un portail).
    const RangeeBas = Modele.EstHaut ? Tuile.y + 1 : Tuile.y;
    const Cle = CleCasier(Tuile.x, RangeeBas);
    if (Scene.CasiersPortails.has(Cle) || Scene.CasiersDejaChanges.has(Cle)) return;

    // Le casier complet doit etre la : haut + bas, sinon c'est un autre decor.
    const Haut = Scene.CalqueCasiers.getTileAt(Tuile.x, RangeeBas - 1);
    const Bas = Scene.CalqueCasiers.getTileAt(Tuile.x, RangeeBas);
    if (!Haut || !Bas) return;
    if (Haut.index !== PremierIndiceHaut + Modele.Colonne || Bas.index !== PremierIndiceBas + Modele.Colonne) return;

    const Choix = ModelesRemplacement.filter((Colonne) => Colonne !== Modele.Colonne);
    const Nouveau = Choix[Phaser.Math.Between(0, Choix.length - 1)];
    Scene.CalqueCasiers.putTileAt(PremierIndiceHaut + Nouveau, Tuile.x, RangeeBas - 1);
    Scene.CalqueCasiers.putTileAt(PremierIndiceBas + Nouveau, Tuile.x, RangeeBas);
    Scene.CasiersDejaChanges.add(Cle);
  },
};


// --- Interne ------------------------------------------------------

function CleCasier(Colonne, RangeeBas) {
  return `${Colonne},${RangeeBas}`;
}

// Quel modele de casier est cet indice de tuile ? null si ce n'en est pas un.
function ModeleDeTuile(Indice) {
  const Colonne = Indice - PremierIndiceHaut;
  if (Colonne >= 0 && Colonne < NombreModeles) return { Colonne, EstHaut: true };
  const ColonneBas = Indice - PremierIndiceBas;
  if (ColonneBas >= 0 && ColonneBas < NombreModeles) return { Colonne: ColonneBas, EstHaut: false };
  return null;
}
