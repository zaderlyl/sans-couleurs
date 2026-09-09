// "Sans Couleurs" — prototype d'ouverture
// Un personnage blanc, seul, avance sur une ligne droite dans un decor bicolore.
//
// ── Structure des assets, quand tu les auras ──────────────────────────────
//   jeu/assets/tilesets/<nom>.png   -> l'image du tileset exportee depuis Tiled
//   jeu/assets/maps/<nom>.json      -> la map, exportee via Tiled : File > Export As > JSON
//   jeu/assets/sprites/<nom>.png    -> ta feuille de sprites (spritesheet) du personnage
//
// Pour brancher chaque partie, passe le flag correspondant a true ci-dessous
// et ajuste les constantes juste en dessous (chemins, noms, tailles de frame).
// Tant que les flags sont a false, le mode "prototype" actuel continue de
// tourner (ligne droite bicolore + rectangle blanc), donc rien ne casse.

const UtiliseCarteTiled = true;
const UtiliseSpritePersonnage = true;

// --- Tileset / Map (Tiled) ---
const CleTuiles = 'tuiles'; // nom interne, libre, utilise pour retrouver l'image chargee
const CheminTuiles = 'assets/tilesets/Tileset.png'; // chemin vers l'image exportee
const NomTuilesDansTiled = 'Tileset'; // DOIT correspondre exactement au nom du tileset DANS Tiled (panneau Tilesets)

// Carte de depart : "debut" par defaut (nouveau debut du jeu). Parametre
// d'URL ?carte=<nom> pour ouvrir directement une autre carte pendant les
// tests (ex: ?carte=enfance), sans repasser par le trajet en train complet.
const CleCarteChoisie = new URLSearchParams(window.location.search).get('carte') || 'debut';
// Enchainement des cartes : quelle carte suivante charger quand le joueur
// prend le train a la gare d'une carte donnee (voir DemarrerSequenceGare).
// Une carte absente d'ici (ex: pas encore de suite a "enfance") garde
// l'ancien comportement de secours : le train part, mais ne mene nulle part,
// le joueur reapparait simplement la ou il etait.
const CarteSuivante = {
  debut: 'enfance',
};
const NomCalqueSol = 'sol'; // le calque qui porte la collision — DOIT correspondre au nom DANS Tiled
// Les autres calques (bg, bg2, devant...) sont purement visuels, sans
// collision — leurs noms sont utilises directement dans create(). Toutes les
// cartes n'ont pas forcement les memes calques (ex: "debut" n'a pas encore
// de calque "derriere") : create() verifie leur presence avant de les
// utiliser plutot que de supposer qu'ils existent tous.

// --- Spritesheet du personnage ---
const ClePersonnage = 'personnage'; // nom interne, libre
const CheminPersonnage = 'assets/sprites/player.png'; // chemin vers ta feuille de sprites
const LargeurImagePersonnage = 16; // largeur en pixels d'une frame (player.png = 96x16 -> 6 frames de 16)
const HauteurImagePersonnage = 16; // hauteur en pixels d'une frame
// Repartition des 6 frames (indices 0 a 5) — voir animations plus bas :
//   1 (index 0) : inutilisee pour l'instant
//   2 (index 1) : reprise a l'atterrissage (pas de saut : seule la chute
//                 en marchant hors d'une plateforme declenche l'etat "en l'air")
//   3 (index 2) : inutilisee pour l'instant (ancien frame de saut)
//   4 (index 3) : immobile (standby), et pendant la chute
//   5 et 6 (index 4-5) : cycle de marche
// Un seul jeu de frames pour les deux sens : gauche/droite s'obtient par
// setFlipX, applique uniformement a tous les etats (plus de frames idle
// distinctes par sens comme avant).

// Echelle d'affichage du pixel art (tuiles de 16px, sinon minuscule a l'ecran)
const ZoomCamera = 5;

// --- Pseudo-realisme du deplacement ---
// this.IntensiteMarche (0 = immobile, 1 = pleine marche) monte/descend en
// fondu plutot que de s'enclencher/s'arreter d'un coup (voir update()), et
// sert de base a plusieurs petits effets synchronises sur la marche :
// tangage du personnage, anticipation de la camera dans le sens du regard.
const VitesseFonduMarche = 0.15; // vitesse de montee/descente de l'intensite, par frame

// Tangage du personnage : leger balancement de rotation, comme une demarche
// naturelle. Periode calquee sur la cadence des pas (voir DelaiProchainPas,
// 260ms) : un cycle complet du tangage dure deux pas.
const AmplitudeTangagePersonnage = 0.06; // radians (~3.4 degres) a pleine intensite
const PeriodeTangagePersonnage = 260 * 2; // ms — deux pas = un cycle complet
const FrequenceTangagePersonnage = (2 * Math.PI) / PeriodeTangagePersonnage;

// Anticipation de la camera : legerement decalee dans le sens du regard du
// personnage pendant la marche, pour montrer un peu plus loin devant que
// derriere (voir MettreAJourCamera). Le lerp deja en place sur scrollX
// (voir plus bas) suffit a lisser la transition, pas besoin d'un fondu
// separe — this.IntensiteMarche s'en charge deja.
const DecalageAnticipationCameraMax = 14; // pixels MONDE, decalage max

// --- Herbe animee (animated_grass.png) ---
// Les brins d'herbe sont des tuiles figees dans le calque "devant" (GID 33 a
// 36 = les 4 variantes de grass.png, dans l'ordre). animated_grass.png
// reprend le meme ordre de variantes, mais avec 3 frames chacune au lieu
// d'une seule : [statique, penche a droite, penche a gauche]. On detecte la
// variante d'une tuile via son GID, on retrouve son groupe de 3 frames dans
// animated_grass, et on bascule sur la frame qui correspond au sens de
// deplacement du joueur quand il passe a proximite.
const CleHerbe = 'herbeAnimee';
const CheminHerbe = 'assets/sprites/animated_grass.png';
const TailleImageHerbe = 16;
const ImagesParVariante = 3; // statique, droite, gauche
// Le GID de la variante 0 n'est PAS fixe ici : il change a chaque fois que
// des tuiles sont ajoutees avant elle dans Tileset.png. Il est recalcule a
// chaque partie dans CreerBrinsHerbe, a partir du plus petit GID reellement
// present sur le calque "devant", plutot que d'etre code en dur (ce qui
// obligeait a corriger cette constante a chaque reorganisation du tileset).
const NombreVariantesHerbe = 4; // variantes valides : les 4 plus petits GID d'affilee sur "devant"
const RayonReactionHerbe = 20; // distance (px monde) a partir de laquelle l'herbe reagit au joueur

// --- Tunnel avec passage cache (calque "tunnel", purement visuel — pas de
// collision) ---
// Se dessine devant le joueur (depth elevee) pour cacher ce qu'il y a
// derriere. Quand le joueur marche dans son emprise horizontale (donc
// visuellement "derriere"), il s'estompe en fondu pour ne pas le cacher
// completement, puis redevient opaque une fois le joueur ressorti.
// Son emprise horizontale n'est PAS codee en dur : chaque carte peut la
// placer differemment (voir CalculerBoitePixels, utilise dans create()),
// donc calculee depuis les tuiles reellement posees sur ce calque plutot
// que fixee pour une seule carte.
const TunnelAlphaMin = 0.15; // jamais totalement invisible, pour qu'on voie encore qu'il est la
const TunnelVitesseFondu = 0.08; // vitesse de transition vers l'alpha cible (par frame)

// Boite englobante (en pixels) des tuiles non vides d'un calque — utilise
// pour deriver des zones depuis le contenu reel de la carte active plutot
// que de coder des coordonnees en dur qui ne vaudraient que pour une seule
// carte (voir le tunnel, plus haut). Retourne null si le calque est vide.
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

// Meme principe que CalculerBoitePixels, mais en indices de tuiles (colonne/
// rangee) plutot qu'en pixels — utilise pour calibrer la position de la gare
// depuis le calque "gare" de la carte active (voir create()), plutot que de
// coder ses coordonnees en dur pour une seule carte.
function CalculerBoiteTuiles(Carte, NomCalque) {
  const Calque = Carte.getLayer(NomCalque);
  if (!Calque) return null;

  let ColMin = Infinity;
  let ColMax = -Infinity;
  let RangeeMin = Infinity;
  let RangeeMax = -Infinity;
  for (const Ligne of Calque.data) {
    for (const Tuile of Ligne) {
      if (Tuile && Tuile.index !== -1) {
        ColMin = Math.min(ColMin, Tuile.x);
        ColMax = Math.max(ColMax, Tuile.x);
        RangeeMin = Math.min(RangeeMin, Tuile.y);
        RangeeMax = Math.max(RangeeMax, Tuile.y);
      }
    }
  }
  return ColMin <= ColMax ? { ColMin, ColMax, RangeeMin, RangeeMax } : null;
}

// Proprietes personnalisees Tiled lues comme un nombre/booleen, meme quand
// leur TYPE est reste "string" cote Tiled (ex: changer le type d'une
// propriete deja creee n'est pas toujours evident dans l'interface — inutile
// de se battre avec ca : le code accepte les deux).
function ValeurNombreTiled(Valeur, Defaut) {
  const Nombre = Number(Valeur);
  return Number.isNaN(Nombre) ? Defaut : Nombre;
}
function ValeurBooleenneTiled(Valeur) {
  if (typeof Valeur === 'string') return Valeur.trim().toLowerCase() === 'true';
  return !!Valeur;
}

// --- Interactivite gare (calque "gare", n'importe quelle carte) ---
// La position/zone de la gare n'est PAS codee en dur : chaque carte peut la
// placer a des cases differentes (ex: "enfance" n'est pas du tout aux memes
// colonnes que "debut"/"map1") — voir CalculerBoiteTuiles et son usage dans
// create() (this.PositionGareX/Y, this.ZoneGare, this.PositionIconeInteractionX,
// this.PositionArriveeTrainX/Y), calcules depuis le contenu reel du calque
// "gare" de la carte active plutot que fixes pour une seule carte.
const TailleTuile = 16;

// --- Icone d'interaction (E_animated.png) ---
// 11 frames de 16x16 : les 3 premieres (E encadre plein, puis pointille) sont
// l'invite affichee quand le joueur est a portee, jouee en boucle. Les 8
// suivantes montrent le E qui eclate une fois la touche pressee, jouees une
// fois — la sequence de la gare ne demarre qu'a la toute fin de cette anim.
const CleIconeInteraction = 'iconeInteraction';
const CheminIconeInteraction = 'assets/UI/E_animated.png';
const TailleIconeInteraction = 16;
// Hauteur fixe au-dessus de la gare (this.PositionIconeInteractionX suit lui
// la position de la gare de la carte active — voir plus haut).
const PositionIconeInteractionY = 80;

// --- Spritesheet d'animation de la gare (gare.png) ---
// Grille 8x8 = 64 frames de 256x256px, fond transparent, toutes remplies.
const CleGare = 'animationGare';
const CheminGare = 'assets/tilesets/gare.png';
const TailleImageGare = 256;
const NombreImagesGare = 64; // grille 8x8

// Calibration exacte (plutot que tatonner au pixel pres), etablie a l'origine
// sur "debut"/"map1" (tuile locale 37 du tileset posee en case (35,8) du
// calque "gare", donc au pixel monde (560, 128)) : ce bloc de tuiles a ete
// decoupe directement dans gare.png a partir du pixel (80, 208) de chaque
// frame 256x256 (coin superieur-gauche du bloc de 11x3 tuiles qui compose la
// gare). Le pixel (80, 208 + 2*16) = (80, 240) d'une frame correspond donc au
// COIN BAS-GAUCHE du bloc de tuiles, quelle que soit la carte — voir
// CalculerBoiteTuiles (this.PositionGareX = ColMin*16, this.PositionGareY =
// RangeeMax*16, generalisation de (35*16, 8*16) = (560, 128)).
const AncrageImageGareX = 80;
const AncrageImageGareY = 240;

const OrigineContenuGareX = AncrageImageGareX / TailleImageGare;
const OrigineContenuGareY = AncrageImageGareY / TailleImageGare;
// Decalage a appliquer entre le centre (en pixels monde) du bloc de tuiles de
// la gare et la position du sprite quand il est flippe (setFlipX) pour jouer
// l'arrivee en train sur SA PROPRE mosaique (voir JouerArriveeEnTrain) — pas
// a confondre avec PositionGareInverseeX plus bas, qui vise un AUTRE bloc
// (le calque "derriere" de map1). Le contenu utile d'une frame va de
// AncrageImageGareX a TailleImageGare (176px), centre a AncrageImageGareX +
// 176/2 = 168px, soit 8px au-dela du centre du cadre — d'ou ce decalage de 8,
// invariant quelle que soit la largeur (en tuiles) du bloc de la carte active
// (verifie : applique au bloc "derriere" de map1 (176px, cols 73-83, centre
// 1256), ca redonne exactement 1256 - 8 = 1248 = PositionGareInverseeX).
const DecalageCentreGareFlippe = (TailleImageGare - AncrageImageGareX) / 2 - AncrageImageGareX;

// --- Sortie du "tunnel" (voyage en train) ---
// Sur le calque "derriere" (purement visuel/repere, jamais rendu — voir
// create()), cols 73-83 x rows 6-8 forment un miroir horizontal exact de la
// mosaique de depart (cols 35-45) : mêmes tuiles, juste retournees et dans
// l'ordre inverse. On reutilise donc le meme sprite gare.png pour l'arrivee,
// juste flippe (setFlipX), plutot qu'un second asset (voir DemarrerSequenceGare).
//
// Position du sprite flippe : avec flipX, l'ancrage (fraction OrigineContenuGareX
// dans une image de TailleImageGare de large) se retrouve a l'oppose par
// rapport au bloc de tuiles affiche (176px = 11 tuiles). Calcule via le
// centre du bloc : centre en image = 168px, qui doit retomber sur le centre
// du bloc de sortie ((1168+1344)/2 = 1256) -> SpriteX = 1256 - (176-168) = 1248.
const PositionGareInverseeX = 1248;
// Le joueur reapparait au centre du bloc de sortie (cols 73-83) ; la hauteur
// exacte n'a pas besoin d'etre pile sur le sol — comme au spawn, la gravite
// le fait retomber tout seul sur la premiere surface solide en dessous.
const PositionSortieTunnelX = (73 * 16 + 84 * 16) / 2;
const PositionSortieTunnelY = 96;

// Zone de retour, a l'arrivee : une fois sur place (EtatGare "retourAttente",
// voir DemarrerSequenceGare), le joueur peut de nouveau appuyer sur E pour
// repartir dans l'autre sens (voir DemarrerRetourGare). Meme gabarit que
// ZoneGare, centree sur le point d'arrivee plutot que recalculee sur la
// mosaique miroir.
const ZoneRetour = {
  XMin: PositionSortieTunnelX - 32,
  XMax: PositionSortieTunnelX + 32,
  YMin: 8 * 16,
  YMax: 9 * 16,
};
const PositionIconeInteractionRetourX = PositionSortieTunnelX;
const PositionIconeInteractionRetourY = 80; // meme hauteur au-dessus du sol que celle de la gare

// --- PNJ de dialogue (mini-jeu glisser-deposer) ---
// Chaque PNJ est defini entierement depuis Tiled (voir CreerPNJs), comme les
// textes de zone : position, sprite/frame, ligne, phrase a trous et mots a
// glisser sont des proprietes d'un objet pose sur "Calque d'Objets 1" (meme
// calque que "spawn"). Dans Tiled, pour en placer un —
//   1. Outil point : place un point a l'endroit voulu (les pieds du PNJ).
//   2. Proprietes personnalisees a ajouter :
//      - "ligneNPJ" (string) : sa phrase a lui, affichee au-dessus de sa tete.
//        Marque aussi cet objet comme un PNJ (obligatoire).
//      - "intro" (string, optionnel) : une reponse courte automatique du
//        joueur, affichee un instant avant la phrase a trous — ex. "Oui !".
//        Absente : la phrase a trous demarre tout de suite.
//      - "phrase" (string) : la reponse du joueur, avec "{}" pour chaque
//        trou — ex. "Je {} que {} demain." Trop long pour tenir sur une
//        ligne ? Saute une ligne dans le champ (bouton "..." a cote du champ
//        dans Tiled, qui ouvre un editeur multi-lignes) pour couper la
//        reponse en plusieurs "pages" — la suivante n'apparait qu'apres
//        avoir rempli tous les trous de la page en cours ET appuye sur E,
//        comme un vrai dialogue qui s'enchaine.
//      - "mots" (string) : les mots a glisser, separes par des virgules, dans
//        l'ordre des trous — ex. "pense, il pleuvra". S'il y a plusieurs
//        pages, distribue-les aussi dans l'ordre (les mots de la 1ere page
//        d'abord, puis ceux de la 2eme, etc.).
//      - "sprite" (string, optionnel) : cle du personnage a afficher — doit
//        correspondre a une entree de SpritesPNJConnus juste en dessous
//        (par defaut, la premiere de la liste).
//      - "frame" (int, optionnel) : quelle frame de son spritesheet afficher
//        (par defaut 0).
// Peu importe les mots choisis par le joueur, la reponse du personnage sera
// toujours "fausse" dans le recit (voir JouerReactionFinDialogue) — pas de
// bonne reponse a trouver, juste remplir tous les trous. Une fois repondu,
// ce PNJ disparait pour de bon (plus jamais interactif).
//
// Seule la liste des spritesheets utilisables reste a enregistrer en code
// (Phaser doit les precharger avant de pouvoir les afficher) : ajoute une
// entree ici pour chaque nouveau personnage, puis reference sa Cle depuis la
// propriete "sprite" dans Tiled.
const SpritesPNJConnus = [
  { Cle: 'other_child', Chemin: 'assets/tilesets/other_child.png', LargeurFrame: 16, HauteurFrame: 16 },
];

// --- Ecran de tele animee (tele.png) ---
// Grille 6x3 = 18 cases de 32x32px, mais seules les 13 premieres (index 0 a
// 12) contiennent un dessin : le reste de la feuille est vide. Ces 13 frames
// montrent un cardiogramme sur l'ecran — le trait rouge s'efface puis se
// redessine — soit un battement complet, qu'on rejoue en boucle continue.
// Placement dans Tiled : cases (2,7) a (3,8), soit x:32-64 y:112-144 en
// pixels (16px par case) — un carre de 2x2 cases = 32x32px, exactement la
// taille d'une frame.
const CleTele = 'ecranTele';
const CheminTele = 'assets/tilesets/tele.png';
const TailleImageTele = 32;
const NombreImagesTele = 13; // frames reellement dessinees (0 a 12)
const PositionTeleX = 2 * 16;
const PositionTeleY = 7 * 16;

// --- Interactivite de la tele : le joueur peut s'en approcher et appuyer 4
// fois sur E pour accelerer le cardiogramme (le bip suit tout seul, voir
// 'animationrepeat' dans create()) ; au 5e appui, la ligne devient plate
// (voir DeclencherLignePlateTele). Zone un peu plus large que la tele
// elle-meme (marge horizontale), meme principe que ZoneGare.
const ZoneTele = {
  XMin: PositionTeleX - 16,
  XMax: PositionTeleX + TailleImageTele + 16,
  YMin: PositionTeleY,
  YMax: PositionTeleY + TailleImageTele,
};
// frameRate applique apres le 1er, 2e, 3e puis 4e appui (le 0 correspond au
// frameRate de base de l'anim 'cardiogramme', avant tout appui). Calcule pour
// donner un rythme cardiaque croissant : ~46 -> 70 -> 100 -> 140 -> 190 bpm
// (bpm * NombreImagesTele / 60).
const VitessesCardiogramme = [10, 15, 22, 30, 41];

// Volume du son de la tele (bip du cardiogramme ou ligne plate continue)
// selon la distance du joueur : plein volume tout pres, silence total au-dela
// de DistanceSonTeleMax (voir VolumeSonSelonDistanceTele, appele en boucle
// dans update()).
const DistanceSonTeleMin = 40;
const DistanceSonTeleMax = 250;

// Ecran "mort" affiche au 5e appui (voir DeclencherLignePlateTele) : 4x3 =
// 12 frames de 32x32px, toutes dessinees, jouees en boucle lente.
const CleTeleMort = 'ecranTeleMort';
const CheminTeleMort = 'assets/tilesets/tele_death.png';
const NombreImagesTeleMort = 12;

// Icone d'interaction dediee a la tele (meme spritesheet/anims que celle de
// la gare, juste une 2e instance positionnee au-dessus de la tele plutot que
// de la gare). Contrairement a la gare, elle ne disparait pas definitivement
// des le 1er appui : elle rejoue son invite entre chaque appui, et ne
// s'efface pour de bon qu'au 5e (voir la boucle update()).
const PositionIconeInteractionTeleX = PositionTeleX + TailleImageTele / 2;
const PositionIconeInteractionTeleY = PositionTeleY - TailleIconeInteraction;

// --- Textes de zone ---
// Phrases affichees a un endroit fixe du monde (pas un texte d'interface qui
// suivrait le joueur) : des qu'il entre dans la zone declenchee, le texte
// correspondant apparait a sa position ; des qu'il en sort, il disparait (et
// reapparait a chaque fois qu'il revient).
//
// Definis entierement depuis Tiled plutot qu'en dur ici (voir
// CreerTextesDeZone) : pour en ajouter un, dans Tiled, sur "Calque d'Objets
// 1" (le meme calque que "spawn") —
//   1. Outil rectangle : dessine un rectangle a l'endroit voulu (c'est la
//      zone qui declenche le texte, comme ZoneGare/ZoneTele dans le code).
//   2. Dans ses proprietes personnalisees, ajoute une propriete "texte" (type
//      string) avec le texte a afficher.
//   3. Optionnel : ajoute aussi une propriete "points" (type bool, cochee)
//      pour faire preceder ce texte-la des points d'attente ( "." -> ". ." ->
//      ". . ." ). Absente ou decochee (le cas par defaut) : le texte s'ecrit
//      directement, sans cette intro.
// Le texte apparait centre juste au-dessus du rectangle. Pas besoin de
// toucher au code, ni de recalculer la moindre position en pixels — et ca
// marche independamment sur chaque carte.
const NomCoucheObjets = "Calque d'Objets 1"; // meme calque que l'objet "spawn"

// Style visuel des textes de zone : pixel art oblige, une petite taille de
// police (multipliee par ZoomCamera a l'affichage) plutot qu'une police fine
// qui deteindrait mal a ce niveau de zoom. Contour noir pour rester lisible
// quel que soit le fond derriere.
// Nom choisi dans le @font-face d'index.html (assets/font/) — pas forcement
// le nom interne du fichier.
const NomPoliceTexteDeZone = 'DeltaruneExtended';
const StyleTexteDeZone = {
  fontFamily: `'${NomPoliceTexteDeZone}', monospace`, // repli tant que la police n'est pas chargee
  fontSize: '6px',
  color: '#ffffff',
  stroke: '#000000',
  strokeThickness: 2,
  align: 'center',
  wordWrap: { width: 120 },
  // Sans ca, le texte (anti-aliase par nature, contrairement aux sprites en
  // pixel art) serait rendu tout petit puis agrandi x5 par ZoomCamera avec le
  // filtrage NEAREST du jeu (pixelArt: true) — flou ET crenele a la fois.
  // resolution : rendu interne a plus haute densite avant mise a l'echelle
  // (voir aussi le texture.setFilter(LINEAR) applique a la creation).
  resolution: ZoomCamera,
};

// Le mini-jeu de dialogue PNJ (voir OuvrirDialoguePNJ) reutilise directement
// StyleTexteDeZone pour les lignes (PNJ, joueur) : ce sont des objets du
// monde, positionnes au-dessus des personnages, pas une interface figee a
// l'ecran — donc le meme traitement pixel-art (police, filtrage LINEAR,
// resolution) s'applique tel quel.
//
// Les mots a glisser ont leur propre style : un fond (+ un peu de marge
// interne) derriere chaque mot, comme une petite etiquette — ca sert de
// repere visuel pour "l'espace" que prend chaque mot, meme avant de le
// regarder de pres, et ca aide a les distinguer une fois espaces en liste
// (voir AfficherPageDialogue).
const StyleMotDialogue = {
  fontFamily: `'${NomPoliceTexteDeZone}', monospace`,
  fontSize: '6px',
  color: '#ffffff',
  stroke: '#000000',
  strokeThickness: 1,
  backgroundColor: 'rgba(0, 0, 0, 0.55)',
  padding: { x: 2, y: 1 },
  resolution: ZoomCamera,
};

// Rythme de l'effet "machine a ecrire" des textes de zone (voir
// MettreAJourTextesDeZone) : d'abord une petite attente suggeree par des
// points qui apparaissent un a un ( "." -> ". ." -> ". . ." ), puis une
// pause, puis le texte qui s'ecrit lettre par lettre.
const DelaiParPoint = 500; // ms entre chaque point de la sequence d'attente
const PauseApresPoints = 400; // ms d'attente une fois les 3 points affiches
const DelaiParLettre = 70; // ms entre chaque lettre du texte qui s'ecrit

// Une fois le texte entierement ecrit, il reste lisible ce temps-la (ms)
// avant de commencer a s'estomper — puis fondu + flou progressif (comme une
// bulle de pensee/un nuage qui se dissipe), sur cette duree (ms). Ne se
// declenche qu'une seule fois par texte : une fois disparu, il ne rejouera
// plus jamais, meme si le joueur revient dans la zone.
const DureeAffichageFini = 1800;
const DureeDisparitionTexte = 1000;
const IntensiteFlouDisparition = 6;

// --- Reglages du mode prototype (utilises seulement si UtiliseCarteTiled = false) ---
const LargeurMondeParDefaut = 4000;
const HauteurMondeParDefaut = 540;
const HauteurSol = 460;

// Duotone du monde : le personnage (blanc) tranche sur ces deux teintes.
const CouleurSol = 0x2c3e50; // bleu-ardoise sourd
const CouleurAccent = 0x5a1a2e; // lie-de-vin sourd
const CouleurPersonnage = 0xffffff;

let SonAmbianceDemarre = false; // evite de relancer le son plusieurs fois

// Un seul AudioContext partage par tous les sons du jeu (ambiance, pas, saut,
// atterrissage...), cree au premier appel plutot qu'un par son.
let ContexteAudioPartage = null;
function ObtenirContexteAudio() {
  if (!ContexteAudioPartage) {
    ContexteAudioPartage = new (window.AudioContext || window.webkitAudioContext)();
  }
  return ContexteAudioPartage;
}

function DemarrerSonAmbiance() {
  if (SonAmbianceDemarre) return; // garde-fou : une seule instance du drone
  SonAmbianceDemarre = true;

  const Contexte = ObtenirContexteAudio();

  const Oscillateur = Contexte.createOscillator(); // generateur d'onde (le "instrument")
  Oscillateur.type = 'sine'; // onde sinusoidale : son pur, sans harmoniques agressives
  Oscillateur.frequency.value = 52; // frequence grave, en Hz (drone sourd)

  const Volume = Contexte.createGain(); // controle le volume de ce qui passe a travers
  Volume.gain.value = 0.07; // volume bas, discret

  Oscillateur.connect(Volume); // l'oscillateur alimente le controle de volume...
  Volume.connect(Contexte.destination); // ...qui alimente les haut-parleurs
  Oscillateur.start(); // demarre le son (boucle indefiniment par nature)

  // pulsation lente, pour un poids sourd : un second oscillateur tres basse
  // frequence qui module le volume du premier au lieu de produire un son audible
  const OscillateurLent = Contexte.createOscillator();
  OscillateurLent.type = 'sine';
  OscillateurLent.frequency.value = 0.12; // ~1 pulsation toutes les 8 secondes

  const VolumeOscillateurLent = Contexte.createGain();
  VolumeOscillateurLent.gain.value = 0.04; // amplitude de la pulsation (variation de volume)

  OscillateurLent.connect(VolumeOscillateurLent);
  VolumeOscillateurLent.connect(Volume.gain); // sa sortie vient faire varier Volume.gain en continu
  OscillateurLent.start();
}

// Pas — bref grain de bruit filtre, tres court et discret.
function JouerSonPas() {
  const Contexte = ObtenirContexteAudio();
  const Duree = 0.05;

  const Tampon = Contexte.createBuffer(1, Contexte.sampleRate * Duree, Contexte.sampleRate);
  const Donnees = Tampon.getChannelData(0);
  for (let i = 0; i < Donnees.length; i++) Donnees[i] = Math.random() * 2 - 1;

  const Bruit = Contexte.createBufferSource();
  Bruit.buffer = Tampon;

  const Filtre = Contexte.createBiquadFilter();
  Filtre.type = 'bandpass';
  Filtre.frequency.value = 1200;
  Filtre.Q.value = 1;

  const Volume = Contexte.createGain();
  Volume.gain.setValueAtTime(0.1, Contexte.currentTime);
  Volume.gain.exponentialRampToValueAtTime(0.001, Contexte.currentTime + Duree);

  Bruit.connect(Filtre);
  Filtre.connect(Volume);
  Volume.connect(Contexte.destination);
  Bruit.start();
}

// Atterrissage — petit "thud" grave et court.
function JouerSonAtterrissage() {
  const Contexte = ObtenirContexteAudio();
  const Oscillateur = Contexte.createOscillator();
  Oscillateur.type = 'sine';
  Oscillateur.frequency.setValueAtTime(140, Contexte.currentTime);
  Oscillateur.frequency.exponentialRampToValueAtTime(60, Contexte.currentTime + 0.09);

  const Volume = Contexte.createGain();
  Volume.gain.setValueAtTime(0.2, Contexte.currentTime);
  Volume.gain.exponentialRampToValueAtTime(0.001, Contexte.currentTime + 0.1);

  Oscillateur.connect(Volume);
  Volume.connect(Contexte.destination);
  Oscillateur.start();
  Oscillateur.stop(Contexte.currentTime + 0.11);
}

// Facteur de volume (0 a 1) selon la distance entre le joueur et le centre
// de la tele : 1 en dessous de DistanceSonTeleMin, decroit lineairement
// jusqu'a 0 (silence total) a partir de DistanceSonTeleMax. Utilise a la fois
// par le bip du cardiogramme et par la ligne plate continue (voir update()).
function VolumeSonSelonDistanceTele(PositionJoueurX, PositionJoueurY) {
  const CentreTeleX = PositionTeleX + TailleImageTele / 2;
  const CentreTeleY = PositionTeleY + TailleImageTele / 2;
  const Distance = Phaser.Math.Distance.Between(PositionJoueurX, PositionJoueurY, CentreTeleX, CentreTeleY);
  const Portee = DistanceSonTeleMax - DistanceSonTeleMin;
  return Phaser.Math.Clamp(1 - (Distance - DistanceSonTeleMin) / Portee, 0, 1);
}

// Cardiogramme (ecran de tele) — bref bip aigu et net, comme un moniteur
// cardiaque. Declenche en synchro avec la boucle de l'animation de l'ecran
// (voir 'animationrepeat' sur SpriteTele dans create()). `Volume` (0 a 1,
// voir VolumeSonSelonDistanceTele) attenue le bip selon la distance au
// moment ou il se declenche.
function JouerSonCardiogramme(Volume) {
  if (Volume <= 0) return; // trop loin : inutile de generer un son inaudible

  const Contexte = ObtenirContexteAudio();
  const Oscillateur = Contexte.createOscillator();
  Oscillateur.type = 'square'; // timbre net et electronique, pas doux comme une sinusoide
  Oscillateur.frequency.value = 880; // aigu, typique d'un bip de moniteur

  const PicVolume = 0.1 * Volume;
  const VolumeNode = Contexte.createGain();
  VolumeNode.gain.setValueAtTime(PicVolume, Contexte.currentTime);
  VolumeNode.gain.exponentialRampToValueAtTime(0.001, Contexte.currentTime + 0.08);

  Oscillateur.connect(VolumeNode);
  VolumeNode.connect(Contexte.destination);
  Oscillateur.start();
  Oscillateur.stop(Contexte.currentTime + 0.09);
}

// Ligne plate (tele HS, apres le 5e appui) — bip continu, grave et etouffe,
// comme l'alarme d'un moniteur cardiaque a l'arret. Contrairement aux autres
// sons de ce fichier, pas de stop() programme : il continue indefiniment une
// fois lance (voir DeclencherLignePlateTele, qui ne l'appelle qu'une fois).
// Retourne le noeud de gain : update() ajuste son volume image par image
// selon la distance du joueur (voir VolumeSonSelonDistanceTele), pour qu'on
// ne l'entende plus du tout une fois assez loin.
function JouerSonLignePlate() {
  const Contexte = ObtenirContexteAudio();
  const Oscillateur = Contexte.createOscillator();
  Oscillateur.type = 'sawtooth'; // plus riche qu'une sinusoide, pour avoir de quoi etouffer ensuite
  Oscillateur.frequency.value = 300; // grave-medium, pas aigu comme le bip normal

  const Filtre = Contexte.createBiquadFilter();
  Filtre.type = 'lowpass';
  Filtre.frequency.value = 500; // coupe les aigus : rend le son sourd/etouffe

  const Volume = Contexte.createGain();
  Volume.gain.value = 0; // mis a jour des la premiere frame par update()

  Oscillateur.connect(Filtre);
  Filtre.connect(Volume);
  Volume.connect(Contexte.destination);
  Oscillateur.start();

  return Volume;
}

// Le serveur de dev (python -m http.server) n'envoie aucun en-tete
// anti-cache : sans ca, le navigateur garde une ancienne version d'un asset
// meme apres modification du fichier sur le disque. On rajoute un parametre
// unique a chaque chargement de page pour forcer un fichier frais a chaque
// fois pendant le developpement.
const ParametreAntiCache = `?v=${Date.now()}`;

class ScenePrincipale extends Phaser.Scene {
  // Appele a chaque demarrage/redemarrage de la scene (le tout premier lancement
  // ET chaque this.scene.restart(...), voir DemarrerSequenceGare) — AVANT
  // preload(). "data" est absent au tout premier lancement (retombe alors sur
  // CleCarteChoisie, la carte de depart par defaut/testee via l'URL) ; il
  // contient { carte, arrivee } quand on arrive d'une autre carte via le train
  // (voir CarteSuivante). this.ArriveeParTrain pilote JouerArriveeEnTrain,
  // appele en toute fin de create().
  init(Donnees) {
    this.NomCarteActuelle = (Donnees && Donnees.carte) || CleCarteChoisie;
    this.ArriveeParTrain = !!(Donnees && Donnees.arrivee);
  }

  preload() {
    // Chargement des assets Tiled : seulement si le flag est actif, pour ne
    // pas provoquer d'erreur "fichier introuvable" tant qu'ils n'existent pas.
    if (UtiliseCarteTiled) {
      // L'image brute du tileset : la texture que Tiled decoupe en tuiles
      this.load.image(CleTuiles, CheminTuiles + ParametreAntiCache);
      // La map elle-meme : positions des tuiles, calques, objets, etc. Cle de
      // cache = nom de la carte (this.NomCarteActuelle, voir init()) plutot
      // qu'une cle fixe, pour que chaque carte ait sa propre entree en cache
      // et ne pas rejouer une ancienne carte apres this.scene.restart(...).
      this.load.tilemapTiledJSON(this.NomCarteActuelle, `assets/maps/${this.NomCarteActuelle}.json` + ParametreAntiCache);

      // Spritesheet d'animation de la gare
      this.load.spritesheet(CleGare, CheminGare + ParametreAntiCache, {
        frameWidth: TailleImageGare,
        frameHeight: TailleImageGare,
      });

      // Spritesheet de l'herbe (4 variantes de brin, 16x16 chacune)
      this.load.spritesheet(CleHerbe, CheminHerbe + ParametreAntiCache, {
        frameWidth: TailleImageHerbe,
        frameHeight: TailleImageHerbe,
      });

      // Spritesheet de l'icone d'interaction (invite + E qui eclate)
      this.load.spritesheet(CleIconeInteraction, CheminIconeInteraction + ParametreAntiCache, {
        frameWidth: TailleIconeInteraction,
        frameHeight: TailleIconeInteraction,
      });

      // Spritesheet de l'ecran de tele (cardiogramme en boucle)
      this.load.spritesheet(CleTele, CheminTele + ParametreAntiCache, {
        frameWidth: TailleImageTele,
        frameHeight: TailleImageTele,
      });
      // Ecran "mort" de la tele, affiche au 5e appui
      this.load.spritesheet(CleTeleMort, CheminTeleMort + ParametreAntiCache, {
        frameWidth: TailleImageTele,
        frameHeight: TailleImageTele,
      });
      // PNJ de dialogue (voir CreerPNJs) : tous les personnages connus,
      // qu'ils soient utilises ou non sur cette carte precise.
      SpritesPNJConnus.forEach(({ Cle, Chemin, LargeurFrame, HauteurFrame }) => {
        this.load.spritesheet(Cle, Chemin + ParametreAntiCache, {
          frameWidth: LargeurFrame,
          frameHeight: HauteurFrame,
        });
      });
    }

    if (UtiliseSpritePersonnage) {
      // spritesheet : Phaser decoupe l'image en frames de taille fixe
      this.load.spritesheet(ClePersonnage, CheminPersonnage + ParametreAntiCache, {
        frameWidth: LargeurImagePersonnage,
        frameHeight: HauteurImagePersonnage,
      });
    }
  }

  create() {
    this.cameras.main.setBackgroundColor('#000000');

    // En mode d'echelle RESIZE, Phaser ne redimensionne pas la camera tout
    // seul : sans ca, elle reste a 0x0 et rien ne s'affiche. Pas besoin de
    // rien recalculer d'autre ici : MettreAJourCamera (voir update()) relit
    // la taille de la camera a chaque frame, donc un redimensionnement se
    // repercute tout seul des la frame suivante.
    this.cameras.main.setSize(this.scale.width, this.scale.height);
    this.scale.on('resize', (TailleJeu) => {
      this.cameras.main.setSize(TailleJeu.width, TailleJeu.height);
    });

    let Sol; // le collider du sol/decor, quel que soit le mode
    let LargeurMonde = LargeurMondeParDefaut;
    let HauteurMonde = HauteurMondeParDefaut;
    let PositionDepartX = 120;
    let PositionDepartY = HauteurSol - 30;

    if (UtiliseCarteTiled) {
      // ── Mode Tiled ──────────────────────────────────────────────────
      // this.make.tilemap lit les donnees JSON chargees en preload()
      const Carte = this.make.tilemap({ key: this.NomCarteActuelle });
      // Reference gardee pour CreerPNJs/CreerTextesDeZone, appelees plus bas
      // une fois le joueur et la camera en place (voir le commentaire a cet
      // endroit).
      this.CarteChargee = Carte;
      // Associe l'image de tileset chargee au tileset declare dans le JSON
      const JeuDeTuiles = Carte.addTilesetImage(NomTuilesDansTiled, CleTuiles);

      // Cree chaque calque de map1.json, dans l'ordre (le premier cree
      // s'affiche en dessous des suivants). Adapte cette liste si tu
      // renommes/ajoutes des calques dans Tiled.
      Carte.createLayer('bg', JeuDeTuiles, 0, 0);
      Carte.createLayer('bg2', JeuDeTuiles, 0, 0);

      // 'derriere' n'existe pas forcement sur toutes les cartes (ex: "debut"
      // n'en a pas encore) : purement visuel dans Tiled (repere pour placer
      // des decors ensuite animes en code, comme la tele, et pour la
      // mosaique miroir d'arrivee du train — voir DemarrerSequenceGare), il
      // sert uniquement de flag ici ("cette carte a-t-elle une arrivee de
      // train configuree ?"), jamais affiche lui-meme.
      const CalqueDerriereExiste = Carte.layers.some((L) => L.name === 'derriere');
      this.ArriveeTrainConfiguree = CalqueDerriereExiste;
      if (CalqueDerriereExiste) {
        Carte.createLayer('derriere', JeuDeTuiles, 0, 0).setVisible(false);
      }

      // Reference gardee (this.CalqueGare sert de simple flag "cette carte a
      // une gare" un peu partout, voir les gardes "if (this.CalqueGare ...)"
      // plus bas) mais JAMAIS affiche : la mosaique statique posee dans
      // Tiled ne s'alignait pas exactement au pixel pres avec le sprite
      // anime (this.SpriteGare) qui se superpose dessus pendant les
      // sequences, ce qui causait un leger decalage visible au moment de
      // basculer de l'un a l'autre. this.SpriteGare (fige sur la frame 0 en
      // dehors des sequences, voir plus bas) le remplace entierement, y
      // compris au repos.
      this.CalqueGare = Carte.createLayer('gare', JeuDeTuiles, 0, 0);
      if (this.CalqueGare) this.CalqueGare.setVisible(false);
      const CalqueSol = Carte.createLayer(NomCalqueSol, JeuDeTuiles, 0, 0); // 'sol'

      // Position/zone de la gare, calculees depuis le calque "gare" REEL de
      // la carte active (voir CalculerBoiteTuiles) plutot que codees en dur —
      // chaque carte peut placer sa gare a des cases differentes (ex:
      // "enfance" n'est pas du tout aux memes colonnes que "debut"/"map1").
      const BoiteGare = CalculerBoiteTuiles(Carte, 'gare');
      if (BoiteGare) {
        const { ColMin, ColMax, RangeeMin, RangeeMax } = BoiteGare;
        // Coin bas-gauche du bloc — voir la calibration pres de
        // AncrageImageGareX (generalisation de (35*16, 8*16) = (560, 128)).
        this.PositionGareX = ColMin * TailleTuile;
        this.PositionGareY = RangeeMax * TailleTuile;
        // Centre du bloc, en pixels monde (englobe toute la largeur, jusqu'au
        // bord droit inclus) — reutilise pour l'icone et pour l'arrivee en train.
        const CentreGareX = (ColMin * TailleTuile + (ColMax + 1) * TailleTuile) / 2;
        this.PositionIconeInteractionX = CentreGareX;
        // Sprite flippe centre sur le meme bloc (voir DecalageCentreGareFlippe
        // et JouerArriveeEnTrain) — pas le meme calcul que PositionGareInverseeX,
        // qui vise un bloc DIFFERENT (calque "derriere" de map1).
        this.PositionGareXFlippe = CentreGareX - DecalageCentreGareFlippe;
        // Zone d'interaction : quelques cases centrees sur le bloc, a sa
        // rangee du bas (meme gabarit relatif que l'ancien ZoneGare fixe,
        // cases 39-43 sur un bloc 35-45 centre en 40).
        const ColCentre = ColMin + Math.floor((ColMax - ColMin) / 2);
        this.ZoneGare = {
          XMin: (ColCentre - 1) * TailleTuile,
          XMax: (ColCentre + 3) * TailleTuile,
          YMin: RangeeMax * TailleTuile,
          YMax: (RangeeMax + 1) * TailleTuile,
        };
        // Point d'apparition du joueur en arrivant du train (voir
        // JouerArriveeEnTrain) : centre du bloc, rangee du haut — la gravite
        // le fait retomber tout seul sur le sol, comme au spawn normal.
        this.PositionArriveeTrainX = CentreGareX;
        this.PositionArriveeTrainY = RangeeMin * TailleTuile;
      } else {
        // Pas de calque "gare" sur cette carte : desactive toute l'interactivite
        // liee (this.CalqueGare reste undefined de toute facon, voir les
        // gardes "if (this.CalqueGare ...)" plus bas).
        this.ZoneGare = { XMin: 0, XMax: 0, YMin: 0, YMax: 0 };
      }

      // Ecran de tele : uniquement sur les cartes qui ont un calque
      // "derriere" (c'est la que son decor de reference est place dans
      // Tiled) — simple decor anime en boucle continue, pas besoin de mise a
      // jour par frame (contrairement a l'herbe/au tunnel) — juste
      // l'animation Phaser plus un bip declenche a chaque repetition de la
      // boucle (voir JouerSonCardiogramme). Le bip ecoute l'evenement
      // 'animationrepeat' plus bas, donc il reste toujours synchro tout seul
      // avec ce frameRate, quel qu'il soit — pas besoin de le retoucher a
      // chaque changement.
      if (CalqueDerriereExiste) {
        this.anims.create({
          key: 'cardiogramme',
          frames: this.anims.generateFrameNumbers(CleTele, { start: 0, end: NombreImagesTele - 1 }),
          // Un battement toutes les (NombreImagesTele / frameRate) secondes :
          // a 10 img/s -> 13/10 = 1,3s par battement (~46 bpm).
          frameRate: 10,
          repeat: -1,
        });
        // Ecran mort (5e appui) : boucle lente, tant que la partie continue.
        this.anims.create({
          key: 'ecranMort',
          frames: this.anims.generateFrameNumbers(CleTeleMort, { start: 0, end: NombreImagesTeleMort - 1 }),
          frameRate: 8,
          repeat: -1,
        });
        this.SpriteTele = this.add.sprite(PositionTeleX, PositionTeleY, CleTele, 0);
        this.SpriteTele.setOrigin(0, 0); // meme ancrage qu'une tuile, cale pile sur (2,7)
        // Pas de depth forcee : a depth egale (0 par defaut), Phaser affiche
        // par-dessus ce qui est cree en dernier. Cree ici, juste apres le sol,
        // la tele reste donc au-dessus de bg/bg2/gare/sol mais en dessous de
        // l'herbe et du personnage, crees plus bas.
        this.SpriteTele.play('cardiogramme');
        // 'animationrepeat' : declenche a chaque fois que la boucle repart de
        // la premiere frame, soit l'instant ou le trait est de nouveau complet
        // a l'ecran juste avant de se reeffacer — le point naturel du battement.
        this.SpriteTele.on('animationrepeat', () => {
          JouerSonCardiogramme(VolumeSonSelonDistanceTele(this.Personnage.x, this.Personnage.y));
        });
        // Compteur d'appuis sur E pres de la tele (voir ZoneTele dans
        // update()) et etat "ligne plate" une fois le 5e appui atteint (voir
        // DeclencherLignePlateTele).
        this.CompteurAppuisTele = 0;
        this.TeleHS = false;
        this.IconeTeleEnCours = false; // true pendant que iconePressee joue (voir update())
      }

      // 'devant' n'est plus rendu comme un calque de tuiles figees : on lit
      // ses positions pour y poser des sprites d'herbe individuels a la place
      // (voir CreerBrinsHerbe), afin qu'ils puissent plier au passage du joueur.
      this.CreerBrinsHerbe(Carte);

      // Tunnel au premier plan avec passage cache : depth elevee pour se
      // dessiner devant le joueur (voir MettreAJourTunnel pour le fondu).
      // Son emprise horizontale (this.TunnelXMin/XMax) est calculee depuis
      // les tuiles reellement posees sur ce calque plutot que codee en dur,
      // puisqu'elle differe d'une carte a l'autre.
      this.CalqueTunnel = Carte.createLayer('tunnel', JeuDeTuiles, 0, 0);
      this.CalqueTunnel.setDepth(3);
      const BoiteTunnel = CalculerBoitePixels(Carte, 'tunnel');
      this.TunnelXMin = BoiteTunnel ? BoiteTunnel.XMin : 0;
      this.TunnelXMax = BoiteTunnel ? BoiteTunnel.XMax : 0;

      // Sprite anime de la gare : cache au depart, superpose a la mosaique
      // statique de tuiles et affiche uniquement pendant l'interaction (voir
      // DemarrerSequenceGare). L'origine est calibree sur le centre du dessin
      // utile dans chaque frame (pas le centre du canevas 256x256), pour
      // s'aligner pile sur la mosaique.
      // clignoteGare : frames 3 et 4 (index 2 et 3), jouees 2 fois, lentement.
      this.anims.create({
        key: 'clignoteGare',
        frames: [
          { key: CleGare, frame: 2 },
          { key: CleGare, frame: 3 },
        ],
        frameRate: 2, // lent : une frame toutes les 500ms
        repeat: 1, // rejoue la sequence une fois de plus (2 fois au total)
      });
      // resteGare : le reste de la feuille (index 5 a 63), jouee une fois,
      // apres le tremblement.
      this.anims.create({
        key: 'resteGare',
        frames: this.anims.generateFrameNumbers(CleGare, { start: 5, end: NombreImagesGare - 1 }),
        frameRate: 10,
        repeat: 0,
      });
      // arriveeGare : les memes frames que resteGare, mais a l'envers — le
      // train (parti vite) arrive en douceur puis s'arrete. Jouee a la sortie
      // du tunnel, sur le sprite flippe (voir DemarrerSequenceGare).
      const FramesArriveeGare = [];
      for (let i = NombreImagesGare - 1; i >= 5; i--) FramesArriveeGare.push({ key: CleGare, frame: i });
      this.anims.create({
        key: 'arriveeGare',
        frames: FramesArriveeGare,
        frameRate: 10,
        repeat: 0,
      });
      this.SpriteGare = this.add.sprite(this.PositionGareX, this.PositionGareY, CleGare, 0);
      this.SpriteGare.setOrigin(OrigineContenuGareX, OrigineContenuGareY);
      this.SpriteGare.setDepth(5);
      // Visible par defaut (frame 0, non flippe) : c'est lui qui tient lieu
      // de mosaique "au repos" en dehors des sequences (voir this.CalqueGare
      // plus haut) — sauf si la carte n'a pas de calque "gare" exploitable
      // (this.PositionGareX resterait alors undefined, voir CalculerBoiteTuiles).
      this.SpriteGare.setVisible(this.PositionGareX !== undefined);

      // Icone d'interaction : suit le joueur au-dessus de sa tete tant qu'il
      // est dans ZoneGare. iconeAttente boucle (invite), iconePressee joue
      // une fois quand la touche est pressee (voir update()).
      this.anims.create({
        key: 'iconeAttente',
        frames: this.anims.generateFrameNumbers(CleIconeInteraction, { start: 0, end: 2 }),
        frameRate: 4,
        repeat: -1,
      });
      this.anims.create({
        key: 'iconePressee',
        frames: this.anims.generateFrameNumbers(CleIconeInteraction, { start: 3, end: 10 }),
        frameRate: 14,
        repeat: 0,
      });
      this.IconeInteraction = this.add.sprite(this.PositionIconeInteractionX, PositionIconeInteractionY, CleIconeInteraction, 0);
      this.IconeInteraction.setDepth(20); // au-dessus de tout le reste
      this.IconeInteraction.setVisible(false);

      // 2e instance de la meme icone (memes anims iconeAttente/iconePressee),
      // positionnee au-dessus de la tele plutot que de la gare.
      this.IconeInteractionTele = this.add.sprite(PositionIconeInteractionTeleX, PositionIconeInteractionTeleY, CleIconeInteraction, 0);
      this.IconeInteractionTele.setDepth(20);
      this.IconeInteractionTele.setVisible(false);

      // 3e instance : invite du trajet retour, a l'arrivee (voir ZoneRetour
      // et DemarrerRetourGare). Meme fonctionnement que celle de la gare
      // (disparait definitivement une fois la sequence lancee).
      this.IconeInteractionRetour = this.add.sprite(PositionIconeInteractionRetourX, PositionIconeInteractionRetourY, CleIconeInteraction, 0);
      this.IconeInteractionRetour.setDepth(20);
      this.IconeInteractionRetour.setVisible(false);

      // PNJ de dialogue et textes de zone : crees plus bas (voir
      // CreerPNJs/CreerTextesDeZone), une fois le joueur et la camera en
      // place — pour qu'une erreur dans l'un de ces a-cotes ne puisse pas
      // empecher le jeu de base (joueur, camera, controles) de fonctionner.

      // Aucune propriete "collides" definie pour l'instant dans Tiled : on
      // rend donc solide toute case non vide (-1) du calque de sol. Si tu
      // preferes du cas par cas plus tard, utilise plutot
      // CalqueSol.setCollisionByProperty({ collides: true }) avec des
      // proprietes posees tuile par tuile dans Tiled.
      CalqueSol.setCollisionByExclusion([-1]);

      Sol = CalqueSol;
      LargeurMonde = Carte.widthInPixels;
      HauteurMonde = Carte.heightInPixels;

      // Le pixel art (tuiles 16px) est minuscule sans zoom sur un canvas de 960px
      this.cameras.main.setZoom(ZoomCamera);

      // Point de spawn place dans Tiled (calque d'objets "Calque d'Objets 1",
      // objet ponctuel nomme "spawn"). Si jamais il est absent/renomme, on
      // retombe sur une position par defaut au-dessus du sol.
      const PointDepart = Carte.findObject("Calque d'Objets 1", (Objet) => Objet.name === 'spawn');
      PositionDepartX = PointDepart ? PointDepart.x : 250;
      PositionDepartY = PointDepart ? PointDepart.y : 120;

      // Arrivee en train depuis une autre carte (voir init() et
      // CarteSuivante) : le joueur apparait pres de SA gare a lui plutot
      // qu'au spawn normal — voir JouerArriveeEnTrain, appele en toute fin
      // de create() une fois le reste de la scene pret.
      if (this.ArriveeParTrain && this.PositionArriveeTrainX !== undefined) {
        PositionDepartX = this.PositionArriveeTrainX;
        PositionDepartY = this.PositionArriveeTrainY;
      }
    } else {
      // ── Mode prototype (sans Tiled) : la ligne droite bicolore actuelle ──
      Sol = this.add.rectangle(LargeurMonde / 2, HauteurSol + 40, LargeurMonde, 80, CouleurSol);
      this.physics.add.existing(Sol, true); // true = corps statique (ne bouge jamais)

      // Liseré d'accent purement visuel, sans collision
      this.add.rectangle(LargeurMonde / 2, HauteurSol, LargeurMonde, 4, CouleurAccent);
    }

    this.physics.world.setBounds(0, 0, LargeurMonde, HauteurMonde);
    // Pas de this.cameras.main.setBounds(...) : rentre en conflit avec notre
    // suivi manuel (voir MettreAJourCamera) — teste et confirme que ce n'est
    // PAS ce qui cause l'ecran noir (present avec ou sans), donc pas la
    // peine de garder ce conflit pour rien.

    // ── Personnage ──────────────────────────────────────────────────────
    if (UtiliseSpritePersonnage) {
      // physics.add.sprite cree directement un GameObject anime + son corps physique
      this.Personnage = this.physics.add.sprite(PositionDepartX, PositionDepartY, ClePersonnage);

      // player.png fait 96x16 -> 6 frames de 16x16 (voir la repartition pres
      // de LargeurImagePersonnage). Cycle de marche = frames 4 et 5,
      // inversees horizontalement pour la gauche via setFlipX.
      this.anims.create({
        key: 'marche',
        frames: this.anims.generateFrameNumbers(ClePersonnage, { start: 4, end: 5 }),
        frameRate: 8,
        repeat: -1,
      });

      // Pose immobile (frame 3, standby) et orientation par defaut au
      // demarrage — un seul jeu de frames, gauche/droite s'obtient par flip.
      this.Orientation = 'droite';
      this.Personnage.setFlipX(false);
      this.Personnage.setFrame(3);
    } else {
      // Placeholder : simple rectangle blanc, pas encore de sprite reel
      this.Personnage = this.add.rectangle(PositionDepartX, PositionDepartY, 22, 44, CouleurPersonnage);
      this.physics.add.existing(this.Personnage); // false/omis = corps dynamique (soumis a la gravite)
    }
    this.Personnage.body.setCollideWorldBounds(true);

    this.physics.add.collider(this.Personnage, Sol);

    // Petite texture generee (4x4, cercle gris) pour les particules de
    // poussiere — pas besoin d'un fichier image pour un effet aussi simple.
    const DessinPoussiere = this.make.graphics({ x: 0, y: 0, add: false });
    DessinPoussiere.fillStyle(0x999999, 1);
    DessinPoussiere.fillCircle(2, 2, 2);
    DessinPoussiere.generateTexture('particulePoussiere', 4, 4);
    DessinPoussiere.destroy();

    // emitting:false : l'emetteur ne crache rien tout seul, on declenche des
    // "explosions" ponctuelles a la demande (atterrissage, voir update()).
    this.EmetteurPoussiere = this.add.particles(0, 0, 'particulePoussiere', {
      speed: { min: 20, max: 60 },
      angle: { min: 200, max: 340 }, // eventail vers le haut (0=droite, 90=bas)
      lifespan: 300,
      scale: { start: 1, end: 0 },
      alpha: { start: 0.8, end: 0 },
      quantity: 6,
      emitting: false,
    });
    this.EmetteurPoussiere.setDepth(4);

    // Pour detecter l'atterrissage (front montant de body.blocked.down) et
    // cadencer le bruit de pas independamment du framerate.
    this.EtaitAuSol = true;
    this.DelaiProchainPas = 0;

    // Intensite de marche (0 = immobile, 1 = pleine marche), remonte/redescend
    // en fondu via VitesseFonduMarche — voir son usage dans update() (tangage
    // du personnage) et MettreAJourCamera (anticipation de la camera).
    this.IntensiteMarche = 0;

    // Suivi de camera entierement manuel (voir MettreAJourCamera dans
    // update()), plutot que startFollow(...) : constate a l'usage que
    // Phaser recalcule scrollY tout seul a chaque redimensionnement de la
    // fenetre, meme avec lerpY=0 (cense le "geler" definitivement) — un
    // comportement surprenant de cette version qui rendait tout correctif
    // applique une seule fois ecrase peu apres. Piloter nous-memes scrollX
    // ET scrollY chaque frame evite ce probleme une bonne fois pour toutes.
    this.HauteurMondeCarte = HauteurMonde;
    this.LargeurMondeCarte = LargeurMonde;
    // true force un recadrage horizontal instantane dans MettreAJourCamera
    // (utilise pendant le voyage en train, voir
    // DemarrerSequenceGare/DemarrerRetourGare) ; remis a false une fois
    // arrive pour retrouver le suivi doux normal.
    this.CameraDoitSauterEnX = false;

    // PNJ de dialogue et textes de zone : voir le commentaire pres de
    // "CreerPNJs" plus haut — appeles ici, une fois le joueur et la camera
    // deja en place, pour qu'une erreur dans l'un d'eux ne puisse pas
    // empecher le jeu de base de fonctionner.
    if (this.CarteChargee) {
      try {
        this.CreerPNJs(this.CarteChargee);
      } catch (Erreur) {
        console.error('Erreur en creant les PNJ de dialogue :', Erreur);
        this.PNJs = this.PNJs || [];
      }
      try {
        this.CreerTextesDeZone(this.CarteChargee);
      } catch (Erreur) {
        console.error('Erreur en creant les textes de zone :', Erreur);
      }
    }

    // Entrees clavier : fleches + WASD/espace en alternative
    this.Fleches = this.input.keyboard.createCursorKeys();
    this.ToucheA = this.input.keyboard.addKey('A');
    this.ToucheD = this.input.keyboard.addKey('D');
    this.ToucheInteraction = this.input.keyboard.addKey('E');

    // Etat de la sequence gare : attente -> enCours -> termine.
    // this.CalqueGare n'existe qu'en mode Tiled (voir plus haut) ; en mode
    // prototype il reste undefined et l'interaction ne se declenche jamais.
    this.EtatGare = 'attente';

    // Mini-jeu de dialogue PNJ (voir OuvrirDialoguePNJ) : aucun dialogue en
    // cours au demarrage. Gele les controles du joueur pendant que la boite
    // de dialogue est ouverte (voir le garde-fou de mouvement plus bas).
    this.DialogueOuvert = false;
    this.PageDialogueEnAttente = false;

    // Glisser-deposer des mots du dialogue : geres une seule fois au niveau
    // de la scene (pas besoin de les re-brancher a chaque ouverture — les
    // objets glissables n'existent que pendant qu'une boite de dialogue est
    // ouverte, donc ces evenements n'ont simplement rien a faire le reste du
    // temps).
    this.input.on('drag', (Pointeur, Objet, X, Y) => {
      Objet.x = X;
      Objet.y = Y;
    });
    this.input.on('drop', (Pointeur, Objet, Trou) => {
      if (Trou.MotDedans && Trou.MotDedans !== Objet) {
        // Trou deja occupe par un autre mot : refuse, revient d'ou il vient.
        Objet.setPosition(Objet.PositionOrigineX, Objet.PositionOrigineY);
        return;
      }
      if (Objet.EmplacementActuel && Objet.EmplacementActuel !== Trou) {
        Objet.EmplacementActuel.MotDedans = null; // libere l'ancien trou
      }
      // Le mot vient potentiellement d'une liste fixee a l'ecran
      // (scrollFactor 0, voir OuvrirDialoguePNJ) alors que le trou est un
      // objet du monde : on le fait "rejoindre" le monde une fois pose,
      // sinon ses coordonnees seraient interpretees dans le mauvais repere
      // et il apparaitrait au mauvais endroit des que la camera bouge/zoome.
      Objet.setScrollFactor(1);
      // Trou a pour origine (0, 0.5) (voir OuvrirDialoguePNJ) : Trou.x est
      // son bord gauche, pas son centre —+largeur/2 pour y centrer le mot
      // (qui a lui une origine (0.5, 0.5)).
      const CentreX = Trou.x + Trou.width / 2;
      Objet.setPosition(CentreX, Trou.y);
      Objet.PositionOrigineX = CentreX;
      Objet.PositionOrigineY = Trou.y;
      Trou.MotDedans = Objet;
      Objet.EmplacementActuel = Trou;
      this.VerifierDialogueComplet();
    });
    this.input.on('dragend', (Pointeur, Objet, Depose) => {
      if (!Depose) {
        Objet.setPosition(Objet.PositionOrigineX, Objet.PositionOrigineY);
      }
    });

    // Le son ne peut demarrer qu'apres une premiere interaction utilisateur
    // (restriction des navigateurs) : on l'accroche au premier clic OU la premiere touche
    this.input.once('pointerdown', DemarrerSonAmbiance);
    this.input.keyboard.once('keydown', DemarrerSonAmbiance);

    // Arrivee en train (voir init()/CarteSuivante) : declenchee en tout
    // dernier, une fois le reste de la scene entierement pret (calques,
    // joueur, camera, PNJ...), pour que l'animation d'arrivee se joue sur une
    // scene complete plutot qu'a moitie construite.
    if (this.ArriveeParTrain && this.CalqueGare) {
      this.JouerArriveeEnTrain();
    }
  }

  update(Temps, TempsEcoule) {
    if (this.LargeurMondeCarte) this.MettreAJourCamera();

    // Interaction gare : tant que rien n'a ete declenche (EtatGare
    // "attente"), l'icone suit le joueur et boucle son invite des qu'il entre
    // dans ZoneGare. Sur appui de E, elle joue une fois son animation
    // "E qui eclate" — la sequence de la gare elle-meme ne demarre qu'a la
    // toute fin de cette animation (voir DemarrerSequenceGare plus bas).
    if (this.CalqueGare && this.EtatGare === 'attente') {
      const DansLaZone =
        this.Personnage.x > this.ZoneGare.XMin &&
        this.Personnage.x < this.ZoneGare.XMax &&
        this.Personnage.y > this.ZoneGare.YMin &&
        this.Personnage.y < this.ZoneGare.YMax;

      if (DansLaZone) {
        this.IconeInteraction.setVisible(true);
        this.IconeInteraction.play('iconeAttente', true); // true : ne relance pas si deja en cours

        if (Phaser.Input.Keyboard.JustDown(this.ToucheInteraction)) {
          this.EtatGare = 'enCours'; // verrouille tout de suite, empeche un second appui pendant l'anim
          this.IconeInteraction.play('iconePressee');
          this.IconeInteraction.once('animationcomplete', () => {
            this.IconeInteraction.setVisible(false);
            this.DemarrerSequenceGare();

            
          });
        }
      } else {
        this.IconeInteraction.setVisible(false);
      }
    }

    // Interaction retour : symetrique de la gare, une fois arrive de l'autre
    // cote du tunnel (EtatGare "retourAttente", voir DemarrerSequenceGare).
    // Meme mecanique (icone qui suit, E pour declencher), mais renvoie vers
    // DemarrerRetourGare plutot que DemarrerSequenceGare.
    if (this.CalqueGare && this.EtatGare === 'retourAttente') {
      const DansZoneRetour =
        this.Personnage.x > ZoneRetour.XMin &&
        this.Personnage.x < ZoneRetour.XMax &&
        this.Personnage.y > ZoneRetour.YMin &&
        this.Personnage.y < ZoneRetour.YMax;

      if (DansZoneRetour) {
        this.IconeInteractionRetour.setVisible(true);
        this.IconeInteractionRetour.play('iconeAttente', true);

        if (Phaser.Input.Keyboard.JustDown(this.ToucheInteraction)) {
          this.EtatGare = 'enCours';
          this.IconeInteractionRetour.play('iconePressee');
          this.IconeInteractionRetour.once('animationcomplete', () => {
            this.IconeInteractionRetour.setVisible(false);
            this.DemarrerRetourGare();
          });
        }
      } else {
        this.IconeInteractionRetour.setVisible(false);
      }
    }

    // Interaction tele : chaque appui sur E a proximite accelere le
    // cardiogramme (le bip suit tout seul, voir 'animationrepeat' plus haut)
    // et fait trembler l'ecran. Contrairement a la gare, l'icone E ne
    // disparait pas au premier appui : elle rejoue son invite entre chaque
    // (voir IconeTeleEnCours) et ne s'efface pour de bon qu'au 5e, quand la
    // ligne devient plate.
    // Ligne plate continue : contrairement au bip discret (attenue une seule
    // fois, au moment ou il se declenche), ce son dure indefiniment, donc son
    // volume doit etre reevalue image par image pendant que le joueur se
    // deplace (voir VolumeSonSelonDistanceTele).
    if (this.GainLignePlate) {
      this.GainLignePlate.gain.value = 0.09 * VolumeSonSelonDistanceTele(this.Personnage.x, this.Personnage.y);
    }

    if (this.SpriteTele && !this.TeleHS) {
      const DansZoneTele =
        this.Personnage.x > ZoneTele.XMin &&
        this.Personnage.x < ZoneTele.XMax &&
        this.Personnage.y > ZoneTele.YMin &&
        this.Personnage.y < ZoneTele.YMax;

      if (DansZoneTele) {
        this.IconeInteractionTele.setVisible(true);
        if (!this.IconeTeleEnCours) {
          this.IconeInteractionTele.play('iconeAttente', true); // true : ne relance pas si deja en cours
        }

        if (Phaser.Input.Keyboard.JustDown(this.ToucheInteraction)) {
          this.CompteurAppuisTele++;
          this.IconeTeleEnCours = true;
          this.IconeInteractionTele.play('iconePressee');
          this.IconeInteractionTele.once('animationcomplete', () => {
            this.IconeTeleEnCours = false;
            // Sinon la boucle ci-dessus rejoue iconeAttente a la frame suivante.
            if (this.TeleHS) this.IconeInteractionTele.setVisible(false);
          });

          if (this.CompteurAppuisTele < VitessesCardiogramme.length) {
            this.SpriteTele.play({ key: 'cardiogramme', frameRate: VitessesCardiogramme[this.CompteurAppuisTele], repeat: -1 });
            this.Secouer(this.SpriteTele, 200, 1, () => {});
          } else {
            this.DeclencherLignePlateTele();
          }
        }
      } else {
        this.IconeInteractionTele.setVisible(false);
      }
    }

    // Interaction PNJ (mini-jeu de dialogue) : meme principe que la gare/la
    // tele — icone qui suit tant que le joueur est a portee, E pour lancer.
    // this.PNJs peut contenir plusieurs PNJ (voir CreerPNJs) ; aucun ne
    // reagit tant qu'une boite de dialogue est deja ouverte.
    if (this.PNJs && !this.DialogueOuvert) {
      this.PNJs.forEach((PNJ) => {
        // Termine : deja repondu, plus jamais interactif. EnAttenteOuverture :
        // E vient d'etre presse, l'animation "iconePressee" est en cours —
        // sans ce verrou, le "play('iconeAttente', true)" ci-dessous se
        // relancerait a chaque frame suivante tant que le joueur reste dans
        // la zone (ce qui est le cas la plupart du temps, vu que l'animation
        // ne dure qu'une fraction de seconde) et interromprait
        // "iconePressee" avant qu'elle ait la moindre chance de terminer —
        // le dialogue ne s'ouvrait donc jamais (meme principe de verrou
        // immediat que EtatGare='enCours' pour la gare).
        if (PNJ.Termine || PNJ.EnAttenteOuverture) return;

        const DansZonePNJ =
          this.Personnage.x > PNJ.Zone.XMin &&
          this.Personnage.x < PNJ.Zone.XMax &&
          this.Personnage.y > PNJ.Zone.YMin &&
          this.Personnage.y < PNJ.Zone.YMax;

        if (DansZonePNJ) {
          PNJ.Icone.setVisible(true);
          PNJ.Icone.play('iconeAttente', true);

          if (Phaser.Input.Keyboard.JustDown(this.ToucheInteraction)) {
            PNJ.EnAttenteOuverture = true;
            PNJ.Icone.play('iconePressee');
            PNJ.Icone.once('animationcomplete', () => {
              PNJ.Icone.setVisible(false);
              this.OuvrirDialoguePNJ(PNJ);
            });
          }
        } else {
          PNJ.Icone.setVisible(false);
        }
      });
    }

    // Une page de dialogue PNJ vient d'etre completee et il en reste
    // d'autres (voir VerifierDialogueComplet) : E fait apparaitre la
    // suivante.
    if (this.PageDialogueEnAttente && Phaser.Input.Keyboard.JustDown(this.ToucheInteraction)) {
      this.AvancerPageDialogue();
    }

    if (this.TextesDeZoneSprites) this.MettreAJourTextesDeZone(TempsEcoule);
    if (this.BrinsHerbe) this.MettreAJourHerbe();
    if (this.CalqueTunnel) this.MettreAJourTunnel();

    // Aucun controle pendant le voyage en train (voir DemarrerSequenceGare)
    // ni pendant un dialogue PNJ (voir OuvrirDialoguePNJ) : le corps physique
    // est desactive, mais sans ce garde-fou les touches tenues enfoncees
    // continueraient quand meme a jouer bruits de pas/sauts sur un
    // personnage invisible ou fige.
    if (this.EtatGare !== 'enCours' && !this.DialogueOuvert) {
      const Corps = this.Personnage.body;
      const Vitesse = 70;

      const Gauche = this.Fleches.left.isDown || this.ToucheA.isDown;
      const Droite = this.Fleches.right.isDown || this.ToucheD.isDown;

      if (Gauche) {
        Corps.setVelocityX(-Vitesse);
        this.Orientation = 'gauche';
        if (UtiliseSpritePersonnage) {
          this.Personnage.setFlipX(true); // retourne le sprite vers la gauche
          this.Personnage.anims.play('marche', true);
        }
      } else if (Droite) {
        Corps.setVelocityX(Vitesse);
        this.Orientation = 'droite';
        if (UtiliseSpritePersonnage) {
          this.Personnage.setFlipX(false);
          this.Personnage.anims.play('marche', true);
        }
      }

      // Bruit de pas + petit nuage de poussiere sous les pieds : seulement en
      // marchant au sol, cadence par un compte a rebours en ms (independant
      // du framerate) plutot que toutes les frames. Meme emetteur que
      // l'atterrissage (voir this.EmetteurPoussiere), juste avec moins de
      // particules — un nuage discret plutot qu'une explosion.
      if ((Gauche || Droite) && Corps.blocked.down) {
        this.DelaiProchainPas -= TempsEcoule;
        if (this.DelaiProchainPas <= 0) {
          JouerSonPas();
          this.EmetteurPoussiere.explode(2, this.Personnage.x, this.Personnage.y + 8);
          this.DelaiProchainPas = 260;
        }
      } else {
        this.DelaiProchainPas = 0; // pret a jouer un pas des la reprise de la marche
      }

      // Intensite de marche (voir sa declaration dans create()) : meme
      // condition que le bruit de pas (marche au sol), montee/descente en
      // fondu pour ne pas s'enclencher/s'arreter d'un coup.
      const IntensiteMarcheVoulue = (Gauche || Droite) && Corps.blocked.down ? 1 : 0;
      this.IntensiteMarche = Phaser.Math.Linear(this.IntensiteMarche, IntensiteMarcheVoulue, VitesseFonduMarche);

      // Tangage : leger balancement de rotation du personnage en marchant,
      // comme une demarche naturelle. S'annule tout seul en fondu avec
      // l'intensite (donc aussi a l'arret ou en l'air, sans avoir besoin de
      // le remettre a zero explicitement ailleurs).
      if (UtiliseSpritePersonnage) {
        this.Personnage.rotation = Math.sin(Temps * FrequenceTangagePersonnage) * AmplitudeTangagePersonnage * this.IntensiteMarche;
      }

      if (!Gauche && !Droite) {
        Corps.setVelocityX(0);
        if (UtiliseSpritePersonnage) {
          // Immobile (frame 3) : flip selon la derniere direction regardee,
          // meme mecanisme que la marche (plus de frames idle distinctes par
          // sens comme avant).
          this.Personnage.anims.stop();
          this.Personnage.setFlipX(this.Orientation === 'gauche');
          this.Personnage.setFrame(3);
        }
      }

      // Pas de saut : le personnage ne quitte le sol que s'il marche hors
      // d'une plateforme (la gravite fait le reste). En l'air, en priorite
      // sur la marche/idle ci-dessus qui aurait pu s'appliquer si des
      // touches de direction sont tenues en meme temps — frame 4 (index 3,
      // standby) pendant la chute.
      if (UtiliseSpritePersonnage && !Corps.blocked.down) {
        this.Personnage.anims.stop();
        this.Personnage.setFrame(3);
      }

      // Atterrissage : front montant de Corps.blocked.down (faux la frame
      // d'avant, vrai maintenant) = le joueur vient de toucher le sol.
      if (!this.EtaitAuSol && Corps.blocked.down) {
        JouerSonAtterrissage();
        this.EmetteurPoussiere.explode(6, this.Personnage.x, this.Personnage.y + 8);
        // Reprend le frame 2 (index 1), un instant avant de repasser en
        // marche/idle a la frame suivante.
        if (UtiliseSpritePersonnage) {
          this.Personnage.setFrame(1);
        }
      }
      this.EtaitAuSol = Corps.blocked.down;
    }
  }

  // 5e appui sur la tele : le cardiogramme laisse place a l'ecran mort
  // (tele_death.png) et le bip discret laisse place a un bip continu et
  // sourd (JouerSonLignePlate).
  DeclencherLignePlateTele() {
    this.TeleHS = true;
    this.SpriteTele.play('ecranMort');
    // Reference gardee sur le noeud de gain : update() l'ajuste en continu
    // selon la distance du joueur (voir VolumeSonSelonDistanceTele).
    this.GainLignePlate = JouerSonLignePlate();
  }

  // Le joueur disparait et devient immobile pour de vrai (corps physique
  // desactive, sinon la gravite continue de s'appliquer meme invisible), la
  // mosaique statique cede la place au sprite anime : clignoteGare (frames 3
  // et 4, deux fois, lentement) -> tremblement -> resteGare (le train
  // demarre, index 5 a la fin). Ecran noir pendant le trajet, puis SOIT
  // reapparition a l'autre bout du tunnel de LA MEME carte (mosaique inversee
  // du calque "derriere", si present — voir this.ArriveeTrainConfiguree), SOIT
  // (carte sans calque "derriere", ex: "debut") un vrai changement de carte
  // si CarteSuivante en configure une (voir this.scene.restart(...) plus bas
  // et JouerArriveeEnTrain, symetrique cote carte d'arrivee).
  DemarrerSequenceGare() {
    this.EtatGare = 'enCours';

    // Position avant le voyage : retenue pour y ramener le joueur au retour
    // (voir DemarrerRetourGare), sans dependre d'une case en dur qui ne
    // correspondrait pas forcement a l'endroit exact ou il a embarque.
    this.PositionAvantVoyage = { x: this.Personnage.x, y: this.Personnage.y };

    this.Personnage.setVisible(false);
    this.Personnage.body.setVelocity(0, 0);
    this.Personnage.body.enable = false;
    // Remise a plat de l'orientation/position du sprite : au cas ou ce
    // serait un 2e aller (apres un retour), il a ete laisse flippe et
    // repositionne a l'arrivee la fois precedente (voir plus bas).
    this.SpriteGare.setFlipX(false);
    this.SpriteGare.setPosition(this.PositionGareX, this.PositionGareY);
    this.SpriteGare.setVisible(true);
    this.SpriteGare.play('clignoteGare');

    this.SpriteGare.once('animationcomplete', () => {
      this.Secouer(this.SpriteGare, 600, 1, () => {
        this.SpriteGare.play('resteGare');
        this.SpriteGare.once('animationcomplete', () => {
          // Le train est parti : ecran noir le temps du trajet.
          this.cameras.main.fadeOut(500, 0, 0, 0);
          this.cameras.main.once('camerafadeoutcomplete', () => {
            // Cette carte n'a pas (encore) de destination configuree ICI
            // (pas de calque "derriere" — voir this.ArriveeTrainConfiguree
            // dans create()) : deux cas possibles — soit une carte suivante
            // existe (voir CarteSuivante) et on change vraiment de carte,
            // soit non et le train ne mene nulle part pour l'instant (le
            // joueur reapparait simplement la ou il etait).
            if (!this.ArriveeTrainConfiguree) {
              const CarteApres = CarteSuivante[this.NomCarteActuelle];
              if (CarteApres) {
                // La scene entiere redemarre avec la carte suivante (voir
                // init() et JouerArriveeEnTrain, appele depuis le create()
                // de la nouvelle instance). Ecran deja noir a cet instant
                // (fadeOut ci-dessus) : aucune coupure visible.
                this.scene.restart({ carte: CarteApres, arrivee: true });
                return;
              }
              this.SpriteGare.setFrame(0);
              this.Personnage.setPosition(this.PositionAvantVoyage.x, this.PositionAvantVoyage.y);
              this.Personnage.setVisible(true);
              this.Personnage.body.enable = true;
              this.cameras.main.fadeIn(500, 0, 0, 0);
              this.EtatGare = 'attente';
              return;
            }

            this.SpriteGare.setVisible(false);

            // Teleportation pendant que l'ecran est noir. CameraDoitSauterEnX
            // force MettreAJourCamera a se recadrer instantanement sur la
            // nouvelle position au lieu de mettre plusieurs frames a
            // "rattraper" le suivi doux habituel (voir remise a false plus
            // bas, une fois arrive).
            this.Personnage.setPosition(PositionSortieTunnelX, PositionSortieTunnelY);
            this.CameraDoitSauterEnX = true;

            this.SpriteGare.setFlipX(true);
            this.SpriteGare.setPosition(PositionGareInverseeX, this.PositionGareY);
            this.SpriteGare.setVisible(true);
            this.SpriteGare.play('arriveeGare');

            this.cameras.main.fadeIn(500, 0, 0, 0);

            this.SpriteGare.once('animationcomplete', () => {
              this.CameraDoitSauterEnX = false; // suivi doux normal pour la suite
              // Reste visible, fige sur la frame 0 (train a l'arret) plutot
              // que de disparaitre : la sortie du tunnel n'a pas de mosaique
              // statique equivalente a CalqueGare, donc pas de "dessous" vers
              // lequel revenir a cet endroit.
              this.SpriteGare.setFrame(0);
              this.Personnage.setVisible(true);
              this.Personnage.body.enable = true;
              // "retourAttente" plutot que "termine" : le joueur peut
              // desormais declencher le trajet retour (voir ZoneRetour dans
              // update() et DemarrerRetourGare).
              this.EtatGare = 'retourAttente';
            });
          });
        });
      });
    });
  }

  // Trajet retour : exactement la meme sequence que l'aller
  // (DemarrerSequenceGare), juste inversee. Le sprite est deja sur place a
  // l'arrivee (flippe, laisse par l'aller) : il "repart" donc d'ici
  // (clignote -> tremble -> resteGare, comme au tout premier depart) puis
  // "arrive" a l'origine (arriveeGare, sprite remis a l'endroit) pendant que
  // l'ecran se rallume. Ramene le joueur exactement a sa position d'avant le
  // voyage (voir PositionAvantVoyage dans DemarrerSequenceGare), puis remet
  // EtatGare a "attente" pour permettre un nouvel aller-retour.
  DemarrerRetourGare() {
    this.EtatGare = 'enCours';

    this.Personnage.setVisible(false);
    this.Personnage.body.setVelocity(0, 0);
    this.Personnage.body.enable = false;

    this.SpriteGare.setVisible(true);
    this.SpriteGare.play('clignoteGare');

    this.SpriteGare.once('animationcomplete', () => {
      this.Secouer(this.SpriteGare, 600, 1, () => {
        this.SpriteGare.play('resteGare');
        this.SpriteGare.once('animationcomplete', () => {
          // Le train repart de l'arrivee : ecran noir le temps du trajet.
          this.cameras.main.fadeOut(500, 0, 0, 0);
          this.cameras.main.once('camerafadeoutcomplete', () => {
            this.SpriteGare.setVisible(false);

            this.Personnage.setPosition(this.PositionAvantVoyage.x, this.PositionAvantVoyage.y);
            this.CameraDoitSauterEnX = true; // recadrage instantane, meme principe qu'a l'aller

            this.SpriteGare.setFlipX(false); // a l'origine, sprite a l'endroit
            this.SpriteGare.setPosition(this.PositionGareX, this.PositionGareY);
            this.SpriteGare.setVisible(true);
            this.SpriteGare.play('arriveeGare');

            this.cameras.main.fadeIn(500, 0, 0, 0);

            this.SpriteGare.once('animationcomplete', () => {
              this.CameraDoitSauterEnX = false; // suivi doux normal pour la suite
              // Reste visible, fige sur la frame 0 (train a l'arret), au lieu
              // de disparaitre — meme logique qu'a l'arrivee (voir plus haut).
              // CalqueGare (la mosaique statique d'origine) reste cachee pour
              // de bon : ce sprite occupe deja exactement le meme endroit.
              this.SpriteGare.setFrame(0);
              this.Personnage.setVisible(true);
              this.Personnage.body.enable = true;
              this.EtatGare = 'attente'; // un nouvel aller est de nouveau possible
            });
          });
        });
      });
    });
  }

  // Arrivee en train sur CETTE carte, depuis la precedente (voir init(),
  // CarteSuivante et le this.scene.restart(...) dans DemarrerSequenceGare).
  // Le joueur est deja positionne pres de sa propre gare (this.PositionArriveeTrainX/Y,
  // voir create()) : on joue juste l'arrivee (arriveeGare, sprite flippe,
  // this.PositionGareXFlippe) sur SA mosaique "gare" a elle plutot que sur un
  // calque "derriere" dedie. this.CalqueGare (la mosaique Tiled) n'est
  // JAMAIS reaffiche, ici ou ailleurs (voir sa creation dans create()) : le
  // sprite anime reste visible en permanence, fige sur la frame 0 une fois
  // l'anim finie, pour eviter le leger decalage au pixel pres entre les deux
  // qui etait visible au moment de rebasculer de l'un a l'autre. Ecran deja
  // noir au demarrage de cette carte (voir DemarrerSequenceGare, fadeOut
  // avant le restart) : fadeOut(0) ici garantit qu'aucune frame ne s'affiche
  // entre-temps meme si ce n'etait pas deja le cas (ex: carte ouverte
  // directement via ?carte=... en test).
  JouerArriveeEnTrain() {
    this.cameras.main.fadeOut(0, 0, 0, 0);
    this.EtatGare = 'enCours';

    this.Personnage.setVisible(false);
    this.Personnage.body.setVelocity(0, 0);
    this.Personnage.body.enable = false;

    this.SpriteGare.setFlipX(true);
    this.SpriteGare.setPosition(this.PositionGareXFlippe, this.PositionGareY);
    this.SpriteGare.setVisible(true);
    this.SpriteGare.play('arriveeGare');

    this.cameras.main.fadeIn(500, 0, 0, 0);

    this.SpriteGare.once('animationcomplete', () => {
      this.SpriteGare.setFlipX(false);
      this.SpriteGare.setPosition(this.PositionGareX, this.PositionGareY);
      this.SpriteGare.setFrame(0); // reste visible, fige — voir le commentaire au-dessus
      this.Personnage.setVisible(true);
      this.Personnage.body.enable = true;
      // "attente" : cette gare redevient utilisable normalement, pour
      // continuer plus loin si une carte suivante lui est configuree un jour.
      this.EtatGare = 'attente';
    });
  }

  // Secoue un objet (petits decalages aleatoires de position) pendant
  // `Duree` ms avec une amplitude de `Intensite` px, puis le remet en place
  // et appelle `ALaFin`.
  Secouer(Cible, Duree, Intensite, ALaFin) {
    const PositionInitialeX = Cible.x;
    const PositionInitialeY = Cible.y;

    const MinuteurTremblement = this.time.addEvent({
      delay: 40,
      loop: true,
      callback: () => {
        Cible.x = PositionInitialeX + Phaser.Math.Between(-Intensite, Intensite);
        Cible.y = PositionInitialeY + Phaser.Math.Between(-Intensite, Intensite);
      },
    });

    this.time.delayedCall(Duree, () => {
      MinuteurTremblement.remove();
      Cible.x = PositionInitialeX;
      Cible.y = PositionInitialeY;
      ALaFin();
    });
  }

  // Lit les positions/frames du calque "devant" de la map et pose DEUX
  // sprites d'herbe superposes a chaque emplacement (au lieu de creer ce
  // calque comme des tuiles figees) : "Avant" (visible) et "Arriere" (cache,
  // alpha 0), utilises en alternance pour fondre d'une frame a l'autre dans
  // animated_grass plutot que de changer brutalement (voir DefinirImageHerbe).
  CreerBrinsHerbe(Carte) {
    this.BrinsHerbe = [];

    const DonneesCalque = Carte.getLayer('devant').data; // tableau 2D [ligne][colonne] de Tile

    // Voir le commentaire sur NombreVariantesHerbe plus haut : ce GID bouge
    // a chaque ajout de tuile dans Tileset.png, donc on le lit directement
    // depuis la map plutot que de le figer dans une constante.
    let IdentifiantDepartHerbe = Infinity;
    for (const Ligne of DonneesCalque) {
      for (const Tuile of Ligne) {
        if (Tuile.index > 0 && Tuile.index < IdentifiantDepartHerbe) IdentifiantDepartHerbe = Tuile.index;
      }
    }

    for (const Ligne of DonneesCalque) {
      for (const Tuile of Ligne) {
        if (Tuile.index <= 0) continue; // case vide

        // Meme variante (0 a 3) que sur la tuile d'origine, mais chaque
        // variante occupe maintenant 3 frames dans animated_grass.
        const Variante = Tuile.index - IdentifiantDepartHerbe;
        if (Variante < 0 || Variante >= NombreVariantesHerbe) continue; // tuile egaree (pas de l'herbe), on l'ignore
        const ImageStatique = Variante * ImagesParVariante;

        const Avant = this.add.sprite(Tuile.pixelX, Tuile.pixelY, CleHerbe, ImageStatique);
        Avant.setOrigin(0, 0); // meme ancrage qu'une tuile, alignement pixel-perfect garanti
        const Arriere = this.add.sprite(Tuile.pixelX, Tuile.pixelY, CleHerbe, ImageStatique);
        Arriere.setOrigin(0, 0);
        Arriere.setAlpha(0);
        Arriere.setDepth(Avant.depth + 1);

        this.BrinsHerbe.push({
          Avant,
          Arriere,
          PositionX: Tuile.pixelX + TailleImageHerbe / 2,
          ImageStatique,
          ImageCible: ImageStatique,
          DirectionActuelle: null, // null = debout, 'droite'/'gauche' = penche
          AnimationFondu: null,
        });
      }
    }
  }

  // Fait apparaitre `Image` en fondu (120ms) par-dessus la frame actuelle au
  // lieu d'un changement instantane. Ne relance pas de fondu si `Image` est
  // deja la cible en cours (evite de saccader si l'etat change tres vite).
  DefinirImageHerbe(Brin, Image) {
    if (Brin.ImageCible === Image) return;
    Brin.ImageCible = Image;

    if (Brin.AnimationFondu) Brin.AnimationFondu.stop();

    Brin.Arriere.setFrame(Image);
    Brin.Arriere.setAlpha(0);
    Brin.Arriere.setDepth(Brin.Avant.depth + 1);

    Brin.AnimationFondu = this.tweens.add({
      targets: Brin.Arriere,
      alpha: 1,
      duration: 120,
      onComplete: () => {
        Brin.Arriere.setAlpha(1); // garantit l'etat final meme si le tween est interrompu/force
        Brin.Avant.setAlpha(0);
        const Temporaire = Brin.Avant;
        Brin.Avant = Brin.Arriere;
        Brin.Arriere = Temporaire;
        Brin.AnimationFondu = null;
      },
    });
  }

  // Lit les rectangles portant une propriete personnalisee "texte" sur
  // "Calque d'Objets 1" (voir le commentaire pres de NomCoucheObjets) et cree
  // un objet Text Phaser par entree trouvee — une seule fois, jamais
  // repositionne ensuite (position fixe dans le monde) : seule sa visibilite
  // changera, selon la position du joueur (voir MettreAJourTextesDeZone).
  // Ne plante pas si la carte n'a aucun texte de zone (ex: aucun rectangle
  // avec cette propriete) : simplement aucune entree trouvee.
  CreerTextesDeZone(Carte) {
    const CoucheObjets = Carte.getObjectLayer(NomCoucheObjets);
    const Objets = CoucheObjets ? CoucheObjets.objects : [];

    this.TextesDeZoneEntrees = Objets
      .map((Objet) => {
        const Propriete = (Objet.properties || []).find((P) => P.name === 'texte');
        if (!Propriete || !Propriete.value) return null;
        const ProprietePoints = (Objet.properties || []).find((P) => P.name === 'points');
        return {
          Zone: { XMin: Objet.x, XMax: Objet.x + Objet.width, YMin: Objet.y, YMax: Objet.y + Objet.height },
          PositionX: Objet.x + Objet.width / 2,
          PositionY: Objet.y,
          Texte: Propriete.value,
          // Intro par points d'attente : optionnelle, seulement si la
          // propriete "points" est cochee dans Tiled (voir le commentaire
          // pres de NomCoucheObjets). Absente par defaut : ecrit directement.
          AvecPoints: ValeurBooleenneTiled(ProprietePoints && ProprietePoints.value),
          // Machine a etats de l'effet machine a ecrire (voir
          // MettreAJourTextesDeZone) : 'inactive' tant que le joueur n'est
          // jamais entre dans la zone (ou vient d'en ressortir avant la fin
          // de l'ecriture). 'termine' est definitif : une fois atteint, le
          // texte a ete montre une fois pour toutes et ne rejouera plus.
          Phase: 'inactive',
          Minuteur: 0,
          IndexPoints: 0,
          IndexLettre: 0,
        };
      })
      .filter(Boolean);

    this.TextesDeZoneSprites = this.TextesDeZoneEntrees.map((Entree) => {
      const Texte = this.add.text(Entree.PositionX, Entree.PositionY, '', StyleTexteDeZone);
      Texte.setOrigin(0.5, 1);
      Texte.setDepth(20);
      Texte.setVisible(false);
      // pixelArt: true (voir Configuration) met TOUTES les textures en
      // filtrage NEAREST par defaut — parfait pour les sprites, mais rend
      // un texte anti-aliase flou/crenele une fois agrandi par le zoom.
      // On repasse ce texte precis en LINEAR (lissage normal).
      Texte.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      // Effet de disparition (voir MettreAJourTextesDeZone) : flou qui
      // augmente pendant que le texte s'estompe, comme un nuage/une bulle de
      // pensee qui se dissipe. Intensite 0 au depart (invisible tant que la
      // disparition n'a pas commence). try/catch : postFX peut ne pas etre
      // disponible selon le contexte (ex: renderer pas encore pret) — sans
      // ca, une exception ici stopperait net create() avant meme que le
      // joueur et la camera soient crees plus bas, cassant tout le jeu pour
      // un simple effet de flou cosmetique.
      try {
        Entree.FxBlur = Texte.postFX.addBlur(0, 0.5, 0.5, 0, 0xffffff, 4);
      } catch (Erreur) {
        console.warn('Flou de disparition indisponible pour ce texte de zone :', Erreur);
        Entree.FxBlur = null;
      }
      return Texte;
    });
  }

  // Textes de zone (voir CreerTextesDeZone) : des que le joueur entre dans
  // une zone, sa phrase se joue en 3 temps — une petite attente suggeree par
  // des points qui apparaissent un a un ( "." -> ". ." -> ". . ." ), une
  // courte pause, puis le texte qui s'ecrit lettre par lettre (effet machine
  // a ecrire). Des qu'il sort de la zone, tout se reinitialise : le texte
  // rejouera la sequence complete depuis le debut a la prochaine entree.
  MettreAJourTextesDeZone(TempsEcoule) {
    this.TextesDeZoneEntrees.forEach((Entree, Index) => {
      const Sprite = this.TextesDeZoneSprites[Index];

      // Une fois le texte entierement ecrit, la suite (attente -> fondu flou
      // -> termine) se joue toute seule jusqu'au bout, meme si le joueur
      // ressort de la zone entre-temps — ce n'est plus une invite qui
      // suit sa presence, mais un evenement qui se termine de lui-meme.
      if (Entree.Phase === 'fini') {
        Entree.Minuteur += TempsEcoule;
        if (Entree.Minuteur < DureeAffichageFini) return;
        Entree.Phase = 'disparition';
        this.tweens.add({
          targets: Sprite,
          alpha: 0,
          duration: DureeDisparitionTexte,
          ease: 'Sine.easeIn',
          onComplete: () => {
            Entree.Phase = 'termine';
            Sprite.setVisible(false);
          },
        });
        if (Entree.FxBlur) {
          this.tweens.add({
            targets: Entree.FxBlur,
            strength: IntensiteFlouDisparition,
            duration: DureeDisparitionTexte,
            ease: 'Sine.easeIn',
          });
        }
        return;
      }
      // 'disparition' : le fondu ci-dessus est en cours (gere par les tweens
      // eux-memes). 'termine' : deja joue une fois, ne rejouera plus jamais.
      if (Entree.Phase === 'disparition' || Entree.Phase === 'termine') return;

      const DansLaZone =
        this.Personnage.x > Entree.Zone.XMin &&
        this.Personnage.x < Entree.Zone.XMax &&
        this.Personnage.y > Entree.Zone.YMin &&
        this.Personnage.y < Entree.Zone.YMax;

      if (!DansLaZone) {
        if (Entree.Phase !== 'inactive') {
          Entree.Phase = 'inactive';
          Sprite.setVisible(false);
        }
        return;
      }

      if (Entree.Phase === 'inactive') {
        // Vient d'entrer dans la zone : (re)demarre la sequence depuis le
        // tout debut. AvecPoints (voir CreerTextesDeZone) decide si ca
        // commence par l'intro de points d'attente ou directement par
        // l'ecriture — le premier point/la premiere lettre apparait tout de
        // suite, sans attendre le premier delai (sinon rien ne se passerait
        // a l'instant meme ou le joueur entre).
        Entree.Minuteur = 0;
        if (Entree.AvecPoints) {
          Entree.Phase = 'points';
          Entree.IndexPoints = 1;
          Entree.IndexLettre = 0;
          Sprite.setText('.');
        } else {
          Entree.Phase = 'ecriture';
          Entree.IndexLettre = 1;
          Sprite.setText(Entree.Texte.slice(0, 1));
          if (Entree.IndexLettre >= Entree.Texte.length) Entree.Phase = 'fini';
        }
        Sprite.setVisible(true);
        return;
      }

      Entree.Minuteur += TempsEcoule;

      if (Entree.Phase === 'points') {
        if (Entree.Minuteur < DelaiParPoint) return;
        Entree.Minuteur = 0;
        Entree.IndexPoints++;
        if (Entree.IndexPoints >= 3) {
          Sprite.setText('. . .');
          Entree.Phase = 'pause';
        } else {
          Sprite.setText(new Array(Entree.IndexPoints).fill('.').join(' '));
        }
      } else if (Entree.Phase === 'pause') {
        if (Entree.Minuteur < PauseApresPoints) return;
        Entree.Minuteur = 0;
        Entree.IndexLettre = 0;
        Sprite.setText('');
        Entree.Phase = 'ecriture';
      } else if (Entree.Phase === 'ecriture') {
        if (Entree.Minuteur < DelaiParLettre) return;
        Entree.Minuteur = 0;
        Entree.IndexLettre++;
        Sprite.setText(Entree.Texte.slice(0, Entree.IndexLettre));
        if (Entree.IndexLettre >= Entree.Texte.length) {
          Entree.Phase = 'fini';
        }
      }
    });
  }

  // Pilote scrollX/scrollY nous-memes, chaque frame, plutot que de laisser
  // startFollow s'en charger (voir le commentaire dans create() —
  // recalculer a partir de la taille ACTUELLE de la camera a chaque frame
  // rend ce suivi insensible a un redimensionnement de fenetre, contrairement
  // au follow natif de Phaser qui s'est avere le refaire tout seul de
  // travers dans ce cas).
  // X : suivi doux normal (Linear vers la position du joueur), ou saut
  // instantane pendant le voyage en train (this.CameraDoitSauterEnX, voir
  // DemarrerSequenceGare/DemarrerRetourGare).
  // Y : fixe sur CentreVerticalCadrage (le point du monde que l'on veut voir
  // au milieu de l'ecran) — augmente cette valeur pour "descendre" la vue
  // (faire monter l'horizon a l'ecran), diminue-la pour l'inverse.
  MettreAJourCamera() {
    const CentreVerticalCadrage = 140;
    const Cam = this.cameras.main;
    const LargeurVueMonde = Cam.width / Cam.zoom;
    const HauteurVueMonde = Cam.height / Cam.zoom;

    // Important : scrollX/scrollY de Phaser ne sont PAS directement le coin
    // haut-gauche de la zone du monde visible (worldView) des que le zoom
    // n'est pas egal a 1. En interne, Phaser calcule :
    //   worldView.x = scrollX + (Cam.width  - LargeurVueMonde) / 2
    //   worldView.y = scrollY + (Cam.height - HauteurVueMonde) / 2
    // (le zoom s'applique autour du centre de la camera, avec la largeur/
    // hauteur PLEINE de la camera, pas la largeur/hauteur deja divisee par
    // le zoom). Si on assigne directement la position voulue du worldView a
    // scrollX/scrollY (comme avant), la camera se retrouve decalee de
    // (Cam.width - LargeurVueMonde) / 2 par rapport a ce qu'on voulait — avec
    // un zoom eleve, cet ecart est enorme et pointe la camera vers une zone
    // vide du monde (ecran noir garanti, alors que le reste du jeu tourne
    // normalement). On calcule donc d'abord la position voulue du worldView,
    // puis on la convertit en scrollX/scrollY avec la formule inverse.
    // Anticipation : centre vise legerement decale dans le sens du regard du
    // personnage pendant la marche (voir DecalageAnticipationCameraMax),
    // pour montrer un peu plus loin devant que derriere. this.IntensiteMarche
    // (0 a l'arret/en l'air, 1 en pleine marche) sert directement de fondu :
    // pas besoin d'un lerp separe, celui deja en place sur scrollX plus bas
    // suffit a lisser la transition.
    const Anticipation = (this.Orientation === 'gauche' ? -1 : 1) * DecalageAnticipationCameraMax * (this.IntensiteMarche || 0);
    const VueXVoulue = Phaser.Math.Clamp(
      this.Personnage.x + Anticipation - LargeurVueMonde / 2,
      0,
      Math.max(0, this.LargeurMondeCarte - LargeurVueMonde)
    );
    const ScrollXVoulu = VueXVoulue + (LargeurVueMonde - Cam.width) / 2;
    Cam.scrollX = this.CameraDoitSauterEnX ? ScrollXVoulu : Phaser.Math.Linear(Cam.scrollX, ScrollXVoulu, 0.1);

    const VueYVoulue = Phaser.Math.Clamp(
      CentreVerticalCadrage - HauteurVueMonde / 2,
      0,
      Math.max(0, this.HauteurMondeCarte - HauteurVueMonde)
    );
    Cam.scrollY = VueYVoulue + (HauteurVueMonde - Cam.height) / 2;
  }

  // Lit chaque objet portant une propriete "ligneNPJ" sur "Calque d'Objets
  // 1" (voir le commentaire pres de SpritesPNJConnus pour le format exact)
  // et cree le PNJ correspondant : sprite fixe, icone d'interaction, zone
  // auto-calculee autour de sa position, et donnees de dialogue. this.PNJs
  // peut donc contenir zero, un, ou plusieurs PNJ selon la carte.
  CreerPNJs(Carte) {
    const CoucheObjets = Carte.getObjectLayer(NomCoucheObjets);
    const Objets = CoucheObjets ? CoucheObjets.objects : [];

    this.PNJs = Objets
      .filter((Objet) => (Objet.properties || []).some((P) => P.name === 'ligneNPJ'))
      .map((Objet) => {
        const Lire = (Nom, Defaut) => {
          const Propriete = (Objet.properties || []).find((P) => P.name === Nom);
          return Propriete ? Propriete.value : Defaut;
        };

        const CleSprite = Lire('sprite', SpritesPNJConnus[0].Cle);
        const Frame = ValeurNombreTiled(Lire('frame', 0), 0);

        const Sprite = this.add.sprite(Objet.x, Objet.y, CleSprite, Frame);
        Sprite.setOrigin(0.5, 1);
        Sprite.setDepth(4);

        const Icone = this.add.sprite(Objet.x, Objet.y - Sprite.height - TailleIconeInteraction, CleIconeInteraction, 0);
        Icone.setDepth(20);
        Icone.setVisible(false);

        // "phrase" est decoupee en "pages" (une ligne de dialogue affichee a
        // la fois, la suivante n'apparaissant qu'apres avoir appuye sur E —
        // voir AvancerPageDialogue) : un saut de ligne dans la propriete
        // separe deux pages (le bouton "..." a cote du champ, dans Tiled,
        // ouvre un editeur qui permet de taper plusieurs lignes). Sur chaque
        // page, "{}" marque un trou. Les mots de "mots" (separes par des
        // virgules) sont distribues aux pages dans l'ordre, un mot par trou.
        const Phrase = Lire('phrase', '');
        const MotsBruts = Lire('mots', '')
          .split(',')
          .map((Mot) => Mot.trim())
          .filter((Mot) => Mot.length > 0);

        let CurseurMots = 0;
        const Pages = Phrase.split('\n').map((LignePage) => {
          const Segments = [];
          LignePage.split('{}').forEach((Partie, Index, Tableau) => {
            Segments.push(Partie);
            if (Index < Tableau.length - 1) Segments.push(null);
          });
          const NombreTrous = Segments.filter((S) => S === null).length;
          const Mots = MotsBruts.slice(CurseurMots, CurseurMots + NombreTrous);
          CurseurMots += NombreTrous;
          return { Segments, Mots };
        });

        return {
          Sprite,
          Icone,
          Zone: {
            XMin: Objet.x - 24,
            XMax: Objet.x + 24,
            YMin: Objet.y - Sprite.height - 16,
            YMax: Objet.y + 16,
          },
          Dialogue: { LigneNPJ: Lire('ligneNPJ', ''), Intro: Lire('intro', ''), Pages },
          // Une fois qu'on lui a repondu, ce PNJ ne redevient plus jamais
          // interactif (voir JouerReactionFinDialogue).
          Termine: false,
          EnAttenteOuverture: false,
        };
      });
  }

  // Ouvre la boite de dialogue du mini-jeu PNJ (PNJ : une entree de
  // this.PNJs, voir CreerPNJs) : phrase a trous + mots a glisser dedans.
  // Gele le joueur (this.DialogueOuvert, voir le garde-fou de mouvement dans
  // update()) tant qu'elle est ouverte.
  OuvrirDialoguePNJ(PNJ) {
    this.DialogueOuvert = true;
    this.PNJActif = PNJ; // reference pour JouerReactionFinDialogue, une fois tous les trous remplis
    this.Personnage.body.setVelocity(0, 0);
    this.Personnage.body.enable = false;

    // Tout se passe dans le monde (pas une interface figee a l'ecran) : la
    // ligne du PNJ au-dessus de sa tete, la reponse a trous du joueur
    // au-dessus de la sienne, et les mots a glisser poses au sol devant lui —
    // "en tandem", chacun affiche a cote du personnage qui parle.
    this.ElementsDialogue = [];
    const Ajouter = (Objet) => {
      Objet.setDepth(25); // au-dessus de tout le reste (herbe, tunnel, icones)
      this.ElementsDialogue.push(Objet);
      return Objet;
    };
    const CreerTexteMonde = (Texte, Style = StyleTexteDeZone) => {
      const T = this.add.text(0, 0, Texte, Style);
      // Meme raison que dans CreerTextesDeZone : sans ca, ce texte
      // anti-aliase serait flou/crenele une fois agrandi par ZoomCamera avec
      // le filtrage NEAREST du jeu (pixelArt: true).
      T.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      return Ajouter(T);
    };

    // Ligne du PNJ, au-dessus de sa tete.
    const LigneNPJ = CreerTexteMonde(PNJ.Dialogue.LigneNPJ);
    LigneNPJ.setOrigin(0.5, 1);
    LigneNPJ.setPosition(PNJ.Sprite.x, PNJ.Sprite.y - PNJ.Sprite.height - 6);

    this.YLigneJoueur = this.Personnage.y - 16;
    // Fonctions/references reutilisees par AfficherPageDialogue et
    // AvancerPageDialogue (voir plus bas) : gardees sur l'instance plutot
    // que locales a cette methode.
    this.AjouterElementDialogue = Ajouter;
    this.CreerTexteMondeDialogue = CreerTexteMonde;

    // Retire un texte de l'ecran et de la liste de nettoyage (evite de le
    // detruire une 2e fois a la fermeture, puisque Ajouter/CreerTexteMonde
    // l'y avait deja ajoute).
    const Retirer = (Objet) => {
      this.ElementsDialogue = this.ElementsDialogue.filter((O) => O !== Objet);
      Objet.destroy();
    };
    this.RetirerElementDialogue = Retirer;

    // Un seul element de dialogue visible a la fois, comme une vraie
    // conversation qui s'enchaine — jamais la ligne du PNJ et la reponse du
    // joueur en meme temps. Ligne du PNJ affichee seule un instant, puis
    // remplacee soit par la reponse courte automatique (propriete "intro",
    // optionnelle), soit directement par la 1ere page de la phrase a trous.
    const DelaiAffichage = 900;
    this.time.delayedCall(DelaiAffichage, () => {
      Retirer(LigneNPJ);

      if (PNJ.Dialogue.Intro) {
        const LigneIntro = CreerTexteMonde(PNJ.Dialogue.Intro);
        LigneIntro.setOrigin(0.5, 1);
        LigneIntro.setPosition(this.Personnage.x, this.YLigneJoueur);
        this.time.delayedCall(DelaiAffichage, () => {
          Retirer(LigneIntro);
          this.AfficherPageDialogue(0);
        });
      } else {
        this.AfficherPageDialogue(0);
      }
    });
  }

  // Affiche une page de la reponse a trous (voir PNJ.Dialogue.Pages, decoupe
  // depuis la propriete "phrase" dans CreerPNJs) : ses segments/trous en
  // ligne au-dessus du joueur, et ses mots a glisser en bas de l'ecran.
  // Appelee une 1ere fois par OuvrirDialoguePNJ, puis par
  // AvancerPageDialogue a chaque fois que le joueur valide une page avec E.
  AfficherPageDialogue(IndexPage) {
    const PNJ = this.PNJActif;
    const Page = PNJ.Dialogue.Pages[IndexPage];
    this.IndexPageDialogue = IndexPage;
    const Ajouter = this.AjouterElementDialogue;
    const CreerTexteMonde = this.CreerTexteMondeDialogue;

    // Retour a la ligne automatique : chaque segment fixe est decoupe en
    // mots individuels (le decoupage n'a plus a se faire seulement aux
    // bornes des trous), pour pouvoir revenir a la ligne n'importe ou des
    // que la largeur max est depassee — sinon une phrase avec de longs
    // segments deborderait toujours de l'ecran, meme sur plusieurs "pages".
    this.TrousDialogue = [];
    const LargeurTrou = 18;
    const HauteurTrou = 8;
    const EspaceMot = 4;
    const HauteurLigne = 10;
    // worldView : rectangle (en coordonnees MONDE) de ce que la camera
    // affiche actuellement — deja calcule par Phaser en tenant compte du
    // zoom/scroll, donc plus fiable qu'un calcul a la main (largeur/hauteur
    // de canvas / ZoomCamera), qui peut se retrouver fausse selon la
    // resolution/mise a l'echelle reelle de l'ecran. Largeur max fixe (pas
    // "toute la largeur de l'ecran") : sur un tres grand ecran, la phrase
    // resterait sinon une ligne unique bien trop etiree.
    const Vue = this.cameras.main.worldView;
    const MaxLargeurLigne = Math.min(Vue.width - 20, 150);

    const Jetons = [];
    Page.Segments.forEach((Segment) => {
      if (Segment === null) {
        Jetons.push({ EstTrou: true });
      } else {
        Segment.split(' ')
          .filter((Mot) => Mot.length > 0)
          .forEach((Mot) => Jetons.push({ Texte: Mot }));
      }
    });

    const Elements = Jetons.map((Jeton) => {
      let Objet;
      let Largeur;
      if (Jeton.EstTrou) {
        Objet = this.add.rectangle(0, 0, LargeurTrou, HauteurTrou, 0xffffff, 0.15);
        Objet.setStrokeStyle(1, 0xffffff, 0.6);
        Objet.setInteractive({ dropZone: true });
        Objet.MotDedans = null;
        Largeur = LargeurTrou;
        this.TrousDialogue.push(Objet);
        Ajouter(Objet);
      } else {
        Objet = CreerTexteMonde(Jeton.Texte);
        Largeur = Objet.width;
      }
      Objet.setOrigin(0, 0.5);
      return { Objet, Largeur };
    });

    // Regroupe les elements en lignes (un nouveau mot/trou qui ferait
    // depasser MaxLargeurLigne demarre une nouvelle ligne).
    const Lignes = [[]];
    let LargeurLigneCourante = 0;
    Elements.forEach((Element) => {
      const LigneActuelle = Lignes[Lignes.length - 1];
      const AvecEspace = LigneActuelle.length > 0 ? EspaceMot : 0;
      if (LigneActuelle.length > 0 && LargeurLigneCourante + AvecEspace + Element.Largeur > MaxLargeurLigne) {
        Lignes.push([Element]);
        LargeurLigneCourante = Element.Largeur;
      } else {
        LigneActuelle.push(Element);
        LargeurLigneCourante += AvecEspace + Element.Largeur;
      }
    });

    // Positionne chaque ligne, centree sur le joueur — la derniere ligne
    // reste juste au-dessus de sa tete (YLigneJoueur), les precedentes
    // remontent d'autant de HauteurLigne qu'il en faut.
    Lignes.forEach((Ligne, IndexLigne) => {
      const LargeurLigne = Ligne.reduce((Somme, El, i) => Somme + El.Largeur + (i > 0 ? EspaceMot : 0), 0);
      let X = this.Personnage.x - LargeurLigne / 2;
      const Y = this.YLigneJoueur - (Lignes.length - 1 - IndexLigne) * HauteurLigne;
      Ligne.forEach((Element, i) => {
        if (i > 0) X += EspaceMot;
        Element.Objet.setPosition(X, Y);
        X += Element.Largeur;
      });
    });
    // Reference gardee pour la secousse/le rougissement de fin (voir
    // JouerReactionFinDialogue) : uniquement la ligne du joueur, pas celle
    // du PNJ.
    this.ElementsLigneJoueur = Elements.map(({ Objet }) => Objet);

    // Mots a glisser : en bas de la zone visible, sous l'horizon, comme une
    // liste horizontale — pas au sol sous le joueur (sa position deplacerait
    // toute la mise en page a chaque dialogue). Positionnes en coordonnees
    // MONDE directement depuis Vue (voir plus haut) plutot qu'en
    // scrollFactor(0) + division par le zoom — meme raison : plus fiable
    // face aux differences de resolution/mise a l'echelle d'un ecran a
    // l'autre.
    this.MotsDialogue = [];
    const MotsMelanges = Phaser.Utils.Array.Shuffle(Page.Mots.slice());
    const PaddingMots = 6; // espace entre deux etiquettes de mot
    const YMots = Vue.bottom - 14;

    // Cree d'abord toutes les etiquettes pour connaitre leur largeur reelle
    // (StyleMotDialogue leur ajoute un fond + une marge interne, donc chaque
    // mot n'a pas la meme largeur) avant de les repartir en ligne, centrees.
    const Tuiles = MotsMelanges.map((Mot) => {
      const Tuile = CreerTexteMonde(Mot, StyleMotDialogue);
      Tuile.setOrigin(0.5, 0.5);
      return Tuile;
    });
    const LargeurTotaleMots = Tuiles.reduce((Somme, T, i) => Somme + T.width + (i > 0 ? PaddingMots : 0), 0);
    let XMot = Vue.centerX - LargeurTotaleMots / 2;

    Tuiles.forEach((Tuile) => {
      Tuile.setPosition(XMot + Tuile.width / 2, YMots);
      Tuile.PositionOrigineX = Tuile.x;
      Tuile.PositionOrigineY = Tuile.y;
      Tuile.EmplacementActuel = null;
      Tuile.setInteractive({ draggable: true, useHandCursor: true });
      this.input.setDraggable(Tuile);
      this.MotsDialogue.push(Tuile);
      XMot += Tuile.width + PaddingMots;
    });

    // Au cas ou cette page n'a aucun trou (juste une ligne de texte) : rien
    // ne declenchera jamais VerifierDialogueComplet via un depot, donc on le
    // fait tout de suite nous-memes.
    this.VerifierDialogueComplet();
  }

  // Detruit la page de dialogue actuelle et, s'il en reste, affiche la
  // suivante — appelee sur E quand this.PageDialogueEnAttente est vrai (voir
  // VerifierDialogueComplet et le garde-fou dans update()).
  AvancerPageDialogue() {
    this.PageDialogueEnAttente = false;
    this.RetirerElementDialogue(this.IndicateurAvanceeDialogue);
    this.IndicateurAvanceeDialogue = null;
    [...this.ElementsLigneJoueur, ...this.MotsDialogue].forEach((Objet) => this.RetirerElementDialogue(Objet));
    this.AfficherPageDialogue(this.IndexPageDialogue + 1);
  }

  // Verifie si tous les trous de la phrase en cours sont remplis ; si oui,
  // referme la boite de dialogue apres un court instant. Peu importe les
  // mots choisis (voir le commentaire pres de SpritesPNJConnus) : rien a
  // valider, juste attendre que ce soit complet.
  VerifierDialogueComplet() {
    if (!this.TrousDialogue.every((Trou) => Trou.MotDedans !== null)) return;

    const DernierePage = this.IndexPageDialogue >= this.PNJActif.Dialogue.Pages.length - 1;
    if (!DernierePage) {
      // Encore des pages apres celle-ci : attend que le joueur appuie sur E
      // pour continuer (voir AvancerPageDialogue et le garde-fou dans
      // update()), comme un vrai dialogue qui s'enchaine page par page.
      this.PageDialogueEnAttente = true;
      const Dernier = this.ElementsLigneJoueur[this.ElementsLigneJoueur.length - 1];
      const Indicateur = this.CreerTexteMondeDialogue(' ▶');
      Indicateur.setOrigin(0, 0.5);
      Indicateur.setPosition(Dernier.x + Dernier.width, this.YLigneJoueur);
      this.IndicateurAvanceeDialogue = Indicateur;
      return;
    }

    this.time.delayedCall(600, () => {
      if (this.DialogueOuvert) this.JouerReactionFinDialogue();
    });
  }

  // Une fois tous les trous remplis (peu importe les mots choisis — voir le
  // commentaire pres de SpritesPNJConnus) : la reponse du joueur tremble et
  // rougit un instant, puis tout disparait — la phrase, les mots, la ligne
  // du PNJ et le PNJ lui-meme. this.PNJActif.Termine reste vrai pour
  // toujours : ce PNJ ne redeviendra plus jamais interactif.
  JouerReactionFinDialogue() {
    const PNJ = this.PNJActif;
    const ElementsSecoues = [...this.ElementsLigneJoueur, ...this.MotsDialogue];
    const PositionsInitiales = ElementsSecoues.map((Objet) => ({ x: Objet.x, y: Objet.y }));

    ElementsSecoues.forEach((Objet) => {
      if (Objet.setColor) Objet.setColor('#ff0000');
    });

    const DureeSecousse = 500;
    const Intensite = 2;
    const MinuteurSecousse = this.time.addEvent({
      delay: 40,
      loop: true,
      callback: () => {
        const DecalageX = Phaser.Math.Between(-Intensite, Intensite);
        const DecalageY = Phaser.Math.Between(-Intensite, Intensite);
        ElementsSecoues.forEach((Objet, Index) => {
          Objet.x = PositionsInitiales[Index].x + DecalageX;
          Objet.y = PositionsInitiales[Index].y + DecalageY;
        });
      },
    });

    this.time.delayedCall(DureeSecousse, () => {
      MinuteurSecousse.remove();
      this.ElementsDialogue.forEach((Objet) => Objet.destroy());
      PNJ.Sprite.destroy();
      PNJ.Icone.destroy();
      PNJ.Termine = true;

      this.ElementsDialogue = [];
      this.ElementsLigneJoueur = [];
      this.TrousDialogue = [];
      this.MotsDialogue = [];
      this.DialogueOuvert = false;
      this.PageDialogueEnAttente = false;
      this.PNJActif = null;
      this.Personnage.body.enable = true;
    });
  }

  // Un brin penche des que le joueur marche dessus, et le reste tant que le
  // joueur reste sur sa tuile (meme s'il s'arrete de bouger) — il ne revient
  // debout que lorsque le joueur quitte la tuile.
  MettreAJourHerbe() {
    const SeDeplaceADroite = this.Fleches.right.isDown || this.ToucheD.isDown;
    const SeDeplaceAGauche = this.Fleches.left.isDown || this.ToucheA.isDown;

    for (const Brin of this.BrinsHerbe) {
      const Distance = Math.abs(Brin.PositionX - this.Personnage.x);

      if (Distance < RayonReactionHerbe) {
        if (SeDeplaceADroite) Brin.DirectionActuelle = 'droite';
        else if (SeDeplaceAGauche) Brin.DirectionActuelle = 'gauche';
        // sinon : le joueur est toujours sur la tuile mais ne bouge pas,
        // on garde le dernier sens connu (etat "soumis au deplacement")
      } else {
        Brin.DirectionActuelle = null; // le joueur a quitte la tuile
      }

      const Image =
        Brin.DirectionActuelle === 'droite'
          ? Brin.ImageStatique + 1
          : Brin.DirectionActuelle === 'gauche'
            ? Brin.ImageStatique + 2
            : Brin.ImageStatique;

      this.DefinirImageHerbe(Brin, Image);
    }
  }

  // Fondu du tunnel selon la position horizontale du joueur : s'estompe des
  // qu'il entre dans son emprise (pour ne pas le cacher), redevient opaque
  // une fois ressorti. Phaser.Math.Linear avance doucement vers la cible au
  // lieu d'un saut net.
  MettreAJourTunnel() {
    const DansLeTunnel = this.Personnage.x > this.TunnelXMin && this.Personnage.x < this.TunnelXMax;
    const AlphaCible = DansLeTunnel ? TunnelAlphaMin : 1;
    this.CalqueTunnel.alpha = Phaser.Math.Linear(this.CalqueTunnel.alpha, AlphaCible, TunnelVitesseFondu);
  }
}

const Configuration = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#000000',
  pixelArt: true, // pas de flou d'interpolation sur les textures en pixel art
  scale: {
    // RESIZE + largeur/hauteur en % : le canvas occupe tout son parent
    // (ici #game-container, cale sur 100% de la fenetre par le CSS) et se
    // redimensionne automatiquement. On evite de lire window.innerWidth ici
    // directement : au moment ou ce script s'execute, la fenetre peut ne pas
    // encore avoir sa taille definitive.
    mode: Phaser.Scale.RESIZE,
    width: '100%',
    height: '100%',
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 900 },
      debug: false, // passe a true pour visualiser les corps physiques (utile en debug de map Tiled)
    },
  },
  scene: ScenePrincipale,
};

// Attend que la police custom des textes de zone soit chargee avant de
// demarrer le jeu, sinon le tout premier rendu utiliserait la police de
// repli (monospace) le temps qu'elle arrive (@font-face defini dans
// index.html). Course avec un delai maximum (DelaiMaxChargementPolice) :
// sur un reseau lent, document.fonts.load() peut ne jamais se resoudre du
// tout (ni succes ni echec, donc ni .then() ni .catch() ne se declenchent
// jamais) — sans ce filet, le jeu resterait bloque sur un ecran noir
// indefiniment plutot que de demarrer avec la police de repli.
const DelaiMaxChargementPolice = new Promise((Resoudre) => setTimeout(Resoudre, 2000));
Promise.race([
  document.fonts.load(`16px '${NomPoliceTexteDeZone}'`).catch(() => {}),
  DelaiMaxChargementPolice,
]).finally(() => {
  new Phaser.Game(Configuration);
});
