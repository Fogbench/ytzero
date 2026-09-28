const { createChildDownloadRequest, latestChildDownloadRequest, listChildDownloadRequests, resolveChildDownloadRequest } = await import("../src/childDownloadRequests");
const { db, setUserSetting } = await import("../src/db");
const { setProfileDownloadsEnabled } = await import("../src/downloadSettingsStore");

const child = db.prepare("INSERT INTO users(name,avatar_color,sort_order,portable_uuid,is_child) VALUES(?,?,?,?,1) RETURNING id")
  .get("Kid", "#3366ff", 1, crypto.randomUUID()) as { id: number };
// A second adult profile that keeps the child-activity shortcut on screen.
const watchingParent = db.prepare("INSERT INTO users(name,avatar_color,sort_order,portable_uuid) VALUES(?,?,?,?) RETURNING id")
  .get("Other parent", "#224466", 2, crypto.randomUUID()) as { id: number };

db.prepare("INSERT INTO channels(channel_id,title,url) VALUES('UC-followed','Followed channel','')").run();
db.prepare("INSERT INTO channels(channel_id,title,url) VALUES('UC-stranger','Stranger channel','')").run();
for (const [videoId, channelId] of [
  ["kid-followed-1", "UC-followed"], ["kid-followed-2", "UC-followed"],
  ["kid-stranger-1", "UC-stranger"], ["kid-stranger-2", "UC-stranger"],
  ["kid-stranger-3", "UC-stranger"], ["kid-stranger-4", "UC-stranger"],
]) {
  db.prepare("INSERT INTO videos(video_id,channel_id,title,thumbnail) VALUES(?,?,?,'')").run(videoId, channelId, videoId);
}
db.prepare("INSERT INTO user_channels(user_id,channel_id,followed) VALUES(?,'UC-followed',1)").run(child.id);

await setUserSetting(child.id, "child_downloads_only", "1");
await setProfileDownloadsEnabled(1, true);
// The primary profile hid the shortcut, so it is the one that needs the bell.
await setUserSetting(1, "child_watching_monitor_enabled", "0");

// ---------- a request a parent has to answer ----------
const first = await createChildDownloadRequest(child.id, "kid-stranger-1");
const duplicate = await createChildDownloadRequest(child.id, "kid-stranger-1");
const pendingRows = await listChildDownloadRequests("pending");
const notificationRows = db.prepare("SELECT user_id, kind, dedupe_key, read_at FROM notifications WHERE kind='child_request' ORDER BY id").all();
const childView = await latestChildDownloadRequest(child.id, "kid-stranger-1");

const approval = await resolveChildDownloadRequest(first.id, "approve", 1);
const approvedOwner = db.prepare("SELECT 1 AS owned FROM download_owners WHERE user_id=? AND video_id='kid-stranger-1'").get(child.id);
const approvedDownload = db.prepare("SELECT status, requested_by_user_id FROM downloads WHERE video_id='kid-stranger-1'").get();
const notificationAfterApproval = db.prepare("SELECT read_at FROM notifications WHERE kind='child_request' ORDER BY id").all();
const resolvedRows = await listChildDownloadRequests("resolved");
const approvalReplay = await resolveChildDownloadRequest(first.id, "approve", 1);

// ---------- denial ----------
const denied = await createChildDownloadRequest(child.id, "kid-stranger-2");
await resolveChildDownloadRequest(denied.id, "deny", 1);
const deniedRow = db.prepare("SELECT status, resolved_by FROM child_download_requests WHERE id=?").get(denied.id);
const deniedOwner = db.prepare("SELECT 1 AS owned FROM download_owners WHERE user_id=? AND video_id='kid-stranger-2'").get(child.id);

// ---------- auto-approval: followed channels only ----------
await setUserSetting(child.id, "child_download_auto_approve", "subscribed");
const autoFollowed = await createChildDownloadRequest(child.id, "kid-followed-1");
const autoFollowedOwner = db.prepare("SELECT 1 AS owned FROM download_owners WHERE user_id=? AND video_id='kid-followed-1'").get(child.id);
const autoStranger = await createChildDownloadRequest(child.id, "kid-stranger-3");
const autoNotifications = db.prepare("SELECT count(*) AS count FROM notifications WHERE kind='child_request'").get();

// ---------- auto-approval: everything ----------
await setUserSetting(child.id, "child_download_auto_approve", "all");
const autoAll = await createChildDownloadRequest(child.id, "kid-followed-2");
const historyRows = await listChildDownloadRequests("resolved");

// ---------- approvals need a profile that can download ----------
await setProfileDownloadsEnabled(1, false);
const withoutDownloads = await resolveChildDownloadRequest(autoStranger.id, "approve", 1);
const afterFailedApproval = db.prepare("SELECT status, resolved_by, resolved_at FROM child_download_requests WHERE id=?").get(autoStranger.id);
// A rule must not settle a request that nothing can download either.
const autoWithoutDownloads = await createChildDownloadRequest(child.id, "kid-stranger-4");
await setProfileDownloadsEnabled(1, true);

// ---------- the video went away between the request and the answer ----------
db.prepare("UPDATE videos SET is_private=1 WHERE video_id='kid-stranger-4'").run();
const unavailable = await resolveChildDownloadRequest(autoWithoutDownloads.id, "approve", 1);
const afterUnavailable = db.prepare("SELECT status FROM child_download_requests WHERE id=?").get(autoWithoutDownloads.id);

console.log("RESULT " + JSON.stringify({
  childId: child.id, watchingParentId: watchingParent.id,
  first, duplicate, pendingRows, notificationRows, childView,
  approval, approvedOwner, approvedDownload, notificationAfterApproval, resolvedRows, approvalReplay,
  deniedRow, deniedOwner,
  autoFollowed, autoFollowedOwner, autoStranger, autoNotifications, autoAll, historyRows,
  withoutDownloads, afterFailedApproval, autoWithoutDownloads, unavailable, afterUnavailable,
}));
db.close();
