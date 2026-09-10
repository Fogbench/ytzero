export function normalizePairingCode(value: string): string {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return compact.length > 4 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : compact;
}

export function pairingCodeFromLocation({ hash, search }: { hash: string; search: string }): string {
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  const legacy = new URLSearchParams(search);
  return normalizePairingCode(fragment.get("code") ?? legacy.get("code") ?? "");
}
