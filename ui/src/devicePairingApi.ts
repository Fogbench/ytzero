import { http } from "./apiHttp";

export interface DevicePairingVerification {
  user_code: string;
  device_name: string;
  profile_name: string;
  approved: boolean;
}

export const devicePairingApi = {
  devicePairingVerification: (userCode: string) =>
    http<DevicePairingVerification>(`/auth/device/verification?user_code=${encodeURIComponent(userCode)}`),
  authorizeDevice: (userCode: string) =>
    http<{ ok: true }>("/auth/device/authorize", { method: "POST", body: JSON.stringify({ user_code: userCode }) }),
};
