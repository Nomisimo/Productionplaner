// Baut die App nach dist-app/ (Oberfläche als Single-HTML, Hauptprozess, Preload) bzw. mit --web die Browser-Version nach dist-web/.
// Core: Submodule core/ oder LAGER_CORE_DIR (Entwicklung: ../Planer-Lager-Core).
const path = require("path");
const fs = require("fs");
const ROOT = path.join(__dirname, "..");
const coreDir = path.resolve(ROOT, process.env.LAGER_CORE_DIR || "core");
const { baueApp } = require(path.join(coreDir, "scripts", "app-build.cjs"));
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "app.json"), "utf8"));
baueApp({ root: ROOT, titel: cfg.titel, akzent: cfg.akzent, minify: process.argv.includes("--minify"), ziel: process.argv.includes("--web") ? "web" : "electron" })
  .catch((e) => { console.error("Build fehlgeschlagen:", e.message); process.exit(1); });
