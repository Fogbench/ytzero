import { useState } from "react";
import { ArrowDownToLine, Check, LoaderCircle, Sparkles, X } from "lucide-react";
import { Link } from "react-router-dom";
import type { ChildDownloadRequest } from "../api";
import type { ChildDownloadResolveOutcome } from "../useChildDownloadRequests";
import { formatAppDate, parseAppTimestamp } from "../dateTime";
import { useI18n } from "../i18n";
import { img } from "../img";
import { Button } from "./ui";
import ChildApprovalPin from "./ChildApprovalPin";
import { ProfileAvatar } from "./ProfileMenu";
import { VideoThumbnail } from "./VideoThumbnail";
import "./ChildProfiles.css";

export type ResolveChildDownloadRequest = (
  request: ChildDownloadRequest,
  action: "approve" | "deny",
  pin?: string,
) => Promise<ChildDownloadResolveOutcome>;

/**
 * One pending download request with its decision. Used by the child-activity
 * shortcut and by its home-feed fallback, so a parent approves the same way
 * wherever the request reaches them.
 */
export default function ChildDownloadRequestCard({ request, resolve }: {
  request: ChildDownloadRequest;
  resolve: ResolveChildDownloadRequest;
}) {
  const { t } = useI18n();
  const [pinOpen, setPinOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const decide = async (action: "approve" | "deny", pin?: string) => {
    setBusy(true);
    setFailed(false);
    const outcome = await resolve(request, action, pin);
    setBusy(false);
    // Only a wrong PIN is worth another try in the dialog; anything else (the
    // download queue is off, the video is gone) has to be said out loud.
    if (outcome === "failed") { setPinOpen(false); setFailed(true); }
    return outcome === "ok";
  };

  return (
    <article className="child-request">
      <div className="child-request-head">
        <ProfileAvatar profile={request} size={32} />
        <span className="child-request-who">
          <strong>{t("childDownloadRequestTitle", { name: request.name })}</strong>
          <small>{t("childDownloadRequestSubtitle")}</small>
        </span>
      </div>

      <Link className="child-request-video" to={`/watch/${request.video_id}`}>
        <VideoThumbnail src={img(request.thumbnail)} watched={false} variant="childWatching" loading="lazy" />
        <span className="child-request-copy">
          <strong>{request.title || request.video_id}</strong>
          {request.channel_title && <span className="child-request-author">{request.channel_title}</span>}
        </span>
      </Link>

      <div className="child-request-actions">
        <Button size="sm" disabled={busy} leadingIcon={<X size={14} />} onClick={() => void decide("deny")}>
          {t("childDownloadRequestDeny")}
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={busy}
          leadingIcon={<ArrowDownToLine size={14} />}
          onClick={() => request.requires_pin ? setPinOpen(true) : void decide("approve")}
        >
          {t("childApprove")}
        </Button>
      </div>

      {failed && <p className="child-request-error">{t("childDownloadRequestResolveFailed")}</p>}

      {pinOpen && (
        <ChildApprovalPin
          profile={request}
          title={t("childDownloadRequestApproveTitle")}
          onCancel={() => setPinOpen(false)}
          onConfirm={async (pin) => {
            const approved = await decide("approve", pin);
            if (approved) setPinOpen(false);
            return approved;
          }}
        />
      )}
    </article>
  );
}

/** Already-decided requests, including the ones an auto-approval rule settled. */
export function ChildDownloadRequestHistory({ history }: { history: ChildDownloadRequest[] }) {
  const { t, locale, timeZone } = useI18n();
  if (history.length === 0) return null;
  return (
    <div className="child-request-history">
      <div className="child-request-history-title">{t("childDownloadRequestHistory")}</div>
      {history.map((request) => {
        // A granted request is only half the answer until the file is there.
        const fetching = request.status === "approved"
          && (request.download_status === "queued" || request.download_status === "downloading");
        return (
          <Link className="child-request-history-row" key={request.id} to={`/watch/${request.video_id}`}>
            <span className={`child-request-history-mark child-request-history-mark--${request.status}`} aria-hidden="true">
              {fetching ? <LoaderCircle className="spin" size={12} />
                : request.status === "denied" ? <X size={12} />
                : request.auto ? <Sparkles size={12} /> : <Check size={12} />}
            </span>
            <span className="child-request-history-copy">
              <strong>{request.title || request.video_id}</strong>
              <small>
                {request.name}
                {" · "}
                {request.status === "denied" ? t("childDownloadRequestDenied")
                  : fetching ? t(request.download_status === "queued" ? "downloadQueued" : "downloading")
                  : request.auto ? t("childDownloadRequestAuto") : t("childDownloadRequestApproved")}
                {" · "}
                {formatAppDate(parseAppTimestamp(request.created_at), locale, timeZone, { day: "2-digit", month: "short" })}
              </small>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
