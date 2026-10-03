import { describe, expect, test } from "bun:test";
import { qualityLabel, resolveQuality, type DirectQuality } from "./playerQuality";

const q = (height: number, codec: "avc1" | "av01", fps = 30, hdr = false): DirectQuality => (
  { id: `${height}-${codec}`, height, fps, codec, hdr }
);
const list = [q(2160, "av01", 60), q(1440, "av01"), q(1080, "avc1", 60), q(1080, "av01"), q(720, "avc1")];

describe("player quality menu", () => {
  test("labels show height, fps above 30, 4K, HDR and the codec", () => {
    expect(qualityLabel(q(2160, "av01", 60))).toBe("2160p60 4K AV1");
    expect(qualityLabel(q(1080, "avc1", 60))).toBe("1080p60 mp4");
    expect(qualityLabel(q(720, "avc1"))).toBe("720p mp4");
    expect(qualityLabel(q(2160, "av01", 30, true))).toBe("2160p 4K HDR AV1");
  });

  test("auto picks the top entry, auto-mp4 the best H.264 up to 1080p", () => {
    expect(resolveQuality("auto", list)?.id).toBe("2160-av01");
    expect(resolveQuality("auto-mp4", list)?.id).toBe("1080-avc1");
    expect(resolveQuality("auto", [])).toBe(null);
  });

  test("a saved choice this video lacks falls back to the next height down", () => {
    expect(resolveQuality("1440-av01", list)?.id).toBe("1440-av01");
    expect(resolveQuality("1080-avc1", list.filter((e) => e.id !== "1080-avc1"))?.id).toBe("1080-av01");
    expect(resolveQuality("480-avc1", list)?.id).toBe("720-avc1");
  });
});
