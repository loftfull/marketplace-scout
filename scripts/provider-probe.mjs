import { writeFile } from "node:fs/promises";
import { wbMcp } from "../src/adapters/wildberries.ts";
import { yandexMcp } from "../src/adapters/yandex.ts";

const contracts = [];
for (const [provider, client, required] of [
  ["SZhukovWork/yandex-market-mcp", yandexMcp, ["search_products", "get_product"]],
  ["ru-marketplace-mcp/WB", wbMcp, ["wb_search", "wb_card"]],
]) {
  try {
    const sdk = await client.connect(AbortSignal.timeout(20000));
    const listed = await sdk.listTools();
    const tools = listed.tools.map((tool) => ({ name: tool.name, input: tool.inputSchema }));
    if (!required.every((name) => tools.some((tool) => tool.name === name)))
      throw Error("missing_required_tool");
    contracts.push({ provider, tools });
  } finally {
    await client.close();
  }
}
const evidence = {
  checkedAt: new Date().toISOString(),
  kind: "ACTUAL_MCP_CONTRACTS_NO_PRICE_REQUEST",
  contracts,
};
await writeFile("work/city-provider-contracts.json", JSON.stringify(evidence, null, 2));
console.log(
  contracts.map((row) => ({ provider: row.provider, tools: row.tools.map((tool) => tool.name) })),
);
