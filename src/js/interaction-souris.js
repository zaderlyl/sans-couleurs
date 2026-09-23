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
//   - Icone    : le sprite "E" deja pose (CreerIconeInteraction) — sa
//                position/taille sert de zone de survol pour la souris
//   - OnDeclenchement : rappelle quoi faire une fois l'anim "E qui eclate" finie
//   - EstActive (optionnel) : d'autres conditions a verifier avant de
//                proposer l'interaction (ex: la gare n'est utilisable que
//                dans l'etat 'attente') — par defaut toujours active
//
// Ce module se charge ensuite, une fois par frame pour tout le monde, de :
// trouver quel point est survole (le joueur doit etre A PORTEE ET la souris
// doit survoler l'icone), afficher son icone, et le declencher au clic gauche.

// Marge (px monde) ajoutee autour de l'icone pour le survol : elle fait
// 16px monde (voir icone-interaction.js), donc minuscule a l'ecran malgre le
// zoom — sans cette marge, il faut viser tres precisement.
const MargeSurvolIcone = 6;

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

export function EnregistrerInteractionSouris(Scene, { Zone, Icone, OnDeclenchement, EstActive }) {
  Scene.InteractionsSouris.push({
    Zone,
    Icone,
    OnDeclenchement,
    EstActive: EstActive || (() => true),
    EnCours: false, // verrou pendant l'anim "E qui eclate", entre le clic et OnDeclenchement
  });
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
      if (Interaction.Icone.scene && !Interaction.EnCours) Interaction.Icone.setVisible(false);
    });
    Scene.game.canvas.style.cursor = 'default';
    return;
  }

  const PointMonde = Scene.cameras.main.getWorldPoint(Scene.input.activePointer.x, Scene.input.activePointer.y);
  let SurvolTrouve = false;

  for (const Interaction of Scene.InteractionsSouris) {
    // L'icone peut avoir ete detruite pour de bon (ex: un PNJ dont le
    // dialogue est termine, voir dialogue-pnj.js) : `.scene` disparait a la
    // destruction, plus rien a faire pour cette interaction.
    if (!Interaction.Icone.scene) continue;
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

    // Zone de survol un peu plus large que l'icone elle-meme (16px monde,
    // donc minuscule a l'ecran malgre le zoom) : plus facile a viser, sans
    // rendre l'icone elle-meme plus grosse visuellement.
    const Bornes = Interaction.Icone.getBounds();
    Phaser.Geom.Rectangle.Inflate(Bornes, MargeSurvolIcone, MargeSurvolIcone);
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
