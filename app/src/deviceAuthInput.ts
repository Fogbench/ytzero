export function normalizeDeviceUserCode(value: unknown): string {
  if (typeof value !== "string") return "";
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return compact.length === 8 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : "";
}

export function sanitizeDeviceName(value: unknown): string {
  if (typeof value !== "string") return "YT Zero TV";
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return clean || "YT Zero TV";
}
