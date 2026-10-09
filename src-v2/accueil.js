// accueil.js — la page d'accueil : le titre du jeu et un bouton "Jouer".

export default class accueil extends Phaser.Scene {
  // constructeur de la classe : on donne a la scene son identifiant
  constructor() {
    super({
      key: "accueil" // meme nom que la classe et le fichier
    });
  }

  preload() {}

  create() {
    // le titre, au centre en haut
    this.titre = this.add.text(0, 0, "SANS COULEURS", {
      fontFamily: "DeltaruneExtended, monospace",
      fontSize: "56px",
      color: "#ffffff"
    });
    this.titre.setOrigin(0.5, 0.5); // le point de reference du texte est son centre

    // le bouton "Jouer" : un texte sur lequel on peut cliquer
    this.bouton = this.add.text(0, 0, "Jouer", {
      fontFamily: "DeltaruneExtended, monospace",
      fontSize: "32px",
      color: "#ffffff",
      backgroundColor: "#000000",
      padding: { x: 24, y: 10 }
    });
    this.bouton.setOrigin(0.5, 0.5);
    this.bouton.setInteractive({ useHandCursor: true }); // le curseur devient une main dessus

    // quand la souris entre sur le bouton : couleurs inversees (blanc / noir)
    this.bouton.on("pointerover", function () {
      this.bouton.setColor("#000000");
      this.bouton.setBackgroundColor("#ffffff");
    }, this);

    // quand elle en sort : couleurs normales
    this.bouton.on("pointerout", function () {
      this.bouton.setColor("#ffffff");
      this.bouton.setBackgroundColor("#000000");
    }, this);

    // clic sur le bouton : on lance le niveau 1
    this.bouton.on("pointerdown", function () {
      this.scene.start("niveau1");
    }, this);

    // la barre espace lance aussi le jeu
    this.clavier = this.input.keyboard.createCursorKeys();

    // on place les textes au bon endroit, maintenant puis a chaque fois que la
    // fenetre change de taille
    this.placer_les_textes();
    this.scale.on("resize", this.placer_les_textes, this);

    // quand la scene s'arrete, on retire l'ecouteur (sinon il resterait actif)
    this.events.once("shutdown", function () {
      this.scale.off("resize", this.placer_les_textes, this);
    }, this);
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.clavier.space) == true) {
      this.scene.start("niveau1");
    }
  }

  // met le titre et le bouton au milieu de la fenetre
  placer_les_textes() {
    var milieu_x = this.scale.width / 2;
    var milieu_y = this.scale.height / 2;
    this.titre.setPosition(milieu_x, milieu_y - 60);
    this.bouton.setPosition(milieu_x, milieu_y + 60);
  }
}
