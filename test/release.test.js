import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { zusammen } = createRequire(import.meta.url)("../scripts/latest-mac-zusammen.cjs");

test("Release: latest-mac.yml beider Mac-Builds enthält beide Architekturen", () => {
  const arm = "version: 0.1.0-beta.1\nfiles:\n  - url: A-0.1.0-beta.1-mac-arm64.zip\n    sha512: aaa\n    size: 1\n  - url: A-0.1.0-beta.1-mac-arm64.dmg\n    sha512: bbb\n    size: 2\npath: A-0.1.0-beta.1-mac-arm64.zip\nsha512: aaa\nreleaseDate: '2026-11-15T00:00:00.000Z'\n";
  const x64 = arm.replace(/arm64/g, "x64").replace(/aaa/g, "ccc").replace(/bbb/g, "ddd");
  const r = zusammen([arm, x64]);
  assert.equal((r.match(/- url:/g) || []).length, 4);
  assert.match(r, /^version: 0\.1\.0-beta\.1\nfiles:\n/);
  assert.match(r, /mac-x64\.dmg/);
  assert.match(r, /\npath: A-0\.1\.0-beta\.1-mac-arm64\.zip\nsha512: aaa\nreleaseDate/);
});
