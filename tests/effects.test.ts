import { describe, it, expect } from "vitest";
import { EffectChain, defaultEffects } from "../src/effects";
import { Transport } from "../src/transport";
describe("deck effect chains", () => {
  it("disabled effects preserve content coordinates exactly", () => {
    const e = new EffectChain();
    e.begin(defaultEffects(), 1000, 2);
    expect(e.transform(0, 20, 30)).toEqual({
      x: 20,
      y: 30,
      scale: 1,
      rotation: 0,
    });
    expect(e.active).toBe(false);
  });
  it("pulse is smooth, reversible and driven by Transport phase", () => {
    const c = defaultEffects(),
      e = new EffectChain(),
      clock = new Transport(() => 0);
    c.pulse.enabled = true;
    c.pulse.beatSync = true;
    e.begin(c, 125, clock.beat(125));
    expect(e.transform(0, 0, 0).scale).toBeCloseTo(1.2);
    clock.reset(false, 125);
    e.begin(c, 125, clock.beat(125));
    expect(e.transform(0, 0, 0).scale).toBe(1);
    c.pulse.enabled = false;
    expect(e.transform(0, 0, 0).scale).toBe(1);
  });
  it("float uses individual smooth phases and decks stay independent", () => {
    const a = new EffectChain(),
      b = new EffectChain(),
      c = defaultEffects();
    c.float.enabled = true;
    a.begin(c, 1000, 2);
    b.begin(defaultEffects(), 1000, 2);
    const first = { ...a.transform(0, 100, 100) };
    expect({ ...a.transform(1, 100, 100) }).not.toEqual(first);
    expect(b.transform(0, 100, 100).x).toBe(100);
    a.begin(c, 1001, 2.002);
    expect(Math.abs(a.transform(0, 100, 100).x - first.x)).toBeLessThan(0.1);
    c.float.enabled = false;
    expect(a.transform(0, 100, 100).x).toBe(100);
  });
});

it("wave directions and simultaneous effects change transforms without mutating anchors", () => {
  const e = new EffectChain(),
    c = defaultEffects();
  c.wave.enabled = true;
  const values = [];
  for (const direction of [
    "horizontal",
    "vertical",
    "diagonal",
    "radial",
  ] as const) {
    c.wave.direction = direction;
    e.begin(c, 250, 0.5);
    values.push({ ...e.transform(4, 150, 100) });
  }
  expect(new Set(values.map((v) => JSON.stringify(v))).size).toBe(4);
  c.pulse.enabled = true;
  c.float.enabled = true;
  e.begin(c, 250, 0.5);
  expect(e.transform(4, 150, 100).scale).not.toBe(1);
  c.wave.enabled = false;
  c.pulse.enabled = false;
  c.float.enabled = false;
  expect(e.transform(4, 150, 100)).toEqual({
    x: 150,
    y: 100,
    rotation: 0,
    scale: 1,
  });
});

it("wind changes positions; OFF keeps inertia; gust decays", () => {
  const c = defaultEffects(),
    e = new EffectChain();
  e.configure(1280, 720, 12);
  c.wind.enabled = true;
  c.wind.turbulence = 0;
  e.begin(c, 0, 0);
  e.begin(c, 100, 0.2);
  expect(e.motion[0]).toBeGreaterThan(0);
  const speed = e.motion[2];
  e.gust();
  e.begin(c, 200, 0.4);
  expect(e.motion[2]).toBeGreaterThan(speed);
  c.wind.enabled = false;
  e.begin(c, 300, 0.6);
  const before = e.motion[0];
  e.begin(c, 400, 0.8);
  expect(e.motion[0]).toBeGreaterThan(before);
  for (let t = 500; t <= 5000; t += 100) e.begin(c, t, t / 500);
  expect(e.motion[2]).toBeLessThan(speed);
  expect(e.motion[0]).toBeGreaterThan(0);
});
for (const mode of ["direct", "spring", "swirl"] as const)
  it(`${mode} returns from explosion continuously in four Transport beats`, () => {
    const c = defaultEffects(),
      e = new EffectChain();
    e.configure(1280, 720, 12);
    e.begin(c, 0, 0);
    e.explode({ x: 0.5, y: 0.5 }, 1, 1);
    e.begin(c, 100, 0.2);
    expect(e.motion[0]).toBeLessThan(0);
    expect(e.motion[2]).toBeLessThan(0);
    c.assemble.mode = mode;
    c.assemble.duration = 4;
    e.assemble();
    const before = e.motion[0];
    expect(e.state).toBe("ASSEMBLING");
    expect(e.motion[0]).toBe(before);
    e.begin(c, 110, 0.22);
    expect(Math.abs(e.motion[0] - before)).toBeLessThan(10);
    for (let t = 120; t <= 2200; t += 10) e.begin(c, t, t / 500);
    expect(e.state).toBe("ASSEMBLED");
    expect(e.motion.every((v) => v === 0)).toBe(true);
  });

it("each beat division follows the shared Transport through tempo changes and resets", () => {
  for (const division of [0.25, 0.5, 1, 2, 4, 8]) {
    const clock = new Transport(() => 0),
      e = new EffectChain(),
      c = defaultEffects();
    c.pulse.enabled = true;
    c.pulse.beatSync = true;
    c.pulse.beatDivision = division;
    const t = division * 125;
    e.begin(c, t, clock.beat(t));
    expect(e.transform(0, 0, 0).scale).toBeCloseTo(1.2);
    clock.setBpm(180, t);
    e.begin(c, t, clock.beat(t));
    expect(e.transform(0, 0, 0).scale).toBeCloseTo(1.2);
    clock.reset(true, t);
    e.rebase(clock.beat(t));
    e.begin(c, t, clock.beat(t));
    expect(e.transform(0, 0, 0).scale).toBeCloseTo(1);
  }
});
it("synced assembly pauses with Transport and finishes at elapsed beat after a frame gap", () => {
  const e = new EffectChain(),
    c = defaultEffects(),
    clock = new Transport(() => 0);
  e.configure(1280, 720, 12);
  e.begin(c, 0, 0);
  e.explode({ x: 0.5, y: 0.5 }, 1, 1);
  e.begin(c, 100, 0.2);
  c.assemble.duration = 4;
  e.assemble();
  clock.toggle(100);
  e.begin(c, 1000, clock.beat(1000));
  expect(e.state).toBe("ASSEMBLING");
  const positions = e.motion.slice();
  e.begin(c, 2000, clock.beat(2000));
  expect(e.motion).toEqual(positions);
  clock.toggle(2000);
  e.begin(c, 4001, clock.beat(4001));
  expect(e.state).toBe("ASSEMBLED");
});
it("phase reset rebases assembly without changing its progress", () => {
  const e = new EffectChain(),
    c = defaultEffects();
  e.configure(1280, 720, 12);
  e.begin(c, 0, 0);
  e.explode({ x: 0.5, y: 0.5 }, 1, 1);
  e.begin(c, 100, 0.2);
  c.assemble.duration = 4;
  e.assemble();
  e.begin(c, 200, 0.4);
  const x = e.motion[0];
  e.rebase(0);
  e.begin(c, 200, 0);
  expect(e.motion[0]).toBeCloseTo(x);
});
it("fixed-step wind agrees at 30 and 60 fps and DRAG damps inertia", () => {
  const run = (fps: number) => {
    const e = new EffectChain(),
      c = defaultEffects();
    c.wind.enabled = true;
    c.wind.turbulence = 0;
    c.wind.rotation = 0;
    e.configure(1280, 720, 12);
    e.begin(c, 0, 0);
    for (let n = 1; n <= fps; n++) e.begin(c, (n * 1000) / fps, (n * 2) / fps);
    return e;
  };
  const a = run(30),
    b = run(60);
  expect(a.motion[0]).toBeCloseTo(b.motion[0], 1);
  expect(a.motion[2]).toBeCloseTo(b.motion[2], 1);
  a.config.wind.enabled = false;
  const speed = a.motion[2];
  a.begin(a.config, 1100, 2.2);
  expect(a.motion[2]).toBeLessThan(speed);
  expect(a.motion[2]).toBeGreaterThan(0);
});
it("SPRING overshoots and SWIRL bends the return path", () => {
  const run = (mode: "direct" | "spring" | "swirl") => {
    const e = new EffectChain(),
      c = defaultEffects();
    e.configure(1280, 720, 12);
    e.begin(c, 0, 0);
    e.motion[0] = 100;
    c.assemble.mode = mode;
    c.assemble.seconds = 1;
    e.assemble();
    e.begin(c, 500, 1);
    return e;
  };
  expect(run("spring").motion[0]).toBeLessThan(0);
  expect(run("swirl").motion[0]).toBeLessThan(0);
  const spring = run("spring");
  spring.begin(spring.config, 600, 1.2);
  expect(spring.motion[0]).toBeGreaterThan(0);
  spring.begin(spring.config, 950, 1.9);
  expect(spring.motion[0]).toBeLessThan(0);
  expect(run("direct").motion[0]).toBeCloseTo(50);
});
it("GUST interrupts a return using current positions and velocities", () => {
  const e = new EffectChain(),
    c = defaultEffects();
  e.configure(1280, 720, 12);
  e.begin(c, 0, 0);
  e.explode({ x: 0, y: 0 }, 1, 1);
  e.begin(c, 100, 0.2);
  e.assemble();
  e.begin(c, 200, 0.4);
  const before = e.motion[0];
  e.gust();
  expect(e.motion[0]).toBe(before);
  expect(e.state).toBe("WIND");
  e.begin(c, 300, 0.6);
  expect(e.motion[0]).not.toBe(before);
});
it("legacy scatter transfers to continuous return; resolution/grid changes stay finite", () => {
  const e = new EffectChain(),
    c = defaultEffects();
  e.configure(1280, 720, 12);
  e.begin(c, 0, 0);
  e.assemble(1);
  expect(e.motion[0]).not.toBe(0);
  e.begin(c, 100, 0.2);
  e.configure(1920, 1080, 24);
  e.begin(c, 200, 0.4);
  expect(e.motion.length).toBe(24 * 14 * 6);
  expect(e.motion.every(Number.isFinite)).toBe(true);
});
it("FREEZE time rebasing prevents physics catch-up", () => {
  const e = new EffectChain(),
    c = defaultEffects();
  c.wind.enabled = true;
  e.configure(1280, 720, 12);
  e.begin(c, 0, 0);
  e.begin(c, 100, 0.2);
  const before = e.motion.slice();
  e.pause(5000, 10);
  e.begin(c, 5000, 10);
  expect(e.motion).toEqual(before);
});
