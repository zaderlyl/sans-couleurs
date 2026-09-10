// map-1-debut — premiere carte du jeu (le point de depart).
// Rien de specifique pour l'instant : juste sa config.

EnregistrerCarte({
  cle: 'map-1-debut',
  numero: 1,
  nom: 'debut',
  depart: true,               // ouverte au lancement, sauf ?carte=<autre>
  suivante: 'map-2-enfance',   // le train mene a enfance
});
