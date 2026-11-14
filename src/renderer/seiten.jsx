// Seiten des Productionplaners (Menü UI-1: Start · Aufträge · Kalkulation · System).
import React from "react";
import { Startseite } from "./seiten/Start.jsx";

export const SEITEN = [
  { muster: "/", Komponente: Startseite },
];

/** Globales Codefeld (FA-16): wird in Phase 6 vollständig gebaut. */
export function beiCode(code, { navigiere }) {
  navigiere(`/suche?q=${encodeURIComponent(code)}`);
}
