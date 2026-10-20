import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { testUrl } from "./test-url.mjs";
const base = process.env.TEST_URL || "http://127.0.0.1:5173/photomosaic-vj/";
const reportDir = process.env.REPORT_DIR || "test-results/physics-ui";
await mkdir(reportDir, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
});
const results = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(testUrl("controller.html", base));
  await page.waitForFunction(() => !!window.photoVJ);
  const photo = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ff7830";
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = "#2060dd";
    ctx.fillRect(0, 0, 32, 32);
    return canvas.toDataURL("image/jpeg").split(",")[1];
  });
  await page.locator("#files").setInputFiles([
    {
      name: "ui-demo.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from(photo, "base64"),
    },
  ]);
  await page.waitForFunction(() =>
    document.querySelector("#import-status").textContent.includes("完了 1枚"),
  );
  await page.evaluate(() => {
    window.uiKeydowns = 0;
    addEventListener("keydown", () => window.uiKeydowns++);
  });
  // Opening every nested panel uses real clicks, never a DOM-open override.
  const open = async (locator) => {
    const closed = await locator.evaluate((el) => {
      let p = el.parentElement;
      const chain = [];
      while (p) {
        if (p.tagName === "DETAILS" && !p.open) chain.unshift(p);
        p = p.parentElement;
      }
      return chain.map((el) =>
        Array.from(document.querySelectorAll("details")).indexOf(el),
      );
    });
    for (const index of closed)
      await page
        .locator("details")
        .nth(index)
        .locator(":scope > summary")
        .click();
  };
  const state = () => page.evaluate(() => window.photoVJ.snapshot(0, false));
  const waitState = (name) =>
    page.waitForFunction(
      (name) => window.photoVJ.snapshot(0, false).state === name,
      name,
      { timeout: 15000 },
    );
  const hash = () => page.locator("#preview").evaluate((c) => c.toDataURL());
  await page.locator("[data-mode=a]").click();
  const baseline = await hash();
  for (const scope of [".physics-panel", ".physics-performance"]) {
    const action = (name) =>
      page.locator(`[data-deck=A] ${scope} [data-physics-action=${name}]`);
    const explosion = page.locator("[data-deck=A] [data-fx-action=explosion]");
    await open(explosion);
    await explosion.click();
    await open(action("gather"));
    await action("gather").click();
    await waitState("GATHERING");
    await open(action("crumple"));
    await action("crumple").click();
    await waitState("BALL");
    await open(action("throw"));
    await action("throw").click();
    assert.ok(Math.abs((await state()).ball.vx) > 1);
    const before = (await state()).ball.bounce;
    await open(action("bounce"));
    await action("bounce").click();
    assert.equal((await state()).ball.bounce, !before);
    for (const button of await page
      .locator("[data-deck=A] [data-physics-action=bounce]")
      .all()) {
      assert.equal(await button.getAttribute("aria-pressed"), String(!before));
      assert.ok((await button.textContent()).includes(before ? "OFF" : "ON"));
    }
    assert.equal(
      await page
        .locator('[data-deck=A] [data-physics="ball.bounce"]')
        .isChecked(),
      !before,
    );
    await open(action("release"));
    await action("release").click();
    assert.equal((await state()).ball.active, false);
    const mode = page.locator("[data-deck=A] [data-physics-return]");
    await open(mode);
    await mode.selectOption("swirl");
    await action("assemble").click();
    await waitState("ASSEMBLED");
    await page.waitForTimeout(100);
    assert.equal(await hash(), baseline);
    results.push(
      `${scope}: mouse-only MOSAIC → EXPLOSION → GATHER → CRUMPLE → BALL → THROW → BOUNCE → RELEASE → SWIRL → identical MOSAIC`,
    );
  }
  assert.equal(await page.evaluate(() => window.uiKeydowns), 0);
  await page.locator("#fx-target").selectOption("0");
  await page.locator("header").click();
  await page.keyboard.press("h");
  await waitState("GATHERING");
  await page.keyboard.press("c");
  await waitState("BALL");
  const before = (await state()).ball.bounce;
  await page.keyboard.press("b");
  assert.equal((await state()).ball.bounce, !before);
  await page.keyboard.press("t");
  assert.ok(Math.abs((await state()).ball.vx) > 1);
  await page.keyboard.press("u");
  assert.equal((await state()).ball.active, false);
  await page.keyboard.press("r");
  await waitState("ASSEMBLED");
  results.push(
    "H / C / T / B / U / R shortcuts still execute existing actions",
  );
  await page.screenshot({
    path: `${reportDir}/panel-buttons.png`,
    fullPage: true,
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const touch = await context.newPage();
  await touch.goto(testUrl("controller.html", base));
  await touch.waitForFunction(() => !!window.photoVJ);
  for (const deck of ["A", "B"]) {
    assert.equal(
      await touch
        .locator(`[data-deck=${deck}] .physics-panel`)
        .getAttribute("open"),
      null,
    );
    const buttons = touch.locator(
      `[data-deck=${deck}] .physics-buttons button`,
    );
    assert.equal(await buttons.count(), 6);
    for (const button of await buttons.all()) {
      const size = await button.boundingBox();
      assert.ok(size.width >= 44 && size.height >= 44);
      assert.equal(await button.isVisible(), true);
    }
  }
  await touch
    .locator("[data-deck=A] .physics-performance [data-physics-action=gather]")
    .tap();
  await touch.waitForFunction(
    () => window.photoVJ.snapshot(0, false).state === "GATHERING",
  );
  await touch
    .locator(
      "[data-deck=A] .physics-performance [data-physics-action=assemble]",
    )
    .tap();
  await touch.waitForFunction(
    () => window.photoVJ.snapshot(0, false).state === "ASSEMBLED",
  );
  assert.equal(
    await touch.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  results.push(
    "390px touch: both decks expose six >=44px buttons with PHYSICS closed; tap GATHER / ASSEMBLE works without overflow",
  );
  await touch.screenshot({
    path: `${reportDir}/touch-buttons.png`,
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  await writeFile(
    `${reportDir}/results.json`,
    JSON.stringify(
      { base, deploymentSha: process.env.DEPLOY_SHA || null, results, errors },
      null,
      2,
    ),
  );
  results.forEach((result) => console.log("PASS", result));
} finally {
  await browser.close();
}
