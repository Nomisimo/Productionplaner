import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Gerüst: app.json hat Protokoll und andere App", () => {
  const cfg = JSON.parse(fs.readFileSync(new URL("../src/app.json", import.meta.url), "utf8"));
  assert.match(cfg.protokoll, /^(materialplaner|productionplaner)$/);
  assert.notEqual(cfg.protokoll, cfg.andereApp);
});
