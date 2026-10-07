// features/dialogue-pnj.js — mini-jeu de dialogue avec les PNJ.
//
// Chaque PNJ est defini depuis Tiled (un objet sur le calque objets, avec une
// propriete "ligneNPJ"). Le joueur s'approche, clique sur l'icone : le PNJ
// dit sa phrase, puis le joueur "repond" avec une phrase a trous — il glisse
// les mots proposes dans les trous (a la souris, comme avant). Peu importe
// les mots choisis, la reaction est toujours la meme (secousse +
// rougissement), puis le PNJ disparait pour de bon.
//
// Maniement "instinctif" des mots : on peut les glisser (le trou vise
// s'illumine, et un mot lache pres d'un trou y est aspire), OU simplement
// cliquer dessus (il vole tout seul vers le 1er trou libre ; recliquer sur un
// mot pose le renvoie dans la liste). Chaque geste a son petit bip, qui monte
// d'une note a chaque trou rempli.
//
// Les PNJ apparaissent UN A LA FOIS : au depart seul le premier est la ; une
// fois son dialogue termine (il disparait), le suivant apparait. L'ordre est
// celui de la propriete Tiled "ordre" (optionnelle), a defaut de gauche a
// droite (position x sur la carte).
//
// Avancer d'une page de dialogue se fait au clic gauche une fois la page
// remplie : ce n'est pas un element du monde a survoler, juste "continuer".
//
// Format des proprietes Tiled (sur un objet du calque objets) :
//   - ligneNPJ (string, obligatoire) : la phrase du PNJ, et le marqueur "ceci
//     est un PNJ".
//   - intro (string, optionnel) : reponse courte automatique du joueur avant
//     la phrase a trous (ex. "Oui !").
//   - phrase (string) : la reponse du joueur, "{}" par trou. Un saut de ligne
//     coupe en "pages" (la suivante n'apparait qu'apres avoir rempli la page
//     courante ET clique).
//   - mots (string) : les mots a glisser, separes par des virgules, dans
//     l'ordre des trous (puis des pages).
//   - repliques (string, optionnel) : ce que le PNJ murmure, gene, selon le
//     mot que le joueur a place en dernier. Format : "mot: reponse | mot:
//     reponse" (ex. "froid: Tu dis ca bizarrement... | blanc: Pourquoi tu
//     parles comme ca ?"). Un mot sans replique, ou pas de propriete du tout :
//     replique generale au hasard (voir RepliquesGenerales).
//   - ordre (int, optionnel) : rang d'apparition (le plus petit d'abord ;
//     par defaut la position x, donc de gauche a droite).
//   - sprite (string, optionnel) : cle d'un personnage de SpritesPNJConnus
//     (par defaut le premier).
//   - frame (int, optionnel) : frame du spritesheet (par defaut 0).


// Spritesheets de PNJ que Phaser doit precharger. Ajouter une entree par
// nouveau personnage, puis referencer sa Cle via la propriete "sprite".

import { ChargerFeuille } from '../loading.js';
import { CleIconeInteraction, TailleIconeInteraction } from '../icone-interaction.js';
import { ConsommerClicSouris, EnregistrerInteractionSouris } from '../interaction-souris.js';
import { NomCoucheObjets, ValeurNombreTiled } from '../maps/cartes.js';
import { StyleTexteDeZone, StyleMotDialogue } from '../config.js';
import { JouerSonMotPris, JouerSonMotPose, JouerSonMotRefuse } from '../sons.js';

// Repliques de malaise quand aucune replique n'est ecrite pour le mot choisi.
// "{mot}" est remplace par le mot que le joueur a place.
const RepliquesGenerales = [
  '« {mot} » ? Tu dis ca bizarrement...',
  'Pourquoi tu parles comme ca ?',
  '« {mot} »... Euh... d\'accord.',
  'Personne ne dit « {mot} » comme ca...',
];

const SpritesPNJConnus = [
  { Cle: 'other_child', Chemin: 'assets/sprites/characters/other_child.png', LargeurFrame: 16, HauteurFrame: 16 },
];


export const DialoguePNJ = {
  nom: 'dialogue-pnj',

  precharger(Scene) {
    SpritesPNJConnus.forEach((p) => ChargerFeuille(Scene, p.Cle, p.Chemin, p.LargeurFrame, p.HauteurFrame));
  },

  installer(Scene, Ctx) {
    Scene.DialogueOuvert = false;
    Scene.PageDialogueEnAttente = false;
    CreerPNJs(Scene, Ctx.Carte);
    // Un seul PNJ visible au depart : le premier de la file.
    Scene.PNJs.forEach((PNJ, Index) => {
      PNJ.Sprite.setVisible(Index === 0);
    });
    // Clic ou glisser ? en dessous de ce deplacement (px ecran) c'est un clic.
    Scene.input.dragDistanceThreshold = 3;
    InstallerGlisserDeposer(Scene);

    // Interaction souris (voir interaction-souris.js) : cible = le PNJ
    // lui-meme (PNJ.Sprite), pas la petite icone. Un PNJ ne propose plus
    // rien une fois son dialogue termine, ni tant qu'un autre dialogue est
    // deja ouvert (un seul a la fois).
    Scene.PNJs.forEach((PNJ) => {
      EnregistrerInteractionSouris(Scene, {
        Zone: PNJ.Zone,
        Cible: PNJ.Sprite,
        Icone: PNJ.Icone,
        EstActive: () => PNJ === PNJActuel(Scene) && !Scene.DialogueOuvert,
        OnDeclenchement: () => OuvrirDialoguePNJ(Scene, PNJ),
      });
    });
  },

  miseAJour(Scene) {
    // Une page vient d'etre completee et il en reste : le clic affiche la suivante.
    // Pas un element du monde a survoler (juste "continuer").
    if (Scene.PageDialogueEnAttente && ConsommerClicSouris(Scene)) {
      AvancerPageDialogue(Scene);
    }
  },
};


// --- Creation des PNJ depuis Tiled --------------------------------

function CreerPNJs(Scene, Carte) {
  Scene.PNJs = [];
  const CoucheObjets = Carte.getObjectLayer(NomCoucheObjets);
  const Objets = CoucheObjets ? CoucheObjets.objects : [];

  Scene.PNJs = Objets
    .filter((Objet) => (Objet.properties || []).some((P) => P.name === 'ligneNPJ'))
    .map((Objet) => {
      const Lire = (Nom, Defaut) => {
        const Propriete = (Objet.properties || []).find((P) => P.name === Nom);
        return Propriete ? Propriete.value : Defaut;
      };

      const CleSprite = Lire('sprite', SpritesPNJConnus[0].Cle);
      const Frame = ValeurNombreTiled(Lire('frame', 0), 0);

      const Sprite = Scene.add.sprite(Objet.x, Objet.y, CleSprite, Frame);
      Sprite.setOrigin(0.5, 1);
      Sprite.setDepth(4);

      const Icone = Scene.add.sprite(Objet.x, Objet.y - Sprite.height - TailleIconeInteraction, CleIconeInteraction, 0);
      Icone.setDepth(20);
      Icone.setVisible(false);

      // "phrase" -> pages (separees par un saut de ligne). Sur chaque page,
      // "{}" = un trou. Les mots de "mots" sont distribues aux pages dans
      // l'ordre, un mot par trou.
      const Phrase = Lire('phrase', '');
      const MotsBruts = Lire('mots', '')
        .split(',')
        .map((Mot) => Mot.trim())
        .filter((Mot) => Mot.length > 0);

      let CurseurMots = 0;
      const Pages = Phrase.split('\n').map((LignePage) => {
        const Segments = [];
        LignePage.split('{}').forEach((Partie, Index, Tableau) => {
          Segments.push(Partie);
          if (Index < Tableau.length - 1) Segments.push(null); // null = trou
        });
        const NombreTrous = Segments.filter((S) => S === null).length;
        const Mots = MotsBruts.slice(CurseurMots, CurseurMots + NombreTrous);
        CurseurMots += NombreTrous;
        return { Segments, Mots };
      });

      return {
        Sprite,
        Icone,
        Zone: {
          XMin: Objet.x - 24,
          XMax: Objet.x + 24,
          YMin: Objet.y - Sprite.height - 16,
          YMax: Objet.y + 16,
        },
        Ordre: ValeurNombreTiled(Lire('ordre', Objet.x), Objet.x),
        Dialogue: {
          LigneNPJ: Lire('ligneNPJ', ''),
          Intro: Lire('intro', ''),
          Pages,
          Repliques: LireRepliques(Lire('repliques', '')),
        },
        Termine: false,
      };
    })
    .sort((A, B) => A.Ordre - B.Ordre);
}

// "mot: reponse | mot: reponse" -> { mot: reponse } (mots en minuscules).
function LireRepliques(Texte) {
  const Repliques = {};
  Texte.split('|').forEach((Morceau) => {
    const Coupure = Morceau.indexOf(':');
    if (Coupure === -1) return;
    const Mot = Morceau.slice(0, Coupure).trim().toLowerCase();
    const Reponse = Morceau.slice(Coupure + 1).trim();
    if (Mot && Reponse) Repliques[Mot] = Reponse;
  });
  return Repliques;
}

// Replique du PNJ pour le dernier mot place : celle ecrite dans Tiled, sinon
// une replique generale au hasard.
function ChoisirReplique(PNJ, Mot) {
  const Ecrite = Mot ? PNJ.Dialogue.Repliques[Mot.toLowerCase()] : null;
  if (Ecrite) return Ecrite;
  const General = RepliquesGenerales[Phaser.Math.Between(0, RepliquesGenerales.length - 1)];
  return General.replace('{mot}', Mot || '...');
}

// Le PNJ qu'on peut voir/interroger maintenant : le premier pas encore termine.
function PNJActuel(Scene) {
  return Scene.PNJs.find((PNJ) => !PNJ.Termine) || null;
}

// Le PNJ suivant surgit en grandissant (petit "pop" avec le meme bip que les
// mots poses). Rien s'il n'en reste plus.
function FaireApparaitrePNJSuivant(Scene) {
  const Suivant = PNJActuel(Scene);
  if (!Suivant) return;
  Suivant.Sprite.setVisible(true);
  Suivant.Sprite.setScale(0);
  Scene.tweens.add({ targets: Suivant.Sprite, scale: 1, duration: 350, ease: 'Back.easeOut' });
  JouerSonMotPose(2);
}


// --- Glisser-deposer des mots ------------------------------------
// Branche une seule fois au niveau de la scene : les objets glissables
// n'existent que pendant qu'un dialogue est ouvert, donc ces evenements
// n'ont rien a faire le reste du temps.

function InstallerGlisserDeposer(Scene) {
  Scene.input.on('dragstart', (Pointeur, Objet) => {
    Objet.EstGlisse = true;
    ArreterBalancementMot(Scene, Objet);
    Objet.setDepth(30); // au-dessus des autres mots pendant le geste
    Scene.tweens.add({ targets: Objet, scale: 1.3, angle: 6, duration: 90 });
    JouerSonMotPris();
  });

  Scene.input.on('drag', (Pointeur, Objet, X, Y) => {
    Objet.x = X;
    Objet.y = Y;
  });

  // Le trou survole s'illumine : on voit ou le mot va tomber.
  Scene.input.on('dragenter', (Pointeur, Objet, Trou) => {
    if (!Trou.MotDedans || Trou.MotDedans === Objet) StyleTrou(Trou, 'vise');
  });
  Scene.input.on('dragleave', (Pointeur, Objet, Trou) => StyleTrou(Trou));

  Scene.input.on('drop', (Pointeur, Objet, Trou) => {
    if (Trou.MotDedans && Trou.MotDedans !== Objet) {
      // Trou deja occupe : refuse, le mot revient d'ou il vient.
      StyleTrou(Trou);
      RenvoyerMot(Scene, Objet, Objet.PositionOrigineX, Objet.PositionOrigineY);
      JouerSonMotRefuse();
      return;
    }
    PlacerMotDansTrou(Scene, Objet, Trou);
  });

  Scene.input.on('dragend', (Pointeur, Objet, Depose) => {
    Objet.setDepth(25);
    if (Depose) return;
    // Lache dans le vide : s'il est pres d'un trou libre, il y est aspire
    // (pas besoin de viser au pixel) ; sinon il retourne a sa place.
    const Proche = TrouLibreLePlusProche(Scene, Objet, 16);
    if (Proche) PlacerMotDansTrou(Scene, Objet, Proche);
    else RenvoyerMot(Scene, Objet, Objet.PositionOrigineX, Objet.PositionOrigineY);
  });
}

// Etat visuel d'un trou : normal / vise (un mot est dessus) / rempli.
function StyleTrou(Trou, Etat) {
  if (Etat === 'vise') {
    Trou.setFillStyle(0xffe600, 0.45);
    Trou.setStrokeStyle(1, 0xffe600, 1);
  } else if (Trou.MotDedans) {
    Trou.setFillStyle(0xffffff, 0.05);
    Trou.setStrokeStyle(1, 0xffffff, 0.25);
  } else {
    Trou.setFillStyle(0xffffff, 0.15);
    Trou.setStrokeStyle(1, 0xffffff, 0.6);
  }
}

function CentreDuTrou(Trou) {
  // Trou a pour origine (0, 0.5) : x est son bord gauche.
  return { x: Trou.x + Trou.width / 2, y: Trou.y };
}

function TrouLibreLePlusProche(Scene, Mot, DistanceMax) {
  let Meilleur = null;
  let MeilleureDistance = DistanceMax;
  Scene.TrousDialogue.forEach((Trou) => {
    if (Trou.MotDedans && Trou.MotDedans !== Mot) return;
    const Centre = CentreDuTrou(Trou);
    const Distance = Phaser.Math.Distance.Between(Mot.x, Mot.y, Centre.x, Centre.y);
    if (Distance < MeilleureDistance) {
      Meilleur = Trou;
      MeilleureDistance = Distance;
    }
  });
  return Meilleur;
}

// Glisse le mot vers (X, Y), taille/inclinaison normales.
function RenvoyerMot(Scene, Mot, X, Y, ApresRetour) {
  Scene.tweens.add({
    targets: Mot, x: X, y: Y, scale: 1, angle: 0, duration: 140, ease: 'Cubic.easeOut',
    onComplete: ApresRetour,
  });
}

// Pose un mot dans un trou (libre, ou deja le sien) : petit "pop" + bip.
function PlacerMotDansTrou(Scene, Mot, Trou) {
  ArreterBalancementMot(Scene, Mot);
  if (Mot.EmplacementActuel && Mot.EmplacementActuel !== Trou) {
    Mot.EmplacementActuel.MotDedans = null; // libere l'ancien trou
    StyleTrou(Mot.EmplacementActuel);
  }
  const Centre = CentreDuTrou(Trou);
  Mot.setScrollFactor(1); // reste au bon endroit quand la camera bouge
  Mot.PositionOrigineX = Centre.x;
  Mot.PositionOrigineY = Centre.y;
  Trou.MotDedans = Mot;
  Mot.EmplacementActuel = Trou;
  StyleTrou(Trou);

  const Rang = Scene.TrousDialogue.filter((T) => T.MotDedans).length - 1;
  JouerSonMotPose(Rang);

  // Arrive en grossi puis se tasse sur le trou.
  Mot.setScale(1.35);
  Scene.tweens.add({
    targets: Mot, x: Centre.x, y: Centre.y, scale: 1, angle: 0,
    duration: 160, ease: 'Back.easeOut',
  });
  VerifierDialogueComplet(Scene);
}

// Clic simple sur un mot : s'il est dans un trou il retourne a la liste,
// sinon il vole vers le premier trou libre (dans l'ordre de lecture).
function ClicSurMot(Scene, Mot) {
  if (Mot.EmplacementActuel) {
    const Ancien = Mot.EmplacementActuel;
    Ancien.MotDedans = null;
    Mot.EmplacementActuel = null;
    StyleTrou(Ancien);
    Mot.PositionOrigineX = Mot.PositionListeX;
    Mot.PositionOrigineY = Mot.PositionListeY;
    RenvoyerMot(Scene, Mot, Mot.PositionListeX, Mot.PositionListeY, () => {
      if (!Mot.EmplacementActuel && Mot.active) BalancerMot(Scene, Mot, 0);
    });
    JouerSonMotPris();
    return;
  }
  const Libre = Scene.TrousDialogue.find((Trou) => !Trou.MotDedans);
  if (Libre) PlacerMotDansTrou(Scene, Mot, Libre);
  else JouerSonMotRefuse();
}

// Les mots de la liste se balancent doucement (angle) : ca donne envie de les
// attraper. Arrete des qu'on les touche.
function BalancerMot(Scene, Mot, Delai) {
  Mot.Balancement = Scene.tweens.add({
    targets: Mot, angle: { from: -3, to: 3 }, duration: 700, yoyo: true, repeat: -1,
    ease: 'Sine.easeInOut', delay: Delai,
  });
}
function ArreterBalancementMot(Scene, Mot) {
  if (Mot.Balancement) {
    Mot.Balancement.remove();
    Mot.Balancement = null;
  }
}


// --- Deroulement d'un dialogue ----------------------------------

// Gele le joueur (Scene.DialogueOuvert coupe le mouvement dans update()),
// affiche la ligne du PNJ, puis l'intro optionnelle, puis la 1ere page.
function OuvrirDialoguePNJ(Scene, PNJ) {
  Scene.DialogueOuvert = true;
  Scene.PNJActif = PNJ;
  Scene.FinDialogueProgrammee = false;
  Scene.MotsChoisis = []; // mots places par le joueur, dans l'ordre, toutes pages
  Scene.Personnage.body.setVelocity(0, 0);
  Scene.Personnage.body.enable = false;

  // Tout se passe dans le monde (pas une interface a l'ecran) : chaque texte
  // affiche a cote du personnage qui parle.
  Scene.ElementsDialogue = [];
  const Ajouter = (Objet) => {
    Objet.setDepth(25); // au-dessus de tout (herbe, tunnel, icones)
    Scene.ElementsDialogue.push(Objet);
    return Objet;
  };
  const CreerTexteMonde = (Texte, Style = StyleTexteDeZone) => {
    const T = Scene.add.text(0, 0, Texte, Style);
    T.texture.setFilter(Phaser.Textures.FilterMode.LINEAR); // sinon flou une fois zoome
    return Ajouter(T);
  };
  const Retirer = (Objet) => {
    Scene.ElementsDialogue = Scene.ElementsDialogue.filter((O) => O !== Objet);
    Scene.tweens.killTweensOf(Objet);
    Objet.destroy();
  };
  // Reutilises par AfficherPageDialogue / AvancerPageDialogue.
  Scene.AjouterElementDialogue = Ajouter;
  Scene.CreerTexteMondeDialogue = CreerTexteMonde;
  Scene.RetirerElementDialogue = Retirer;

  const LigneNPJ = CreerTexteMonde(PNJ.Dialogue.LigneNPJ);
  LigneNPJ.setOrigin(0.5, 1);
  LigneNPJ.setPosition(PNJ.Sprite.x, PNJ.Sprite.y - PNJ.Sprite.height - 6);

  Scene.YLigneJoueur = Scene.Personnage.y - 16;

  // Un seul element visible a la fois, comme une conversation qui s'enchaine.
  const DelaiAffichage = 900;
  Scene.time.delayedCall(DelaiAffichage, () => {
    Retirer(LigneNPJ);
    if (PNJ.Dialogue.Intro) {
      const LigneIntro = CreerTexteMonde(PNJ.Dialogue.Intro);
      LigneIntro.setOrigin(0.5, 1);
      LigneIntro.setPosition(Scene.Personnage.x, Scene.YLigneJoueur);
      Scene.time.delayedCall(DelaiAffichage, () => {
        Retirer(LigneIntro);
        AfficherPageDialogue(Scene, 0);
      });
    } else {
      AfficherPageDialogue(Scene, 0);
    }
  });
}

// Affiche une page : ses mots/trous en lignes au-dessus du joueur, ses mots a
// glisser en bas de l'ecran.
function AfficherPageDialogue(Scene, IndexPage) {
  const PNJ = Scene.PNJActif;
  const Page = PNJ.Dialogue.Pages[IndexPage];
  Scene.IndexPageDialogue = IndexPage;
  const Ajouter = Scene.AjouterElementDialogue;
  const CreerTexteMonde = Scene.CreerTexteMondeDialogue;

  Scene.TrousDialogue = [];
  const HauteurTrou = 8;
  const EspaceMot = 4;
  const HauteurLigne = 10;
  // worldView : rectangle monde reellement affiche (deja calcule par Phaser
  // avec le zoom/scroll) — plus fiable qu'un calcul a la main. Largeur max
  // fixe pour ne pas etirer la phrase sur un grand ecran.
  const Vue = Scene.cameras.main.worldView;
  const MaxLargeurLigne = Math.min(Vue.width - 20, 150);

  // Les etiquettes de mots sont creees des maintenant : le trou prend la
  // largeur du plus long mot, pour que n'importe quel mot y rentre.
  Scene.MotsDialogue = [];
  const MotsMelanges = Phaser.Utils.Array.Shuffle(Page.Mots.slice());
  const Tuiles = MotsMelanges.map((Mot) => {
    const Tuile = CreerTexteMonde(Mot, StyleMotDialogue);
    Tuile.setOrigin(0.5, 0.5);
    return Tuile;
  });
  const LargeurTrou = Math.max(18, ...Tuiles.map((T) => T.width + 4));

  // Chaque segment fixe est decoupe en mots -> retour a la ligne possible
  // n'importe ou.
  const Jetons = [];
  Page.Segments.forEach((Segment) => {
    if (Segment === null) {
      Jetons.push({ EstTrou: true });
    } else {
      Segment.split(' ')
        .filter((Mot) => Mot.length > 0)
        .forEach((Mot) => Jetons.push({ Texte: Mot }));
    }
  });

  const Elements = Jetons.map((Jeton) => {
    let Objet;
    let Largeur;
    if (Jeton.EstTrou) {
      Objet = Scene.add.rectangle(0, 0, LargeurTrou, HauteurTrou, 0xffffff, 0.15);
      Objet.setStrokeStyle(1, 0xffffff, 0.6);
      Objet.setInteractive({ dropZone: true });
      Objet.MotDedans = null;
      Largeur = LargeurTrou;
      Scene.TrousDialogue.push(Objet);
      Ajouter(Objet);
    } else {
      Objet = CreerTexteMonde(Jeton.Texte);
      Largeur = Objet.width;
    }
    Objet.setOrigin(0, 0.5);
    return { Objet, Largeur };
  });

  // Regroupe en lignes.
  const Lignes = [[]];
  let LargeurLigneCourante = 0;
  Elements.forEach((Element) => {
    const LigneActuelle = Lignes[Lignes.length - 1];
    const AvecEspace = LigneActuelle.length > 0 ? EspaceMot : 0;
    if (LigneActuelle.length > 0 && LargeurLigneCourante + AvecEspace + Element.Largeur > MaxLargeurLigne) {
      Lignes.push([Element]);
      LargeurLigneCourante = Element.Largeur;
    } else {
      LigneActuelle.push(Element);
      LargeurLigneCourante += AvecEspace + Element.Largeur;
    }
  });

  // Positionne chaque ligne, centree sur le joueur ; la derniere reste juste
  // au-dessus de sa tete, les precedentes remontent.
  Lignes.forEach((Ligne, IndexLigne) => {
    const LargeurLigne = Ligne.reduce((Somme, El, i) => Somme + El.Largeur + (i > 0 ? EspaceMot : 0), 0);
    let X = Scene.Personnage.x - LargeurLigne / 2;
    const Y = Scene.YLigneJoueur - (Lignes.length - 1 - IndexLigne) * HauteurLigne;
    Ligne.forEach((Element, i) => {
      if (i > 0) X += EspaceMot;
      Element.Objet.setPosition(X, Y);
      X += Element.Largeur;
    });
  });
  // Garde uniquement la ligne du joueur (pour la secousse de fin).
  Scene.ElementsLigneJoueur = Elements.map(({ Objet }) => Objet);

  // Mots a glisser : liste horizontale centree, en bas de la zone visible
  // (etiquettes deja creees plus haut, StyleMotDialogue ajoute un fond + une marge).
  const PaddingMots = 6;
  const YMots = Vue.bottom - 14;
  const LargeurTotaleMots = Tuiles.reduce((Somme, T, i) => Somme + T.width + (i > 0 ? PaddingMots : 0), 0);
  let XMot = Vue.centerX - LargeurTotaleMots / 2;

  Tuiles.forEach((Tuile) => {
    Tuile.setPosition(XMot + Tuile.width / 2, YMots);
    Tuile.PositionOrigineX = Tuile.x;
    Tuile.PositionOrigineY = Tuile.y;
    Tuile.PositionListeX = Tuile.x; // place fixe dans la liste (PositionOrigine suit le trou)
    Tuile.PositionListeY = Tuile.y;
    Tuile.EmplacementActuel = null;
    Tuile.setInteractive({ draggable: true, useHandCursor: true });
    Scene.input.setDraggable(Tuile);
    // Survol : le mot grossit un peu ("attrape-moi") ; clic sans glisser :
    // il vole tout seul au bon endroit (voir ClicSurMot).
    Tuile.on('pointerover', () => {
      if (!Tuile.EstGlisse) Scene.tweens.add({ targets: Tuile, scale: 1.15, duration: 80 });
    });
    Tuile.on('pointerout', () => {
      if (!Tuile.EstGlisse) Scene.tweens.add({ targets: Tuile, scale: 1, duration: 80 });
    });
    Tuile.on('pointerdown', () => { Tuile.EstGlisse = false; });
    Tuile.on('pointerup', () => {
      if (Tuile.EstGlisse) { Tuile.EstGlisse = false; return; }
      ClicSurMot(Scene, Tuile);
    });
    BalancerMot(Scene, Tuile, Scene.MotsDialogue.length * 120);
    Scene.MotsDialogue.push(Tuile);
    XMot += Tuile.width + PaddingMots;
  });

  // Page sans trou (juste du texte) : rien ne declenchera VerifierDialogueComplet
  // via un depot, on le fait tout de suite.
  VerifierDialogueComplet(Scene);
}

// E quand Scene.PageDialogueEnAttente : detruit la page en cours et affiche
// la suivante.
function AvancerPageDialogue(Scene) {
  Scene.PageDialogueEnAttente = false;
  Scene.RetirerElementDialogue(Scene.IndicateurAvanceeDialogue);
  Scene.IndicateurAvanceeDialogue = null;
  NoterMotsChoisis(Scene);
  [...Scene.ElementsLigneJoueur, ...Scene.MotsDialogue].forEach((Objet) => Scene.RetirerElementDialogue(Objet));
  AfficherPageDialogue(Scene, Scene.IndexPageDialogue + 1);
}

// Ajoute les mots poses dans les trous de la page en cours a Scene.MotsChoisis.
function NoterMotsChoisis(Scene) {
  Scene.TrousDialogue.forEach((Trou) => {
    if (Trou.MotDedans) Scene.MotsChoisis.push(Trou.MotDedans.text);
  });
}

// Tous les trous remplis ? Si oui : page suivante (E) s'il en reste, sinon on
// termine apres un court instant. Peu importe les mots : rien a valider.
function VerifierDialogueComplet(Scene) {
  if (!Scene.TrousDialogue.every((Trou) => Trou.MotDedans !== null)) return;

  const DernierePage = Scene.IndexPageDialogue >= Scene.PNJActif.Dialogue.Pages.length - 1;
  if (!DernierePage) {
    Scene.PageDialogueEnAttente = true;
    // Le clic qui vient de remplir le dernier trou ne doit pas aussi "continuer".
    Scene.SourisVientDeCliquer = false;
    const Dernier = Scene.ElementsLigneJoueur[Scene.ElementsLigneJoueur.length - 1];
    const Indicateur = Scene.CreerTexteMondeDialogue(' ▶'); // petit triangle "continuer"
    Indicateur.setOrigin(0, 0.5);
    Indicateur.setPosition(Dernier.x + Dernier.width, Scene.YLigneJoueur);
    Scene.IndicateurAvanceeDialogue = Indicateur;
    return;
  }

  // Une seule reaction, et les mots ne bougent plus : sinon re-cliquer un mot
  // pendant ce court delai relancerait la verification (double reaction).
  if (Scene.FinDialogueProgrammee) return;
  Scene.FinDialogueProgrammee = true;
  Scene.MotsDialogue.forEach((Mot) => Mot.disableInteractive());
  Scene.time.delayedCall(600, () => {
    if (Scene.DialogueOuvert) JouerReactionFinDialogue(Scene);
  });
}

// Le PNJ est mal a l'aise : le joueur lui parait bizarre, quoi qu'il ait
// repondu (c'est le point du jeu — le joueur est "different"). La reponse du
// joueur s'estompe, le PNJ recule d'un pas et une bulle "..." puis une
// replique (selon le mot choisi) apparait ; ensuite tout disparait — la phrase, les mots, la bulle et le PNJ
// lui-meme. PNJ.Termine reste vrai pour toujours.
function JouerReactionFinDialogue(Scene) {
  const PNJ = Scene.PNJActif;
  const ElementsJoueur = [...Scene.ElementsLigneJoueur, ...Scene.MotsDialogue];
  // Stoppe balancements/pops en cours, puis la phrase du joueur s'estompe
  // (le silence gene).
  ElementsJoueur.forEach((Objet) => {
    Scene.tweens.killTweensOf(Objet);
    Objet.setAngle(0);
    Objet.setScale(1);
  });
  Scene.tweens.add({ targets: ElementsJoueur, alpha: 0.4, duration: 300 });

  // Recule d'un pas, a l'oppose du joueur.
  const Sens = PNJ.Sprite.x >= Scene.Personnage.x ? 1 : -1;
  const Recul = 8;
  Scene.tweens.add({ targets: PNJ.Sprite, x: PNJ.Sprite.x + Sens * Recul, duration: 250, ease: 'Sine.easeOut' });

  // Bulle de malaise au-dessus du PNJ : d'abord "...", puis sa replique selon
  // le DERNIER mot que le joueur a place.
  NoterMotsChoisis(Scene);
  const Replique = ChoisirReplique(PNJ, Scene.MotsChoisis[Scene.MotsChoisis.length - 1]);
  const Bulle = Scene.CreerTexteMondeDialogue('...');
  Bulle.setOrigin(0.5, 1);
  Bulle.setPosition(PNJ.Sprite.x + Sens * Recul, PNJ.Sprite.y - PNJ.Sprite.height - 6);
  Scene.time.delayedCall(700, () => {
    if (!Bulle.active) return;
    Bulle.setWordWrapWidth(120);
    Bulle.setAlign('center');
    Bulle.setText(Replique);
  });

  // Le temps de lire la replique (plus elle est longue, plus on attend).
  const DureeReaction = Math.max(1600, 700 + 50 * Replique.length);
  Scene.time.delayedCall(DureeReaction, () => {
    Scene.ElementsDialogue.forEach((Objet) => {
      Scene.tweens.killTweensOf(Objet);
      Objet.destroy();
    });
    PNJ.Sprite.destroy();
    PNJ.Icone.destroy();
    PNJ.Termine = true;

    Scene.ElementsDialogue = [];
    Scene.ElementsLigneJoueur = [];
    Scene.TrousDialogue = [];
    Scene.MotsDialogue = [];
    Scene.DialogueOuvert = false;
    Scene.PageDialogueEnAttente = false;
    Scene.PNJActif = null;
    Scene.Personnage.body.enable = true;

    FaireApparaitrePNJSuivant(Scene);
  });
}
