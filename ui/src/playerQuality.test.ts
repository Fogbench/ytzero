import { describe, expect, test } from "bun:test";
import { heightLabel, qualityRows, readQualityChoice, resolveQuality, type DirectQuality } from "./playerQuality";

const q = (height: number, codec: "avc1" | "av01", fps = 30, hdr = false): DirectQuality => (
  { id: `${height}-${codec}`, height, fps, codec, hdr }
);
const list = [q(2160, "av01", 60), q(1440, "av01"), q(1080, "avc1", 60), q(1080, "av01"), q(720, "avc1"), q(720, "av01")];

describe("player quality menu", () => {
  test("height labels show fps above 30, 4K and HDR but no codec", () => {
    expect(heightLabel(q(2160, "av01", 60))).toBe("2160p60 4K");
    expect(heightLabel(q(1080, "avc1", 60))).toBe("1080p60");
    expect(heightLabel(q(2160, "av01", 30, true))).toBe("2160p 4K HDR");
  });

  test("auto takes the tallest entry of the preferred codec, else the other codec", () => {
    expect(resolveQuality({ height: "auto", codec: "av01" }, list)?.id).toBe("2160-av01");
    expect(resolveQuality({ height: "auto", codec: "avc1" }, list)?.id).toBe("1080-avc1");
    expect(resolveQuality({ height: "auto", codec: "avc1" }, [q(1440, "av01")])?.id).toBe("1440-av01");
    expect(resolveQuality({ height: "auto", codec: "av01" }, [])).toBe(null);
  });

  test("a height uses the preferred codec, else the other, else the next height down", () => {
    expect(resolveQuality({ height: 1080, codec: "av01" }, list)?.id).toBe("1080-av01");
    expect(resolveQuality({ height: 1080, codec: "avc1" }, list)?.id).toBe("1080-avc1");
    expect(resolveQuality({ height: 1440, codec: "avc1" }, list)?.id).toBe("1440-av01");
    expect(resolveQuality({ height: 480, codec: "avc1" }, list)?.id).toBe("720-avc1");
  });

  test("one row per height", () => {
    expect(qualityRows("avc1", list).map((e) => e.id)).toEqual(["2160-av01", "1440-av01", "1080-avc1", "720-avc1"]);
  });

  test("saved choice falls back to auto and AV1", () => {
    const store = (values: Record<string, string>) => ({ getItem: (key: string) => values[key] ?? null });
    expect(readQualityChoice(store({}))).toEqual({ height: "auto", codec: "av01" });
    expect(readQualityChoice(store({ "ytzero.player.qualityHeight": "720", "ytzero.player.qualityCodec": "avc1" })))
      .toEqual({ height: 720, codec: "avc1" });
  });
});
