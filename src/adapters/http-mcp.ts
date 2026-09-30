import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
export class McpClient {
  private client?: Client;
  private connection?: Promise<Client>;
  constructor(private executable?: { command: string; args: string[]; cwd: string }) {}
  async connect(): Promise<Client> {
    if (this.client) return this.client;
    if (this.connection) return this.connection;
    this.connection = this.open().catch((error) => {
      this.connection = undefined;
      throw error;
    });
    return this.connection;
  }
  private async open() {
    const client = new Client({ name: "marketplace-scout", version: "0.3.0" });
    client.onclose = () => {
      if (this.client === client) {
        this.client = undefined;
        this.connection = undefined;
      }
    };
    const endpoint = process.env.RU_MARKETPLACE_MCP_URL;
    if (endpoint) {
      const url = new URL(endpoint);
      if (
        !["127.0.0.1", "localhost"].includes(url.hostname) ||
        url.protocol !== "http:" ||
        url.username ||
        url.password
      )
        throw new Error("MCP must use loopback HTTP");
      await client.connect(new StreamableHTTPClientTransport(url), { timeout: 15000 });
    } else {
      const runtime = resolve(".runtime/ru-marketplace-mcp");
      const command = resolve(
        runtime,
        process.platform === "win32" ? ".venv/Scripts/compare-mcp.exe" : ".venv/bin/compare-mcp",
      );
      const env: Record<string, string> = {};
      for (const key of [
        "PATH",
        "SystemRoot",
        "WINDIR",
        "TEMP",
        "TMP",
        "USERPROFILE",
        "LOCALAPPDATA",
      ])
        if (process.env[key]) env[key] = process.env[key] as string;
      Object.assign(env, {
        MCP_TRANSPORT: "stdio",
        MARKETPLACE_SOURCES: "yandex_market,ozon,avito",
        CHROME_CDP_HOST: "127.0.0.1",
        CHROME_CDP_PORT: "9337",
        CHROME_SCRAPING_PROFILE: resolve(".runtime/chrome-profile"),
        CHROME_HEADLESS: "1",
        CHROME_STEALTH: "0",
        CHROME_CHALLENGE_HANDOFF_S: "0",
        COMPARE_SOURCE_TIMEOUT: "45",
        PYTHONIOENCODING: "utf-8",
      });
      const transport = new StdioClientTransport({
        command: this.executable?.command ?? command,
        args: this.executable?.args ?? [],
        cwd: this.executable?.cwd ?? runtime,
        env,
        stderr: "pipe",
      });
      await mkdir(".runtime/logs", { recursive: true });
      const log = createWriteStream(".runtime/logs/mcp.log", { flags: "a" });
      transport.stderr?.pipe(log);
      try {
        await client.connect(transport, { timeout: 20000 });
      } catch (error) {
        await transport.close();
        log.end();
        throw error;
      }
    }
    this.client = client;
    return client;
  }
  async call(name: string, args: Record<string, unknown>): Promise<unknown> {
    const client = await this.connect();
    let result: Awaited<ReturnType<Client["callTool"]>>;
    try {
      result = await client.callTool({ name, arguments: args }, undefined, { timeout: 65000 });
    } catch (error) {
      await client.close().catch(() => undefined);
      if (this.client === client) {
        this.client = undefined;
        this.connection = undefined;
      }
      throw error;
    }
    if (result.isError) throw new Error("mcp_tool_failed");
    if (result.structuredContent) return result.structuredContent;
    const blocks = result.content as Array<{ type: string; text?: string }>;
    const text = blocks?.find((block) => block.type === "text")?.text;
    if (!text || text.length > 2_000_000) throw new Error("mcp_invalid_response");
    return JSON.parse(text) as unknown;
  }
  async close() {
    await this.client?.close();
    this.client = undefined;
    this.connection = undefined;
  }
}
