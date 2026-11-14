// Release: führt latest-mac-mac-arm64.yml und latest-mac-mac-x64.yml (je ein Mac-Build-Job) zu latest-mac.yml zusammen,
// damit die Update-Prüfung beide Architekturen findet. Einfaches YAML von electron-builder, ohne Zusatzpaket.
const fs = require("fs");
const path = require("path");

/** Zerlegt latest-mac.yml in Kopf, Einträge unter „files:“ (eingerückt) und Rest. */
function zerlege(text) {
  const zeilen = text.replace(/\r/g, "").split("\n");
  const i = zeilen.findIndex((z) => /^files:\s*$/.test(z));
  if (i < 0) return { kopf: zeilen, dateien: [], rest: [] };
  let j = i + 1;
  while (j < zeilen.length && /^\s+\S/.test(zeilen[j])) j++;
  return { kopf: zeilen.slice(0, i), dateien: zeilen.slice(i + 1, j), rest: zeilen.slice(j) };
}

function zusammen(texte) {
  const teile = texte.map(zerlege);
  const dateien = teile.flatMap((t) => t.dateien);
  return [...teile[0].kopf, "files:", ...dateien, ...teile[0].rest].join("\n").replace(/\n*$/, "\n");
}
module.exports = { zusammen };

if (require.main === module) {
  const dir = process.argv[2] || "artefakte";
  const namen = fs.readdirSync(dir).filter((f) => /^latest-mac-.+\.yml$/.test(f)).sort();
  if (!namen.length) { console.log("keine Mac-Update-Dateien"); process.exit(0); }
  fs.writeFileSync(path.join(dir, "latest-mac.yml"), zusammen(namen.map((f) => fs.readFileSync(path.join(dir, f), "utf8"))));
  for (const f of namen) fs.rmSync(path.join(dir, f));
  console.log(`latest-mac.yml aus ${namen.join(", ")}`);
}
