import React from "react";
import { Seite, Section, Meldung } from "@lager/ui/bausteine.jsx";
import { useLager } from "@lager/ui/huelle.jsx";

export function Startseite() {
  const { nutzer } = useLager();
  return (
    <Seite titel="Übersicht" untertitel="Aufträge und Planung">
      <Section titel={`Hallo ${nutzer.name || nutzer.benutzername}`} icon="Home">
        <Meldung level="info" text="Die Startseite mit Kacheln für Projekte, Angebote und Aufgaben folgt (FA-35)." />
      </Section>
    </Seite>
  );
}
