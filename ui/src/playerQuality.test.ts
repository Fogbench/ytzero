import { describe, expect, test } from "bun:test";
import {
  decodeVerdict, defaultStreamQuality, heightLabel, qualityRows, readQualityChoice, resolveQuality, streamQuality, type DirectQuality,
} from "./playerQuality";

const q = (height: number, codec: "avc1" | "av01", fps = 30, hdr = false): DirectQuality => (
  { id: `${height}-${codec}`, width: Math.round(height * 16 / 9), height, fps, codec, hdr }
);
const list = [q(2160, "av01", 60), q(1440, "av01"), q(1080, "avc1", 60), q(1080, "av01"), q(720, "avc1"), q(720, "av01")];

describe("player quality menu", () => {
  test("height labels show fps above 30, 4K and HDR but no codec", () => {
    expect(heightLabel(q(2160, "av01", 60))).toBe("2160p60 4K");
    expect(heightLabel(q(1080, "avc1", 60))).toBe("1080p60");
    expect(heightLabel(q(2160, "av01", 30, true))).toBe("2160p 4K HDR");
    expect(heightLabel({ ...q(1920, "avc1"), width: 1080 })).toBe("1080p");
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

  test("decode verdict: smooth needs supported and smooth; no answer counts as fine", () => {
    expect(decodeVerdict({ supported: true, smooth: true })).toEqual({ supported: true, smooth: true });
    expect(decodeVerdict({ supported: true, smooth: false })).toEqual({ supported: true, smooth: false });
    expect(decodeVerdict({ supported: false, smooth: true })).toEqual({ supported: false, smooth: false });
    expect(decodeVerdict(null)).toEqual({ supported: true, smooth: true });
    expect(decodeVerdict(undefined)).toEqual({ supported: true, smooth: true });
  });

  test("auto skips entries that are not smooth; a picked height still uses them", () => {
    // No hardware AV1: AV1 plays (supported) but not smoothly; MP4 is fine.
    const smooth = new Set(["1080-avc1", "720-avc1"]);
    expect(resolveQuality({ height: "auto", codec: "av01" }, list, smooth)?.id).toBe("1080-avc1");
    expect(resolveQuality({ height: "auto", codec: "avc1" }, list, smooth)?.id).toBe("1080-avc1");
    expect(resolveQuality({ height: 2160, codec: "av01" }, list, smooth)?.id).toBe("2160-av01");
    expect(resolveQuality({ height: 1080, codec: "av01" }, list, smooth)?.id).toBe("1080-av01");
    expect(qualityRows("av01", list).map((e) => e.id)).toEqual(["2160-av01", "1440-av01", "1080-av01", "720-av01"]); // menu unchanged
    // Nothing smooth: covered by its own test below.
    // All smooth (or the browser could not tell): same as before.
    const all = new Set(list.map((entry) => entry.id));
    expect(resolveQuality({ height: "auto", codec: "av01" }, list, all)?.id).toBe("2160-av01");
  });

  test("nothing smooth: auto picks no quality (server default), a picked height still plays", () => {
    const none = new Set<string>();
    // null means "no ?q=", so the player asks for the server's default stream.
    expect(resolveQuality({ height: "auto", codec: "av01" }, list, none)).toBe(null);
    expect(resolveQuality({ height: "auto", codec: "avc1" }, list, none)).toBe(null);
    expect(resolveQuality({ height: 2160, codec: "av01" }, list, none)?.id).toBe("2160-av01");
    expect(resolveQuality({ height: 720, codec: "avc1" }, list, none)?.id).toBe("720-avc1");
    // Without smoothIds (no verdicts at all) auto still picks the tallest.
    expect(resolveQuality({ height: "auto", codec: "av01" }, list)?.id).toBe("2160-av01");
  });

  test("the server default stream is the tallest MP4 at or below 1080p", () => {
    expect(defaultStreamQuality(list)?.id).toBe("1080-avc1");
    expect(defaultStreamQuality([q(2160, "avc1"), q(1440, "avc1"), q(720, "avc1")])?.id).toBe("720-avc1");
    expect(defaultStreamQuality([q(1440, "av01")])).toBe(null);
    expect(defaultStreamQuality([])).toBe(null);
  });

  test("play first: before the list is in, the default stream plays (no ?q=)", () => {
    expect(streamQuality({ height: "auto", codec: "av01" }, [])).toBe(null);
    expect(streamQuality({ height: 2160, codec: "av01" }, [])).toBe(null);
  });

  test("auto steps up from the default stream only to a taller smooth quality", () => {
    const auto = { height: "auto" as const, codec: "av01" as const };
    // Hardware AV1: 4K is smooth, so auto steps up.
    expect(streamQuality(auto, list, new Set(list.map((entry) => entry.id)))?.id).toBe("2160-av01");
    // Only up to 1080p is smooth: stay on the default stream, no reload for a codec swap at the same height.
    expect(streamQuality(auto, list, new Set(["1080-av01", "1080-avc1", "720-avc1"]))).toBe(null);
    // Only 720p smooth: still keep the 1080p already playing rather than step down.
    expect(streamQuality(auto, list, new Set(["720-avc1"]))).toBe(null);
    // Nothing smooth: default stream.
    expect(streamQuality(auto, list, new Set())).toBe(null);
    // Without verdicts every entry counts as smooth.
    expect(streamQuality(auto, list)?.id).toBe("2160-av01");
  });

  test("a picked height switches to it once the list is in, unless it is the default stream", () => {
    expect(streamQuality({ height: 720, codec: "avc1" }, list, new Set())?.id).toBe("720-avc1");
    expect(streamQuality({ height: 1440, codec: "avc1" }, list)?.id).toBe("1440-av01");
    expect(streamQuality({ height: 1080, codec: "avc1" }, list)).toBe(null);
    expect(streamQuality({ height: 1080, codec: "av01" }, list)?.id).toBe("1080-av01");
  });
});
