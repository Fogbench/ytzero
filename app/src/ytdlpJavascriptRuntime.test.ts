import { describe, expect, test } from "bun:test";
import { denoRuntimeArgs, selectDenoRuntime, supportedDenoVersion } from "./ytdlpJavascriptRuntime";

describe("yt-dlp JavaScript runtime", () => {
  test("skips an obsolete Deno shadowing a supported installation and pins the working executable", async () => {
    const checked: string[] = [];
    const runtime = await selectDenoRuntime(["/user/.deno/bin/deno", "/user/.deno/bin/deno", "/opt/homebrew/bin/deno"], async (path) => {
      checked.push(path);
      return path.startsWith("/user/") ? "deno 1.46.3\n" : "deno 2.9.6\n";
    });
    expect(checked).toEqual(["/user/.deno/bin/deno", "/opt/homebrew/bin/deno"]);
    expect(runtime).toEqual({ path: "/opt/homebrew/bin/deno", version: "2.9.6" });
    expect(denoRuntimeArgs(runtime)).toEqual(["--js-runtimes", "deno:/opt/homebrew/bin/deno"]);
  });

  test("retains the first supported PATH candidate and safely skips broken executables", async () => {
    const checked: string[] = [];
    const runtime = await selectDenoRuntime(["/broken/deno", "/working path/deno", "/other/deno"], async (path) => {
      checked.push(path);
      if (path === "/broken/deno") throw new Error("not executable");
      return "deno 2.3.0\n";
    });
    expect(checked).toEqual(["/broken/deno", "/working path/deno"]);
    expect(denoRuntimeArgs(runtime)).toEqual(["--js-runtimes", "deno:/working path/deno"]);
    expect(await selectDenoRuntime(["/old/deno"], async () => "deno 2.2.9\n")).toBeNull();
    expect(denoRuntimeArgs(null)).toEqual([]);
  });
  test("accepts the supported Deno release output", () => {
    expect(supportedDenoVersion("deno 2.8.1 (stable, release, aarch64-unknown-linux-gnu)\nv8 14.2"))
      .toBe("2.8.1");
    expect(supportedDenoVersion("deno 3.0.0\n")).toBe("3.0.0");
  });

  test("rejects a missing, malformed, or obsolete runtime", () => {
    expect(supportedDenoVersion("")).toBeNull();
    expect(supportedDenoVersion("node v24.0.0")).toBeNull();
    expect(supportedDenoVersion("deno 2.2.9")).toBeNull();
  });
});
