// cartes.js — gestion des cartes, partie commune.
//
// Chaque carte vit dans src/js/maps/map-<n>-<nom>/ et s'y enregistre via
// EnregistrerCarte(...). Sa config liste les "features" qu'elle utilise
// (objets definis dans src/js/features/), et game.js appelle
// precharger / installer / miseAJour de chacune au bon moment.
// Charge avant les features, les fichiers de carte, et game.js.


// --- Tileset partage (toutes les cartes utilisent le meme) ---
const CleTuiles = 'tuiles';                         // cle de cache Phaser
const CheminTuiles = 'assets/tilesets/Tileset.png';
const NomTuilesDansTiled = 'Tileset';               // doit matcher le nom du tileset dans Tiled

// --- Noms de calques Tiled attendus ---
const NomCalqueSol = 'sol';                          // porte la collision
const NomCoucheObjets = "Calque d'Objets 1";         // spawn, PNJ, textes de zone


// --- Registre des cartes ---------------------------------------------

const RegistreCartes = {};

// Appelee par chaque map-*/*.js au chargement de la page.
// Config : { cle, numero, nom, depart?, suivante?, features? }
// features : tableau d'objets feature (voir src/js/features/), chacun avec
// des methodes optionnelles precharger(Scene) / installer(Scene, Ctx) /
// miseAJour(Scene, Temps, TempsEcoule).
function EnregistrerCarte(Config) {
  RegistreCartes[Config.cle] = Config;
}

// Les features de la carte active (tableau, vide si aucune).
function FeaturesCarteActive(Scene) {
  const Carte = RegistreCartes[Scene.NomCarteActuelle];
  return (Carte && Carte.features) || [];
}

// Carte a ouvrir au lancement : ?carte=<cle> en priorite (tests), sinon la
// carte marquee { depart: true }.
function CleCarteDeDepart() {
  const Demandee = new URLSearchParams(window.location.search).get('carte');
  if (Demandee) return Demandee;
  const Depart = Object.values(RegistreCartes).find((Carte) => Carte.depart);
  return Depart ? Depart.cle : null;
}

// Carte chargee quand on prend le train depuis `Cle` (null = pas de suite).
function CleCarteSuivante(Cle) {
  const Carte = RegistreCartes[Cle];
  return Carte && Carte.suivante ? Carte.suivante : null;
}

// preload() : laisse chaque feature de la carte declarer ses assets.
function PrechargerFeaturesCarte(Scene) {
  for (const Feature of FeaturesCarteActive(Scene)) {
    if (typeof Feature.precharger === 'function') Feature.precharger(Scene);
  }
}

// create() : installe chaque feature (dans l'ordre du tableau). Ctx porte la
// tilemap et le tileset deja prets : { Carte, JeuDeTuiles }. Une feature qui
// plante est signalee mais n'empeche pas les autres de s'installer.
function InstallerFeaturesCarte(Scene, Ctx) {
  for (const Feature of FeaturesCarteActive(Scene)) {
    if (typeof Feature.installer !== 'function') continue;
    try {
      Feature.installer(Scene, Ctx);
    } catch (Erreur) {
      console.error(`Feature "${Feature.nom}" — erreur a l'installation :`, Erreur);
    }
  }
}

// update() : met a jour chaque feature de la carte active.
function MettreAJourFeaturesCarte(Scene, Temps, TempsEcoule) {
  for (const Feature of FeaturesCarteActive(Scene)) {
    if (typeof Feature.miseAJour === 'function') Feature.miseAJour(Scene, Temps, TempsEcoule);
  }
}


// --- Lecture des calques Tiled --------------------------------------
// Ces helpers derivent des positions/zones du contenu reel de la carte
// active, au lieu de coder des coordonnees en dur valables pour une seule.

// Boite englobante en pixels des tuiles non vides d'un calque, ou null.
function CalculerBoitePixels(Carte, NomCalque) {
  const Calque = Carte.getLayer(NomCalque);
  if (!Calque) return null;

  let XMin = Infinity;
  let XMax = -Infinity;
  for (const Ligne of Calque.data) {
    for (const Tuile of Ligne) {
      if (Tuile && Tuile.index !== -1) {
        XMin = Math.min(XMin, Tuile.pixelX);
        XMax = Math.max(XMax, Tuile.pixelX + Tuile.width);
      }
    }
  }
  return XMin <= XMax ? { XMin, XMax } : null;
}

// Idem en indices de tuiles (colonne / rangee), ou null.
// FlipVoulu (optionnel) : ne compte que les tuiles dont le retournement
// horizontal (Tuile.flipX) vaut FlipVoulu — sert a isoler la mosaique miroir
// du calque "derriere" quand ce calque porte aussi d'autres reperes.
function CalculerBoiteTuiles(Carte, NomCalque, FlipVoulu) {
  const Calque = Carte.getLayer(NomCalque);
  if (!Calque) return null;

  let ColMin = Infinity;
  let ColMax = -Infinity;
  let RangeeMin = Infinity;
  let RangeeMax = -Infinity;
  for (const Ligne of Calque.data) {
    for (const Tuile of Ligne) {
      if (Tuile && Tuile.index !== -1 && (FlipVoulu === undefined || !!Tuile.flipX === FlipVoulu)) {
        ColMin = Math.min(ColMin, Tuile.x);
        ColMax = Math.max(ColMax, Tuile.x);
        RangeeMin = Math.min(RangeeMin, Tuile.y);
        RangeeMax = Math.max(RangeeMax, Tuile.y);
      }
    }
  }
  return ColMin <= ColMax ? { ColMin, ColMax, RangeeMin, RangeeMax } : null;
}

// Sens (Tuile.flipX) du calque, lu sur sa premiere tuile non vide. Suppose
// une mosaique dessinee uniformement. Sert a orienter le sprite de gare
// comme la mosaique statique de CETTE carte (ex: "enfance" l'a retournee).
function CalqueEstFlippe(Carte, NomCalque) {
  const Calque = Carte.getLayer(NomCalque);
  if (!Calque) return false;
  for (const Ligne of Calque.data) {
    for (const Tuile of Ligne) {
      if (Tuile && Tuile.index !== -1) return !!Tuile.flipX;
    }
  }
  return false;
}

// Proprietes personnalisees Tiled lues en nombre / booleen meme si leur type
// est reste "string" cote Tiled (le code accepte les deux).
function ValeurNombreTiled(Valeur, Defaut) {
  const Nombre = Number(Valeur);
  return Number.isNaN(Nombre) ? Defaut : Nombre;
}
function ValeurBooleenneTiled(Valeur) {
  if (typeof Valeur === 'string') return Valeur.trim().toLowerCase() === 'true';
  return !!Valeur;
}
