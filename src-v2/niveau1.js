// niveau1.js — le niveau 1 (la carte "map-1-debut", faite avec Tiled).
// Etape 1 : la carte, un personnage et le deplacement a la souris
// (on clique quelque part, le personnage y marche).

export default class niveau1 extends Phaser.Scene {
  // constructeur de la classe : on donne a la scene son identifiant
  constructor() {
    super({
      key: "niveau1" // meme nom que la classe et le fichier
    });
  }

  preload() {
    // l'image des tuiles, la carte Tiled (au format JSON) et le personnage
    this.load.image("img_tuiles", "assets/tilesets/Tileset.png");
    this.load.tilemapTiledJSON("carte_map1", "assets/maps/map-1-debut.json");
    this.load.spritesheet("img_perso", "assets/sprites/characters/player.png", {
      frameWidth: 16,
      frameHeight: 16
    });
  }

  create() {
    // --- la carte ---
    this.carte = this.make.tilemap({ key: "carte_map1" });
    // "Tileset" = le nom du jeu de tuiles dans Tiled, "img_tuiles" = l'image chargee
    var tuiles = this.carte.addTilesetImage("Tileset", "img_tuiles");

    // les calques, du plus loin au plus proche (le dernier cree est dessus)
    this.carte.createLayer("bg", tuiles, 0, 0);
    this.carte.createLayer("bg2", tuiles, 0, 0);
    this.calque_sol = this.carte.createLayer("sol", tuiles, 0, 0);
    // toute tuile non vide du calque "sol" est solide
    this.calque_sol.setCollisionByExclusion([-1]);

    // --- le personnage (joueur souris) ---
    // il apparait au point "spawn" pose dans Tiled
    var depart = this.carte.findObject("Calque d'Objets 1", function (objet) {
      return objet.name === "spawn";
    });
    this.joueur_souris = this.physics.add.sprite(depart.x, depart.y, "img_perso");
    this.physics.add.collider(this.joueur_souris, this.calque_sol);

    // le monde fait la taille de la carte, le personnage ne peut pas en sortir
    this.physics.world.setBounds(0, 0, this.carte.widthInPixels, this.carte.heightInPixels);
    this.joueur_souris.setCollideWorldBounds(true);

    // --- l'animation de marche (images 4 et 5 de la feuille du personnage) ---
    // les animations sont partagees par tout le jeu : on ne la cree qu'une fois
    if (this.anims.exists("anim_marche") == false) {
      this.anims.create({
        key: "anim_marche",
        frames: this.anims.generateFrameNumbers("img_perso", { start: 4, end: 5 }),
        frameRate: 8,
        repeat: -1
      });
    }

    // --- la camera ---
    // pixel art de 16 pixels : on zoome x5, sinon tout est minuscule
    this.cameras.main.setZoom(5);

    // --- le clic de souris ---
    // la ou le personnage doit aller (null = il n'y va nulle part)
    this.destination_x = null;
    this.input.on("pointerdown", this.cliquer, this);
  }

  update() {
    // --- le personnage marche vers la destination ---
    if (this.destination_x !== null) {
      // ecart > 0 : la destination est a droite ; ecart < 0 : a gauche
      var ecart = this.destination_x - this.joueur_souris.x;

      // bloque par un mur dans le sens ou il marche ?
      var corps = this.joueur_souris.body;
      var bloque = (ecart > 0 && corps.blocked.right) || (ecart < 0 && corps.blocked.left);

      if (Math.abs(ecart) < 4 || bloque == true) {
        // arrive (a 4 pixels pres) ou bloque : il s'arrete
        this.destination_x = null;
      } else if (ecart < 0) {
        this.joueur_souris.setVelocityX(-70);
        this.joueur_souris.setFlipX(true); // regarde a gauche
        this.joueur_souris.anims.play("anim_marche", true);
      } else {
        this.joueur_souris.setVelocityX(70);
        this.joueur_souris.setFlipX(false); // regarde a droite
        this.joueur_souris.anims.play("anim_marche", true);
      }
    }

    // pas de destination : le personnage est immobile
    if (this.destination_x === null) {
      this.joueur_souris.setVelocityX(0);
      this.joueur_souris.anims.stop();
      this.joueur_souris.setFrame(3); // l'image "debout"
    }

    // --- la camera suit le personnage ---
    // on garde la camera dans la carte : on ne voit jamais le noir autour.
    // La camera voit (largeur / zoom) pixels de monde ; son centre ne doit pas
    // s'approcher du bord a moins de la moitie de cette largeur.
    var camera = this.cameras.main;
    var demi_largeur = camera.width / camera.zoom / 2;
    var demi_hauteur = camera.height / camera.zoom / 2;
    var centre_x = Phaser.Math.Clamp(this.joueur_souris.x, demi_largeur, this.carte.widthInPixels - demi_largeur);
    var centre_y = Phaser.Math.Clamp(this.joueur_souris.y, demi_hauteur, this.carte.heightInPixels - demi_hauteur);
    camera.centerOn(centre_x, centre_y);
  }

  // appelee a chaque clic de souris
  cliquer(pointeur) {
    // pointeur.worldX / worldY : l'endroit du MONDE ou on a clique
    // (pas du ecran : la camera est zoomee et decalee)
    this.destination_x = pointeur.worldX;

    // un petit anneau montre ou on a clique : il grossit et s'efface
    var anneau = this.add.circle(pointeur.worldX, pointeur.worldY, 3);
    anneau.setStrokeStyle(1, 0xffffff);
    this.tweens.add({
      targets: anneau,
      scale: 2.2,
      alpha: 0,
      duration: 450,
      onComplete: function () {
        anneau.destroy();
      }
    });
  }
}
