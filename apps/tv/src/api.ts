import type { AuthStatus, BookmarkVideo, Bucket, Channel, ChannelAbout, PairingAuthorization, Profile, Tag, TvProfileSettings, UserPlaylist, Video, VideoComment } from "./types";
import type { TvBrowseDestination } from "./navigation";
import type { PlaybackTicket } from "./types";
import type { PlaybackPosition } from "./playback";

type BrowseResult = { videos: Video[]; page: number; hasMore: boolean };

const TV_PAGE_SIZE = 24;

type DownloadVideo = {
  video_id: string;
  status: "queued" | "downloading" | "done" | "error";
  title: string;
  thumbnail: string;
  duration: string | null;
  published_at: string | null;
  channel_title: string;
};

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

  authStatus(): Promise<AuthStatus> {
    return this.request("/auth/status");
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

  settings(): Promise<{ settings: TvProfileSettings }> {
    return this.request("/settings");
  }

  profiles(): Promise<{ profiles: Profile[]; active_id: number; hide_other_profiles: boolean }> {
    return this.request("/profiles");
  }

  childLock(): Promise<{ child_lock: { enabled: boolean; locked: boolean } }> {
    return this.request("/child-lock");
  }

  async switchProfile(profileId: number, pin?: string, childLockPin?: string): Promise<{ active_id: number }> {
    const result = await this.request<{ active_id?: number; requires_relogin?: boolean }>("/profiles/switch", {
      method: "POST",
      body: JSON.stringify({ id: profileId, pin, child_lock_pin: childLockPin }),
    });
    if (typeof result.active_id !== "number") throw new ApiError("profile switch requires pairing again", 409);
    return { active_id: result.active_id };
  }

  avatarSource(url: string): { uri: string; headers?: Record<string, string> } {
    if (!url) return { uri: "" };
    return {
      uri: new URL(url, `${this.instanceUrl}/`).toString(),
      ...(this.accessToken ? { headers: { Authorization: `Bearer ${this.accessToken}` } } : {}),
    };
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

  shortThumbnailSource(videoId: string): { uri: string; headers?: Record<string, string> } {
    const url = `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/oardefault.jpg`;
    return {
      uri: `${this.instanceUrl}/api/img?u=${encodeURIComponent(url)}&onMiss=error`,
      ...(this.accessToken ? { headers: { Authorization: `Bearer ${this.accessToken}` } } : {}),
    };
  }

  feed(input: {
    page: number;
    showAll?: boolean;
    sort?: "published" | "arrival";
    tags?: number[];
    channel?: string;
    status?: "inbox" | "all";
    shorts?: boolean;
    processing?: boolean;
  }): Promise<{ videos: Video[]; page: number; limit: number }> {
    const query = new URLSearchParams({ page: String(input.page), limit: String(TV_PAGE_SIZE) });
    if (input.showAll) query.set("show_all", "1");
    if (input.sort === "arrival") query.set("sort", "arrival");
    if (input.tags?.length) query.set("tags", input.tags.join(","));
    if (input.channel) query.set("channel", input.channel);
    if (input.status) query.set("status", input.status);
    if (input.shorts) query.set("shorts", "1");
    if (input.processing) query.set("processing", "1");
    return this.request(`/feed?${query}`);
  }

  tags(): Promise<{ tags: Tag[] }> {
    return this.request("/tags");
  }

  channels(): Promise<{ channels: Channel[]; instance_has_data: boolean }> {
    return this.request("/channels");
  }

  topChannels(): Promise<{ channels: Channel[] }> {
    return this.request("/channels/top");
  }

  channel(id: string): Promise<{ channel: Channel }> {
    return this.request(`/channels/${encodeURIComponent(id)}`);
  }

  channelAbout(id: string): Promise<ChannelAbout> {
    return this.request(`/channels/${encodeURIComponent(id)}/about`);
  }

  channelLive(id: string): Promise<{ videos: Video[] }> {
    return this.request(`/channels/${encodeURIComponent(id)}/live`);
  }

  channelVideos(id: string, page = 0): Promise<{ videos: Video[]; page: number; limit: number }> {
    return this.feed({ channel: id, page, shorts: true, status: "all" });
  }

  followChannel(id: string, followed: boolean): Promise<{ ok: true }> {
    return this.request(`/channels/${encodeURIComponent(id)}/follow`, {
      method: "PUT",
      body: JSON.stringify({ followed }),
    });
  }

  inProgress(): Promise<{ videos: Video[] }> {
    return this.request("/in-progress");
  }

  watchlist(): Promise<{ videos: Video[] }> {
    return this.request("/watchlist");
  }

  bookmarks(): Promise<{ bookmarks: BookmarkVideo[] }> {
    return this.request("/bookmarks");
  }

  video(id: string): Promise<{ video: Video; related: Video[] }> {
    return this.request(`/videos/${encodeURIComponent(id)}`);
  }

  videoComments(id: string): Promise<{ comments: VideoComment[]; fetchedAt: string; cached: boolean }> {
    return this.request(`/videos/${encodeURIComponent(id)}/comments?sort=top`);
  }

  playbackTicket(id: string, signal?: AbortSignal): Promise<PlaybackTicket> {
    return this.request(`/videos/${encodeURIComponent(id)}/playback-ticket`, { method: "POST", body: "{}", signal });
  }

  renewPlaybackTicket(id: string, ticket: string): Promise<{ expires_in: number }> {
    return this.request(`/videos/${encodeURIComponent(id)}/playback-ticket`, { method: "PUT", body: JSON.stringify({ ticket }), signal: AbortSignal.timeout(8000) });
  }

  releasePlaybackTicket(id: string, ticket: string): Promise<{ ok: true }> {
    return this.request(`/videos/${encodeURIComponent(id)}/playback-ticket`, { method: "DELETE", body: JSON.stringify({ ticket }), signal: AbortSignal.timeout(8000) });
  }

  playbackSource(ticket: PlaybackTicket): { uri: string; contentType: "hls" | "progressive" } {
    const uri = new URL(ticket.url, `${this.instanceUrl}/`);
    if (uri.origin !== new URL(this.instanceUrl).origin || uri.username || uri.password || !uri.pathname.startsWith("/api/videos/") || uri.searchParams.get("media_ticket") !== ticket.ticket) {
      throw new ApiError("invalid playback source", 502);
    }
    return { uri: uri.toString(), contentType: ticket.content_type };
  }

  savePlaybackProgress(id: string, value: PlaybackPosition): Promise<{ ok: true }> {
    return this.request(`/videos/${encodeURIComponent(id)}/progress`, { method: "PUT", body: JSON.stringify(value), signal: AbortSignal.timeout(6000) });
  }

  playbackRestriction(): Promise<{ locked: boolean; is_child: boolean }> {
    return this.request("/child/status", { signal: AbortSignal.timeout(6000) });
  }

  async browse(
    destination: TvBrowseDestination,
    input: { page: number; showAll: boolean; sort: "published" | "arrival" },
  ): Promise<BrowseResult> {
    const { page } = input;
    if (destination === "/") {
      const result = await this.feed(input);
      return { videos: result.videos, page: result.page, hasMore: result.videos.length === result.limit };
    }
    if (destination === "/recommendations") {
      const result = await this.request<{ videos: Video[]; page: number; has_more: boolean }>(`/recommendations?page=${page}&limit=${TV_PAGE_SIZE}`);
      return { videos: result.videos, page: result.page, hasMore: result.has_more };
    }
    if (destination === "/shorts") {
      const result = await this.request<{ videos: Video[]; page: number; limit: number }>(`/feed?page=${page}&limit=${TV_PAGE_SIZE}&shorts=1&only_shorts=1`);
      return { videos: result.videos, page: result.page, hasMore: result.videos.length === result.limit };
    }
    if (destination === "/liked") {
      const result = await this.request<{ videos: Video[]; page: number; limit: number }>(`/feed?page=${page}&limit=${TV_PAGE_SIZE}&liked=1&status=all&all_sources=1&shorts=1`);
      return { videos: result.videos, page: result.page, hasMore: result.videos.length === result.limit };
    }
    if (destination === "/archive") {
      const result = await this.request<{ videos: Video[]; page: number }>(`/archive?page=${page}`);
      return { videos: result.videos, page: result.page, hasMore: result.videos.length === 60 };
    }
    if (destination === "/history") {
      const result = await this.request<{ videos: Video[]; page: number; has_more: boolean }>(`/history?page=${page}`);
      return { videos: result.videos, page: result.page, hasMore: result.has_more };
    }

    // These endpoints return complete collections rather than pages.
    if (page > 0) return { videos: [], page, hasMore: false };
    if (destination === "/live" || destination === "/watchlist") {
      const result = await this.request<{ videos: Video[] }>(destination);
      return { videos: result.videos, page, hasMore: false };
    }
    if (destination === "/bookmarks") {
      const result = await this.bookmarks();
      return { videos: result.bookmarks, page, hasMore: false };
    }
    if (destination === "/followed-playlists") {
      const result = await this.request<{ playlists: Array<{ new_videos: Video[] }> }>("/followed-playlists/updates");
      const unique = new Map<string, Video>();
      for (const playlist of result.playlists) {
        for (const video of playlist.new_videos) unique.set(video.video_id, video);
      }
      return { videos: [...unique.values()], page, hasMore: false };
    }

    const result = await this.request<{ downloads: DownloadVideo[] }>("/downloads");
    const videos = result.downloads
      .filter((download) => download.status === "done")
      .map<Video>((download) => ({
        video_id: download.video_id,
        title: download.title,
        description: "",
        thumbnail: download.thumbnail,
        channel_title: download.channel_title,
        published_at: download.published_at,
        duration: download.duration,
        live_status: "none",
        watched: null,
        status: "inbox",
      }));
    return { videos, page, hasMore: false };
  }

  markWatched(videoId: string): Promise<{ ok: true }> {
    return this.request(`/videos/${encodeURIComponent(videoId)}/complete`, { method: "POST", body: "{}" });
  }

  markUnwatched(videoId: string): Promise<{ ok: true }> {
    return this.request(`/videos/${encodeURIComponent(videoId)}/complete`, { method: "DELETE" });
  }

  queue(videoId: string, bucket: Bucket): Promise<{ ok: true }> {
    return this.request(`/videos/${encodeURIComponent(videoId)}/queue`, {
      method: "POST",
      body: JSON.stringify({ bucket }),
    });
  }

  dequeue(videoId: string): Promise<{ ok: true }> {
    return this.request(`/videos/${encodeURIComponent(videoId)}/dequeue`, { method: "POST", body: "{}" });
  }

  likeVideo(videoId: string, liked: boolean): Promise<{ ok: true }> {
    return this.request(`/videos/${encodeURIComponent(videoId)}/like`, {
      method: "PUT",
      body: JSON.stringify({ liked }),
    });
  }

  reject(videoId: string): Promise<{ ok: true }> {
    return this.request(`/videos/${encodeURIComponent(videoId)}/archive`, { method: "POST", body: "{}" });
  }

  restore(videoId: string): Promise<{ ok: true }> {
    return this.request(`/videos/${encodeURIComponent(videoId)}/restore`, { method: "POST", body: "{}" });
  }

  userPlaylists(videoId: string): Promise<{ playlists: UserPlaylist[] }> {
    return this.request(`/playlists?video_id=${encodeURIComponent(videoId)}`);
  }

  addVideoToUserPlaylist(playlistId: number, videoId: string): Promise<{ ok: true }> {
    return this.request(`/playlists/${playlistId}/videos`, {
      method: "POST",
      body: JSON.stringify({ video_id: videoId }),
    });
  }

  removeVideoFromUserPlaylist(playlistId: number, videoId: string): Promise<{ ok: true }> {
    return this.request(`/playlists/${playlistId}/videos/${encodeURIComponent(videoId)}`, { method: "DELETE" });
  }

  downloadVideo(videoId: string): Promise<{ ok: true }> {
    return this.request(`/videos/${encodeURIComponent(videoId)}/download`, { method: "POST", body: "{}" });
  }

  cancelVideoDownload(videoId: string): Promise<{ ok: true }> {
    return this.request(`/videos/${encodeURIComponent(videoId)}/download`, { method: "DELETE" });
  }

  removeFromHistory(historyId: number): Promise<{ ok: true }> {
    return this.request(`/history/${historyId}`, { method: "DELETE" });
  }

  logout(): Promise<{ ok: true }> {
    return this.request("/auth/logout", { method: "POST", body: "{}" });
  }
}
