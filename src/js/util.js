// util.js — petits utilitaires partages.

// Secoue un objet (petits decalages aleatoires) pendant `Duree` ms, amplitude
// `Intensite` px, puis le remet en place et appelle `ALaFin`.
// Utilise par la gare (train qui demarre) et la tele (ecran qui tremble).
function Secouer(Scene, Cible, Duree, Intensite, ALaFin) {
  const PositionInitialeX = Cible.x;
  const PositionInitialeY = Cible.y;

  const MinuteurTremblement = Scene.time.addEvent({
    delay: 40,
    loop: true,
    callback: () => {
      Cible.x = PositionInitialeX + Phaser.Math.Between(-Intensite, Intensite);
      Cible.y = PositionInitialeY + Phaser.Math.Between(-Intensite, Intensite);
    },
  });

  Scene.time.delayedCall(Duree, () => {
    MinuteurTremblement.remove();
    Cible.x = PositionInitialeX;
    Cible.y = PositionInitialeY;
    ALaFin();
  });
}
