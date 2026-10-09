// interaction-souris.js — survol + clic souris pour TOUTES les interactions
// du jeu (gare, portails, PNJ, tele), a la place de la touche E.
//
// Avant : chaque feature gerait elle-meme sa zone de portee + son icone "E" +
// sa propre lecture de Phaser.Input.Keyboard.JustDown(...). Deux bugs de
// suite (portails, puis gare/PNJ face a l'ecran de mort glitch2) venaient du
// meme piege : JustDown() consomme l'appui touche des le 1er appel de la
// frame, donc plusieurs lecteurs independants se le "volaient" les uns aux
// autres. Centraliser ici la lecture de la souris (une seule fois par
// frame, ici et nulle part ailleurs) evite structurellement ce risque.
//
// Une feature enregistre chaque point interactif pendant installer(), avec :
//   - Zone     : plus une histoire de "portee" (voir plus bas) — sert de
//                point de rendez-vous : son centre est la ou le joueur va
//                marcher tout seul quand on declenche l'interaction.
//   - Cible    : ce que la souris doit survoler pour declencher — le SPRITE
//                visible en jeu (le train de la gare, le PNJ, l'ecran de
//                tele...), pas la petite icone "E". Pour un sprite, seuls
//                ses pixels visibles sont cliquables ; un rectangle reste
//                disponible pour les interactions sans sprite dedie.
//                Accepte un GameObject (son getBounds() sert de zone de
//                survol) ou directement un rectangle {XMin,XMax,YMin,YMax}
//                pour les interactions sans sprite dedie (ex: un portail).
//   - Icone    : le sprite "E" deja pose (CreerIconeInteraction) — purement
//                visuel desormais (l'invite qui apparait/s'anime), il ne
//                sert plus a detecter le survol.
//   - OnDeclenchement : rappelle quoi faire une fois l'anim "E qui eclate" finie
//   - EstActive (optionnel) : d'autres conditions a verifier avant de
//                proposer l'interaction (ex: la gare n'est utilisable que
//                dans l'etat 'attente') — par defaut toujours active
//   - EchelleSurvol (optionnel, 1 par defaut) : retrecit la zone de survol
//                des rectangles ; les sprites utilisent directement leurs
//                pixels opaques.
//
// Ce module se charge ensuite, une fois par frame pour tout le monde, de :
// trouver quel point est survole (peu importe la distance du joueur — seule
// la souris compte), afficher son icone, et au clic gauche envoyer le joueur
// marcher automatiquement jusqu'au centre de Zone (voir auto-marche.js) avant
// de jouer l'anim "E qui eclate" puis OnDeclenchement.

import { DemarrerAutoMarche, AfficherRepereDestination } from './auto-marche.js';
import { PointMondeSouris } from './camera-separee.js';

// Marge (px monde) ajoutee autour de la cible pour le survol — confortable
// meme pour les cibles deja petites (un PNJ, un portail sans sprite dedie).
const MargeSurvol = 4;

// Tremblement au survol (px monde) : l'indice visuel "c'est cliquable", en
// plus du curseur "main" — meme intensite que Secouer() ailleurs dans le jeu
// (gare/tele), pour rester dans le meme langage visuel. Phaser.Math.Between
// arrondit a l'entier (pas fait pour des bornes fractionnaires) : une valeur
// sous 1 donne un tremblement irregulier plutot que subtil, garder 1.
const IntensiteTremblementSurvol = 1;

export function InstallerInteractionSouris(Scene) {
  Scene.InteractionsSouris = [];
  Scene.SourisVientDeCliquer = false;
  Scene.ToucheEVientDAppuyer = false;

  // Le joueur 2 (clavier) interagit avec E, comme le joueur 1 le fait au clic :
  // meme principe d'evenement (voir ci-dessous) pour ne jamais rater un appui.
  Scene.input.keyboard.on('keydown-E', () => {
    Scene.ToucheEVientDAppuyer = true;
  });

  // Evenement plutot que lecture au vol : un clic est instantane (down puis
  // souvent up dans la meme frame ou la suivante), le lire via un evenement
  // garantit qu'on ne le rate jamais, quelle que soit la duree de l'appui.
  //
  // Deux sortes de clics, selon qu'on maintient Ctrl (ou Cmd sur Mac) :
  //   - sans touche : clic "normal" = marcher / interagir (le reste de ce fichier) ;
  //   - avec Ctrl ou Cmd : clic de TIR = on envoie un projectile a l'endroit
  //     clique (voir features/tir.js). On retient le point d'ecran du clic.
  // (Ctrl + clic est un clic droit sur Mac : on accepte donc aussi le bouton
  // droit quand Ctrl est maintenu.)
  Scene.TirDemande = null;
  Scene.input.on('pointerdown', (Pointeur) => {
    const Evenement = Pointeur.event;
    const ModificateurTir = !!Evenement && (Evenement.ctrlKey || Evenement.metaKey);
    if (ModificateurTir) {
      if (Pointeur.leftButtonDown() || Pointeur.rightButtonDown()) {
        Scene.TirDemande = { EcranX: Pointeur.x, EcranY: Pointeur.y };
      }
      return;
    }
    if (Pointeur.leftButtonDown()) Scene.SourisVientDeCliquer = true;
  });
}

// Permet aux autres features de consommer le meme clic que les interactions
// du monde, par exemple pour avancer un dialogue ou fermer un ecran.
export function ConsommerClicSouris(Scene) {
  if (!Scene.SourisVientDeCliquer) return false;
  Scene.SourisVientDeCliquer = false;
  return true;
}

export function EnregistrerInteractionSouris(Scene, { Zone, Cible, Icone, OnDeclenchement, EstActive, EchelleSurvol, PourJoueur2 }) {
  Scene.InteractionsSouris.push({
    Zone,
    Cible,
    Icone,
    OnDeclenchement,
    EstActive: EstActive || (() => true),
    EchelleSurvol: EchelleSurvol || 1,
    PourJoueur2: !!PourJoueur2, // le joueur clavier peut-il aussi la declencher (touche E dans Zone) ?
    EnCours: false, // verrou pendant l'anim "E qui eclate", entre le clic et OnDeclenchement
  });
}

// true si `Objet` est un GameObject Phaser (a un getBounds()) qui a ete
// detruit (Phaser vide sa reference `.scene` a la destruction). Un simple
// rectangle {XMin,...} n'a jamais de getBounds -> jamais "detruit".
function EstDetruit(Objet) {
  return typeof Objet.getBounds === 'function' && !Objet.scene;
}

// Rectangle de survol d'une interaction sans sprite dedie. Pour un sprite,
// le rectangle sert seulement de filtre rapide avant le test des pixels.
function BornesSurvol(Cible) {
  return new Phaser.Geom.Rectangle(Cible.XMin, Cible.YMin, Cible.XMax - Cible.XMin, Cible.YMax - Cible.YMin);
}

function BornesCible(Cible) {
  return typeof Cible.getBounds === 'function' ? Cible.getBounds() : BornesSurvol(Cible);
}

// Phaser.Textures.Texture n'a pas de methode getPixel/getPixelAlpha dans
// cette version (verifie a l'usage) : on lit l'alpha nous-memes, une fois
// par texture, en dessinant l'image source sur un canvas cache — pas a
// chaque frame (couteux), juste au 1er survol de chaque sprite/texture.
const CacheImageDataParTexture = new Map();

function ImageDataDeTexture(Cle, Image) {
  if (CacheImageDataParTexture.has(Cle)) return CacheImageDataParTexture.get(Cle);

  let Donnees = null;
  try {
    const Canvas = document.createElement('canvas');
    Canvas.width = Image.width;
    Canvas.height = Image.height;
    const Contexte = Canvas.getContext('2d');
    Contexte.drawImage(Image, 0, 0);
    Donnees = Contexte.getImageData(0, 0, Image.width, Image.height);
  } catch (Erreur) {
    Donnees = null; // image inutilisable (canvas "tainted"...) : jamais bloquant
  }
  CacheImageDataParTexture.set(Cle, Donnees);
  return Donnees;
}

// Verifie le pixel reel du sprite, pas le cadre transparent de son image.
// Les sprites du jeu ne sont pas tournes, donc getBounds() suffit pour
// convertir le point monde en coordonnees du frame, y compris avec flipX.
function PixelVisible(Cible, PointMonde) {
  if (typeof Cible.getBounds !== 'function') return true;
  const Bornes = Cible.getBounds();
  if (!Phaser.Geom.Rectangle.Contains(Bornes, PointMonde.x, PointMonde.y)) return false;

  const Frame = Cible.frame;
  if (!Frame || !Cible.texture) return true;

  const Donnees = ImageDataDeTexture(Cible.texture.key, Cible.texture.getSourceImage());
  if (!Donnees) return true; // pas de lecture possible : jamais bloquant

  // Coordonnees dans le frame (0..largeur/hauteur du dessin affiche)...
  let PixelX = Math.floor((PointMonde.x - Bornes.left) / Bornes.width * Frame.width);
  const PixelY = Math.floor((PointMonde.y - Bornes.top) / Bornes.height * Frame.height);
  if (Cible.flipX) PixelX = Frame.width - 1 - PixelX;
  if (PixelX < 0 || PixelX >= Frame.width || PixelY < 0 || PixelY >= Frame.height) return false;

  // ...puis dans l'image source complete (le frame est un decoupage dedans).
  const XSource = Frame.cutX + PixelX;
  const YSource = Frame.cutY + PixelY;
  const IndexAlpha = (YSource * Donnees.width + XSource) * 4 + 3;
  return Donnees.data[IndexAlpha] > 0;
}

// Retrecit `Rect` autour de son propre centre (1 = inchange, 0.5 = moitie
// moins large/haute). Modifie `Rect` en place, comme Phaser.Geom.Rectangle.Inflate.
function RetrecirSurCentre(Rect, Echelle) {
  if (Echelle === 1) return Rect;
  const CentreX = Rect.centerX;
  const CentreY = Rect.centerY;
  Rect.width *= Echelle;
  Rect.height *= Echelle;
  Rect.x = CentreX - Rect.width / 2;
  Rect.y = CentreY - Rect.height / 2;
  return Rect;
}

// Objet qui tremble au survol : la Cible elle-meme si c'est un sprite reel
// (le train, le PNJ, l'ecran de tele), sinon l'icone (un portail n'a pas de
// sprite dedie — seule l'icone est visible au survol, donc c'est elle qui
// tremble).
function ObjetTremblant(Interaction) {
  return typeof Interaction.Cible.getBounds === 'function' ? Interaction.Cible : Interaction.Icone;
}

// Petit tremblement continu tant que la souris survole un element cliquable
// — memorise sa position d'origine au 1er appel pour trembler AUTOUR d'elle,
// jamais en s'en eloignant petit a petit.
function AppliquerTremblement(Interaction) {
  const Objet = ObjetTremblant(Interaction);
  if (Interaction.PositionTremblementX === undefined) {
    Interaction.PositionTremblementX = Objet.x;
    Interaction.PositionTremblementY = Objet.y;
  }
  Objet.x = Interaction.PositionTremblementX + Phaser.Math.Between(-IntensiteTremblementSurvol, IntensiteTremblementSurvol);
  Objet.y = Interaction.PositionTremblementY + Phaser.Math.Between(-IntensiteTremblementSurvol, IntensiteTremblementSurvol);
}

// Fin du survol (ou de l'interaction) : remet l'objet EXACTEMENT a sa
// position d'origine, pas juste "arrete de bouger" ou il resterait decale.
function ArreterTremblement(Interaction) {
  if (Interaction.PositionTremblementX === undefined) return;
  const Objet = ObjetTremblant(Interaction);
  Objet.x = Interaction.PositionTremblementX;
  Objet.y = Interaction.PositionTremblementY;
  Interaction.PositionTremblementX = undefined;
  Interaction.PositionTremblementY = undefined;
}

// A appeler une fois par frame (scene-jeu.js). Gele tout (rien de survole,
// curseur normal) pendant un voyage en train, un dialogue, l'ecran de mort
// glitch2 — comme le mouvement du joueur dans scene-jeu.js. Un clic sur
// l'element survole l'active ; un clic dans le vide fait simplement marcher le
// joueur jusque-la (voir la fin de cette fonction).
export function MettreAJourInteractionsSouris(Scene) {
  const Clic = Scene.SourisVientDeCliquer;
  Scene.SourisVientDeCliquer = false; // consomme ici, une seule fois, pour tout le monde
  const AppuiE = Scene.ToucheEVientDAppuyer;
  Scene.ToucheEVientDAppuyer = false;

  // Mode tir (Ctrl / Cmd maintenu, voir features/tir.js) : on ne survole plus
  // les elements du monde, la souris sert a viser.
  const Fige =
    Scene.EtatGare === 'enCours' || Scene.DialogueOuvert || !!Scene.GlitchEtatFin || !!Scene.ModeTir;
  if (Fige) {
    Scene.InteractionsSouris.forEach((Interaction) => {
      if (Interaction.EnCours || EstDetruit(Interaction.Icone) || EstDetruit(Interaction.Cible)) return;
      Interaction.Icone.setVisible(false);
      ArreterTremblement(Interaction);
    });
    Scene.game.canvas.style.cursor = Scene.ModeTir ? 'crosshair' : 'default';
    return;
  }

  // L'endroit du monde sous la souris, vu par la camera sous la souris (voir
  // camera-separee.js : l'ecran peut etre separe en deux).
  const PointMonde = PointMondeSouris(Scene);
  let SurvolTrouve = false;
  let ClicUtilise = false; // le clic a-t-il active un element ? sinon il sert a marcher

  for (const Interaction of Scene.InteractionsSouris) {
    // L'icone ou sa cible peuvent avoir ete detruites pour de bon (ex: un
    // PNJ dont le dialogue est termine, voir dialogue-pnj.js) : plus rien a
    // faire pour cette interaction.
    if (EstDetruit(Interaction.Icone) || EstDetruit(Interaction.Cible)) continue;
    if (Interaction.EnCours) continue; // anim "E qui eclate" deja en cours : ne pas y toucher
    if (!Interaction.EstActive()) {
      Interaction.Icone.setVisible(false);
      ArreterTremblement(Interaction);
      continue;
    }

    const Bornes = BornesCible(Interaction.Cible);
    if (typeof Interaction.Cible.getBounds === 'function') {
      if (!PixelVisible(Interaction.Cible, PointMonde)) {
        Interaction.Icone.setVisible(false);
        ArreterTremblement(Interaction);
        continue;
      }
    } else {
      RetrecirSurCentre(Bornes, Interaction.EchelleSurvol);
    }
    Phaser.Geom.Rectangle.Inflate(Bornes, MargeSurvol, MargeSurvol);
    const Survolee = Phaser.Geom.Rectangle.Contains(Bornes, PointMonde.x, PointMonde.y);
    if (!Survolee) {
      Interaction.Icone.setVisible(false);
      ArreterTremblement(Interaction);
      continue;
    }

    SurvolTrouve = true;
    Interaction.Icone.setVisible(true);
    Interaction.Icone.play('iconeAttente', true); // true : ne relance pas si deja en cours
    AppliquerTremblement(Interaction); // indice visuel "c'est cliquable"

    if (Clic) {
      ClicUtilise = true;
      ArreterTremblement(Interaction); // remis a sa place avant de jouer la sequence de clic
      Interaction.EnCours = true;
      // Marche automatique jusqu'au point de rendez-vous (centre de Zone) —
      // immediate si le joueur y est deja (voir SeuilArriveeAutoMarche dans
      // auto-marche.js), sinon il y court d'abord. L'anim "E qui eclate" ne
      // joue qu'a l'arrivee : c'est l'appui manette de fin, pas le depart.
      const CibleX = (Interaction.Zone.XMin + Interaction.Zone.XMax) / 2;
      DemarrerAutoMarche(Scene, CibleX, () => {
        Interaction.Icone.play('iconePressee');
        Interaction.Icone.once('animationcomplete', () => {
          Interaction.Icone.setVisible(false);
          Interaction.EnCours = false;
          Interaction.OnDeclenchement(Scene.Personnage); // l'acteur : le joueur souris
        });
      }, () => {
        Interaction.EnCours = false; // le joueur a clique ailleurs avant d'arriver
      });
    }
  }

  // Clic dans le vide : le joueur marche jusqu'a l'endroit clique (seul le X
  // compte, il n'y a pas de saut). Un nouveau clic remplace la marche en cours.
  if (Clic && !ClicUtilise && !Scene.PortailEnCours) {
    const X = Phaser.Math.Clamp(PointMonde.x, 0, Scene.LargeurMondeCarte);
    DemarrerAutoMarche(Scene, X, null, null);
    AfficherRepereDestination(Scene, X, PointMonde.y);
  }

  InteractionsClavier(Scene, AppuiE);

  // Le curseur "main" est l'indice visuel qu'un element est cliquable —
  // l'icone E ne suffit plus a elle seule a le dire (elle reste dessinee
  // comme une touche clavier, en attendant une icone dediee a la souris).
  Scene.game.canvas.style.cursor = SurvolTrouve ? 'pointer' : 'default';
}


// Joueur 2 (clavier) : quand il se tient dans la Zone d'une interaction qui
// l'accepte (PourJoueur2), l'icone "E" apparait ; appuyer sur E joue l'anim
// puis declenche l'action POUR LUI (l'acteur passe a OnDeclenchement).
function InteractionsClavier(Scene, AppuiE) {
  const J2 = Scene.Joueur2;
  if (!J2 || !J2.active) return;

  for (const Interaction of Scene.InteractionsSouris) {
    if (!Interaction.PourJoueur2 || Interaction.EnCours || !Interaction.EstActive()) continue;
    if (EstDetruit(Interaction.Icone) || EstDetruit(Interaction.Cible)) continue;

    const Zone = BornesSurvol(Interaction.Zone);
    Phaser.Geom.Rectangle.Inflate(Zone, 0, 4); // le centre du joueur est un peu au-dessus de la case
    if (!Phaser.Geom.Rectangle.Contains(Zone, J2.x, J2.y)) continue;

    Interaction.Icone.setVisible(true);
    Interaction.Icone.play('iconeAttente', true);
    if (!AppuiE) continue;

    Interaction.EnCours = true;
    Interaction.Icone.play('iconePressee');
    Interaction.Icone.once('animationcomplete', () => {
      Interaction.Icone.setVisible(false);
      Interaction.EnCours = false;
      Interaction.OnDeclenchement(J2);
    });
  }
}
