import { physicsPanel, physicsPerformance, bindPhysics } from "./physics-ui";
import { PhysicsActions } from "./physics-actions";
import type { PhysicsAction, Vec3 } from "./physics-config";
import { effectsPanel, bindEffects, type EffectAction } from "./effects-ui";
import "./style.css";
import { Transport } from "./transport";
import { allPhotos, savePhoto, clearPhotos } from "./database";
import { Renderer } from "./renderer";
import { defaultDeck, type Photo, type Mixer } from "./types";
const app = document.querySelector<HTMLDivElement>("#app")!;
const deckPanel = (id: string) =>
  `<section class="panel deck" data-deck="${id}"><div class="section-title"><span class="deck-badge">${id}</span><h2>PHOTO MOSAIC</h2><span class="tag">CONTENT 01</span></div><label>ターゲット<select data-key="target"><option value="text">TEXT / 文字</option><option value="image">IMAGE / 画像</option></select></label><textarea data-key="text" rows="2">${id === "A" ? "PHOTO\nVJ" : "MAKE\nMEMORIES"}</textarea><label class="file-button">ターゲット画像<input type="file" accept="image/*" data-image></label>${physicsPerformance()}<details><summary>文字・カラー</summary><label>フォント<select data-key="font"><option value="sans-serif">Sans serif</option><option value="serif">Serif</option><option value="monospace">Monospace</option></select></label><label>文字サイズ<input data-key="fontSize" type="range" min="40" max="400" value="210"></label><label>太字<input data-key="bold" type="checkbox" checked></label><label>配置<select data-key="align"><option>center</option><option>left</option><option>right</option></select></label><label>行間<input data-key="lineHeight" type="range" min=".7" max="2" step=".05" value="1.1"></label><label>文字色<input type="color" data-key="color" value="#f5eee0"></label><label>背景<input type="color" data-key="background" value="#11131a"></label></details><label>カラーマッチ<select data-key="mode"><option value="balanced">BALANCED</option><option value="original">ORIGINAL</option><option value="precise">PRECISE</option></select></label><label>色補正<input data-key="correction" type="range" min="0" max="1" step=".01" value=".48"></label><label>タイル列数 <output data-columns>48</output><input data-key="columns" type="range" min="12" max="100" value="48"></label><details><summary>タイル・動き</summary><label>間隔<input data-key="gap" type="range" min="0" max="8" value="1"></label><label>ランダム性<input data-key="randomness" type="range" min="0" max="1" step=".01" value=".08"></label><label>写真の重複<input data-key="repeat" type="checkbox" checked></label><label>ズーム<input data-key="zoom" type="range" min=".5" max="3" step=".01" value="1"></label><label>回転<input data-key="rotation" type="range" min="-180" max="180" value="0"></label><label>飛散<input data-key="scatter" type="range" min="0" max="2" step=".01" value="0"></label><button data-assemble>再集合</button></details>${effectsPanel()}${physicsPanel()}<p class="muted">AI PROMPT：未接続 · TEXT + IMAGE</p></section>`;
app.innerHTML = `<header><a class="brand" href="./controller.html">PHOTO<span>VJ</span> STUDIO<small>YOUR MEMORIES. LIVE IN MOTION.</small></a><div class="header-actions"><span class="status">● LOCAL / MANUAL</span><button id="open-output">↗ OUTPUT WINDOW</button><button id="fullscreen">⛶ FULLSCREEN</button></div></header><main><div class="stage-layout"><section class="stage"><div class="stage-heading"><span><i></i> PROGRAM OUTPUT</span><span id="resolution">1280 × 720</span></div><canvas id="preview" width="1280" height="720"></canvas><div class="stage-footer"><span id="visual-status">TEXT PREVIEW · 写真を読み込んでスタート</span><span id="fps">— FPS</span></div></section><section class="panel transport"><div class="section-title"><h2>AUDIO SYNC</h2><span class="tag">MANUAL</span></div><div class="bpm-line"><input id="bpm" aria-label="BPM" type="number" min="30" max="240" step=".1" value="120"><span>BPM</span></div><div class="beat-dots">${[1, 2, 3, 4].map((n) => `<b>${n}</b>`).join("")}</div><progress id="phase" max="1" value="0"></progress><div class="readouts"><span id="bar">BAR 1</span><span id="offset">+0 ms</span></div><button class="primary tap" id="tap">TAP <kbd>SPACE</kbd></button><div class="button-row"><button id="phase-reset">PHASE RESET ↵</button><button id="bar-reset">BAR RESET ⇧↵</button></div><div class="button-row"><button id="lock">LOCK OFF</button><button id="run">PAUSE</button><button id="tap-reset">TAP RESET</button></div><details><summary>BPM微調整・位相NUDGE</summary><div class="button-row">${[-5, -1, -0.1, 0.1, 1, 5].map((n) => `<button data-bpm="${n}">${n > 0 ? "+" : ""}${n}</button>`).join("")}<button data-factor="2">×2</button><button data-factor=".5">÷2</button></div><p>位相を前進 (+) / 後退 (−)</p><div class="button-row">${[-50, -25, -10, -5, 5, 10, 25, 50].map((n) => `<button data-nudge="${n}">${n > 0 ? "+" : ""}${n}ms</button>`).join("")}<button id="offset-reset">OFFSET RESET</button></div></details><p class="muted">AUDIO INPUT: OFF · 音声なしで同期できます</p></section></div><div class="workspace">${deckPanel("A")}<section class="panel mixer"><div class="section-title"><h2>DUAL-DECK MIXER</h2><span class="tag">LIVE</span></div><div class="mode-grid">${["split", "overlay", "crossfade", "a", "b"].map((m, i) => `<button data-mode="${m}" class="${i === 0 ? "selected" : ""}">${m === "a" ? "A ONLY" : m === "b" ? "B ONLY" : m.toUpperCase()}</button>`).join("")}</div><div class="fader-label"><span>DECK A</span><span>DECK B</span></div><input id="mix" aria-label="Split or crossfade" type="range" min="0" max="1" step=".001" value=".5"><div id="mix-readout" class="center muted">50 / 50</div><label>OVERLAY 不透明度<input id="opacity" type="range" min="0" max="1" step=".01" value=".5"></label><label>SPLIT方向<select id="axis"><option value="horizontal">左右</option><option value="vertical">上下</option></select></label><label>ブレンド<select id="blend"><option value="source-over">NORMAL</option><option value="lighter">ADD</option><option value="screen">SCREEN</option><option value="multiply">MULTIPLY</option><option value="difference">DIFFERENCE</option></select></label><div class="button-row"><button id="swap">⇄ SWAP</button><button id="freeze">❚❚ FREEZE</button></div><details><summary>出力品質</summary><label>解像度<select id="quality"><option value="960">960 × 540</option><option selected value="1280">1280 × 720</option><option value="1920">1920 × 1080</option></select></label></details><label>FX SHORTCUT DECK<select id="fx-target" aria-label="FX shortcut deck"><option value="0">DECK A</option><option value="1">DECK B</option></select></label><p class="muted">E EXPLOSION · R ASSEMBLE · G GUST<br>H GATHER · C CRUMPLE · T THROW · B BOUNCE · U RELEASE</p><p class="muted">← → 分割位置 · ↑ ↓ 透明度<br>プレビューをドラッグして境界を操作</p></section>${deckPanel("B")}</div><section class="panel library"><div class="section-title"><h2>PHOTO DATABASE</h2><span id="photo-count" class="tag">0 PHOTOS</span><div class="library-actions"><label class="file-button">＋ 写真を追加<input id="files" type="file" accept="image/jpeg,image/png,image/webp" multiple></label><label class="file-button">フォルダ<input id="folder" type="file" webkitdirectory multiple></label><button id="metadata">JSON解析データ</button><button id="clear">全削除</button></div></div><div class="import-status"><progress id="import-progress" value="0" max="1"></progress><span id="import-status">ブラウザ内で処理・保存。写真を外部に送信しません。</span><button id="cancel" hidden>キャンセル</button></div><div id="photos" class="photos"></div><button id="more" hidden>さらに表示</button><p class="muted">写真をクリックして除外／再追加 · キャッシュはこのブラウザに保存 · 顔解析はPhase 5で追加</p></section><footer>PHOTO VJ STUDIO <span>PHASE 03 / PHOTO PHYSICS</span><span>Space TAP · Enter PHASE · Shift+Enter BAR</span></footer><div id="notice" role="status"></div></main>`;
const $ = <T extends HTMLElement = HTMLElement>(s: string) =>
  document.querySelector<T>(s)!;
const clock = new Transport(),
  decks = [defaultDeck("PHOTO\nVJ"), defaultDeck("MAKE\nMEMORIES")],
  mix: Mixer = {
    mode: "split",
    amount: 0.5,
    opacity: 0.5,
    axis: "horizontal",
    blend: "source-over",
    swap: false,
    freeze: false,
  };
const canvas = $<HTMLCanvasElement>("#preview"),
  renderer = new Renderer(canvas);
let photos: Photo[] = [],
  cancel = false,
  importing = false,
  limit = 100;
const urls: string[] = [];
const physicsQueues = [new PhysicsActions(), new PhysicsActions()];
const physicsTargets = [
  { x: 640, y: 360 },
  { x: 640, y: 360 },
];
const pointerGather = [false, false];
let draggingBall = -1;
const deckPanels = Array.from(
  document.querySelectorAll<HTMLElement>("[data-deck]"),
);
function syncPhysicsPanel(i: number) {
  const panel = deckPanels[i],
    config = decks[i].physics,
    p = renderer.physics[i];
  panel
    .querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-physics]")
    .forEach((input) => {
      const parts = input.dataset.physics!.split(".");
      let value: unknown = config;
      for (const part of parts)
        value = (value as Record<string, unknown>)[part];
      if (input instanceof HTMLInputElement && input.type === "checkbox")
        input.checked = Boolean(value);
      else if (document.activeElement !== input) input.value = String(value);
    });
  panel.querySelector<HTMLSelectElement>("[data-physics-return]")!.value =
    decks[i].effects.assemble.mode;
  panel.querySelectorAll('[data-physics-action="bounce"]').forEach((button) => {
    button.textContent = `BOUNCE ${config.ball.bounce ? "ON" : "OFF"} · B`;
    button.classList.toggle("selected", config.ball.bounce);
    button.setAttribute("aria-pressed", String(config.ball.bounce));
  });
  panel.querySelector("[data-physics-state]")!.textContent = p.state;
  panel.querySelector("[data-physics-status]")!.textContent = physicsQueues[i]
    .pending.length
    ? `${physicsQueues[i].pending.length} ACTION(S) QUEUED`
    : pointerGather[i]
      ? "CLICK PREVIEW TO GATHER"
      : `${config.mode.toUpperCase()} · ${["HIGH", "MEDIUM", "LOW"][p.qualityLevel]}`;
}
function executePhysics(i: number, action: PhysicsAction, target?: Vec3) {
  const d = decks[i],
    p = ["reset", "throw", "release", "bounce"].includes(action)
      ? renderer.preparePhysics(i, d)
      : renderer.activatePhysics(i, d);
  if (action === "reset") {
    p.reset();
    renderer.effects[i].resetMotion();
    physicsQueues[i].clear();
    pointerGather[i] = false;
    d.scatter = 0;
    d.effects.wind.enabled = false;
  }
  if (action === "gather") {
    if (!target && d.physics.gather.target === "pointer") {
      pointerGather[i] = true;
      syncPhysicsPanel(i);
      return;
    }
    p.gather(target || { x: canvas.width / 2, y: canvas.height / 2 });
    d.effects.wind.enabled = false;
  }
  if (action === "crumple") {
    p.crumple(d.physics.crumple.amount, clock.beatDuration / 1000);
    d.effects.wind.enabled = false;
  }
  if (action === "throw") {
    const angle = (d.physics.ball.angle * Math.PI) / 180;
    if (
      !p.throwBall({
        x: Math.cos(angle) * d.physics.ball.power,
        y: Math.sin(angle) * d.physics.ball.power,
      })
    )
      notice("先にGATHER → CRUMPLEでPHOTO BALLを作ってください");
    else p.spinBall(d.physics.ball.spin);
  }
  if (action === "release" && !p.releasePhotos())
    notice("RELEASEするPHOTO BALLがありません");
  if (action === "bounce") d.physics.ball.bounce = !d.physics.ball.bounce;
  if (action === "gust") p.gust();
  if (action === "assemble") {
    p.assemble(d.effects.assemble.mode, clock.beatDuration / 1000);
    d.effects.wind.enabled = false;
    pointerGather[i] = false;
  }
  deckPanels[i].querySelector<HTMLInputElement>('[data-key="scatter"]')!.value =
    String(d.scatter);
  deckPanels[i].querySelector<HTMLInputElement>(
    '[data-fx="wind"][data-param="enabled"]',
  )!.checked = d.effects.wind.enabled;
  syncPhysicsPanel(i);
}
function physicsAction(i: number, action: PhysicsAction, target?: Vec3) {
  if (target) physicsTargets[i] = { x: target.x, y: target.y };
  if (action === "assemble" && !renderer.physics[i].active) {
    effectAction(i, "assemble");
    return;
  }
  if (
    physicsQueues[i].schedule(
      action,
      decks[i].physics.timing,
      clock.beat(),
      clock.state.beatsPerBar,
    )
  )
    executePhysics(i, action, target);
  syncPhysicsPanel(i);
}
// Public input adapter: future gestures and current UI use the same engine methods.
const photoVJ = {
  gather: (i: number, target: Vec3) => physicsAction(i, "gather", target),
  crumple: (i: number, amount = 1) => {
    decks[i].physics.crumple.amount = amount;
    physicsAction(i, "crumple");
  },
  holdBall: (i: number, position: Vec3) =>
    renderer.physics[i].holdBall(position, performance.now()),
  releaseBall: (i: number) => renderer.physics[i].releaseBall(),
  spinBall: (i: number, velocity: number) =>
    renderer.physics[i].spinBall(velocity),
  throwBall: (i: number, velocity: Vec3) =>
    renderer.physics[i].throwBall(velocity),
  applyWind: (i: number, vector: Vec3) =>
    renderer.activatePhysics(i, decks[i]).applyWind(vector),
  releasePhotos: (i: number, fraction = 1) =>
    renderer.physics[i].releasePhotos(fraction),
  assemble: (i: number) => physicsAction(i, "assemble"),
  reset: (i: number) => physicsAction(i, "reset"),
  snapshot: (i: number, includeSheets = true) => {
    const p = renderer.physics[i];
    return {
      state: p.state,
      active: p.active,
      count: p.count,
      ball: { ...p.ball, bounce: p.config.ball.bounce },
      camera: { ...p.camera },
      positions: includeSheets ? Array.from(p.position) : undefined,
      velocities: includeSheets ? Array.from(p.velocity) : undefined,
      bends: includeSheets ? Array.from(p.bend) : undefined,
      rotations: includeSheets ? Array.from(p.rotation) : undefined,
      quality: p.qualityLevel,
      pending: physicsQueues[i].pending.map((a) => ({ ...a })),
    };
  },
};
export type ControllerPhysicsAPI = typeof photoVJ;
declare global {
  interface Window {
    photoVJ: ControllerPhysicsAPI;
  }
}
window.photoVJ = photoVJ;
const notice = (text: string) => {
  $("#notice").textContent = text;
  setTimeout(() => ($("#notice").textContent = ""), 6000);
};
function updateClock() {
  const s = clock.snapshot();
  if (document.activeElement !== $("#bpm"))
    $<HTMLInputElement>("#bpm").value = clock.state.bpm.toFixed(1);
  $<HTMLProgressElement>("#phase").value = s.phase;
  document
    .querySelectorAll(".beat-dots b")
    .forEach((el, i) => el.classList.toggle("active", i === s.beatInBar));
  $("#bar").textContent = `BAR ${s.barIndex + 1}`;
  $("#offset").textContent =
    `${clock.state.phaseOffset >= 0 ? "+" : ""}${clock.state.phaseOffset} ms`;
}
$("#tap").onclick = () => clock.tap();
function resetClock(bar = false) {
  clock.reset(bar);
  renderer.effects.forEach((effect) => effect.rebase(clock.beat()));
  renderer.physics.forEach((p) => p.rebase(clock.beat()));
  physicsQueues.forEach((q) => q.rebase(clock.beat()));
}
$("#phase-reset").onclick = () => resetClock();
$("#bar-reset").onclick = () => resetClock(true);
$("#tap-reset").onclick = () => {
  clock.taps = [];
  notice("TAP系列をリセットしました");
};
$("#lock").onclick = () => {
  clock.state.isLocked = !clock.state.isLocked;
  $("#lock").textContent = clock.state.isLocked ? "LOCK ON" : "LOCK OFF";
  $("#lock").classList.toggle("selected", clock.state.isLocked);
};
$("#run").onclick = () => {
  clock.toggle();
  $("#run").textContent = clock.state.isRunning ? "PAUSE" : "PLAY";
};
$<HTMLInputElement>("#bpm").onchange = (e) =>
  clock.setBpm(Number((e.target as HTMLInputElement).value));
document
  .querySelectorAll<HTMLElement>("[data-bpm]")
  .forEach(
    (b) =>
      (b.onclick = () => clock.setBpm(clock.state.bpm + Number(b.dataset.bpm))),
  );
document
  .querySelectorAll<HTMLElement>("[data-factor]")
  .forEach(
    (b) =>
      (b.onclick = () =>
        clock.setBpm(clock.state.bpm * Number(b.dataset.factor))),
  );
document
  .querySelectorAll<HTMLElement>("[data-nudge]")
  .forEach((b) => (b.onclick = () => clock.nudge(Number(b.dataset.nudge))));
$("#offset-reset").onclick = () => {
  clock.state.phaseOffset = 0;
};
function effectAction(
  i: number,
  action: EffectAction,
  origin = { x: 0.5, y: 0.5 },
) {
  const d = decks[i],
    effect = renderer.effects[i];
  if (renderer.physics[i].active && action === "assemble") {
    physicsAction(i, "assemble");
    return;
  }
  if (renderer.physics[i].active && action === "gust") {
    executePhysics(i, "gust");
    return;
  }
  if (renderer.physics[i].active && action === "explosion") {
    renderer.physics[i].explode(
      { x: origin.x * canvas.width, y: origin.y * canvas.height },
      d.effects.explosion.power,
      d.effects.explosion.rotation,
    );
    return;
  }
  effect.configure(canvas.width, canvas.height, d.columns);
  // Actions also work while FREEZE is holding the visible output.
  effect.config = d.effects;
  if (action === "gust") effect.gust();
  if (action === "explosion") {
    if (d.effects.explosion.origin === "random")
      origin = { x: Math.random(), y: Math.random() };
    effect.explode(
      origin,
      d.effects.explosion.power,
      d.effects.explosion.rotation,
    );
  }
  if (action === "assemble") {
    effect.assemble(d.scatter, clock.beatDuration / 1000);
    d.scatter = 0;
    d.effects.wind.enabled = false;
    const panel = document.querySelectorAll<HTMLElement>("[data-deck]")[i];
    panel.querySelector<HTMLInputElement>('[data-key="scatter"]')!.value = "0";
    panel.querySelector<HTMLInputElement>(
      '[data-fx="wind"][data-param="enabled"]',
    )!.checked = false;
  }
}
document.querySelectorAll<HTMLElement>("[data-deck]").forEach((panel, i) => {
  bindEffects(panel, decks[i].effects, (action) => effectAction(i, action));
  panel.querySelector<HTMLSelectElement>("[data-physics-return]")!.oninput = (
    e,
  ) => {
    decks[i].effects.assemble.mode = (e.target as HTMLSelectElement).value as
      "direct" | "spring" | "swirl";
    panel.querySelector<HTMLSelectElement>(
      '[data-fx="assemble"][data-param="mode"]',
    )!.value = decks[i].effects.assemble.mode;
  };
  bindPhysics(
    panel,
    decks[i].physics,
    (action) => physicsAction(i, action),
    (path) => {
      const d = decks[i];
      if (path === "mode") {
        if (d.physics.mode === "off") {
          if (renderer.physics[i].active) executePhysics(i, "assemble");
        } else {
          const p = renderer.activatePhysics(i, d);
          if (d.physics.mode === "memory") p.memoryField();
          else if (p.state === "FLOATING") p.setState("FREE");
        }
      }
      if (path === "wind.enabled" && d.physics.wind.enabled) {
        d.physics.windMode = "physics";
        renderer.activatePhysics(i, d).setState("WIND");
      }
      syncPhysicsPanel(i);
    },
  );
  panel.addEventListener("pointerdown", () => {
    $<HTMLSelectElement>("#fx-target").value = String(i);
  });
  panel
    .querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("[data-key]")
    .forEach(
      (input) =>
        (input.oninput = () => {
          const key = input.dataset.key!;
          const value =
            input instanceof HTMLInputElement && input.type === "checkbox"
              ? input.checked
              : input instanceof HTMLInputElement && input.type === "range"
                ? Number(input.value)
                : input.value;
          Object.assign(decks[i], { [key]: value });
          panel.querySelector("[data-columns]")!.textContent = String(
            decks[i].columns,
          );
        }),
    );
  panel.querySelector<HTMLInputElement>("[data-image]")!.onchange = async (
    e,
  ) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const image = new Image();
    try {
      image.src = url;
      await image.decode();
      if (decks[i].image) URL.revokeObjectURL(decks[i].image!.src);
      decks[i].image = image;
      decks[i].target = "image";
      panel.querySelector<HTMLSelectElement>('[data-key="target"]')!.value =
        "image";
    } catch {
      URL.revokeObjectURL(url);
      notice("画像を読み込めませんでした");
    }
  };
  panel.querySelector<HTMLButtonElement>("[data-assemble]")!.onclick = () => {
    effectAction(i, "assemble");
  };
});
function syncMixer() {
  $<HTMLInputElement>("#mix").value = String(mix.amount);
  $<HTMLInputElement>("#opacity").value = String(mix.opacity);
  $("#mix-readout").textContent =
    `${Math.round((1 - mix.amount) * 100)} / ${Math.round(mix.amount * 100)}`;
}
document.querySelectorAll<HTMLElement>("[data-mode]").forEach(
  (b) =>
    (b.onclick = () => {
      mix.mode = b.dataset.mode as Mixer["mode"];
      document
        .querySelectorAll("[data-mode]")
        .forEach((el) => el.classList.toggle("selected", el === b));
    }),
);
$<HTMLInputElement>("#mix").oninput = (e) => {
  mix.amount = Number((e.target as HTMLInputElement).value);
  syncMixer();
};
$<HTMLInputElement>("#opacity").oninput = (e) =>
  (mix.opacity = Number((e.target as HTMLInputElement).value));
$<HTMLSelectElement>("#axis").onchange = (e) =>
  (mix.axis = (e.target as HTMLSelectElement).value as Mixer["axis"]);
$<HTMLSelectElement>("#blend").onchange = (e) =>
  (mix.blend = (e.target as HTMLSelectElement).value as Mixer["blend"]);
$("#swap").onclick = () => {
  mix.swap = !mix.swap;
  $("#swap").classList.toggle("selected", mix.swap);
};
$("#freeze").onclick = () => {
  mix.freeze = !mix.freeze;
  $("#freeze").classList.toggle("selected", mix.freeze);
};
function pointerPosition(e: PointerEvent, i: number) {
  const r = canvas.getBoundingClientRect(),
    d = decks[i],
    angle = (-d.rotation * Math.PI) / 180;
  const x = (((e.clientX - r.left) / r.width - 0.5) * canvas.width) / d.zoom,
    y = (((e.clientY - r.top) / r.height - 0.5) * canvas.height) / d.zoom;
  return {
    x: x * Math.cos(angle) - y * Math.sin(angle) + canvas.width / 2,
    y: x * Math.sin(angle) + y * Math.cos(angle) + canvas.height / 2,
  };
}
canvas.onpointerdown = (e) => {
  const i = Number($<HTMLSelectElement>("#fx-target").value);
  const point = pointerPosition(e, i);
  if (pointerGather[i]) {
    pointerGather[i] = false;
    physicsAction(i, "gather", point);
    return;
  }
  const ballPoint = renderer.physics[i].unproject(
    point,
    renderer.physics[i].ball.z,
  );
  if (renderer.physics[i].hitBall(ballPoint)) {
    draggingBall = i;
    renderer.physics[i].holdBall(ballPoint, e.timeStamp);
    canvas.setPointerCapture(e.pointerId);
    return;
  }
  if (decks[i].effects.explosion.origin === "pointer") {
    const r = canvas.getBoundingClientRect();
    // Undo the deck view transform so the blast starts under the pointer.
    const d = decks[i],
      angle = (-d.rotation * Math.PI) / 180;
    const x = (((e.clientX - r.left) / r.width - 0.5) * canvas.width) / d.zoom;
    const y = (((e.clientY - r.top) / r.height - 0.5) * canvas.height) / d.zoom;
    effectAction(i, "explosion", {
      x: (x * Math.cos(angle) - y * Math.sin(angle)) / canvas.width + 0.5,
      y: (x * Math.sin(angle) + y * Math.cos(angle)) / canvas.height + 0.5,
    });
    return;
  }
  canvas.setPointerCapture(e.pointerId);
  move(e);
};
canvas.onpointermove = (e) => {
  if (draggingBall >= 0) {
    renderer.physics[draggingBall].holdBall(
      renderer.physics[draggingBall].unproject(
        pointerPosition(e, draggingBall),
        renderer.physics[draggingBall].ball.z,
      ),
      e.timeStamp,
    );
    return;
  }
  if (canvas.hasPointerCapture(e.pointerId)) move(e);
};
function releasePointer(e: PointerEvent) {
  if (draggingBall >= 0) {
    renderer.physics[draggingBall].releaseBall();
    draggingBall = -1;
  }
  if (canvas.hasPointerCapture(e.pointerId))
    canvas.releasePointerCapture(e.pointerId);
}
canvas.onpointerup = releasePointer;
canvas.onpointercancel = releasePointer;
function move(e: PointerEvent) {
  if (mix.mode !== "split") return;
  const r = canvas.getBoundingClientRect();
  mix.amount = Math.max(
    0,
    Math.min(
      1,
      mix.axis === "horizontal"
        ? (e.clientX - r.left) / r.width
        : (e.clientY - r.top) / r.height,
    ),
  );
  syncMixer();
}
$("#fullscreen").onclick = () =>
  canvas.requestFullscreen().catch((e) => notice(String(e)));
$("#open-output").onclick = () => {
  if (
    !window.open(
      "./screen.html",
      "photo-vj-output",
      "popup,width=1280,height=720",
    )
  )
    notice("ポップアップを許可して再度お試しください");
};
$<HTMLSelectElement>("#quality").onchange = (e) => {
  canvas.width = Number((e.target as HTMLSelectElement).value);
  canvas.height = (canvas.width * 9) / 16;
  $("#resolution").textContent = `${canvas.width} × ${canvas.height}`;
};
window.addEventListener("keydown", (e) => {
  if (
    e.repeat ||
    (e.target as HTMLElement).closest(
      'input,textarea,select,button,[contenteditable="true"]',
    )
  )
    return;
  if (
    [
      "Space",
      "Enter",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
    ].includes(e.code)
  )
    e.preventDefault();
  if (e.code === "Space") clock.tap();
  if (e.code === "Enter") resetClock(e.shiftKey);
  if (!e.ctrlKey && !e.metaKey && !e.altKey) {
    const physicsKey = (
      {
        KeyC: "crumple",
        KeyT: "throw",
        KeyB: "bounce",
        KeyH: "gather",
        KeyU: "release",
      } as const
    )[e.code as "KeyC" | "KeyT" | "KeyB" | "KeyH" | "KeyU"];
    if (physicsKey) {
      e.preventDefault();
      physicsAction(
        Number($<HTMLSelectElement>("#fx-target").value),
        physicsKey,
      );
    }
    const action = (
      { KeyE: "explosion", KeyR: "assemble", KeyG: "gust" } as const
    )[e.code as "KeyE" | "KeyR" | "KeyG"];
    if (action) {
      e.preventDefault();
      effectAction(Number($<HTMLSelectElement>("#fx-target").value), action);
    }
  }
  if (e.code === "ArrowLeft") mix.amount = Math.max(0, mix.amount - 0.01);
  if (e.code === "ArrowRight") mix.amount = Math.min(1, mix.amount + 0.01);
  if (e.code === "ArrowUp") mix.opacity = Math.min(1, mix.opacity + 0.01);
  if (e.code === "ArrowDown") mix.opacity = Math.max(0, mix.opacity - 0.01);
  syncMixer();
});
async function refresh() {
  await renderer.load(photos);
  drawLibrary();
}
function drawLibrary() {
  urls.forEach(URL.revokeObjectURL);
  urls.length = 0;
  $("#photos").replaceChildren();
  for (const p of photos.slice(0, limit)) {
    const b = document.createElement("button");
    b.className = "photo" + (p.excluded ? " excluded" : "");
    b.title = `${p.name} · ${p.width}×${p.height} · クリックで除外/再追加`;
    const img = new Image();
    const url = URL.createObjectURL(p.blob);
    urls.push(url);
    img.src = url;
    img.alt = p.name;
    img.loading = "lazy";
    b.append(img);
    b.onclick = async () => {
      p.excluded = !p.excluded;
      try {
        await savePhoto(p);
        await refresh();
      } catch (e) {
        notice(String(e));
      }
    };
    $("#photos").append(b);
  }
  $("#photo-count").textContent =
    `${photos.filter((p) => !p.excluded).length} / ${photos.length} PHOTOS`;
  $("#more").hidden = photos.length <= limit;
  $("#visual-status").textContent = photos.length
    ? "PHOTO MOSAIC · LOCAL LIBRARY"
    : "TEXT PREVIEW · 写真を読み込んでスタート";
}
$("#more").onclick = () => {
  limit += 100;
  drawLibrary();
};
$("#cancel").onclick = () => {
  cancel = true;
};
async function importFiles(files: FileList | null) {
  if (!files || importing) return;
  importing = true;
  cancel = false;
  $("#cancel").hidden = false;
  const worker = new Worker(new URL("./photo.worker.ts", import.meta.url), {
    type: "module",
  });
  let completed = 0,
    failed = 0;
  const list = Array.from(files).filter((f) =>
    /\.(jpe?g|png|webp)$/i.test(f.name),
  );
  $<HTMLProgressElement>("#import-progress").max = Math.max(1, list.length);
  try {
    for (const file of list) {
      if (cancel) break;
      try {
        const photo = await new Promise<Photo>((resolve, reject) => {
          worker.onmessage = (e) =>
            e.data.error ? reject(Error(e.data.error)) : resolve(e.data.photo);
          worker.onerror = (e) => reject(Error(e.message));
          worker.postMessage(file);
        });
        await savePhoto(photo);
        photos.push(photo);
      } catch {
        failed++;
      }
      completed++;
      $<HTMLProgressElement>("#import-progress").value = completed;
      $("#import-status").textContent =
        `${completed} / ${list.length} · エラー ${failed}`;
    }
    await refresh();
    $("#import-status").textContent =
      `${cancel ? "中断" : "完了"} ${completed - failed}枚保存 · エラー ${failed}`;
  } finally {
    worker.terminate();
    importing = false;
    $("#cancel").hidden = true;
  }
}
for (const id of ["#files", "#folder"])
  $<HTMLInputElement>(id).onchange = (e) => {
    const input = e.target as HTMLInputElement;
    void importFiles(input.files).catch((e) => notice(String(e)));
    input.value = "";
  };
$("#clear").onclick = async () => {
  if (importing) {
    notice("読み込み終了またはキャンセル後に削除してください");
    return;
  }
  if (!confirm("このブラウザに保存した写真をすべて削除しますか？")) return;
  try {
    await clearPhotos();
    photos = [];
    await refresh();
  } catch (e) {
    notice(String(e));
  }
};
$("#metadata").onclick = () => {
  const blob = new Blob(
    [
      JSON.stringify(
        photos.map(({ blob, ...p }) => p),
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "photo-vj-metadata.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const channel = new BroadcastChannel("photo-vj-output");
let outputSeen = 0,
  sendBusy = false,
  lastSend = 0;
channel.onmessage = () => {
  outputSeen = performance.now();
};
let previous = performance.now(),
  fpsStart = previous,
  frames = 0;
const effectStates = Array.from(
  document.querySelectorAll<HTMLElement>("[data-fx-state]"),
);
function frame(now: number) {
  const beat = clock.beat(now);
  if (!mix.freeze)
    physicsQueues.forEach((q, i) =>
      q.flush(beat, (action) =>
        executePhysics(
          i,
          action,
          action === "gather" ? physicsTargets[i] : undefined,
        ),
      ),
    );
  renderer.render(decks, mix, beat, now);
  deckPanels.forEach((panel, i) => {
    const p = renderer.physics[i],
      state = panel.querySelector("[data-physics-state]")!;
    if (state.textContent !== p.state) syncPhysicsPanel(i);
  });
  updateClock();
  effectStates.forEach((el, i) => {
    const state = renderer.effects[i].state;
    if (el.textContent !== state) el.textContent = state;
  });
  frames++;
  if (now - fpsStart > 1000) {
    $("#fps").textContent =
      `${Math.round((frames * 1000) / (now - fpsStart))} FPS`;
    fpsStart = now;
    frames = 0;
  }
  if (
    outputSeen &&
    now - outputSeen < 5000 &&
    !sendBusy &&
    now - lastSend > 1000 / 30
  ) {
    sendBusy = true;
    lastSend = now;
    canvas.toBlob(
      (blob) => {
        if (blob)
          channel.postMessage({
            type: "frame",
            blob,
            timestamp: performance.timeOrigin + now,
            transport: clock.state,
          });
        sendBusy = false;
      },
      "image/jpeg",
      0.88,
    );
  }
  previous = now;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
void allPhotos()
  .then(async (p) => {
    photos = p;
    await refresh();
  })
  .catch((e) => notice(`写真キャッシュを読み込めません: ${e}`));
