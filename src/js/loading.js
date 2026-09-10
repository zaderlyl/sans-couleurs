// loading.js — phase preload() : dit a Phaser quels fichiers charger.
// ScenePrincipale.preload() appelle juste PrechargerAssets(this).

// Anti-cache dev : le serveur local (python -m http.server) ne renvoie aucun
// en-tete de cache, donc un asset modifie sur le disque peut rester servi
// depuis l'ancienne version. Un "?v=..." different a chaque chargement force
// une version fraiche.
const ParametreAntiCache = `?v=${Date.now()}`;

function PrechargerAssets(Scene) {
  const Url = (chemin) => chemin + ParametreAntiCache;
  const Feuille = (cle, chemin, largeur, hauteur = largeur) =>
    Scene.load.spritesheet(cle, Url(chemin), { frameWidth: largeur, frameHeight: hauteur });

  // Assets Tiled : seulement si le mode carte est actif, pour ne pas tenter
  // de charger des fichiers absents.
  if (UtiliseCarteTiled) {
    Scene.load.image(CleTuiles, Url(CheminTuiles));

    // Cle de cache = nom de la carte (pose par init()) et non une cle fixe,
    // pour que chaque carte ait sa propre entree apres un scene.restart(...).
    Scene.load.tilemapTiledJSON(Scene.NomCarteActuelle, Url(`assets/maps/${Scene.NomCarteActuelle}.json`));

    Feuille(CleGare, CheminGare, TailleImageGare);
    Feuille(CleHerbe, CheminHerbe, TailleImageHerbe);
    Feuille(CleIconeInteraction, CheminIconeInteraction, TailleIconeInteraction);
    Feuille(CleTele, CheminTele, TailleImageTele);
    Feuille(CleTeleMort, CheminTeleMort, TailleImageTele);

    // Tous les PNJ connus (voir CreerPNJs), utilises ou non sur cette carte.
    SpritesPNJConnus.forEach((p) => Feuille(p.Cle, p.Chemin, p.LargeurFrame, p.HauteurFrame));
  }

  if (UtiliseSpritePersonnage) {
    Feuille(ClePersonnage, CheminPersonnage, LargeurImagePersonnage, HauteurImagePersonnage);
  }
}
