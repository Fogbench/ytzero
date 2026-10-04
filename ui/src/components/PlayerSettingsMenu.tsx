import { ChevronRight, LoaderCircle, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import type { AudioEnhanceMode } from "../playerAudioEnhance";
import { SLEEP_TIMER_MINUTES } from "../playerSleepTimer";
import type { AvailableSubtitle } from "../api";
import { useI18n } from "../i18n";
import {
  codecName, heightLabel, qualityRows,
  type DirectQuality, type QualityChoice, type QualityCodec,
} from "../playerQuality";
import { subtitleLanguageLabel } from "../subtitleLanguages";
import { SubtitleMenuBody } from "./SubtitlePicker";
import { ColorPicker, FloatingPopover, Menu, MenuHeader, MenuItem, ScrollArea, Slider, Switch } from "./ui";
import type { SubtitleStyle } from "./LocalPlayer";

interface PlayerSettingsMenuProps {
  /** Quality is only offered for the direct HLS player; leave out for others. */
  quality?: {
    /** Qualities this browser can play, best first. */
    qualities: DirectQuality[];
    loading: boolean;
    choice: QualityChoice;
    /** What is actually playing, shown next to "Quality". */
    active: DirectQuality | null;
    onChoiceChange: (choice: QualityChoice) => void;
  };
  /** Current playback speed, e.g. 1.5. */
  speed: number;
  /** Called while the slider moves: apply the speed to the video only. */
  onSpeedPreview?: (speed: number) => void;
  /** Called when the viewer lets go of the slider: apply and save the speed. */
  onSpeedChange?: (speed: number) => void;
  /** Autoplay switch (go on to the next video); leave out when there is no next video. */
  autoplay?: { enabled: boolean; onToggle: (enabled: boolean) => void };
  /** SponsorBlock switch; leave out when the video has no segments. */
  sponsorBlock?: { active: boolean; onToggle: (active: boolean) => void };
  /** Stable volume and Voice boost switches; leave out when the sound cannot be processed. */
  audioEnhance?: { mode: AudioEnhanceMode; onChange: (patch: Partial<AudioEnhanceMode>) => void };
  /** Sleep timer: minutes left (null = off) and how to set it. */
  sleep: { minutesLeft: number | null; atEnd: boolean; onSet: (value: number | "end" | null) => void };
  /** Tells the player when the subtitle style panel is open, so it can show a sample line. */
  onStylePreview?: (showing: boolean) => void;
  /** Subtitles row; same data the CC button uses. Leave out when there is no video id. */
  subtitles?: {
    available: AvailableSubtitle[];
    selectedLanguage: string | null;
    preferredLanguages: string[];
    loadingLanguage: string | null;
    errorLanguage: string | null;
    onSelect: (language: string) => void;
    onToggle: () => void;
    /** Current look of the subtitles, and how to change it (no function: hide the options). */
    style: SubtitleStyle;
    onStyleChange?: (style: Partial<SubtitleStyle>) => void;
  };
}

// The colors YouTube offers for subtitle text.
const SUBTITLE_COLORS = ["#ffffff", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff", "#ff0000", "#000000"] as const;

/** The gear next to CC: a list of rows (Playback speed, Quality), each opening its own panel. */
export default function PlayerSettingsMenu({ quality, speed, onSpeedPreview, onSpeedChange, subtitles, autoplay, sponsorBlock, audioEnhance, sleep, onStylePreview }: PlayerSettingsMenuProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"main" | "quality" | "speed" | "subtitles" | "subtitleStyle" | "sleep">("main");
  // While the slider is being dragged we show its own value; null means "use the saved speed".
  const [speedDraft, setSpeedDraft] = useState<number | null>(null);
  const commitSpeed = () => {
    if (speedDraft == null) return;
    onSpeedChange?.(speedDraft);
    setSpeedDraft(null);
  };
  useEffect(() => {
    onStylePreview?.(open && panel === "subtitleStyle");
    return () => onStylePreview?.(false);
  }, [open, panel, onStylePreview]);
  const { qualities = [], loading = false, choice = { height: "auto", codec: "av01" } as QualityChoice, active = null, onChoiceChange = () => {} } = quality ?? {};

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) { commitSpeed(); setPanel("main"); }
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
            {autoplay && (
              <div className="lp-sub-toggle">
                <span>{t("autoplay")}</span>
                <Switch checked={autoplay.enabled} onCheckedChange={autoplay.onToggle} ariaLabel={t("autoplay")} />
              </div>
            )}
            {sponsorBlock && (
              <div className="lp-sub-toggle">
                <span>{t("sponsorblockEnabled")}</span>
                <Switch checked={sponsorBlock.active} onCheckedChange={sponsorBlock.onToggle} ariaLabel={t("sponsorblockEnabled")} />
              </div>
            )}
            {audioEnhance && (
              <>
                <div className="lp-sub-toggle">
                  <span>{t("playerStableVolume")}</span>
                  <Switch checked={audioEnhance.mode.stableVolume} onCheckedChange={(on) => audioEnhance.onChange({ stableVolume: on })} ariaLabel={t("playerStableVolume")} />
                </div>
                <div className="lp-sub-toggle">
                  <span>{t("playerVoiceBoost")}</span>
                  <Switch checked={audioEnhance.mode.voiceBoost} onCheckedChange={(on) => audioEnhance.onChange({ voiceBoost: on })} ariaLabel={t("playerVoiceBoost")} />
                </div>
              </>
            )}
            <MenuItem
              onClick={() => setPanel("sleep")}
              suffix={<span className="lp-settings-value">{sleep.atEnd ? t("playerSleepEndOfVideo") : sleep.minutesLeft === null ? t("subtitlesOff") : t("playerSleepMinutes", { count: sleep.minutesLeft })}<ChevronRight size={15} /></span>}
            >
              {t("playerSleepTimer")}
            </MenuItem>
            {onSpeedChange && (
              <MenuItem
                onClick={() => setPanel("speed")}
                suffix={<span className="lp-settings-value">{speed}×<ChevronRight size={15} /></span>}
              >
                {t("playerSpeed")}
              </MenuItem>
            )}
            {subtitles && (
              <MenuItem
                onClick={() => setPanel("subtitles")}
                suffix={<span className="lp-settings-value">{subtitles.selectedLanguage ? subtitleLanguageLabel(subtitles.selectedLanguage) : t("subtitlesOff")}<ChevronRight size={15} /></span>}
              >
                {t("subtitles")}
              </MenuItem>
            )}
            {quality && <MenuItem
              disabled={qualities.length === 0}
              onClick={() => setPanel("quality")}
              suffix={<span className="lp-settings-value">{summary}<ChevronRight size={15} /></span>}
            >
              {t("playerQuality")}
            </MenuItem>}
          </Menu>
        ) : panel === "sleep" ? (
          <>
            <MenuHeader onBack={() => setPanel("main")} backLabel={t("playerSettings")}>{t("playerSleepTimer")}</MenuHeader>
            <Menu>
              <MenuItem selected={sleep.minutesLeft === null && !sleep.atEnd} onClick={() => { sleep.onSet(null); changeOpen(false); }}>{t("subtitlesOff")}</MenuItem>
              {SLEEP_TIMER_MINUTES.map((minutes) => (
                <MenuItem key={minutes} onClick={() => { sleep.onSet(minutes); changeOpen(false); }}>
                  {t("playerSleepMinutes", { count: minutes })}
                </MenuItem>
              ))}
              <MenuItem selected={sleep.atEnd} onClick={() => { sleep.onSet("end"); changeOpen(false); }}>{t("playerSleepEndOfVideo")}</MenuItem>
            </Menu>
          </>
        ) : panel === "subtitleStyle" && subtitles?.onStyleChange ? (
          <>
            <MenuHeader onBack={() => setPanel("subtitles")} backLabel={t("subtitles")}>{t("subtitleStyleTitle")}</MenuHeader>
            <div className="lp-sub-toggle">
              <span>{t("subtitleColor")}</span>
              <ColorPicker label={t("subtitleColor")} variant="swatch" doneLabel={t("colorPickerDone")} colors={SUBTITLE_COLORS} value={subtitles.style.color} onChange={(color) => subtitles.onStyleChange?.({ color })} />
            </div>
            <div className="lp-sub-toggle">
              <span>{t("subtitleSize")} ({subtitles.style.size}px)</span>
            </div>
            <div className="lp-settings-slider">
              <Slider min={12} max={48} step={1} value={subtitles.style.size} aria-label={t("subtitleSize")} onChange={(size) => subtitles.onStyleChange?.({ size })} />
            </div>
            <div className="lp-sub-toggle">
              <span>{t("subtitleBackground")} ({subtitles.style.bg}%)</span>
            </div>
            <div className="lp-settings-slider">
              <Slider min={0} max={100} step={5} value={subtitles.style.bg} aria-label={t("subtitleBackground")} onChange={(bg) => subtitles.onStyleChange?.({ bg })} />
            </div>
          </>
        ) : panel === "subtitles" && subtitles ? (
          <>
            <MenuHeader onBack={() => setPanel("main")} backLabel={t("playerSettings")}>{t("subtitles")}</MenuHeader>
            {subtitles.onStyleChange && (
              <Menu>
                <MenuItem onClick={() => setPanel("subtitleStyle")} suffix={<span className="lp-settings-value"><ChevronRight size={15} /></span>}>
                  {t("subtitleStyleTitle")}
                </MenuItem>
              </Menu>
            )}
            <SubtitleMenuBody
              {...subtitles}
              onSelect={(language) => { changeOpen(false); subtitles.onSelect(language); }}
              onToggle={() => { changeOpen(false); subtitles.onToggle(); }}
            />
          </>
        ) : panel === "speed" ? (
          <>
            <MenuHeader onBack={() => setPanel("main")} backLabel={t("playerSettings")}>{t("playerSpeed")}</MenuHeader>
            <div className="lp-sub-toggle">
              <span>{(speedDraft ?? speed).toFixed(2)}×</span>
            </div>
            <div className="lp-settings-slider">
              <Slider
                min={0.25}
                max={2}
                step={0.05}
                value={speedDraft ?? speed}
                aria-label={t("playerSpeed")}
                onChange={(next) => { const rate = Math.round(next * 100) / 100; setSpeedDraft(rate); onSpeedPreview?.(rate); }}
                onPointerUp={commitSpeed}
                onKeyUp={commitSpeed}
                onBlur={commitSpeed}
              />
            </div>
          </>
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
