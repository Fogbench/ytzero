/// <reference types="bun" />

import { describe, expect, test } from "bun:test";
import { isCleartextInstance, normalizeInstanceUrl } from "./instanceUrl";

describe("YT Zero instance URL", () => {
  test("defaults private-network hosts to HTTP", () => {
    expect(normalizeInstanceUrl("192.168.1.8:3001")).toBe("http://192.168.1.8:3001");
    expect(normalizeInstanceUrl("ytzero.local")).toBe("http://ytzero.local");
  });

  test("defaults public hosts to HTTPS", () => {
    expect(normalizeInstanceUrl("video.example.com/")).toBe("https://video.example.com");
  });

  test("accepts an API root but rejects subpaths and credentials", () => {
    expect(normalizeInstanceUrl("https://video.example.com/api")).toBe("https://video.example.com");
    expect(() => normalizeInstanceUrl("https://video.example.com/ytzero")).toThrow();
    expect(() => normalizeInstanceUrl("https://user:secret@video.example.com")).toThrow();
  });

  test("identifies cleartext instances", () => {
    expect(isCleartextInstance("http://ytzero.local")).toBe(true);
    expect(isCleartextInstance("https://video.example.com")).toBe(false);
  });
});
