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
// Garde-fou : si la cible est bloquee par un obstacle (un mur : le joueur
// n'avance plus), il ne doit pas rester coince a marcher dedans pour toujours.
// Apres ce delai SANS avancer, on considere qu'il est "arrive" (et on
// declenche l'interaction depuis la ou il s'est arrete). On mesure l'immobilite
// plutot que la duree totale : une longue marche en terrain libre est normale.
const DelaiBloqueAutoMarcheMs = 500;
const AvanceeMinimaleParFrame = 0.2; // px monde : en dessous, on est considere immobile

export function InstallerAutoMarche(Scene) {
  Scene.CibleAutoMarcheX = null;
  Scene.ApresAutoMarche = null;
  Scene.DureeBloqueAutoMarcheMs = 0;
  Scene.DerniereXAutoMarche = 0;
  Scene.SiAnnuleAutoMarche = null;
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

// ApresArrivee (optionnel) : appele a l'arrivee. SiAnnule (optionnel) : appele
// si une nouvelle marche remplace celle-ci avant l'arrivee (ex. le joueur
// reclique ailleurs) — pour que l'appelant puisse se remettre en ordre.
export function DemarrerAutoMarche(Scene, CibleX, ApresArrivee, SiAnnule) {
  if (Scene.CibleAutoMarcheX !== null && Scene.SiAnnuleAutoMarche) Scene.SiAnnuleAutoMarche();
  Scene.CibleAutoMarcheX = CibleX;
  Scene.ApresAutoMarche = ApresArrivee || null;
  Scene.SiAnnuleAutoMarche = SiAnnule || null;
  Scene.DureeBloqueAutoMarcheMs = 0;
  Scene.DerniereXAutoMarche = Scene.Personnage.x;
}

// Petit anneau qui s'elargit et s'efface a l'endroit clique : montre ou le
// joueur va.
export function AfficherRepereDestination(Scene, X, Y) {
  const Anneau = Scene.add.circle(X, Y, 3);
  Anneau.setStrokeStyle(1, 0xffffff, 1);
  Anneau.setDepth(19); // sous les icones (20) mais au-dessus du decor
  Scene.tweens.add({
    targets: Anneau, scale: 2.2, alpha: 0, duration: 450, ease: 'Sine.easeOut',
    onComplete: () => Anneau.destroy(),
  });
}

// A appeler une fois par frame, apres MettreAJourDeplacement (scene-jeu.js) :
// verifie l'arrivee sur la position deja mise a jour cette frame (ou force
// l'arrivee si le joueur est bloque, voir DelaiBloqueAutoMarcheMs).
export function MettreAJourAutoMarche(Scene, TempsEcoule) {
  if (Scene.CibleAutoMarcheX === null) return;

  const Arrive = Math.abs(Scene.Personnage.x - Scene.CibleAutoMarcheX) <= SeuilArriveeAutoMarche;

  // Compte le temps passe sans avancer (mur, bord de la carte...).
  const Avancee = Math.abs(Scene.Personnage.x - Scene.DerniereXAutoMarche);
  Scene.DerniereXAutoMarche = Scene.Personnage.x;
  Scene.DureeBloqueAutoMarcheMs = Avancee < AvanceeMinimaleParFrame
    ? Scene.DureeBloqueAutoMarcheMs + TempsEcoule
    : 0;
  if (!Arrive && Scene.DureeBloqueAutoMarcheMs < DelaiBloqueAutoMarcheMs) return;

  Scene.CibleAutoMarcheX = null;
  Scene.SiAnnuleAutoMarche = null;
  const Callback = Scene.ApresAutoMarche;
  Scene.ApresAutoMarche = null;
  if (Callback) Callback();
}
