// accueil.js — le menu principal, construit avec des objets Phaser (pas en
// HTML) : un titre et quatre pages (principale, niveaux, reglages, credits),
// chacune dans un conteneur qu'on affiche ou qu'on cache. Tout au debut du jeu
// (une seule fois, apres le premier appui sur Jouer), un ecran d'avertissement
// previent que le jeu aborde des sujets sensibles.

import {
  demarrer_la_musique,
  lire_volume_musique,
  regler_volume_musique,
  lire_effets_actifs,
  regler_effets_actifs,
  jouer_son_mot_pose
} from "./sons.js";
import { afficher_texte } from "./ecran_texte.js";
import { t, lire_langue, choisir_langue } from "./langue.js";

var texte_avertissement = [
  t("Ce jeu raconte des moments difficiles de la vie d'un personnage : le harcèlement, le mal-être, la violence dans une relation, et l'envie d'en finir."),
  t("Si tu traverses quelque chose de difficile, tu n'es pas seul. En France, le 3114 (numéro national de prévention du suicide) et le 116 006 (aide aux victimes) répondent gratuitement."),
  t("Clique pour continuer.")
].join("\n\n");

var avertissement_deja_vu = false; // l'ecran d'avertissement ne s'affiche qu'une fois

var style_menu = {
  fontFamily: "DeltaruneExtended, monospace",
  fontSize: "28px",
  color: "#ffffff"
};

var lignes_credits = [
  t("Un jeu de Lilian Cornet"),
  t("Histoire vraie"),
  "",
  t("Inspiré par BPM (raitwag.itch.io/bpm)"),
  t("pour son style pixel noir et blanc"),
  "",
  t("Fait avec Phaser 3 et Tiled"),
  t("Tuiles, sprites et code : Lilian Cornet"),
  t("Police : Deltarune Extended (police de fans)"),
  "",
  t("Musiques d'ambiance :"),
  "tunetank - dark ambient soundscape music",
  "cosmic scapes - soft brown noise",
  t("Bip : Beep of a cash register (BigSoundBank.com)"),
  t("(sons de tiers, sous leur licence)")
];

export default class accueil extends Phaser.Scene {
  // constructeur de la classe : on donne a la scene son identifiant
  constructor() {
    super({
      key: "accueil" // meme nom que la classe et le fichier
    });
  }

  preload() {}

  create() {
    // tout le menu est dans un conteneur place au milieu de la fenetre
    this.menu = this.add.container(0, 0);

    // le titre (toujours visible)
    this.titre = this.add.text(0, -190, "SANS COULEURS", {
      fontFamily: "DeltaruneExtended, monospace",
      fontSize: "56px",
      color: "#ffffff"
    });
    this.titre.setOrigin(0.5, 0.5);
    this.menu.add(this.titre);

    // les quatre pages : une seule est visible a la fois
    this.pages = {};
    this.creer_page_principale();
    this.creer_page_niveaux();
    this.creer_page_reglages();
    this.creer_page_credits();
    this.afficher_page("principale");

    // la barre espace lance aussi le niveau 1
    this.clavier = this.input.keyboard.createCursorKeys();

    // on place le menu au milieu, maintenant puis a chaque fois que la fenetre
    // change de taille
    this.placer_le_menu();
    this.scale.on("resize", this.placer_le_menu, this);

    // quand la scene s'arrete, on retire l'ecouteur (sinon il resterait actif)
    this.events.once("shutdown", function () {
      this.scale.off("resize", this.placer_le_menu, this);
    }, this);
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.clavier.space) == true) {
      demarrer_la_musique(); // un appui de touche autorise aussi le son
      this.lancer("niveau1");
    }
  }

  // met le menu au milieu de la fenetre
  placer_le_menu() {
    this.menu.setPosition(this.scale.width / 2, this.scale.height / 2);
  }

  // cree une page vide (un conteneur dans le menu, cache au depart)
  creer_page(nom) {
    var page = this.add.container(0, 0);
    page.setVisible(false);
    this.menu.add(page);
    this.pages[nom] = page;
    return page;
  }

  // montre la page `nom` et cache les autres
  afficher_page(nom) {
    for (var cle in this.pages) {
      this.pages[cle].setVisible(cle == nom);
    }
  }

  // cree un bouton dans `page` : un cadre blanc sur fond noir, qui s'inverse
  // quand la souris passe dessus. `action` est appelee au clic.
  creer_bouton(page, texte, y, action, largeur, x) {
    if (x == undefined) {
      x = 0;
    }
    if (largeur == undefined) {
      largeur = 340;
    }
    var fond = this.add.rectangle(x, y, largeur, 52, 0x000000);
    fond.setStrokeStyle(2, 0xffffff);
    var etiquette = this.add.text(x, y, texte, style_menu);
    etiquette.setOrigin(0.5, 0.5);
    fond.setInteractive({ useHandCursor: true }); // le curseur devient une main dessus

    fond.on("pointerover", function () {
      fond.setFillStyle(0xffffff);
      etiquette.setColor("#000000");
    }, this);
    fond.on("pointerout", function () {
      fond.setFillStyle(0x000000);
      etiquette.setColor("#ffffff");
    }, this);
    fond.on("pointerdown", function () {
      // la musique de fond demarre au premier clic (un navigateur interdit les
      // sons avant un geste du joueur)
      demarrer_la_musique();
      action.call(this);
    }, this);

    page.add([fond, etiquette]);
    return etiquette;
  }

  // un texte simple, centre, dans `page`
  creer_etiquette(page, texte, y, taille) {
    var etiquette = this.add.text(0, y, texte, {
      fontFamily: "DeltaruneExtended, monospace",
      fontSize: taille + "px",
      color: "#ffffff",
      align: "center"
    });
    etiquette.setOrigin(0.5, 0.5);
    page.add(etiquette);
    return etiquette;
  }

  // lance le niveau `cle_niveau`. La toute premiere fois, l'avertissement
  // s'affiche d'abord (par-dessus le menu, jusqu'au clic).
  lancer(cle_niveau) {
    if (avertissement_deja_vu == true) {
      this.scene.start(cle_niveau);
      return;
    }
    afficher_texte(this, texte_avertissement, function () {
      avertissement_deja_vu = true;
      this.scene.start(cle_niveau);
    }.bind(this));
  }

  // --- La page principale : jouer / niveaux / reglages / credits ---
  creer_page_principale() {
    var page = this.creer_page("principale");
    this.creer_bouton(page, t("Jouer"), -60, function () { this.lancer("niveau1"); });
    this.creer_bouton(page, t("Niveaux"), 10, function () { this.afficher_page("niveaux"); });
    this.creer_bouton(page, t("Réglages"), 80, function () { this.afficher_page("reglages"); });
    this.creer_bouton(page, t("Crédits"), 150, function () { this.afficher_page("credits"); });
  }

  // --- La page des niveaux : jouer un monde precis ---
  creer_page_niveaux() {
    var page = this.creer_page("niveaux");
    this.creer_etiquette(page, t("Choisis un monde"), -110, 24);
    this.creer_bouton(page, t("1 · Le début"), -60, function () { this.lancer("niveau1"); });
    this.creer_bouton(page, t("2 · L'enfance"), 0, function () { this.lancer("niveau2"); });
    this.creer_bouton(page, t("3 · Le collège"), 60, function () { this.lancer("niveau3"); });
    this.creer_bouton(page, t("4 · La coupure"), 120, function () { this.lancer("niveau4"); });
    this.creer_bouton(page, t("5 · Le lycée"), 180, function () { this.lancer("niveau5"); });
    this.creer_bouton(page, t("Retour"), 260, function () { this.afficher_page("principale"); }, 200);
  }

  // --- La page des reglages : volume de la musique, bruitages, langue ---
  creer_page_reglages() {
    var page = this.creer_page("reglages");
    this.creer_etiquette(page, t("Réglages"), -120, 24);

    // le volume de la musique : un bouton - , la valeur, un bouton +
    this.creer_etiquette(page, t("Musique"), -85, 24);
    this.creer_bouton(page, "-", -30, function () { this.changer_volume(-0.1); }, 70, -120);
    this.texte_volume = this.creer_etiquette(page, "", -30, 28);
    this.creer_bouton(page, "+", -30, function () { this.changer_volume(0.1); }, 70, 120);
    this.mettre_a_jour_volume();

    // les bruitages : un bouton qui bascule entre oui et non
    this.creer_etiquette(page, t("Bruitages"), 12, 24);
    this.bouton_effets = this.creer_bouton(page, "", 55, function () {
      regler_effets_actifs(lire_effets_actifs() == false);
      this.mettre_a_jour_effets();
      jouer_son_mot_pose(0); // un petit son pour entendre le resultat
    }, 200);
    this.mettre_a_jour_effets();

    // la langue : un bouton qui bascule entre francais et anglais (la page se recharge)
    this.creer_etiquette(page, t("Langue"), 107, 24);
    var nom_de_la_langue = "Français";
    if (lire_langue() == "en") {
      nom_de_la_langue = "English";
    }
    this.creer_bouton(page, nom_de_la_langue, 150, function () {
      if (lire_langue() == "fr") {
        choisir_langue("en");
      } else {
        choisir_langue("fr");
      }
    }, 200);

    this.creer_bouton(page, t("Retour"), 240, function () { this.afficher_page("principale"); }, 200);
  }

  // change le volume de la musique de `ecart` (+0.1 ou -0.1)
  changer_volume(ecart) {
    regler_volume_musique(lire_volume_musique() + ecart);
    this.mettre_a_jour_volume();
  }

  // affiche le volume de la musique en pourcentage
  mettre_a_jour_volume() {
    this.texte_volume.setText(Math.round(lire_volume_musique() * 100) + " %");
  }

  // affiche l'etat des bruitages
  mettre_a_jour_effets() {
    if (lire_effets_actifs() == true) {
      this.bouton_effets.setText(t("Oui"));
    } else {
      this.bouton_effets.setText(t("Non"));
    }
  }

  // --- La page des credits ---
  creer_page_credits() {
    var page = this.creer_page("credits");
    this.creer_etiquette(page, t("Crédits"), -110, 24);
    var texte_credits = this.creer_etiquette(page, lignes_credits.join("\n"), -85, 16);
    texte_credits.setOrigin(0.5, 0); // le texte part du haut, sous le titre de la page
    this.creer_bouton(page, t("Retour"), 275, function () { this.afficher_page("principale"); }, 200);
  }
}
