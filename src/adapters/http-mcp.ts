import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
export type ToolCall = {
  provider: string;
  tool: string;
  status: string;
  at: string;
  durationMs: number;
};
export const toolCalls: ToolCall[] = [];
export function toolFailure(error: unknown): string {
  const message = String(error);
  if (
    /scout_source_blocked|\b403\b|\b429\b|blocked|challenge|TransportDown|rate limiting|pauses until/i.test(
      message,
    )
  )
    return "blocked";
  if (/timeout|timed out|abort/i.test(message)) return "timeout";
  return "error";
}
export class McpClient {
  private client?: Client;
  private connection?: Promise<Client>;
  constructor(
    private executable?: {
      command: string;
      args: string[];
      cwd: string;
      env?: Record<string, string>;
      provider?: string;
    },
  ) {}
  async connect(signal?: AbortSignal): Promise<Client> {
    signal?.throwIfAborted();
    if (this.client) return this.client;
    if (this.connection) return this.connection;
    this.connection = this.open(signal).catch((error) => {
      this.connection = undefined;
      throw error;
    });
    return this.connection;
  }
  private async open(signal?: AbortSignal) {
    const client = new Client({ name: "marketplace-scout", version: "0.3.0" });
    client.onclose = () => {
      if (this.client === client) {
        this.client = undefined;
        this.connection = undefined;
      }
    };
    const endpoint = this.executable ? undefined : process.env.RU_MARKETPLACE_MCP_URL;
    if (endpoint) {
      const url = new URL(endpoint);
      if (
        !["127.0.0.1", "localhost"].includes(url.hostname) ||
        url.protocol !== "http:" ||
        url.username ||
        url.password
      )
        throw new Error("MCP must use loopback HTTP");
      try {
        await client.connect(new StreamableHTTPClientTransport(url), { timeout: 15000, signal });
      } catch (error) {
        await client.close();
        throw error;
      }
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
        ...this.executable?.env,
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
        signal?.throwIfAborted();
        await client.connect(transport, { timeout: 20000, signal });
      } catch (error) {
        await transport.close();
        log.end();
        throw error;
      }
    }
    this.client = client;
    return client;
  }
  async call(
    name: string,
    args: Record<string, unknown>,
    timeoutMs = 65000,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const started = Date.now();
    let status = "ok";
    try {
      return await this.execute(name, args, timeoutMs, signal);
    } catch (error) {
      status = toolFailure(error);
      throw error;
    } finally {
      toolCalls.push({
        provider: this.executable?.provider ?? "ru-marketplace-mcp",
        tool: name,
        status,
        at: new Date().toISOString(),
        durationMs: Date.now() - started,
      });
      if (toolCalls.length > 200) toolCalls.splice(0, toolCalls.length - 200);
    }
  }
  private async execute(
    name: string,
    args: Record<string, unknown>,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const client = await this.connect(signal);
    let result: Awaited<ReturnType<Client["callTool"]>>;
    try {
      signal?.throwIfAborted();
      result = await client.callTool({ name, arguments: args }, undefined, {
        timeout: timeoutMs,
        signal,
      });
    } catch (error) {
      await client.close().catch(() => undefined);
      if (this.client === client) {
        this.client = undefined;
        this.connection = undefined;
      }
      throw error;
    }
    if (result.isError) {
      const raw = JSON.stringify(result.content).slice(0, 20000);
      throw new Error(`mcp_tool_${toolFailure(raw)}`);
    }
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
