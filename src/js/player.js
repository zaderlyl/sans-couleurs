// player.js — le personnage : creation et deplacement image par image.
//
// - CreerPersonnage(Scene, x, y)  : une fois, depuis create()
// - MettreAJourDeplacement(...)   : chaque frame, depuis update()
//   (sauf pendant un voyage en train ou un dialogue PNJ — l'appelant filtre)
//
// Reglages (vitesse, frames, tangage, poussiere) : playerConfig.js.
// `Scene` est l'instance de ScenePrincipale.


// --- Creation --------------------------------------------------------

// Cree Scene.Personnage + son emetteur de poussiere, et pose l'etat de
// deplacement. Le collider avec le sol est branche par l'appelant (lui seul
// connait le calque). Renvoie le personnage.
function CreerPersonnage(Scene, PositionDepartX, PositionDepartY) {
  if (UtiliseSpritePersonnage) {
    Scene.Personnage = Scene.physics.add.sprite(PositionDepartX, PositionDepartY, ClePersonnage);

    Scene.anims.create({
      key: 'marche',
      frames: Scene.anims.generateFrameNumbers(ClePersonnage, { start: FramePersoMarcheDebut, end: FramePersoMarcheFin }),
      frameRate: 8,
      repeat: -1,
    });

    Scene.Personnage.setFlipX(false);
    Scene.Personnage.setFrame(FramePersoImmobile);
  } else {
    // Mode prototype (UtiliseSpritePersonnage = false) : rectangle blanc.
    Scene.Personnage = Scene.add.rectangle(PositionDepartX, PositionDepartY, 22, 44, CouleurPersonnage);
    Scene.physics.add.existing(Scene.Personnage);
  }
  Scene.Personnage.body.setCollideWorldBounds(true);

  CreerEmetteurPoussiere(Scene);

  // Etat de deplacement, relu/mis a jour chaque frame.
  Scene.Orientation = 'droite'; // dernier sens regarde ('gauche' | 'droite')
  Scene.EtaitAuSol = true;      // pour detecter le front montant de l'atterrissage
  Scene.DelaiProchainPas = 0;   // compte a rebours (ms) avant le prochain pas
  Scene.IntensiteMarche = 0;    // 0..1, voir playerConfig.js

  return Scene.Personnage;
}

// Texture 4x4 (petit cercle gris) + emetteur cale derriere le personnage.
// Une texture generee suffit, pas besoin d'un fichier.
function CreerEmetteurPoussiere(Scene) {
  const Dessin = Scene.make.graphics({ x: 0, y: 0, add: false });
  Dessin.fillStyle(CouleurPoussiere, 1);
  Dessin.fillCircle(2, 2, 2);
  Dessin.generateTexture('particulePoussiere', 4, 4);
  Dessin.destroy();

  Scene.EmetteurPoussiere = Scene.add.particles(0, 0, 'particulePoussiere', ConfigEmetteurPoussiere);
  Scene.EmetteurPoussiere.setDepth(ProfondeurPoussiere);
}


// --- Deplacement (une frame) ----------------------------------------

function MettreAJourDeplacement(Scene, Temps, TempsEcoule) {
  const Entrees = LireDeplacement(Scene);
  const AuSol = Scene.Personnage.body.blocked.down;

  DeplacerHorizontalement(Scene, Entrees);
  RythmerLesPas(Scene, Entrees, AuSol, TempsEcoule);
  AppliquerRessentiMarche(Scene, Entrees, AuSol, Temps);
  GererChuteEtAtterrissage(Scene, AuSol);
}

// Vitesse + orientation + animation marche / pose immobile.
function DeplacerHorizontalement(Scene, Entrees) {
  const Corps = Scene.Personnage.body;

  if (Entrees.Gauche || Entrees.Droite) {
    const VersGauche = Entrees.Gauche; // gauche prioritaire si les deux touches sont pressees
    Corps.setVelocityX(VersGauche ? -VitesseMarchePersonnage : VitesseMarchePersonnage);
    Scene.Orientation = VersGauche ? 'gauche' : 'droite';
    if (UtiliseSpritePersonnage) {
      Scene.Personnage.setFlipX(VersGauche);
      Scene.Personnage.anims.play('marche', true); // true : ne redemarre pas si deja en cours
    }
    return;
  }

  Corps.setVelocityX(0);
  if (UtiliseSpritePersonnage) {
    Scene.Personnage.anims.stop();
    Scene.Personnage.setFlipX(Scene.Orientation === 'gauche'); // garde le dernier sens regarde
    Scene.Personnage.setFrame(FramePersoImmobile);
  }
}

// Son de pas + petit nuage de poussiere, cadences en ms (pas par frame).
function RythmerLesPas(Scene, Entrees, AuSol, TempsEcoule) {
  const Marche = (Entrees.Gauche || Entrees.Droite) && AuSol;
  if (!Marche) {
    Scene.DelaiProchainPas = 0; // pret a jouer un pas des la reprise
    return;
  }

  Scene.DelaiProchainPas -= TempsEcoule;
  if (Scene.DelaiProchainPas <= 0) {
    JouerSonPas();
    Scene.EmetteurPoussiere.explode(NbPoussiereParPas, Scene.Personnage.x, Scene.Personnage.y + DecalagePoussiereY);
    Scene.DelaiProchainPas = IntervalleParPasMs;
  }
}

// Intensite de marche (fondu) + tangage du sprite. S'annulent tout seuls a
// l'arret ou en l'air puisque l'intensite retombe a 0.
function AppliquerRessentiMarche(Scene, Entrees, AuSol, Temps) {
  const IntensiteVoulue = (Entrees.Gauche || Entrees.Droite) && AuSol ? 1 : 0;
  Scene.IntensiteMarche = Phaser.Math.Linear(Scene.IntensiteMarche, IntensiteVoulue, VitesseFonduMarche);

  if (UtiliseSpritePersonnage) {
    Scene.Personnage.rotation = Math.sin(Temps * FrequenceTangagePersonnage) * AmplitudeTangagePersonnage * Scene.IntensiteMarche;
  }
}

// Frame de chute (prioritaire sur marche/immobile) puis reception au sol.
function GererChuteEtAtterrissage(Scene, AuSol) {
  const Perso = Scene.Personnage;

  if (UtiliseSpritePersonnage && !AuSol) {
    Perso.anims.stop();
    Perso.setFrame(FramePersoImmobile);
  }

  // Front montant de "au sol" = le joueur vient de toucher terre.
  if (!Scene.EtaitAuSol && AuSol) {
    JouerSonAtterrissage();
    Scene.EmetteurPoussiere.explode(NbPoussiereAtterrissage, Perso.x, Perso.y + DecalagePoussiereY);
    if (UtiliseSpritePersonnage) Perso.setFrame(FramePersoAtterrissage);
  }
  Scene.EtaitAuSol = AuSol;
}
