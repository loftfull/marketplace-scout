import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const marketplaceNames = ["yandex-market", "ozon", "avito", "wildberries"] as const;
export type MarketplaceName = (typeof marketplaceNames)[number];
export type SourcePause = {
  status: "blocked" | "error" | "timeout";
  blockedAt: string;
  stage: string;
  detail: string;
};
type SourceCircuitFile = {
  version: 1;
  sources: Partial<Record<MarketplaceName, SourcePause>>;
};

const isMarketplaceName = (value: string): value is MarketplaceName =>
  marketplaceNames.includes(value as MarketplaceName);

export class SourceCircuit {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly path?: string) {}

  private async read(): Promise<SourceCircuitFile> {
    if (!this.path) return { version: 1, sources: {} };
    try {
      const value: unknown = JSON.parse(await readFile(this.path, "utf8"));
      if (
        !value ||
        typeof value !== "object" ||
        (value as SourceCircuitFile).version !== 1 ||
        !(value as SourceCircuitFile).sources ||
        typeof (value as SourceCircuitFile).sources !== "object" ||
        Array.isArray((value as SourceCircuitFile).sources)
      )
        throw new Error("source_circuit_state_corrupt");
      const state = value as SourceCircuitFile;
      for (const [name, pause] of Object.entries(state.sources)) {
        if (!isMarketplaceName(name)) throw new Error("source_circuit_state_corrupt");
        if (
          !pause ||
          !["blocked", "error", "timeout"].includes(pause.status) ||
          typeof pause.blockedAt !== "string" ||
          typeof pause.stage !== "string" ||
          typeof pause.detail !== "string"
        )
          throw new Error("source_circuit_state_corrupt");
      }
      return state;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { version: 1, sources: {} };
      throw error;
    }
  }

  private async write(state: SourceCircuitFile) {
    if (!this.path) return;
    await mkdir(dirname(this.path), { recursive: true });
    const temp = `${this.path}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(state, null, 2), { flag: "wx" });
    await rename(temp, this.path);
  }

  async get(marketplace: string): Promise<SourcePause | undefined> {
    if (!isMarketplaceName(marketplace)) return undefined;
    await this.queue;
    const state = await this.read();
    const pause = state.sources[marketplace];
    return pause;
  }

  async list(): Promise<Partial<Record<MarketplaceName, SourcePause>>> {
    await this.queue;
    return (await this.read()).sources;
  }

  async pause(marketplace: string, status: SourcePause["status"], stage: string, detail: string) {
    if (!isMarketplaceName(marketplace)) return;
    const transaction = this.queue.then(async () => {
      const state = await this.read();
      state.sources[marketplace] = {
        status,
        blockedAt: new Date().toISOString(),
        stage: stage.slice(0, 80),
        detail: detail.slice(0, 180),
      };
      await this.write(state);
    });
    this.queue = transaction.catch(() => undefined);
    return transaction;
  }

  async resume(marketplace: string) {
    if (!isMarketplaceName(marketplace)) return false;
    const transaction = this.queue.then(async () => {
      const state = await this.read();
      delete state.sources[marketplace];
      await this.write(state);
      return true;
    });
    this.queue = transaction.catch(() => undefined);
    return transaction;
  }
}
