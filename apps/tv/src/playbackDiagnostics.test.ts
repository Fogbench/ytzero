import { expect, test } from "bun:test";
import { playbackDiagnostic } from "./playbackDiagnostics";

test("diagnostics preserve useful HTTP/native error codes without copying credentials or media data", () => {
  const secret = "secret-ticket";
  const result = playbackDiagnostic("load", {
    status: 403, message: `Request https://local/video?ticket=${secret} Authorization: Bearer ${secret}`, token: secret,
  }, {
    playerStatus: 1, timeControlStatus: 0, itemStatus: 2,
    errors: [{ domain: "NSURLErrorDomain", code: -1001 }, { domain: secret, code: -1 }],
    requestErrors: [{ domain: "CoreMediaErrorDomain", code: 403 }],
    ...{ uri: `https://local/?ticket=${secret}`, title: "Private title", userInfo: { token: secret } },
  });
  expect(result).toEqual({ stage: "load", httpStatus: 403, cause: "error", playerStatus: 1, timeControlStatus: 0, itemStatus: 2,
    errors: [{ domain: "NSURLErrorDomain", code: -1001 }, { domain: "other", code: -1 }], requestErrors: [{ domain: "CoreMediaErrorDomain", code: 403 }] });
  expect(JSON.stringify(result)).not.toContain(secret);
  expect(JSON.stringify(result)).not.toContain("Private title");
  expect(JSON.stringify(result)).not.toContain("https:");
});

test("healthy playback is distinguishable from native console warnings", () => {
  expect(playbackDiagnostic("playing", undefined, { playerStatus: 1, itemStatus: 1, timeControlStatus: 2, hasTitle: true, stalls: 0, droppedFrames: 0, errors: [], requestErrors: [] })).toEqual({
    stage: "playing", playerStatus: 1, itemStatus: 1, timeControlStatus: 2, hasTitle: true, stalls: 0, droppedFrames: 0, errors: [], requestErrors: [],
  });
  expect(playbackDiagnostic("prepare", new Error("Network request failed"))).toEqual({stage: "prepare", cause: "network"});
  expect(playbackDiagnostic("load", new Error("timeout"))).toEqual({stage: "load", cause: "timeout"});
});

test("diagnostics bound native error history and reject nonfinite values", () => {
  const result = playbackDiagnostic("load", { status: Infinity }, { playerStatus: 1, timeControlStatus: 0, stalls: NaN, errors: Array.from({ length: 9 }, (_, code) => ({ domain: "NSOSStatusErrorDomain", code })) });
  expect(result.errors).toHaveLength(4);
  expect(result).not.toHaveProperty("httpStatus");
  expect(result).not.toHaveProperty("stalls");
});
