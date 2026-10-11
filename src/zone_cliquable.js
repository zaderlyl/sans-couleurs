// zone_cliquable.js — rendre un sprite cliquable UNIQUEMENT sur ses pixels dessines.
//
// Phaser sait le faire tout seul avec setInteractive({ pixelPerfect: true }),
// mais cette option IGNORE le retournement de l'image (setFlipX) : un sprite
// retourne (la gare de la carte 2, par exemple) aurait une zone cliquable en
// MIROIR, decalee par rapport a ce qu'on voit. Ce petit fichier refait le test
// en tenant compte du retournement.
//
// Comment s'en servir :
//   rendre_cliquable_sur_les_pixels(sprite);

export function rendre_cliquable_sur_les_pixels(sprite) {
  // la zone de depart : tout le rectangle de l'image (le test pixel affine ensuite)
  var rectangle = new Phaser.Geom.Rectangle(0, 0, sprite.width, sprite.height);

  sprite.setInteractive({
    hitArea: rectangle,
    // Phaser appelle cette fonction pour savoir si la souris est "sur" le sprite.
    // (x, y) = l'endroit de la souris dans l'image, depuis son coin haut-gauche.
    hitAreaCallback: function (zone, x, y, objet) {
      if (objet.flipX == true) {
        x = objet.width - x; // image retournee : le pixel vu a x est celui de l'autre cote
      }
      // l'opacite du pixel de l'image d'origine (0 = transparent) : cliquable s'il est dessine
      var opacite = objet.scene.textures.getPixelAlpha(Math.floor(x), Math.floor(y), objet.texture.key, objet.frame.name);
      return opacite > 0;
    },
    useHandCursor: true // le curseur devient une main dessus
  });
}
