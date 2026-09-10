import { Bonjour, type ServiceConfig } from "bonjour-service";
import { hostname } from "node:os";
import { createHash } from "node:crypto";
import type { EventEmitter } from "node:events";
import { log } from "./logger";

/** DNS-SD metadata is public on the LAN. Never add profile or session data. */
export function discoveryAdvertisement(listeningPort: number, appName = "YT Zero", environment: Record<string, string | undefined> = process.env, machineName = hostname()): ServiceConfig | null {
  const enabled = environment.YTZERO_DISCOVERY?.trim().toLowerCase();
  if (["0", "false", "off", "no"].includes(enabled ?? "")) return null;
  if (enabled && !["1", "true", "on", "yes"].includes(enabled)) throw new Error("Invalid YTZERO_DISCOVERY value");
  const port = Number(environment.YTZERO_DISCOVERY_PORT ?? listeningPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid discovery port");
  const txt: Record<string, string> = { version: "1", scheme: "http" };
  const configuredUrl = environment.YTZERO_DISCOVERY_URL?.trim();
  if (configuredUrl) {
    const url = new URL(configuredUrl);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash || url.origin.length > 240) {
      throw new Error("YTZERO_DISCOVERY_URL must be an HTTP(S) origin without credentials, path or query");
    }
    txt.url = url.origin;
    txt.scheme = url.protocol.slice(0, -1);
  }
  // The suffix distinguishes instances, including several ports on one machine.
  // Limit the complete DNS label to 63 UTF-8 bytes, without splitting a character.
  const suffix = createHash("sha256").update(`${machineName}:${port}`).digest("hex").slice(0, 8);
  let name = "";
  for (const character of (environment.YTZERO_DISCOVERY_NAME?.trim() || appName || "YT Zero").replace(/[.\x00-\x1f\x7f]/g, " ")) {
    if (Buffer.byteLength(name + character) > 52) break;
    name += character;
  }
  const host = `${machineName.replace(/\.local\.?$/i, "").replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 63) || "ytzero"}.local`;
  return { name: `${name.trim() || "YT Zero"} ${suffix}`, type: "ytzero", protocol: "tcp", host, port, txt };
}

export function startLocalDiscovery(port: number, appName: string): { stop: () => Promise<void> } {
  let bonjour: Bonjour | undefined;
  let stopping: Promise<void> | undefined;
  let warned = false;
  const warn = () => {
    if (warned) return;
    warned = true;
    log.warn("discovery.unavailable", { hint: "Check multicast UDP 5353 or set YTZERO_DISCOVERY=0; manual connections remain available." });
  };
  const stop = () => stopping ??= new Promise<void>((resolve) => {
    if (!bonjour) return resolve();
    const finish = () => { clearTimeout(timer); bonjour?.destroy(); bonjour = undefined; resolve(); };
    const timer = setTimeout(finish, 300);
    bonjour.unpublishAll(finish);
  });
  try {
    const config = discoveryAdvertisement(port, appName);
    if (!config) return { stop };
    bonjour = new Bonjour({}, warn);
    // bonjour-service's callback covers replies, but not multicast-dns socket
    // errors. Keep this compatibility adapter here, away from application code.
    const mdns = (bonjour as unknown as { server: { mdns: EventEmitter } }).server.mdns;
    mdns.on("error", () => { warn(); void stop(); });
    const service = bonjour.publish(config);
    service.on("error", warn);
    service.once("up", () => log.info("discovery.advertising", { service: "_ytzero._tcp", port: config.port }));
  } catch {
    warn();
    void stop();
  }
  return { stop };
}
