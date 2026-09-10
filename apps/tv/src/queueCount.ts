import "./intl";
import { localeTags } from "./i18n";
import { queueCountMessages } from "./queueMessages";
import type { Language } from "./types";

const formatters = new Map<Language, { plural: Intl.PluralRules; number: Intl.NumberFormat }>();

export function formatQueueCount(count: number, language: Language): string {
  const locale = localeTags[language];
  let formatter = formatters.get(language);
  if (!formatter) {
    formatter = { plural: new Intl.PluralRules(locale), number: new Intl.NumberFormat(locale) };
    formatters.set(language, formatter);
  }
  const category = formatter.plural.select(count);
  const forms = queueCountMessages[language];
  return (forms[category] ?? forms.other).replace("{count}", formatter.number.format(count));
}
