import { expect, test } from "bun:test";
import { createDownloadLiveAudioStreaming } from "./downloadLiveAudioStreaming";
import { liveVideoFormat } from "./liveVideoStreaming";

test("live video selects H.264 HLS with the profile quality cap", () => {
  expect(liveVideoFormat("720")).toBe("bestvideo[protocol*=m3u8][vcodec^=avc1][height<=720]");
  expect(liveVideoFormat("best")).not.toContain("height<=");
  expect(liveVideoFormat("invalid")).not.toContain("height<=");
});

test("live relay shares extraction, advances the playlist and isolates stale session resources", async () => {
  let spawns = 0, namespace = 0, sequence = 100;
  const requests: string[] = [];
  const relay = createDownloadLiveAudioStreaming({
    YTDLP: "test-ytdlp", downloadCookiesConfigured: () => false,
    downloadCookiesFile: () => "/unused", ytdlpStatus: async () => "test",
    formatSelector: async () => liveVideoFormat("720"),
    resourceTokenPrefix: () => `r${String(++namespace).padStart(16, "0")}_`,
    spawn: ((command: string[]) => {
      spawns++;
      expect(command).toContain(liveVideoFormat("720"));
      expect(command).toContain("--get-url");
      expect(command).not.toContain("-o");
      return { stdout: new Response("https://manifest.googlevideo.com/live.m3u8\n").body!, stderr: new Response("").body!, exited: Promise.resolve(0), kill: () => {} };
    }) as unknown as typeof Bun.spawn,
    fetchImpl: (async (input: string) => {
      requests.push(String(input));
      if (String(input).includes("manifest.googlevideo.com")) return new Response(`#EXTM3U\n#EXT-X-TARGETDURATION:6\n#EXT-X-MEDIA-SEQUENCE:${sequence}\n#EXTINF:6,\nhttps://r1.googlevideo.com/itag/95/sq/${sequence}\n#EXTINF:6,\nhttps://r1.googlevideo.com/itag/95/sq/${sequence + 1}\n`);
      return new Response("muxed-media", { headers: { "Content-Type": "video/mp2t" } });
    }) as typeof fetch,
  });
  const first = await Promise.all([relay.getLiveAudioPlaylist(1, "live"), relay.getLiveAudioPlaylist(1, "live")]);
  expect(spawns).toBe(1);
  expect(first[0]).toBe(first[1]);
  expect(first[0]).toContain("#EXT-X-MEDIA-SEQUENCE:100");
  expect(first[0]).not.toContain("#EXT-X-ENDLIST");
  const resources = (first[0] ?? "").split("\n").filter((line) => line.startsWith("r"));
  sequence++;
  const second = await relay.getLiveAudioPlaylist(1, "live");
  expect(second).toContain("#EXT-X-MEDIA-SEQUENCE:101");
  expect(second).toContain(resources[1]!);
  const media = await relay.getLiveAudioResource(1, "live", resources[1]!, null);
  expect(media?.headers.get("content-type")).toBe("video/mp2t");
  expect(await media?.text()).toBe("muxed-media");
  relay.invalidateLiveAudioSources(1);
  await relay.getLiveAudioPlaylist(1, "live");
  const before = requests.length;
  expect(await relay.getLiveAudioResource(1, "live", resources[0]!, null)).toBeNull();
  expect(requests.length).toBe(before);
});
