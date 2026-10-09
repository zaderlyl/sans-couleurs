// features/tir.js — le TIR du joueur souris.
//
// Comment ca marche :
//   - On maintient Ctrl (ou Cmd sur Mac) : on est en "mode tir" (le curseur
//     devient un viseur, et la souris ne survole plus les elements du monde).
//   - On clique : un projectile (une goutte de couleur) part du joueur et vole
//     en ligne droite jusqu'a l'endroit clique, ou il eclate en une petite
//     tache de couleur.
//   - Il eclate aussi plus tot s'il rencontre un mur (une tuile solide), et
//     il ne va jamais plus loin que PorteeMax.
//   - Les couleurs se suivent : rouge, vert, bleu, rouge...
//
// Qui detecte le clic ? interaction-souris.js (InstallerInteractionSouris) :
// il distingue le clic "normal" (marcher / interagir) du clic de tir (avec
// Ctrl ou Cmd) et nous laisse, pour un clic de tir, Scene.TirDemande =
// { EcranX, EcranY } (le point de l'ecran clique). Ici, on le convertit en
// point du monde, on cree le projectile et on le fait avancer.
//
// Etat garde sur la scene :
//   Scene.ModeTir            : true tant que Ctrl ou Cmd est maintenu.
//   Scene.GroupeProjectiles  : les projectiles en vol (groupe de sprites physiques).
//   Scene.ProchainTirPossible: heure (ms) avant laquelle on ne peut pas retirer.
//   Scene.IndexCouleurTir    : prochaine couleur de la serie rouge/vert/bleu.

import { PointMondeEcran } from '../camera-separee.js';
import { JouerSonTir, JouerSonImpactTir } from '../sons.js';

// --- Reglages ------------------------------------------------------------

const CleTextureGoutte = 'goutteTir';
const TailleGoutte = 4;           // px du monde (le personnage fait 16 px)
const VitesseProjectile = 260;    // px du monde par seconde
const PorteeMax = 400;            // un tir ne va jamais plus loin que ca
const DelaiEntreTirsMs = 250;     // delai minimum entre deux tirs
const DecalageDepart = 6;         // le projectile part un peu devant le joueur
const CouleursTir = [0xff2a4a, 0x2aff6a, 0x2a7bff]; // rouge, vert, bleu
const ProfondeurProjectile = 18;  // au-dessus du decor, sous les icones (20)

// L'eclat (la tache) a l'impact.
const DureeTache = 280;           // ms
const RayonDepartTache = 2;       // px
const GrossissementTache = 3;     // la tache grossit de x3 en s'effacant


export const Tir = {
  nom: 'tir',

  installer(Scene) {
    Scene.ModeTir = false;
    Scene.ProchainTirPossible = 0;
    Scene.IndexCouleurTir = 0;

    CreerTextureGoutte(Scene);
    // allowGravity: false -> les projectiles volent droit (pas de chute).
    Scene.GroupeProjectiles = Scene.physics.add.group({ allowGravity: false });

    // Ctrl + clic est un clic droit sur Mac : on empeche le menu du navigateur.
    Scene.input.mouse.disableContextMenu();

    SuivreMaintienCtrlCmd(Scene);
  },

  // Fin de create() : le calque de collision du sol existe (Scene.CalqueCollision).
  apresChargement(Scene) {
    // Un projectile qui touche une tuile solide eclate a cet endroit.
    Scene.physics.add.collider(Scene.GroupeProjectiles, Scene.CalqueCollision, (Projectile) => {
      Eclater(Scene, Projectile);
    });
  },

  miseAJour(Scene) {
    // 1) Un clic de tir a ete fait ? (on le consomme, une seule fois)
    const Demande = Scene.TirDemande;
    Scene.TirDemande = null;
    if (Demande && TirPossible(Scene)) {
      TirerVers(Scene, PointMondeEcran(Scene, Demande.EcranX, Demande.EcranY));
    }

    // 2) Fait avancer les projectiles en vol : arrivee a destination, sortie
    //    de la carte.
    MettreAJourProjectiles(Scene);
  },
};


// --- Mise en place -------------------------------------------------------

// Une petite goutte blanche, teintee ensuite de la couleur du tir
// (setTint) : une seule texture pour les trois couleurs.
function CreerTextureGoutte(Scene) {
  if (Scene.textures.exists(CleTextureGoutte)) return;
  const Dessin = Scene.make.graphics({ x: 0, y: 0, add: false });
  Dessin.fillStyle(0xffffff, 1);
  Dessin.fillCircle(TailleGoutte / 2, TailleGoutte / 2, TailleGoutte / 2);
  Dessin.generateTexture(CleTextureGoutte, TailleGoutte, TailleGoutte);
  Dessin.destroy();
}

// Scene.ModeTir = true tant que Ctrl ou Cmd est enfonce. On ecoute le clavier
// de la page (window) plutot que Phaser : Ctrl et Cmd y sont fiables sur toutes
// les machines. Les ecouteurs sont retires quand la scene s'arrete (changement
// de carte, mort...), sinon ils s'accumuleraient.
function SuivreMaintienCtrlCmd(Scene) {
  let ControleEnfonce = false;
  let CommandeEnfoncee = false;

  const Actualiser = () => {
    Scene.ModeTir = ControleEnfonce || CommandeEnfoncee;
  };
  const QuandToucheEnfoncee = (Evenement) => {
    if (Evenement.key === 'Control') ControleEnfonce = true;
    if (Evenement.key === 'Meta') CommandeEnfoncee = true;
    Actualiser();
  };
  const QuandToucheRelachee = (Evenement) => {
    if (Evenement.key === 'Control') ControleEnfonce = false;
    if (Evenement.key === 'Meta') CommandeEnfoncee = false;
    Actualiser();
  };
  // Si la fenetre perd le focus pendant que la touche est enfoncee, on ne
  // recevra jamais le "relache" : on remet tout a zero pour ne pas rester
  // bloque en mode tir.
  const QuandFocusPerdu = () => {
    ControleEnfonce = false;
    CommandeEnfoncee = false;
    Actualiser();
  };

  window.addEventListener('keydown', QuandToucheEnfoncee);
  window.addEventListener('keyup', QuandToucheRelachee);
  window.addEventListener('blur', QuandFocusPerdu);

  Scene.events.once('shutdown', () => {
    window.removeEventListener('keydown', QuandToucheEnfoncee);
    window.removeEventListener('keyup', QuandToucheRelachee);
    window.removeEventListener('blur', QuandFocusPerdu);
    Scene.ModeTir = false;
  });
}


// --- Tirer -----------------------------------------------------------------

// Peut-on tirer maintenant ? Pas pendant un voyage, un dialogue, un portail ou
// l'ecran de mort, ni avant la fin du delai entre deux tirs.
function TirPossible(Scene) {
  if (Scene.EtatGare === 'enCours' || Scene.DialogueOuvert || Scene.GlitchEtatFin || Scene.PortailEnCours) {
    return false;
  }
  return Scene.time.now >= Scene.ProchainTirPossible;
}

// Cree un projectile qui part du joueur et va vers `Cible` ({x, y} du monde).
function TirerVers(Scene, Cible) {
  const Joueur = Scene.Personnage;
  const DepartX = Joueur.x;
  const DepartY = Joueur.y - 2; // vers le milieu du corps

  // Direction : l'angle du joueur vers le point clique.
  const Angle = Phaser.Math.Angle.Between(DepartX, DepartY, Cible.x, Cible.y);
  const Distance = Phaser.Math.Distance.Between(DepartX, DepartY, Cible.x, Cible.y);
  // Le projectile va jusqu'au point clique, mais pas plus loin que la portee max.
  const DistanceTir = Math.min(Distance, PorteeMax);

  // Il apparait un peu devant le joueur, dans la direction du tir.
  const X = DepartX + Math.cos(Angle) * DecalageDepart;
  const Y = DepartY + Math.sin(Angle) * DecalageDepart;

  const Projectile = Scene.GroupeProjectiles.create(X, Y, CleTextureGoutte);
  Projectile.setDepth(ProfondeurProjectile);
  Projectile.setTint(CouleursTir[Scene.IndexCouleurTir]);
  Projectile.body.setAllowGravity(false);
  Projectile.body.setVelocity(Math.cos(Angle) * VitesseProjectile, Math.sin(Angle) * VitesseProjectile);

  // Ou le projectile doit eclater (le point d'arrivee), retenu sur lui.
  Projectile.ArriveeX = DepartX + Math.cos(Angle) * DistanceTir;
  Projectile.ArriveeY = DepartY + Math.sin(Angle) * DistanceTir;
  Projectile.Couleur = CouleursTir[Scene.IndexCouleurTir];

  // Couleur suivante, et delai avant le prochain tir.
  Scene.IndexCouleurTir = (Scene.IndexCouleurTir + 1) % CouleursTir.length;
  Scene.ProchainTirPossible = Scene.time.now + DelaiEntreTirsMs;

  JouerSonTir();
}


// --- Vie d'un projectile --------------------------------------------------

function MettreAJourProjectiles(Scene) {
  // Pas de tableau a part : on parcourt le groupe. (Copie avec getChildren().slice()
  // car Eclater() retire le projectile du groupe pendant la boucle.)
  Scene.GroupeProjectiles.getChildren().slice().forEach((Projectile) => {
    // Sorti de la carte : on le retire sans effet.
    if (Projectile.x < 0 || Projectile.x > Scene.LargeurMondeCarte ||
        Projectile.y < 0 || Projectile.y > Scene.HauteurMondeCarte) {
      Projectile.destroy();
      return;
    }

    // Arrive a destination ? On compare la distance au point d'arrivee au
    // chemin qu'il parcourt en une image (VitesseProjectile / 60 ~ 4 px) : s'il
    // est assez proche pour l'atteindre cette image-ci, il eclate.
    const Reste = Phaser.Math.Distance.Between(Projectile.x, Projectile.y, Projectile.ArriveeX, Projectile.ArriveeY);
    if (Reste <= VitesseProjectile / 60) {
      Projectile.setPosition(Projectile.ArriveeX, Projectile.ArriveeY);
      Eclater(Scene, Projectile);
    }
  });
}

// Le projectile disparait et laisse une petite tache qui grossit en s'effacant.
function Eclater(Scene, Projectile) {
  if (!Projectile.active) return; // deja eclate (collision + arrivee la meme image)

  const Tache = Scene.add.circle(Projectile.x, Projectile.y, RayonDepartTache, Projectile.Couleur);
  Tache.setDepth(ProfondeurProjectile);
  Scene.tweens.add({
    targets: Tache,
    scale: GrossissementTache,
    alpha: 0,
    duration: DureeTache,
    ease: 'Sine.easeOut',
    onComplete: () => Tache.destroy(),
  });

  JouerSonImpactTir();
  Projectile.destroy();
}
