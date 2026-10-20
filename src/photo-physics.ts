import {
  defaultPhysics,
  random01,
  timestampToDepth,
  type PhysicsConfig,
  type PhysicsState,
  type Vec3,
} from "./physics-config";
export enum SheetState {
  ASSEMBLED,
  FLOATING,
  WIND,
  EXPLODING,
  FREE,
  GATHERING,
  CRUMPLED,
  BALL,
  BOUNCING,
  ASSEMBLING,
}
/** No DOM, clocks or Effects dependency. World coordinates are deck pixels and depth units. */
export class PhotoPhysics {
  config = defaultPhysics();
  compatibleWind?: PhysicsConfig["wind"];
  state: PhysicsState = "ASSEMBLED";
  home = new Float64Array(0);
  position = new Float64Array(0);
  velocity = new Float64Array(0);
  acceleration = new Float64Array(0);
  rotation = new Float64Array(0);
  angularVelocity = new Float64Array(0);
  scale = new Float64Array(0);
  mass = new Float64Array(0);
  drag = new Float64Array(0);
  gravity = new Float64Array(0);
  restitution = new Float64Array(0);
  friction = new Float64Array(0);
  bend = new Float64Array(0);
  curl = new Float64Array(0);
  objectState = new Uint8Array(0);
  order = new Uint32Array(0);
  timestamps: (number | null)[] = [];
  photoCount = 0;
  width = 1280;
  height = 720;
  columns = 48;
  rows = 27;
  time = 0;
  beat = 0;
  simulationTime = 0;
  camera = { x: 0, y: 0, z: 0 };
  cameraWeight = 0;
  sheetMix = 0;
  field = new Float64Array(0);
  inBall = new Uint8Array(0);
  sphere = new Float64Array(0);
  ball = {
    active: false,
    x: 640,
    y: 360,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    rotation: 0,
    angularVelocity: 0,
    radius: 75,
    mass: 12,
    gravity: 400,
    drag: 0.12,
    restitution: 0.8,
    friction: 0.08,
    held: false,
    squash: 0,
    impactAxis: "y",
    collisions: 0,
  };
  collisionChecks = 0;
  qualityLevel = 0;
  private lowSeconds = 0;
  private highSeconds = 0;
  private heldTarget = { x: 0, y: 0 };
  private pointerTime = 0;
  private pointerX = 0;
  private pointerY = 0;
  private releaseVelocity = { x: 0, y: 0 };
  private transition?: {
    kind: "crumple" | "assemble";
    from: Float64Array;
    vel: Float64Array;
    rotation: Float64Array;
    scales: Float64Array;
    progress: number;
    duration: number;
    seconds: number;
    tangent: number;
    cameraWeight: number;
    sheetMix: number;
    mode: "direct" | "spring" | "swirl";
  };
  private expand = 0;
  private sortFrame = 0;
  private oldest = 0;
  private newest = 0;
  private fieldKey = "";
  private gustAge = Infinity;
  private externalWind = { x: 0, y: 0, z: 0 };
  private gatherTarget = { x: 640, y: 360, z: 0 };
  private projected = {
    x: 0,
    y: 0,
    rotation: 0,
    scale: 1,
    alpha: 1,
    bend: 0,
    curl: 0,
    sheet: 0,
  };
  protected lastTime: number | undefined;
  protected lastBeat = 0;
  protected accumulator = 0;
  get count() {
    return this.scale.length;
  }
  get active() {
    return this.state !== "ASSEMBLED";
  }
  configure(width: number, height: number, columns: number) {
    const rows = Math.round((columns * height) / width);
    if (
      this.count &&
      width === this.width &&
      height === this.height &&
      columns === this.columns
    )
      return;
    const previous = this.active
      ? {
          columns: this.columns,
          rows: this.rows,
          width: this.width,
          height: this.height,
          position: this.position,
          velocity: this.velocity,
          rotation: this.rotation,
          angularVelocity: this.angularVelocity,
          scale: this.scale,
          bend: this.bend,
          curl: this.curl,
          inBall: this.inBall,
          state: this.state,
          transition: this.transition,
        }
      : undefined;
    const n = columns * rows;
    this.width = width;
    this.height = height;
    this.columns = columns;
    this.rows = rows;
    for (const key of ["home", "position", "velocity", "acceleration"] as const)
      this[key] = new Float64Array(n * 3);
    for (const key of [
      "rotation",
      "angularVelocity",
      "scale",
      "mass",
      "drag",
      "gravity",
      "restitution",
      "friction",
      "bend",
      "curl",
    ] as const)
      this[key] = new Float64Array(n);
    this.objectState = new Uint8Array(n);
    this.order = new Uint32Array(n);
    this.inBall = new Uint8Array(n);
    this.sphere = new Float64Array(n * 3);
    for (let id = 0; id < n; id++) {
      this.home[id * 3] = (((id % columns) + 0.5) * width) / columns;
      this.home[id * 3 + 1] =
        ((Math.floor(id / columns) + 0.5) * height) / rows;
      const z = 1 - (2 * (id + 0.5)) / n,
        r = Math.sqrt(1 - z * z),
        angle = id * 2.399963;
      this.sphere[id * 3] = Math.cos(angle) * r;
      this.sphere[id * 3 + 1] = Math.sin(angle) * r;
      this.sphere[id * 3 + 2] = z;
      this.mass[id] = 0.7 + random01(id) * 0.6;
      this.drag[id] = 1.5;
      this.gravity[id] = 0;
      this.restitution[id] = 0.6;
      this.friction[id] = 0.1;
      this.scale[id] = 1;
      this.order[id] = id;
    }
    this.position.set(this.home);
    this.field = new Float64Array(n * 3);
    this.fieldKey = "";
    this.state = "ASSEMBLED";
    if (previous) {
      const map = (id: number) =>
        Math.min(
          previous.rows - 1,
          Math.floor((Math.floor(id / columns) / rows) * previous.rows),
        ) *
          previous.columns +
        Math.min(
          previous.columns - 1,
          Math.floor(((id % columns) / columns) * previous.columns),
        );
      const remap3 = (source: Float64Array) => {
        const next = new Float64Array(n * 3);
        for (let id = 0; id < n; id++) {
          const old = map(id);
          for (let k = 0; k < 3; k++)
            next[id * 3 + k] =
              source[old * 3 + k] *
              (k === 0
                ? width / previous.width
                : k === 1
                  ? height / previous.height
                  : 1);
        }
        return next;
      };
      const remap1 = (source: Float64Array) =>
        Float64Array.from({ length: n }, (_, id) => source[map(id)]);
      this.position = remap3(previous.position);
      this.velocity = remap3(previous.velocity);
      for (const key of [
        "rotation",
        "angularVelocity",
        "scale",
        "bend",
        "curl",
      ] as const)
        this[key] = remap1(previous[key]);
      this.inBall = Uint8Array.from(
        { length: n },
        (_, id) => previous.inBall[map(id)],
      );
      this.setState(previous.state);
      if (previous.transition)
        this.transition = {
          ...previous.transition,
          from: remap3(previous.transition.from),
          vel: remap3(previous.transition.vel),
          rotation: remap1(previous.transition.rotation),
          scales: remap1(previous.transition.scales),
        };
      this.ball.x *= width / previous.width;
      this.ball.y *= height / previous.height;
      this.ball.vx *= width / previous.width;
      this.ball.vy *= height / previous.height;
    }
  }
  setState(state: PhysicsState) {
    this.state = state;
    this.objectState.fill(SheetState[state]);
  }
  activate(offsets?: ArrayLike<number>, scatter = 0) {
    if (this.active) return;
    for (let id = 0; id < this.count; id++) {
      const i = id * 3,
        x = id % this.columns,
        y = Math.floor(id / this.columns);
      this.position[i] =
        this.home[i] +
        (offsets?.[id * 6] || 0) +
        (((x - this.columns / 2) * scatter * this.width) / this.columns) * 0.8 +
        Math.sin(this.beat * 0.7 + y) * scatter * 12;
      this.position[i + 1] =
        this.home[i + 1] +
        (offsets?.[id * 6 + 1] || 0) +
        (((y - this.rows / 2) * scatter * this.height) / this.rows) * 0.8;
      this.velocity[i] = offsets?.[id * 6 + 2] || 0;
      this.velocity[i + 1] = offsets?.[id * 6 + 3] || 0;
      this.rotation[id] = offsets?.[id * 6 + 4] || 0;
      this.angularVelocity[id] = offsets?.[id * 6 + 5] || 0;
    }
    this.setState("FREE");
  }
  reset() {
    this.position.set(this.home);
    for (const a of [
      this.velocity,
      this.acceleration,
      this.rotation,
      this.angularVelocity,
      this.bend,
      this.curl,
    ])
      a.fill(0);
    this.scale.fill(1);
    this.objectState.fill(SheetState.ASSEMBLED);
    this.state = "ASSEMBLED";
    this.config.mode = "off";
    this.config.wind.enabled = false;
    this.ball.active = false;
    this.ball.held = false;
    this.ball.rotation = 0;
    this.ball.collisions = 0;
    this.compatibleWind = undefined;
    this.applyWind({ x: 0, y: 0, z: 0 });
    this.ball.vx =
      this.ball.vy =
      this.ball.vz =
      this.ball.angularVelocity =
      this.ball.squash =
        0;
    this.transition = undefined;
    this.inBall.fill(0);
    this.expand = 0;
    this.accumulator = 0;
    this.sheetMix = 0;
    this.cameraWeight = 0;
    this.camera.x = this.camera.y = this.camera.z = 0;
    this.gustAge = Infinity;
  }
  pause(time: number, beat: number) {
    this.lastTime = time;
    this.lastBeat = beat;
  }
  rebase(beat: number) {
    this.lastBeat = beat;
  }
  setTimestamps(values: (number | null)[]) {
    this.timestamps = values;
    this.photoCount = values.length;
    const dates = values.filter((v): v is number => v !== null);
    this.oldest = dates.length ? Math.min(...dates) : 0;
    this.newest = dates.length ? Math.max(...dates) : 0;
    this.fieldKey = "";
  }
  private interruptTransition() {
    if (this.transition?.kind === "crumple") {
      this.inBall.fill(0);
      this.expand = 0;
    }
    this.transition = undefined;
  }
  explode(origin: Vec3, power: number, spin = 1) {
    if (this.ball.active) this.releasePhotos(1);
    this.interruptTransition();
    this.activate();
    this.config.mode = "physics";
    this.setState("EXPLODING");
    for (let id = 0; id < this.count; id++) {
      const i = id * 3,
        angle = Math.atan2(
          this.position[i + 1] - origin.y,
          this.position[i] - origin.x,
        ),
        speed = power * (200 + random01(id, 10) * 400);
      this.velocity[i] += Math.cos(angle) * speed;
      this.velocity[i + 1] += Math.sin(angle) * speed;
      this.velocity[i + 2] += (random01(id, 11) - 0.5) * power * 200;
      this.angularVelocity[id] += (random01(id, 12) - 0.5) * spin * 6;
    }
  }
  memoryField() {
    this.interruptTransition();
    if (this.ball.active) this.releasePhotos(1);
    this.activate();
    this.config.mode = "memory";
    this.fieldKey = "";
    this.setState("FLOATING");
  }
  applyWind(vector: Vec3) {
    this.externalWind.x = vector.x;
    this.externalWind.y = vector.y;
    this.externalWind.z = vector.z || 0;
  }
  gust() {
    this.interruptTransition();
    this.activate();
    this.gustAge = 0;
    this.setState("WIND");
  }
  gather(target: Vec3 = { x: this.width / 2, y: this.height / 2 }) {
    this.interruptTransition();
    if (this.ball.active) this.releasePhotos(1);
    this.activate();
    this.config.mode = "physics";
    this.config.wind.enabled = false;
    this.gustAge = Infinity;
    this.gatherTarget = { x: target.x, y: target.y, z: target.z || 0 };
    this.setState("GATHERING");
  }
  crumple(amount = this.config.crumple.amount, secondsPerBeat = 0.5) {
    this.activate();
    this.config.crumple.amount = Math.max(0, Math.min(1, amount));
    this.config.mode = "physics";
    this.config.wind.enabled = false;
    this.gustAge = Infinity;
    if (this.state !== "GATHERING") {
      let x = 0,
        y = 0,
        z = 0;
      for (let i = 0; i < this.position.length; i += 3) {
        x += this.position[i];
        y += this.position[i + 1];
        z += this.position[i + 2];
      }
      this.gatherTarget = {
        x: x / this.count,
        y: y / this.count,
        z: z / this.count,
      };
    }
    Object.assign(this.ball, {
      x: this.gatherTarget.x,
      y: this.gatherTarget.y,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      rotation: 0,
      angularVelocity: 0,
      active: false,
      held: false,
      radius: this.config.ball.size * (1.15 - 0.3 * this.config.crumple.amount),
    });
    this.inBall.fill(1);
    this.setState("CRUMPLED");
    this.beginTransition("crumple", secondsPerBeat);
  }
  private beginTransition(
    kind: "crumple" | "assemble",
    secondsPerBeat: number,
    mode: "direct" | "spring" | "swirl" = "direct",
  ) {
    const seconds =
      this.config.seconds /
      (kind === "crumple" ? this.config.crumple.speed : 1);
    this.transition = {
      kind,
      from: this.position.slice(),
      vel: this.velocity.slice(),
      rotation: this.rotation.slice(),
      scales: this.scale.slice(),
      progress: 0,
      duration: this.config.duration,
      seconds,
      cameraWeight: this.cameraWeight,
      sheetMix: this.sheetMix,
      tangent: this.config.duration
        ? this.config.duration * secondsPerBeat
        : seconds,
      mode,
    };
  }
  assemble(
    mode: "direct" | "spring" | "swirl" = "direct",
    secondsPerBeat = 0.5,
  ) {
    if (!this.active) return;
    this.config.mode = "physics";
    this.config.wind.enabled = false;
    this.gustAge = Infinity;
    this.applyWind({ x: 0, y: 0, z: 0 });
    this.ball.active = false;
    this.ball.held = false;
    this.inBall.fill(0);
    this.setState("ASSEMBLING");
    this.beginTransition("assemble", secondsPerBeat, mode);
  }
  throwBall(velocity: Vec3) {
    if (!this.ball.active) return false;
    this.ball.held = false;
    this.ball.vx = velocity.x;
    this.ball.vy = velocity.y;
    this.ball.vz = velocity.z || 0;
    this.setState("BOUNCING");
    return true;
  }
  spinBall(angularVelocity: number) {
    this.ball.angularVelocity = angularVelocity;
  }
  holdBall(position: Vec3, time = this.time) {
    if (!this.ball.active) return false;
    if (!this.ball.held) {
      this.pointerTime = time;
      this.pointerX = position.x;
      this.pointerY = position.y;
      this.releaseVelocity.x = this.releaseVelocity.y = 0;
    } else {
      const dt = Math.max(0.008, (time - this.pointerTime) / 1000);
      this.releaseVelocity.x =
        this.releaseVelocity.x * 0.35 +
        Math.max(-1800, Math.min(1800, (position.x - this.pointerX) / dt)) *
          0.65;
      this.releaseVelocity.y =
        this.releaseVelocity.y * 0.35 +
        Math.max(-1800, Math.min(1800, (position.y - this.pointerY) / dt)) *
          0.65;
    }
    this.pointerTime = time;
    this.pointerX = position.x;
    this.pointerY = position.y;
    this.heldTarget.x = position.x;
    this.heldTarget.y = position.y;
    this.ball.held = true;
    return true;
  }
  releaseBall() {
    if (this.ball.held) this.throwBall(this.releaseVelocity);
  }
  unproject(position: Vec3, depth = 0) {
    const factor =
      this.config.memory.perspective /
      Math.max(
        this.config.memory.perspective * 0.2,
        this.config.memory.perspective + depth - this.camera.z,
      );
    return {
      x:
        (position.x - this.width / 2) / factor + this.width / 2 + this.camera.x,
      y:
        (position.y - this.height / 2) / factor +
        this.height / 2 +
        this.camera.y,
      z: depth,
    };
  }
  hitBall(position: Vec3) {
    return (
      this.ball.active &&
      Math.hypot(position.x - this.ball.x, position.y - this.ball.y) <=
        this.ball.radius * 1.25
    );
  }
  releasePhotos(fraction = this.config.ball.releaseFraction) {
    if (!this.ball.active) return false;
    this.transition = undefined;
    this.config.mode = "physics";
    this.expand = 0;
    const n = Math.max(
      1,
      Math.round(this.count * Math.max(0, Math.min(1, fraction))),
    );
    let released = 0;
    for (let id = 0; id < this.count && released < n; id++)
      if (this.inBall[id]) {
        this.inBall[id] = 0;
        this.objectState[id] = SheetState.FREE;
        const i = id * 3;
        this.velocity[i] =
          this.ball.vx -
          this.ball.angularVelocity * (this.position[i + 1] - this.ball.y) +
          this.sphere[i] * (240 + random01(id, 9) * 460);
        this.velocity[i + 1] =
          this.ball.vy +
          this.ball.angularVelocity * (this.position[i] - this.ball.x) +
          this.sphere[i + 1] * (240 + random01(id, 9) * 460);
        this.velocity[i + 2] =
          this.ball.vz + this.sphere[i + 2] * (180 + random01(id, 9) * 300);
        this.angularVelocity[id] = (random01(id, 8) - 0.5) * 5;
        released++;
      }
    this.ball.active = this.inBall.some((v) => v === 1);
    this.ball.held = false;
    this.state = "FREE";
    return true;
  }
  private updateTransition(dt: number, beatDelta: number) {
    const t = this.transition!;
    t.progress = Math.min(
      1,
      t.progress + (t.duration ? beatDelta / t.duration : dt / t.seconds),
    );
    const u = t.progress,
      ease = u * u * (3 - 2 * u),
      h = 1 - ease,
      v = u - 2 * u * u + u * u * u;
    for (let id = 0; id < this.count; id++) {
      const i = id * 3,
        oldX = this.position[i],
        oldY = this.position[i + 1];
      for (let k = 0; k < 3; k++) {
        const from = t.from[i + k],
          target =
            t.kind === "assemble"
              ? this.home[i + k]
              : (k === 0 ? this.ball.x : k === 1 ? this.ball.y : this.ball.z) +
                this.sphere[i + k] * this.ball.radius;
        const old = this.position[i + k],
          delta = from - target;
        this.position[i + k] =
          t.kind === "crumple"
            ? from + (target - from) * ease
            : target +
              (t.mode === "spring"
                ? (1 - u) ** 2 *
                  (delta * Math.cos(3 * Math.PI * u) +
                    ((t.vel[i + k] * t.tangent + 2 * delta) / (3 * Math.PI)) *
                      Math.sin(3 * Math.PI * u))
                : delta * h + t.vel[i + k] * t.tangent * v);
        this.velocity[i + k] = dt
          ? (this.position[i + k] - old) / dt
          : t.vel[i + k];
      }
      if (t.kind === "assemble" && t.mode === "swirl") {
        const angle = 2 * Math.PI * ease,
          x = this.position[i] - this.home[i],
          y = this.position[i + 1] - this.home[i + 1];
        this.position[i] =
          this.home[i] + x * Math.cos(angle) - y * Math.sin(angle);
        this.position[i + 1] =
          this.home[i + 1] + x * Math.sin(angle) + y * Math.cos(angle);
        if (dt) {
          this.velocity[i] = (this.position[i] - oldX) / dt;
          this.velocity[i + 1] = (this.position[i + 1] - oldY) / dt;
        }
      }
      this.scale[id] =
        t.kind === "crumple"
          ? t.scales[id] +
            (0.45 + 0.3 * (1 - this.config.crumple.amount) - t.scales[id]) *
              ease
          : t.scales[id] + (1 - t.scales[id]) * ease;
      this.rotation[id] =
        t.kind === "crumple"
          ? t.rotation[id] + (random01(id, 7) - 0.5) * 5 * ease
          : t.rotation[id] * h;
      this.bend[id] =
        t.kind === "crumple"
          ? (0.3 + random01(id, 4) * 0.6) * ease
          : this.bend[id] * h;
      this.curl[id] =
        t.kind === "crumple" ? random01(id, 6) * 1.2 * ease : this.curl[id] * h;
    }
    if (t.kind === "assemble") {
      this.sheetMix = t.sheetMix * (1 - ease);
      this.cameraWeight = t.cameraWeight * (1 - ease);
    }
    if (u === 1) {
      this.transition = undefined;
      if (t.kind === "assemble") this.reset();
      else {
        this.ball.active = true;
        this.ball.z = 0;
        this.setState("BALL");
        this.velocity.fill(0);
      }
    }
  }
  private integrateBall(dt: number, strength: number, angle: number) {
    const b = this.ball,
      c = this.config.ball,
      w = this.compatibleWind?.enabled ? this.compatibleWind : this.config.wind;
    b.radius = Math.min(
      this.width * 0.4,
      this.height * 0.4,
      c.size * (1.15 - 0.3 * this.config.crumple.amount),
    );
    b.mass = c.mass;
    b.gravity = c.gravity;
    b.drag = c.drag;
    b.restitution = c.restitution;
    b.friction = c.friction;
    if (b.held) {
      const follow = 1 - Math.exp(-dt * 35);
      b.x += (this.heldTarget.x - b.x) * follow;
      b.y += (this.heldTarget.y - b.y) * follow;
      b.vx = b.vy = 0;
    } else {
      b.vx +=
        ((Math.cos(angle) * strength * 260 + this.externalWind.x) / b.mass) *
        dt;
      b.vy +=
        (((Math.sin(angle) - w.lift) * strength * 260) / b.mass +
          b.gravity +
          this.externalWind.y / b.mass) *
        dt;
      const damping = Math.exp(-b.drag * dt);
      b.vx *= damping;
      b.vy *= damping;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (c.bounce) {
        if (b.x < b.radius || b.x > this.width - b.radius) {
          const outward = b.x < b.radius ? b.vx < 0 : b.vx > 0;
          b.x = Math.max(b.radius, Math.min(this.width - b.radius, b.x));
          if (outward) {
            b.vx = -b.vx * b.restitution;
            b.vy *= 1 - b.friction;
            b.squash = 1;
            b.impactAxis = "x";
            b.collisions++;
          }
        }
        if (b.y < b.radius || b.y > this.height - b.radius) {
          const outward = b.y < b.radius ? b.vy < 0 : b.vy > 0;
          b.y = Math.max(b.radius, Math.min(this.height - b.radius, b.y));
          if (outward) {
            b.vy = -b.vy * b.restitution;
            if (Math.abs(b.vy) < 3 && b.restitution < 1) b.vy = 0;
            b.vx *= 1 - b.friction;
            b.angularVelocity *= 1 - b.friction * 0.5;
            b.squash = 1;
            b.impactAxis = "y";
            b.collisions++;
          }
        }
      }
      b.vx = Math.max(-2200, Math.min(2200, b.vx));
      b.vy = Math.max(-2200, Math.min(2200, b.vy));
    }
    b.rotation += b.angularVelocity * dt;
    b.squash *= Math.exp(-dt * 10);
  }
  private updateBallSheets() {
    const b = this.ball,
      cos = Math.cos(b.rotation),
      sin = Math.sin(b.rotation);
    for (let id = 0; id < this.count; id++)
      if (this.inBall[id]) {
        const i = id * 3,
          x = this.sphere[i] * b.radius,
          y = this.sphere[i + 1] * b.radius;
        this.position[i] =
          b.x +
          (x * cos - y * sin) *
            (b.impactAxis === "x" ? 1 - b.squash * 0.2 : 1 + b.squash * 0.2);
        this.position[i + 1] =
          b.y +
          (x * sin + y * cos) *
            (b.impactAxis === "y" ? 1 - b.squash * 0.2 : 1 + b.squash * 0.2);
        this.position[i + 2] = b.z + this.sphere[i + 2] * b.radius;
        this.rotation[id] = b.rotation + this.sphere[i] * 0.7;
        this.angularVelocity[id] = b.angularVelocity;
        this.velocity[i] =
          b.vx - b.angularVelocity * (this.position[i + 1] - b.y);
        this.velocity[i + 1] =
          b.vy + b.angularVelocity * (this.position[i] - b.x);
        this.velocity[i + 2] = b.vz;
      }
  }
  private collideSheet(id: number) {
    const b = this.ball,
      i = id * 3,
      p = this.position,
      v = this.velocity;
    const x = p[i] - b.x,
      y = p[i + 1] - b.y,
      z = p[i + 2] - b.z,
      r = b.radius + (this.width / this.columns) * 0.6;
    if (Math.abs(x) > r || Math.abs(y) > r || Math.abs(z) > r) return;
    this.collisionChecks++;
    const length = Math.hypot(x, y, z);
    if (length >= r) return;
    const nx = length ? x / length : 1,
      ny = length ? y / length : 0;
    p[i] = b.x + nx * r;
    p[i + 1] = b.y + ny * r;
    const relative = (v[i] - b.vx) * nx + (v[i + 1] - b.vy) * ny;
    if (relative < 0) {
      const impulse =
        (-(1 + this.config.ball.restitution) * relative) /
        (1 / this.mass[id] + 1 / b.mass);
      v[i] += (impulse / this.mass[id]) * nx;
      v[i + 1] += (impulse / this.mass[id]) * ny;
      b.vx -= (impulse / b.mass) * nx;
      b.vy -= (impulse / b.mass) * ny;
      this.angularVelocity[id] += impulse * 0.02;
      b.collisions++;
    }
  }
  protected integrate(dt: number) {
    const p = this.position,
      v = this.velocity,
      a = this.acceleration,
      c = this.config;
    const wind = this.compatibleWind?.enabled ? this.compatibleWind : c.wind,
      angle = (wind.direction * Math.PI) / 180;
    const strength =
      (wind.enabled ? wind.strength : 0) +
      (this.gustAge < 3 ? wind.strength * 4 * Math.exp(-this.gustAge * 3) : 0);
    if (this.ball.active) this.integrateBall(dt, strength, angle);
    for (let id = 0; id < this.count; id++) {
      if (this.inBall[id]) continue;
      const i = id * 3,
        seed = id * 2.399963,
        phase = this.simulationTime * c.memory.floatSpeed + seed;
      a[i] =
        this.externalWind.x +
        (Math.cos(angle) + Math.sin(phase) * wind.turbulence) * strength * 260;
      a[i + 1] =
        this.externalWind.y +
        (Math.sin(angle) -
          wind.lift +
          Math.cos(phase * 1.3) * wind.turbulence) *
          strength *
          260;
      a[i + 2] =
        this.externalWind.z +
        Math.sin(phase * 0.7) * strength * wind.depthDrift * 220;
      a[i + 1] += this.gravity[id] * this.mass[id];
      if (this.state === "FLOATING") {
        a[i] += (this.field[i] + Math.sin(phase) * 18 - p[i]) * 3;
        a[i + 1] +=
          (this.field[i + 1] + Math.cos(phase * 0.8) * 14 - p[i + 1]) * 3;
        a[i + 2] += (this.field[i + 2] - p[i + 2]) * 3;
      }
      if (this.state === "GATHERING") {
        const radius = c.gather.radius,
          z = (2 * (id + 0.5)) / this.count - 1,
          r = Math.sqrt(1 - z * z) * radius;
        a[i] +=
          (this.gatherTarget.x + Math.cos(seed) * r - p[i]) * c.gather.strength;
        a[i + 1] +=
          (this.gatherTarget.y + Math.sin(seed) * r - p[i + 1]) *
          c.gather.strength;
        a[i + 2] +=
          (this.gatherTarget.z + z * radius - p[i + 2]) * c.gather.strength;
      }
      const damping = Math.exp(
        -(wind.enabled
          ? wind.drag
          : this.state === "GATHERING"
            ? Math.sqrt(c.gather.strength) * 1.8
            : this.drag[id]) * dt,
      );
      for (let k = 0; k < 3; k++) {
        a[i + k] /= this.mass[id];
        v[i + k] = (v[i + k] + a[i + k] * dt) * damping;
        p[i + k] += v[i + k] * dt;
      }
      this.angularVelocity[id] =
        (this.angularVelocity[id] +
          Math.sin(phase) * strength * wind.rotation * 5 * dt) *
        Math.exp(-this.drag[id] * dt);
      this.rotation[id] += this.angularVelocity[id] * dt;
      this.bend[id] =
        Math.sin(phase + v[i] * 0.005) * Math.min(0.8, 0.1 + strength * 0.6);
      this.curl[id] = Math.sin(phase * 0.8) * Math.min(1, strength + 0.15);
      if (this.ball.active) this.collideSheet(id);
      if (this.expand < 1)
        this.scale[id] += (1 - this.scale[id]) * Math.min(1, dt * 2);
    }
    if (this.ball.active) this.updateBallSheets();
    this.expand = Math.min(1, this.expand + dt);
    this.gustAge += dt;
  }
  step(time: number, beat: number) {
    const elapsed =
      this.lastTime === undefined
        ? 0
        : Math.max(0, (time - this.lastTime) / 1000);
    const beatDelta = Math.max(0, beat - this.lastBeat);
    this.time = time;
    this.beat = beat;
    this.lastTime = time;
    this.lastBeat = beat;
    if (!this.active) return;
    const m = this.config.memory,
      key = JSON.stringify([m.depth, m.spread, m.depthMode]);
    if (key !== this.fieldKey) {
      for (let id = 0; id < this.count; id++) this.fieldTarget(id, this.field);
      this.fieldKey = key;
    }
    if (this.transition) this.updateTransition(elapsed, beatDelta);
    if (!this.active) return;
    this.collisionChecks = 0;
    this.updateQuality(elapsed);
    const step =
      this.qualityLevel === 0
        ? 1 / 120
        : this.qualityLevel === 1
          ? 1 / 90
          : 1 / 60;
    this.accumulator += this.transition ? 0 : Math.min(0.2, elapsed);
    while (this.accumulator + 1e-10 >= step) {
      this.simulationTime += step;
      this.integrate(step);
      this.accumulator -= step;
    }
    if (this.state !== "ASSEMBLING")
      this.sheetMix = Math.min(1, this.sheetMix + elapsed / 1.2);
    this.cameraWeight +=
      (this.config.mode === "memory"
        ? 1 - this.cameraWeight
        : -this.cameraWeight) * Math.min(1, elapsed * 3);
    const t = this.simulationTime * m.cameraSpeed;
    this.camera.x =
      (m.cameraAuto ? Math.sin(t * 0.7) * this.width * 0.12 : 0) *
      this.cameraWeight;
    this.camera.y =
      (m.cameraAuto ? Math.cos(t * 0.5) * this.height * 0.08 : 0) *
      this.cameraWeight;
    this.camera.z =
      (m.cameraDepth +
        (m.cameraAuto ? (Math.sin(t) * 0.5 + 0.5) * m.depth * 0.6 : 0)) *
      this.cameraWeight;
    if (++this.sortFrame % (this.qualityLevel + 1) === 0)
      this.order.sort(
        (a, b) => this.position[b * 3 + 2] - this.position[a * 3 + 2],
      );
  }
  updateQuality(elapsed: number) {
    if (this.config.quality !== "auto") {
      this.qualityLevel = { high: 0, medium: 1, low: 2 }[this.config.quality];
      return;
    }
    if (elapsed > 0.036) {
      this.lowSeconds += Math.min(0.2, elapsed);
      this.highSeconds = 0;
    } else if (elapsed < 0.023) {
      this.highSeconds += elapsed;
      this.lowSeconds = Math.max(0, this.lowSeconds - elapsed);
    }
    if (this.lowSeconds > 2) {
      this.qualityLevel = Math.min(2, this.qualityLevel + 1);
      this.lowSeconds = 0;
    }
    if (this.highSeconds > 6) {
      this.qualityLevel = Math.max(0, this.qualityLevel - 1);
      this.highSeconds = 0;
    }
  }
  photoIndex(id: number) {
    return this.photoCount
      ? Math.min(
          this.photoCount - 1,
          Math.floor((id * this.photoCount) / this.count),
        )
      : id;
  }
  project(id: number) {
    const r = this.projected,
      i = id * 3,
      m = this.config.memory;
    const depth = this.position[i + 2] - this.camera.z;
    const perspective =
      m.perspective / Math.max(m.perspective * 0.2, m.perspective + depth);
    r.x =
      this.width / 2 +
      (this.position[i] - this.width / 2 - this.camera.x) * perspective;
    r.y =
      this.height / 2 +
      (this.position[i + 1] - this.height / 2 - this.camera.y) * perspective;
    r.scale = this.scale[id] * perspective * (1 + this.sheetMix * 1.8);
    const photoCount = Math.min(this.count, this.photoCount || this.count);
    const photoIndex = this.photoIndex(id);
    const representative =
      id === 0 ||
      Math.floor((id * photoCount) / this.count) !==
        Math.floor(((id - 1) * photoCount) / this.count);
    const ballLOD =
      this.inBall[id] &&
      photoIndex %
        Math.max(
          1,
          Math.ceil(photoCount / (this.qualityLevel === 0 ? 180 : 90)),
        ) !==
        0;
    r.alpha =
      ballLOD ||
      (this.state !== "ASSEMBLING" &&
        !this.inBall[id] &&
        random01(id, 5) >
          m.density *
            (this.qualityLevel === 0
              ? 1
              : this.qualityLevel === 1
                ? 0.7
                : 0.45))
        ? 0
        : Math.max(
            0.25,
            Math.min(1, 1 - (depth / Math.max(1, m.depth)) * 0.55),
          );
    if (!representative) r.alpha *= 1 - this.sheetMix;
    r.rotation = this.rotation[id];
    r.bend = this.bend[id];
    r.curl = this.curl[id];
    r.sheet = this.sheetMix;
    return r;
  }
  snapshot(id: number) {
    const i = id * 3;
    return {
      id,
      homePosition: Array.from(this.home.subarray(i, i + 3)),
      position: Array.from(this.position.subarray(i, i + 3)),
      velocity: Array.from(this.velocity.subarray(i, i + 3)),
      acceleration: Array.from(this.acceleration.subarray(i, i + 3)),
      rotation: this.rotation[id],
      angularVelocity: this.angularVelocity[id],
      scale: this.scale[id],
      mass: this.mass[id],
      drag: this.drag[id],
      gravity: this.gravity[id],
      restitution: this.restitution[id],
      friction: this.friction[id],
      depth: this.position[i + 2],
      bend: this.bend[id],
      curl: this.curl[id],
      state: SheetState[this.objectState[id]],
    };
  }
  // The field layout and all motion advance only when the controller passes a frame.
  fieldTarget(id: number, target: Float64Array) {
    const m = this.config.memory,
      i = id * 3;
    const depth =
      m.depthMode === "time"
        ? timestampToDepth(
            this.timestamps[this.photoIndex(id)] ?? null,
            this.oldest,
            this.newest,
            m.depth,
            random01(id, 3),
          )
        : random01(id, 3) * m.depth;
    target[i] =
      this.width / 2 + (random01(id, 1) - 0.5) * this.width * m.spread * 1.8;
    target[i + 1] =
      this.height / 2 + (random01(id, 2) - 0.5) * this.height * m.spread * 1.8;
    target[i + 2] = depth;
  }
}
