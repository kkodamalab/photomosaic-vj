import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath:
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1050 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const base = process.env.TEST_URL || "http://127.0.0.1:5173/photomosaic-vj/";
await page.goto(base);
await page.waitForSelector("#preview");
const results = [];
const pass = (name) => {
  results.push(name);
  console.log("PASS", name);
};
await page.locator("#bpm").fill("100");
await page.locator("#bpm").dispatchEvent("change");
await page.locator("header").click();
await page.keyboard.press("Enter");
assert.equal(Number(await page.locator("#bpm").inputValue()), 100);
pass("phase reset preserves BPM");
await page.locator("[data-deck=A] textarea").fill("HELLO");
await page.keyboard.press("Space");
assert.equal(Number(await page.locator("#bpm").inputValue()), 100);
pass("typing does not trigger TAP");
const fixtures = await page.evaluate(() =>
  Array.from({ length: 12 }, (_, i) => {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 96;
    const x = c.getContext("2d");
    x.fillStyle = `hsl(${i * 30},65%,40%)`;
    x.fillRect(0, 0, 128, 96);
    x.fillStyle = "#fff";
    x.font = "bold 32px sans-serif";
    x.fillText("PHOTO", 5, 45);
    x.fillText(String(i), 40, 82);
    return c.toDataURL("image/jpeg").split(",")[1];
  }),
);
const file = (i) => ({
  name: `fixture-${i}.jpg`,
  mimeType: "image/jpeg",
  buffer: Buffer.from(fixtures[i % 12], "base64"),
});
await page
  .locator("#files")
  .setInputFiles(Array.from({ length: 1000 }, (_, i) => file(i)));
await page.waitForFunction(
  () =>
    document
      .querySelector("#import-status")
      .textContent.includes("完了 1000枚"),
  {},
  { timeout: 180000 },
);
assert.match(await page.locator("#photo-count").innerText(), /1000 \/ 1000/);
pass("1000 JPEG images imported, analyzed, cached and rendered");
await page.locator(".photo").first().click();
await page.waitForFunction(() =>
  document.querySelector("#photo-count").textContent.startsWith("999 /"),
);
await page.locator(".photo").first().click();
await page.waitForFunction(() =>
  document.querySelector("#photo-count").textContent.startsWith("1000 /"),
);
pass("photo exclusion and re-inclusion");
await page.locator("[data-deck=B] [data-image]").setInputFiles(file(11));
await page.waitForFunction(
  () =>
    document.querySelector("[data-deck=B] [data-key=target]").value === "image",
);
pass("independent TEXT and IMAGE targets");
const hash = () => page.locator("#preview").evaluate((c) => c.toDataURL());
await page.locator("[data-mode=a]").click();
await page.waitForTimeout(100);
const a = await hash();
await page.locator("[data-mode=b]").click();
await page.waitForTimeout(100);
assert.notEqual(await hash(), a);
pass("A ONLY and B ONLY render distinct decks");
for (const mode of ["split", "overlay", "crossfade"]) {
  await page.locator(`[data-mode=${mode}]`).click();
  await page.locator("#mix").fill("0.25");
  await page.locator("#mix").dispatchEvent("input");
  await page.waitForTimeout(100);
  const before = await hash();
  await page.locator(mode === "overlay" ? "#opacity" : "#mix").fill("0.8");
  await page
    .locator(mode === "overlay" ? "#opacity" : "#mix")
    .dispatchEvent("input");
  await page.waitForTimeout(100);
  assert.notEqual(await hash(), before);
  pass(`${mode} changes pixels`);
}
await page.locator("#freeze").click();
const frozen = await hash();
await page.locator("[data-deck=A] textarea").fill("CHANGED");
await page.waitForTimeout(100);
assert.equal(await hash(), frozen);
await page.locator("#freeze").click();
pass("freeze retains output pixels");
await page.locator("[data-mode=split]").click();
await page.locator("#mix").fill("0.5");
await page.locator("#mix").dispatchEvent("input");
const output = await context.newPage();
await output.goto(new URL("screen.html", base).href);
await output.waitForFunction(
  () => document.querySelector("canvas").width === 1280,
);
await output.waitForFunction(() => {
  const c = document.querySelector("canvas");
  return c.getContext("2d").getImageData(640, 360, 1, 1).data[3] === 255;
});
pass("separate screen receives controller frame");
await page.bringToFront();
await page.waitForTimeout(2500);
console.log("Observed controller", await page.locator("#fps").innerText());
await page.screenshot({ path: "docs/controller-tested.png", fullPage: true });
await page.reload();
await page.waitForFunction(
  () => document.querySelector("#photo-count").textContent.startsWith("1000 /"),
  {},
  { timeout: 30000 },
);
pass("IndexedDB survives reload");
await page.setViewportSize({ width: 390, height: 844 });
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  true,
);
pass("mobile layout has no horizontal overflow");
assert.deepEqual(errors, []);
pass("no browser runtime errors");
await writeFile(
  "docs/browser-test-results.json",
  JSON.stringify(
    { browser: "Microsoft Edge headless", base, results, errors },
    null,
    2,
  ),
);
await browser.close();
