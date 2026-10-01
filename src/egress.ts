import { lookup } from "node:dns/promises";
import { createServer, type Server } from "node:http";
import { connect, type Socket } from "node:net";
import type { Duplex } from "node:stream";
export function publicAddress(address: string): boolean {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(address)) return false;
  const [a, b, c, d] = address.split(".").map(Number);
  if ([a, b, c, d].some((n) => n > 255)) return false;
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0)) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19))
  );
}
export class BrowserEgress {
  private server?: Server;
  private sockets = new Set<Duplex>();
  async start(): Promise<number> {
    const server = createServer((_request, response) => {
      response.writeHead(403);
      response.end();
    });
    this.server = server;
    server.on("connect", (request, socket, head) => {
      this.sockets.add(socket);
      (socket as Socket).setTimeout(10000, () => socket.destroy());
      socket.once("close", () => this.sockets.delete(socket));
      void (async () => {
        const match = /^([a-z0-9.-]+):443$/i.exec(request.url || "");
        if (
          !match ||
          match[1].endsWith(".local") ||
          match[1].endsWith(".localhost") ||
          match[1] === "localhost"
        )
          throw new Error("destination_denied");
        const addresses = await lookup(match[1], { all: true, family: 4 });
        if (socket.destroyed) return;
        if (!addresses.length || addresses.some((row) => !publicAddress(row.address)))
          throw new Error("destination_denied");
        // Connect to the validated address itself. A second DNS resolution cannot rebind it.
        const upstream = connect({ host: addresses[0].address, port: 443 });
        this.sockets.add(upstream);
        upstream.once("close", () => this.sockets.delete(upstream));
        upstream.setTimeout(30000, () => upstream.destroy());
        (socket as Socket).setTimeout(30000, () => socket.destroy());
        upstream.once("error", () => socket.destroy());
        socket.once("error", () => upstream.destroy());
        socket.once("close", () => upstream.destroy());
        upstream.once("connect", () => {
          socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
          if (head.length) upstream.write(head);
          socket.pipe(upstream);
          upstream.pipe(socket);
        });
      })().catch(() => {
        socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw Error("proxy_start_failed");
    return address.port;
  }
  async close() {
    for (const socket of this.sockets) socket.destroy();
    await new Promise<void>((resolve) =>
      this.server ? this.server.close(() => resolve()) : resolve(),
    );
    this.server = undefined;
  }
}
