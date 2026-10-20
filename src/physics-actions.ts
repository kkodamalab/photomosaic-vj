import type { PhysicsAction, PhysicsConfig } from "./physics-config";
/** Small deck-local action queue on Transport beat coordinates, not a new clock. */
export class PhysicsActions {
  pending: { action: PhysicsAction; beat: number; division: number }[] = [];
  schedule(
    action: PhysicsAction,
    timing: PhysicsConfig["timing"],
    beat: number,
    beatsPerBar = 4,
  ) {
    if (action === "reset") {
      this.clear();
      return true;
    }
    if (timing === "immediate") return true;
    const division = timing === "bar" ? beatsPerBar : 1;
    if (this.pending.length >= 16) this.pending.shift();
    this.pending.push({
      action,
      beat: (Math.floor(beat / division) + 1) * division,
      division,
    });
    return false;
  }
  flush(beat: number, execute: (action: PhysicsAction) => void) {
    for (let i = 0; i < this.pending.length;) {
      if (beat + 1e-8 >= this.pending[i].beat) {
        const action = this.pending.splice(i, 1)[0].action;
        execute(action);
      } else i++;
    }
  }
  rebase(beat: number) {
    for (const p of this.pending)
      p.beat = (Math.floor(beat / p.division) + 1) * p.division;
  }
  clear() {
    this.pending.length = 0;
  }
}
