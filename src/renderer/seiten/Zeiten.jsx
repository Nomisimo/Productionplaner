// Planungszeit (Spec 3.5, FA-46, R-62–R-66): Timer-Knopf am Projekt, Auswertung, Nachbuchen, CSV, Satz-Einstellungen.
import React, { useState } from "react";
import { Seite, Section, Knopf, Tabelle, Eingabe, Auswahl, Feld, Meldung, Textfeld, Modal, Badge, Leerzustand, GeldEingabe, useDaten, useFormular, useBestaetigung } from "@lager/ui/bausteine.jsx";
import { useLager, useLive } from "@lager/ui/huelle.jsx";
import { ladeHerunter } from "@lager/ui/download.js";
import { fehlerText } from "@lager/ui/texte.js";
import { datumAnzeige, heuteIso } from "@lager/domain/zeit.js";
import { euro } from "@lager/domain/geld.js";
import { dauerText, minutenAus } from "@lager/domain/planung.js";

const darfW = (n) => n.admin || n.rechte?.zeiten === "w";

/** R-63: Timer am Projekt starten oder stoppen. */
export function TimerKnopf({ projekt }) {
  const { zeit, nutzer } = useLager();
  const [fehler, setFehler] = useState(null);
  if (!zeit?.darf || !darfW(nutzer)) return null;
  const hier = zeit.timer && Number(zeit.timer.projekt.id) === Number(projekt.id);
  return (
    <>
      {hier
        ? <Knopf icon="Pause" onClick={() => zeit.stoppe().catch((e) => setFehler(fehlerText(e)))}>Planungszeit stoppen</Knopf>
        : <Knopf icon="Timer" onClick={() => zeit.starte(projekt.id).then((r) => r?.text && zeit.setMeldung(r.text), (e) => setFehler(fehlerText(e)))}>Planungszeit starten</Knopf>}
      {fehler && <Meldung level="error" text={fehler} onSchliessen={() => setFehler(null)} />}
    </>
  );
}

/** R-65: Zeit nachbuchen (Dauer als „1:30“, „90“ oder „1,5“). */
function Nachbuchen({ projektId, projekte, onFertig }) {
  const { api } = useLager();
  const f = useFormular({ projekt_id: projektId ? String(projektId) : "", datum: heuteIso(), dauer: "", beschreibung: "" });
  const speichern = () => f.absenden(async (w) => {
    const minuten = minutenAus(w.dauer);
    if (!Number.isFinite(minuten)) { const e = new Error("Gib die Dauer als 1:30, 90 (Minuten) oder 1,5 (Stunden) ein."); e.felder = { minuten: e.message }; throw e; }
    const r = await api.post("/api/v1/zeit/eintraege", { projekt_id: Number(w.projekt_id), datum: w.datum, minuten, beschreibung: w.beschreibung });
    onFertig(r);
    return r;
  });
  return (
    <Modal titel="Zeit nachbuchen" onSchliessen={() => onFertig(null)} fuss={<>
      <Knopf art="geist" onClick={() => onFertig(null)}>Abbrechen</Knopf>
      <Knopf art="primaer" icon="Check" onClick={speichern}>Nachbuchen</Knopf></>}>
      {f.meldung?.level === "error" && <Meldung level="error" text={f.meldung.text} />}
      {!projektId && <Feld label="Projekt" pflicht fehler={f.fehler.projekt_id}>
        <Auswahl aria-label="Projekt" leer="Projekt wählen" value={f.werte.projekt_id} onChange={f.setze("projekt_id")} optionen={projekte.map((p) => ({ wert: String(p.id), titel: `${p.nummer} ${p.name}` }))} />
      </Feld>}
      <div className="lp-zeile">
        <Feld label="Datum" pflicht fehler={f.fehler.datum}><Eingabe type="date" aria-label="Datum" value={f.werte.datum} onChange={f.setze("datum")} /></Feld>
        <Feld label="Dauer" pflicht fehler={f.fehler.minuten} hinweis="z. B. 1:30, 90 oder 1,5"><Eingabe aria-label="Dauer" value={f.werte.dauer} onChange={f.setze("dauer")} /></Feld>
      </div>
      <Feld label="Beschreibung" breit><Textfeld aria-label="Beschreibung" rows={2} value={f.werte.beschreibung} onChange={f.setze("beschreibung")} /></Feld>
    </Modal>
  );
}

function Eintraege({ zeilen, darf, onLoeschen, mitProjekt }) {
  return (
    <Tabelle zeilen={zeilen} leer="Keine Zeiten im Zeitraum. Starte den Timer am Projekt oder buche Zeit nach." spalten={[
      { titel: "Datum", wert: (z) => datumAnzeige(z.datum) },
      ...(mitProjekt ? [{ titel: "Projekt", wert: (z) => <a href={`#/projekte/${z.projekt_id}`}>{z.nummer} {z.projekt_name}</a> }] : []),
      { titel: "Wer", feld: "wer" }, { titel: "Dauer", rechts: true, wert: (z) => dauerText(z.minuten) },
      { titel: "Beschreibung", wert: (z) => z.beschreibung || "–" },
      { titel: "Quelle", wert: (z) => <Badge>{z.quelle === "timer" ? "Timer" : "nachgebucht"}</Badge> },
      { titel: "Betrag", rechts: true, wert: (z) => `${euro(z.betrag)} (${z.prozent} %)` },
      { titel: "", wert: (z) => (darf && !z.abgerechnet ? <Knopf klein art="geist" icon="Trash2" aria-label={`Eintrag vom ${datumAnzeige(z.datum)} löschen`} onClick={() => onLoeschen(z)} /> : z.abgerechnet ? <Badge>abgerechnet</Badge> : null) },
    ]} />
  );
}

function useEintraegeLoeschen(onFertig) {
  const { api } = useLager();
  const [frage, dialog] = useBestaetigung();
  const loeschen = async (z) => {
    if (!(await frage({ titel: "Eintrag löschen?", text: `${dauerText(z.minuten)} vom ${datumAnzeige(z.datum)} werden gelöscht und aus dem Rechnungsentwurf entfernt.`, knopf: "Löschen" }))) return;
    try { onFertig(await api.del(`/api/v1/zeit/eintraege/${z.id}`)); } catch (e) { onFertig({ level: "error", text: fehlerText(e) }); }
  };
  return { loeschen, dialog };
}

/** Reiter „Zeiten“ im Projekt (FA-46). */
export function ProjektZeiten({ p }) {
  const { api, nutzer } = useLager();
  const d = useDaten(() => api.get(`/api/v1/zeit/eintraege?projekt=${p.id}`), [p.id]);
  useLive(["zeit"], () => d.laden());
  const [neu, setNeu] = useState(false);
  const [meldung, setMeldung] = useState(null);
  const fertig = (r) => { if (r) { setMeldung({ level: r.level || "success", text: r.text }); d.laden(); } };
  const { loeschen, dialog } = useEintraegeLoeschen(fertig);
  const darf = darfW(nutzer);
  return (
    <Section titel="Planungszeit" aktionen={<>
      <TimerKnopf projekt={p} />
      {darf && <Knopf icon="Plus" onClick={() => setNeu(true)}>Zeit nachbuchen</Knopf>}</>}>
      {meldung && <Meldung level={meldung.level} text={meldung.text} onSchliessen={() => setMeldung(null)} />}
      {d.fehler && <Meldung level="error" text={d.fehler} />}
      {d.daten && <p className="lp-hinweis" data-testid="zeit-summe" style={{ marginTop: 0 }}>Summe: <strong>{dauerText(d.daten.summe.minuten)}</strong> · {euro(d.daten.summe.betrag)} im Rechnungsentwurf vorgemerkt</p>}
      <Eintraege zeilen={d.daten?.zeilen} darf={darf} onLoeschen={loeschen} />
      {neu && <Nachbuchen projektId={p.id} projekte={[]} onFertig={(r) => { setNeu(false); fertig(r); }} />}
      {dialog}
    </Section>
  );
}

/** Seite /zeiterfassung: Auswertung je Projekt mit Filter, Nachbuchen, CSV (FA-46), Satz-Einstellungen für Admins (R-66). */
export function Zeiterfassung({ query }) {
  const { api, nutzer } = useLager();
  const [f, setF] = useState({ projekt: query.projekt || "", von: query.von || "", bis: query.bis || "" });
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const d = useDaten(() => api.get(`/api/v1/zeit/eintraege?${qs}`), [qs]);
  const projekte = useDaten(() => api.get("/api/v1/projekte?limit=500"), []);
  useLive(["zeit"], () => d.laden());
  const [neu, setNeu] = useState(false);
  const [meldung, setMeldung] = useState(null);
  const fertig = (r) => { if (r) { setMeldung({ level: r.level || "success", text: r.text }); d.laden(); } };
  const { loeschen, dialog } = useEintraegeLoeschen(fertig);
  const setze = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const darf = darfW(nutzer);
  const liste = projekte.daten?.zeilen || [];
  return (
    <Seite titel="Planungszeit" tour="planungszeit" untertitel="Erfasste Planungszeit je Projekt, nachbuchen und exportieren"
      aktionen={<>
        <Knopf icon="Download" onClick={() => ladeHerunter(api, `/api/v1/zeit/eintraege.csv?${qs}`, "planungszeit.csv").catch((e) => setMeldung({ level: "error", text: fehlerText(e) }))}>CSV herunterladen</Knopf>
        {darf && <Knopf art="primaer" icon="Plus" onClick={() => setNeu(true)}>Zeit nachbuchen</Knopf>}</>}>
      {meldung && <Meldung level={meldung.level} text={meldung.text} onSchliessen={() => setMeldung(null)} />}
      <Section>
        <div className="lp-zeile" style={{ marginBottom: 12 }}>
          <div style={{ flex: "1 1 260px" }}><Auswahl aria-label="Projekt" leer="Alle Projekte" value={f.projekt} onChange={setze("projekt")} optionen={liste.map((p) => ({ wert: String(p.id), titel: `${p.nummer} ${p.name}` }))} /></div>
          <div style={{ width: 160 }}><Eingabe type="date" aria-label="Von" value={f.von} onChange={setze("von")} /></div>
          <div style={{ width: 160 }}><Eingabe type="date" aria-label="Bis" value={f.bis} onChange={setze("bis")} /></div>
        </div>
        {d.fehler && <Meldung level="error" text={d.fehler} />}
        {d.daten && <p className="lp-hinweis" data-testid="zeit-summe" style={{ marginTop: 0 }}>
          Gesamt: <strong>{dauerText(d.daten.summe.minuten)}</strong> · {euro(d.daten.summe.betrag)} · Basis {euro(d.daten.satz.basis)}/Std. × {d.daten.satz.prozent} %{d.daten.satz.posten ? ` (Posten „${d.daten.satz.posten}“)` : ""}</p>}
      </Section>
      <Section titel="Je Projekt">
        {d.daten?.projekte?.length ? <Tabelle zeilen={d.daten.projekte} schluessel="projekt_id" onZeile={(p) => setF({ ...f, projekt: String(p.projekt_id) })} spalten={[
          { titel: "Projekt", wert: (p) => <strong>{p.nummer}</strong> }, { titel: "Name", feld: "name" },
          { titel: "Dauer", rechts: true, wert: (p) => dauerText(p.minuten) }, { titel: "Betrag", rechts: true, wert: (p) => euro(p.betrag) },
        ]} /> : <Leerzustand text="Noch keine Planungszeit im Zeitraum." icon="Timer" />}
      </Section>
      <Section titel="Einträge"><Eintraege zeilen={d.daten?.zeilen} darf={darf} onLoeschen={loeschen} mitProjekt /></Section>
      {nutzer.admin && <SatzEinstellungen onGespeichert={() => d.laden()} />}
      {neu && <Nachbuchen projektId={f.projekt || null} projekte={liste} onFertig={(r) => { setNeu(false); fertig(r); }} />}
      {dialog}
    </Seite>
  );
}

/** R-66: Posten „Technische Projektleitung“, Prozentsatz, Ersatz-Stundensatz (nur Admin). */
function SatzEinstellungen({ onGespeichert }) {
  const { api } = useLager();
  const e = useDaten(() => api.get("/api/v1/verwaltung/einstellungen"), []);
  const artikel = useDaten(() => api.get("/api/v1/artikel?limit=500"), []);
  const f = useFormular(null);
  if (e.daten && !f.werte) f.setWerte({ zeit_artikel: e.daten.zeit_artikel == null ? "" : String(e.daten.zeit_artikel), zeit_prozent_planung: String(e.daten.zeit_prozent_planung), zeit_basis_stundensatz: e.daten.zeit_basis_stundensatz, version: e.daten.version });
  if (!f.werte) return null;
  const speichern = () => f.absenden(async (w) => {
    const r = await api.put("/api/v1/verwaltung/einstellungen", { zeit_artikel: w.zeit_artikel ? Number(w.zeit_artikel) : null, zeit_prozent_planung: Number(w.zeit_prozent_planung), zeit_basis_stundensatz: w.zeit_basis_stundensatz, version: w.version });
    onGespeichert();
    return r;
  });
  return (
    <Section titel="Stundensatz für Planungszeit" icon="Settings" aktionen={<Knopf art="primaer" icon="Check" onClick={speichern}>Speichern</Knopf>}>
      {f.meldung && <Meldung level={f.meldung.level} text={f.meldung.text} onSchliessen={() => f.setMeldung(null)} />}
      <div className="lp-zeile">
        <Feld label="Posten Technische Projektleitung" fehler={f.fehler.zeit_artikel} hinweis="Preis je Stunde oder Tagessatz ÷ Stunden je Tag">
          <Auswahl aria-label="Posten" leer="Kein Posten (Ersatz-Stundensatz)" value={f.werte.zeit_artikel} onChange={f.setze("zeit_artikel")}
            optionen={(artikel.daten?.zeilen || []).map((a) => ({ wert: String(a.id), titel: a.name }))} />
        </Feld>
        <Feld label="Anteil Planung (%)" fehler={f.fehler.zeit_prozent_planung}><Eingabe type="number" min={0} max={100} aria-label="Anteil Planung" value={f.werte.zeit_prozent_planung} onChange={f.setze("zeit_prozent_planung")} /></Feld>
        <Feld label="Ersatz-Stundensatz (€)" fehler={f.fehler.zeit_basis_stundensatz}><GeldEingabe aria-label="Ersatz-Stundensatz" cent={f.werte.zeit_basis_stundensatz} onCent={f.setze("zeit_basis_stundensatz")} /></Feld>
      </div>
    </Section>
  );
}
