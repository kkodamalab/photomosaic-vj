import type { TileTransform, TileTransformProvider } from "./effects";
import type { PhotoPhysics } from "./photo-physics";
/** Adapter only: Effects and Physics do not import or mutate each other. */
export class PhysicsView {
  effect?: TileTransformProvider;
  private result: TileTransform = {
    x: 0,
    y: 0,
    rotation: 0,
    scale: 1,
    alpha: 1,
    bend: 0,
    curl: 0,
    sheet: 0,
    segments: 3,
  };
  constructor(public physics: PhotoPhysics) {}
  transform: TileTransformProvider = (id, x, y) => {
    const effect = this.effect?.(id, x, y),
      p = this.physics.project(id),
      r = this.result;
    r.x = p.x + (effect ? effect.x - x : 0);
    r.y = p.y + (effect ? effect.y - y : 0);
    r.rotation = p.rotation + (effect?.rotation || 0);
    r.scale = p.scale * (effect?.scale ?? 1);
    r.photo = this.physics.photoIndex(id);
    r.alpha = p.alpha;
    r.bend = p.bend;
    r.curl = p.curl;
    r.sheet = p.sheet;
    r.segments =
      this.physics.qualityLevel === 0
        ? 3
        : this.physics.qualityLevel === 1
          ? 2
          : 1;
    return r;
  };
}
export function drawPhotoSheet(
  c: CanvasRenderingContext2D,
  image: ImageBitmap,
  width: number,
  height: number,
  bend: number,
  curl: number,
  segments: number,
) {
  const actualHeight = (width * image.height) / image.width;
  const flatten = Math.max(0.18, Math.abs(Math.cos(curl)));
  for (let strip = 0; strip < segments; strip++) {
    const phase = (strip + 0.5) / segments;
    const y = Math.sin(phase * Math.PI) * bend * height * 0.35;
    c.drawImage(
      image,
      (image.width * strip) / segments,
      0,
      image.width / segments,
      image.height,
      -width / 2 + (width * strip) / segments,
      (-actualHeight * flatten) / 2 + y,
      width / segments + 0.5,
      actualHeight * flatten,
    );
  }
}
