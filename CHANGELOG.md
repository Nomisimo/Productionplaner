# Änderungen

Versionsnummern nach [SemVer](https://semver.org/lang/de/). Betas tragen den Zusatz `-beta.N`.
Materialplaner und Productionplaner tragen immer dieselbe Versionsnummer.

## [Unveröffentlicht]

## [0.3.0-beta.1] – 2026-11-15

- Gleichzeitig arbeiten: Speichert jemand anderes denselben Datensatz, siehst du ein Band mit „Neu laden“ oder „Meine Eingaben behalten“; beim Speichern einen Vergleich „Deine Werte | Aktuelle Werte“ statt still zu überschreiben
- Wer gerade dasselbe Projekt offen hat, steht als Chip im Projektkopf
- Willkommen beim ersten Login und Einführungs-Touren für beide Apps, das Zusammenspiel und den Arbeitsplatz im Lager; alle Touren unter System › Hilfe
- „Was ist neu?“: Klick auf die Versionsnummer oben
- Hinweis in der Desktop-App, wenn auf GitHub eine neuere Version liegt
- Beispielbetrieb zum Ausprobieren (`npm run seed -- --seed demo`), vom Admin wieder löschbar
- Lizenz: Apache 2.0
- Behoben: Wiederherstellen einer Sicherung brach ab, wenn ein Projekt nach dem Anlegen seiner Jobs geändert wurde
- Kopfleiste passt auch bei 1024 px Breite
- Behoben: Kam ein Formular verzögert vom Server, konnte es eine schon gemachte Eingabe überschreiben
- Behoben: Live-Updates kamen manchmal an, bevor die Änderung gespeichert war (Anzeige blieb auf altem Stand)
- Detailseiten zeigen „Lädt …“ statt einer leeren Seite

## [0.2.0-beta.1] – 2026-11-15

- Productionplaner läuft jetzt auch im Browser: `https://<server>/productionplaner/`, gleiches Konto, Live-Updates, eine Anmeldung für beide Apps
- Übersicht unter `https://<server>/` mit den Apps, für die deine Rolle Rechte hat
- „Im Browser öffnen“ in der Desktop-App und „In Desktop-App öffnen“ im Browser, jeweils ohne neue Anmeldung
- Etiketten drucken im Browser über das Druckfenster mit der richtigen Etikettengröße
- Behoben: App-Schalter landete auf „Seite nicht gefunden“, wenn es die Seite in der anderen App nicht gibt
- Verständlichere Texte beim Scannen, beim Einrichten von Packplätzen und im Sicherheits-Check

## [0.1.0-beta.1] – 2026-11-15

- Erste Beta der Planer-Lager-Familie: Productionplaner als Desktop-App für Windows und macOS, verbunden mit dem zentralen Lager-Server
- Alle Anforderungen der Spezifikation (IST und SOLL) umgesetzt und getestet, Stand siehe PROGRESS.md und BERICHT.md im Repo Planer-Lager-Core
- Server-Adresse auf der Anmeldeseite eintragbar
