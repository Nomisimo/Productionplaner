// Seiten des Productionplaners (Menü UI-1: Start · Aufträge · Kalkulation · System).
import { Startseite } from "./seiten/Start.jsx";
import { KundenListe, KundeFormular, KundeDetail } from "./seiten/Kunden.jsx";
import { normalisiereCode, istGeraetecode, normalisiereProjektcode } from "@lager/domain/codes.js";

export const SEITEN = [
  { muster: "/", Komponente: Startseite },
  { muster: "/kunden", Komponente: KundenListe },
  { muster: "/kunden/neu", Komponente: KundeFormular },
  { muster: "/kunden/:id/bearbeiten", Komponente: KundeFormular },
  { muster: "/kunden/:id", Komponente: KundeDetail },
];

/** Globales Codefeld (FA-16): Projekt → hier, Gerät → Materialplaner. Vollständig in Phase 6. */
export function beiCode(code, { navigiere, oeffneAndereApp }) {
  const p = normalisiereProjektcode(code);
  if (p) return navigiere(`/projekte/nummer/${p}`);
  const g = normalisiereCode(code);
  if (istGeraetecode(g)) return oeffneAndereApp(`/geraete/code/${g}`);
  navigiere(`/suche?q=${encodeURIComponent(code)}`);
}
