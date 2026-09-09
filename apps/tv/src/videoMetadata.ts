import { localeTags } from "./i18n";
import type { Language, Video } from "./types";

type RelativeUnit = "minute" | "hour" | "day" | "month" | "year";
type RelativeTimeFormatConstructor = new (
  locales?: Intl.LocalesArgument,
  options?: Intl.RelativeTimeFormatOptions,
) => Intl.RelativeTimeFormat;

const fallbackNow: Record<Language, string> = {
  en: "now",
  pl: "teraz",
  de: "jetzt",
  fr: "à l’instant",
  es: "ahora",
  "pt-BR": "agora",
  ru: "сейчас",
  ja: "たった今",
  hu: "most",
};

const fallbackUnits: Record<Language, Record<RelativeUnit, readonly [string, string]>> = {
  en: { minute: ["minute", "minutes"], hour: ["hour", "hours"], day: ["day", "days"], month: ["month", "months"], year: ["year", "years"] },
  pl: { minute: ["min", "min"], hour: ["godz.", "godz."], day: ["dzień", "dni"], month: ["mies.", "mies."], year: ["rok", "lat"] },
  de: { minute: ["Min.", "Min."], hour: ["Std.", "Std."], day: ["Tag", "Tagen"], month: ["Monat", "Monaten"], year: ["Jahr", "Jahren"] },
  fr: { minute: ["min", "min"], hour: ["h", "h"], day: ["j", "j"], month: ["mois", "mois"], year: ["an", "ans"] },
  es: { minute: ["min", "min"], hour: ["h", "h"], day: ["día", "días"], month: ["mes", "meses"], year: ["año", "años"] },
  "pt-BR": { minute: ["min", "min"], hour: ["h", "h"], day: ["dia", "dias"], month: ["mês", "meses"], year: ["ano", "anos"] },
  ru: { minute: ["мин.", "мин."], hour: ["ч", "ч"], day: ["дн.", "дн."], month: ["мес.", "мес."], year: ["г.", "г."] },
  ja: { minute: ["分", "分"], hour: ["時間", "時間"], day: ["日", "日"], month: ["か月", "か月"], year: ["年", "年"] },
  hu: { minute: ["perc", "perc"], hour: ["óra", "óra"], day: ["nap", "nap"], month: ["hónap", "hónap"], year: ["év", "év"] },
};

function relativeTimeConstructor(): RelativeTimeFormatConstructor | null {
  const constructor = (Intl as typeof Intl & { RelativeTimeFormat?: RelativeTimeFormatConstructor }).RelativeTimeFormat;
  return typeof constructor === "function" ? constructor : null;
}

function fallbackRelativeTime(amount: number, unit: RelativeUnit, language: Language): string {
  if (amount === 0) return fallbackNow[language];
  const value = Math.abs(amount);
  const [singular, plural] = fallbackUnits[language][unit];
  const label = value === 1 ? singular : plural;
  const past = amount > 0;
  switch (language) {
    case "en": return past ? `${value} ${label} ago` : `in ${value} ${label}`;
    case "pl": return past ? `${value} ${label} temu` : `za ${value} ${label}`;
    case "de": return past ? `vor ${value} ${label}` : `in ${value} ${label}`;
    case "fr": return past ? `il y a ${value} ${label}` : `dans ${value} ${label}`;
    case "es": return past ? `hace ${value} ${label}` : `dentro de ${value} ${label}`;
    case "pt-BR": return past ? `há ${value} ${label}` : `em ${value} ${label}`;
    case "ru": return past ? `${value} ${label} назад` : `через ${value} ${label}`;
    case "ja": return `${value}${label}${past ? "前" : "後"}`;
    case "hu": {
      const pastLabels: Record<RelativeUnit, string> = { minute: "perce", hour: "órája", day: "napja", month: "hónapja", year: "éve" };
      return past ? `${value} ${pastLabels[unit]}` : `${value} ${label} múlva`;
    }
  }
}

function validDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatVideoViews(views: number | null | undefined, language: Language, label: string): string {
  if (views == null || !Number.isFinite(views)) return "";
  const count = new Intl.NumberFormat(localeTags[language], {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(views);
  return `${count} ${label}`;
}

export function formatVideoAge(
  value: string | null | undefined,
  language: Language,
  now = Date.now(),
  RelativeTimeFormat = relativeTimeConstructor(),
): string {
  const date = validDate(value);
  if (!date) return "";
  const diffMs = now - date.getTime();
  if (!Number.isFinite(diffMs)) return "";
  if (Math.abs(diffMs) < 60_000) {
    if (RelativeTimeFormat) {
      try {
        return new RelativeTimeFormat(localeTags[language], { numeric: "auto", style: "short" }).format(0, "second");
      } catch { /* Hermes may expose an incomplete Intl implementation. */ }
    }
    return fallbackRelativeTime(0, "minute", language);
  }
  const minutes = Math.trunc(diffMs / 60_000);
  const hours = Math.trunc(minutes / 60);
  const days = Math.trunc(hours / 24);
  const months = Math.trunc(days / 30);
  const years = Math.trunc(days / 365);
  const [amount, unit]: [number, RelativeUnit] = Math.abs(minutes) < 60
    ? [minutes, "minute"]
    : Math.abs(hours) < 24
      ? [hours, "hour"]
      : Math.abs(days) < 30
        ? [days, "day"]
        : Math.abs(months) < 12
          ? [months, "month"]
          : [years, "year"];
  if (RelativeTimeFormat) {
    try {
      return new RelativeTimeFormat(localeTags[language], { numeric: "always", style: "short" }).format(-amount, unit);
    } catch { /* Fall through to the tvOS-safe formatter below. */ }
  }
  return fallbackRelativeTime(amount, unit, language);
}

export function formatVideoCardMetadata(video: Video, language: Language, viewsLabel: string, now = Date.now()): string {
  return [
    formatVideoViews(video.views, language, viewsLabel),
    formatVideoAge(video.published_at, language, now),
  ].filter(Boolean).join("  •  ");
}
