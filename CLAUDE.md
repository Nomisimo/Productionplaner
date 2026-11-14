# Productionplaner

Electron-App der Planer-Familie für Aufträge und Planung. **Projektweite Regeln, Fortschritt und Spec liegen im Repo `Planer-Lager-Core`** (CLAUDE.md, PROGRESS.md, docs/). Hier nur App-Spezifisches.

## Zuständig für
Kunden (FA-26–28), Projekte/Jobs (FA-29–31, R-12–14, R-20), Aufgaben (FA-32), Dateien (FA-33), Kalender (FA-34), Startseite (FA-35), Suche (FA-36), Angebote mit Verfügbarkeit, Preisen, Fassungen, PDF, Packliste lesen (FA-41–45, R-24–28c, R-51–54), Planungszeit (FA-46, R-62–66), Personal (FA-37), Fahrzeuge (FA-38), Projektvorlagen (FA-39), Wiederkehrende Aufgaben + Benachrichtigungen (FA-40), Kalkulator/Zeitrechner (FA-45), Verwaltung für Admins.

## Menü (UI-1, nur dieser App-Teil)
Start (Übersicht, Suche) · Aufträge (Kunden, Projekte, Kalender, Aufgaben, Angebote, Planungszeit, Personal, Fahrzeuge) · Kalkulation (Kalkulator, Zeitrechner) · System (Verwaltung). Material-Einträge springen per Deep-Link in den Materialplaner.

## Besonderheiten
- Planungszeit-Timer (R-63): Herzschlag an den Server, Stopp bei Wechsel auf fremdes Projekt oder Nicht-Planungsseite, auch beim Sprung in den Materialplaner.
- Angebot-PDF und Packliste-PDF kommen vom Server (pdfkit), App zeigt Vorschau.
- Deep-Link-Protokoll `productionplaner://` (siehe Core docs/ARCHITEKTUR.md §4).

## Befehle
`npm start` (Build + Electron, Server-URL aus `LAGER_SERVER_URL`), `npm test`, `npm run dist:mac`, `npm run dist:win`.
