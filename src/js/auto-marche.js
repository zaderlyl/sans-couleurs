// auto-marche.js — fait marcher automatiquement le joueur jusqu'a une
// position X, puis appelle un callback une fois arrive.
//
// Utilise par interaction-souris.js : cliquer un element interactif, meme
// loin du joueur, l'envoie marcher jusque-la avant de jouer l'interaction,
// au lieu d'exiger d'y etre deja.
//
// Ne duplique pas l'animation/le son/la poussiere de marche : pendant
// l'auto-marche, LireDeplacement (controle.js) remplace juste la direction
// "clavier" par la direction vers la cible, donc MettreAJourDeplacement
// (player.js) tourne normalement, sans le savoir.

const SeuilArriveeAutoMarche = 4; // px monde : assez proche pour "etre arrive"
// Garde-fou : si la cible est bloquee par un obstacle (jamais atteinte a
// moins de SeuilArriveeAutoMarche), le joueur ne doit pas rester coince a
// marcher dans un mur pour toujours — au bout de ce delai, on declenche
// quand meme l'interaction depuis la ou il est arrive.
const DureeMaxAutoMarcheMs = 4000;

export function InstallerAutoMarche(Scene) {
  Scene.CibleAutoMarcheX = null;
  Scene.ApresAutoMarche = null;
  Scene.DureeAutoMarcheMs = 0;
}

// Direction vers la cible ({ Gauche, Droite }), ou null si pas d'auto-marche
// en cours — lu par LireDeplacement (controle.js) a la place du clavier.
export function DirectionAutoMarche(Scene) {
  if (Scene.CibleAutoMarcheX === null) return null;
  const Delta = Scene.CibleAutoMarcheX - Scene.Personnage.x;
  // Deja arrive (sous le seuil) : s'arrete tout de suite, pas un dernier pas
  // dans le vide — MettreAJourAutoMarche (appelee juste apres) fera le menage.
  if (Math.abs(Delta) <= SeuilArriveeAutoMarche) return { Gauche: false, Droite: false };
  return { Gauche: Delta < 0, Droite: Delta > 0 };
}

export function DemarrerAutoMarche(Scene, CibleX, ApresArrivee) {
  Scene.CibleAutoMarcheX = CibleX;
  Scene.ApresAutoMarche = ApresArrivee;
  Scene.DureeAutoMarcheMs = 0;
}

// A appeler une fois par frame, apres MettreAJourDeplacement (scene-jeu.js) :
// verifie l'arrivee sur la position deja mise a jour cette frame (ou force
// l'arrivee si ça traine trop longtemps, voir DureeMaxAutoMarcheMs).
export function MettreAJourAutoMarche(Scene, TempsEcoule) {
  if (Scene.CibleAutoMarcheX === null) return;

  Scene.DureeAutoMarcheMs += TempsEcoule;
  const Arrive = Math.abs(Scene.Personnage.x - Scene.CibleAutoMarcheX) <= SeuilArriveeAutoMarche;
  if (!Arrive && Scene.DureeAutoMarcheMs < DureeMaxAutoMarcheMs) return;

  Scene.CibleAutoMarcheX = null;
  const Callback = Scene.ApresAutoMarche;
  Scene.ApresAutoMarche = null;
  if (Callback) Callback();
}
