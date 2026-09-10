import { expect, test } from "bun:test";
import { normalizePairingCode, pairingCodeFromLocation } from "./tvPairingCode";

test("QR fragment prefills the formatted pairing code", () => {
  expect(pairingCodeFromLocation({ hash: "#code=ABCDEFGH", search: "" })).toBe("ABCD-EFGH");
  expect(pairingCodeFromLocation({ hash: "#code=abcd-efgh", search: "" })).toBe("ABCD-EFGH");
});

test("previous query links keep working and the fragment takes precedence", () => {
  expect(pairingCodeFromLocation({ hash: "", search: "?code=ABCD-EFGH" })).toBe("ABCD-EFGH");
  expect(pairingCodeFromLocation({ hash: "#code=12345678", search: "?code=ABCD-EFGH" })).toBe("1234-5678");
  expect(pairingCodeFromLocation({ hash: "", search: "" })).toBe("");
});

test("manual entry supports spaces, lowercase and partial codes", () => {
  expect(normalizePairingCode("abcd efgh")).toBe("ABCD-EFGH");
  expect(normalizePairingCode("abc")).toBe("ABC");
  expect(normalizePairingCode("abcd e")).toBe("ABCD-E");
});
