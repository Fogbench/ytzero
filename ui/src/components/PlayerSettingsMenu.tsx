import { ChevronRight, LoaderCircle, Settings } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../i18n";
import { qualityLabel, type DirectQuality, type QualityMode } from "../playerQuality";
import { FloatingPopover, Menu, MenuHeader, MenuItem, MenuSeparator, ScrollArea, Switch } from "./ui";

interface PlayerSettingsMenuProps {
  /** Qualities this browser can play, best first. */
  qualities: DirectQuality[];
  loading: boolean;
  mode: QualityMode;
  /** What is actually playing, shown next to "Quality". */
  active: DirectQuality | null;
  onModeChange: (mode: QualityMode) => void;
}

/** The gear next to CC. Today it holds Quality; speed and others can become more rows. */
export default function PlayerSettingsMenu({ qualities, loading, mode, active, onModeChange }: PlayerSettingsMenuProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"main" | "quality">("main");

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) setPanel("main");
  };
  const choose = (next: QualityMode) => {
    onModeChange(next);
    changeOpen(false);
  };
  // Turning the active auto switch off pins what is playing right now.
  const toggleAuto = (target: "auto" | "auto-mp4") => (on: boolean) => {
    if (on) onModeChange(target);
    else if (active) onModeChange(active.id);
  };
  const summary = mode === "auto" ? `${t("playerQualityAuto")}${active ? ` (${qualityLabel(active)})` : ""}`
    : mode === "auto-mp4" ? `${t("playerQualityAutoMp4")}${active ? ` (${qualityLabel(active)})` : ""}`
    : active ? qualityLabel(active) : "";

  return (
    <div className="lp-sub-menu-wrap">
      <FloatingPopover
        open={open}
        onOpenChange={changeOpen}
        align="end"
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
            <div className="lp-sub-toggle">
              <span>{t("playerQualityAuto")}</span>
              <Switch checked={mode === "auto"} onCheckedChange={toggleAuto("auto")} ariaLabel={t("playerQualityAuto")} />
            </div>
            <div className="lp-sub-toggle">
              <span>{t("playerQualityAutoMp4")}</span>
              <Switch checked={mode === "auto-mp4"} onCheckedChange={toggleAuto("auto-mp4")} ariaLabel={t("playerQualityAutoMp4")} />
            </div>
            <ScrollArea className="lp-sub-menu-list-wrap" viewportClassName="lp-sub-menu-list">
              <Menu>
                {qualities.map((quality) => (
                  <MenuItem
                    key={quality.id}
                    selected={active?.id === quality.id}
                    onClick={() => choose(quality.id)}
                  >
                    {qualityLabel(quality)}
                  </MenuItem>
                ))}
                {qualities.length === 0 && <MenuItem disabled>{t("playerQualityNone")}</MenuItem>}
              </Menu>
            </ScrollArea>
          </>
        )}
      </FloatingPopover>
    </div>
  );
}
