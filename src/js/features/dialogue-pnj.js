// features/dialogue-pnj.js — mini-jeu de dialogue avec les PNJ.
//
// Chaque PNJ est defini depuis Tiled (un objet sur le calque objets, avec une
// propriete "ligneNPJ"). Le joueur s'approche, appuie sur E : le PNJ dit sa
// phrase, puis le joueur "repond" avec une phrase a trous — il glisse les
// mots proposes dans les trous. Peu importe les mots choisis, la reaction est
// toujours la meme (secousse + rougissement), puis le PNJ disparait pour de
// bon.
//
// Format des proprietes Tiled (sur un objet du calque objets) :
//   - ligneNPJ (string, obligatoire) : la phrase du PNJ, et le marqueur "ceci
//     est un PNJ".
//   - intro (string, optionnel) : reponse courte automatique du joueur avant
//     la phrase a trous (ex. "Oui !").
//   - phrase (string) : la reponse du joueur, "{}" par trou. Un saut de ligne
//     coupe en "pages" (la suivante n'apparait qu'apres avoir rempli la page
//     courante ET appuye sur E).
//   - mots (string) : les mots a glisser, separes par des virgules, dans
//     l'ordre des trous (puis des pages).
//   - sprite (string, optionnel) : cle d'un personnage de SpritesPNJConnus
//     (par defaut le premier).
//   - frame (int, optionnel) : frame du spritesheet (par defaut 0).


// Spritesheets de PNJ que Phaser doit precharger. Ajouter une entree par
// nouveau personnage, puis referencer sa Cle via la propriete "sprite".
const SpritesPNJConnus = [
  { Cle: 'other_child', Chemin: 'assets/sprites/characters/other_child.png', LargeurFrame: 16, HauteurFrame: 16 },
];


const DialoguePNJ = {
  nom: 'dialogue-pnj',

  precharger(Scene) {
    SpritesPNJConnus.forEach((p) => ChargerFeuille(Scene, p.Cle, p.Chemin, p.LargeurFrame, p.HauteurFrame));
  },

  installer(Scene, Ctx) {
    Scene.DialogueOuvert = false;
    Scene.PageDialogueEnAttente = false;
    CreerPNJs(Scene, Ctx.Carte);
    InstallerGlisserDeposer(Scene);
  },

  miseAJour(Scene) {
    // Icone qui suit + E pour lancer. Aucun PNJ ne reagit si un dialogue est
    // deja ouvert.
    if (Scene.PNJs && !Scene.DialogueOuvert) {
      Scene.PNJs.forEach((PNJ) => {
        // Termine : deja repondu. EnAttenteOuverture : E vient d'etre presse,
        // l'anim "iconePressee" joue — verrou immediat, sinon la ligne
        // "play('iconeAttente', true)" ci-dessous la relancerait chaque frame
        // et le dialogue ne s'ouvrirait jamais.
        if (PNJ.Termine || PNJ.EnAttenteOuverture) return;

        const DansZone =
          Scene.Personnage.x > PNJ.Zone.XMin &&
          Scene.Personnage.x < PNJ.Zone.XMax &&
          Scene.Personnage.y > PNJ.Zone.YMin &&
          Scene.Personnage.y < PNJ.Zone.YMax;

        if (!DansZone) {
          PNJ.Icone.setVisible(false);
          return;
        }

        PNJ.Icone.setVisible(true);
        PNJ.Icone.play('iconeAttente', true);

        if (Phaser.Input.Keyboard.JustDown(Scene.ToucheInteraction)) {
          PNJ.EnAttenteOuverture = true;
          PNJ.Icone.play('iconePressee');
          PNJ.Icone.once('animationcomplete', () => {
            PNJ.Icone.setVisible(false);
            OuvrirDialoguePNJ(Scene, PNJ);
          });
        }
      });
    }

    // Une page vient d'etre completee et il en reste : E affiche la suivante.
    if (Scene.PageDialogueEnAttente && Phaser.Input.Keyboard.JustDown(Scene.ToucheInteraction)) {
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
        Dialogue: { LigneNPJ: Lire('ligneNPJ', ''), Intro: Lire('intro', ''), Pages },
        Termine: false,
        EnAttenteOuverture: false,
      };
    });
}


// --- Glisser-deposer des mots ------------------------------------
// Branche une seule fois au niveau de la scene : les objets glissables
// n'existent que pendant qu'un dialogue est ouvert, donc ces evenements
// n'ont rien a faire le reste du temps.

function InstallerGlisserDeposer(Scene) {
  Scene.input.on('drag', (Pointeur, Objet, X, Y) => {
    Objet.x = X;
    Objet.y = Y;
  });

  Scene.input.on('drop', (Pointeur, Objet, Trou) => {
    if (Trou.MotDedans && Trou.MotDedans !== Objet) {
      // Trou deja occupe : refuse, le mot revient d'ou il vient.
      Objet.setPosition(Objet.PositionOrigineX, Objet.PositionOrigineY);
      return;
    }
    if (Objet.EmplacementActuel && Objet.EmplacementActuel !== Trou) {
      Objet.EmplacementActuel.MotDedans = null; // libere l'ancien trou
    }
    // Le mot vient d'une liste posee en coordonnees monde (voir
    // AfficherPageDialogue) ; setScrollFactor(1) au cas ou, pour qu'il reste
    // au bon endroit quand la camera bouge.
    Objet.setScrollFactor(1);
    // Trou a pour origine (0, 0.5) : Trou.x est son bord gauche -> + largeur/2
    // pour centrer le mot (origine 0.5, 0.5).
    const CentreX = Trou.x + Trou.width / 2;
    Objet.setPosition(CentreX, Trou.y);
    Objet.PositionOrigineX = CentreX;
    Objet.PositionOrigineY = Trou.y;
    Trou.MotDedans = Objet;
    Objet.EmplacementActuel = Trou;
    VerifierDialogueComplet(Scene);
  });

  Scene.input.on('dragend', (Pointeur, Objet, Depose) => {
    if (!Depose) Objet.setPosition(Objet.PositionOrigineX, Objet.PositionOrigineY);
  });
}


// --- Deroulement d'un dialogue ----------------------------------

// Gele le joueur (Scene.DialogueOuvert coupe le mouvement dans update()),
// affiche la ligne du PNJ, puis l'intro optionnelle, puis la 1ere page.
function OuvrirDialoguePNJ(Scene, PNJ) {
  Scene.DialogueOuvert = true;
  Scene.PNJActif = PNJ;
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
  const LargeurTrou = 18;
  const HauteurTrou = 8;
  const EspaceMot = 4;
  const HauteurLigne = 10;
  // worldView : rectangle monde reellement affiche (deja calcule par Phaser
  // avec le zoom/scroll) — plus fiable qu'un calcul a la main. Largeur max
  // fixe pour ne pas etirer la phrase sur un grand ecran.
  const Vue = Scene.cameras.main.worldView;
  const MaxLargeurLigne = Math.min(Vue.width - 20, 150);

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

  // Mots a glisser : liste horizontale centree, en bas de la zone visible.
  Scene.MotsDialogue = [];
  const MotsMelanges = Phaser.Utils.Array.Shuffle(Page.Mots.slice());
  const PaddingMots = 6;
  const YMots = Vue.bottom - 14;

  // Cree d'abord toutes les etiquettes pour connaitre leur largeur reelle
  // (StyleMotDialogue ajoute un fond + une marge), puis les repartit centrees.
  const Tuiles = MotsMelanges.map((Mot) => {
    const Tuile = CreerTexteMonde(Mot, StyleMotDialogue);
    Tuile.setOrigin(0.5, 0.5);
    return Tuile;
  });
  const LargeurTotaleMots = Tuiles.reduce((Somme, T, i) => Somme + T.width + (i > 0 ? PaddingMots : 0), 0);
  let XMot = Vue.centerX - LargeurTotaleMots / 2;

  Tuiles.forEach((Tuile) => {
    Tuile.setPosition(XMot + Tuile.width / 2, YMots);
    Tuile.PositionOrigineX = Tuile.x;
    Tuile.PositionOrigineY = Tuile.y;
    Tuile.EmplacementActuel = null;
    Tuile.setInteractive({ draggable: true, useHandCursor: true });
    Scene.input.setDraggable(Tuile);
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
  [...Scene.ElementsLigneJoueur, ...Scene.MotsDialogue].forEach((Objet) => Scene.RetirerElementDialogue(Objet));
  AfficherPageDialogue(Scene, Scene.IndexPageDialogue + 1);
}

// Tous les trous remplis ? Si oui : page suivante (E) s'il en reste, sinon on
// termine apres un court instant. Peu importe les mots : rien a valider.
function VerifierDialogueComplet(Scene) {
  if (!Scene.TrousDialogue.every((Trou) => Trou.MotDedans !== null)) return;

  const DernierePage = Scene.IndexPageDialogue >= Scene.PNJActif.Dialogue.Pages.length - 1;
  if (!DernierePage) {
    Scene.PageDialogueEnAttente = true;
    const Dernier = Scene.ElementsLigneJoueur[Scene.ElementsLigneJoueur.length - 1];
    const Indicateur = Scene.CreerTexteMondeDialogue(' ▶'); // petit triangle "continuer"
    Indicateur.setOrigin(0, 0.5);
    Indicateur.setPosition(Dernier.x + Dernier.width, Scene.YLigneJoueur);
    Scene.IndicateurAvanceeDialogue = Indicateur;
    return;
  }

  Scene.time.delayedCall(600, () => {
    if (Scene.DialogueOuvert) JouerReactionFinDialogue(Scene);
  });
}

// La reponse du joueur tremble et rougit un instant, puis tout disparait — la
// phrase, les mots, la ligne du PNJ et le PNJ lui-meme. PNJ.Termine reste vrai
// pour toujours.
function JouerReactionFinDialogue(Scene) {
  const PNJ = Scene.PNJActif;
  const ElementsSecoues = [...Scene.ElementsLigneJoueur, ...Scene.MotsDialogue];
  const PositionsInitiales = ElementsSecoues.map((Objet) => ({ x: Objet.x, y: Objet.y }));

  ElementsSecoues.forEach((Objet) => {
    if (Objet.setColor) Objet.setColor('#ff0000');
  });

  const DureeSecousse = 500;
  const Intensite = 2;
  const MinuteurSecousse = Scene.time.addEvent({
    delay: 40,
    loop: true,
    callback: () => {
      const DecalageX = Phaser.Math.Between(-Intensite, Intensite);
      const DecalageY = Phaser.Math.Between(-Intensite, Intensite);
      ElementsSecoues.forEach((Objet, Index) => {
        Objet.x = PositionsInitiales[Index].x + DecalageX;
        Objet.y = PositionsInitiales[Index].y + DecalageY;
      });
    },
  });

  Scene.time.delayedCall(DureeSecousse, () => {
    MinuteurSecousse.remove();
    Scene.ElementsDialogue.forEach((Objet) => Objet.destroy());
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
  });
}
