import type { Language, PairingAuthorization, Video } from "./types";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function responseBody(response: Response): Promise<any> {
  return response.json().catch(() => ({}));
}

export class YtZeroApi {
  constructor(readonly instanceUrl: string, readonly accessToken?: string) {}

  private async request<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
    const response = await fetch(`${this.instanceUrl}/api${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(authenticated && this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
        ...init.headers,
      },
    });
    const body = await responseBody(response);
    if (!response.ok) throw new ApiError(typeof body.error === "string" ? body.error : `HTTP ${response.status}`, response.status);
    return body as T;
  }

  async health(): Promise<void> {
    const response = await fetch(`${this.instanceUrl}/api/health`);
    if (!response.ok) throw new ApiError(`HTTP ${response.status}`, response.status);
    const body = await responseBody(response);
    if (body.status !== "ok") throw new ApiError("unhealthy instance", response.status);
  }

  async authStatus(): Promise<boolean> {
    const status = await this.request<{ authenticated: boolean }>("/auth/status");
    return status.authenticated;
  }

  async beginPairing(): Promise<PairingAuthorization> {
    const result = await this.request<any>("/auth/device/code", {
      method: "POST",
      body: JSON.stringify({ device_name: "YT Zero TV" }),
    }, false);
    return {
      deviceCode: result.device_code,
      userCode: result.user_code,
      verificationUri: result.verification_uri,
      verificationUriComplete: result.verification_uri_complete,
      expiresIn: result.expires_in,
      interval: result.interval,
    };
  }

  async pollPairing(deviceCode: string): Promise<{ kind: "pending" } | { kind: "authorized"; accessToken: string } | { kind: "expired" }> {
    const response = await fetch(`${this.instanceUrl}/api/auth/device/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_code: deviceCode }),
    });
    const body = await responseBody(response);
    if (response.status === 428 && body.error === "authorization_pending") return { kind: "pending" };
    if (response.status === 400 && body.error === "expired_token") return { kind: "expired" };
    if (!response.ok || typeof body.access_token !== "string") {
      throw new ApiError(typeof body.error === "string" ? body.error : `HTTP ${response.status}`, response.status);
    }
    return { kind: "authorized", accessToken: body.access_token };
  }

  settings(): Promise<{ settings: { language: Language; sidebar_nav?: string } }> {
    return this.request("/settings");
  }

  thumbnailSource(url: string): { uri: string; headers?: Record<string, string> } {
    if (!url) return { uri: "" };
    const uri = /^https?:\/\//.test(url)
      ? `${this.instanceUrl}/api/img?u=${encodeURIComponent(url)}`
      : new URL(url, `${this.instanceUrl}/`).toString();
    return {
      uri,
      ...(this.accessToken ? { headers: { Authorization: `Bearer ${this.accessToken}` } } : {}),
    };
  }

  feed(input: { page: number; showAll: boolean; sort: "published" | "arrival" }): Promise<{ videos: Video[]; page: number; limit: number }> {
    const query = new URLSearchParams({ page: String(input.page), limit: "40" });
    if (input.showAll) query.set("show_all", "1");
    if (input.sort === "arrival") query.set("sort", "arrival");
    return this.request(`/feed?${query}`);
  }

  markWatched(videoId: string): Promise<{ ok: true }> {
    return this.request(`/videos/${encodeURIComponent(videoId)}/complete`, { method: "POST", body: "{}" });
  }

  reject(videoId: string): Promise<{ ok: true }> {
    return this.request(`/videos/${encodeURIComponent(videoId)}/archive`, { method: "POST", body: "{}" });
  }

  logout(): Promise<{ ok: true }> {
    return this.request("/auth/logout", { method: "POST", body: "{}" });
  }
}
