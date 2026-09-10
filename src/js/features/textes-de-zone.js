// features/textes-de-zone.js — phrases fixes dans le monde qui apparaissent
// quand le joueur entre dans leur zone, avec un effet "machine a ecrire".
//
// Feature branchee par les cartes qui la listent dans leur `features`
// (voir EnregistrerCarte). Tout est defini depuis Tiled : un rectangle sur
// le calque objets, avec une propriete "texte" (et "points" optionnelle pour
// l'intro ". . ."). Le style commun StyleTexteDeZone est dans game.js.


// --- Rythme de l'effet machine a ecrire (ms) ---

import { NomCoucheObjets, ValeurBooleenneTiled } from '../maps/cartes.js';
import { StyleTexteDeZone } from '../config.js';

const DelaiParPoint = 500;       // entre chaque point de l'intro
const PauseApresPoints = 400;    // apres les 3 points, avant l'ecriture
const DelaiParLettre = 70;       // entre chaque lettre

// Une fois ecrit : reste lisible, puis se dissipe (fondu + flou). Une seule
// fois par texte — ensuite il ne rejoue plus, meme si le joueur revient.
const DureeAffichageFini = 1800;
const DureeDisparitionTexte = 1000;
const IntensiteFlouDisparition = 6;


export const TextesDeZone = {
  nom: 'textes-de-zone',

  installer(Scene, Ctx) {
    CreerTextesDeZone(Scene, Ctx.Carte);
  },

  miseAJour(Scene, Temps, TempsEcoule) {
    if (Scene.TextesDeZoneSprites) MettreAJourTextesDeZone(Scene, TempsEcoule);
  },
};


// Lit les rectangles portant une propriete "texte" sur le calque objets et
// cree un objet Text par entree — pose une fois, jamais repositionne (seule
// sa visibilite change, voir MettreAJourTextesDeZone). Ne plante pas si la
// carte n'a aucun texte.
function CreerTextesDeZone(Scene, Carte) {
  const CoucheObjets = Carte.getObjectLayer(NomCoucheObjets);
  const Objets = CoucheObjets ? CoucheObjets.objects : [];

  Scene.TextesDeZoneEntrees = Objets
    .map((Objet) => {
      const Propriete = (Objet.properties || []).find((P) => P.name === 'texte');
      if (!Propriete || !Propriete.value) return null;
      const ProprietePoints = (Objet.properties || []).find((P) => P.name === 'points');
      return {
        Zone: { XMin: Objet.x, XMax: Objet.x + Objet.width, YMin: Objet.y, YMax: Objet.y + Objet.height },
        PositionX: Objet.x + Objet.width / 2,
        PositionY: Objet.y,
        Texte: Propriete.value,
        AvecPoints: ValeurBooleenneTiled(ProprietePoints && ProprietePoints.value),
        // Machine a etats de l'effet : 'inactive' (jamais entre, ou ressorti
        // avant la fin) -> 'points' -> 'pause' -> 'ecriture' -> 'fini' ->
        // 'disparition' -> 'termine' (definitif).
        Phase: 'inactive',
        Minuteur: 0,
        IndexPoints: 0,
        IndexLettre: 0,
      };
    })
    .filter(Boolean);

  Scene.TextesDeZoneSprites = Scene.TextesDeZoneEntrees.map((Entree) => {
    const Texte = Scene.add.text(Entree.PositionX, Entree.PositionY, '', StyleTexteDeZone);
    Texte.setOrigin(0.5, 1);
    Texte.setDepth(20);
    Texte.setVisible(false);
    // pixelArt: true met toutes les textures en NEAREST : parfait pour les
    // sprites, flou pour un texte anti-aliase agrandi. On repasse en LINEAR.
    Texte.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    // Flou croissant pendant la disparition (bulle de pensee qui se dissipe).
    // try/catch : postFX peut ne pas etre pret — un simple flou cosmetique ne
    // doit pas casser la creation de la scene.
    try {
      Entree.FxBlur = Texte.postFX.addBlur(0, 0.5, 0.5, 0, 0xffffff, 4);
    } catch (Erreur) {
      console.warn('Flou de disparition indisponible pour ce texte de zone :', Erreur);
      Entree.FxBlur = null;
    }
    return Texte;
  });
}

// Chaque frame : joue/avance la sequence selon la position du joueur. Sortir
// de la zone avant la fin de l'ecriture reinitialise ('inactive') ; une fois
// 'fini', la dissipation se termine toute seule meme si le joueur ressort.
function MettreAJourTextesDeZone(Scene, TempsEcoule) {
  Scene.TextesDeZoneEntrees.forEach((Entree, Index) => {
    const Sprite = Scene.TextesDeZoneSprites[Index];

    if (Entree.Phase === 'fini') {
      Entree.Minuteur += TempsEcoule;
      if (Entree.Minuteur < DureeAffichageFini) return;
      Entree.Phase = 'disparition';
      Scene.tweens.add({
        targets: Sprite,
        alpha: 0,
        duration: DureeDisparitionTexte,
        ease: 'Sine.easeIn',
        onComplete: () => {
          Entree.Phase = 'termine';
          Sprite.setVisible(false);
        },
      });
      if (Entree.FxBlur) {
        Scene.tweens.add({
          targets: Entree.FxBlur,
          strength: IntensiteFlouDisparition,
          duration: DureeDisparitionTexte,
          ease: 'Sine.easeIn',
        });
      }
      return;
    }
    // 'disparition' : fondu en cours (gere par les tweens). 'termine' : fini.
    if (Entree.Phase === 'disparition' || Entree.Phase === 'termine') return;

    const DansLaZone =
      Scene.Personnage.x > Entree.Zone.XMin &&
      Scene.Personnage.x < Entree.Zone.XMax &&
      Scene.Personnage.y > Entree.Zone.YMin &&
      Scene.Personnage.y < Entree.Zone.YMax;

    if (!DansLaZone) {
      if (Entree.Phase !== 'inactive') {
        Entree.Phase = 'inactive';
        Sprite.setVisible(false);
      }
      return;
    }

    if (Entree.Phase === 'inactive') {
      // Vient d'entrer : (re)demarre la sequence. Le premier point / la
      // premiere lettre apparait tout de suite (sans attendre le 1er delai).
      Entree.Minuteur = 0;
      if (Entree.AvecPoints) {
        Entree.Phase = 'points';
        Entree.IndexPoints = 1;
        Entree.IndexLettre = 0;
        Sprite.setText('.');
      } else {
        Entree.Phase = 'ecriture';
        Entree.IndexLettre = 1;
        Sprite.setText(Entree.Texte.slice(0, 1));
        if (Entree.IndexLettre >= Entree.Texte.length) Entree.Phase = 'fini';
      }
      Sprite.setVisible(true);
      return;
    }

    Entree.Minuteur += TempsEcoule;

    if (Entree.Phase === 'points') {
      if (Entree.Minuteur < DelaiParPoint) return;
      Entree.Minuteur = 0;
      Entree.IndexPoints++;
      if (Entree.IndexPoints >= 3) {
        Sprite.setText('. . .');
        Entree.Phase = 'pause';
      } else {
        Sprite.setText(new Array(Entree.IndexPoints).fill('.').join(' '));
      }
    } else if (Entree.Phase === 'pause') {
      if (Entree.Minuteur < PauseApresPoints) return;
      Entree.Minuteur = 0;
      Entree.IndexLettre = 0;
      Sprite.setText('');
      Entree.Phase = 'ecriture';
    } else if (Entree.Phase === 'ecriture') {
      if (Entree.Minuteur < DelaiParLettre) return;
      Entree.Minuteur = 0;
      Entree.IndexLettre++;
      Sprite.setText(Entree.Texte.slice(0, Entree.IndexLettre));
      if (Entree.IndexLettre >= Entree.Texte.length) {
        Entree.Phase = 'fini';
      }
    }
  });
}
