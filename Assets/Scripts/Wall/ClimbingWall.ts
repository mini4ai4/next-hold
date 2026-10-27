// ClimbingWall — builds the virtual bouldering wall stand-in at runtime with
// MeshBuilder: a 240 x 300 cm panel and every hold from WallLayout.
//
// Put it on a SceneObject whose origin is where the wall meets the floor,
// bottom-centre, facing the user (+Z toward the user). Brief placement:
// on the floor, ~100 cm in front of the user.
//
// Each hold gets its own child SceneObject "Hold_<id>" (so other scripts can
// make it pinchable / hang a ring on it). Holds of the same type share one
// RenderMesh. A box collider per hold is added unless addColliders is off;
// it is sized to the ring, so the pinch target is big.

import { GEO_LAYOUT, Geo, type RGBA, addBox } from "./MeshKit";
import { buildHoldGeo } from "./HoldShapes";
import {
  HOLDS, HOLD_SIZE, type HoldDef, type HoldType, WALL_HEIGHT, WALL_THICKNESS, WALL_WIDTH,
} from "./WallLayout";

// light panel so it reads on the additive display (brief); the cream holds and
// saturated rings still stand out against it
const PANEL_COLOR: RGBA = [0.5, 0.53, 0.58, 1];
const SEAM_COLOR: RGBA = [0.62, 0.65, 0.7, 1];
const FRAME_COLOR: RGBA = [0.72, 0.75, 0.8, 1];

function toMesh(g: Geo): RenderMesh {
  const b = new MeshBuilder(GEO_LAYOUT);
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

    // panel seams: real walls are bolted from 120 x 100 cm sheets
    const seamHalf = 0.35, seamProud = 0.12;
    addBox(g, [0, H / 2, seamProud / 2], [seamHalf, H / 2, seamProud / 2], SEAM_COLOR);
    for (const y of [100, 200]) {
      addBox(g, [0, y, seamProud / 2], [hw, seamHalf, seamProud / 2], SEAM_COLOR);
    }

    // light frame so the wall outline reads on the additive display
    const f = 1.5, fp = 0.6;
    addBox(g, [0, H - f / 2, fp / 2], [hw, f / 2, fp / 2], FRAME_COLOR);
    addBox(g, [0, f / 2, fp / 2], [hw, f / 2, fp / 2], FRAME_COLOR);
    addBox(g, [-hw + f / 2, H / 2, fp / 2], [f / 2, H / 2 - f, fp / 2], FRAME_COLOR);
    addBox(g, [hw - f / 2, H / 2, fp / 2], [f / 2, H / 2 - f, fp / 2], FRAME_COLOR);

    const rmv = this.sceneObject.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    rmv.mesh = toMesh(g);
    if (this.material) rmv.mainMaterial = this.material;
  }

  // ------------------------------------------------------------------ holds
  private buildHolds() {
    const meshes: { [t: string]: RenderMesh } = {};
    const meshFor = (t: HoldType) => meshes[t] || (meshes[t] = toMesh(buildHoldGeo(t)));

    for (const h of HOLDS) {
      const so = global.scene.createSceneObject("Hold_" + h.id);
      so.setParent(this.sceneObject);
      const tr = so.getTransform();
      tr.setLocalPosition(this.wallToLocal(h.x, h.y));
      tr.setLocalRotation(quat.fromEulerAngles(0, 0, ((h.spin || 0) * Math.PI) / 180));

      const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
      rmv.mesh = meshFor(h.type);
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
