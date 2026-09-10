import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { NativeModule, requireOptionalNativeModule } from "expo";
import { verifyDiscoveredInstance, type DiscoveredInstance, type ResolvedInstance } from "./discovery";

declare class DiscoveryModule extends NativeModule<{
  onResolved: (service: ResolvedInstance) => void;
  onRemoved: (service: { id: string }) => void;
  onError: () => void;
}> {
  start(): Promise<void>;
  stop(): Promise<void>;
}
const discovery = requireOptionalNativeModule<DiscoveryModule>("YtZeroDiscovery");

export function useInstanceDiscovery() {
  const [instances, setInstances] = useState<DiscoveredInstance[]>([]);
  const [status, setStatus] = useState<"searching" | "ready" | "unavailable">(discovery ? "searching" : "unavailable");
  const [generation, setGeneration] = useState(0);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => setForeground(next === "active"));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!discovery || !foreground) return;
    let active = true;
    const probes = new Map<string, AbortController>();
    setInstances([]);
    setStatus("searching");
    const timer = setTimeout(() => { if (active) setStatus((current) => current === "searching" ? "ready" : current); }, 10000);
    const subscriptions = [
      discovery.addListener("onResolved", (service) => {
        if (!active || probes.has(service.id) || probes.size >= 32) return;
        const controller = new AbortController();
        probes.set(service.id, controller);
        void verifyDiscoveredInstance(service, controller.signal).then((instance) => {
          if (!active || controller.signal.aborted || !instance) return;
          setInstances((current) => current.some((item) => item.id === instance.id || item.url === instance.url) ? current : [...current, instance]);
        }).catch(() => {});
      }),
      discovery.addListener("onRemoved", ({ id }) => {
        probes.get(id)?.abort();
        probes.delete(id);
        if (active) setInstances((current) => current.filter((item) => item.id !== id));
      }),
      discovery.addListener("onError", () => { if (active) setStatus("unavailable"); }),
    ];
    void discovery.start().catch(() => { if (active) setStatus("unavailable"); });
    return () => {
      active = false;
      clearTimeout(timer);
      for (const probe of probes.values()) probe.abort();
      subscriptions.forEach((subscription) => subscription.remove());
      void discovery.stop().catch(() => {});
    };
  }, [foreground, generation]);

  return { instances, status, supported: Boolean(discovery), rescan: () => setGeneration((value) => value + 1) };
}
