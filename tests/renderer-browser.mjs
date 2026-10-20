// Detailed Canvas2D checks against source modules; run with the Vite dev server.
import { chromium } from "@playwright/test";
import { existsSync } from "node:fs";
import assert from "node:assert/strict";
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
try {
  const page = await browser.newPage();
  await page.goto(
    process.env.TEST_URL || "http://127.0.0.1:5173/photomosaic-vj/",
  );
  const results = await page.evaluate(async () => {
    const { FrameEffects } = await import("./src/frame-effects.ts");
    const { defaultEffects } = await import("./src/effects.ts");
    const { Renderer } = await import("./src/renderer.ts");
    const { defaultDeck } = await import("./src/types.ts");
    const results = [];
    const check = (ok, message) => {
      if (!ok) throw Error(message);
      results.push(message);
    };
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 32;
    const c = canvas.getContext("2d"),
      config = defaultEffects(),
      fx = new FrameEffects();
    c.fillStyle = "#000";
    c.fillRect(0, 0, 64, 32);
    c.fillStyle = "#fff";
    c.fillRect(24, 0, 16, 32);
    config.rgbShift.enabled = true;
    config.rgbShift.amount = 1;
    fx.apply(canvas, config, 0, 0);
    const pixel = (x) => Array.from(c.getImageData(x, 16, 1, 1).data);
    check(
      pixel(15)[0] === 255 && pixel(15)[1] === 0 && pixel(15)[2] === 0,
      "RGB SHIFT isolates the red channel",
    );
    check(
      pixel(32)[0] === 0 && pixel(32)[1] === 255 && pixel(32)[2] === 0,
      "RGB SHIFT preserves the green channel",
    );
    check(
      pixel(48)[0] === 0 && pixel(48)[1] === 0 && pixel(48)[2] === 255,
      "RGB SHIFT isolates the blue channel",
    );
    const out = document.createElement("canvas");
    out.width = 320;
    out.height = 180;
    const renderer = new Renderer(out),
      decks = [defaultDeck("A"), defaultDeck("B")];
    decks.forEach((d) => (d.columns = 12));
    const mix = {
      mode: "a",
      amount: 0.5,
      opacity: 0.5,
      axis: "horizontal",
      blend: "source-over",
      swap: false,
      freeze: false,
    };
    const pixels = () =>
      Array.from(out.getContext("2d").getImageData(0, 0, 320, 180).data).join(
        ",",
      );
    renderer.render(decks, mix, 0, 0);
    const baseline = pixels();
    renderer.effects[0].config = decks[0].effects;
    renderer.effects[0].explode({ x: 0.5, y: 0.5 }, 1, 1);
    renderer.render(decks, mix, 0.2, 100);
    check(pixels() !== baseline, "explosion changes actual content canvas");
    decks[0].effects.assemble.seconds = 0.5;
    renderer.effects[0].assemble();
    renderer.render(decks, mix, 0.4, 200);
    check(pixels() !== baseline, "assembly does not immediately snap");
    renderer.render(decks, mix, 2, 1000);
    check(
      pixels() === baseline,
      "renderer paints the final assembled frame after animation stops",
    );
    decks[0].effects.glitch.enabled = true;
    renderer.render(decks, mix, 2.1, 1050);
    check(pixels() !== baseline, "GLITCH changes frame slices");
    decks[0].effects.glitch.enabled = false;
    renderer.render(decks, mix, 2.2, 1100);
    check(pixels() === baseline, "GLITCH OFF clears all frame displacement");
    decks[0].effects.wind.enabled = true;
    renderer.render(decks, mix, 2.4, 1200);
    const velocities = renderer.effects[0].motion.slice();
    mix.freeze = true;
    renderer.render(decks, mix, 8, 4000);
    check(
      renderer.effects[0].motion.every((v, i) => v === velocities[i]),
      "FREEZE holds tile state as well as pixels",
    );
    mix.freeze = false;
    renderer.render(decks, mix, 8.02, 4010);
    check(
      renderer.effects[0].motion[0] - velocities[0] < 10,
      "unfreeze does not integrate frozen wall time",
    );
    return results;
  });
  assert.ok(results.length >= 10);
  results.forEach((r) => console.log("PASS", r));
} finally {
  await browser.close();
}
