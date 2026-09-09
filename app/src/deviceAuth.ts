import { database } from "./database";
import { normalizeDeviceUserCode, sanitizeDeviceName } from "./deviceAuthInput";

export { normalizeDeviceUserCode, sanitizeDeviceName } from "./deviceAuthInput";

const DEVICE_FLOW_PREFIX = "tv-device:";
const DEVICE_FLOW_TTL_MS = 10 * 60 * 1000;
const DEVICE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

type DeviceFlowState = {
  kind: "tv-device";
  deviceName: string;
  approved: boolean;
};

export type DeviceAuthorization = {
  deviceCode: string;
  userCode: string;
  expiresIn: number;
  interval: number;
};

export type DeviceAuthorizationStatus =
  | { kind: "pending" }
  | { kind: "approved"; userId: number }
  | { kind: "expired" };

const databaseTimestamp = (milliseconds: number) => new Date(milliseconds).toISOString().replace("T", " ").slice(0, 19);

function randomUserCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const compact = Array.from(bytes, (byte) => DEVICE_CODE_ALPHABET[byte % DEVICE_CODE_ALPHABET.length]).join("");
  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
}

function flowValue(userCode: string): string {
  return `${DEVICE_FLOW_PREFIX}${userCode}`;
}

function parseState(value: string | null): DeviceFlowState | null {
  if (!value) return null;
  try {
    const state = JSON.parse(value) as Partial<DeviceFlowState>;
    if (state.kind !== "tv-device" || typeof state.deviceName !== "string" || typeof state.approved !== "boolean") return null;
    return { kind: "tv-device", deviceName: sanitizeDeviceName(state.deviceName), approved: state.approved };
  } catch {
    return null;
  }
}

export async function beginDeviceAuthorization(deviceName: unknown): Promise<DeviceAuthorization> {
  void database.prepare("DELETE FROM auth_flows WHERE expires_at <= datetime('now')").run().catch(() => {});
  let userCode = "";
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = randomUserCode();
    const exists = await database.prepare("SELECT 1 FROM auth_flows WHERE value = ? AND expires_at > datetime('now')").get(flowValue(candidate));
    if (!exists) {
      userCode = candidate;
      break;
    }
  }
  if (!userCode) throw new Error("could not allocate device code");

  const deviceCode = crypto.randomUUID();
  const state: DeviceFlowState = { kind: "tv-device", deviceName: sanitizeDeviceName(deviceName), approved: false };
  await database.prepare("INSERT INTO auth_flows (id, value, user_id, nonce, expires_at) VALUES (?, ?, NULL, ?, ?)")
    .run(deviceCode, flowValue(userCode), JSON.stringify(state), databaseTimestamp(Date.now() + DEVICE_FLOW_TTL_MS));
  return {
    deviceCode,
    userCode,
    expiresIn: Math.floor(DEVICE_FLOW_TTL_MS / 1000),
    interval: 3,
  };
}

export async function inspectDeviceAuthorization(userCodeInput: unknown): Promise<{ deviceName: string; approved: boolean } | null> {
  const userCode = normalizeDeviceUserCode(userCodeInput);
  if (!userCode) return null;
  const row = await database.prepare("SELECT nonce FROM auth_flows WHERE value = ? AND expires_at > datetime('now')")
    .get<{ nonce: string | null }>(flowValue(userCode));
  const state = parseState(row?.nonce ?? null);
  return state ? { deviceName: state.deviceName, approved: state.approved } : null;
}

export async function approveDeviceAuthorization(userCodeInput: unknown, userId: number): Promise<boolean> {
  const userCode = normalizeDeviceUserCode(userCodeInput);
  if (!userCode || !Number.isSafeInteger(userId) || userId < 1) return false;
  return database.transaction(async () => {
    const row = await database.prepare("SELECT id, nonce FROM auth_flows WHERE value = ? AND user_id IS NULL AND expires_at > datetime('now')")
      .get<{ id: string; nonce: string | null }>(flowValue(userCode));
    const state = parseState(row?.nonce ?? null);
    if (!row || !state || state.approved) return false;
    const approved: DeviceFlowState = { ...state, approved: true };
    const updated = await database.prepare("UPDATE auth_flows SET user_id = ?, nonce = ? WHERE id = ? AND user_id IS NULL RETURNING id")
      .get<{ id: string }>(userId, JSON.stringify(approved), row.id);
    return Boolean(updated);
  })();
}

export async function exchangeDeviceAuthorization(deviceCode: unknown): Promise<DeviceAuthorizationStatus> {
  if (typeof deviceCode !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceCode)) return { kind: "expired" };
  return database.transaction(async () => {
    const approved = await database.prepare(
      "DELETE FROM auth_flows WHERE id = ? AND value LIKE 'tv-device:%' AND user_id IS NOT NULL AND expires_at > datetime('now') RETURNING user_id, nonce",
    ).get<{ user_id: number; nonce: string | null }>(deviceCode);
    const approvedState = parseState(approved?.nonce ?? null);
    if (approved && approvedState?.approved) return { kind: "approved", userId: approved.user_id } as const;

    const pending = await database.prepare("SELECT nonce, expires_at FROM auth_flows WHERE id = ? AND value LIKE 'tv-device:%'")
      .get<{ nonce: string | null; expires_at: string }>(deviceCode);
    const pendingState = parseState(pending?.nonce ?? null);
    if (pending && pendingState && new Date(`${pending.expires_at.replace(" ", "T")}Z`).getTime() > Date.now()) {
      return { kind: "pending" } as const;
    }
    if (pending) await database.prepare("DELETE FROM auth_flows WHERE id = ?").run(deviceCode);
    return { kind: "expired" } as const;
  })();
}
