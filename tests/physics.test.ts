import { it, expect } from "vitest";
import { PhotoPhysics } from "../src/photo-physics";
import { photoTimestamp, timestampToDepth } from "../src/physics-config";
it("Photo Object pool initializes stable IDs, home and all physical properties", () => {
  const e = new PhotoPhysics();
  e.configure(1280, 720, 48);
  expect(e.count).toBe(1296);
  const a = e.position;
  e.configure(1280, 720, 48);
  expect(e.position).toBe(a);
  expect(e.snapshot(0)).toMatchObject({
    id: 0,
    state: "ASSEMBLED",
    depth: 0,
    scale: 1,
    gravity: 0,
  });
  e.activate();
  expect(e.state).toBe("FREE");
  e.velocity[0] = 50;
  e.reset();
  expect(e.velocity.every((x) => x === 0)).toBe(true);
  expect(e.position).toEqual(e.home);
});
it("EXIF time maps old photos behind new photos and missing times use fallback", () => {
  const a = photoTimestamp("2020-01-01T12:00:00")!,
    b = photoTimestamp("2021-01-01T12:00:00")!;
  expect(timestampToDepth(a, a, b, 800, 0.5)).toBe(800);
  expect(timestampToDepth(b, a, b, 800, 0.5)).toBe(0);
  expect(timestampToDepth(null, a, b, 800, 0.3)).toBe(240);
  expect(photoTimestamp("bad")).toBe(null);
});
function advance(e: PhotoPhysics, seconds: number, start = 0) {
  for (let n = 1; n <= seconds * 120; n++)
    e.step((start + n / 120) * 1000, (start + n / 120) * 2);
}
it("MEMORY FIELD unfolds depth and camera moves without teleporting", () => {
  const e = new PhotoPhysics();
  e.configure(1280, 720, 12);
  e.step(0, 0);
  e.memoryField();
  const home = e.position.slice();
  expect(e.position).toEqual(home);
  advance(e, 2);
  expect(e.position[2]).toBeGreaterThan(0);
  e.config.memory.cameraAuto = true;
  const before = e.camera.z;
  advance(e, 1, 2);
  expect(e.camera.z).not.toBe(before);
  expect(e.project(0).scale).not.toBe(e.project(50).scale);
});
it("WIND MEMORY adds velocity/depth/rotation/bend; OFF keeps inertia", () => {
  const e = new PhotoPhysics();
  e.configure(1280, 720, 12);
  e.step(0, 0);
  e.activate();
  e.config.wind.enabled = true;
  advance(e, 1);
  expect(e.velocity[0]).toBeGreaterThan(0);
  expect(e.position[2]).not.toBe(0);
  expect(e.rotation.some((v) => v !== 0)).toBe(true);
  expect(e.bend.some((v) => v !== 0)).toBe(true);
  e.config.wind.enabled = false;
  const x = e.position[0];
  advance(e, 0.1, 1);
  expect(e.position[0]).toBeGreaterThan(x);
});
it("GATHER CENTER and POINTER attract current sheets into a cluster", () => {
  for (const target of [
    { x: 640, y: 360 },
    { x: 180, y: 140 },
  ]) {
    const e = new PhotoPhysics();
    e.configure(1280, 720, 12);
    e.step(0, 0);
    e.activate();
    const before = e.position[0];
    e.gather(target);
    expect(e.position[0]).toBe(before);
    advance(e, 4);
    let mean = 0;
    for (let i = 0; i < e.count; i++)
      mean += Math.hypot(
        e.position[i * 3] - target.x,
        e.position[i * 3 + 1] - target.y,
      );
    expect(mean / e.count).toBeLessThan(110);
  }
});
function makeBall() {
  const e = new PhotoPhysics();
  e.configure(1280, 720, 12);
  e.step(0, 0);
  e.config.seconds = 0.4;
  e.gather();
  advance(e, 1);
  e.crumple();
  advance(e, 0.5, 1);
  return e;
}
it("CRUMPLE contracts current sheets into a visible ball with photo surface state", () => {
  const e = makeBall();
  expect(e.ball.active).toBe(true);
  expect(e.state).toBe("BALL");
  expect(e.inBall.every((v) => v === 1)).toBe(true);
  expect(e.scale[0]).toBeGreaterThan(0.1);
  expect(e.bend[0]).toBeGreaterThan(0);
  expect(
    Math.hypot(
      e.position[0] - e.ball.x,
      e.position[1] - e.ball.y,
      e.position[2] - e.ball.z,
    ),
  ).toBeCloseTo(e.ball.radius, 0);
});
it("THROW moves ball, spin changes rotation and DRAG reduces velocity", () => {
  const e = makeBall();
  e.config.ball.gravity = 0;
  e.config.ball.bounce = false;
  const x = e.ball.x;
  e.throwBall({ x: 300, y: -50 });
  e.spinBall(3);
  advance(e, 0.2, 1.5);
  expect(e.ball.x).toBeGreaterThan(x);
  expect(e.ball.vx).toBeLessThan(300);
  expect(e.ball.rotation).toBeGreaterThan(0);
});
for (const [axis, side] of [
  ["x", "left"],
  ["x", "right"],
  ["y", "top"],
  ["y", "bottom"],
] as const)
  it(`BOUNCE ${side} reflects with restitution and squash`, () => {
    const e = makeBall(),
      b = e.ball;
    e.config.ball.gravity = 0;
    e.config.ball.drag = 0;
    e.config.ball.friction = 0;
    e.config.ball.restitution = 0.5;
    if (axis === "x") {
      b.x = side === "left" ? b.radius + 0.1 : e.width - b.radius - 0.1;
      e.throwBall({ x: side === "left" ? -200 : 200, y: 0 });
    } else {
      b.y = side === "top" ? b.radius + 0.1 : e.height - b.radius - 0.1;
      e.throwBall({ x: 0, y: side === "top" ? -200 : 200 });
    }
    advance(e, 0.025, 1.5);
    const velocity = axis === "x" ? b.vx : b.vy;
    expect(Math.sign(velocity)).toBe(
      side === "left" || side === "top" ? 1 : -1,
    );
    expect(Math.abs(velocity)).toBeCloseTo(100, 0);
    expect(b.squash).toBeGreaterThan(0);
    expect(b.collisions).toBeGreaterThan(0);
  });
it("gravity accelerates down; restitution above one amplifies bounce", () => {
  const e = makeBall();
  e.config.ball.drag = 0;
  e.config.ball.restitution = 1.2;
  e.ball.y = e.ball.radius + 1;
  e.throwBall({ x: 0, y: 0 });
  advance(e, 0.1, 1.5);
  expect(e.ball.vy).toBeGreaterThan(30);
  e.ball.x = e.width - e.ball.radius - 0.1;
  e.throwBall({ x: 200, y: 0 });
  advance(e, 0.025, 1.6);
  expect(e.ball.vx).toBeLessThan(-230);
});
it("manual hold and release retains filtered pointer velocity", () => {
  const e = makeBall();
  e.holdBall({ x: 400, y: 300 }, 1500);
  advance(e, 0.1, 1.5);
  expect(e.ball.x).toBeLessThan(500);
  e.holdBall({ x: 500, y: 250 }, 1600);
  e.releaseBall();
  expect(e.ball.vx).toBeGreaterThan(400);
  expect(e.ball.vy).toBeLessThan(0);
});
it("ball/photo collision uses linear broad phase and transfers impulse and spin", () => {
  const e = makeBall();
  e.config.ball.gravity = 0;
  e.releasePhotos(0.1);
  const i = 0;
  e.position[i] = e.ball.x + e.ball.radius + 5;
  e.position[i + 1] = e.ball.y;
  e.position[i + 2] = 0;
  e.velocity[i] = -150;
  e.velocity[i + 1] = 0;
  const collisions = e.ball.collisions;
  advance(e, 0.025, 1.5);
  expect(e.velocity[i]).toBeGreaterThan(0);
  expect(e.angularVelocity[0]).not.toBe(0);
  expect(e.ball.collisions).toBeGreaterThan(collisions);
  expect(e.collisionChecks).toBeLessThanOrEqual(e.count * 3);
});
it("same wind accelerates heavy ball less than a free sheet", () => {
  const e = makeBall();
  e.config.ball.gravity = 0;
  e.config.ball.bounce = false;
  e.config.ball.drag = 0;
  e.config.wind.enabled = true;
  e.config.wind.turbulence = 0;
  e.config.wind.lift = 0;
  e.releasePhotos(0.1);
  e.velocity.fill(0);
  e.ball.vx = 0;
  e.position[0] = 50;
  e.position[1] = 50;
  e.position[2] = 1000;
  advance(e, 0.1, 1.5);
  expect(e.ball.vx).toBeGreaterThan(0);
  expect(e.velocity[0]).toBeGreaterThan(e.ball.vx * 2);
});
for (const mode of ["direct", "spring", "swirl"] as const)
  it(`RELEASE → ${mode} ASSEMBLE returns all sheets to exact home`, () => {
    const e = makeBall();
    const before = e.position.slice();
    e.releasePhotos();
    expect(e.ball.active).toBe(false);
    expect(e.position).toEqual(before);
    advance(e, 0.2, 1.5);
    expect(e.position).not.toEqual(before);
    e.assemble(mode);
    const from = e.position.slice();
    advance(e, 0.05, 1.7);
    expect(e.position).not.toEqual(e.home);
    expect(e.position).not.toEqual(from);
    advance(e, 0.5, 1.75);
    expect(e.state).toBe("ASSEMBLED");
    expect(e.position).toEqual(e.home);
    expect(e.velocity.every((v) => v === 0)).toBe(true);
  });
import { PhysicsActions } from "../src/physics-actions";
it("action timing queues next beat/bar, reset rebases and failsafe clears", () => {
  const q = new PhysicsActions(),
    actions: string[] = [];
  expect(q.schedule("crumple", "beat", 2.3)).toBe(false);
  q.schedule("throw", "bar", 2.3);
  q.flush(2.9, (a) => actions.push(a));
  expect(actions).toEqual([]);
  q.flush(3, (a) => actions.push(a));
  expect(actions).toEqual(["crumple"]);
  q.rebase(0);
  q.flush(3.9, (a) => actions.push(a));
  expect(actions.length).toBe(1);
  q.flush(4, (a) => actions.push(a));
  expect(actions).toEqual(["crumple", "throw"]);
  q.schedule("release", "beat", 4.2);
  expect(q.schedule("reset", "bar", 4.2)).toBe(true);
  expect(q.pending).toEqual([]);
});
it("beat-based CRUMPLE and ASSEMBLE follow Transport pause and elapsed beats", () => {
  const e = new PhotoPhysics();
  e.configure(1280, 720, 12);
  e.step(0, 0);
  e.config.duration = 2;
  e.crumple(1, 0.5);
  e.step(500, 0);
  expect(e.ball.active).toBe(false);
  e.step(1000, 1);
  expect(e.ball.active).toBe(false);
  e.step(1500, 2);
  expect(e.ball.active).toBe(true);
  e.releasePhotos();
  e.assemble("swirl");
  e.step(2000, 3);
  expect(e.active).toBe(true);
  e.step(2500, 4);
  expect(e.state).toBe("ASSEMBLED");
});
it("adaptive quality reduces work progressively without changing canvas geometry", () => {
  const e = new PhotoPhysics();
  e.configure(1280, 720, 48);
  for (let i = 0; i < 100; i++) e.updateQuality(0.05);
  expect(e.qualityLevel).toBe(2);
  expect(e.width).toBe(1280);
  e.config.quality = "high";
  e.updateQuality(0.1);
  expect(e.qualityLevel).toBe(0);
});
it("resolution/grid changes preserve live ball and return state without invalid values", () => {
  const e = makeBall();
  e.throwBall({ x: 100, y: 0 });
  e.configure(1920, 1080, 24);
  expect(e.ball.active).toBe(true);
  expect(e.inBall.some((v) => v === 1)).toBe(true);
  expect(e.position.every(Number.isFinite)).toBe(true);
  e.releasePhotos();
  e.assemble("swirl");
  advance(e, 0.1, 1.5);
  e.configure(960, 540, 18);
  advance(e, 0.5, 1.6);
  expect(e.state).toBe("ASSEMBLED");
  expect(e.position).toEqual(e.home);
});
it("RESET clears external forces, depth, ball, angular velocity and all pending motion", () => {
  const e = makeBall();
  e.applyWind({ x: 500, y: 0, z: 100 });
  e.spinBall(4);
  e.reset();
  expect(e.ball.active).toBe(false);
  expect(e.ball.angularVelocity).toBe(0);
  expect(e.position).toEqual(e.home);
  e.activate();
  advance(e, 0.1, 1.5);
  expect(e.velocity.every((v) => v === 0)).toBe(true);
});
it("new actions interrupt return/crumple continuously instead of finishing stale transitions", () => {
  const e = makeBall();
  e.releasePhotos();
  e.assemble();
  advance(e, 0.1, 1.5);
  e.gather({ x: 150, y: 150 });
  advance(e, 0.6, 1.6);
  expect(e.state).toBe("GATHERING");
  e.crumple();
  advance(e, 0.1, 2.2);
  e.explode({ x: 150, y: 150 }, 1);
  expect(e.inBall.some((v) => v === 1)).toBe(false);
  advance(e, 0.6, 2.3);
  expect(e.state).toBe("EXPLODING");
});
it("TIME depth follows the actual displayed photo index; representative sheets avoid photo duplicates", () => {
  const e = new PhotoPhysics();
  e.configure(1280, 720, 12);
  e.setTimestamps([100, 200]);
  e.config.memory.depthMode = "time";
  e.memoryField();
  e.step(0, 0);
  const first = e.field[2],
    last = e.field[e.field.length - 1];
  expect(first).toBeGreaterThan(last);
  expect(e.photoIndex(0)).toBe(0);
  expect(e.photoIndex(e.count - 1)).toBe(1);
});
it("assembly preserves current camera/mix at start and does not revive a stopped camera", () => {
  const e = makeBall();
  e.config.memory.cameraAuto = true;
  e.cameraWeight = 0;
  e.releasePhotos();
  e.assemble();
  e.step(1500, 3);
  expect(e.cameraWeight).toBe(0);
});
it("pointer unprojection matches the displayed perspective plane", () => {
  const e = new PhotoPhysics();
  e.configure(1280, 720, 12);
  e.camera.x = 30;
  e.camera.y = 15;
  e.camera.z = 200;
  const point = e.unproject({ x: 640, y: 360 }, 0);
  expect(point.x).toBe(670);
  expect(point.y).toBe(375);
});
it("FRICTION reduces tangential velocity and spin at the floor", () => {
  const e = makeBall();
  e.config.ball.gravity = 0;
  e.config.ball.drag = 0;
  e.config.ball.friction = 0.5;
  e.ball.y = e.height - e.ball.radius - 0.1;
  e.spinBall(4);
  e.throwBall({ x: 200, y: 100 });
  advance(e, 0.025, 1.5);
  expect(e.ball.vx).toBeCloseTo(100, 0);
  expect(e.ball.angularVelocity).toBeCloseTo(3, 1);
});
it("BOUNCE OFF allows escape and ON safely catches the ball again", () => {
  const e = makeBall();
  e.config.ball.gravity = 0;
  e.config.ball.bounce = false;
  e.ball.x = e.width - 10;
  e.throwBall({ x: 400, y: 0 });
  advance(e, 0.1, 1.5);
  expect(e.ball.x).toBeGreaterThan(e.width);
  e.config.ball.bounce = true;
  advance(e, 0.025, 1.6);
  expect(e.ball.x).toBeLessThanOrEqual(e.width - e.ball.radius);
  expect(e.ball.vx).toBeLessThan(0);
});
it("SWIRL interruption inherits velocity from its rotated return path", () => {
  const e = makeBall();
  e.releasePhotos();
  e.assemble("swirl");
  e.step(1600, 3.2);
  const x = e.position[0],
    y = e.position[1];
  e.step(1610, 3.22);
  expect(e.velocity[0]).toBeCloseTo((e.position[0] - x) / 0.01, 4);
  expect(e.velocity[1]).toBeCloseTo((e.position[1] - y) / 0.01, 4);
});
