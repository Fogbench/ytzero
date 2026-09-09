import type { Context, Hono } from "hono";
import { AUTH_SESSION_TTL_SECONDS, createSession, requestOrigin } from "../auth";
import { database } from "../database";
import {
  approveDeviceAuthorization,
  beginDeviceAuthorization,
  exchangeDeviceAuthorization,
  inspectDeviceAuthorization,
  normalizeDeviceUserCode,
} from "../deviceAuth";
import { log } from "../logger";

type ApiEnvironment = { Variables: { userId: number; sessionAdmin?: boolean; profileAdmin?: boolean } };
type Api = Hono<ApiEnvironment>;
type ApiContext = Context<ApiEnvironment>;

interface DeviceAuthRouteAccess {
  currentUserId: (context: ApiContext) => number;
}

export function registerDeviceAuthRoutes(api: Api, access: DeviceAuthRouteAccess): void {
  api.post("/auth/device/code", async (c) => {
    c.header("Cache-Control", "no-store");
    const { device_name } = await c.req.json().catch(() => ({}));
    const authorization = await beginDeviceAuthorization(device_name);
    const verificationUri = `${requestOrigin(c)}/tv/pair`;
    return c.json({
      device_code: authorization.deviceCode,
      user_code: authorization.userCode,
      verification_uri: verificationUri,
      verification_uri_complete: `${verificationUri}?code=${encodeURIComponent(authorization.userCode)}`,
      expires_in: authorization.expiresIn,
      interval: authorization.interval,
    });
  });

  api.get("/auth/device/verification", async (c) => {
    c.header("Cache-Control", "no-store");
    const uid = access.currentUserId(c);
    if (!uid) return c.json({ error: "unauthenticated" }, 401);
    const userCode = normalizeDeviceUserCode(c.req.query("user_code"));
    const authorization = await inspectDeviceAuthorization(userCode);
    if (!authorization) return c.json({ error: "invalid or expired device code" }, 404);
    const profile = await database.prepare("SELECT name FROM users WHERE id = ?").get<{ name: string }>(uid);
    return c.json({
      user_code: userCode,
      device_name: authorization.deviceName,
      approved: authorization.approved,
      profile_name: profile?.name ?? "",
    });
  });

  api.post("/auth/device/authorize", async (c) => {
    c.header("Cache-Control", "no-store");
    const uid = access.currentUserId(c);
    if (!uid) return c.json({ error: "unauthenticated" }, 401);
    const { user_code } = await c.req.json().catch(() => ({}));
    const normalized = normalizeDeviceUserCode(user_code);
    if (!normalized) return c.json({ error: "invalid or expired device code" }, 404);
    const approved = await approveDeviceAuthorization(normalized, uid);
    if (!approved) return c.json({ error: "invalid, expired, or already approved device code" }, 404);
    log.info("auth.device_approved", { profileId: uid });
    return c.json({ ok: true });
  });

  api.post("/auth/device/token", async (c) => {
    c.header("Cache-Control", "no-store");
    const { device_code } = await c.req.json().catch(() => ({}));
    const authorization = await exchangeDeviceAuthorization(device_code);
    if (authorization.kind === "pending") return c.json({ error: "authorization_pending" }, 428);
    if (authorization.kind === "expired") return c.json({ error: "expired_token" }, 400);
    const accessToken = await createSession(authorization.userId, "profile");
    log.info("auth.device_login", { scope: "profile", id: authorization.userId });
    return c.json({ access_token: accessToken, token_type: "Bearer", expires_in: AUTH_SESSION_TTL_SECONDS });
  });
}
