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
//   - Zone     : portee depuis le joueur (comme avant, propre a la feature)
//   - Cible    : ce que la souris doit survoler pour declencher — le SPRITE
//                visible en jeu (le train de la gare, le PNJ, l'ecran de
//                tele...), pas la petite icone "E" (trop precis a viser).
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
//
// Ce module se charge ensuite, une fois par frame pour tout le monde, de :
// trouver quel point est survole (le joueur doit etre A PORTEE ET la souris
// doit survoler la Cible), afficher son icone, et le declencher au clic gauche.

// Marge (px monde) ajoutee autour de la cible pour le survol — confortable
// meme pour les cibles deja petites (un PNJ, un portail sans sprite dedie).
const MargeSurvol = 4;

export function InstallerInteractionSouris(Scene) {
  Scene.InteractionsSouris = [];
  Scene.SourisVientDeCliquer = false;

  // Evenement plutot que lecture au vol : un clic est instantane (down puis
  // souvent up dans la meme frame ou la suivante), le lire via un evenement
  // garantit qu'on ne le rate jamais, quelle que soit la duree de l'appui.
  Scene.input.on('pointerdown', (Pointeur) => {
    if (Pointeur.leftButtonDown()) Scene.SourisVientDeCliquer = true;
  });
}

export function EnregistrerInteractionSouris(Scene, { Zone, Cible, Icone, OnDeclenchement, EstActive }) {
  Scene.InteractionsSouris.push({
    Zone,
    Cible,
    Icone,
    OnDeclenchement,
    EstActive: EstActive || (() => true),
    EnCours: false, // verrou pendant l'anim "E qui eclate", entre le clic et OnDeclenchement
  });
}

// true si `Objet` est un GameObject Phaser (a un getBounds()) qui a ete
// detruit (Phaser vide sa reference `.scene` a la destruction). Un simple
// rectangle {XMin,...} n'a jamais de getBounds -> jamais "detruit".
function EstDetruit(Objet) {
  return typeof Objet.getBounds === 'function' && !Objet.scene;
}

// Rectangle de survol d'une interaction : getBounds() de la Cible si c'est
// un GameObject (deja un Phaser.Geom.Rectangle, x/y/width/height) ; sinon la
// Cible est un rectangle "maison" {XMin,XMax,YMin,YMax} (meme forme que
// `Zone` partout ailleurs dans le jeu) — a convertir, Phaser.Geom.Rectangle
// attend x/y/width/height, pas XMin/XMax/YMin/YMax.
function BornesSurvol(Cible) {
  if (typeof Cible.getBounds === 'function') return Cible.getBounds();
  return new Phaser.Geom.Rectangle(Cible.XMin, Cible.YMin, Cible.XMax - Cible.XMin, Cible.YMax - Cible.YMin);
}

// A appeler une fois par frame (scene-jeu.js). Gele tout (rien de survole,
// curseur normal) pendant un voyage en train, un dialogue, ou l'ecran de
// mort glitch2 — comme le mouvement du joueur dans scene-jeu.js.
export function MettreAJourInteractionsSouris(Scene) {
  const Clic = Scene.SourisVientDeCliquer;
  Scene.SourisVientDeCliquer = false; // consomme ici, une seule fois, pour tout le monde

  const Fige = Scene.EtatGare === 'enCours' || Scene.DialogueOuvert || !!Scene.GlitchEtatFin;
  if (Fige) {
    Scene.InteractionsSouris.forEach((Interaction) => {
      if (!EstDetruit(Interaction.Icone) && !Interaction.EnCours) Interaction.Icone.setVisible(false);
    });
    Scene.game.canvas.style.cursor = 'default';
    return;
  }

  const PointMonde = Scene.cameras.main.getWorldPoint(Scene.input.activePointer.x, Scene.input.activePointer.y);
  let SurvolTrouve = false;

  for (const Interaction of Scene.InteractionsSouris) {
    // L'icone ou sa cible peuvent avoir ete detruites pour de bon (ex: un
    // PNJ dont le dialogue est termine, voir dialogue-pnj.js) : plus rien a
    // faire pour cette interaction.
    if (EstDetruit(Interaction.Icone) || EstDetruit(Interaction.Cible)) continue;
    if (Interaction.EnCours) continue; // anim "E qui eclate" deja en cours : ne pas y toucher
    if (!Interaction.EstActive()) {
      Interaction.Icone.setVisible(false);
      continue;
    }

    const Perso = Scene.Personnage;
    const APortee =
      Perso.x > Interaction.Zone.XMin && Perso.x < Interaction.Zone.XMax &&
      Perso.y > Interaction.Zone.YMin && Perso.y < Interaction.Zone.YMax;

    if (!APortee) {
      Interaction.Icone.setVisible(false);
      continue;
    }

    const Bornes = BornesSurvol(Interaction.Cible);
    Phaser.Geom.Rectangle.Inflate(Bornes, MargeSurvol, MargeSurvol);
    const Survolee = Phaser.Geom.Rectangle.Contains(Bornes, PointMonde.x, PointMonde.y);
    if (!Survolee) {
      Interaction.Icone.setVisible(false);
      continue;
    }

    SurvolTrouve = true;
    Interaction.Icone.setVisible(true);
    Interaction.Icone.play('iconeAttente', true); // true : ne relance pas si deja en cours

    if (Clic) {
      Interaction.EnCours = true;
      Interaction.Icone.play('iconePressee');
      Interaction.Icone.once('animationcomplete', () => {
        Interaction.Icone.setVisible(false);
        Interaction.EnCours = false;
        Interaction.OnDeclenchement();
      });
    }
  }

  // Le curseur "main" est l'indice visuel qu'un element est cliquable —
  // l'icone E ne suffit plus a elle seule a le dire (elle reste dessinee
  // comme une touche clavier, en attendant une icone dediee a la souris).
  Scene.game.canvas.style.cursor = SurvolTrouve ? 'pointer' : 'default';
}
