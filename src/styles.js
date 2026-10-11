// styles.js — l'aspect des textes poses dans le monde (les dialogues, les
// textes de zone). Des textes DANS le monde, pas une interface a l'ecran : ils
// sont agrandis par le zoom de la camera, donc petite police, contour noir, et
// "resolution: 5" (= le zoom) pour qu'ils restent nets une fois agrandis.

// un texte pose dans le monde : blanc avec un contour noir, centre
export var style_texte = {
  fontFamily: "DeltaruneExtended, monospace",
  fontSize: "6px",
  color: "#ffffff",
  stroke: "#000000",
  strokeThickness: 2,
  align: "center",
  wordWrap: { width: 120 },
  resolution: 5
};

// un mot a placer dans un dialogue : un petit fond derriere, comme une etiquette
export var style_mot = {
  fontFamily: "DeltaruneExtended, monospace",
  fontSize: "6px",
  color: "#ffffff",
  stroke: "#000000",
  strokeThickness: 1,
  backgroundColor: "rgba(0, 0, 0, 0.55)",
  padding: { x: 2, y: 1 },
  resolution: 5
};
