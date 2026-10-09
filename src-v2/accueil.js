// accueil.js — la page d'accueil : le titre du jeu et des boutons pour
// choisir le niveau.

export default class accueil extends Phaser.Scene {
  // constructeur de la classe : on donne a la scene son identifiant
  constructor() {
    super({
      key: "accueil" // meme nom que la classe et le fichier
    });
  }

  preload() {}

  create() {
    // le titre
    this.titre = this.add.text(0, 0, "SANS COULEURS", {
      fontFamily: "DeltaruneExtended, monospace",
      fontSize: "56px",
      color: "#ffffff"
    });
    this.titre.setOrigin(0.5, 0.5); // le point de reference du texte est son centre

    // les boutons : chacun lance un niveau
    this.bouton_jouer = this.creer_bouton("Jouer", "niveau1");
    this.bouton_enfance = this.creer_bouton("L'enfance", "niveau2");
    this.bouton_college = this.creer_bouton("Le college", "niveau3");

    // la barre espace lance aussi le niveau 1
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

  // cree un bouton (un texte sur lequel on peut cliquer) qui lance le niveau `cle_niveau`
  creer_bouton(texte, cle_niveau) {
    var bouton = this.add.text(0, 0, texte, {
      fontFamily: "DeltaruneExtended, monospace",
      fontSize: "32px",
      color: "#ffffff",
      backgroundColor: "#000000",
      padding: { x: 24, y: 10 }
    });
    bouton.setOrigin(0.5, 0.5);
    bouton.setInteractive({ useHandCursor: true }); // le curseur devient une main dessus

    // quand la souris entre sur le bouton : couleurs inversees (blanc / noir)
    bouton.on("pointerover", function () {
      bouton.setColor("#000000");
      bouton.setBackgroundColor("#ffffff");
    }, this);

    // quand elle en sort : couleurs normales
    bouton.on("pointerout", function () {
      bouton.setColor("#ffffff");
      bouton.setBackgroundColor("#000000");
    }, this);

    // clic sur le bouton : on lance le niveau
    bouton.on("pointerdown", function () {
      this.scene.start(cle_niveau);
    }, this);

    return bouton;
  }

  // met le titre et les boutons au milieu de la fenetre
  placer_les_textes() {
    var milieu_x = this.scale.width / 2;
    var milieu_y = this.scale.height / 2;
    this.titre.setPosition(milieu_x, milieu_y - 100);
    this.bouton_jouer.setPosition(milieu_x, milieu_y + 10);
    this.bouton_enfance.setPosition(milieu_x, milieu_y + 90);
    this.bouton_college.setPosition(milieu_x, milieu_y + 170);
  }
}
