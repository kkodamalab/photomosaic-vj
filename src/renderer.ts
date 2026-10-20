import type { ContentPlugin, RenderFrame, Photo, Deck, Mixer } from "./types";
export class Mosaic implements ContentPlugin {
  id = "photo-mosaic";
  photos: Photo[] = [];
  images: ImageBitmap[] = [];
  version = 0;
  key = "";
  tiles: { x: number; y: number; rgb: number[]; photo: number }[] = [];
  target = document.createElement("canvas");
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
    { width: w, height: h, deck: d, beat }: RenderFrame,
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
    ctx.fillStyle = d.background;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(d.zoom, d.zoom);
    ctx.rotate((d.rotation * Math.PI) / 180);
    ctx.translate(-w / 2, -h / 2);
    for (const t of this.tiles) {
      const dx = (t.x - d.columns / 2) * d.scatter * tw * 0.8,
        dy = (t.y - rows / 2) * d.scatter * th * 0.8;
      const x = t.x * tw + dx + Math.sin(beat * 0.7 + t.y) * d.scatter * 12,
        y = t.y * th + dy;
      const ww = Math.max(1, tw - d.gap),
        hh = Math.max(1, th - d.gap);
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
      if (d.mode !== "original" && img) {
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
  dirtyKeys = ["", ""];
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
    if (mix.freeze) return;
    const { width: w, height: h } = this.canvas;
    this.buffers.forEach((b, i) => {
      if (b.width !== w || b.height !== h) {
        b.width = w;
        b.height = h;
      }
      const key = JSON.stringify([
        w,
        h,
        this.decks[i].version,
        settings[i],
        settings[i].image?.src,
      ]);
      if (settings[i].scatter > 0 || this.dirtyKeys[i] !== key) {
        this.decks[i].render(b.getContext("2d")!, {
          width: w,
          height: h,
          deck: settings[i],
          beat,
          time,
        });
        this.dirtyKeys[i] = key;
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
