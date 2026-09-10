import { strict as assert } from "node:assert";
import { Hono } from "hono";
const { api } = await import("../src/routes");
const { createSession } = await import("../src/auth");
const { database } = await import("../src/database");
const { setSetting } = await import("../src/db");
await setSetting("auth_method", "shared");
await database.prepare("INSERT INTO channels(channel_id,title,url) VALUES('UC-sort','Sorting','https://example.test')").run();
await database.prepare("INSERT INTO channel_playlists(playlist_id,channel_id,title) VALUES('PL-sort','UC-sort','Series')").run();
for (const [index, title] of ["Bravo", "Charlie", "Alpha"].entries()) {
  await database.prepare("INSERT INTO videos(video_id,channel_id,title,published_at) VALUES(?,'UC-sort',?,?)").run(`sort-${index}`, title, `2026-01-0${index + 1}`);
  await database.prepare("INSERT INTO channel_playlist_videos(playlist_id,video_id,position) VALUES('PL-sort',?,?)").run(`sort-${index}`, index);
}
await database.prepare("INSERT INTO user_followed_playlists(user_id,playlist_id) VALUES(1,'PL-sort')").run();
const second = await database.prepare("INSERT INTO users(name,portable_uuid) VALUES('Second',?) RETURNING id").get<{ id: number }>(crypto.randomUUID());
await database.prepare("INSERT INTO user_followed_playlists(user_id,playlist_id,video_sort) VALUES(?,'PL-sort','title-asc')").run(second!.id);
const token = await createSession(1, "account"), other = await createSession(second!.id, "profile");
const app = new Hono().route("/api", api);
const request = (path: string, method = "GET", body?: unknown, session = token) => app.request(`http://localhost/api${path}`, {
  method, headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session}` } : {}) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const contents = async (session = token, query = "") => { const response = await request(`/channel-playlists/PL-sort/videos${query}`, "GET", undefined, session); assert.equal(response.status, 200); return response.json(); };
assert.equal((await request("/channel-playlists/PL-sort/sort", "PUT", { sort: "newest" }, "")).status, 401);
assert.deepEqual((await contents()).order, ["sort-0", "sort-1", "sort-2"]);
for (const sort of [null, 1, "unknown", {}, ["newest"]]) assert.equal((await request("/channel-playlists/PL-sort/sort", "PUT", { sort })).status, 400);
assert.equal((await request("/channel-playlists/PL-sort/sort", "PUT", { sort: "newest" })).status, 200);
assert.deepEqual((await contents()).order, ["sort-2", "sort-1", "sort-0"]);
assert.equal((await contents()).sort, "newest");
assert.equal((await (await request("/channel-playlists/PL-sort")).json()).playlist.video_sort, "newest");
assert.equal((await (await request("/followed-playlists")).json()).playlists[0].video_sort, "newest");
assert.deepEqual((await contents(other)).order, ["sort-2", "sort-0", "sort-1"]);
assert.deepEqual((await contents(token, "?sort=playlist-order")).order, ["sort-0", "sort-1", "sort-2"]);
assert.equal((await contents()).sort, "newest");
await database.prepare("DELETE FROM user_followed_playlists WHERE user_id=?").run(second!.id);
assert.equal((await request("/channel-playlists/PL-sort/sort", "PUT", { sort: "oldest" }, other)).status, 404);
assert.equal((await contents()).sort, "newest");
console.log("RESULT followed playlist sorting");
process.exit(0);
