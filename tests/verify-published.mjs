import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const base =
  process.env.TEST_URL || "https://kkodamalab.github.io/photomosaic-vj/";
const sha = process.env.DEPLOY_SHA || "verification";
let error;
for (let attempt = 1; attempt <= 24; attempt++) {
  try {
    const assets = new Set();
    for (const name of ["index.html", "controller.html", "screen.html"]) {
      const url = new URL(name, base);
      url.searchParams.set("build", sha);
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      assert.equal(response.status, 200);
      const html = await response.text(),
        expected = await readFile(`dist/${name}`, "utf8");
      assert.equal(
        html,
        expected,
        `${name} must match this deployment's build`,
      );
      for (const match of html.matchAll(
        /(?:src|href)="([^"]*\/assets\/[^"]+)"/g,
      ))
        assets.add(match[1]);
    }
    for (const asset of assets) {
      const response = await fetch(new URL(asset, base), {
        signal: AbortSignal.timeout(15000),
      });
      assert.equal(response.status, 200);
      assert.deepEqual(
        Buffer.from(await response.arrayBuffer()),
        await readFile(`dist/assets/${asset.split("/").at(-1)}`),
        asset,
      );
    }
    console.log(
      `PASS published HTML and ${assets.size} assets match deployment ${sha}`,
    );
    process.exit(0);
  } catch (e) {
    error = e;
    console.log(
      `Pages propagation attempt ${attempt}: ${e.message.slice(0, 160)}`,
    );
    if (attempt < 24) await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}
throw error;
