import { type ChildProcess, spawn } from "node:child_process";
import { access, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

export type MonitoredPage = {
  uuid: string;
  url: string;
  title: string;
  paused: boolean;
  last_checked: number | string | null;
  last_error: string | null;
  last_check_status: number | string | null;
  history_count: number;
  verification: "UNVERIFIED";
  marketplace: string;
  canCheck?: boolean;
  blockedReason?: string;
};

export interface ChangeMonitor {
  list(): Promise<MonitoredPage[]>;
  add(url: string, title: string): Promise<MonitoredPage>;
  check(url: string): Promise<MonitoredPage>;
  close(): Promise<void>;
}

const python = resolve(".runtime/external/changedetection/venv/Scripts/python.exe");
const runner = resolve("integrations/changedetection/runner.py");
const manager = resolve("integrations/changedetection/manage.py");
const origin = "http://127.0.0.1:8791";
const maxOutput = 512_000;

export class ChangedetectionAdapter implements ChangeMonitor {
  private child?: ChildProcess;
  private ownsChild = false;
  private startup?: Promise<void>;
  private queue: Promise<unknown> = Promise.resolve();

  private serialized<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task, task);
    this.queue = result.catch(() => undefined);
    return result;
  }

  private async available(): Promise<boolean> {
    try {
      const response = await fetch(`${origin}/api/v1/full-spec`, {
        signal: AbortSignal.timeout(900),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async ensureService(): Promise<void> {
    if (await this.available()) return;
    if (this.startup) return this.startup;
    this.startup = (async () => {
      try {
        await access(python);
        await access(runner);
      } catch {
        throw new Error(
          "changedetection_runtime_unavailable; see integrations/changedetection/README.md",
        );
      }
      if (!this.child || this.child.exitCode !== null) {
        const env: NodeJS.ProcessEnv = {
          PATH: process.env.PATH,
          SystemRoot: process.env.SystemRoot,
          WINDIR: process.env.WINDIR,
          TEMP: process.env.TEMP,
          TMP: process.env.TMP,
          PYTHONUTF8: "1",
        };
        this.child = spawn(python, ["-u", runner], {
          cwd: process.cwd(),
          env,
          shell: false,
          windowsHide: true,
          stdio: "ignore",
        });
        this.ownsChild = true;
        this.child.once("error", () => undefined);
      }
      for (let attempt = 0; attempt < 40; attempt += 1) {
        if (await this.available()) return;
        if (this.child?.exitCode !== null && this.child?.exitCode !== undefined)
          throw new Error("changedetection_service_failed_to_start");
        await delay(250);
      }
      throw new Error("changedetection_service_start_timeout");
    })();
    try {
      await this.startup;
    } finally {
      this.startup = undefined;
    }
  }

  private async manage(args: string[]): Promise<unknown> {
    await this.ensureService();
    return await new Promise((resolveResult, reject) => {
      const env: NodeJS.ProcessEnv = {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        WINDIR: process.env.WINDIR,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
        PYTHONUTF8: "1",
      };
      const child = spawn(python, [manager, ...args], {
        cwd: process.cwd(),
        env,
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"],
      });
      let stdout = "";
      let settled = false;
      const finish = (error?: Error, value?: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error);
        else resolveResult(value);
      };
      const timer = setTimeout(() => {
        child.kill();
        finish(new Error("changedetection_operation_timeout"));
      }, 60_000);
      timer.unref();
      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
        if (Buffer.byteLength(stdout, "utf8") > maxOutput) {
          child.kill();
          finish(new Error("changedetection_output_limit"));
        }
      });
      child.once("error", () => finish(new Error("changedetection_manager_unavailable")));
      child.once("close", (code) => {
        if (settled) return;
        if (code !== 0) {
          finish(new Error("changedetection_manager_failed"));
          return;
        }
        try {
          finish(undefined, JSON.parse(stdout));
        } catch {
          finish(new Error("changedetection_response_invalid"));
        }
      });
    });
  }

  list(): Promise<MonitoredPage[]> {
    return this.serialized(async () => (await this.manage(["list"])) as MonitoredPage[]);
  }

  add(url: string, title: string): Promise<MonitoredPage> {
    return this.serialized(
      async () => (await this.manage(["add", "--url", url, "--title", title])) as MonitoredPage,
    );
  }

  check(url: string): Promise<MonitoredPage> {
    return this.serialized(
      async () => (await this.manage(["check", "--url", url])) as MonitoredPage,
    );
  }

  async close(): Promise<void> {
    if (!this.ownsChild || !this.child || this.child.exitCode !== null) return;
    try {
      await writeFile(resolve(".data/external/changedetection/stop.request"), "", {
        flag: "w",
      });
    } catch {
      this.child.kill();
      return;
    }
    const child = this.child;
    await Promise.race([
      new Promise<void>((resolveResult) => child.once("exit", () => resolveResult())),
      delay(8_000).then(() => {
        if (child.exitCode === null) child.kill();
      }),
    ]);
  }
}
