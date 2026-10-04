import { Captions, Check, LoaderCircle } from "lucide-react";
import { useState } from "react";
import type { AvailableSubtitle } from "../api";
import { useI18n } from "../i18n";
import { FloatingPopover, Menu, MenuItem, MenuSeparator, ScrollArea, Switch } from "./ui";

interface SubtitleMenuBodyProps {
  available: AvailableSubtitle[];
  selectedLanguage: string | null;
  preferredLanguages: string[];
  loadingLanguage: string | null;
  errorLanguage: string | null;
  onSelect: (language: string) => void;
  onToggle: () => void;
}

/** The on/off switch and language list. Shared by the CC button and the gear menu. */
export function SubtitleMenuBody({
  available,
  selectedLanguage,
  preferredLanguages,
  loadingLanguage,
  errorLanguage,
  onSelect,
  onToggle,
}: SubtitleMenuBodyProps) {
  const { t } = useI18n();
  const availableByLanguage = new Map(available.map((subtitle) => [subtitle.lang, subtitle]));
  const preferred = [...new Set(preferredLanguages.filter(Boolean))]
    .map((language) => availableByLanguage.get(language))
    .filter((language): language is AvailableSubtitle => Boolean(language));
  const preferredSet = new Set(preferred.map((language) => language.lang));
  const remaining = available.filter((subtitle) => !preferredSet.has(subtitle.lang));

  const status = (language: string) => (
    <span className="lp-sub-option-status">
      {selectedLanguage === language && <Check size={14} />}
      {loadingLanguage === language && <LoaderCircle className="spin" size={13} />}
      {errorLanguage === language && <span className="lp-sub-error">{t("subtitlesUnavailable")}</span>}
    </span>
  );

  return (
    <>
      <div className="lp-sub-toggle">
        <span>{t("subtitles")}</span>
        <Switch checked={Boolean(selectedLanguage)} onCheckedChange={onToggle} />
      </div>
      <ScrollArea className="lp-sub-menu-list-wrap" viewportClassName="lp-sub-menu-list">
        <Menu>
          {preferred.map((language) => (
            <MenuItem
              key={language.lang}
              selected={selectedLanguage === language.lang}
              disabled={loadingLanguage != null}
              onClick={() => onSelect(language.lang)}
              suffix={status(language.lang)}
            >
              {language.label}
            </MenuItem>
          ))}
          {preferred.length > 0 && remaining.length > 0 && <MenuSeparator />}
          {remaining.map((language) => (
            <MenuItem
              key={language.lang}
              disabled={loadingLanguage != null}
              onClick={() => onSelect(language.lang)}
              suffix={status(language.lang)}
            >
              {language.label}
            </MenuItem>
          ))}
          {available.length === 0 && <MenuItem disabled>{t("subtitlesNoneAvailable")}</MenuItem>}
        </Menu>
      </ScrollArea>
    </>
  );
}

interface SubtitlePickerProps extends Omit<SubtitleMenuBodyProps, "onSelect"> {
  videoId?: string;
  onSelect: (language: string | null) => void;
}

export default function SubtitlePicker({ videoId, onSelect, onToggle, ...menu }: SubtitlePickerProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  if (!videoId) return null;

  const select = (language: string) => {
    setOpen(false);
    onSelect(language);
  };
  const toggle = () => {
    setOpen(false);
    onToggle();
  };

  return (
    <div className="lp-sub-menu-wrap">
      <FloatingPopover
        open={open}
        onOpenChange={setOpen}
        align="end"
        preferTop
        className="lp-sub-menu"
        trigger={
          <button
            className={`lp-btn${menu.selectedLanguage ? " active" : ""}`}
            aria-label={t("subtitles")}
            aria-pressed={Boolean(menu.selectedLanguage)}
          >
            {menu.loadingLanguage ? <LoaderCircle className="spin" size={19} /> : <Captions size={20} />}
          </button>
        }
      >
        <SubtitleMenuBody {...menu} onSelect={select} onToggle={toggle} />
      </FloatingPopover>
    </div>
  );
}
