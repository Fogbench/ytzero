import { ChevronRight, LoaderCircle, Settings } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../i18n";
import {
  codecName, heightLabel, qualityRows,
  type DirectQuality, type QualityChoice, type QualityCodec,
} from "../playerQuality";
import { FloatingPopover, Menu, MenuHeader, MenuItem, ScrollArea, Switch } from "./ui";

interface PlayerSettingsMenuProps {
  /** Qualities this browser can play, best first. */
  qualities: DirectQuality[];
  loading: boolean;
  choice: QualityChoice;
  /** What is actually playing, shown next to "Quality". */
  active: DirectQuality | null;
  onChoiceChange: (choice: QualityChoice) => void;
}

/** The gear next to CC. Today it holds Quality; speed and others can become more rows. */
export default function PlayerSettingsMenu({ qualities, loading, choice, active, onChoiceChange }: PlayerSettingsMenuProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"main" | "quality">("main");

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) setPanel("main");
  };
  const otherCodec = (codec: QualityCodec): QualityCodec => (codec === "av01" ? "avc1" : "av01");
  // The two codec switches behave like a pair: one is always on.
  const useCodec = (codec: QualityCodec) => (on: boolean) => {
    const next = on ? codec : otherCodec(codec);
    // Keep a pinned height only if the new codec has it; otherwise go back to Auto.
    const keeps = choice.height !== "auto"
      && qualities.some((quality) => quality.codec === next && quality.height === choice.height);
    onChoiceChange({ height: keeps ? choice.height : "auto", codec: next });
  };
  const rows = qualityRows(choice.codec, qualities);
  const summary = active
    ? `${choice.height === "auto" ? `${t("playerQualityAuto")} ` : ""}${heightLabel(active)}`
    : "";

  return (
    <div className="lp-sub-menu-wrap">
      <FloatingPopover
        open={open}
        onOpenChange={changeOpen}
        align="end"
        preferTop
        className="lp-sub-menu lp-settings-menu"
        trigger={
          <button className="lp-btn" aria-label={t("playerSettings")}>
            {loading ? <LoaderCircle className="spin" size={19} /> : <Settings size={19} />}
          </button>
        }
      >
        {panel === "main" ? (
          <Menu>
            <MenuItem
              disabled={qualities.length === 0}
              onClick={() => setPanel("quality")}
              suffix={<span className="lp-settings-value">{summary}<ChevronRight size={15} /></span>}
            >
              {t("playerQuality")}
            </MenuItem>
          </Menu>
        ) : (
          <>
            <MenuHeader onBack={() => setPanel("main")} backLabel={t("playerSettings")}>{t("playerQuality")}</MenuHeader>
            {(["av01", "avc1"] as const).map((codec) => (
              <div className="lp-sub-toggle" key={codec}>
                <span>{t(codec === "av01" ? "playerQualityUseAv1" : "playerQualityUseMp4")}</span>
                <Switch checked={choice.codec === codec} onCheckedChange={useCodec(codec)} ariaLabel={codecName(codec)} />
              </div>
            ))}
            <ScrollArea className="lp-sub-menu-list-wrap" viewportClassName="lp-sub-menu-list">
              <Menu>
                {active && (
                  <MenuItem
                    selected={choice.height === "auto"}
                    onClick={() => onChoiceChange({ ...choice, height: "auto" })}
                  >
                    {t("playerQualityAuto")}
                  </MenuItem>
                )}
                {rows.map((quality) => (
                  <MenuItem
                    key={quality.height}
                    selected={active?.height === quality.height}
                    onClick={() => onChoiceChange({ height: quality.height, codec: quality.codec })}
                    suffix={quality.codec !== choice.codec ? <span className="lp-settings-value">{t("playerQualityUses", { codec: codecName(quality.codec) })}</span> : undefined}
                  >
                    {heightLabel(quality)}
                  </MenuItem>
                ))}
                {rows.length === 0 && <MenuItem disabled>{t("playerQualityNone")}</MenuItem>}
              </Menu>
            </ScrollArea>
          </>
        )}
      </FloatingPopover>
    </div>
  );
}
