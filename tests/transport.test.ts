import { describe, it, expect } from "vitest";
import { Transport } from "../src/transport";
describe("manual transport", () => {
  it("500ms taps give 120 BPM", () => {
    const c = new Transport(() => 0);
    [0, 500, 1000, 1500, 2000].forEach((t) => c.tap(t));
    expect(c.state.bpm).toBe(120);
  });
  it("median rejects outlier", () => {
    const c = new Transport(() => 0);
    [0, 500, 1000, 1800, 2300, 2800, 3300].forEach((t) => c.tap(t));
    expect(c.state.bpm).toBe(120);
  });
  it("tempo changes preserve continuous beat", () => {
    const c = new Transport(() => 0),
      before = c.beat(1234);
    c.setBpm(138, 1234);
    expect(c.beat(1234)).toBeCloseTo(before);
  });
  it("phase reset preserves BPM and beat index", () => {
    const c = new Transport(() => 0);
    c.reset(false, 3250);
    expect(c.snapshot(3250).phase).toBe(0);
    expect(c.snapshot(3250).beatIndex).toBe(6);
    expect(c.state.bpm).toBe(120);
  });
  it("bar reset goes to first beat", () => {
    const c = new Transport(() => 0);
    c.reset(true, 3250);
    expect(c.snapshot(3250).beatIndex).toBe(0);
    expect(c.state.bpm).toBe(120);
  });
  it("lock prevents manual and tap tempo updates but allows reset", () => {
    const c = new Transport(() => 0);
    c.state.isLocked = true;
    c.setBpm(180);
    [0, 400, 800, 1200].forEach((t) => c.tap(t));
    expect(c.state.bpm).toBe(120);
    c.reset(true, 1200);
    expect(c.beat(1200)).toBe(0);
  });
  it("nudge changes phase only", () => {
    const c = new Transport(() => 0);
    c.nudge(25);
    expect(c.snapshot(0).phase).toBeCloseTo(0.05);
    expect(c.state.bpm).toBe(120);
  });
  it("frame gaps do not affect position", () => {
    const c = new Transport(() => 0);
    expect(c.beat(60000)).toBe(120);
  });
  it("resets taps after three seconds", () => {
    const c = new Transport(() => 0);
    [0, 500, 1000, 1500, 4500].forEach((t) => c.tap(t));
    expect(c.taps).toEqual([4500]);
  });
  it("pause and resume retain beat", () => {
    const c = new Transport(() => 0);
    c.toggle(750);
    expect(c.beat(5000)).toBe(1.5);
    c.toggle(5000);
    expect(c.beat(5250)).toBe(2);
  });
  it("clamps and rejects invalid BPM", () => {
    const c = new Transport(() => 0);
    c.setBpm(500);
    expect(c.state.bpm).toBe(240);
    c.setBpm(NaN);
    expect(c.state.bpm).toBe(240);
    c.setBpm(1);
    expect(c.state.bpm).toBe(30);
  });
});
