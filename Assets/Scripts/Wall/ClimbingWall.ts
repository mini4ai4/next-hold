// ClimbingWall — builds the virtual bouldering wall stand-in at runtime with
// MeshBuilder: a 240 x 300 cm panel and every hold from WallLayout.
//
// Put it on a SceneObject whose origin is where the wall meets the floor,
// bottom-centre, facing the user (+Z toward the user). Brief placement:
// on the floor, ~100 cm in front of the user.
//
// Each hold gets its own child SceneObject "Hold_<id>" (so other scripts can
// make it pinchable / hang a ring on it). Holds of the same type and tone
// share one RenderMesh. A box collider per hold is added unless addColliders
// is off; it is sized to the ring, so the pinch target is big.
//
// Look: birch-ply sheets (procedural texture) with staggered T-nuts, thin
// seams and a light trim, all toned down so the rings stay the strongest
// element; holds in light neutral resin tones with a soft contact shadow.

import {
  GEO_LAYOUT, Geo, type RGBA, UVGeo, UV_LAYOUT, addBox, addProfileAnnulus, addUVQuad,
} from "./MeshKit";
import { buildHoldGeo, toneFor } from "./HoldShapes";
import {
  HOLDS, HOLD_SIZE, type HoldDef, type HoldType, WALL_HEIGHT, WALL_THICKNESS, WALL_WIDTH,
} from "./WallLayout";
import {
  ProfileRow, getPlywoodTexture, overlayMaterial, profileV, setWrap,
} from "./ProceduralTextures";

/** plywood edge and back, seen only from the side */
const PANEL_COLOR: RGBA = [0.62, 0.56, 0.47, 1];
/** the hairline gap between two sheets */
const SEAM_COLOR: RGBA = [0.44, 0.4, 0.34, 1];
/** light timber trim so the wall outline reads on the additive display */
const FRAME_COLOR: RGBA = [0.8, 0.74, 0.62, 1];
const TNUT_FLANGE: RGBA = [0.66, 0.66, 0.67, 1];
const TNUT_HOLE: RGBA = [0.13, 0.12, 0.11, 1];
/** tint on the ply texture: keeps the face mid-light, under the rings */
const FACE_TINT = new vec4(0.72, 0.72, 0.72, 1);
/** one texture tile covers this many cm of ply */
const TEX_CM = 60;

const SHEET_W = 120;
const SHEET_H = 100;
const TNUT_PITCH = 20;

function toMesh(g: { v: number[]; i: number[] }, layout = GEO_LAYOUT): RenderMesh {
  const b = new MeshBuilder(layout);
  b.topology = MeshTopology.Triangles;
  b.indexType = MeshIndexType.UInt16;
  b.appendVerticesInterleaved(g.v);
  b.appendIndices(g.i);
  b.updateMesh();
  return b.getMesh();
}

@component
export class ClimbingWall extends BaseScriptComponent {
  @input
  @hint("vertexBaseColorMaterial (SimpleVertexBaseColor package)")
  material: Material;

  @input
  @hint("Unlit material with Base Texture enabled (NextHoldTexturedUnlit): ply face and hold shadows")
  @allowUndefined
  texturedMaterial: Material;

  @input
  @hint("Add a box collider per hold, sized to its ring, for pinch targets")
  addColliders: boolean = true;

  private holdObjects: { [id: string]: SceneObject } = {};
  private built = false;

  onAwake() {
    this.build();
  }

  /** Safe to call from other scripts' onAwake; builds once. */
  build() {
    if (this.built) return;
    this.built = true;
    this.buildPanel();
    if (this.texturedMaterial) {
      this.buildFace();
      this.buildShadows();
    }
    this.buildHolds();
  }

  /** Hold SceneObject by layout id ("lf", "up", "h12", ...). */
  getHoldObject(id: string): SceneObject | null {
    this.build();
    return this.holdObjects[id] || null;
  }

  getHoldIds(): string[] {
    return HOLDS.map((h) => h.id);
  }

  /** Wall coords (x from left edge, y from floor, z out of the face) to this object's local space. */
  wallToLocal(x: number, y: number, z = 0): vec3 {
    return new vec3(x - WALL_WIDTH / 2, y, z);
  }

  /** Wall coords to world space. */
  wallToWorld(x: number, y: number, z = 0): vec3 {
    return this.getTransform().getWorldTransform().multiplyPoint(this.wallToLocal(x, y, z));
  }

  // ------------------------------------------------------------------ panel
  private buildPanel() {
    const g = new Geo();
    const hw = WALL_WIDTH / 2, H = WALL_HEIGHT, T = WALL_THICKNESS;
    addBox(g, [0, H / 2, -T / 2], [hw, H / 2, T / 2], PANEL_COLOR);

    // sheet seams: real walls are bolted from 120 x 100 cm sheets
    const seamHalf = 0.14, seamZ = 0.05;
    for (let x = SHEET_W; x < WALL_WIDTH; x += SHEET_W) {
      addBox(g, [x - hw, H / 2, seamZ / 2], [seamHalf, H / 2, seamZ / 2], SEAM_COLOR);
    }
    for (let y = SHEET_H; y < H; y += SHEET_H) {
      addBox(g, [0, y, seamZ / 2], [hw, seamHalf, seamZ / 2], SEAM_COLOR);
    }

    // trim
    const f = 2.2, fp = 1.2;
    addBox(g, [0, H - f / 2, fp / 2], [hw + 0.4, f / 2, fp / 2], FRAME_COLOR);
    addBox(g, [0, f / 2, fp / 2], [hw + 0.4, f / 2, fp / 2], FRAME_COLOR);
    addBox(g, [-hw + f / 2 - 0.4, H / 2, fp / 2], [f / 2, H / 2 - f, fp / 2], FRAME_COLOR);
    addBox(g, [hw - f / 2 + 0.4, H / 2, fp / 2], [f / 2, H / 2 - f, fp / 2], FRAME_COLOR);

    this.addTNuts(g);

    const rmv = this.sceneObject.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    rmv.mesh = toMesh(g);
    if (this.material) rmv.mainMaterial = this.material;
  }

  /** T-nuts on a staggered 20 cm grid, skipping hold footprints, seams and the trim. */
  private addTNuts(g: Geo) {
    const hw = WALL_WIDTH / 2;
    const z = 0.06;
    const seg = 10;
    const covered = (x: number, y: number) =>
      HOLDS.some((h) => {
        const s = HOLD_SIZE[h.type];
        return Math.hypot(x - h.x, y - h.y) < Math.max(s.w, s.h) / 2 + 1.2;
      });
    const nearSeam = (x: number, y: number) =>
      Math.abs(((x + SHEET_W / 2) % SHEET_W) - SHEET_W / 2) < 3 || Math.abs(((y + SHEET_H / 2) % SHEET_H) - SHEET_H / 2) < 3;
    let row = 0;
    for (let y = TNUT_PITCH / 2; y < WALL_HEIGHT - 4; y += TNUT_PITCH, row++) {
      const x0 = row % 2 === 0 ? TNUT_PITCH / 2 : TNUT_PITCH;
      for (let x = x0; x < WALL_WIDTH - 4; x += TNUT_PITCH) {
        if (y < 5 || covered(x, y) || nearSeam(x, y)) continue;
        const cx = x - hw;
        // flange (light steel ring) then the threaded hole
        const start = g.count;
        for (let i = 0; i <= seg; i++) {
          const t = (i / seg) * Math.PI * 2;
          g.vert([cx + 0.45 * Math.cos(t), y + 0.45 * Math.sin(t), z], [0, 0, 1], TNUT_FLANGE);
          g.vert([cx + 1.0 * Math.cos(t), y + 1.0 * Math.sin(t), z], [0, 0, 1], TNUT_FLANGE);
        }
        for (let i = 0; i < seg; i++) {
          const a = start + i * 2;
          g.tri(a, a + 1, a + 3);
          g.tri(a, a + 3, a + 2);
        }
        const ctr = g.vert([cx, y, z], [0, 0, 1], TNUT_HOLE);
        const ring = g.count;
        for (let i = 0; i <= seg; i++) {
          const t = (i / seg) * Math.PI * 2;
          g.vert([cx + 0.45 * Math.cos(t), y + 0.45 * Math.sin(t), z], [0, 0, 1], TNUT_HOLE);
        }
        for (let i = 0; i < seg; i++) g.tri(ctr, ring + i, ring + i + 1);
      }
    }
  }

  /** The ply face: one textured quad per sheet, each cut from a different part of the grain. */
  private buildFace() {
    const g = new UVGeo();
    const hw = WALL_WIDTH / 2;
    let k = 0;
    for (let y = 0; y < WALL_HEIGHT; y += SHEET_H) {
      for (let x = 0; x < WALL_WIDTH; x += SHEET_W, k++) {
        const ou = (k * 0.37) % 1, ov = (k * 0.61) % 1;
        const du = SHEET_W / TEX_CM, dv = SHEET_H / TEX_CM;
        // every other sheet is turned 180 degrees, as real sheets are hung
        if (k % 2 === 0) addUVQuad(g, x - hw, y, x + SHEET_W - hw, y + SHEET_H, 0.02, ou, ov, ou + du, ov + dv);
        else addUVQuad(g, x - hw, y, x + SHEET_W - hw, y + SHEET_H, 0.02, ou + du, ov + dv, ou, ov);
      }
    }
    const so = global.scene.createSceneObject("WallFace");
    so.setParent(this.sceneObject);
    const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    rmv.mesh = toMesh(g, UV_LAYOUT);
    const mat = this.texturedMaterial.clone();
    mat.mainPass.baseTex = getPlywoodTexture();
    mat.mainPass.baseColor = FACE_TINT;
    mat.mainPass.blendMode = BlendMode.Disabled;
    mat.mainPass.depthWrite = true;
    setWrap(mat, WrapMode.Repeat);
    rmv.mainMaterial = mat;
  }

  /** Soft contact shadows under every hold (key light from the upper left), one draw call. */
  private buildShadows() {
    const g = new UVGeo();
    const v = profileV(ProfileRow.Shadow);
    for (const h of HOLDS) {
      const s = HOLD_SIZE[h.type];
      const c = this.wallToLocal(h.x + 0.22 * s.d, h.y - 0.38 * s.d, 0.07);
      addProfileAnnulus(
        g, 0, 1, 28, v, [c.x, c.y, c.z],
        s.w / 2 * 1.08 + 0.35 * s.d, s.h / 2 * 1.08 + 0.35 * s.d, ((h.spin || 0) * Math.PI) / 180,
      );
    }
    const so = global.scene.createSceneObject("HoldShadows");
    so.setParent(this.sceneObject);
    const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    rmv.mesh = toMesh(g, UV_LAYOUT);
    rmv.mainMaterial = overlayMaterial(this.texturedMaterial, new vec4(0, 0, 0, 1));
  }

  // ------------------------------------------------------------------ holds
  private buildHolds() {
    const meshes: { [k: string]: RenderMesh } = {};
    const meshFor = (t: HoldType, tone: number) =>
      meshes[t + tone] || (meshes[t + tone] = toMesh(buildHoldGeo(t, tone)));

    for (const h of HOLDS) {
      const so = global.scene.createSceneObject("Hold_" + h.id);
      so.setParent(this.sceneObject);
      const tr = so.getTransform();
      tr.setLocalPosition(this.wallToLocal(h.x, h.y));
      tr.setLocalRotation(quat.fromEulerAngles(0, 0, ((h.spin || 0) * Math.PI) / 180));

      const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
      rmv.mesh = meshFor(h.type, toneFor(h.id));
      if (this.material) rmv.mainMaterial = this.material;

      if (this.addColliders) this.addHoldCollider(so, h);
      this.holdObjects[h.id] = so;
    }
  }

  private addHoldCollider(so: SceneObject, h: HoldDef) {
    const s = HOLD_SIZE[h.type];
    const d = 2 * s.ringR; // pinch target = ring footprint
    const shape = Shape.createBoxShape();
    // centred on the hold origin (the wall face): the front half covers the
    // hold, the back half sits inside the panel, which has no collider.
    shape.size = new vec3(d, d, 2 * (s.d + 2));
    const col = so.createComponent("Physics.ColliderComponent") as ColliderComponent;
    col.fitVisual = false;
    col.shape = shape;
  }
}
