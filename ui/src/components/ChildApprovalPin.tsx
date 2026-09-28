import { useState } from "react";
import { X } from "lucide-react";
import { useI18n } from "../i18n";
import { ProfileAvatar } from "./ProfileMenu";
import { Button, IconButton, Input } from "./ui";

export interface ChildApprovalProfile {
  name: string;
  avatar: string;
  avatar_color: string;
}

/**
 * Confirmation for anything a parent grants a child profile: more watch time,
 * a requested download. Every approval surface shares this dialog so the
 * app-wide child lock PIN is always asked for the same way, and a wrong PIN
 * always counts against the same lockout on the server.
 */
export default function ChildApprovalPin({ profile, title, onCancel, onConfirm }: {
  profile: ChildApprovalProfile;
  title: string;
  onCancel: () => void;
  onConfirm: (pin: string) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const confirm = async (value: string) => {
    if (confirming) return;
    if (!/^\d{6}$/.test(value)) { setError(true); return; }
    setConfirming(true);
    const approved = await onConfirm(value);
    setConfirming(false);
    if (!approved) { setError(true); setPin(""); }
  };

  return (
    <div className="profile-pin-backdrop" onClick={onCancel}>
      <form
        className="profile-pin-modal"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => { event.preventDefault(); void confirm(pin); }}
      >
        <IconButton className="profile-pin-close" label={t("close")} onClick={onCancel}>
          <X size={18} />
        </IconButton>
        <ProfileAvatar profile={profile} size={56} />
        <div className="profile-pin-title">{title}</div>
        <div className="profile-pin-hint">{t("childApprovePinHint")}</div>
        <Input
          className={`profile-pin-input${error ? " error" : ""}`}
          type="password"
          inputMode="numeric"
          autoFocus
          maxLength={6}
          value={pin}
          placeholder="••••••"
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "").slice(0, 6);
            setPin(digits);
            setError(false);
            if (digits.length === 6) void confirm(digits);
          }}
        />
        <Button type="submit" variant="primary" disabled={pin.length !== 6 || confirming}>{t("childApprove")}</Button>
      </form>
    </div>
  );
}
