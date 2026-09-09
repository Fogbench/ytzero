import { describe, expect, test } from "bun:test";
import { DEFAULT_VIDEO_CARD_ACTION_CONFIG, VIDEO_CARD_ACTION_IDS, parseVideoCardActionConfig } from "../../../shared/videoCardActions";
import { DEFAULT_TV_VIDEO_CARD_ACTION_CONFIG, TV_VIDEO_CARD_ACTION_IDS, visibleTvVideoCardActions, tvVideoCardActionConfig } from "./videoCardActions";
import type { Video } from "./types";

const video: Video = {
  video_id: "video",
  title: "Title",
  description: "",
  thumbnail: "",
  channel_title: "Channel",
  published_at: null,
  duration: null,
  live_status: "none",
  watched: 0,
  status: "inbox",
  downloads_enabled: true,
};

describe("TV video card actions", () => {
  test("stays in lockstep with the canonical browser and server contract", () => {
    expect(TV_VIDEO_CARD_ACTION_IDS).toEqual(VIDEO_CARD_ACTION_IDS);
    expect(DEFAULT_TV_VIDEO_CARD_ACTION_CONFIG).toEqual(DEFAULT_VIDEO_CARD_ACTION_CONFIG);
    const value = JSON.stringify({ version: 1, actions: [...DEFAULT_VIDEO_CARD_ACTION_CONFIG.actions].reverse() });
    expect(tvVideoCardActionConfig(value)).toEqual(parseVideoCardActionConfig(value)!);
  });

  test("preserves the configured order while dropping hidden and unsupported controls", () => {
    const config = tvVideoCardActionConfig(JSON.stringify({
      version: 1,
      actions: [
        { id: "archive", hidden: false },
        { id: "schedule", hidden: false },
        { id: "otherPlaybackMode", hidden: false },
        { id: "download", hidden: false },
        { id: "playlist", hidden: false },
        { id: "watched", hidden: true },
        { id: "sessionQueue", hidden: false },
        { id: "restore", hidden: false },
        { id: "remove", hidden: false },
      ],
    }));
    expect(visibleTvVideoCardActions(config, video)).toEqual(["schedule", "archive", "download", "playlist"]);
  });

  test("shows contextual restore and unwatched actions for archived watched videos", () => {
    const config = tvVideoCardActionConfig(null);
    expect(visibleTvVideoCardActions(config, { ...video, status: "archived", watched: 1 })).toEqual(["watched", "restore"]);
  });

  test("shows the locked remove action only when the current screen supplies its behavior", () => {
    const config = tvVideoCardActionConfig(null);
    expect(visibleTvVideoCardActions(config, video)).not.toContain("remove");
    expect(visibleTvVideoCardActions(config, video, true).at(-1)).toBe("remove");
  });
});
