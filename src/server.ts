import { buildApp } from "./app.js";
import { browserRuntime } from "./browser.js";
import { mcp } from "./connectors.js";
import { imageMcp } from "./images.js";

const app = await buildApp();
app.addHook("onClose", async () => {
  await mcp.close();
  await imageMcp.close();
  await browserRuntime.close();
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    void app.close();
  });
await app.listen({ port: Number(process.env.PORT || 8787), host: "127.0.0.1" });
