// Seiten des Productionplaners (Menü UI-1: Start · Aufträge · Kalkulation · System).
import { Startseite } from "./seiten/Start.jsx";
import { KundenListe, KundeFormular, KundeDetail } from "./seiten/Kunden.jsx";
import { ProjektListe, ProjektFormular, ProjektDetail, ProjektPerNummer, AufgabenListe, Kalender } from "./seiten/Projekte.jsx";
import { Zeiterfassung } from "./seiten/Zeiten.jsx";
import { AngebotListe, AngebotDetail, Packliste, Kalkulator, Zeitrechner } from "./seiten/Angebote.jsx";
import { normalisiereCode, istGeraetecode, normalisiereProjektcode } from "@lager/domain/codes.js";

import { VerwaltungStart, ScannerVerwaltung, ArbeitsplatzVerwaltung } from "@lager/ui/verwaltung.jsx";

export const SEITEN = [
  { muster: "/", Komponente: Startseite },
  { muster: "/kunden", Komponente: KundenListe },
  { muster: "/kunden/neu", Komponente: KundeFormular },
  { muster: "/kunden/:id/bearbeiten", Komponente: KundeFormular },
  { muster: "/kunden/:id", Komponente: KundeDetail },
  { muster: "/projekte", Komponente: ProjektListe },
  { muster: "/projekte/neu", Komponente: ProjektFormular },
  { muster: "/projekte/nummer/:nummer", Komponente: ProjektPerNummer },
  { muster: "/projekte/:id/bearbeiten", Komponente: ProjektFormular },
  { muster: "/projekte/:id", Komponente: ProjektDetail },
  { muster: "/aufgaben", Komponente: AufgabenListe },
  { muster: "/kalender", Komponente: Kalender },
  { muster: "/angebote", Komponente: AngebotListe },
  { muster: "/angebote/:id/packliste", Komponente: Packliste },
  { muster: "/angebote/:id", Komponente: AngebotDetail },
  { muster: "/zeiterfassung", Komponente: Zeiterfassung },
  { muster: "/kalkulator", Komponente: Kalkulator },
  { muster: "/zeitrechner", Komponente: Zeitrechner },
  { muster: "/verwaltung", Komponente: VerwaltungStart },
  { muster: "/verwaltung/scanner", Komponente: ScannerVerwaltung },
  { muster: "/verwaltung/arbeitsplaetze", Komponente: ArbeitsplatzVerwaltung },
];

/** Globales Codefeld (FA-16): Projekt → hier, Gerät → Materialplaner. Vollständig in Phase 6. */
export function beiCode(code, { navigiere, oeffneAndereApp }) {
  const p = normalisiereProjektcode(code);
  if (p) return navigiere(`/projekte/nummer/${p}`);
  const g = normalisiereCode(code);
  if (istGeraetecode(g)) return oeffneAndereApp(`/geraete/code/${g}`);
  navigiere(`/suche?q=${encodeURIComponent(code)}`);
}
