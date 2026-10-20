export type ClockState = {
  bpm: number;
  phaseOrigin: number;
  phaseOffset: number;
  beatsPerBar: number;
  isRunning: boolean;
  isLocked: boolean;
  heldBeat: number;
};
export class Transport {
  state: ClockState;
  taps: number[] = [];
  constructor(public now = () => performance.now()) {
    this.state = {
      bpm: 120,
      phaseOrigin: now(),
      phaseOffset: 0,
      beatsPerBar: 4,
      isRunning: true,
      isLocked: false,
      heldBeat: 0,
    };
  }
  get beatDuration() {
    return 60000 / this.state.bpm;
  }
  beat(t = this.now()) {
    return this.state.isRunning
      ? (t - this.state.phaseOrigin + this.state.phaseOffset) /
          this.beatDuration
      : this.state.heldBeat;
  }
  snapshot(t = this.now()) {
    const beat = this.beat(t),
      beatIndex = Math.floor(beat);
    return {
      beat,
      beatIndex,
      phase: ((beat % 1) + 1) % 1,
      barIndex: Math.floor(beatIndex / this.state.beatsPerBar),
      beatInBar:
        ((beatIndex % this.state.beatsPerBar) + this.state.beatsPerBar) %
        this.state.beatsPerBar,
    };
  }
  setBpm(value: number, t = this.now()) {
    if (this.state.isLocked || !Number.isFinite(value)) return;
    const beat = this.beat(t);
    this.state.bpm = Math.min(240, Math.max(30, value));
    this.state.phaseOrigin =
      t + this.state.phaseOffset - beat * this.beatDuration;
  }
  tap(t = this.now()) {
    if (this.taps.length && t - this.taps.at(-1)! >= 3000) this.taps = [];
    this.taps.push(t);
    this.taps = this.taps.slice(-8);
    if (this.taps.length < 4) return;
    const intervals = this.taps
      .slice(1)
      .map((v, i) => v - this.taps[i])
      .sort((a, b) => a - b);
    const n = intervals.length;
    const median =
      n % 2 ? intervals[n >> 1] : (intervals[n / 2 - 1] + intervals[n / 2]) / 2;
    this.setBpm(60000 / median, t);
  }
  reset(bar = false, t = this.now()) {
    const beat = bar ? 0 : Math.floor(this.beat(t));
    this.state.phaseOffset = 0;
    this.state.phaseOrigin = t - beat * this.beatDuration;
    this.state.heldBeat = beat;
  }
  nudge(ms: number) {
    this.state.phaseOffset += ms;
  }
  toggle(t = this.now()) {
    if (this.state.isRunning) {
      this.state.heldBeat = this.beat(t);
      this.state.isRunning = false;
    } else {
      this.state.phaseOrigin =
        t + this.state.phaseOffset - this.state.heldBeat * this.beatDuration;
      this.state.isRunning = true;
    }
  }
}
