const MINIMUM_DENO_MAJOR = 2;
const MINIMUM_DENO_MINOR = 3;

export type DenoRuntime = { path: string; version: string };

/** An old installation early in PATH must not hide a supported later one. */
export async function selectDenoRuntime(
  candidates: string[],
  versionOutput: (path: string) => Promise<string | null>,
): Promise<DenoRuntime | null> {
  for (const path of new Set(candidates)) {
    const output = await versionOutput(path).catch(() => null);
    const version = output ? supportedDenoVersion(output) : null;
    if (version) return { path, version };
  }
  return null;
}

export function denoRuntimeArgs(runtime: DenoRuntime | null): string[] {
  return runtime ? ["--js-runtimes", `deno:${runtime.path}`] : [];
}

/** Return a supported Deno version from `deno --version`, otherwise null. */
export function supportedDenoVersion(output: string): string | null {
  const match = output.match(/^deno\s+(\d+)\.(\d+)\.(\d+)/im);
  if (!match) return null;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (major < MINIMUM_DENO_MAJOR || (major === MINIMUM_DENO_MAJOR && minor < MINIMUM_DENO_MINOR)) return null;
  return `${major}.${minor}.${Number(match[3])}`;
}
