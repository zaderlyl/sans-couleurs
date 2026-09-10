// loading.js — phase preload() : dit a Phaser quels fichiers charger.
// ScenePrincipale.preload() appelle juste PrechargerAssets(this).

// Anti-cache dev : le serveur local (python -m http.server) ne renvoie aucun
// en-tete de cache, donc un asset modifie sur le disque peut rester servi
// depuis l'ancienne version. Un "?v=..." different a chaque chargement force
// une version fraiche.
const ParametreAntiCache = `?v=${Date.now()}`;

// Helpers reutilises par les hooks "precharger" des cartes (voir cartes.js).
function UrlAntiCache(Chemin) {
  return Chemin + ParametreAntiCache;
}
function ChargerFeuille(Scene, Cle, Chemin, Largeur, Hauteur = Largeur) {
  Scene.load.spritesheet(Cle, UrlAntiCache(Chemin), { frameWidth: Largeur, frameHeight: Hauteur });
}

function PrechargerAssets(Scene) {
  // Assets Tiled : seulement si le mode carte est actif, pour ne pas tenter
  // de charger des fichiers absents.
  if (UtiliseCarteTiled) {
    Scene.load.image(CleTuiles, UrlAntiCache(CheminTuiles));

    // Cle de cache = nom de la carte (pose par init()) et non une cle fixe,
    // pour que chaque carte ait sa propre entree apres un scene.restart(...).
    Scene.load.tilemapTiledJSON(Scene.NomCarteActuelle, UrlAntiCache(`assets/maps/${Scene.NomCarteActuelle}.json`));

    ChargerFeuille(Scene, CleGare, CheminGare, TailleImageGare);
    ChargerFeuille(Scene, CleHerbe, CheminHerbe, TailleImageHerbe);
    ChargerFeuille(Scene, CleIconeInteraction, CheminIconeInteraction, TailleIconeInteraction);

    // Tous les PNJ connus (voir CreerPNJs), utilises ou non sur cette carte.
    SpritesPNJConnus.forEach((p) => ChargerFeuille(Scene, p.Cle, p.Chemin, p.LargeurFrame, p.HauteurFrame));

    // Assets declares par les features de la carte active (ex: la tele).
    PrechargerFeaturesCarte(Scene);
  }

  if (UtiliseSpritePersonnage) {
    ChargerFeuille(Scene, ClePersonnage, CheminPersonnage, LargeurImagePersonnage, HauteurImagePersonnage);
  }
}
