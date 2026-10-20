import { effectPhase, type Effects } from "./effects";
/** Frame effects run after content/tile effects and before deck mixing. No readback. */
export class FrameEffects {
  private source = document.createElement("canvas");
  private channel = document.createElement("canvas");
  apply(
    canvas: HTMLCanvasElement,
    config: Effects,
    time: number,
    beat: number,
  ) {
    if (!config.glitch.enabled && !config.rgbShift.enabled) return;
    const w = canvas.width,
      h = canvas.height;
    for (const c of [this.source, this.channel])
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
      }
    const c = canvas.getContext("2d")!,
      s = this.source.getContext("2d")!,
      channel = this.channel.getContext("2d")!;
    s.globalCompositeOperation = "copy";
    s.drawImage(canvas, 0, 0);
    if (config.glitch.enabled && config.glitch.amount > 0) {
      const g = config.glitch,
        phase = effectPhase(g, time, beat),
        bucket = Math.floor(phase * 4);
      const envelope = g.beatSync
        ? 0.2 + 0.8 * (0.5 + 0.5 * Math.cos(phase))
        : 1;
      for (let i = 0; i < 12; i++) {
        const n = Math.sin(bucket * 17.31 + i * 78.233) * 43758.5453,
          random = n - Math.floor(n);
        const y = Math.floor(random * (h - 20)),
          height = 4 + Math.floor(random * 24);
        const dx = (random - 0.5) * g.amount * 160 * envelope;
        c.drawImage(this.source, 0, y, w, height, dx, y, w, height);
        if (i % 3 === 0)
          c.drawImage(
            this.source,
            random * w * 0.7,
            y,
            w * 0.2,
            height * 2,
            random * w * 0.7 + dx,
            y,
            w * 0.2,
            height * 2,
          );
      }
    }
    if (config.rgbShift.enabled && config.rgbShift.amount > 0) {
      const r = config.rgbShift,
        phase = effectPhase(r, time, beat);
      const shift = r.amount * (4 + 20 * (0.5 + 0.5 * Math.sin(phase)));
      s.globalCompositeOperation = "copy";
      s.drawImage(canvas, 0, 0);
      c.save();
      c.globalCompositeOperation = "source-over";
      c.fillStyle = "#000";
      c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = "lighter";
      for (const [index, color] of [
        "#ff0000",
        "#00ff00",
        "#0000ff",
      ].entries()) {
        channel.globalCompositeOperation = "copy";
        channel.drawImage(this.source, 0, 0);
        channel.globalCompositeOperation = "multiply";
        channel.fillStyle = color;
        channel.fillRect(0, 0, w, h);
        c.drawImage(
          this.channel,
          (index - 1) * shift,
          index === 1 ? 0 : Math.sin(phase) * shift * 0.25,
        );
      }
      c.restore();
    }
  }
}
