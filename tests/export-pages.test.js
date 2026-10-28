import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, cp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

const run = promisify(execFile);

test("Pages export preserves local GLB URLs and licenses beside the HTML", async () => {
  const root = await mkdtemp(join(tmpdir(), "merch-pages-export-"));
  try {
    await mkdir(join(root, "scripts"));
    await mkdir(join(root, "dist/maps"), { recursive: true });
    await writeFile(join(root,"dist/maps/city-reference.png"),"map-fixture");
    await mkdir(join(root, "dist/assets"), { recursive: true });
    await mkdir(join(root, "dist/models/vendor"), { recursive: true });
    await cp(new URL("../scripts/export-pages.mjs", import.meta.url), join(root, "scripts/export-pages.mjs"));
    const html = '<script type="module" src="./assets/game.js"></script>';
    const model = Buffer.from([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0]);
    await writeFile(join(root, "dist/index.html"), html);
    await writeFile(join(root, "dist/icon.svg"), "<svg/>");
    await writeFile(join(root, "dist/assets/game.js"), 'fetch("./models/vendor/cart.glb");');
    await writeFile(join(root, "dist/models/vendor/cart.glb"), model);
    await writeFile(join(root, "dist/models/vendor/LICENSE.txt"), "CC0 1.0 Universal");
    await run(process.execPath, [join(root, "scripts/export-pages.mjs")]);
    assert.equal(await readFile(join(root,"maps/city-reference.png"),"utf8"),"map-fixture");
    assert.equal(await readFile(join(root, "index.html"), "utf8"), html);
    assert.match(await readFile(join(root, "assets/game.js"), "utf8"), /models\/vendor\/cart\.glb/);
    assert.deepEqual(await readFile(join(root, "models/vendor/cart.glb")), model);
    assert.equal(await readFile(join(root, "models/vendor/LICENSE.txt"), "utf8"), "CC0 1.0 Universal");
    assert.equal(await readFile(join(root, "icon.svg"), "utf8"), "<svg/>");
    assert.equal(await readFile(join(root, ".nojekyll"), "utf8"), "");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
