// HoldShapes — one recognisable shape per hold type, built with MeshKit.
// Each shape is centred on the origin, sits on the wall face at z = 0 and
// sticks out toward +Z (the user). Sizes come from WallLayout.HOLD_SIZE.

import { Geo, type RGBA, addExtrude, addLatheZ, roundedRect } from "./MeshKit";
import { HOLD_SIZE, type HoldType } from "./WallLayout";

/** pale warm resin: light enough to read on the additive display */
export const HOLD_COLOR: RGBA = [0.93, 0.88, 0.78, 1];
/** pocket pit: darker, so on the additive display it reads as a hole */
export const PIT_COLOR: RGBA = [0.32, 0.3, 0.27, 1];

const SEG = 28;

function scaleProfile(p: [number, number][], depth: number): [number, number][] {
  return p.map(([r, h]) => [r, h * depth] as [number, number]);
}

/** Big friendly dome with a raised bucket lip across the front. */
function jug(g: Geo) {
  const s = HOLD_SIZE.jug;
  const dome = scaleProfile(
    [[1, 0], [1, 0.22], [0.93, 0.5], [0.78, 0.76], [0.55, 0.93], [0.25, 1], [0, 1]], s.d * 0.85,
  );
  addLatheZ(g, dome, SEG, HOLD_COLOR, s.w / 2, s.h / 2);
  // bucket lip: a rounded bar proud of the lower half of the dome
  const lip = roundedRect(s.w * 0.78, s.h * 0.26, s.h * 0.12);
  addExtrude(g, lip, s.d * 0.3, s.d, HOLD_COLOR, [0, -s.h * 0.2, 0]);
}

/** Thin, wide edge. */
function crimp(g: Geo) {
  const s = HOLD_SIZE.crimp;
  addExtrude(g, roundedRect(s.w, s.h, s.h * 0.45), 0, s.d, HOLD_COLOR);
  // a slightly narrower top step so the edge reads in profile
  addExtrude(g, roundedRect(s.w * 0.86, s.h * 0.55, s.h * 0.25), s.d, s.d * 1.35, HOLD_COLOR, [0, s.h * 0.12, 0]);
}

/** Tall, narrow fin you squeeze from both sides. */
function pinch(g: Geo) {
  const s = HOLD_SIZE.pinch;
  const fin = scaleProfile([[1, 0], [0.97, 0.35], [0.85, 0.7], [0.6, 0.92], [0.3, 1], [0, 1]], s.d);
  addLatheZ(g, fin, SEG, HOLD_COLOR, s.w / 2, s.h / 2);
}

/** Rounded lump with a finger pit in the middle. */
function pocket(g: Geo) {
  const s = HOLD_SIZE.pocket;
  const outer = scaleProfile([[1, 0], [0.97, 0.4], [0.82, 0.78], [0.6, 0.97], [0.45, 1]], s.d);
  addLatheZ(g, outer, SEG, HOLD_COLOR, s.w / 2, s.h / 2, [0, 0, 0], false);
  // the pit continues the same surface inward and down, in a darker colour
  const pit = scaleProfile([[0.45, 1], [0.36, 0.9], [0.3, 0.6], [0.24, 0.4], [0, 0.36]], s.d);
  addLatheZ(g, pit, SEG, PIT_COLOR, s.w / 2, s.h / 2);
}

/** Wide, low, smooth dome with nothing to grab. */
function sloper(g: Geo) {
  const s = HOLD_SIZE.sloper;
  const dome = scaleProfile([[1, 0], [0.97, 0.2], [0.85, 0.5], [0.62, 0.8], [0.32, 0.97], [0, 1]], s.d);
  addLatheZ(g, dome, SEG, HOLD_COLOR, s.w / 2, s.h / 2);
}

export const HOLD_BUILDERS: Record<HoldType, (g: Geo) => void> = { jug, crimp, pinch, pocket, sloper };

export function buildHoldGeo(type: HoldType): Geo {
  const g = new Geo();
  HOLD_BUILDERS[type](g);
  return g;
}
