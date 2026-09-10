// scene-jeu.js — la scene Phaser du jeu (une seule).
//
// Ce fichier n'est qu'un SQUELETTE : il monte la tilemap de base (bg / bg2 /
// sol), le personnage, la camera et les entrees, puis laisse les features de
// la carte active faire le reste (voir la config de chaque carte dans
// js/maps/map-*/, et Installer/MettreAJour/ApresChargementFeaturesCarte).
//
// Modules ES : les `import` ci-dessous SONT la liste des dependances.
// Reglages generaux -> js/config.js ; personnage -> js/playerConfig.js +
// js/player.js ; cartes + helpers Tiled -> js/maps/cartes.js.

import { PrechargerAssets } from './js/loading.js';
import {
  CleCarteDeDepart, NomTuilesDansTiled, CleTuiles, NomCalqueSol,
  InstallerFeaturesCarte, ApresChargementFeaturesCarte, MettreAJourFeaturesCarte,
} from './js/maps/cartes.js';
import {
  UtiliseCarteTiled, ZoomCamera,
  LargeurMondeParDefaut, HauteurMondeParDefaut, HauteurSol, CouleurSol, CouleurAccent,
} from './js/config.js';
import { CreerAnimsIconeInteraction } from './js/icone-interaction.js';
import { MettreAJourCamera } from './js/camera.js';
import { CreerPersonnage, MettreAJourDeplacement } from './js/player.js';
import { InstallerControles } from './js/controle.js';
import { DemarrerSonAmbiance } from './js/sons.js';

export class SceneJeu extends Phaser.Scene {
  // Appele avant preload(), au 1er lancement ET a chaque scene.restart(...)
  // (voir la feature gare). "data" est absent au 1er lancement -> carte de
  // depart, ou ?carte=<cle> en test (CleCarteDeDepart) ; il contient
  // { carte, arrivee } quand on arrive d'une autre carte via le train.
  // this.ArriveeParTrain declenche l'animation d'arrivee (feature gare).
  init(Donnees) {
    this.NomCarteActuelle = (Donnees && Donnees.carte) || CleCarteDeDepart();
    // Arrivee en train : soit on vient d'une autre carte (Donnees.arrivee),
    // soit, au tout premier lancement uniquement, on force l'arrivee pour
    // tester une carte isolee -> ?carte=<cle>&arrivee=1
    // (Phaser passe {} et non undefined au 1er lancement : on teste le contenu.)
    const PremierLancement = !Donnees || Object.keys(Donnees).length === 0;
    const ArriveeParUrl =
      PremierLancement && new URLSearchParams(window.location.search).get('arrivee') === '1';
    this.ArriveeParTrain = !!(Donnees && Donnees.arrivee) || ArriveeParUrl;
  }

  preload() {
    // Tout le prechargement est dans src/js/loading.js.
    PrechargerAssets(this);
  }

  create() {
    this.cameras.main.setBackgroundColor('#000000');

    // En mode d'echelle RESIZE, Phaser ne redimensionne pas la camera tout
    // seul : sans ca, elle reste a 0x0 et rien ne s'affiche. Pas besoin de
    // rien recalculer d'autre ici : MettreAJourCamera (voir update()) relit
    // la taille de la camera a chaque frame, donc un redimensionnement se
    // repercute tout seul des la frame suivante.
    this.cameras.main.setSize(this.scale.width, this.scale.height);
    this.scale.on('resize', (TailleJeu) => {
      this.cameras.main.setSize(TailleJeu.width, TailleJeu.height);
    });

    let Sol; // le collider du sol/decor, quel que soit le mode
    let LargeurMonde = LargeurMondeParDefaut;
    let HauteurMonde = HauteurMondeParDefaut;
    let PositionDepartX = 120;
    let PositionDepartY = HauteurSol - 30;

    if (UtiliseCarteTiled) {
      // ── Mode Tiled ──────────────────────────────────────────────────
      // this.make.tilemap lit les donnees JSON chargees en preload()
      const Carte = this.make.tilemap({ key: this.NomCarteActuelle });
      // Associe l'image de tileset chargee au tileset declare dans le JSON
      const JeuDeTuiles = Carte.addTilesetImage(NomTuilesDansTiled, CleTuiles);

      // Calques visuels, dans l'ordre (le premier cree s'affiche en dessous).
      // Le calque "sol" porte la collision ; "gare"/"derriere" sont crees et
      // caches par la feature gare ; "devant" devient de l'herbe (feature).
      Carte.createLayer('bg', JeuDeTuiles, 0, 0);
      Carte.createLayer('bg2', JeuDeTuiles, 0, 0);
      const CalqueSol = Carte.createLayer(NomCalqueSol, JeuDeTuiles, 0, 0);

      // Animations de l'icone "E" (partagees gare / tele / PNJ).
      CreerAnimsIconeInteraction(this);

      // Features de la carte active (voir sa config + src/js/features/).
      // Installees ICI, avant le personnage : elles posent leurs sprites
      // (SpriteGare, tele, herbe...) dans l'ordre du tableau `features`, et la
      // gare renseigne this.PositionArriveeX/Y que le spawn lit juste apres.
      InstallerFeaturesCarte(this, { Carte, JeuDeTuiles });

      // Aucune propriete "collides" definie pour l'instant dans Tiled : on
      // rend donc solide toute case non vide (-1) du calque de sol. Si tu
      // preferes du cas par cas plus tard, utilise plutot
      // CalqueSol.setCollisionByProperty({ collides: true }) avec des
      // proprietes posees tuile par tuile dans Tiled.
      CalqueSol.setCollisionByExclusion([-1]);

      Sol = CalqueSol;
      LargeurMonde = Carte.widthInPixels;
      HauteurMonde = Carte.heightInPixels;

      // Le pixel art (tuiles 16px) est minuscule sans zoom sur un canvas de 960px
      this.cameras.main.setZoom(ZoomCamera);

      // Point de spawn place dans Tiled (calque d'objets "Calque d'Objets 1",
      // objet ponctuel nomme "spawn"). Si jamais il est absent/renomme, on
      // retombe sur une position par defaut au-dessus du sol.
      const PointDepart = Carte.findObject("Calque d'Objets 1", (Objet) => Objet.name === 'spawn');
      PositionDepartX = PointDepart ? PointDepart.x : 250;
      PositionDepartY = PointDepart ? PointDepart.y : 120;

      // Arrivee en train : le joueur apparait sur le bloc "gare" de cette
      // carte (this.PositionArriveeX/Y, pose par la feature gare) plutot qu'au
      // spawn normal. Si la carte n'a pas de gare, on garde le spawn ci-dessus.
      if (this.ArriveeParTrain && this.PositionArriveeX !== undefined) {
        PositionDepartX = this.PositionArriveeX;
        PositionDepartY = this.PositionArriveeY;
      }
    } else {
      // ── Mode prototype (sans Tiled) : la ligne droite bicolore actuelle ──
      Sol = this.add.rectangle(LargeurMonde / 2, HauteurSol + 40, LargeurMonde, 80, CouleurSol);
      this.physics.add.existing(Sol, true); // true = corps statique (ne bouge jamais)

      // Liseré d'accent purement visuel, sans collision
      this.add.rectangle(LargeurMonde / 2, HauteurSol, LargeurMonde, 4, CouleurAccent);
    }

    this.physics.world.setBounds(0, 0, LargeurMonde, HauteurMonde);
    // Pas de this.cameras.main.setBounds(...) : rentre en conflit avec notre
    // suivi manuel (voir MettreAJourCamera) — teste et confirme que ce n'est
    // PAS ce qui cause l'ecran noir (present avec ou sans), donc pas la
    // peine de garder ce conflit pour rien.

    // ── Personnage ──────────────────────────────────────────────────────
    // Creation + emetteur de poussiere + etat de deplacement : voir
    // CreerPersonnage dans src/js/player.js.
    CreerPersonnage(this, PositionDepartX, PositionDepartY);
    this.physics.add.collider(this.Personnage, Sol);

    // Suivi de camera entierement manuel (voir MettreAJourCamera dans
    // update()), plutot que startFollow(...) : constate a l'usage que
    // Phaser recalcule scrollY tout seul a chaque redimensionnement de la
    // fenetre, meme avec lerpY=0 (cense le "geler" definitivement) — un
    // comportement surprenant de cette version qui rendait tout correctif
    // applique une seule fois ecrase peu apres. Piloter nous-memes scrollX
    // ET scrollY chaque frame evite ce probleme une bonne fois pour toutes.
    this.HauteurMondeCarte = HauteurMonde;
    this.LargeurMondeCarte = LargeurMonde;
    // true force un recadrage horizontal instantane dans MettreAJourCamera
    // (utilise pendant le voyage en train, voir
    // DemarrerSequenceGare/DemarrerRetourGare) ; remis a false une fois
    // arrive pour retrouver le suivi doux normal.
    this.CameraDoitSauterEnX = false;

    // Entrees clavier : voir InstallerControles dans src/js/controle.js.
    InstallerControles(this);

    // (l'etat de la gare et le dialogue PNJ sont poses par leurs features,
    // installees par InstallerFeaturesCarte plus haut. this.EtatGare et
    // this.DialogueOuvert gelent le mouvement du joueur dans update().)

    // Le son ne peut demarrer qu'apres une premiere interaction utilisateur
    // (restriction des navigateurs) : on l'accroche au premier clic OU la premiere touche
    this.input.once('pointerdown', DemarrerSonAmbiance);
    this.input.keyboard.once('keydown', DemarrerSonAmbiance);

    // Scene entierement prete : laisse les features finir (la gare joue ici
    // l'animation d'arrivee en train si on vient d'une autre carte).
    ApresChargementFeaturesCarte(this);
  }

  update(Temps, TempsEcoule) {
    if (this.LargeurMondeCarte) MettreAJourCamera(this);

    // Toutes les features de la carte active (gare/train, tele, herbe,
    // tunnel, textes de zone, dialogue PNJ) — voir src/js/features/.
    MettreAJourFeaturesCarte(this, Temps, TempsEcoule);

    // Aucun controle pendant le voyage en train (this.EtatGare, pose par la
    // feature gare) ni pendant un dialogue PNJ (this.DialogueOuvert) : le
    // corps physique est desactive, mais sans ce garde-fou les touches
    // tenues continueraient a jouer des bruits de pas sur un personnage fige.
    if (this.EtatGare !== 'enCours' && !this.DialogueOuvert) {
      MettreAJourDeplacement(this, Temps, TempsEcoule);
    }
  }
}
