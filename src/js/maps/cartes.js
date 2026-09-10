// cartes.js — gestion des cartes, partie commune.
//
// Chaque carte vit dans src/js/maps/map-<n>-<nom>/ et s'y enregistre via
// EnregistrerCarte(...). game.js lit le registre au demarrage puis appelle,
// aux bons moments, les hooks de la carte active (precharger / auChargement /
// aLaMiseAJour). Charge avant les fichiers de carte et avant game.js.


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
// Config : { cle, numero, nom, depart?, suivante?,
//            precharger?(Scene), auChargement?(Scene), aLaMiseAJour?(Scene, Temps, TempsEcoule) }
function EnregistrerCarte(Config) {
  RegistreCartes[Config.cle] = Config;
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

// Appelle un hook optionnel de la carte active, s'il est defini.
function DeclencherHookCarte(Scene, NomHook, ...Args) {
  const Carte = RegistreCartes[Scene.NomCarteActuelle];
  if (Carte && typeof Carte[NomHook] === 'function') {
    Carte[NomHook](Scene, ...Args);
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
