const { api } = await import("../src/routes");
const { setSetting } = await import("../src/db");

await setSetting("auth_method", "shared");
await setSetting("auth_shared_username", "");
await setSetting("auth_shared_password_hash", await Bun.password.hash("device-flow-password"));

const begin = await api.request("http://localhost/auth/device/code", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ device_name: "Living room" }),
});
const authorization = await begin.json() as any;

const pending = await api.request("http://localhost/auth/device/token", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ device_code: authorization.device_code }),
});
const unauthenticatedVerification = await api.request(
  `http://localhost/auth/device/verification?user_code=${encodeURIComponent(authorization.user_code)}`,
);

const login = await api.request("http://localhost/auth/password/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ password: "device-flow-password" }),
});
const cookie = login.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
const verification = await api.request(
  `http://localhost/auth/device/verification?user_code=${encodeURIComponent(authorization.user_code)}`,
  { headers: { Cookie: cookie } },
);
const approval = await api.request("http://localhost/auth/device/authorize", {
  method: "POST",
  headers: { Cookie: cookie, "Content-Type": "application/json" },
  body: JSON.stringify({ user_code: authorization.user_code }),
});
const tokenResponse = await api.request("http://localhost/auth/device/token", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ device_code: authorization.device_code }),
});
const tokenBody = await tokenResponse.json() as any;
const bearer = `Bearer ${tokenBody.access_token ?? ""}`;
const feed = await api.request("http://localhost/feed?limit=1", { headers: { Authorization: bearer } });
const status = await api.request("http://localhost/auth/status", { headers: { Authorization: bearer } });
const statusBody = await status.json() as any;
const replay = await api.request("http://localhost/auth/device/token", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ device_code: authorization.device_code }),
});
const logout = await api.request("http://localhost/auth/logout", {
  method: "POST",
  headers: { Authorization: bearer },
});
const revoked = await api.request("http://localhost/feed?limit=1", { headers: { Authorization: bearer } });

if (
  begin.status !== 200
  || pending.status !== 428
  || unauthenticatedVerification.status !== 401
  || login.status !== 200
  || verification.status !== 200
  || approval.status !== 200
  || tokenResponse.status !== 200
  || tokenBody.token_type !== "Bearer"
  || typeof tokenBody.expires_in !== "number"
  || feed.status !== 200
  || status.status !== 200
  || statusBody.authenticated !== true
  || statusBody.can_switch !== false
  || replay.status !== 400
  || logout.status !== 200
  || revoked.status !== 401
) throw new Error("TV device authorization assertion failed");

console.log("RESULT ok");
