import { useEffect, useState } from "react";
import { CheckCircle2, ShieldCheck, Tv } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { api, type DevicePairingVerification } from "../api";
import { Alert, Button, Field, FormActions, Input, PageHeader, SettingRow, SettingsSection, Stack } from "../components/ui";
import { useI18n } from "../i18n";
import { useDocumentTitle } from "../useDocumentTitle";
import "./TvPairingPage.css";

function normalizeCode(value: string): string {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return compact.length > 4 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : compact;
}

export default function TvPairingPage() {
  const { t } = useI18n();
  useDocumentTitle(t("tvPairingTitle"));
  const [searchParams, setSearchParams] = useSearchParams();
  const [code, setCode] = useState(() => normalizeCode(searchParams.get("code") ?? ""));
  const [verification, setVerification] = useState<DevicePairingVerification | null>(null);
  const [checking, setChecking] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState(false);
  const [approved, setApproved] = useState(false);

  const check = async (candidate = code) => {
    const normalized = normalizeCode(candidate);
    if (normalized.length !== 9) {
      setVerification(null);
      setError(true);
      return;
    }
    setChecking(true);
    setError(false);
    try {
      const result = await api.devicePairingVerification(normalized);
      setVerification(result);
      setApproved(result.approved);
      setSearchParams({ code: result.user_code }, { replace: true });
    } catch {
      setVerification(null);
      setError(true);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (code.length === 9) void check(code);
    // The QR deep link should be checked once on entry, not after every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const approve = async () => {
    if (!verification || approving || approved) return;
    setApproving(true);
    setError(false);
    try {
      await api.authorizeDevice(verification.user_code);
      setApproved(true);
      setVerification((current) => current ? { ...current, approved: true } : current);
    } catch {
      setError(true);
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="tv-pairing-page">
      <PageHeader icon={<Tv />} title={t("tvPairingTitle")} description={t("tvPairingDescription")} />
      <Stack gap={4}>
        <SettingsSection>
          <Stack as="form" gap={3} onSubmit={(event) => { event.preventDefault(); void check(); }}>
            <Field label={t("tvPairingCodeLabel")} hint={t("tvPairingCodeHint")} error={error ? t("tvPairingInvalid") : undefined} htmlFor="tv-pairing-code">
              <Input
                id="tv-pairing-code"
                className="tv-pairing-code"
                value={code}
                maxLength={9}
                autoComplete="one-time-code"
                inputMode="text"
                onChange={(event) => {
                  setCode(normalizeCode(event.target.value));
                  setVerification(null);
                  setApproved(false);
                  setError(false);
                }}
              />
            </Field>
            <FormActions align="start">
              <Button variant="primary" type="submit" disabled={checking || code.length !== 9}>
                {checking ? t("tvPairingChecking") : t("tvPairingCheck")}
              </Button>
            </FormActions>
          </Stack>
        </SettingsSection>

        {verification && (
          <SettingsSection>
            <SettingRow label={t("tvPairingDevice")}><strong>{verification.device_name}</strong></SettingRow>
            <SettingRow label={t("tvPairingProfile")}><strong>{verification.profile_name}</strong></SettingRow>
            <FormActions align="start">
              <Button variant="primary" leadingIcon={<Tv />} onClick={() => void approve()} disabled={approving || approved}>
                {approving ? t("tvPairingApproving") : approved ? t("tvPairingAlreadyApproved") : t("tvPairingApprove")}
              </Button>
            </FormActions>
          </SettingsSection>
        )}

        {approved && (
          <Alert variant="success" icon={<CheckCircle2 />} title={t("tvPairingApprovedTitle")}>
            {t("tvPairingApprovedDescription")}
          </Alert>
        )}

        <Alert icon={<ShieldCheck />} title={t("tvPairingSecurityTitle")}>
          {t("tvPairingSecurityDescription")}
        </Alert>
      </Stack>
    </div>
  );
}
