// Projekte/Jobs (FA-29–FA-31), Aufgaben (FA-32), Dateien (FA-33), Kalender (FA-34).
import React, { useMemo, useRef, useState } from "react";
import { Seite, Section, Knopf, Tabelle, Eingabe, Auswahl, Feld, Meldung, Textfeld, Modal, Tabs, Badge, Leerzustand, Icon, useDaten, useFormular, useBestaetigung } from "@lager/ui/bausteine.jsx";
import { useLager, useLive } from "@lager/ui/huelle.jsx";
import { ladeHerunter } from "@lager/ui/download.js";
import { fehlerText } from "@lager/ui/texte.js";
import { datumAnzeige, zeitpunktAnzeige, heuteIso } from "@lager/domain/zeit.js";
import { euro } from "@lager/domain/geld.js";
import { PROJEKT_STATUS, STATUS_FARBE, GEWERKE, DATEI_KATEGORIEN, DATEI_ENDUNGEN, MAX_DATEI, pruefeDatei, inlineErlaubt, endung } from "@lager/domain/projekt.js";

const STATUS_OPT = Object.entries(PROJEKT_STATUS).map(([wert, titel]) => ({ wert, titel }));
export const StatusBadge = ({ s }) => <Badge farbe={STATUS_FARBE[s]} text="#fff">{PROJEKT_STATUS[s] || s}</Badge>;
const darfP = (n) => n.admin || n.rechte.projekte === "w";
const zeitraum = (p) => (p.beginn ? `${datumAnzeige(p.beginn)}${p.ende && p.ende !== p.beginn ? ` – ${datumAnzeige(p.ende)}` : ""}` : "ohne Termin");
const groesseText = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/* ── Liste (FA-29) ── */
export function ProjektListe({ query }) {
  const { api, navigiere, nutzer } = useLager();
  const [f, setF] = useState({ q: query.q || "", status: query.status || "", art: query.art || "", kunde: query.kunde || "", von: query.von || "", bis: query.bis || "" });
  const kunden = useDaten(() => api.get("/api/v1/kunden?limit=500"), []);
  const l = useDaten(() => api.get(`/api/v1/projekte?${new URLSearchParams(Object.entries(f).filter(([, v]) => v))}`), [f.q, f.status, f.art, f.kunde, f.von, f.bis]);
  useLive(["projekt"], () => l.laden());
  const setze = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Seite titel="Projekte" untertitel="Projekte und Jobs mit Status, Termin und Kunde"
      aktionen={darfP(nutzer) && <Knopf art="primaer" icon="Plus" onClick={() => navigiere("/projekte/neu")}>Neues Projekt</Knopf>}>
      <Section>
        <div className="lp-zeile" style={{ marginBottom: 12 }}>
          <div style={{ flex: "1 1 240px" }}><Eingabe placeholder="Suchen: Nummer, Name, Kunde, Ort" aria-label="Suchen" value={f.q} onChange={setze("q")} /></div>
          <div style={{ width: 180 }}><Auswahl aria-label="Status" leer="Alle Status" value={f.status} onChange={setze("status")} optionen={STATUS_OPT} /></div>
          <div style={{ width: 140 }}><Auswahl aria-label="Art" leer="Projekte und Jobs" value={f.art} onChange={setze("art")} optionen={[{ wert: "projekt", titel: "Projekte" }, { wert: "job", titel: "Jobs" }]} /></div>
          <div style={{ width: 200 }}><Auswahl aria-label="Kunde" leer="Alle Kunden" value={f.kunde} onChange={setze("kunde")} optionen={(kunden.daten?.zeilen || []).map((k) => ({ wert: String(k.id), titel: k.firma || k.name }))} /></div>
          <div style={{ width: 150 }}><Eingabe type="date" aria-label="Von" value={f.von} onChange={setze("von")} /></div>
          <div style={{ width: 150 }}><Eingabe type="date" aria-label="Bis" value={f.bis} onChange={setze("bis")} /></div>
        </div>
        {l.fehler && <Meldung level="error" text={l.fehler} />}
        <Tabelle zeilen={l.daten?.zeilen} onZeile={(p) => navigiere(`/projekte/${p.id}`)} leer={l.laedt ? "Lädt …" : "Keine Projekte gefunden. Ändere die Filter oder lege ein Projekt an."}
          spalten={[
            { titel: "Nummer", wert: (p) => <strong>{p.nummer}</strong> },
            { titel: "Name", wert: (p) => <span>{p.name}{p.eltern_nummer && <span className="lp-meta"> · Job zu {p.eltern_nummer}</span>}</span> },
            { titel: "Kunde", wert: (p) => p.kunde_firma || p.kunde },
            { titel: "Termin", wert: zeitraum },
            { titel: "Ort", feld: "ort" },
            { titel: "Status", wert: (p) => <StatusBadge s={p.status} /> },
          ]} />
        {l.daten && <p className="lp-hinweis">{l.daten.gesamt} Einträge</p>}
      </Section>
    </Seite>
  );
}

/* ── Anlegen / Bearbeiten (FA-30) ── */
const LEER = { art: "projekt", name: "", kunde_id: "", status: "anfrage", beginn: "", ende: "", ort: "", notizen: "", uebergeordnet_id: "", gewerk: "" };
export function ProjektFormular({ params, query }) {
  const { api, navigiere } = useLager();
  const neu = !params.id;
  const f = useFormular({ ...LEER, uebergeordnet_id: query.projekt || "", art: query.projekt ? "job" : "projekt", kunde_id: query.kunde || "" });
  const kunden = useDaten(() => api.get("/api/v1/kunden?limit=500"), []);
  const eltern = useDaten(() => api.get("/api/v1/projekte?art=projekt&limit=500"), []);
  const alt = useDaten(() => (neu ? Promise.resolve(null) : api.get(`/api/v1/projekte/${params.id}`).then((p) => {
    f.setWerte({ ...LEER, ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v ?? ""])), kunde_id: String(p.kunde_id), uebergeordnet_id: p.uebergeordnet_id ? String(p.uebergeordnet_id) : "" });
    return p;
  })), [params.id]);
  const w = f.werte;
  const istJob = w.art === "job";
  const zuProjekt = istJob && !!w.uebergeordnet_id;
  const speichern = () => f.absenden(async (x) => {
    const daten = { ...x, kunde_id: x.kunde_id ? Number(x.kunde_id) : null, uebergeordnet_id: istJob && x.uebergeordnet_id ? Number(x.uebergeordnet_id) : null, version: alt.daten?.version };
    const r = neu ? await api.post("/api/v1/projekte", daten) : await api.put(`/api/v1/projekte/${params.id}`, daten);
    navigiere(`/projekte/${r.projekt.id}`);
    return r;
  });
  return (
    <Seite titel={neu ? (istJob ? "Neuer Job" : "Neues Projekt") : `Bearbeiten: ${alt.daten?.nummer || ""}`} aktionen={<Knopf art="geist" onClick={() => history.back()}>Zurück</Knopf>}>
      {f.meldung && <Meldung {...f.meldung} />}
      {alt.fehler && <Meldung level="error" text={alt.fehler} />}
      <Section titel="Stammdaten">
        <div className="lp-zeile" style={{ marginBottom: 12 }} role="radiogroup" aria-label="Art">
          {[["projekt", "Projekt"], ["job", "Job"]].map(([a, t]) => (
            <label key={a} className="lp-chip" style={{ cursor: "pointer" }}><input type="radio" name="art" checked={w.art === a} onChange={() => f.setze("art")(a)} /> {t}</label>
          ))}
        </div>
        <div className="lp-raster">
          <Feld label="Name" pflicht fehler={f.fehler.name}><Eingabe value={w.name} onChange={f.setze("name")} /></Feld>
          {istJob && <Feld label="Gehört zu Projekt" hinweis="Leer lassen für einen eigenständigen Job. Kunde, Termin und Ort werden übernommen.">
            <Auswahl leer="– eigenständig –" value={w.uebergeordnet_id} onChange={f.setze("uebergeordnet_id")}
              optionen={(eltern.daten?.zeilen || []).filter((p) => String(p.id) !== String(params.id)).map((p) => ({ wert: String(p.id), titel: `${p.nummer} ${p.name}` }))} /></Feld>}
          {istJob && <Feld label="Gewerk" fehler={f.fehler.gewerk}><Auswahl leer="– wählen –" value={w.gewerk} onChange={f.setze("gewerk")} optionen={GEWERKE.map((g) => ({ wert: g, titel: g }))} /></Feld>}
          {!zuProjekt && <Feld label="Kunde" pflicht fehler={f.fehler.kunde_id}><Auswahl leer="– Kunde wählen –" value={w.kunde_id} onChange={f.setze("kunde_id")}
            optionen={(kunden.daten?.zeilen || []).map((k) => ({ wert: String(k.id), titel: k.firma ? `${k.firma} (${k.name})` : k.name }))} /></Feld>}
          <Feld label="Status" fehler={f.fehler.status}><Auswahl value={w.status} onChange={f.setze("status")} optionen={STATUS_OPT} /></Feld>
          <Feld label="Beginn" fehler={f.fehler.beginn}><Eingabe type="date" value={w.beginn} onChange={f.setze("beginn")} /></Feld>
          <Feld label="Ende" fehler={f.fehler.ende}><Eingabe type="date" value={w.ende} onChange={f.setze("ende")} /></Feld>
          <Feld label="Ort"><Eingabe value={w.ort} onChange={f.setze("ort")} /></Feld>
          <Feld label="Notizen" breit><Textfeld rows={3} value={w.notizen} onChange={f.setze("notizen")} /></Feld>
        </div>
        <div style={{ marginTop: 16 }}><Knopf art="primaer" icon="Save" onClick={speichern}>Speichern</Knopf></div>
      </Section>
    </Seite>
  );
}

/* ── Detail (FA-29) ── */
export function ProjektPerNummer({ params }) {
  const { api, navigiere } = useLager();
  const d = useDaten(() => api.get(`/api/v1/projekte/nummer/${encodeURIComponent(params.nummer)}`).then((p) => { navigiere(`/projekte/${p.id}`); return p; }), [params.nummer]);
  return <Seite titel={params.nummer}>{d.fehler ? <Meldung level="error" text={d.fehler} /> : <p className="lp-hinweis">Lädt …</p>}</Seite>;
}

export function ProjektDetail({ params, query }) {
  const { api, navigiere, nutzer, oeffneAndereApp } = useLager();
  const d = useDaten(() => api.get(`/api/v1/projekte/${params.id}`), [params.id]);
  useLive(["projekt", "aufgabe", "geraet"], (m) => { if (!m.id || m.id === Number(params.id) || m.projekt === Number(params.id) || m.typ?.startsWith("geraet")) d.laden(); });
  const [tab, setTab] = useState(query.tab || "uebersicht");
  const [meldung, setMeldung] = useState(null);
  const [jobsDialog, setJobsDialog] = useState(false);
  const [fragen, dialog] = useBestaetigung();
  if (d.fehler) return <Seite titel="Projekt"><Meldung level="error" text={d.fehler} /></Seite>;
  const p = d.daten;
  if (!p) return <Seite titel="Projekt"><p className="lp-hinweis">Lädt …</p></Seite>;
  const darf = darfP(nutzer);
  const aktion = async (fn) => { setMeldung(null); try { const r = await fn(); if (r?.text) setMeldung({ level: r.level || "success", text: r.text }); d.laden(); return r; } catch (e) { setMeldung({ level: "error", text: fehlerText(e) }); return null; } };
  const k = p.kennzahlen;
  return (
    <Seite titel={`${p.nummer} ${p.name}`} untertitel={`${p.art === "job" ? `Job${p.gewerk ? ` · ${p.gewerk}` : ""}` : "Projekt"} · ${p.kunde_firma || p.kunde} · ${zeitraum(p)}${p.ort ? ` · ${p.ort}` : ""}`}
      aktionen={darf && <>
        <div style={{ width: 190 }}><Auswahl aria-label="Status ändern" value={p.status} onChange={(e) => aktion(() => api.post(`/api/v1/projekte/${p.id}/status`, { status: e.target.value }))} optionen={STATUS_OPT} /></div>
        <Knopf icon="Pencil" onClick={() => navigiere(`/projekte/${p.id}/bearbeiten`)}>Bearbeiten</Knopf>
        <Knopf icon="Copy" onClick={async () => { const r = await aktion(() => api.post(`/api/v1/projekte/${p.id}/duplizieren`, {})); if (r) navigiere(`/projekte/${r.projekt.id}`); }}>Duplizieren</Knopf>
        <Knopf art="gefahr" icon="Trash2" aria-label="Projekt löschen" onClick={async () => {
          if (!(await fragen({ titel: "Projekt löschen?", text: `${p.nummer} und sein Projektordner werden gelöscht. Projekte mit Jobs, Material oder Verlauf lassen sich nicht löschen.`, knopf: "Löschen" }))) return;
          if (await aktion(() => api.del(`/api/v1/projekte/${p.id}`))) navigiere("/projekte");
        }} />
      </>}>
      {dialog}
      {meldung && <Meldung {...meldung} onSchliessen={() => setMeldung(null)} />}
      <div className="lp-raster" data-testid="kennzahlen">
        <Kennzahl titel="Status"><StatusBadge s={p.status} /></Kennzahl>
        <Kennzahl titel="Termin">{zeitraum(p)}</Kennzahl>
        <Kennzahl titel="Angebotswert netto">{euro(k.angebotswert_netto)}</Kennzahl>
        <Kennzahl titel="Geräte gepackt / gesamt">{k.gepackt} / {k.geraete}</Kennzahl>
        <Kennzahl titel="Offene Aufgaben">{k.aufgaben_offen}{k.aufgaben_ueberfaellig > 0 && <span style={{ color: "var(--lp-err)" }}> · {k.aufgaben_ueberfaellig} überfällig</span>}</Kennzahl>
      </div>
      {p.eltern && <p className="lp-hinweis">Job zu <a href={`#/projekte/${p.eltern.id}`}>{p.eltern.nummer} {p.eltern.name}</a></p>}
      <Tabs tabs={[{ id: "uebersicht", titel: "Übersicht" }, ...(p.art === "projekt" ? [{ id: "jobs", titel: `Jobs (${p.jobs.length})` }] : []),
        { id: "aufgaben", titel: `Aufgaben (${k.aufgaben_offen})` }, { id: "dateien", titel: `Dateien (${p.dateien.length})` }, { id: "angebote", titel: "Angebote" }, { id: "zeiten", titel: "Zeiten" }]} aktiv={tab} onWechsel={setTab} />
      {tab === "uebersicht" && <Section titel="Übersicht">
        {p.notizen ? <p style={{ whiteSpace: "pre-wrap", marginTop: 0 }}>{p.notizen}</p> : <p className="lp-hinweis" style={{ marginTop: 0 }}>Keine Notizen.</p>}
        <div className="lp-zeile">
          <Knopf icon="Package" onClick={() => oeffneAndereApp(`/geraete?projekt=${p.id}`)}>Material im Materialplaner</Knopf>
        </div>
      </Section>}
      {tab === "jobs" && <Section titel="Jobs" aktionen={darf && <>
        <Knopf icon="Plus" onClick={() => navigiere(`/projekte/neu?projekt=${p.id}`)}>Job anlegen</Knopf>
        <Knopf icon="Boxes" onClick={() => setJobsDialog(true)}>Jobs nach Gewerk</Knopf></>}>
        <Tabelle zeilen={p.jobs} leer="Noch keine Jobs." onZeile={(j) => navigiere(`/projekte/${j.id}`)} spalten={[
          { titel: "Nummer", feld: "nummer" }, { titel: "Name", feld: "name" }, { titel: "Gewerk", feld: "gewerk" }, { titel: "Termin", wert: zeitraum }, { titel: "Status", wert: (j) => <StatusBadge s={j.status} /> },
        ]} />
      </Section>}
      {tab === "aufgaben" && <ProjektAufgaben p={p} darf={darf} onAktion={aktion} />}
      {tab === "dateien" && <ProjektDateien p={p} darf={darf} onAktion={aktion} />}
      {tab === "angebote" && <Section titel="Angebote"><Leerzustand text="Angebote folgen in Kürze (Phase 5)." icon="FileText" /></Section>}
      {tab === "zeiten" && <Section titel="Zeiten"><Leerzustand text="Planungszeiten folgen in Kürze." icon="Timer" /></Section>}
      {jobsDialog && <JobsNachGewerk p={p} onFertig={(r) => { setJobsDialog(false); if (r) { setMeldung({ level: "success", text: r.text }); d.laden(); } }} />}
    </Seite>
  );
}
const Kennzahl = ({ titel, children }) => <div className="lp-section" style={{ padding: 14 }}><div className="lp-label">{titel}</div><div style={{ fontSize: "1.15em", fontWeight: 600, marginTop: 4 }}>{children}</div></div>;

function JobsNachGewerk({ p, onFertig }) {
  const { api } = useLager();
  const [wahl, setWahl] = useState(new Set());
  const [fehler, setFehler] = useState(null);
  return (
    <Modal titel="Jobs nach Gewerk anlegen" onSchliessen={() => onFertig(null)} fuss={<>
      <Knopf art="geist" onClick={() => onFertig(null)}>Abbrechen</Knopf>
      <Knopf art="primaer" disabled={!wahl.size} onClick={async () => { try { onFertig(await api.post(`/api/v1/projekte/${p.id}/jobs`, { gewerke: [...wahl] })); } catch (e) { setFehler(fehlerText(e)); } }}>{wahl.size} Job(s) anlegen</Knopf></>}>
      {fehler && <Meldung level="error" text={fehler} />}
      <p className="lp-hinweis" style={{ marginTop: 0 }}>Je Gewerk entsteht ein Job „{p.name} – Gewerk“ mit Kunde, Termin und Ort des Projekts.</p>
      <div className="lp-raster">{GEWERKE.map((g) => (
        <label key={g} className="lp-chip" style={{ cursor: "pointer" }}><input type="checkbox" checked={wahl.has(g)} onChange={(e) => { const n = new Set(wahl); if (e.target.checked) n.add(g); else n.delete(g); setWahl(n); }} /> {g}</label>
      ))}</div>
    </Modal>
  );
}

/* ── Aufgaben (FA-32) ── */
function AufgabeNeu({ projektId, onAktion }) {
  const { api } = useLager();
  const benutzer = useDaten(() => api.get("/api/v1/benutzer/auswahl"), []);
  const [w, setW] = useState({ text: "", faellig: "", zugewiesen_id: "" });
  return (
    <form className="lp-zeile" style={{ alignItems: "flex-end", marginBottom: 12 }} onSubmit={async (e) => {
      e.preventDefault();
      if (await onAktion(() => api.post(`/api/v1/projekte/${projektId}/aufgaben`, { ...w, zugewiesen_id: w.zugewiesen_id ? Number(w.zugewiesen_id) : null }))) setW({ text: "", faellig: "", zugewiesen_id: "" });
    }}>
      <div style={{ flex: "1 1 260px" }}><Feld label="Neue Aufgabe"><Eingabe value={w.text} onChange={(e) => setW({ ...w, text: e.target.value })} /></Feld></div>
      <div style={{ width: 160 }}><Feld label="Fällig am"><Eingabe type="date" value={w.faellig} onChange={(e) => setW({ ...w, faellig: e.target.value })} /></Feld></div>
      <div style={{ width: 200 }}><Feld label="Zuständig"><Auswahl leer="– niemand –" value={w.zugewiesen_id} onChange={(e) => setW({ ...w, zugewiesen_id: e.target.value })}
        optionen={(benutzer.daten?.zeilen || []).map((b) => ({ wert: String(b.id), titel: b.name || b.benutzername }))} /></Feld></div>
      <Knopf type="submit" icon="Plus">Hinzufügen</Knopf>
    </form>
  );
}
function AufgabenTabelle({ zeilen, darf, onAktion, mitProjekt }) {
  const { api } = useLager();
  const heute = heuteIso();
  return (
    <Tabelle zeilen={zeilen} leer="Keine Aufgaben." spalten={[
      { titel: "", breite: 40, wert: (a) => <input type="checkbox" aria-label={`${a.text} erledigt`} checked={a.erledigt} disabled={!darf} onChange={(e) => onAktion(() => api.put(`/api/v1/aufgaben/${a.id}`, { erledigt: e.target.checked }))} /> },
      { titel: "Aufgabe", wert: (a) => <span style={{ textDecoration: a.erledigt ? "line-through" : undefined }}>{a.text}</span> },
      ...(mitProjekt ? [{ titel: "Projekt", wert: (a) => <a href={`#/projekte/${a.projekt_id}?tab=aufgaben`}>{a.nummer} {a.projekt}</a> }] : []),
      { titel: "Fällig", wert: (a) => (a.faellig ? <span style={{ color: !a.erledigt && a.faellig < heute ? "var(--lp-err)" : undefined, fontWeight: !a.erledigt && a.faellig < heute ? 600 : undefined }}>
        {!a.erledigt && a.faellig < heute && <Icon name="AlertTriangle" size={14} aria-label="überfällig" style={{ verticalAlign: -2 }} />} {datumAnzeige(a.faellig)}</span> : "–") },
      { titel: "Zuständig", wert: (a) => a.zugewiesen_name || a.zugewiesen_benutzer || "–" },
      ...(darf ? [{ titel: "", breite: 50, wert: (a) => <Knopf klein art="geist" icon="Trash2" aria-label={`${a.text} löschen`} onClick={() => onAktion(() => api.del(`/api/v1/aufgaben/${a.id}`))} /> }] : []),
    ]} />
  );
}
function ProjektAufgaben({ p, darf, onAktion }) {
  return (
    <Section titel="Aufgaben" icon="ListChecks">
      {darf && <AufgabeNeu projektId={p.id} onAktion={onAktion} />}
      <AufgabenTabelle zeilen={p.aufgaben} darf={darf} onAktion={onAktion} />
    </Section>
  );
}
export function AufgabenListe({ query }) {
  const { api, nutzer } = useLager();
  const [filter, setFilter] = useState(query.filter || "meine");
  const [erledigt, setErledigt] = useState(false);
  const l = useDaten(() => api.get(`/api/v1/aufgaben?filter=${filter}${erledigt ? "&erledigt=1" : ""}`), [filter, erledigt]);
  useLive(["aufgabe"], () => l.laden());
  const [meldung, setMeldung] = useState(null);
  const aktion = async (fn) => { setMeldung(null); try { const r = await fn(); l.laden(); return r; } catch (e) { setMeldung({ level: "error", text: fehlerText(e) }); return null; } };
  return (
    <Seite titel="Aufgaben" untertitel="Überfällige zuerst">
      <Tabs tabs={[{ id: "meine", titel: "Meine" }, { id: "alle", titel: "Alle" }]} aktiv={filter} onWechsel={setFilter} />
      {meldung && <Meldung {...meldung} />}
      <Section aktionen={<label className="lp-toggle"><input type="checkbox" checked={erledigt} onChange={(e) => setErledigt(e.target.checked)} />Erledigte zeigen</label>}>
        {l.fehler && <Meldung level="error" text={l.fehler} />}
        <AufgabenTabelle zeilen={l.daten?.zeilen} darf={darfP(nutzer)} onAktion={aktion} mitProjekt />
      </Section>
    </Seite>
  );
}

/* ── Dateien (FA-33) ── */
function ProjektDateien({ p, darf, onAktion }) {
  const { api } = useLager();
  const datei = useRef(null);
  const [kategorie, setKategorie] = useState("sonstiges");
  const [beschreibung, setBeschreibung] = useState("");
  const [fehler, setFehler] = useState(null);
  const [ansicht, setAnsicht] = useState(null);
  const hochladen = async (dateien) => {
    setFehler(null);
    const fehlerListe = [], ok = [];
    for (const f of dateien) {
      const vorab = pruefeDatei(f.name, f.size);
      if (vorab) { fehlerListe.push(`${f.name}: ${vorab}`); continue; }
      try {
        const r = await api.anfrage("POST", `/api/v1/projekte/${p.id}/dateien?name=${encodeURIComponent(f.name)}&kategorie=${kategorie}&beschreibung=${encodeURIComponent(beschreibung)}`,
          f, { headers: { "Content-Type": "application/octet-stream" } });
        ok.push(r.datei.name);
      } catch (e) { fehlerListe.push(`${f.name}: ${fehlerText(e)}`); }
    }
    if (ok.length) await onAktion(async () => ({ level: "success", text: `${ok.length} Datei(en) hochgeladen: ${ok.join(", ")}.` }));
    if (fehlerListe.length) setFehler(fehlerListe.join(" "));
    setBeschreibung("");
    if (datei.current) datei.current.value = "";
  };
  const ansehen = async (d) => {
    try {
      const r = await api.anfrage("GET", `/api/v1/dateien/${d.id}`, undefined, { roh: true });
      setAnsicht({ name: d.name, url: URL.createObjectURL(await r.blob()), pdf: endung(d.name) === "pdf" });
    } catch (e) { setFehler(fehlerText(e)); }
  };
  return (
    <Section titel="Dateien" icon="FileText">
      {darf && <div className="lp-zeile" style={{ alignItems: "flex-end", marginBottom: 12 }}>
        <div style={{ width: 200 }}><Feld label="Kategorie"><Auswahl value={kategorie} onChange={(e) => setKategorie(e.target.value)} optionen={Object.entries(DATEI_KATEGORIEN).map(([wert, titel]) => ({ wert, titel }))} /></Feld></div>
        <div style={{ flex: "1 1 220px" }}><Feld label="Beschreibung"><Eingabe value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)} /></Feld></div>
        <input ref={datei} type="file" multiple hidden data-testid="datei-upload" accept={DATEI_ENDUNGEN.map((e) => "." + e).join(",")} onChange={(e) => hochladen([...e.target.files])} />
        <Knopf icon="Upload" onClick={() => datei.current?.click()}>Datei hochladen</Knopf>
      </div>}
      <p className="lp-hinweis" style={{ marginTop: 0 }}>Erlaubt: {DATEI_ENDUNGEN.join(", ")} · höchstens {MAX_DATEI / 1048576} MB je Datei.</p>
      {fehler && <div style={{ margin: "10px 0" }}><Meldung level="error" text={fehler} onSchliessen={() => setFehler(null)} /></div>}
      <Tabelle zeilen={p.dateien} leer="Noch keine Dateien." spalten={[
        { titel: "Name", wert: (d) => <strong>{d.name}</strong> },
        { titel: "Kategorie", wert: (d) => DATEI_KATEGORIEN[d.kategorie] },
        { titel: "Beschreibung", feld: "beschreibung" },
        { titel: "Größe", rechts: true, wert: (d) => groesseText(d.groesse) },
        { titel: "Hochgeladen", wert: (d) => `${zeitpunktAnzeige(d.hochgeladen)}${d.von ? ` · ${d.von}` : ""}` },
        { titel: "", wert: (d) => <div className="lp-zeile" style={{ justifyContent: "flex-end" }}>
          {inlineErlaubt(d.name) && <Knopf klein icon="Eye" onClick={() => ansehen(d)}>Ansehen</Knopf>}
          <Knopf klein icon="Download" aria-label={`${d.name} herunterladen`} onClick={() => ladeHerunter(api, `/api/v1/dateien/${d.id}?download=1`, d.name).catch((e) => setFehler(fehlerText(e)))} />
          {darf && <Knopf klein art="geist" icon="Trash2" aria-label={`${d.name} löschen`} onClick={() => onAktion(() => api.del(`/api/v1/dateien/${d.id}`))} />}
        </div> },
      ]} />
      {ansicht && <Modal titel={ansicht.name} breite={900} onSchliessen={() => { URL.revokeObjectURL(ansicht.url); setAnsicht(null); }}>
        {ansicht.pdf ? <object aria-label={ansicht.name} data={ansicht.url} type="application/pdf" style={{ width: "100%", height: "70vh" }}><p className="lp-hinweis">Die Vorschau ist hier nicht möglich. Lade die Datei herunter und öffne sie im PDF-Programm.</p></object> : <img alt={ansicht.name} src={ansicht.url} style={{ maxWidth: "100%" }} />}
      </Modal>}
    </Section>
  );
}

/* ── Kalender (FA-34) ── */
const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const iso = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
export function Kalender({ query }) {
  const { api, navigiere } = useLager();
  const heute = heuteIso();
  const [monat, setMonat] = useState(query.monat || heute.slice(0, 7));
  const [y, m] = monat.split("-").map(Number);
  const tage = useMemo(() => {
    const erster = new Date(Date.UTC(y, m - 1, 1));
    const start = new Date(erster); start.setUTCDate(1 - ((erster.getUTCDay() + 6) % 7)); // Montag
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setUTCDate(start.getUTCDate() + i); return iso(d); });
  }, [y, m]);
  const l = useDaten(() => api.get(`/api/v1/kalender?von=${tage[0]}&bis=${tage[41]}`), [tage[0]]);
  useLive(["projekt"], () => l.laden());
  const schiebe = (n) => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); setMonat(iso(d).slice(0, 7)); };
  const wochen = Array.from({ length: 6 }, (_, w) => tage.slice(w * 7, w * 7 + 7));
  return (
    <Seite titel="Kalender" untertitel="Projekte nach Status. Klick öffnet das Projekt."
      aktionen={<><Knopf icon="ChevronLeft" aria-label="Vorheriger Monat" onClick={() => schiebe(-1)} /><strong style={{ minWidth: 140, textAlign: "center" }} data-testid="monat">{MONATE[m - 1]} {y}</strong>
        <Knopf icon="ChevronRight" aria-label="Nächster Monat" onClick={() => schiebe(1)} /><Knopf onClick={() => setMonat(heute.slice(0, 7))}>Heute</Knopf></>}>
      {l.fehler && <Meldung level="error" text={l.fehler} />}
      <div className="lp-zeile" style={{ gap: 12 }}>{Object.entries(PROJEKT_STATUS).map(([s, t]) => <span key={s} className="lp-meta"><span className="lp-punkt" style={{ background: STATUS_FARBE[s] }} /> {t}</span>)}</div>
      <div className="lp-kalender" role="grid" aria-label={`${MONATE[m - 1]} ${y}`}>
        {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((t) => <div key={t} className="lp-kalender-kopf" role="columnheader">{t}</div>)}
        {wochen.flat().map((t, i) => {
          const projekte = (l.daten?.zeilen || []).filter((p) => p.beginn <= t && (p.ende || p.beginn) >= t);
          return (
            <div key={t} role="gridcell" className="lp-kalender-tag" data-fremd={t.slice(0, 7) !== monat || undefined} data-heute={t === heute || undefined} data-tag={t}>
              <div className="lp-kalender-zahl">{Number(t.slice(8))}</div>
              {projekte.slice(0, 4).map((p) => {
                const anfang = p.beginn === t || i % 7 === 0;
                return <button key={p.id} type="button" className="lp-kalender-balken" style={{ background: STATUS_FARBE[p.status] }} title={`${p.nummer} ${p.name} · ${PROJEKT_STATUS[p.status]}`}
                  onClick={() => navigiere(`/projekte/${p.id}`)}>{anfang ? `${p.nummer} ${p.name}` : " "}</button>;
              })}
              {projekte.length > 4 && <div className="lp-meta">+{projekte.length - 4} weitere</div>}
            </div>
          );
        })}
      </div>
    </Seite>
  );
}
