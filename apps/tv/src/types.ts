export type Language = "en" | "pl" | "de" | "fr" | "es" | "pt-BR" | "ru" | "ja" | "hu";

export type PairingAuthorization = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresIn: number;
  interval: number;
};

export type Video = {
  video_id: string;
  title: string;
  description: string;
  thumbnail: string;
  channel_title: string;
  published_at: string | null;
  duration: string | null;
  live_status: "none" | "upcoming" | "live" | "was_live";
  watched: number | null;
  status: "inbox" | "queued" | "archived";
};

export type StoredSession = {
  instanceUrl: string;
  accessToken: string;
};
