/** Deck-local effects. Beat phase is supplied by the existing Transport. */
export interface EffectConfig {
  enabled: boolean;
  amount: number;
  speed: number;
  beatSync: boolean;
  beatDivision: number;
}
export interface Effects {
  glitch: EffectConfig;
  rgbShift: EffectConfig;
  wind: EffectConfig & {
    direction: number;
    turbulence: number;
    drag: number;
    rotation: number;
  };
  explosion: {
    power: number;
    rotation: number;
    origin: "center" | "random" | "pointer";
  };
  assemble: {
    mode: "direct" | "spring" | "swirl";
    duration: number;
    seconds: number;
  };
  pulse: EffectConfig;
  wave: EffectConfig & {
    wavelength: number;
    direction: "horizontal" | "vertical" | "diagonal" | "radial";
  };
  float: EffectConfig & { rotation: number };
}
const common = (amount: number, speed = 1): EffectConfig => ({
  enabled: false,
  amount,
  speed,
  beatSync: false,
  beatDivision: 1,
});
export const defaultEffects = (): Effects => ({
  pulse: common(0.2),
  wave: { ...common(0.2, 0.5), wavelength: 300, direction: "horizontal" },
  float: { ...common(0.2, 0.3), rotation: 0.15 },
  wind: {
    ...common(0.5),
    direction: 0,
    turbulence: 0.4,
    drag: 1.5,
    rotation: 0.4,
  },
  glitch: common(0.3, 8),
  rgbShift: common(0.3, 1),
  explosion: { power: 0.65, rotation: 0.7, origin: "center" },
  assemble: { mode: "direct", duration: 0, seconds: 1.5 },
});
export function effectPhase(c: EffectConfig, time: number, beat: number) {
  return (
    Math.PI * 2 * (c.beatSync ? beat / c.beatDivision : time * 0.001 * c.speed)
  );
}
export interface TileTransform {
  photo?: number;
  alpha?: number;
  bend?: number;
  curl?: number;
  sheet?: number;
  segments?: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
}
export type TileTransformProvider = (
  id: number,
  x: number,
  y: number,
) => TileTransform;
const POSITION_COMPONENTS = [0, 1, 4] as const;
/** One reusable transform, no per-tile objects allocated in the animation loop. */
export class EffectChain {
  private result: TileTransform = { x: 0, y: 0, rotation: 0, scale: 1 };
  // x/y offsets, vx/vy, rotation/angular velocity; stable tile identities.
  motion = new Float64Array(0);
  width = 1280;
  height = 720;
  columns = 48;
  rows = 27;
  private lastTime: number | undefined;
  private lastBeat = 0;
  private secondsPerBeat = 0.5;
  private accumulator = 0;
  private gustAge = Infinity;
  private returning?: {
    from: Float64Array;
    progress: number;
    mode: Effects["assemble"]["mode"];
    duration: number;
    seconds: number;
    tangentSeconds: number;
  };
  private displaced = false;
  time = 0;
  beat = 0;
  config = defaultEffects();
  get state() {
    if (this.returning) return "ASSEMBLING";
    if (this.config.wind.enabled || this.gustAge < 3) return "WIND";
    if (this.displaced) return "EXPLODING";
    return this.config.float.enabled ? "FLOATING" : "ASSEMBLED";
  }
  get tileActive() {
    return (
      this.displaced ||
      !!this.returning ||
      this.gustAge < 3 ||
      this.config.wind.enabled ||
      this.config.pulse.enabled ||
      this.config.wave.enabled ||
      this.config.float.enabled
    );
  }
  get active() {
    return (
      this.tileActive ||
      this.config.glitch.enabled ||
      this.config.rgbShift.enabled
    );
  }
  configure(width: number, height: number, columns: number) {
    const rows = Math.round((columns * height) / width);
    if (
      width === this.width &&
      height === this.height &&
      columns === this.columns &&
      this.motion.length
    )
      return;
    const previous = this.motion,
      oldColumns = this.columns,
      oldRows = this.rows;
    const next = new Float64Array(columns * rows * 6);
    const returnFrom = this.returning
      ? new Float64Array(next.length)
      : undefined;
    for (let id = 0; id < columns * rows; id++) {
      const old =
        (Math.min(
          oldRows - 1,
          Math.floor((Math.floor(id / columns) / rows) * oldRows),
        ) *
          oldColumns +
          Math.min(
            oldColumns - 1,
            Math.floor(((id % columns) / columns) * oldColumns),
          )) *
        6;
      for (let k = 0; k < 6; k++) {
        const scale =
          k < 4 ? (k % 2 === 0 ? width / this.width : height / this.height) : 1;
        next[id * 6 + k] = (previous[old + k] || 0) * scale;
        if (returnFrom && this.returning)
          returnFrom[id * 6 + k] = (this.returning.from[old + k] || 0) * scale;
      }
    }
    this.motion = next;
    if (this.returning && returnFrom) this.returning.from = returnFrom;
    this.width = width;
    this.height = height;
    this.columns = columns;
    this.rows = rows;
  }
  pause(time: number, beat: number) {
    this.lastTime = time;
    this.lastBeat = beat;
  }
  rebase(beat: number) {
    this.lastBeat = beat;
  }
  resetMotion() {
    this.motion.fill(0);
    this.returning = undefined;
    this.displaced = false;
    this.gustAge = Infinity;
    this.accumulator = 0;
  }
  gust() {
    this.returning = undefined;
    this.gustAge = 0;
    this.displaced = true;
  }
  explode(origin: { x: number; y: number }, power: number, rotation: number) {
    this.returning = undefined;
    this.displaced = true;
    for (let id = 0; id < this.motion.length / 6; id++) {
      const i = id * 6,
        seed = Math.sin(id * 12.9898 + 78.233) * 43758.5453,
        random = seed - Math.floor(seed);
      const x =
        ((id % this.columns) + 0.5) / this.columns +
        this.motion[i] / this.width -
        origin.x;
      const y =
        (Math.floor(id / this.columns) + 0.5) / this.rows +
        this.motion[i + 1] / this.height -
        origin.y;
      const a = Math.atan2(y, x) + (random - 0.5) * 0.3,
        speed = (180 + random * 540) * power;
      this.motion[i + 2] += Math.cos(a) * speed;
      this.motion[i + 3] += Math.sin(a) * speed;
      this.motion[i + 5] += (random - 0.5) * rotation * 16;
    }
  }
  assemble(scatter = 0, secondsPerBeat = this.secondsPerBeat) {
    // Transfer legacy scatter into physics so the old slider also returns smoothly.
    for (let id = 0; id < this.motion.length / 6; id++) {
      const x = id % this.columns,
        y = Math.floor(id / this.columns),
        i = id * 6;
      this.motion[i] +=
        (((x - this.columns / 2) * scatter * this.width) / this.columns) * 0.8 +
        Math.sin(this.beat * 0.7 + y) * scatter * 12;
      this.motion[i + 1] +=
        (((y - this.rows / 2) * scatter * this.height) / this.rows) * 0.8;
    }
    this.config.wind.enabled = false;
    this.gustAge = Infinity;
    this.returning = {
      from: this.motion.slice(),
      progress: 0,
      ...this.config.assemble,
      tangentSeconds: this.config.assemble.duration
        ? this.config.assemble.duration * secondsPerBeat
        : this.config.assemble.seconds,
    };
    this.displaced = true;
  }
  private integrate(dt: number) {
    const c = this.config.wind,
      s = this.motion;
    const force =
      (c.enabled
        ? c.beatSync
          ? 0.5 + 0.5 * Math.cos(effectPhase(c, this.time, this.beat))
          : 1
        : 0) + (this.gustAge < 3 ? 4 * Math.exp(-this.gustAge * 3) : 0);
    const angle = (c.direction * Math.PI) / 180;
    const damping = Math.exp(-c.drag * dt);
    for (let id = 0; id < s.length / 6; id++) {
      const i = id * 6,
        phase = id * 2.399963 + this.time * 0.001 * c.speed;
      const turbulence = Math.sin(phase) * c.turbulence;
      s[i + 2] =
        (s[i + 2] +
          (Math.cos(angle) + turbulence) * force * c.amount * 300 * dt) *
        damping;
      s[i + 3] =
        (s[i + 3] +
          (Math.sin(angle) + Math.cos(phase * 1.3) * c.turbulence) *
            force *
            c.amount *
            300 *
            dt) *
        damping;
      s[i + 5] =
        (s[i + 5] + Math.sin(phase) * force * c.rotation * 6 * dt) * damping;
      s[i] += s[i + 2] * dt;
      s[i + 1] += s[i + 3] * dt;
      s[i + 4] += s[i + 5] * dt;
    }
    if (force > 0) this.displaced = true;
    this.gustAge += dt;
  }
  private updateReturn(dt: number, beatDelta: number) {
    const a = this.returning!;
    a.progress = Math.min(
      1,
      a.progress + (a.duration ? beatDelta / a.duration : dt / a.seconds),
    );
    const u = a.progress,
      h = 1 - 3 * u * u + 2 * u * u * u,
      v = u - 2 * u * u + u * u * u;
    const duration = a.tangentSeconds;
    for (let i = 0; i < this.motion.length; i += 6) {
      const oldX = this.motion[i],
        oldY = this.motion[i + 1];
      for (const k of POSITION_COMPONENTS) {
        const velocity = k === 4 ? 5 : k + 2,
          x = a.from[i + k],
          initial = a.from[i + velocity];
        const old = this.motion[i + k];
        this.motion[i + k] =
          a.mode === "spring"
            ? (1 - u) ** 2 *
              (x * Math.cos(3 * Math.PI * u) +
                ((initial * duration + 2 * x) / (3 * Math.PI)) *
                  Math.sin(3 * Math.PI * u))
            : x * h + initial * duration * v;
        this.motion[i + velocity] = dt
          ? (this.motion[i + k] - old) / dt
          : initial;
      }
      if (a.mode === "swirl") {
        const angle = 2 * Math.PI * (3 * u * u - 2 * u * u * u),
          x = this.motion[i],
          y = this.motion[i + 1];
        this.motion[i] = x * Math.cos(angle) - y * Math.sin(angle);
        this.motion[i + 1] = x * Math.sin(angle) + y * Math.cos(angle);
        if (dt) {
          this.motion[i + 2] = (this.motion[i] - oldX) / dt;
          this.motion[i + 3] = (this.motion[i + 1] - oldY) / dt;
        }
      }
    }
    if (u === 1) {
      this.motion.fill(0);
      this.returning = undefined;
      this.displaced = false;
    }
  }
  begin(config: Effects, time: number, beat: number) {
    const elapsed =
      this.lastTime === undefined
        ? 0
        : Math.max(0, (time - this.lastTime) / 1000);
    // Bound physics catch-up; return choreography still uses absolute elapsed beats.
    const dt = Math.min(0.25, elapsed);
    const beatDelta = Math.max(0, beat - this.lastBeat);
    if (elapsed > 0 && beatDelta > 0) this.secondsPerBeat = elapsed / beatDelta;
    this.lastTime = time;
    this.lastBeat = beat;
    this.config = config;
    this.time = time;
    this.beat = beat;
    if (this.returning && config.wind.enabled) this.returning = undefined;
    if (this.returning) this.updateReturn(elapsed, beatDelta);
    else if (this.displaced || config.wind.enabled || this.gustAge < 3) {
      this.accumulator += dt;
      while (this.accumulator >= 1 / 120) {
        this.integrate(1 / 120);
        this.accumulator -= 1 / 120;
      }
    }
  }
  transform: TileTransformProvider = (id, x, y) => {
    const r = this.result,
      c = this.config;
    const i = id * 6;
    r.x = x + (this.motion[i] || 0);
    r.y = y + (this.motion[i + 1] || 0);
    r.rotation = this.motion[i + 4] || 0;
    r.scale = 1;
    if (c.pulse.enabled)
      r.scale *=
        1 +
        c.pulse.amount * Math.sin(effectPhase(c.pulse, this.time, this.beat));
    if (c.wave.enabled) {
      const d = c.wave.direction;
      const position =
        d === "horizontal"
          ? x
          : d === "vertical"
            ? y
            : d === "diagonal"
              ? (x + y) * 0.707
              : Math.hypot(x - this.width / 2, y - this.height / 2);
      const wave = Math.sin(
        (position / c.wave.wavelength) * Math.PI * 2 -
          effectPhase(c.wave, this.time, this.beat),
      );
      r.x +=
        (d === "vertical" || d === "diagonal" ? wave * 40 : 0) * c.wave.amount;
      r.y += wave * 40 * c.wave.amount;
      r.rotation += wave * c.wave.amount * 0.15;
    }
    if (c.float.enabled) {
      const p = effectPhase(c.float, this.time, this.beat),
        frequencyY = c.float.beatSync ? 1 : 0.73,
        frequencyRotation = c.float.beatSync ? 1 : 0.63,
        seed = id * 2.399963;
      r.x += Math.sin(p + seed) * c.float.amount * 24;
      r.y += Math.cos(p * frequencyY + seed * 1.7) * c.float.amount * 18;
      r.rotation += Math.sin(p * frequencyRotation + seed) * c.float.rotation;
    }
    return r;
  };
}
