// FA-39 Projektvorlagen: Standardaufgaben und Standardpositionen je Art von Veranstaltung.
import React, { useState } from "react";
import { Seite, Section, Knopf, Tabelle, Eingabe, Auswahl, Textfeld, Feld, Meldung, Modal, Toggle, useDaten, useFormular, useBestaetigung } from "@lager/ui/bausteine.jsx";
import { useLager } from "@lager/ui/huelle.jsx";
import { fehlerText } from "@lager/ui/texte.js";

function VorlageDialog({ id, onFertig, onSchliessen }) {
  const { api } = useLager();
  const f = useFormular({ name: "", veranstaltung: "", beschreibung: "", aufgaben: [], positionen: [], aktiv: true });
  const art = useDaten(() => api.get("/api/v1/artikel?limit=1000&aktiv=1"), []);
  const leute = useDaten(() => api.get("/api/v1/benutzer/auswahl").catch(() => ({ zeilen: [] })), []);
  useDaten(() => (id ? api.get(`/api/v1/projektvorlagen/${id}`).then((v) => { f.setWerte({ ...v, aufgaben: v.aufgaben.map((a) => ({ ...a, tage_vorher: a.tage_vorher ?? "", zugewiesen_id: a.zugewiesen_id ? String(a.zugewiesen_id) : "" })), positionen: v.positionen.map((p) => ({ artikel_id: String(p.artikel_id), menge: p.menge })) }); return v; }) : Promise.resolve(null)), [id]);
  const w = f.werte;
  const setzeZeile = (liste, i, k, v) => f.setze(liste)(w[liste].map((z, j) => (j === i ? { ...z, [k]: v } : z)));
  const weg = (liste, i) => f.setze(liste)(w[liste].filter((_, j) => j !== i));
  const artikel = art.daten?.zeilen || art.daten || [];
  const speichern = async () => {
    const r = await f.absenden((x) => {
      const body = { ...x, positionen: x.positionen.map((p) => ({ artikel_id: Number(p.artikel_id), menge: Number(p.menge) })),
        aufgaben: x.aufgaben.map((a) => ({ text: a.text, tage_vorher: a.tage_vorher === "" ? null : Number(a.tage_vorher), zugewiesen_id: a.zugewiesen_id ? Number(a.zugewiesen_id) : null })) };
      return id ? api.put(`/api/v1/projektvorlagen/${id}`, body) : api.post("/api/v1/projektvorlagen", body);
    });
    if (r) onFertig(r);
  };
  return (
    <Modal titel={id ? "Vorlage bearbeiten" : "Vorlage anlegen"} breite={760} onSchliessen={onSchliessen} fuss={<><Knopf onClick={onSchliessen}>Abbrechen</Knopf><Knopf art="primaer" icon="Save" onClick={speichern}>Speichern</Knopf></>}>
      {f.meldung && <Meldung {...f.meldung} />}
      <div className="lp-raster">
        <Feld label="Name" pflicht fehler={f.fehler.name}><Eingabe value={w.name} onChange={f.setze("name")} placeholder="z. B. Hochzeit klein" autoFocus /></Feld>
        <Feld label="Art der Veranstaltung" hinweis="wird Betreff des Angebots"><Eingabe value={w.veranstaltung} onChange={f.setze("veranstaltung")} placeholder="z. B. Hochzeit" /></Feld>
      </div>
      <Feld label="Beschreibung"><Textfeld rows={2} value={w.beschreibung} onChange={f.setze("beschreibung")} /></Feld>
      <h3 style={{ margin: "12px 0 6px" }}>Standardaufgaben</h3>
      {f.fehler.aufgaben && <Meldung level="error" text={f.fehler.aufgaben} />}
      {w.aufgaben.map((a, i) => (
        <div key={i} className="lp-zeile" style={{ marginBottom: 6, alignItems: "center" }}>
          <Eingabe aria-label={`Aufgabe ${i + 1}`} value={a.text} onChange={(e) => setzeZeile("aufgaben", i, "text", e.target.value)} style={{ flex: 1 }} placeholder="Was ist zu tun?" />
          <Eingabe aria-label={`Tage vor Beginn ${i + 1}`} type="number" value={a.tage_vorher} onChange={(e) => setzeZeile("aufgaben", i, "tage_vorher", e.target.value)} style={{ width: 90 }} title="Tage vor Beginn (leer = ohne Termin, negativ = nach Beginn)" />
          <span className="lp-meta">Tage vorher</span>
          <div style={{ width: 160 }}><Auswahl aria-label={`Zuständig ${i + 1}`} leer="– offen –" value={a.zugewiesen_id} onChange={(e) => setzeZeile("aufgaben", i, "zugewiesen_id", e.target.value)} optionen={(leute.daten?.zeilen || []).map((b) => ({ wert: String(b.id), titel: b.name || b.benutzername }))} /></div>
          <Knopf klein art="geist" icon="Trash2" aria-label={`Aufgabe ${i + 1} entfernen`} onClick={() => weg("aufgaben", i)} />
        </div>))}
      <Knopf klein icon="Plus" onClick={() => f.setze("aufgaben")([...w.aufgaben, { text: "", tage_vorher: "", zugewiesen_id: "" }])}>Aufgabe</Knopf>
      <h3 style={{ margin: "16px 0 6px" }}>Standardpositionen (Angebot)</h3>
      {f.fehler.positionen && <Meldung level="error" text={f.fehler.positionen} />}
      {w.positionen.map((p, i) => (
        <div key={i} className="lp-zeile" style={{ marginBottom: 6, alignItems: "center" }}>
          <div style={{ flex: 1 }}><Auswahl aria-label={`Artikel ${i + 1}`} leer="– Artikel wählen –" value={p.artikel_id} onChange={(e) => setzeZeile("positionen", i, "artikel_id", e.target.value)} optionen={artikel.map((a) => ({ wert: String(a.id), titel: a.name }))} /></div>
          <Eingabe aria-label={`Menge ${i + 1}`} type="number" min="0" step="any" value={p.menge} onChange={(e) => setzeZeile("positionen", i, "menge", e.target.value)} style={{ width: 90 }} />
          <Knopf klein art="geist" icon="Trash2" aria-label={`Position ${i + 1} entfernen`} onClick={() => weg("positionen", i)} />
        </div>))}
      <Knopf klein icon="Plus" onClick={() => f.setze("positionen")([...w.positionen, { artikel_id: "", menge: 1 }])}>Position</Knopf>
      <Feld label="Status"><Toggle checked={w.aktiv} onChange={f.setze("aktiv")} label="aktiv (beim Anlegen wählbar)" /></Feld>
    </Modal>
  );
}

export function VorlagenSeite() {
  const { api, nutzer } = useLager();
  const l = useDaten(() => api.get("/api/v1/projektvorlagen"), []);
  const [form, setForm] = useState(null);
  const [meldung, setMeldung] = useState(null);
  const [fragen, dialog] = useBestaetigung();
  const darf = nutzer.admin || nutzer.rechte.projekte === "w";
  return (
    <Seite titel="Projektvorlagen" untertitel="Standardaufgaben und -positionen je Art von Veranstaltung. Wählbar beim Anlegen eines Projekts."
      aktionen={darf && <Knopf art="primaer" icon="Plus" onClick={() => setForm({})}>Vorlage anlegen</Knopf>}>
      {dialog}
      {meldung && <Meldung {...meldung} onSchliessen={() => setMeldung(null)} />}
      {l.fehler && <Meldung level="error" text={l.fehler} />}
      <Section titel="Vorlagen" icon="Copy">
        <Tabelle zeilen={l.daten?.zeilen || []} leer="Noch keine Vorlagen. Lege eine an oder speichere ein Projekt als Vorlage." onZeile={darf ? (v) => setForm(v) : undefined} spalten={[
          { titel: "Name", wert: (v) => <div><strong style={{ opacity: v.aktiv ? 1 : 0.55 }}>{v.name}{v.aktiv ? "" : " (inaktiv)"}</strong><div className="lp-meta">{v.beschreibung}</div></div> },
          { titel: "Veranstaltung", wert: (v) => v.veranstaltung || "–" },
          { titel: "Aufgaben", rechts: true, wert: (v) => v.aufgaben.length },
          { titel: "Positionen", rechts: true, wert: (v) => v.positionen.length },
          ...(darf ? [{ titel: "", wert: (v) => <Knopf klein art="gefahr" icon="Trash2" aria-label={`${v.name} löschen`} onClick={async (e) => {
            e.stopPropagation();
            if (!(await fragen({ titel: `Vorlage ${v.name} löschen?`, text: "Projekte, die sie genutzt haben, bleiben unverändert.", knopf: "Löschen" }))) return;
            try { const r = await api.del(`/api/v1/projektvorlagen/${v.id}`); setMeldung({ level: "success", text: r.text }); l.laden(); } catch (er) { setMeldung({ level: "error", text: fehlerText(er) }); }
          }} /> }] : []),
        ]} />
      </Section>
      {form && <VorlageDialog id={form.id} onSchliessen={() => setForm(null)} onFertig={(r) => { setForm(null); setMeldung({ level: "success", text: r.text }); l.laden(); }} />}
    </Seite>
  );
}

/** Auf der Projektseite: Vorlage anwenden oder Projekt als Vorlage speichern. */
export function VorlageAktionen({ p, onFertig }) {
  const { api } = useLager();
  const [modus, setModus] = useState(null);
  const [wahl, setWahl] = useState("");
  const [name, setName] = useState("");
  const [fehler, setFehler] = useState(null);
  const l = useDaten(() => (modus === "anwenden" ? api.get("/api/v1/projektvorlagen") : Promise.resolve(null)), [modus]);
  const los = async () => {
    setFehler(null);
    try {
      const r = modus === "anwenden" ? await api.post(`/api/v1/projekte/${p.id}/vorlage`, { vorlage_id: Number(wahl) }) : await api.post("/api/v1/projektvorlagen", { name, aus_projekt_id: p.id });
      setModus(null); onFertig(r);
    } catch (e) { setFehler(fehlerText(e)); }
  };
  return (
    <>
      <Knopf icon="Copy" onClick={() => { setWahl(""); setModus("anwenden"); }}>Vorlage anwenden</Knopf>
      <Knopf icon="Save" onClick={() => { setName(p.name); setModus("speichern"); }}>Als Vorlage</Knopf>
      {modus && <Modal titel={modus === "anwenden" ? "Vorlage anwenden" : "Als Vorlage speichern"} onSchliessen={() => setModus(null)}
        fuss={<><Knopf onClick={() => setModus(null)}>Abbrechen</Knopf><Knopf art="primaer" icon="Check" disabled={modus === "anwenden" ? !wahl : !name.trim()} onClick={los}>{modus === "anwenden" ? "Anwenden" : "Speichern"}</Knopf></>}>
        {fehler && <Meldung level="error" text={fehler} />}
        {modus === "anwenden"
          ? <><Feld label="Vorlage"><Auswahl value={wahl} leer="– wählen –" onChange={(e) => setWahl(e.target.value)} optionen={(l.daten?.zeilen || []).filter((v) => v.aktiv).map((v) => ({ wert: String(v.id), titel: `${v.name} (${v.aufgaben.length} Aufgaben, ${v.positionen.length} Positionen)` }))} /></Feld>
            <p className="lp-hinweis">Legt die Aufgaben an (Termine relativ zum Projektbeginn) und ein neues Angebot mit den Positionen.</p></>
          : <><Feld label="Name der Vorlage"><Eingabe value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Feld>
            <p className="lp-hinweis">Übernimmt die Aufgaben (Abstand zum Beginn) und die Positionen des neuesten Angebots.</p></>}
      </Modal>}
    </>
  );
}
