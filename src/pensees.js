// pensees.js — les ecrans noirs entre les niveaux : une CONVERSATION entre les deux
// parts du personnage. J1 (a gauche) et J2 (a droite, en couleurs inversees) sont
// la meme personne : une part qui vit les choses, et une part independante qui
// l'aide a avancer (voir la memoire du projet). Chaque replique est { qui, texte } ;
// un clic passe a la suivante.
//
// Ce sont des BROUILLONS : a reecrire a ta facon.
//
//   de_2_vers_3 : entre le niveau 2 (l'enfance) et le niveau 3 (le college)
//   de_1_vers_2 : entre le niveau 1 (le debut) et le niveau 2 (l'enfance)
//   de_3_vers_4 : entre le niveau 3 (le college) et le niveau 4 (la coupure)
//   de_4_vers_5 : entre le niveau 4 et le niveau 5 (le lycee)

export var pensees = {
  de_1_vers_2: [
    { qui: "j1", texte: "Pourquoi on revient ici ?" },
    { qui: "j2", texte: "Parce que tout a commencé là." },
    { qui: "j1", texte: "Je ne m'en souviens pas bien." },
    { qui: "j2", texte: "Moi si. Je m'en souviens pour deux. Viens avec moi." }
  ],
  de_2_vers_3: [
    { qui: "j1", texte: "Ils se moquent de moi." },
    { qui: "j2", texte: "Je sais. Je l'ai entendu aussi." },
    { qui: "j1", texte: "Le collège sera pareil ?" },
    { qui: "j2", texte: "Peut-être. Mais on y va ensemble." }
  ],
  de_3_vers_4: [
    { qui: "j1", texte: "Je n'en peux plus." },
    { qui: "j2", texte: "Je sais." },
    { qui: "j1", texte: "Tu ne peux pas comprendre." },
    { qui: "j2", texte: "Je suis toi." }
  ],
  de_4_vers_5: [
    { qui: "j1", texte: "Et après ?" },
    { qui: "j2", texte: "Après, on continue. Ensemble." },
    { qui: "j1", texte: "Même si ça fait mal ?" },
    { qui: "j2", texte: "Surtout si ça fait mal." }
  ]
};
