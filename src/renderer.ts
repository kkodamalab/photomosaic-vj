import { PhotoPhysics } from "./photo-physics";
import { PhysicsView, drawPhotoSheet } from "./physics-view";
import { photoTimestamp } from "./physics-config";
import { FrameEffects } from "./frame-effects";
import { EffectChain } from "./effects";
import type { ContentPlugin, RenderFrame, Photo, Deck, Mixer } from "./types";
export class Mosaic implements ContentPlugin {
  id = "photo-mosaic";
  photos: Photo[] = [];
  images: ImageBitmap[] = [];
  version = 0;
  key = "";
  tiles: { x: number; y: number; rgb: number[]; photo: number }[] = [];
  target = document.createElement("canvas");
  private atlas = document.createElement("canvas");
  private atlasKey = "";
  async load(photos: Photo[]) {
    const active = photos.filter((p) => !p.excluded);
    const next = await Promise.all(
      active.map((p) => createImageBitmap(p.blob)),
    );
    this.images.forEach((i) => i.close());
    this.photos = active;
    this.images = next;
    this.version++;
  }
  render(
    ctx: CanvasRenderingContext2D,
    {
      width: w,
      height: h,
      deck: d,
      beat,
      tileTransform,
      tileOrder,
    }: RenderFrame,
  ) {
    const rows = Math.round((d.columns * h) / w),
      tw = w / d.columns,
      th = h / rows;
    const key = JSON.stringify([
      this.version,
      w,
      h,
      d.text,
      d.target,
      d.font,
      d.fontSize,
      d.bold,
      d.align,
      d.lineHeight,
      d.color,
      d.background,
      d.columns,
      d.mode,
      d.randomness,
      d.repeat,
      d.image?.src,
    ]);
    if (key !== this.key) {
      this.key = key;
      this.target.width = w;
      this.target.height = h;
      const c = this.target.getContext("2d", { willReadFrequently: true })!;
      c.fillStyle = d.background;
      c.fillRect(0, 0, w, h);
      if (d.target === "image" && d.image) {
        const scale = Math.min(w / d.image.width, h / d.image.height);
        c.drawImage(
          d.image,
          (w - d.image.width * scale) / 2,
          (h - d.image.height * scale) / 2,
          d.image.width * scale,
          d.image.height * scale,
        );
      } else {
        c.font = `${d.bold ? "900" : "400"} ${d.fontSize}px ${d.font}`;
        c.textAlign = d.align;
        c.textBaseline = "middle";
        c.fillStyle = d.color;
        const lines = d.text.split("\n");
        lines.forEach((line, i) =>
          c.fillText(
            line,
            d.align === "left" ? 40 : d.align === "right" ? w - 40 : w / 2,
            h / 2 + (i - (lines.length - 1) / 2) * d.fontSize * d.lineHeight,
            w - 80,
          ),
        );
      }
      const small = document.createElement("canvas");
      small.width = d.columns;
      small.height = rows;
      const sc = small.getContext("2d", { willReadFrequently: true })!;
      sc.drawImage(this.target, 0, 0, d.columns, rows);
      const data = sc.getImageData(0, 0, d.columns, rows).data;
      this.tiles = [];
      const used = new Set<number>();
      for (let y = 0; y < rows; y++)
        for (let x = 0; x < d.columns; x++) {
          const i = (y * d.columns + x) * 4,
            rgb = [data[i], data[i + 1], data[i + 2]];
          let best = -1,
            score = Infinity;
          this.photos.forEach((p, j) => {
            if (!d.repeat && used.has(j)) return;
            const noise =
              (((Math.sin((x + y * d.columns + 1) * (j + 1) * 12.9898) *
                43758.5453) %
                1) +
                1) %
              1;
            const distance =
              p.rgb.reduce((s, v, k) => s + (v - rgb[k]) ** 2, 0) +
              noise * d.randomness * 45000;
            if (distance < score) {
              score = distance;
              best = j;
            }
          });
          if (best >= 0) used.add(best);
          this.tiles.push({ x, y, rgb, photo: best });
        }
    }
    if (tileTransform) {
      const atlasKey = JSON.stringify([this.key, d.gap, d.correction]);
      if (this.atlasKey !== atlasKey) {
        this.atlas.width = w;
        this.atlas.height = h;
        this.render(this.atlas.getContext("2d")!, {
          width: w,
          height: h,
          deck: { ...d, zoom: 1, rotation: 0, scatter: 0 },
          beat,
          time: 0,
        });
        this.atlasKey = atlasKey;
      }
    }
    ctx.fillStyle = d.background;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(d.zoom, d.zoom);
    ctx.rotate((d.rotation * Math.PI) / 180);
    ctx.translate(-w / 2, -h / 2);
    const global = tileTransform ? ctx.getTransform() : undefined;
    for (let index = 0; index < this.tiles.length; index++) {
      const id = tileOrder ? tileOrder[index] : index;
      const t = this.tiles[id];
      const dx = (t.x - d.columns / 2) * d.scatter * tw * 0.8,
        dy = (t.y - rows / 2) * d.scatter * th * 0.8;
      const x = t.x * tw + dx + Math.sin(beat * 0.7 + t.y) * d.scatter * 12,
        y = t.y * th + dy;
      const ww = Math.max(1, tw - d.gap),
        hh = Math.max(1, th - d.gap);
      if (tileTransform && global) {
        const transform = tileTransform(id, x + ww / 2, y + hh / 2);
        const alpha = transform.alpha ?? 1;
        const screenX =
          global.a * transform.x + global.c * transform.y + global.e;
        const screenY =
          global.b * transform.x + global.d * transform.y + global.f;
        const margin =
          Math.max(ww, hh) *
          transform.scale *
          Math.hypot(global.a, global.b) *
          2;
        if (
          alpha <= 0 ||
          screenX < -margin ||
          screenX > w + margin ||
          screenY < -margin ||
          screenY > h + margin
        )
          continue;
        const cosine = Math.cos(transform.rotation) * transform.scale;
        const sine = Math.sin(transform.rotation) * transform.scale;
        ctx.setTransform(
          global.a * cosine + global.c * sine,
          global.b * cosine + global.d * sine,
          global.c * cosine - global.a * sine,
          global.d * cosine - global.b * sine,
          global.a * transform.x + global.c * transform.y + global.e,
          global.b * transform.x + global.d * transform.y + global.f,
        );
        const sheet = transform.sheet || 0;
        const image =
          this.images[
            (transform.photo ?? id) % Math.max(1, this.images.length)
          ];
        if (sheet < 1 || !image) {
          ctx.globalAlpha = alpha * (image ? 1 - sheet : 1);
          ctx.drawImage(
            this.atlas,
            t.x * tw,
            t.y * th,
            ww,
            hh,
            -ww / 2,
            -hh / 2,
            ww,
            hh,
          );
        }
        if (sheet > 0 && image) {
          ctx.globalAlpha = alpha * sheet;
          drawPhotoSheet(
            ctx,
            image,
            ww,
            hh,
            transform.bend || 0,
            transform.curl || 0,
            transform.segments || 1,
          );
        }
        ctx.globalAlpha = 1;
        continue;
      }
      const img = this.images[t.photo];
      if (img) {
        const ratio = Math.max(ww / img.width, hh / img.height);
        const sw = ww / ratio,
          sh = hh / ratio;
        ctx.drawImage(
          img,
          (img.width - sw) / 2,
          (img.height - sh) / 2,
          sw,
          sh,
          x,
          y,
          ww,
          hh,
        );
      } else {
        ctx.fillStyle = this.photos.length
          ? d.background
          : `rgb(${t.rgb.join(",")})`;
        ctx.fillRect(x, y, ww, hh);
      }
      if (!tileTransform && d.mode !== "original" && img) {
        ctx.globalAlpha = d.correction * (d.mode === "precise" ? 1 : 0.65);
        ctx.fillStyle = `rgb(${t.rgb.join(",")})`;
        ctx.fillRect(x, y, ww, hh);
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }
  dispose() {
    this.images.forEach((i) => i.close());
  }
}
export class Renderer {
  decks = [new Mosaic(), new Mosaic()];
  effects = [new EffectChain(), new EffectChain()];
  physics = [new PhotoPhysics(), new PhotoPhysics()];
  physicsViews = this.physics.map((p) => new PhysicsView(p));
  private physicsPhotoVersions = [-1, -1];
  private requestedModes = ["off", "off"];
  preparePhysics(i: number, deck: Deck) {
    const p = this.physics[i];
    p.config = deck.physics;
    p.configure(this.canvas.width, this.canvas.height, deck.columns);
    if (this.physicsPhotoVersions[i] !== this.decks[i].version) {
      p.setTimestamps(
        this.decks[i].photos.map((photo) => photoTimestamp(photo.capturedAt)),
      );
      this.physicsPhotoVersions[i] = this.decks[i].version;
    }
    return p;
  }
  activatePhysics(i: number, deck: Deck) {
    const p = this.preparePhysics(i, deck),
      effect = this.effects[i];
    effect.configure(this.canvas.width, this.canvas.height, deck.columns);
    if (!p.active) {
      p.activate(effect.motion, deck.scatter);
      effect.resetMotion();
      deck.scatter = 0;
    }
    if (deck.physics.mode === "off") deck.physics.mode = "physics";
    return p;
  }
  frameEffects = [new FrameEffects(), new FrameEffects()];
  dirtyKeys = ["", ""];
  private wasAnimating = [false, false];
  buffers = [
    document.createElement("canvas"),
    document.createElement("canvas"),
  ];
  ctx: CanvasRenderingContext2D;
  loadGeneration = 0;
  async load(photos: Photo[]) {
    const generation = ++this.loadGeneration;
    const active = photos.filter((p) => !p.excluded);
    const next = await Promise.all(
      active.map((p) => createImageBitmap(p.blob)),
    );
    if (generation !== this.loadGeneration) {
      next.forEach((i) => i.close());
      return;
    }
    this.decks[0].images.forEach((i) => i.close());
    for (const deck of this.decks) {
      deck.images = next;
      deck.photos = active;
      deck.version++;
    }
  }
  constructor(public canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
  }
  render(settings: Deck[], mix: Mixer, beat: number, time: number) {
    if (mix.freeze) {
      this.effects.forEach((e) => e.pause(time, beat));
      this.physics.forEach((p) => p.pause(time, beat));
      return;
    }
    const { width: w, height: h } = this.canvas;
    this.buffers.forEach((b, i) => {
      if (b.width !== w || b.height !== h) {
        b.width = w;
        b.height = h;
      }
      const d = settings[i],
        p = this.preparePhysics(i, d);
      if (d.physics.mode !== "off" && !p.active) this.activatePhysics(i, d);
      if (d.physics.mode === "memory" && this.requestedModes[i] !== "memory")
        p.memoryField();
      if (
        d.physics.mode === "physics" &&
        this.requestedModes[i] === "memory" &&
        p.state === "FLOATING"
      )
        p.setState("FREE");
      if (d.physics.mode === "off" && p.active && p.state !== "ASSEMBLING")
        p.assemble(d.effects.assemble.mode);
      this.requestedModes[i] = d.physics.mode;
      p.compatibleWind =
        d.physics.windMode === "physics" && d.effects.wind.enabled
          ? {
              ...d.physics.wind,
              ...d.effects.wind,
              strength: d.effects.wind.amount,
            }
          : undefined;
      if (p.active) p.step(time, beat);
      else p.pause(time, beat);
      const effects = this.effects[i];
      effects.configure(w, h, settings[i].columns);
      const effectConfig =
        p.active && d.physics.windMode === "physics"
          ? { ...d.effects, wind: { ...d.effects.wind, enabled: false } }
          : d.effects;
      effects.begin(effectConfig, time, beat);
      this.physicsViews[i].effect = effects.tileActive
        ? effects.transform
        : undefined;
      const key = JSON.stringify([
        w,
        h,
        this.decks[i].version,
        settings[i],
        settings[i].image?.src,
      ]);
      if (
        p.active ||
        effects.active ||
        this.wasAnimating[i] ||
        settings[i].scatter > 0 ||
        this.dirtyKeys[i] !== key
      ) {
        this.decks[i].render(b.getContext("2d")!, {
          width: w,
          height: h,
          deck: settings[i],
          beat,
          time,
          tileTransform: p.active
            ? this.physicsViews[i].transform
            : effects.tileActive
              ? effects.transform
              : undefined,
          tileOrder: p.active ? p.order : undefined,
        });
        this.frameEffects[i].apply(b, settings[i].effects, time, beat);
        this.dirtyKeys[i] = key;
        this.wasAnimating[i] = p.active || effects.active;
      }
    });
    const [a, b] = mix.swap ? [this.buffers[1], this.buffers[0]] : this.buffers;
    const c = this.ctx;
    c.globalCompositeOperation = "source-over";
    c.globalAlpha = 1;
    c.fillStyle = "#000";
    c.fillRect(0, 0, w, h);
    if (mix.mode === "a" || mix.mode === "b") {
      c.drawImage(mix.mode === "a" ? a : b, 0, 0);
      return;
    }
    c.drawImage(a, 0, 0);
    c.save();
    c.globalCompositeOperation = mix.blend;
    if (mix.mode === "split") {
      c.beginPath();
      if (mix.axis === "vertical")
        c.rect(0, h * mix.amount, w, h * (1 - mix.amount));
      else c.rect(w * mix.amount, 0, w * (1 - mix.amount), h);
      c.clip();
    } else if (mix.mode === "overlay") c.globalAlpha = mix.opacity;
    else {
      c.globalCompositeOperation = "source-over";
      c.globalAlpha = 1;
      c.fillStyle = "#000";
      c.fillRect(0, 0, w, h);
      c.globalAlpha = 1 - mix.amount;
      c.drawImage(a, 0, 0);
      c.globalCompositeOperation = "lighter";
      c.globalAlpha = mix.amount;
    }
    c.drawImage(b, 0, 0);
    c.restore();
  }
}
