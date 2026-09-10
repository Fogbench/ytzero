import { expect, test } from "bun:test";
import { formatQueueCount } from "./queueCount";
import { localeTags } from "./i18n";
import { queueCountMessages } from "./queueMessages";
import type { Language } from "./types";

test("Polish queue counts use singular, few and many, including teens and compound numbers", () => {
  for (const [count, expected] of [[0, "0 filmów"], [1, "1 film"], [2, "2 filmy"], [5, "5 filmów"], [12, "12 filmów"], [21, "21 filmów"], [22, "22 filmy"], [101, "101 filmów"], [102, "102 filmy"]] as const) {
    expect(formatQueueCount(count, "pl")).toBe(expected);
  }
});

test("every supported locale translates every plural category with a count placeholder", () => {
  for (const language of Object.keys(localeTags) as Language[]) {
    for (const category of new Intl.PluralRules(localeTags[language]).resolvedOptions().pluralCategories) {
      expect(queueCountMessages[language][category]).toContain("{count}");
    }
  }
  expect(formatQueueCount(1, "en")).toBe("1 video");
  expect(formatQueueCount(2, "en")).toBe("2 videos");
  expect(formatQueueCount(3, "ja")).toBe("3本の動画");
});
