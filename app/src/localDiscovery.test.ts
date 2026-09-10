import { describe, expect, test } from "bun:test";
import { discoveryAdvertisement } from "./localDiscovery";

describe("local instance discovery", () => {
  test("advertises only public DNS-SD connection metadata", () => {
    const service = discoveryAdvertisement(3001, "Home cinema", { DATABASE_URL: "postgres://secret", YTZERO_AUTH_PASSWORD: "secret", APP_URL: "https://user:secret@example.com" }, "living-room");
    expect(service).toMatchObject({ type: "ytzero", protocol: "tcp", host: "living-room.local", port: 3001, txt: { version: "1", scheme: "http" } });
    expect(JSON.stringify(service)).not.toContain("secret");
    expect(service!.name).not.toBe(discoveryAdvertisement(3002, "Home cinema", {}, "living-room")!.name);
    expect(Buffer.byteLength(discoveryAdvertisement(3001, "映画".repeat(50), {}, "host")!.name)).toBeLessThanOrEqual(63);
  });

  test("can be disabled, and proxy URLs must be clean origins", () => {
    expect(discoveryAdvertisement(3001, "YT Zero", { YTZERO_DISCOVERY: "false" })).toBeNull();
    expect(discoveryAdvertisement(3001, "YT Zero", { YTZERO_DISCOVERY_PORT: "5174" })!.port).toBe(5174);
    expect(() => discoveryAdvertisement(3001, "YT Zero", { YTZERO_DISCOVERY_PORT: "0" })).toThrow();
    expect(discoveryAdvertisement(3001, "YT Zero", { YTZERO_DISCOVERY_URL: "https://video.example:8443" })!.txt).toEqual({ version: "1", scheme: "https", url: "https://video.example:8443" });
    for (const url of ["https://user:secret@example.com", "http://example.com/path", "http://example.com?token=secret", "file:///tmp/test", "https://example.com/#secret"]) {
      expect(() => discoveryAdvertisement(3001, "YT Zero", { YTZERO_DISCOVERY_URL: url })).toThrow();
    }
  });
});
