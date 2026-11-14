// Hauptprozess: gemeinsame Hülle aus @lager/shell mit den Daten dieser App.
import { starteShell } from "@lager/shell/main.js";
import cfg from "../app.json";

starteShell({ ...cfg, root: __dirname, version: __APP_VERSION__ });
