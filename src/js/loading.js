// loading.js — prechargement des assets (phase preload() de la scene).
// ScenePrincipale.preload() se contente d'appeler PrechargerAssets(this).

// Le serveur de dev (python -m http.server) n'envoie aucun en-tete
// anti-cache : sans ca, le navigateur garde une ancienne version d'un asset
// meme apres modification du fichier sur le disque. On rajoute un parametre
// unique a chaque chargement de page pour forcer un fichier frais a chaque
// fois pendant le developpement.
const ParametreAntiCache = `?v=${Date.now()}`;

// `Scene` est l'instance de ScenePrincipale (this cote preload). init() a deja
// pose Scene.NomCarteActuelle (voir game.js).
function PrechargerAssets(Scene) {
  // Chargement des assets Tiled : seulement si le flag est actif, pour ne
  // pas provoquer d'erreur "fichier introuvable" tant qu'ils n'existent pas.
  if (UtiliseCarteTiled) {
    // L'image brute du tileset : la texture que Tiled decoupe en tuiles
    Scene.load.image(CleTuiles, CheminTuiles + ParametreAntiCache);
    // La map elle-meme : positions des tuiles, calques, objets, etc. Cle de
    // cache = nom de la carte (Scene.NomCarteActuelle, voir init()) plutot
    // qu'une cle fixe, pour que chaque carte ait sa propre entree en cache
    // et ne pas rejouer une ancienne carte apres this.scene.restart(...).
    Scene.load.tilemapTiledJSON(Scene.NomCarteActuelle, `assets/maps/${Scene.NomCarteActuelle}.json` + ParametreAntiCache);

    // Spritesheet d'animation de la gare
    Scene.load.spritesheet(CleGare, CheminGare + ParametreAntiCache, {
      frameWidth: TailleImageGare,
      frameHeight: TailleImageGare,
    });

    // Spritesheet de l'herbe (4 variantes de brin, 16x16 chacune)
    Scene.load.spritesheet(CleHerbe, CheminHerbe + ParametreAntiCache, {
      frameWidth: TailleImageHerbe,
      frameHeight: TailleImageHerbe,
    });

    // Spritesheet de l'icone d'interaction (invite + E qui eclate)
    Scene.load.spritesheet(CleIconeInteraction, CheminIconeInteraction + ParametreAntiCache, {
      frameWidth: TailleIconeInteraction,
      frameHeight: TailleIconeInteraction,
    });

    // Spritesheet de l'ecran de tele (cardiogramme en boucle)
    Scene.load.spritesheet(CleTele, CheminTele + ParametreAntiCache, {
      frameWidth: TailleImageTele,
      frameHeight: TailleImageTele,
    });
    // Ecran "mort" de la tele, affiche au 5e appui
    Scene.load.spritesheet(CleTeleMort, CheminTeleMort + ParametreAntiCache, {
      frameWidth: TailleImageTele,
      frameHeight: TailleImageTele,
    });
    // PNJ de dialogue (voir CreerPNJs) : tous les personnages connus,
    // qu'ils soient utilises ou non sur cette carte precise.
    SpritesPNJConnus.forEach(({ Cle, Chemin, LargeurFrame, HauteurFrame }) => {
      Scene.load.spritesheet(Cle, Chemin + ParametreAntiCache, {
        frameWidth: LargeurFrame,
        frameHeight: HauteurFrame,
      });
    });
  }

  if (UtiliseSpritePersonnage) {
    // spritesheet : Phaser decoupe l'image en frames de taille fixe
    Scene.load.spritesheet(ClePersonnage, CheminPersonnage + ParametreAntiCache, {
      frameWidth: LargeurImagePersonnage,
      frameHeight: HauteurImagePersonnage,
    });
  }
}
