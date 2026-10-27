// WallLayout — the virtual bouldering wall stand-in (design brief "Wall").
//
// Wall coordinates match devpost/scoring-reference: centimetres, x = 0 at the
// LEFT edge (0..240), y = 0 at the FLOOR (0..300). The ClimbingWall component
// maps these onto its SceneObject (local x = x - 120, local y = y, holds on the
// +Z face, which faces the user).
//
// The first eight holds reuse the reference test geometry (lf, rf, lh, rh, up,
// far, side, low) so the numbers proven in scoring.test.js hold in the Lens.
// "far" moves from x 250 to x 228 to stay on the 240 cm panel; it is still
// ~110 cm from the RH shoulder, well past the 77 cm reach (always red).

export type HoldType = "jug" | "crimp" | "pinch" | "pocket" | "sloper";
export type Limb = "LH" | "RH" | "LF" | "RF";

export interface HoldDef {
  id: string;
  x: number;
  y: number;
  /** the hold's real shape; the demo preset marks every hold with this type */
  type: HoldType;
  /** in-plane rotation of the shape in degrees, for a less regimented wall */
  spin?: number;
}

export const WALL_WIDTH = 240;
export const WALL_HEIGHT = 300;
export const WALL_THICKNESS = 6;

/** climber: 175 cm tall, reach = height x 0.44 = 77 cm (brief) */
export const CLIMBER_HEIGHT = 175;
export const CLIMBER_REACH = CLIMBER_HEIGHT * 0.44;

export const HOLDS: HoldDef[] = [
  // --- reference geometry (scoring.test.js) ---
  { id: "lf", x: 95, y: 40, type: "jug" },
  { id: "rf", x: 145, y: 45, type: "jug", spin: -8 },
  { id: "lh", x: 90, y: 150, type: "jug", spin: 6 },
  { id: "rh", x: 150, y: 150, type: "jug", spin: -4 },
  { id: "up", x: 140, y: 190, type: "jug", spin: 10 },
  { id: "far", x: 228, y: 215, type: "jug", spin: -12 },
  { id: "side", x: 35, y: 150, type: "crimp", spin: 8 },
  { id: "low", x: 150, y: 95, type: "sloper" },
  // --- filler so the wall reads as a real problem ---
  { id: "h09", x: 115, y: 190, type: "pinch", spin: -6 },
  { id: "h10", x: 72, y: 188, type: "pinch", spin: 12 },
  { id: "h11", x: 182, y: 172, type: "pocket" },
  { id: "h12", x: 190, y: 135, type: "pinch", spin: 14 },
  { id: "h13", x: 58, y: 108, type: "pocket" },
  { id: "h14", x: 178, y: 78, type: "pinch", spin: -10 },
  { id: "h15", x: 38, y: 58, type: "sloper" },
  { id: "h16", x: 70, y: 72, type: "crimp", spin: -4 },
  { id: "h17", x: 122, y: 70, type: "pocket" },
  { id: "h18", x: 205, y: 38, type: "jug", spin: 20 },
  { id: "h19", x: 22, y: 232, type: "jug", spin: -15 },
  { id: "h20", x: 98, y: 252, type: "jug", spin: 5 },
  { id: "h21", x: 162, y: 240, type: "sloper" },
  { id: "h22", x: 58, y: 272, type: "pinch", spin: 6 },
  { id: "h23", x: 208, y: 276, type: "crimp", spin: -8 },
  { id: "h24", x: 132, y: 286, type: "pocket" },
];

/** demo preset (brief): both feet and both hands on low holds */
export const PRESET_POSITION: Record<Limb, string | null> = {
  LH: "lh",
  RH: "rh",
  LF: "lf",
  RF: "rf",
};

/**
 * Hold footprint per type (cm): width x height on the wall, depth out of it,
 * and the ring radius to draw around it (rings are 15-20 cm across, a little
 * bigger than the hold).
 */
export const HOLD_SIZE: Record<HoldType, { w: number; h: number; d: number; ringR: number }> = {
  jug: { w: 15, h: 11, d: 7, ringR: 9.5 },
  crimp: { w: 14, h: 4.5, d: 3.5, ringR: 8.5 },
  pinch: { w: 5.5, h: 13, d: 6, ringR: 8.5 },
  pocket: { w: 11, h: 10, d: 5, ringR: 8 },
  sloper: { w: 16, h: 13, d: 4.5, ringR: 10 },
};

export function holdById(id: string): HoldDef | undefined {
  for (const h of HOLDS) if (h.id === id) return h;
  return undefined;
}
