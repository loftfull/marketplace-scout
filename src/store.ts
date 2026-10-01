import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Offer, ProductProfile } from "./domain.js";
import { freshness } from "./freshness.js";
export type Row = { profile: ProductProfile; offer: Offer; seenAt: string };
export class HistoryStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private path = process.env.SCOUT_DB || ".data/history.json") {}
  private async read(): Promise<Row[]> {
    try {
      const rows: unknown = JSON.parse(await readFile(this.path, "utf8"));
      if (
        !Array.isArray(rows) ||
        rows.some(
          (row) =>
            !row?.profile ||
            !row.offer ||
            !Array.isArray(row.offer.reasons) ||
            typeof row.seenAt !== "string",
        )
      )
        throw new Error("history_corrupt_preserved");
      return rows;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
  async append(profile: ProductProfile, offers: Offer[]) {
    const transaction = this.queue.then(async () => {
      const rows = await this.read();
      const seenAt = new Date().toISOString();
      rows.push(...offers.map((offer) => ({ profile, offer, seenAt })));
      await mkdir(dirname(this.path), { recursive: true });
      const temp = `${this.path}.${randomUUID()}.tmp`;
      await writeFile(temp, JSON.stringify(rows.slice(-10000), null, 2), { flag: "wx" });
      await rename(temp, this.path);
    });
    this.queue = transaction.catch(() => undefined);
    return transaction;
  }
  async history() {
    await this.queue;
    return (await this.read()).map((row) => ({
      ...row,
      observedStatus: row.offer.status,
      offer: freshness(row.offer),
    }));
  }
}
const store = new HistoryStore();
export const append = (profile: ProductProfile, offers: Offer[]) => store.append(profile, offers);
export const history = () => store.history();
