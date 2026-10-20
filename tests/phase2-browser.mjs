import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.BROWSER_PATH ||
    (process.platform === "win32"
      ? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
      : existsSync("/usr/bin/chromium")
        ? "/usr/bin/chromium"
        : undefined),
});
const base = process.env.TEST_URL || "http://127.0.0.1:5173/photomosaic-vj/";
const reportDir = process.env.REPORT_DIR || "test-results/phase2";
await mkdir(reportDir, { recursive: true });
const results = [],
  errors = [],
  performanceResults = [];
const pass = (name) => {
  results.push(name);
  console.log("PASS", name);
};
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(new URL("controller.html", base).href);
  await page.waitForSelector("#preview");
  await page.evaluate(() =>
    document
      .querySelectorAll("[data-deck] details")
      .forEach((d) => (d.open = true)),
  );
  const field = (deck, effect, param) =>
    page.locator(
      `[data-deck=${deck}] [data-fx="${effect}"][data-param="${param}"]`,
    );
  const set = async (deck, effect, param, value) => {
    const f = field(deck, effect, param);
    if (typeof value === "boolean") await f.setChecked(value);
    else if (await f.evaluate((el) => el.tagName === "SELECT"))
      await f.selectOption(String(value));
    else {
      await f.fill(String(value));
      await f.dispatchEvent("input");
    }
  };
  const hash = () =>
    page.locator("#preview").evaluate((c) => {
      const p = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let hash = 2166136261;
      for (let i = 0; i < p.length; i += 16)
        hash = Math.imul(
          hash ^ p[i] ^ (p[i + 1] << 8) ^ (p[i + 2] << 16),
          16777619,
        );
      return hash >>> 0;
    });
  const action = async (deck, name) =>
    page.locator(`[data-deck=${deck}] [data-fx-action=${name}]`).click();
  const wait = (ms) => page.waitForTimeout(ms);
  const fixtures = await page.evaluate(() =>
    Array.from({ length: 12 }, (_, i) => {
      const c = document.createElement("canvas");
      c.width = 128;
      c.height = 96;
      const x = c.getContext("2d");
      x.fillStyle = `hsl(${i * 30},65%,40%)`;
      x.fillRect(0, 0, 128, 96);
      x.fillStyle = "#fff";
      x.font = "bold 28px sans-serif";
      x.fillText(`PHOTO ${i}`, 0, 48);
      return c.toDataURL("image/jpeg").split(",")[1];
    }),
  );
  const file = (i) => ({
    name: `photo-${i}.jpg`,
    mimeType: "image/jpeg",
    buffer: Buffer.from(fixtures[i % 12], "base64"),
  });
  await page
    .locator("#files")
    .setInputFiles(Array.from({ length: 100 }, (_, i) => file(i)));
  await page.waitForFunction(
    () =>
      document
        .querySelector("#import-status")
        .textContent.includes("完了 100枚"),
    {},
    { timeout: 60000 },
  );
  await page.locator("[data-mode=a]").click();
  await page.locator("[data-deck=A] textarea").fill("風");
  await wait(150);
  const baseline = await hash();
  for (const effect of ["pulse", "wave", "float", "glitch", "rgbShift"]) {
    await set("A", effect, "enabled", true);
    await wait(137);
    const first = await hash();
    await wait(193);
    const second = await hash();
    assert.notEqual(first, baseline, `${effect} changes actual canvas`);
    assert.notEqual(second, first, `${effect} animates`);
    await set("A", effect, "enabled", false);
    await wait(80);
    assert.equal(
      await hash(),
      baseline,
      `${effect} OFF restores exact baseline`,
    );
    pass(`${effect} ON/OFF: animated canvas and exact OFF restoration`);
  }
  for (const direction of ["horizontal", "vertical", "diagonal", "radial"]) {
    await set("A", "wave", "direction", direction);
    await set("A", "wave", "enabled", true);
    await wait(80);
    assert.notEqual(await hash(), baseline);
  }
  await set("A", "wave", "enabled", false);
  pass("four PHOTO WAVE directions render");
  await set("B", "float", "enabled", true);
  await wait(100);
  assert.equal(await hash(), baseline);
  pass("Deck B effects do not alter Deck A");
  await page.locator("[data-mode=b]").click();
  const bFirst = await hash();
  await wait(200);
  assert.notEqual(await hash(), bFirst);
  pass("Deck B independently animates");
  await set("B", "float", "enabled", false);
  await page.locator("[data-mode=a]").click();
  await set("A", "float", "enabled", true);
  await set("A", "wave", "enabled", true);
  await set("A", "pulse", "enabled", true);
  await set("A", "pulse", "beatDivision", 1);
  const combo = await hash();
  await wait(200);
  assert.notEqual(await hash(), combo);
  pass("FLOAT + WAVE + BPM-synced PULSE composite");
  const measure = async (name) => {
    await page.locator("header").click();
    const timing = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const samples = [];
          let previous = performance.now(),
            start = previous;
          const frame = (now) => {
            samples.push(now - previous);
            previous = now;
            if (now - start < 3000) requestAnimationFrame(frame);
            else {
              samples.sort((a, b) => a - b);
              resolve({
                fps: (samples.length * 1000) / (now - start),
                p95FrameMs: samples[Math.floor(samples.length * 0.95)],
                frames: samples.length,
              });
            }
          };
          requestAnimationFrame(frame);
        }),
    );
    performanceResults.push({ name, ...timing });
    console.log("PERFORMANCE", name, JSON.stringify(timing));
    assert.ok(timing.frames >= 15, "animation continues during load");
  };
  await measure("100 photos / 1296 tiles / FLOAT + WAVE + synced PULSE");
  pass("100-photo live effects run without runtime errors");
  for (const effect of ["float", "wave", "pulse"])
    await set("A", effect, "enabled", false);
  await set("A", "wind", "enabled", true);
  await wait(250);
  const windy = await hash();
  assert.notEqual(windy, baseline);
  await wait(250);
  assert.notEqual(await hash(), windy);
  pass("WIND moves rendered photo tiles");
  await set("A", "wind", "enabled", false);
  await wait(80);
  assert.notEqual(await hash(), baseline);
  pass("WIND OFF preserves displaced positions and inertia");
  await action("A", "gust");
  await wait(100);
  const gust = await hash();
  await wait(150);
  assert.notEqual(await hash(), gust);
  pass("GUST visibly accelerates photo motion");
  for (const mode of ["direct", "spring", "swirl"]) {
    await set("A", "assemble", "mode", mode);
    await set("A", "assemble", "duration", 0);
    await set("A", "assemble", "seconds", 0.6);
    await action("A", "explosion");
    await wait(150);
    const scattered = await hash();
    assert.notEqual(scattered, baseline);
    await action("A", "assemble");
    await wait(80);
    assert.notEqual(
      await hash(),
      baseline,
      `${mode} is not an instantaneous reset`,
    );
    await wait(800);
    assert.equal(await hash(), baseline, `${mode} returns to exact mosaic`);
    pass(`EXPLOSION → ${mode.toUpperCase()} ASSEMBLE returns continuously`);
  }
  // Pointer origin temporarily owns preview clicks; returning to CENTER restores split drag.
  await set("A", "explosion", "origin", "pointer");
  await page.locator("#fx-target").selectOption("0");
  await page.locator("#preview").click({ position: { x: 80, y: 80 } });
  await wait(180);
  assert.notEqual(await hash(), baseline);
  await set("A", "explosion", "origin", "center");
  await action("A", "assemble");
  await wait(800);
  assert.equal(await hash(), baseline);
  pass("pointer-origin explosion");
  await page.locator("[data-deck=A] textarea").focus();
  await page.keyboard.press("e");
  await page.keyboard.press("r");
  await page.keyboard.press("g");
  assert.match(
    await page.locator("[data-deck=A] textarea").inputValue(),
    /erg$/,
  );
  await page.locator("[data-deck=A] textarea").fill("風");
  await wait(100);
  assert.equal(await hash(), baseline);
  pass("typing E/R/G does not trigger effect shortcuts");
  await page.locator("#fx-target").selectOption("0");
  await page.locator("header").click();
  await page.keyboard.press("e");
  await wait(150);
  assert.notEqual(await hash(), baseline);
  await page.locator("header").click();
  await page.keyboard.press("r");
  await wait(800);
  assert.equal(await hash(), baseline);
  await page.locator("header").click();
  await page.keyboard.press("g");
  await wait(180);
  assert.notEqual(await hash(), baseline);
  await action("A", "assemble");
  await wait(800);
  pass("E / R / G shortcuts operate selected deck");
  // The existing clock, including its PAUSE and reset semantics, drives effects.
  await set("A", "pulse", "enabled", true);
  await set("A", "pulse", "beatDivision", 1);
  await page.locator("#run").click();
  await page.locator("#bar-reset").click();
  await wait(100);
  const resetPhase = await hash();
  await wait(150);
  assert.equal(await hash(), resetPhase);
  await page.locator("#bpm").fill("180");
  await page.locator("#bpm").dispatchEvent("change");
  await page.locator("header").click();
  await page.keyboard.press("Enter");
  await wait(80);
  assert.equal(Number(await page.locator("#bpm").inputValue()), 180);
  assert.equal(await hash(), resetPhase);
  await page.locator("#run").click();
  await wait(100);
  assert.notEqual(await hash(), resetPhase);
  await set("A", "pulse", "enabled", false);
  await page.locator("#bpm").fill("120");
  await page.locator("#bpm").dispatchEvent("change");
  pass("BPM SYNC follows Transport PAUSE, tempo change and PHASE RESET");
  // Complete the requested live sequence on A, then independently on B.
  for (const deck of ["A", "B"]) {
    await page.locator(`[data-mode=${deck.toLowerCase()}]`).click();
    await page.locator(`[data-deck=${deck}] textarea`).fill("風");
    await set(deck, "float", "enabled", true);
    await set(deck, "wave", "enabled", true);
    await set(deck, "pulse", "enabled", true);
    await set(deck, "pulse", "beatDivision", 1);
    await action(deck, "gust");
    await set(deck, "wind", "enabled", true);
    await wait(150);
    await action(deck, "explosion");
    await wait(150);
    await set(deck, "assemble", "mode", "swirl");
    await set(deck, "assemble", "duration", 4);
    await action(deck, "assemble");
    await wait(300);
    assert.equal(await field(deck, "wind", "enabled").isChecked(), false);
    await page.waitForFunction(
      (d) =>
        document.querySelector(`[data-deck=${d}] [data-fx-state]`)
          .textContent !== "ASSEMBLING",
      deck,
      { timeout: 7000 },
    );
    for (const effect of ["float", "wave", "pulse"])
      await set(deck, effect, "enabled", false);
    await wait(100);
    if (deck === "A") assert.equal(await hash(), baseline);
    pass(
      `Deck ${deck} demo: FLOAT → WAVE → synced PULSE → GUST → WIND → EXPLOSION → SWIRL / 4 beats`,
    );
  }
  await page.locator("[data-mode=a]").click();
  await set("A", "wave", "enabled", true);
  await set("A", "rgbShift", "enabled", true);
  await wait(100);
  await page.locator("#freeze").click();
  const frozen = await hash();
  await wait(300);
  assert.equal(await hash(), frozen);
  await page.locator("#freeze").click();
  await wait(100);
  assert.notEqual(await hash(), frozen);
  pass("FREEZE holds complete effect composite");
  const output = await context.newPage();
  output.on("pageerror", (e) => errors.push(String(e)));
  await output.goto(new URL("screen.html", base).href);
  const outputHash = () =>
    output.locator("canvas").evaluate((c) => {
      const p = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let hash = 0;
      for (let i = 0; i < p.length; i += 64)
        hash = (Math.imul(hash, 31) + p[i] + p[i + 1] + p[i + 2]) | 0;
      return hash;
    });
  await output.waitForFunction(() => {
    const c = document.querySelector("canvas");
    return (
      c.width === 1280 &&
      c.getContext("2d").getImageData(640, 360, 1, 1).data[3] === 255
    );
  });
  await page.bringToFront();
  const out1 = await outputHash();
  await output.waitForFunction(
    (previous) => {
      const c = document.querySelector("canvas"),
        p = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let hash = 0;
      for (let i = 0; i < p.length; i += 64)
        hash = (Math.imul(hash, 31) + p[i] + p[i + 1] + p[i + 2]) | 0;
      return hash !== previous;
    },
    out1,
    { timeout: 5000 },
  );
  pass("OUTPUT receives animated effects");
  // Freeze controller and compare decoded JPEG output with the same composed frame.
  await page.locator("#freeze").click();
  await wait(500);
  const preview = await page.locator("#preview").evaluate((c) => {
    const data = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    const samples = [];
    for (let i = 0; i < data.length; i += 256)
      samples.push(data[i], data[i + 1], data[i + 2]);
    return samples;
  });
  const difference = await output.locator("canvas").evaluate((c, p) => {
    const o = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let error = 0,
      n = 0;
    for (let i = 0; i < o.length; i += 256) {
      for (let k = 0; k < 3; k++) {
        error += Math.abs(o[i + k] - p[n]);
        n++;
      }
    }
    return error / n;
  }, preview);
  assert.ok(difference < 20, `JPEG mean channel error ${difference}`);
  pass("Controller/Output same frozen FX frame (JPEG tolerance)");
  await page.locator("#freeze").click();
  await output.close();
  await page.bringToFront();
  await set("A", "wave", "enabled", false);
  await set("A", "rgbShift", "enabled", false);
  await page
    .locator("#files")
    .setInputFiles(Array.from({ length: 900 }, (_, i) => file(100 + i)));
  await page.waitForFunction(
    () =>
      document.querySelector("#photo-count").textContent.startsWith("1000 /"),
    {},
    { timeout: 120000 },
  );
  for (const effect of ["float", "wave", "pulse"])
    await set("A", effect, "enabled", true);
  await measure("1000 photos / 1296 tiles / FLOAT + WAVE + PULSE");
  await set("A", "glitch", "enabled", true);
  await set("A", "rgbShift", "enabled", true);
  await measure(
    "1000 photos / 1296 tiles / FLOAT + WAVE + PULSE + GLITCH + RGB SHIFT",
  );
  await action("A", "explosion");
  await wait(200);
  await action("A", "assemble");
  await wait(2600);
  pass("1000-photo effect stress run and assembly");
  await page.screenshot({
    path: `${reportDir}/controller-phase2.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  pass("expanded FX UI fits 390px mobile width");
  assert.deepEqual(errors, []);
  pass("no browser runtime exceptions");
  await writeFile(
    `${reportDir}/results.json`,
    JSON.stringify(
      {
        browser: browser.version(),
        base,
        results,
        errors,
        performanceResults,
        outputMeanChannelError: difference,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
