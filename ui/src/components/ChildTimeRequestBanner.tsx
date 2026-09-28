import { useCallback, useEffect, useState } from "react";
import "./ChildProfiles.css";
import { X } from "lucide-react";
import { api, type ChildGrant, type ChildTimeRequest } from "../api";
import { useI18n, type I18nKey } from "../i18n";
import ChildApprovalPin from "./ChildApprovalPin";
import { ProfileAvatar } from "./ProfileMenu";
import { Button, IconButton } from "./ui";
import { subscribeServerEvent } from "../serverEvents";
import { parseAppTimestamp } from "../dateTime";

const GRANTS: { grant: ChildGrant; labelKey: I18nKey }[] = [
  { grant: "15m", labelKey: "childGrant15m" },
  { grant: "1h", labelKey: "childGrant1h" },
  { grant: "video_end", labelKey: "childGrantVideoEnd" },
  { grant: "today_off", labelKey: "childGrantTodayOff" },
];

// Shown on the home feed of non-child profiles while a child's "more time"
// request is pending (the server expires requests after an hour). Approving
// asks for the child profile's PIN when one is set.
export default function ChildTimeRequestBanner() {
  const { t } = useI18n();
  const [requests, setRequests] = useState<ChildTimeRequest[]>([]);
  const [pinFor, setPinFor] = useState<{ request: ChildTimeRequest; grant: ChildGrant } | null>(null);

  const load = useCallback(() => {
    api.childTimeRequests().then((r) => setRequests(r.requests)).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    return subscribeServerEvent("child-requests", load);
  }, [load]);

  useEffect(() => {
    if (requests.length === 0) return;
    const nextExpiry = Math.min(...requests.map((request) => parseAppTimestamp(request.created_at).getTime() + 60 * 60_000));
    const timer = window.setTimeout(load, Math.max(0, nextExpiry - Date.now()) + 250);
    return () => window.clearTimeout(timer);
  }, [requests, load]);

  const resolve = async (request: ChildTimeRequest, grant?: ChildGrant, enteredPin?: string) => {
    try {
      await api.resolveChildTimeRequest(request.id, grant ? "approve" : "dismiss", grant, enteredPin);
      setPinFor(null);
      load();
      return true;
    } catch {
      return false;
    }
  };

  const onGrant = (request: ChildTimeRequest, grant: ChildGrant) => {
    if (request.requires_pin) setPinFor({ request, grant });
    else void resolve(request, grant);
  };

  if (requests.length === 0) return null;

  return (
    <>
      {requests.map((r) => (
        <div key={r.id} className="child-time-banner">
          <ProfileAvatar profile={r} size={40} />
          <div className="child-time-banner-main">
            <div className="child-time-banner-title">{t("childTimeRequestTitle", { name: r.name })}</div>
            <div className="child-time-banner-actions">
              {GRANTS.map(({ grant, labelKey }) => (
                <Button key={grant} onClick={() => onGrant(r, grant)}>{t(labelKey)}</Button>
              ))}
            </div>
          </div>
          <IconButton className="child-time-banner-close" label={t("close")} onClick={() => resolve(r)}>
            <X size={16} />
          </IconButton>
        </div>
      ))}

      {pinFor && (
        <ChildApprovalPin
          profile={pinFor.request}
          title={t(GRANTS.find((option) => option.grant === pinFor.grant)!.labelKey)}
          onCancel={() => setPinFor(null)}
          onConfirm={(pin) => resolve(pinFor.request, pinFor.grant, pin)}
        />
      )}
    </>
  );
}
