import {
  defaultPhysics,
  type PhysicsAction,
  type PhysicsConfig,
} from "./physics-config";
const labels: Record<string, string> = {
  mode: "MODE",
  windMode: "WIND MODE",
  quality: "QUALITY",
  timing: "ACTION TIMING",
  duration: "ANIMATION DURATION",
  seconds: "FREE SECONDS",
  depth: "DEPTH",
  spread: "SPREAD",
  density: "DENSITY",
  floatSpeed: "FLOAT SPEED",
  cameraSpeed: "CAMERA SPEED",
  cameraDepth: "CAMERA DEPTH",
  perspective: "PERSPECTIVE",
  cameraAuto: "CAMERA AUTO",
  depthMode: "DEPTH MODE",
  enabled: "WIND MEMORY",
  direction: "DIRECTION °",
  strength: "STRENGTH",
  turbulence: "TURBULENCE",
  drag: "DRAG",
  lift: "LIFT",
  depthDrift: "DEPTH DRIFT",
  rotation: "ROTATION",
  target: "TARGET",
  radius: "RADIUS",
  amount: "AMOUNT",
  speed: "SPEED",
  size: "BALL SIZE",
  gravity: "GRAVITY",
  bounce: "BOUNCE",
  restitution: "RESTITUTION",
  friction: "FRICTION",
  mass: "MASS",
  angle: "THROW ANGLE °",
  power: "THROW POWER",
  spin: "SPIN",
  releaseFraction: "RELEASE AMOUNT",
};
const ranges: Record<string, number[]> = {
  depth: [0, 2000, 10],
  spread: [0.2, 3, 0.05],
  density: [0.1, 1, 0.05],
  floatSpeed: [0, 2, 0.05],
  cameraSpeed: [0, 2, 0.05],
  cameraDepth: [-300, 800, 10],
  perspective: [300, 1800, 10],
  direction: [0, 360, 1],
  strength: [0, 2, 0.05],
  turbulence: [0, 1, 0.05],
  drag: [0, 6, 0.05],
  lift: [0, 1, 0.05],
  depthDrift: [0, 2, 0.05],
  rotation: [0, 2, 0.05],
  radius: [15, 260, 5],
  amount: [0, 1, 0.05],
  speed: [0.2, 3, 0.1],
  size: [20, 180, 5],
  gravity: [-600, 1200, 20],
  restitution: [0, 1.2, 0.05],
  friction: [0, 1, 0.02],
  mass: [2, 40, 1],
  angle: [-180, 180, 1],
  power: [0, 1600, 20],
  spin: [-8, 8, 0.2],
  releaseFraction: [0.1, 1, 0.1],
  seconds: [0.25, 6, 0.05],
};
const choices: Record<string, (string | number)[]> = {
  mode: ["off", "memory", "physics"],
  windMode: ["2d", "physics"],
  quality: ["auto", "high", "medium", "low"],
  timing: ["immediate", "beat", "bar"],
  duration: [0, 1, 2, 4, 8],
  depthMode: ["random", "time"],
  target: ["center", "pointer"],
};
function controls(values: object, prefix = ""): string {
  return Object.entries(values)
    .map(([key, value]) => {
      const path = prefix + key,
        label = labels[key] || key,
        attr = `data-physics="${path}" aria-label="${prefix}${label}"`;
      if (typeof value === "object")
        return `<details><summary>${key === "memory" ? "MEMORY FIELD" : key === "wind" ? "WIND MEMORY / PHOTO SHEET" : key.toUpperCase()}</summary>${controls(value, path + ".")}</details>`;
      let control = "";
      if (typeof value === "boolean")
        control = `<input type="checkbox" ${attr} ${value ? "checked" : ""}>`;
      else if (choices[key])
        control = `<select ${attr}>${choices[key].map((option) => `<option value="${option}" ${option === value ? "selected" : ""}>${key === "duration" ? (option === 0 ? "FREE" : option + " beats") : key === "timing" ? (option === "immediate" ? "IMMEDIATE" : option === "beat" ? "NEXT BEAT" : "NEXT BAR") : key === "mode" ? (option === "off" ? "OFF" : option === "memory" ? "MEMORY FIELD" : "PHOTO PHYSICS") : String(option).toUpperCase()}</option>`).join("")}</select>`;
      else {
        const [min, max, step] = (path === "gather.strength"
          ? [1, 18, 0.5]
          : ranges[key]) || [0, 10, 0.1];
        control = `<input type="range" ${attr} min="${min}" max="${max}" step="${step}" value="${value}"><output data-physics-value="${path}">${value}</output>`;
      }
      return `<label>${label}${control}</label>`;
    })
    .join("");
}
export function physicsPerformance() {
  return `<div class="physics-performance"><div class="physics-heading">PHYSICS PERFORMANCE <output data-physics-state>ASSEMBLED</output></div><div class="physics-buttons">${[
    ["gather", "GATHER · H"],
    ["crumple", "CRUMPLE · C"],
    ["throw", "THROW · T"],
    ["bounce", "BOUNCE ON · B"],
    ["release", "RELEASE · U"],
    ["assemble", "ASSEMBLE · R"],
  ]
    .map(
      ([action, label]) =>
        `<button data-physics-action="${action}">${label}</button>`,
    )
    .join(
      "",
    )}</div><button class="physics-reset" data-physics-action="reset">RESET PHYSICS</button><small data-physics-status>READY</small></div>`;
}
export function physicsPanel() {
  return `<details class="physics-panel"><summary>PHYSICS / 2.5D</summary>${controls(defaultPhysics())}<label>ASSEMBLE MODE<select data-physics-return aria-label="Physics assemble mode"><option value="direct">DIRECT</option><option value="spring">SPRING</option><option value="swirl">SWIRL</option></select></label><p class="muted">GATHER TARGET = POINTER：次のプレビュークリックで集合。球はドラッグして離すと投げられます。WIND MODE = PHYSICS は既存WINDを紙／球にも適用します。</p></details>`;
}
export function bindPhysics(
  panel: HTMLElement,
  config: PhysicsConfig,
  action: (a: PhysicsAction) => void,
  changed: (path: string) => void,
) {
  panel
    .querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-physics]")
    .forEach(
      (input) =>
        (input.oninput = () => {
          const path = input.dataset.physics!,
            parts = path.split(".");
          let obj = config as unknown as Record<string, unknown>;
          for (const key of parts.slice(0, -1))
            obj = obj[key] as Record<string, unknown>;
          const key = parts.at(-1)!;
          obj[key] =
            input instanceof HTMLInputElement
              ? input.type === "checkbox"
                ? input.checked
                : Number(input.value)
              : typeof obj[key] === "number"
                ? Number(input.value)
                : input.value;
          const output = panel.querySelector(`[data-physics-value="${path}"]`);
          if (output) output.textContent = input.value;
          changed(path);
        }),
    );
  panel
    .querySelectorAll<HTMLButtonElement>("[data-physics-action]")
    .forEach(
      (button) =>
        (button.onclick = () =>
          action(button.dataset.physicsAction as PhysicsAction)),
    );
}
