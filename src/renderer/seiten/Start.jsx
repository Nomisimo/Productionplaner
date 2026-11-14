// Startseite (FA-35) des Productionplaners: Projekte, Angebote und Aufgaben zuerst.
import React from "react";
import { Startseite as Uebersicht } from "@lager/ui/uebersicht.jsx";

const SCHNELL = [
  { titel: "Neues Projekt", icon: "Plus", pfad: "/projekte/neu" },
  { titel: "Projekte", icon: "FolderKanban", pfad: "/projekte" },
  { titel: "Angebote", icon: "FileText", pfad: "/angebote" },
  { titel: "Kalender", icon: "CalendarDays", pfad: "/kalender" },
  { titel: "Planungszeit", icon: "Timer", pfad: "/zeiterfassung" },
];

export function Startseite() {
  return <Uebersicht untertitel="Aufträge und Planung" schnell={SCHNELL} />;
}
