import { normalizeInstanceUrl } from "./instanceUrl";

export type ResolvedInstance = { id: string; name: string; host: string; port: number; addresses: string[]; txt: Record<string, string> };
export type DiscoveredInstance = { id: string; name: string; url: string };

function exactOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.pathname !== "/" || url.search || url.hash) return null;
    return normalizeInstanceUrl(value);
  } catch { return null; }
}

/** Bonjour records are untrusted hints, never authentication or stored state. */
export function discoveryCandidates(service: ResolvedInstance): string[] {
  if (service.txt?.version !== "1" || !Number.isInteger(service.port) || service.port < 1 || service.port > 65535) return [];
  if (service.txt.url) {
    const origin = exactOrigin(service.txt.url);
    return origin ? [origin] : [];
  }
  const scheme = service.txt.scheme ?? "http";
  if (scheme !== "http" && scheme !== "https") return [];
  const hosts = [service.host, ...(service.addresses ?? [])].slice(0, 8);
  const candidates = hosts.flatMap((host) => {
    const clean = host.replace(/\.$/, "");
    // Scoped link-local IPv6 addresses are not portable URL hosts in RN.
    if (!clean || /[^a-zA-Z0-9.:-]/.test(clean) || /^(localhost|127\.|0\.|::1$|::$|fe80:|ff[0-9a-f]{2}:)/i.test(clean)) return [];
    const origin = exactOrigin(`${scheme}://${clean.includes(":") ? `[${clean}]` : clean}:${service.port}`);
    return origin ? [origin] : [];
  });
  return [...new Set(candidates)];
}

export async function verifyDiscoveredInstance(service: ResolvedInstance, signal: AbortSignal): Promise<DiscoveredInstance | null> {
  if (signal.aborted) return null;
  // Probe candidates concurrently so one stale network interface cannot hide a
  // reachable instance. No bearer, cookies or device-code requests are sent.
  const attempts = discoveryCandidates(service).map(async (url) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    const timer = setTimeout(abort, 2500);
    try {
      const response = await fetch(`${url}/api/health`, { signal: controller.signal, credentials: "omit", redirect: "error" });
      const body = await response.json();
      if (!response.ok || body.status !== "ok" || body.app !== "ytzero" || signal.aborted) throw new Error("not a YT Zero instance");
      return { id: service.id, name: service.name.replace(/[\x00-\x1f\x7f]/g, "").slice(0, 80), url };
    } finally { clearTimeout(timer); signal.removeEventListener("abort", abort); }
  });
  const results = await Promise.allSettled(attempts);
  // Prefer the DNS name when it works, so DHCP address changes remain harmless.
  return results.find((result) => result.status === "fulfilled")?.value ?? null;
}
