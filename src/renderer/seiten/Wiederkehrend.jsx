// FA-40 Wiederkehrende Aufgaben und allgemeine Aufgaben (ohne Projekt).
import React, { useState } from "react";
import { Section, Knopf, Tabelle, Eingabe, Auswahl, Feld, Meldung, Modal, Toggle, useDaten, useFormular, useBestaetigung } from "@lager/ui/bausteine.jsx";
import { useLager } from "@lager/ui/huelle.jsx";
import { fehlerText } from "@lager/ui/texte.js";
import { RHYTHMEN } from "@lager/domain/aufgaben.js";
import { datumAnzeige, heuteIso } from "@lager/domain/zeit.js";

function RegelDialog({ regel, onFertig, onSchliessen }) {
  const { api } = useLager();
  const leute = useDaten(() => api.get("/api/v1/benutzer/auswahl").catch(() => ({ zeilen: [] })), []);
  const projekte = useDaten(() => api.get("/api/v1/projekte?limit=500").catch(() => ({ zeilen: [] })), []);
  const f = useFormular({ text: regel?.text || "", rhythmus: regel?.rhythmus || "woechentlich", alle: regel?.alle || 1, naechste: regel?.naechste || heuteIso(),
    vorlauf_tage: regel?.vorlauf_tage ?? 0, zugewiesen_id: regel?.zugewiesen_id ? String(regel.zugewiesen_id) : "", projekt_id: regel?.projekt_id ? String(regel.projekt_id) : "", aktiv: regel?.aktiv ?? true, version: regel?.version });
  const speichern = async () => {
    const r = await f.absenden((w) => {
      const body = { ...w, alle: Number(w.alle), vorlauf_tage: Number(w.vorlauf_tage), zugewiesen_id: w.zugewiesen_id ? Number(w.zugewiesen_id) : null, projekt_id: w.projekt_id ? Number(w.projekt_id) : null };
      return regel ? api.put(`/api/v1/aufgaben-regeln/${regel.id}`, body) : api.post("/api/v1/aufgaben-regeln", body);
    });
    if (r) onFertig(r);
  };
  const w = f.werte;
  return (
    <Modal titel={regel ? "Wiederkehrende Aufgabe bearbeiten" : "Wiederkehrende Aufgabe"} onSchliessen={onSchliessen} fuss={<><Knopf onClick={onSchliessen}>Abbrechen</Knopf><Knopf art="primaer" icon="Save" onClick={speichern}>Speichern</Knopf></>}>
      {f.meldung && <Meldung {...f.meldung} />}
      <Feld label="Aufgabe" pflicht fehler={f.fehler.text}><Eingabe value={w.text} onChange={f.setze("text")} placeholder="z. B. Akkus laden" autoFocus /></Feld>
      <div className="lp-raster">
        <Feld label="Rhythmus" fehler={f.fehler.rhythmus}><Auswahl value={w.rhythmus} onChange={f.setze("rhythmus")} optionen={Object.entries(RHYTHMEN).map(([wert, titel]) => ({ wert, titel }))} /></Feld>
        <Feld label="Alle" hinweis="z. B. 2 = jede zweite Woche" fehler={f.fehler.alle}><Eingabe type="number" min="1" max="365" value={w.alle} onChange={f.setze("alle")} /></Feld>
        <Feld label="Nächster Termin" pflicht fehler={f.fehler.naechste}><Eingabe type="date" value={w.naechste} onChange={f.setze("naechste")} /></Feld>
        <Feld label="Vorlauf (Tage)" hinweis="so viele Tage vorher erscheint die Aufgabe" fehler={f.fehler.vorlauf_tage}><Eingabe type="number" min="0" max="365" value={w.vorlauf_tage} onChange={f.setze("vorlauf_tage")} /></Feld>
      </div>
      <Feld label="Zuständig"><Auswahl value={w.zugewiesen_id} leer="– offen –" onChange={f.setze("zugewiesen_id")} optionen={(leute.daten?.zeilen || []).map((b) => ({ wert: String(b.id), titel: b.name || b.benutzername }))} /></Feld>
      <Feld label="Projekt" hinweis="leer = allgemeine Aufgabe"><Auswahl value={w.projekt_id} leer="– allgemein –" onChange={f.setze("projekt_id")} optionen={(projekte.daten?.zeilen || []).map((p) => ({ wert: String(p.id), titel: `${p.nummer} ${p.name}` }))} /></Feld>
      <Feld label="Status"><Toggle checked={w.aktiv} onChange={f.setze("aktiv")} label="aktiv" /></Feld>
    </Modal>
  );
}

export function RegelListe({ darf }) {
  const { api } = useLager();
  const l = useDaten(() => api.get("/api/v1/aufgaben-regeln"), []);
  const [form, setForm] = useState(null);
  const [meldung, setMeldung] = useState(null);
  const [fragen, dialog] = useBestaetigung();
  const fertig = (r) => { setForm(null); setMeldung({ level: r.level || "success", text: r.text }); l.laden(); };
  return (
    <Section titel="Wiederkehrende Aufgaben" icon="RefreshCw" aktionen={darf && <Knopf icon="Plus" onClick={() => setForm({})}>Wiederkehrende Aufgabe</Knopf>}>
      {dialog}
      {meldung && <Meldung {...meldung} onSchliessen={() => setMeldung(null)} />}
      {l.fehler && <Meldung level="error" text={l.fehler} />}
      <Tabelle zeilen={l.daten?.zeilen || []} leer="Noch keine wiederkehrenden Aufgaben." onZeile={darf ? (r) => setForm(r) : undefined} spalten={[
        { titel: "Aufgabe", wert: (r) => <strong style={{ opacity: r.aktiv ? 1 : 0.55 }}>{r.text}{r.aktiv ? "" : " (pausiert)"}</strong> },
        { titel: "Rhythmus", feld: "rhythmus_text" },
        { titel: "Nächster Termin", wert: (r) => datumAnzeige(r.naechste) },
        { titel: "Zuständig", wert: (r) => r.zugewiesen_name || r.zugewiesen_benutzer || "–" },
        { titel: "Projekt", wert: (r) => (r.projekt_id ? `${r.nummer} ${r.projekt}` : "allgemein") },
        ...(darf ? [{ titel: "", wert: (r) => <Knopf klein art="gefahr" icon="Trash2" aria-label={`${r.text} beenden`} onClick={async (e) => {
          e.stopPropagation();
          if (!(await fragen({ titel: `„${r.text}“ beenden?`, text: "Es entstehen keine neuen Aufgaben mehr. Schon angelegte bleiben.", knopf: "Beenden" }))) return;
          try { fertig(await api.del(`/api/v1/aufgaben-regeln/${r.id}`)); } catch (er) { setMeldung({ level: "error", text: fehlerText(er) }); }
        }} /> }] : []),
      ]} />
      {form && <RegelDialog regel={form.id ? form : null} onSchliessen={() => setForm(null)} onFertig={fertig} />}
    </Section>
  );
}

/** Allgemeine Aufgabe ohne Projekt anlegen. */
export function AllgemeineAufgabe({ onFertig }) {
  const { api } = useLager();
  const [offen, setOffen] = useState(false);
  const leute = useDaten(() => (offen ? api.get("/api/v1/benutzer/auswahl").catch(() => ({ zeilen: [] })) : Promise.resolve(null)), [offen]);
  const f = useFormular({ text: "", faellig: "", zugewiesen_id: "" });
  const speichern = async () => {
    const r = await f.absenden((w) => api.post("/api/v1/aufgaben", { ...w, zugewiesen_id: w.zugewiesen_id ? Number(w.zugewiesen_id) : null }));
    if (r) { setOffen(false); f.setWerte({ text: "", faellig: "", zugewiesen_id: "" }); onFertig(r); }
  };
  return (
    <>
      <Knopf icon="Plus" onClick={() => setOffen(true)}>Allgemeine Aufgabe</Knopf>
      {offen && <Modal titel="Allgemeine Aufgabe" onSchliessen={() => setOffen(false)} fuss={<><Knopf onClick={() => setOffen(false)}>Abbrechen</Knopf><Knopf art="primaer" icon="Save" onClick={speichern}>Speichern</Knopf></>}>
        {f.meldung && <Meldung {...f.meldung} />}
        <Feld label="Aufgabe" pflicht fehler={f.fehler.text}><Eingabe value={f.werte.text} onChange={f.setze("text")} autoFocus /></Feld>
        <Feld label="Fällig" fehler={f.fehler.faellig}><Eingabe type="date" value={f.werte.faellig} onChange={f.setze("faellig")} /></Feld>
        <Feld label="Zuständig"><Auswahl value={f.werte.zugewiesen_id} leer="– offen –" onChange={f.setze("zugewiesen_id")} optionen={(leute.daten?.zeilen || []).map((b) => ({ wert: String(b.id), titel: b.name || b.benutzername }))} /></Feld>
      </Modal>}
    </>
  );
}
