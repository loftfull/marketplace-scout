import { resolve } from "node:path";
import { browserRuntime } from "../browser.js";
import { McpClient } from "./http-mcp.js";

export function ozonClient() {
  const runtime = resolve(".runtime/ozon-mcp");
  return new McpClient({
    command: resolve(
      runtime,
      process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python",
    ),
    args: [resolve("scripts/ozon-cdp.py")],
    cwd: runtime,
    provider: "SZhukovWork/ozon-mcp",
    env: { OZON_CACHE_DIR: resolve(".runtime/ozon-state"), OZON_HEADLESS: "1" },
  });
}
let active = false;
export async function callOzon(tool: string, args: Record<string, unknown>): Promise<unknown> {
  if (active) throw new Error("ozon_call_already_active");
  active = true;
  const client = ozonClient();
  try {
    const browser = await browserRuntime.ensure();
    const session = await browser.newBrowserCDPSession();
    const before = new Set((await session.send("Target.getBrowserContexts")).browserContextIds);
    const cleanup = async () => {
      try {
        try {
          await client.close();
        } finally {
          const after = (await session.send("Target.getBrowserContexts")).browserContextIds;
          for (const browserContextId of after)
            if (!before.has(browserContextId))
              await session.send("Target.disposeBrowserContext", { browserContextId });
        }
      } catch (error) {
        await browserRuntime.close();
        throw error;
      } finally {
        await session.detach().catch(() => undefined);
      }
    };
    try {
      return await client.call(tool, args, 45000, AbortSignal.timeout(50000));
    } finally {
      await cleanup();
    }
  } finally {
    active = false;
  }
}
