// player.js — creation du personnage et logique de deplacement par frame.
// CreerPersonnage(this, x, y) est appele une fois depuis create() ;
// MettreAJourDeplacement(this, Temps, TempsEcoule) est appele a chaque frame
// depuis update() (sauf pendant le voyage en train ou un dialogue PNJ).
// Les reglages (vitesse, cadence des pas, tangage) sont dans playerConfig.js.

// Cree Scene.Personnage (sprite anime si UtiliseSpritePersonnage, sinon
// rectangle blanc de secours), son emetteur de poussiere, et initialise
// l'etat de deplacement (orientation, suivi de l'atterrissage, intensite de
// marche). Le collider avec le sol est ajoute par l'appelant (il connait le
// calque de sol). Renvoie le personnage cree.
function CreerPersonnage(Scene, PositionDepartX, PositionDepartY) {
  if (UtiliseSpritePersonnage) {
    // physics.add.sprite cree directement un GameObject anime + son corps physique
    Scene.Personnage = Scene.physics.add.sprite(PositionDepartX, PositionDepartY, ClePersonnage);

    // player.png fait 96x16 -> 6 frames de 16x16 (voir la repartition dans
    // playerConfig.js). Cycle de marche = frames 4 et 5, inversees
    // horizontalement pour la gauche via setFlipX.
    Scene.anims.create({
      key: 'marche',
      frames: Scene.anims.generateFrameNumbers(ClePersonnage, { start: 4, end: 5 }),
      frameRate: 8,
      repeat: -1,
    });

    // Pose immobile (frame 3, standby) et orientation par defaut au
    // demarrage — un seul jeu de frames, gauche/droite s'obtient par flip.
    Scene.Orientation = 'droite';
    Scene.Personnage.setFlipX(false);
    Scene.Personnage.setFrame(3);
  } else {
    // Placeholder : simple rectangle blanc, pas encore de sprite reel
    Scene.Personnage = Scene.add.rectangle(PositionDepartX, PositionDepartY, 22, 44, CouleurPersonnage);
    Scene.physics.add.existing(Scene.Personnage); // false/omis = corps dynamique (soumis a la gravite)
  }
  Scene.Personnage.body.setCollideWorldBounds(true);

  // Petite texture generee (4x4, cercle gris) pour les particules de
  // poussiere — pas besoin d'un fichier image pour un effet aussi simple.
  const DessinPoussiere = Scene.make.graphics({ x: 0, y: 0, add: false });
  DessinPoussiere.fillStyle(0x999999, 1);
  DessinPoussiere.fillCircle(2, 2, 2);
  DessinPoussiere.generateTexture('particulePoussiere', 4, 4);
  DessinPoussiere.destroy();

  // emitting:false : l'emetteur ne crache rien tout seul, on declenche des
  // "explosions" ponctuelles a la demande (pas, atterrissage — voir
  // MettreAJourDeplacement).
  Scene.EmetteurPoussiere = Scene.add.particles(0, 0, 'particulePoussiere', {
    speed: { min: 20, max: 60 },
    angle: { min: 200, max: 340 }, // eventail vers le haut (0=droite, 90=bas)
    lifespan: 300,
    scale: { start: 1, end: 0 },
    alpha: { start: 0.8, end: 0 },
    quantity: 6,
    emitting: false,
  });
  Scene.EmetteurPoussiere.setDepth(4);

  // Pour detecter l'atterrissage (front montant de body.blocked.down) et
  // cadencer le bruit de pas independamment du framerate.
  Scene.EtaitAuSol = true;
  Scene.DelaiProchainPas = 0;

  // Intensite de marche (0 = immobile, 1 = pleine marche), remonte/redescend
  // en fondu via VitesseFonduMarche — voir MettreAJourDeplacement (tangage du
  // personnage) et MettreAJourCamera (anticipation de la camera).
  Scene.IntensiteMarche = 0;

  return Scene.Personnage;
}

// Deplacement + animation + bruits de pas + poussiere + tangage +
// atterrissage, pour une frame. L'appelant garantit deja qu'on n'est ni en
// plein voyage en train (EtatGare 'enCours') ni dans un dialogue PNJ.
function MettreAJourDeplacement(Scene, Temps, TempsEcoule) {
  const Corps = Scene.Personnage.body;
  const { Gauche, Droite } = LireDeplacement(Scene);

  if (Gauche) {
    Corps.setVelocityX(-VitesseMarchePersonnage);
    Scene.Orientation = 'gauche';
    if (UtiliseSpritePersonnage) {
      Scene.Personnage.setFlipX(true); // retourne le sprite vers la gauche
      Scene.Personnage.anims.play('marche', true);
    }
  } else if (Droite) {
    Corps.setVelocityX(VitesseMarchePersonnage);
    Scene.Orientation = 'droite';
    if (UtiliseSpritePersonnage) {
      Scene.Personnage.setFlipX(false);
      Scene.Personnage.anims.play('marche', true);
    }
  }

  // Bruit de pas + petit nuage de poussiere sous les pieds : seulement en
  // marchant au sol, cadence par un compte a rebours en ms (independant du
  // framerate) plutot que toutes les frames. Meme emetteur que
  // l'atterrissage, juste avec moins de particules — un nuage discret plutot
  // qu'une explosion.
  if ((Gauche || Droite) && Corps.blocked.down) {
    Scene.DelaiProchainPas -= TempsEcoule;
    if (Scene.DelaiProchainPas <= 0) {
      JouerSonPas();
      Scene.EmetteurPoussiere.explode(2, Scene.Personnage.x, Scene.Personnage.y + 8);
      Scene.DelaiProchainPas = IntervalleParPasMs;
    }
  } else {
    Scene.DelaiProchainPas = 0; // pret a jouer un pas des la reprise de la marche
  }

  // Intensite de marche (voir playerConfig.js) : meme condition que le bruit
  // de pas (marche au sol), montee/descente en fondu pour ne pas
  // s'enclencher/s'arreter d'un coup.
  const IntensiteMarcheVoulue = (Gauche || Droite) && Corps.blocked.down ? 1 : 0;
  Scene.IntensiteMarche = Phaser.Math.Linear(Scene.IntensiteMarche, IntensiteMarcheVoulue, VitesseFonduMarche);

  // Tangage : leger balancement de rotation du personnage en marchant, comme
  // une demarche naturelle. S'annule tout seul en fondu avec l'intensite
  // (donc aussi a l'arret ou en l'air, sans avoir besoin de le remettre a
  // zero explicitement ailleurs).
  if (UtiliseSpritePersonnage) {
    Scene.Personnage.rotation = Math.sin(Temps * FrequenceTangagePersonnage) * AmplitudeTangagePersonnage * Scene.IntensiteMarche;
  }

  if (!Gauche && !Droite) {
    Corps.setVelocityX(0);
    if (UtiliseSpritePersonnage) {
      // Immobile (frame 3) : flip selon la derniere direction regardee, meme
      // mecanisme que la marche (plus de frames idle distinctes par sens).
      Scene.Personnage.anims.stop();
      Scene.Personnage.setFlipX(Scene.Orientation === 'gauche');
      Scene.Personnage.setFrame(3);
    }
  }

  // Pas de saut : le personnage ne quitte le sol que s'il marche hors d'une
  // plateforme (la gravite fait le reste). En l'air, en priorite sur la
  // marche/idle ci-dessus qui aurait pu s'appliquer si des touches de
  // direction sont tenues en meme temps — frame 4 (index 3, standby) pendant
  // la chute.
  if (UtiliseSpritePersonnage && !Corps.blocked.down) {
    Scene.Personnage.anims.stop();
    Scene.Personnage.setFrame(3);
  }

  // Atterrissage : front montant de Corps.blocked.down (faux la frame d'avant,
  // vrai maintenant) = le joueur vient de toucher le sol.
  if (!Scene.EtaitAuSol && Corps.blocked.down) {
    JouerSonAtterrissage();
    Scene.EmetteurPoussiere.explode(6, Scene.Personnage.x, Scene.Personnage.y + 8);
    // Reprend le frame 2 (index 1), un instant avant de repasser en
    // marche/idle a la frame suivante.
    if (UtiliseSpritePersonnage) {
      Scene.Personnage.setFrame(1);
    }
  }
  Scene.EtaitAuSol = Corps.blocked.down;
}
