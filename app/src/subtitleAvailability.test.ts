import { describe, expect, test } from "bun:test";
import { buildSubtitleAvailability, createSubtitleMetadataCache, normalizeSubtitleLanguage, parseMetadata } from "./subtitleAvailability";
import { createDownloadVideoDirectStreaming, parseSelection } from "./downloadVideoDirectStreaming";

const vtt = (name: string, url = "https://www.youtube.com/api/timedtext?lang=en") => [{ name, ext: "vtt", url }];

describe("subtitle availability", () => {
  test("folds only YouTube's opaque per-track suffix", () => {
    expect(normalizeSubtitleLanguage("en-nP7-2PuUl7o")).toBe("en");
    expect(normalizeSubtitleLanguage("fr-gqnk0mWVyHo")).toBe("fr");
    expect(normalizeSubtitleLanguage("pt-BR")).toBe("pt-BR");
    expect(normalizeSubtitleLanguage("zh-Hans")).toBe("zh-Hans");
    expect(normalizeSubtitleLanguage("zh-Hant")).toBe("zh-Hant");
  });

  test("keeps author tracks, filters automatic captions, and retains fallbacks", () => {
    const available = buildSubtitleAvailability(
      {
        en: vtt("English"),
        "en-nP7-2PuUl7o": vtt("English (audio description)"),
        "pt-BR": vtt("Português (Brasil)"),
      },
      {
        fr: vtt("French (auto-generated)"),
        de: vtt("German (auto-generated)"),
      },
      ["fr"],
    );

    expect(available).toEqual(expect.arrayContaining([
      { lang: "en", label: "English", auto: false, tracks: ["en", "en-nP7-2PuUl7o"] },
      { lang: "pt-BR", label: "Português (Brasil)", auto: false, tracks: ["pt-BR"] },
      { lang: "fr", label: "Français", auto: true, tracks: ["fr"] },
    ]));
    expect(available.some((subtitle) => subtitle.lang === "de")).toBe(false);
  });

  test("uses an author track before an automatic track in the same language", () => {
    const available = buildSubtitleAvailability(
      { fr: vtt("French") },
      { "fr-gqnk0mWVyHo": vtt("French (auto-generated)") },
      ["fr"],
    );
    expect(available.find((subtitle) => subtitle.lang === "fr")?.tracks).toEqual(["fr", "fr-gqnk0mWVyHo"]);
  });

  test("with fallback-only, automatic captions appear only when there are no author tracks", () => {
    const automatic = { fr: vtt("French (auto-generated)") };
    expect(buildSubtitleAvailability({ en: vtt("English") }, automatic, ["fr"], true).map((s) => s.lang)).toEqual(["en"]);
    expect(buildSubtitleAvailability({}, automatic, ["fr"], true).map((s) => s.lang)).toEqual(["fr"]);
  });

  test("with no author tracks, offers the video's own auto-caption language", () => {
    const available = buildSubtitleAvailability({}, { "en-orig": vtt("English (Original)"), en: vtt("English"), de: vtt("German") }, ["pl"], true);
    expect(available.map((s) => s.lang)).toEqual(["en"]);
    expect(available[0].tracks).toEqual(["en-orig"]);
    expect(available[0].auto).toBe(true);
  });

  test("offers only direct WebVTT and excludes HLS manifests", () => {
    const available = buildSubtitleAvailability(
      {
        en: [{ name: "English", ext: "json3", url: "https://www.youtube.com/api/timedtext?fmt=json3" }],
        fr: [{ name: "French", ext: "vtt", url: "https://www.youtube.com/api/manifest/hls_variant/abc" }],
        pl: vtt("Polski", "https://www.youtube.com/api/timedtext?lang=pl"),
      },
      {},
      [],
    );
    expect(available).toEqual([{ lang: "pl", label: "Polski", auto: false, tracks: ["pl"] }]);
  });
});

describe("parseMetadata", () => {
  test("treats yt-dlp's NA (no uploader subtitles) as an empty map", () => {
    const parsed = parseMetadata(`NA\n{"en-orig":[]}\n`);
    expect(parsed.subtitles).toEqual({});
    expect(Object.keys(parsed.automaticCaptions)).toEqual(["en-orig"]);
  });
});

describe("one yt-dlp lookup per video", () => {
  const vtt = (lang: string) => [{ ext: "json3", url: `https://www.youtube.com/api/timedtext?lang=${lang}&fmt=json3` }, { ext: "vtt", url: `https://www.youtube.com/api/timedtext?lang=${lang}&fmt=vtt`, name: `Name ${lang}` }];
  const lookup = JSON.stringify({
    duration: 12,
    http_headers: { "User-Agent": "yt-dlp-test-agent" },
    subtitles: { en: vtt("en") },
    automatic_captions: { "de-orig": vtt("de"), fr: vtt("fr"), live_chat: [{ ext: "json", url: "https://www.youtube.com/x" }] },
    requested_formats: [
      { format_id: "137", url: "https://r1.googlevideo.com/v?expire=9999999999", ext: "mp4", protocol: "https", vcodec: "avc1.640028", acodec: "none", width: 1920, height: 1080, fps: 30, vbr: 4000 },
      { format_id: "140", url: "https://r1.googlevideo.com/a?expire=9999999999", ext: "m4a", protocol: "https", vcodec: "none", acodec: "mp4a.40.2", abr: 128 },
    ],
  });

  function counted(stdout: string, exitCode = 0, directPlayable = async (_videoId: string) => true) {
    const counter = { spawns: 0 };
    const spawn = (() => {
      counter.spawns++;
      return {
        stdout: new Response(exitCode === 0 ? stdout : "").body!,
        stderr: new Response(exitCode === 0 ? "" : "ERROR: Video unavailable").body!,
        exited: Bun.sleep(5).then(() => exitCode),
        kill: () => {},
      } as unknown as ReturnType<typeof Bun.spawn>;
    }) as unknown as typeof Bun.spawn;
    const streaming = createDownloadVideoDirectStreaming({
      YTDLP: "yt-dlp", dlSettings: async () => ({ quality: "best" }), downloadCookiesConfigured: () => false,
      downloadCookiesFile: () => "cookies", ytdlpStatus: async () => "2026.07.04", videoAvailable: async () => true, directPlayable, spawn,
    });
    return { counter, streaming };
  }

  test("the direct lookup keeps only the WebVTT caption tracks", () => {
    const sources = parseSelection(lookup, 0)!;
    expect(Object.keys(sources.subtitles)).toEqual(["en"]);
    expect(Object.keys(sources.automaticCaptions)).toEqual(["de-orig", "fr"]);
    expect(sources.subtitles.en).toEqual([{ ext: "vtt", url: "https://www.youtube.com/api/timedtext?lang=en&fmt=vtt", name: "Name en" }]);
  });

  test("opening a video (player plus subtitles menu) spawns yt-dlp once", async () => {
    const { counter, streaming } = counted(lookup);
    let own = 0;
    const metadata = createSubtitleMetadataCache(streaming.directCaptionMaps, async () => { own++; throw new Error("unexpected spawn"); });
    const [qualities, captions] = await Promise.all([streaming.getDirectQualities(1, "vid"), metadata.get(1, "vid")]);
    expect(qualities.kind).toBe("qualities");
    expect(counter.spawns).toBe(1);
    expect(own).toBe(0);
    expect(buildSubtitleAvailability(captions.subtitles, captions.automaticCaptions, ["fr"]).map((s) => s.lang)).toEqual(["en", "fr"]);
    streaming.resetDirectHlsSessions();
  });

  test("a video the direct player cannot use goes straight to the menu's own lookup", async () => {
    const { counter, streaming } = counted(lookup, 0, async () => false);
    let own = 0;
    const metadata = createSubtitleMetadataCache(streaming.directCaptionMaps, async () => { own++; return { subtitles: { en: [] }, automaticCaptions: {} }; });
    expect(await metadata.get(1, "gone-private")).toEqual({ subtitles: { en: [] }, automaticCaptions: {} });
    expect(counter.spawns).toBe(0);
    expect(own).toBe(1);
    streaming.resetDirectHlsSessions();
  });

  test("falls back to its own lookup only when the direct lookup fails", async () => {
    const { streaming } = counted("", 1);
    let own = 0;
    const metadata = createSubtitleMetadataCache(streaming.directCaptionMaps, async () => { own++; return { subtitles: { en: [] }, automaticCaptions: {} }; });
    expect(await metadata.get(1, "vid")).toEqual({ subtitles: { en: [] }, automaticCaptions: {} });
    expect(own).toBe(1);
    streaming.resetDirectHlsSessions();
  });
});
