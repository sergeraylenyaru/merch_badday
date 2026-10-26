import { cp, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Root index.html and assets/ are the generated, directly playable Pages site.
// The editable HTML entry remains in src/index.html; Vite serves src/ locally.
const root = new URL("../", import.meta.url);
await mkdir(new URL("assets/", root), { recursive: true });
await cp(new URL("dist/assets/", root), new URL("assets/", root), {
  recursive: true,
});
await cp(new URL("dist/index.html", root), new URL("index.html", root));
await cp(new URL("dist/icon.svg", root), new URL("icon.svg", root));
await writeFile(new URL(".nojekyll", root), "");
console.log(`Playable static site exported to ${fileURLToPath(root)}`);
