import { useContext, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, CheckCircle2, Pencil, Play, ShieldCheck, Tv, UserRound } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { api } from "../api";
import type { DevicePairingVerification } from "../devicePairingApi";
import { Alert, Badge, Button, Field, FormActions, Input, PageHeader, SettingRow, SettingsSection, Stack } from "../components/ui";
import { useI18n } from "../i18n";
import { AppNameContext, useDocumentTitle } from "../useDocumentTitle";
import { normalizePairingCode as normalizeCode, pairingCodeFromLocation } from "../tvPairingCode";
import "./TvPairingPage.css";

export default function TvPairingPage({ appIconColor }: { appIconColor: string }) {
  const appName = useContext(AppNameContext);
  const stageRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();
  useDocumentTitle(t("tvPairingTitle"));
  const location = useLocation();
  const navigate = useNavigate();
  const [code, setCode] = useState(() => pairingCodeFromLocation(location));
  const [verification, setVerification] = useState<DevicePairingVerification | null>(null);
  const [checking, setChecking] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState(false);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    if (verification) stageRef.current?.focus();
  }, [verification, approved]);

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
      const search = new URLSearchParams(location.search);
      search.delete("code");
      navigate({ pathname: location.pathname, search: search.toString(), hash: `#code=${result.user_code.replace(/-/g, "")}` }, { replace: true });
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
    <div className="tv-pairing-page" data-stage={approved ? "approved" : verification ? "confirm" : "code"}>
      <div className="tv-pairing-connection" aria-hidden="true">
        <div className="tv-pairing-brand">
          <span className="tv-pairing-logo" style={{ background: appIconColor }}><Play fill="currentColor" /></span>
          <span className="tv-pairing-brand-name">{appName}</span>
        </div>
        <div className="tv-pairing-link"><span /><span /><span /></div>
        <div className="tv-pairing-television">
          <div className="tv-pairing-screen">{approved ? <Check /> : <Play fill="currentColor" />}</div>
          <span className="tv-pairing-stand" />
        </div>
      </div>

      <PageHeader className="tv-pairing-heading" title={approved ? t("tvPairingApprovedTitle") : t("tvPairingTitle")}
        description={approved ? undefined : t(verification ? "tvPairingConfirmDescription" : "tvPairingDescription")} />

      <SettingsSection className="tv-pairing-card">
        {!verification ? (
          <Stack as="form" gap={4} onSubmit={(event) => { event.preventDefault(); if (!checking) void check(); }} aria-busy={checking}>
            <Field label={t("tvPairingCodeLabel")} htmlFor="tv-pairing-code">
              <Input
                ref={codeRef}
                id="tv-pairing-code"
                className="tv-pairing-code"
                value={code}
                maxLength={9}
                autoComplete="one-time-code"
                autoCapitalize="characters"
                spellCheck={false}
                inputMode="text"
                autoFocus
                disabled={checking}
                aria-invalid={error}
                aria-describedby={error ? "tv-pairing-code-error" : "tv-pairing-code-hint"}
                onChange={(event) => {
                  setCode(normalizeCode(event.target.value));
                  setError(false);
                }}
              />
              {error
                ? <Alert id="tv-pairing-code-error" variant="danger">{t("tvPairingInvalid")}</Alert>
                : <p id="tv-pairing-code-hint" className="tv-pairing-hint">{t("tvPairingCodeHint")}</p>}
            </Field>
            <Button variant="primary" type="submit" trailingIcon={<ArrowRight />} disabled={checking || code.length !== 9}>
              {checking ? t("tvPairingChecking") : t("tvPairingCheck")}
            </Button>
          </Stack>
        ) : (
          <div ref={stageRef} tabIndex={-1} className="tv-pairing-confirmation" aria-label={approved ? t("tvPairingApprovedTitle") : t("tvPairingDevice")}>
            <Stack gap={4}>
              <div className="tv-pairing-code-summary">
                <Badge variant={approved ? "success" : "accent"}>{verification.user_code}</Badge>
                {!approved && <Button variant="ghost" size="sm" leadingIcon={<Pencil />} disabled={approving} onClick={() => {
                  setVerification(null);
                  setError(false);
                  requestAnimationFrame(() => codeRef.current?.focus());
                }}>{t("edit")}</Button>}
              </div>
              <div className="tv-pairing-details">
                <SettingRow label={<span className="tv-pairing-detail-label"><Tv />{t("tvPairingDevice")}</span>}><strong>{verification.device_name}</strong></SettingRow>
                <SettingRow label={<span className="tv-pairing-detail-label"><UserRound />{t("tvPairingProfile")}</span>}><strong>{verification.profile_name}</strong></SettingRow>
              </div>
              {approved ? (
                <Alert variant="success" icon={<CheckCircle2 />} title={t("tvPairingAlreadyApproved")}>
                  {t("tvPairingApprovedDescription")}
                </Alert>
              ) : (
                <>
                  <Alert icon={<ShieldCheck />} title={t("tvPairingSecurityTitle")}>
                    {t("tvPairingSecurityDescription")}
                  </Alert>
                  {error && <Alert variant="danger">{t("tvPairingApprovalFailed")}</Alert>}
                  <FormActions className="tv-pairing-approve">
                    <Button variant="primary" leadingIcon={<Tv />} onClick={() => void approve()} disabled={approving}>
                      {approving ? t("tvPairingApproving") : t("tvPairingApprove")}
                    </Button>
                  </FormActions>
                </>
              )}
            </Stack>
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
