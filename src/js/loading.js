// loading.js — phase preload() : dit a Phaser quels fichiers charger.
// ScenePrincipale.preload() appelle juste PrechargerAssets(this).
//
// Les assets partages (tileset, gare, icone d'interaction, personnage) sont
// ici ; ceux propres a une feature sont declares par cette feature (hook
// precharger, voir PrechargerFeaturesCarte).

// Anti-cache dev : le serveur local (python -m http.server) ne renvoie aucun
// en-tete de cache, donc un asset modifie sur le disque peut rester servi
// depuis l'ancienne version. Un "?v=..." different a chaque chargement force
// une version fraiche.
const ParametreAntiCache = `?v=${Date.now()}`;

// Helpers reutilises par les hooks "precharger" des features.
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

    ChargerFeuille(Scene, CleIconeInteraction, CheminIconeInteraction, TailleIconeInteraction);

    // Assets des features de la carte active (gare, tele, PNJ, herbe...).
    PrechargerFeaturesCarte(Scene);
  }

  if (UtiliseSpritePersonnage) {
    ChargerFeuille(Scene, ClePersonnage, CheminPersonnage, LargeurImagePersonnage, HauteurImagePersonnage);
  }
}
