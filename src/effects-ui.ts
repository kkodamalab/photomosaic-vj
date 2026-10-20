import { defaultEffects, type Effects } from "./effects";
export type EffectAction = "explosion" | "assemble" | "gust";
const names: Record<string, string> = {
  pulse: "PULSE",
  wave: "PHOTO WAVE",
  float: "FLOAT",
  wind: "WIND",
  glitch: "GLITCH",
  rgbShift: "RGB SHIFT",
  explosion: "EXPLOSION",
  assemble: "ASSEMBLE",
};
const labels: Record<string, string> = {
  enabled: "ON / OFF",
  amount: "AMOUNT",
  speed: "SPEED (Hz)",
  beatDivision: "SYNC",
  rotation: "ROTATION",
  wavelength: "WAVELENGTH",
  direction: "DIRECTION",
  turbulence: "TURBULENCE",
  drag: "DRAG",
  power: "POWER",
  origin: "ORIGIN",
  mode: "RETURN MODE",
  duration: "DURATION",
  seconds: "FREE (seconds)",
};
const options = (
  items: (string | number)[],
  selected: string | number,
  caption = (v: string | number) => String(v).toUpperCase(),
) =>
  items
    .map(
      (v) =>
        `<option value="${v}" ${v === selected ? "selected" : ""}>${caption(v)}</option>`,
    )
    .join("");
export function effectsPanel() {
  const config = defaultEffects();
  return `<details class="effects-panel"><summary>EFFECTS <span class="effect-state" data-fx-state>ASSEMBLED</span></summary>${Object.entries(
    config,
  )
    .map(
      ([effect, params]) =>
        `<details data-effect="${effect}"><summary>${names[effect]}</summary>${Object.entries(
          params,
        )
          .filter(([key]) => key !== "beatSync")
          .map(([key, value]) => {
            const attr = `data-fx="${effect}" data-param="${key}" aria-label="${names[effect]} ${labels[key] || key}"`;
            let control = "";
            if (key === "beatDivision")
              control = `<select ${attr}>${options([0, 0.25, 0.5, 1, 2, 4, 8], 0, (v) => (v === 0 ? "OFF" : `${v} beat${Number(v) > 1 ? "s" : ""}`))}</select>`;
            else if (key === "duration")
              control = `<select ${attr}>${options([0, 1, 2, 4, 8], Number(value), (v) => (v === 0 ? "FREE" : `${v} beats`))}</select>`;
            else if (typeof value === "boolean")
              control = `<input ${attr} type="checkbox" ${value ? "checked" : ""}>`;
            else if (typeof value === "string")
              control = `<select ${attr}>${options(key === "mode" ? ["direct", "spring", "swirl"] : key === "origin" ? ["center", "random", "pointer"] : ["horizontal", "vertical", "diagonal", "radial"], value)}</select>`;
            else {
              const [min, max, step] =
                key === "wavelength"
                  ? [40, 1200, 10]
                  : key === "direction"
                    ? [0, 360, 1]
                    : key === "drag"
                      ? [0, 6, 0.05]
                      : key === "seconds"
                        ? [0.25, 8, 0.05]
                        : key === "speed"
                          ? [0.05, 12, 0.05]
                          : [0, 1, 0.01];
              control = `<input ${attr} type="range" min="${min}" max="${max}" step="${step}" value="${value}"><output data-fx-value="${effect}.${key}">${value}</output>`;
            }
            return `<label>${effect === "wind" && key === "amount" ? "STRENGTH" : labels[key] || key}${control}</label>`;
          })
          .join(
            "",
          )}${effect === "wind" ? '<button data-fx-action="gust">GUST · G</button>' : effect === "explosion" ? '<button data-fx-action="explosion">EXPLOSION · E</button>' : effect === "assemble" ? '<button data-fx-action="assemble">ASSEMBLE · R</button>' : ""}</details>`,
    )
    .join(
      "",
    )}<p class="muted">E / R / G：FX SHORTCUT DECKを操作<br>POINTER：プレビューをクリックして爆発（境界ドラッグを一時停止）</p></details>`;
}
export function bindEffects(
  panel: HTMLElement,
  config: Effects,
  action: (action: EffectAction) => void,
) {
  panel
    .querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-fx]")
    .forEach((input) => {
      input.oninput = () => {
        const key = input.dataset.param!,
          effect = input.dataset.fx! as keyof Effects;
        const parameters = config[effect] as unknown as Record<string, unknown>;
        if (key === "beatDivision") {
          parameters.beatSync = Number(input.value) > 0;
          parameters.beatDivision = Number(input.value) || 1;
        } else
          parameters[key] =
            input instanceof HTMLInputElement
              ? input.type === "checkbox"
                ? input.checked
                : Number(input.value)
              : ["duration"].includes(key)
                ? Number(input.value)
                : input.value;
        const output = panel.querySelector(
          `[data-fx-value="${effect}.${key}"]`,
        );
        if (output) output.textContent = input.value;
      };
    });
  panel
    .querySelectorAll<HTMLButtonElement>("[data-fx-action]")
    .forEach(
      (b) => (b.onclick = () => action(b.dataset.fxAction as EffectAction)),
    );
}
