import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({ name: "scout-protocol-test", version: "1.0.0" });
server.registerTool(
  "probe",
  { description: "Synthetic protocol test", inputSchema: {} },
  async () => ({ content: [{ type: "text", text: JSON.stringify({ pid: process.pid }) }] }),
);
server.registerTool(
  "exit",
  { description: "Synthetic disconnect test", inputSchema: {} },
  async () => {
    process.exit(0);
  },
);
await server.connect(new StdioServerTransport());
