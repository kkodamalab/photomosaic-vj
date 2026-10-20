import { testUrl } from "./test-url.mjs";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.TEST_URL || "http://127.0.0.1:5173/photomosaic-vj/";
const reportDir = process.env.REPORT_DIR || "test-results/phase3";
await mkdir(reportDir, { recursive: true });
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
    }),
    page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(testUrl("controller.html", base));
  await page.waitForFunction(() => !!window.photoVJ);
  const wait = (ms) => page.waitForTimeout(ms),
    snapshot = (deck) =>
      page.evaluate((i) => window.photoVJ.snapshot(i), deck === "A" ? 0 : 1);
  const field = (deck, path) =>
    page.locator(`[data-deck=${deck}] [data-physics="${path}"]`);
  const reveal = (locator) =>
    locator.evaluate((el) => {
      let p = el.parentElement;
      while (p) {
        if (p.tagName === "DETAILS") p.open = true;
        p = p.parentElement;
      }
    });
  const set = async (deck, path, value) => {
    const f = field(deck, path);
    await reveal(f);
    if (typeof value === "boolean") await f.setChecked(value);
    else if (await f.evaluate((el) => el.tagName === "SELECT"))
      await f.selectOption(String(value));
    else {
      await f.fill(String(value));
      await f.dispatchEvent("input");
    }
  };
  const fx = async (deck, effect, param, value) => {
    const f = page.locator(
      `[data-deck=${deck}] [data-fx=${effect}][data-param=${param}]`,
    );
    await reveal(f);
    if (typeof value === "boolean") await f.setChecked(value);
    else await f.selectOption(String(value));
  };
  const action = async (deck, name) =>
    page.locator(`[data-deck=${deck}] [data-physics-action=${name}]`).click();
  const assembled = async (deck) =>
    page.waitForFunction(
      (i) => window.photoVJ.snapshot(i, false).state === "ASSEMBLED",
      deck === "A" ? 0 : 1,
      { timeout: 10000 },
    );
  const hash = () =>
    page.locator("#preview").evaluate((c) => {
      const p = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let h = 2166136261;
      for (let i = 0; i < p.length; i += 64)
        h = Math.imul(h ^ p[i] ^ (p[i + 1] << 8) ^ (p[i + 2] << 16), 16777619);
      return h >>> 0;
    });
  const fixtures = await page.evaluate(() =>
    Array.from({ length: 16 }, (_, i) => {
      const c = document.createElement("canvas");
      c.width = 160;
      c.height = 100;
      const x = c.getContext("2d");
      x.fillStyle = `hsl(${i * 22.5},65%,45%)`;
      x.fillRect(0, 0, 160, 100);
      x.fillStyle = "#fff";
      x.font = "bold 24px sans-serif";
      x.fillText(`MEMORY ${i}`, 5, 50);
      x.fillRect(0, 0, 15, 100);
      return c.toDataURL("image/jpeg").split(",")[1];
    }),
  );
  const file = (i) => ({
    name: `memory-${i}.jpg`,
    mimeType: "image/jpeg",
    buffer: Buffer.from(fixtures[i % fixtures.length], "base64"),
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
    { timeout: 120000 },
  );
  await page.locator("[data-mode=a]").click();
  await page.locator("[data-deck=A] textarea").fill("風");
  await wait(150);
  const baseline = await hash();
  assert.equal((await snapshot("A")).state, "ASSEMBLED");
  assert.equal((await snapshot("B")).active, false);
  pass(
    "Physics pool initializes with stable home positions; default OFF preserves mosaic",
  );
  const measure = async (name) => {
    await page.locator("header").click();
    const timing = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const samples = [];
          let start = performance.now(),
            prev = start;
          const frame = (now) => {
            samples.push(now - prev);
            prev = now;
            if (now - start < 3000) requestAnimationFrame(frame);
            else {
              samples.sort((a, b) => a - b);
              resolve({
                fps: (samples.length * 1000) / (now - start),
                p95FrameMs: samples[Math.floor(samples.length * 0.95)],
              });
            }
          };
          requestAnimationFrame(frame);
        }),
    );
    const quality = (await snapshot("A")).quality;
    performanceResults.push({ name, ...timing, quality });
    console.log("PERFORMANCE", name, JSON.stringify(timing));
    assert.ok(timing.fps > 5);
  };
  // DEMO A on both decks: same action APIs, independent state, actual frames and depth.
  for (const deck of ["A", "B"]) {
    await page.locator(`[data-mode=${deck.toLowerCase()}]`).click();
    await page.locator(`[data-deck=${deck}] textarea`).fill("風");
    await set(deck, "seconds", 0.6);
    await set(deck, "ball.gravity", 0);
    await fx(deck, "float", "enabled", true);
    await set(deck, "mode", "memory");
    const first = await snapshot(deck);
    await wait(700);
    const second = await snapshot(deck);
    assert.notDeepEqual(second.positions, first.positions);
    assert.ok(second.positions.some((v, i) => i % 3 === 2 && Math.abs(v) > 20));
    pass(`Deck ${deck} MEMORY FIELD unfolds actual sheet depth`);
    await set(deck, "memory.cameraAuto", true);
    const camera = (await snapshot(deck)).camera;
    const frame = await hash();
    await wait(400);
    assert.notDeepEqual((await snapshot(deck)).camera, camera);
    assert.notEqual(await hash(), frame);
    pass(`Deck ${deck} CAMERA AUTO changes projected frames`);
    if (deck === "A") {
      assert.equal((await snapshot("B")).active, false);
      await measure("100 photos / MEMORY FIELD + CAMERA AUTO + FLOAT");
    }
    await set(deck, "wind.enabled", true);
    await wait(200);
    let s = await snapshot(deck);
    assert.ok(s.velocities.some((v) => v !== 0));
    assert.ok(s.bends.some((v) => v !== 0));
    assert.ok(s.rotations.some((v) => v !== 0));
    await page
      .locator(`[data-deck=${deck}] [data-fx-action=gust]`)
      .evaluate((el) => {
        let p = el.parentElement;
        while (p) {
          if (p.tagName === "DETAILS") p.open = true;
          p = p.parentElement;
        }
      });
    await page.locator(`[data-deck=${deck}] [data-fx-action=gust]`).click();
    await wait(100);
    assert.equal((await snapshot(deck)).state, "WIND");
    pass(`Deck ${deck} WIND MEMORY + GUST moves/bends/rotates photo sheets`);
    await action(deck, "assemble");
    await assembled(deck);
    await fx(deck, "float", "enabled", false);
    await wait(100);
    if (deck === "A") assert.equal(await hash(), baseline);
    pass(
      `Deck ${deck} DEMO A: MEMORY → CAMERA → WIND → ASSEMBLE restores mosaic`,
    );
  }
  // DEMO B, ball drag and physical collisions on both decks.
  for (const deck of ["A", "B"]) {
    await page.locator(`[data-mode=${deck.toLowerCase()}]`).click();
    await set(deck, "seconds", 0.6);
    await set(deck, "ball.gravity", 0);
    await page
      .locator(`[data-deck=${deck}] [data-fx-action=explosion]`)
      .evaluate((el) => {
        let p = el.parentElement;
        while (p) {
          if (p.tagName === "DETAILS") p.open = true;
          p = p.parentElement;
        }
      });
    await page
      .locator(`[data-deck=${deck}] [data-fx-action=explosion]`)
      .click();
    await wait(180);
    assert.notEqual(await hash(), baseline);
    await action(deck, "gather");
    const positions = (await snapshot(deck)).positions;
    await wait(1600);
    let s = await snapshot(deck);
    assert.notDeepEqual(s.positions, positions);
    const distance =
      s.positions.reduce(
        (total, v, i) =>
          i % 3 === 0
            ? total + Math.hypot(v - 640, s.positions[i + 1] - 360)
            : total,
        0,
      ) / s.count;
    assert.ok(distance < 160, `cluster radius ${distance}`);
    pass(
      `Deck ${deck} EXPLOSION → GATHER forms a cluster without teleportation`,
    );
    await action(deck, "crumple");
    const crumpling = await hash();
    await wait(100);
    assert.notEqual(await hash(), crumpling);
    await page.waitForFunction(
      (i) => window.photoVJ.snapshot(i, false).ball.active,
      deck === "A" ? 0 : 1,
      { timeout: 7000 },
    );
    s = await snapshot(deck);
    assert.equal(s.state, "BALL");
    assert.ok(s.ball.radius >= 20);
    pass(`Deck ${deck} CRUMPLE creates visible photo-fragment BALL`);
    if (deck === "A") {
      await page.locator("#fx-target").selectOption("0");
      await page.locator("#preview").scrollIntoViewIfNeeded();
      s = await snapshot(deck);
      const bounds = await page.locator("#preview").boundingBox();
      const x = bounds.x + (s.ball.x / 1280) * bounds.width,
        y = bounds.y + (s.ball.y / 720) * bounds.height;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await wait(50);
      assert.equal((await snapshot(deck)).ball.held, true);
      await page.mouse.move(x + 90, y - 30, { steps: 8 });
      await wait(80);
      await page.mouse.up();
      s = await snapshot(deck);
      assert.equal(s.ball.held, false);
      assert.ok(Math.abs(s.ball.vx) + Math.abs(s.ball.vy) > 5);
      pass("pointer DRAG / RELEASE moves ball and retains throw velocity");
    }
    await set(deck, "ball.angle", 0);
    await set(deck, "ball.power", 1000);
    await set(deck, "ball.spin", 3);
    await set(deck, "ball.restitution", 1);
    await set(deck, "ball.bounce", true);
    const collisions = (await snapshot(deck)).ball.collisions;
    await action(deck, "throw");
    s = await snapshot(deck);
    const spin = s.ball.rotation;
    await page.waitForFunction(
      ({ i, n }) => window.photoVJ.snapshot(i, false).ball.collisions > n,
      { i: deck === "A" ? 0 : 1, n: collisions },
      { timeout: 6000 },
    );
    s = await snapshot(deck);
    assert.notEqual(s.ball.rotation, spin);
    pass(`Deck ${deck} THROW → BOUNCE changes trajectory and spin`);
    await page.evaluate(
      (i) => window.photoVJ.throwBall(i, { x: 0, y: 0 }),
      deck === "A" ? 0 : 1,
    );
    await set(deck, "wind.direction", 0);
    await set(deck, "wind.strength", 1.5);
    await set(deck, "wind.enabled", true);
    await wait(300);
    assert.ok((await snapshot(deck)).ball.vx > 0);
    pass(`Deck ${deck} WIND changes heavy ball trajectory`);
    await set(deck, "wind.enabled", false);
    await set(deck, "ball.releaseFraction", 1);
    await action(deck, "release");
    s = await snapshot(deck);
    assert.equal(s.ball.active, false);
    const released = s.positions;
    await wait(200);
    assert.notDeepEqual((await snapshot(deck)).positions, released);
    pass(`Deck ${deck} RELEASE unfolds free sheets before assembly`);
    await fx(deck, "assemble", "mode", "swirl");
    await action(deck, "assemble");
    await assembled(deck);
    await wait(100);
    if (deck === "A") assert.equal(await hash(), baseline);
    pass(
      `Deck ${deck} DEMO B complete: mosaic → explosion → gather → crumple → throw → bounce → wind → release → SWIRL → mosaic`,
    );
  }
  // Pointer gather; all return modes; reset; legacy wind compatibility; shortcuts.
  await page.locator("[data-mode=a]").click();
  await set("A", "gather.target", "pointer");
  await action("A", "gather");
  await page.locator("#preview").click({ position: { x: 100, y: 80 } });
  await wait(1500);
  {
    const s = await snapshot("A");
    let x = 0;
    for (let i = 0; i < s.positions.length; i += 3) x += s.positions[i];
    assert.ok(x / s.count < 400);
  }
  pass("POINTER GATHER attracts sheets to the clicked preview position");
  await set("A", "gather.target", "center");
  for (const mode of ["direct", "spring", "swirl"]) {
    await fx("A", "assemble", "mode", mode);
    await action("A", "assemble");
    await assembled("A");
    await wait(80);
    assert.equal(await hash(), baseline);
    await action("A", "gather");
    await wait(100);
    pass(`${mode.toUpperCase()} physics ASSEMBLE returns to exact mosaic`);
  }
  await set("A", "windMode", "physics");
  await fx("A", "wind", "enabled", true);
  await wait(200);
  assert.ok((await snapshot("A")).velocities.some((v) => v !== 0));
  await action("A", "reset");
  await wait(100);
  assert.equal((await snapshot("A")).active, false);
  assert.equal(await hash(), baseline);
  pass("legacy WIND PHYSICS compatibility and RESET failsafe");
  await page.locator("[data-deck=A] textarea").focus();
  await page.keyboard.type("ctbhu");
  assert.equal((await snapshot("A")).active, false);
  await page.locator("[data-deck=A] textarea").fill("風");
  await page.locator("#fx-target").selectOption("0");
  await page.locator("header").click();
  await page.keyboard.press("h");
  await wait(100);
  assert.equal((await snapshot("A")).state, "GATHERING");
  await page.locator("header").click();
  await page.keyboard.press("c");
  await page.waitForFunction(
    () => window.photoVJ.snapshot(0, false).ball.active,
  );
  await page.locator("header").click();
  const bounceBefore = (await snapshot("A")).ball.bounce;
  await page.keyboard.press("b");
  assert.notEqual((await snapshot("A")).ball.bounce, bounceBefore);
  await page.keyboard.press("t");
  await wait(100);
  await page.locator("header").click();
  await page.keyboard.press("u");
  await wait(80);
  assert.equal((await snapshot("A")).ball.active, false);
  await action("A", "reset");
  pass("C / T / B / H / U shortcuts and input focus protection");
  // Beat/bar scheduling uses the existing Transport; pause gives deterministic queue inspection.
  await page.locator("#run").click();
  await page.locator("#bar-reset").click();
  await set("A", "timing", "beat");
  await action("A", "crumple");
  await wait(100);
  assert.equal((await snapshot("A")).pending[0].beat, 1);
  assert.equal((await snapshot("A")).active, false);
  await page.locator("#run").click();
  await page.waitForFunction(
    () => window.photoVJ.snapshot(0, false).ball.active,
  );
  pass("NEXT BEAT executes CRUMPLE only at Transport boundary");
  await set("A", "timing", "bar");
  await action("A", "throw");
  assert.ok((await snapshot("A")).pending.length > 0);
  await action("A", "reset");
  assert.equal((await snapshot("A")).pending.length, 0);
  await set("A", "timing", "immediate");
  pass("NEXT BAR queue and immediate RESET cancellation");
  // Output is the same completed controller frame, no independent simulation.
  await set("A", "mode", "memory");
  await set("A", "memory.cameraAuto", true);
  await fx("A", "pulse", "enabled", true);
  await fx("A", "rgbShift", "enabled", true);
  await wait(300);
  const moving = await hash();
  await wait(150);
  assert.notEqual(await hash(), moving);
  pass("Phase 2 PULSE + RGB SHIFT compose with 2.5D physics");
  const output = await context.newPage();
  output.on("pageerror", (e) => errors.push(String(e)));
  await output.goto(testUrl("screen.html", base));
  await page.bringToFront();
  await output.waitForFunction(
    () => document.querySelector("canvas").width === 1280,
  );
  await page.locator("#freeze").click();
  const frozen = await snapshot("A"),
    frozenHash = await hash();
  await wait(700);
  assert.deepEqual((await snapshot("A")).positions, frozen.positions);
  assert.equal(await hash(), frozenHash);
  const preview = await page.locator("#preview").evaluate((c) => {
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data,
      r = [];
    for (let i = 0; i < d.length; i += 256) r.push(d[i], d[i + 1], d[i + 2]);
    return r;
  });
  const difference = await output.locator("canvas").evaluate((c, p) => {
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let error = 0,
      n = 0;
    for (let i = 0; i < d.length; i += 256)
      for (let k = 0; k < 3; k++) error += Math.abs(d[i + k] - p[n++]);
    return error / n;
  }, preview);
  assert.ok(difference < 20, `Output JPEG error ${difference}`);
  await page.locator("#freeze").click();
  await output.close();
  await page.bringToFront();
  pass(
    "FREEZE holds physics; Controller / Output share the same physical frame",
  );
  await fx("A", "pulse", "enabled", false);
  await fx("A", "rgbShift", "enabled", false);
  await action("A", "reset");
  await page
    .locator("#files")
    .setInputFiles(Array.from({ length: 900 }, (_, i) => file(100 + i)));
  await page.waitForFunction(
    () =>
      document.querySelector("#photo-count").textContent.startsWith("1000 /"),
    {},
    { timeout: 180000 },
  );
  await set("A", "mode", "memory");
  await set("A", "memory.cameraAuto", true);
  await measure("1000 photos / MEMORY FIELD + CAMERA AUTO");
  await set("A", "wind.enabled", true);
  await measure("1000 photos / WIND MEMORY");
  await action("A", "gather");
  await wait(800);
  await action("A", "crumple");
  await page.waitForFunction(
    () => window.photoVJ.snapshot(0, false).ball.active,
  );
  await action("A", "throw");
  await measure("1000 photos / PHOTO BALL + BOUNCE");
  await set("A", "ball.releaseFraction", 0.3);
  await action("A", "release");
  await measure("1000 photos / BALL + FREE SHEETS / collision");
  await set("A", "ball.releaseFraction", 1);
  await action("A", "release");
  await action("A", "assemble");
  await assembled("A");
  pass(
    "1000-photo MEMORY / WIND / BALL / collision / RELEASE / ASSEMBLE stress sequence",
  );
  await page.screenshot({
    path: `${reportDir}/controller-phase3.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  pass("PHYSICS panel and live buttons fit mobile width");
  assert.deepEqual(errors, []);
  pass("no browser runtime exceptions");
  await writeFile(
    `${reportDir}/results.json`,
    JSON.stringify(
      {
        browser: browser.version(),
        deploymentSha: process.env.DEPLOY_SHA || null,
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
