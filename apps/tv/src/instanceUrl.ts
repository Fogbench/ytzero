function privateNetworkHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host === "::1") return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true;
  const match = host.match(/^172\.(\d{1,2})\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

export function normalizeInstanceUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("empty instance URL");
  const explicitScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
  const tentativeHost = trimmed.replace(/^\/\//, "").split(/[/:]/, 1)[0] ?? "";
  const source = explicitScheme
    ? trimmed
    : `${privateNetworkHost(tentativeHost) ? "http" : "https"}://${trimmed.replace(/^\/\//, "")}`;
  const url = new URL(source);
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new Error("unsupported instance URL");
  }
  if (url.pathname !== "/" && url.pathname !== "/api" && url.pathname !== "/api/") {
    throw new Error("YT Zero must be served from the origin root");
  }
  return url.origin;
}

export function isCleartextInstance(instanceUrl: string): boolean {
  return new URL(instanceUrl).protocol === "http:";
}
