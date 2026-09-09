const { api } = await import("../src/routes");
const { AUTH_SESSION_TTL_SECONDS, createSession } = await import("../src/auth");
const { database } = await import("../src/database");
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
const token = tokenBody.access_token ?? "";
const bearer = `Bearer ${token}`;
const nearlyExpiredAt = new Date(Date.now() + 60_000).toISOString();
await database.prepare("UPDATE auth_sessions SET expires_at = ? WHERE token = ?").run(nearlyExpiredAt, token);
const renewalStartedAt = Date.now();
const feed = await api.request("http://localhost/feed?limit=1", { headers: { Authorization: bearer } });
const renewedSession = await database.prepare("SELECT expires_at FROM auth_sessions WHERE token = ?")
  .get<{ expires_at: string }>(token);
const renewedExpiresAt = new Date(renewedSession?.expires_at ?? 0).getTime();
const renewalObservedAt = Date.now();
const status = await api.request("http://localhost/auth/status", { headers: { Authorization: bearer } });
const statusBody = await status.json() as any;
const createdProfileResponse = await api.request("http://localhost/profiles", {
  method: "POST",
  headers: { Authorization: bearer, "Content-Type": "application/json" },
  body: JSON.stringify({ name: "TV profile", avatar_color: "#336699" }),
});
const createdProfile = await createdProfileResponse.json() as any;
const switched = await api.request("http://localhost/profiles/switch", {
  method: "POST",
  headers: { Authorization: bearer, "Content-Type": "application/json" },
  body: JSON.stringify({ id: createdProfile.profile?.id }),
});
const switchedBody = await switched.json() as any;
const switchedProfiles = await api.request("http://localhost/profiles", { headers: { Authorization: bearer } });
const switchedProfilesBody = await switchedProfiles.json() as any;
const deviceSession = await database.prepare("SELECT user_id, scope FROM auth_sessions WHERE token = ?")
  .get<{ user_id: number | null; scope: string }>(token);
const pinnedToken = await createSession(1, "profile");
await setSetting("auth_method", "per_profile");
const pinnedStatus = await api.request("http://localhost/auth/status", { headers: { Authorization: `Bearer ${pinnedToken}` } });
const pinnedStatusBody = await pinnedStatus.json() as any;
const pinnedSwitch = await api.request("http://localhost/profiles/switch", {
  method: "POST",
  headers: { Authorization: `Bearer ${pinnedToken}`, "Content-Type": "application/json" },
  body: JSON.stringify({ id: createdProfile.profile?.id }),
});
const pinnedSwitchBody = await pinnedSwitch.json() as any;
await setSetting("auth_method", "shared");
const legacyDeviceToken = await createSession(1, "profile");
const legacyStatus = await api.request("http://localhost/auth/status", { headers: { Authorization: `Bearer ${legacyDeviceToken}` } });
const legacyStatusBody = await legacyStatus.json() as any;
const legacySwitch = await api.request("http://localhost/profiles/switch", {
  method: "POST",
  headers: { Authorization: `Bearer ${legacyDeviceToken}`, "Content-Type": "application/json" },
  body: JSON.stringify({ id: createdProfile.profile?.id }),
});
const upgradedLegacySession = await database.prepare("SELECT user_id, scope FROM auth_sessions WHERE token = ?")
  .get<{ user_id: number | null; scope: string }>(legacyDeviceToken);
const browserToken = decodeURIComponent(cookie.slice(cookie.indexOf("=") + 1));
const browserExpiry = new Date(Date.now() + 60_000).toISOString();
await database.prepare("UPDATE auth_sessions SET expires_at = ? WHERE token = ?").run(browserExpiry, browserToken);
const browserFeed = await api.request("http://localhost/feed?limit=1", { headers: { Cookie: cookie } });
const browserSession = await database.prepare("SELECT expires_at FROM auth_sessions WHERE token = ?")
  .get<{ expires_at: string }>(browserToken);
const expiredToken = await createSession(1, "profile");
await database.prepare("UPDATE auth_sessions SET expires_at = ? WHERE token = ?")
  .run(new Date(Date.now() - 60_000).toISOString(), expiredToken);
const expiredBearer = await api.request("http://localhost/feed?limit=1", {
  headers: { Authorization: `Bearer ${expiredToken}` },
});
const expiredSession = await database.prepare("SELECT token FROM auth_sessions WHERE token = ?").get(expiredToken);
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
  || tokenBody.expires_in !== AUTH_SESSION_TTL_SECONDS
  || feed.status !== 200
  || renewedExpiresAt < renewalStartedAt + (AUTH_SESSION_TTL_SECONDS - 5) * 1000
  || renewedExpiresAt > renewalObservedAt + AUTH_SESSION_TTL_SECONDS * 1000
  || status.status !== 200
  || statusBody.authenticated !== true
  || statusBody.scope !== "account"
  || statusBody.can_switch !== true
  || statusBody.hide_other_profiles !== false
  || createdProfileResponse.status !== 200
  || switched.status !== 200
  || switchedBody.active_id !== createdProfile.profile?.id
  || switchedProfiles.status !== 200
  || switchedProfilesBody.active_id !== createdProfile.profile?.id
  || deviceSession?.scope !== "account"
  || deviceSession.user_id !== createdProfile.profile?.id
  || pinnedStatusBody.can_switch !== false
  || pinnedStatusBody.hide_other_profiles !== true
  || pinnedSwitchBody.requires_relogin !== true
  || legacyStatusBody.can_switch !== true
  || legacySwitch.status !== 200
  || upgradedLegacySession?.scope !== "account"
  || upgradedLegacySession.user_id !== createdProfile.profile?.id
  || browserFeed.status !== 200
  || browserSession?.expires_at !== browserExpiry
  || expiredBearer.status !== 401
  || expiredSession !== null
  || replay.status !== 400
  || logout.status !== 200
  || revoked.status !== 401
) throw new Error("TV device authorization assertion failed");
