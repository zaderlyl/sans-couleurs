// map-TEST-map1 — carte de test (la toute premiere, prototype).
// Seule carte a porter l'ecran de tele.
//
// L'ordre du tableau `features` = ordre d'installation : mettre en premier ce
// qui doit s'afficher derriere (la tele n'a pas de depth forcee, elle doit
// etre creee avant l'herbe).

EnregistrerCarte({
  cle: 'map-TEST-map1',
  numero: 'TEST',
  nom: 'map1',
  // pas de carte suivante
  features: [TextesDeZone, Tele, Herbe, Tunnel],
});
