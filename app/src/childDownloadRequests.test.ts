import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const root = mkdtempSync(resolve(tmpdir(), "ytzero-child-download-requests-test-"));
let result: Record<string, any> = {};

beforeAll(async () => {
  const process = Bun.spawn(["bun", "app/tests/childDownloadRequestsHarness.ts"], {
    cwd: resolve(import.meta.dir, "../.."),
    env: {
      ...Bun.env,
      DB_PATH: resolve(root, "db", "source.db"),
      AVATAR_DIR: resolve(root, "avatars"),
      DOWNLOADS_DIR: resolve(root, "downloads"),
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (exitCode !== 0) throw new Error(`Child download requests harness failed:\n${stderr}\n${stdout}`);
  const line = stdout.split("\n").find((entry) => entry.startsWith("RESULT "));
  if (!line) throw new Error(`Child download requests harness returned no result:\n${stdout}`);
  result = JSON.parse(line.slice("RESULT ".length));
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("child download requests", () => {
  test("keeps repeated taps on one video to a single pending request", () => {
    expect(result.first.status).toBe("pending");
    expect(result.duplicate.id).toBe(result.first.id);
    expect(result.pendingRows).toHaveLength(1);
    expect(result.pendingRows[0].video_id).toBe("kid-stranger-1");
    expect(result.childView.status).toBe("pending");
  });

  test("notifies only the parents who hid the child-activity shortcut", () => {
    expect(result.notificationRows).toHaveLength(1);
    expect(result.notificationRows[0].user_id).toBe(1);
    expect(result.notificationRows[0].dedupe_key).toBe(`child_request:${result.first.id}`);
  });

  test("approving queues the download and claims it for the child profile", () => {
    expect(result.approval.ok).toBe(true);
    expect(result.approvedOwner).toEqual({ owned: 1 });
    expect(result.approvedDownload.status).toBe("queued");
    expect(result.notificationAfterApproval[0].read_at).not.toBe(null);
    expect(result.resolvedRows[0].status).toBe("approved");
    // A second decision on the same request is a no-op, not a second download.
    expect(result.approvalReplay.ok).toBe(false);
  });

  test("denying resolves the request without granting the video", () => {
    expect(result.deniedRow).toEqual({ status: "denied", resolved_by: 1 });
    expect(result.deniedOwner).toBe(null);
  });

  test("auto-approves followed channels only, and everything in 'all' mode", () => {
    expect(result.autoFollowed.status).toBe("approved");
    expect(result.autoFollowedOwner).toEqual({ owned: 1 });
    expect(result.autoStranger.status).toBe("pending");
    expect(result.autoAll.status).toBe("approved");
    // Auto-approved requests settle without pulling a parent in.
    expect(result.autoNotifications.count).toBe(3);
  });

  test("keeps every decision in the review history, auto-approvals included", () => {
    expect(result.historyRows.map((row: any) => [row.video_id, row.status, row.auto])).toEqual([
      ["kid-followed-2", "approved", 1],
      ["kid-followed-1", "approved", 1],
      ["kid-stranger-2", "denied", 0],
      ["kid-stranger-1", "approved", 0],
    ]);
  });

  test("refuses an approval when no profile has downloads enabled", () => {
    expect(result.withoutDownloads).toEqual({ ok: false, error: "downloads-disabled" });
    // The decision is rolled back, so the child is not left with a request
    // that reads as answered while no download was ever queued.
    expect(result.afterFailedApproval).toEqual({ status: "pending", resolved_by: null, resolved_at: null });
  });

  test("leaves an auto-approval pending when nothing can queue it", () => {
    expect(result.autoWithoutDownloads.status).toBe("pending");
  });

  test("refuses an approval for a video that is no longer available", () => {
    expect(result.unavailable).toEqual({ ok: false, error: "video-unavailable" });
    expect(result.afterUnavailable).toEqual({ status: "pending" });
  });
});
