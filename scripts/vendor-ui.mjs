import { copyFile, mkdir } from "node:fs/promises";

await mkdir("public/vendor/tabler", { recursive: true });
for (const [source, target] of [
  ["dist/css/tabler.min.css", "tabler.min.css"],
  ["dist/js/tabler.min.js", "tabler.min.js"],
])
  await copyFile(`node_modules/@tabler/core/${source}`, `public/vendor/tabler/${target}`);
await copyFile("docs/licenses/Tabler-MIT.txt", "public/vendor/tabler/LICENSE");
