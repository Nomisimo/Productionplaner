// FA-26 Kundenstamm (Liste, Detail, Bearbeiten, Dublettenwarnung), FA-27 Kontaktformular-PDF + Import, Adresssuche.
import { AenderungsVerlauf } from "@lager/ui/aenderungen.jsx";
import React, { useEffect, useRef, useState } from "react";
import { Seite, Section, Knopf, Tabelle, Eingabe, Feld, Meldung, Textfeld, Modal, useDaten, useFormular, useBestaetigung } from "@lager/ui/bausteine.jsx";
import { useLager, useLive } from "@lager/ui/huelle.jsx";
import { ladeHerunter } from "@lager/ui/download.js";
import { StatusBadge } from "./Projekte.jsx";
import { fehlerText } from "@lager/ui/texte.js";
import { datumAnzeige } from "@lager/domain/zeit.js";
import { euro } from "@lager/domain/geld.js";

const TITEL = { name: "Ansprechpartner", firma: "Firma", email: "E-Mail", telefon: "Telefon", strasse: "Straße", plz: "PLZ", ort: "Ort", ust_id: "USt-IdNr.", notizen: "Anmerkungen" };
const LEER = { name: "", firma: "", email: "", telefon: "", strasse: "", plz: "", ort: "", ust_id: "", notizen: "" };

/** Datei vom Server laden und speichern (Electron zeigt den Speichern-Dialog). */

export function KundenListe({ query }) {
  const { api, navigiere, nutzer } = useLager();
  const [q, setQ] = useState(query.q || "");
  const l = useDaten(() => api.get(`/api/v1/kunden?q=${encodeURIComponent(q)}`), [q]);
  const [meldung, setMeldung] = useState(null);
  const [vorschau, setVorschau] = useState(null);
  const datei = useRef(null);
  useLive("kunde", () => l.laden());
  const darf = nutzer.admin || nutzer.rechte.kunden === "w";
  const importieren = async (f) => {
    if (!f) return;
    try { setVorschau(await api.anfrage("POST", "/api/v1/kunden/import", new Blob([await f.arrayBuffer()], { type: "application/pdf" }), { headers: { "Content-Type": "application/pdf" } })); }
    catch (e) { setMeldung({ level: "error", text: fehlerText(e) }); }
    datei.current.value = "";
  };
  return (
    <Seite titel="Kunden" aktionen={<>
      <Knopf icon="Download" onClick={() => ladeHerunter(api, "/api/v1/kunden/formular.pdf", "Kontaktformular.pdf").catch((e) => setMeldung({ level: "error", text: fehlerText(e) }))}>Kontaktformular (PDF)</Knopf>
      {darf && <><input ref={datei} type="file" accept="application/pdf" hidden onChange={(e) => importieren(e.target.files[0])} data-testid="import-datei" />
        <Knopf icon="Upload" onClick={() => datei.current.click()}>Formular importieren</Knopf>
        <Knopf art="primaer" icon="Plus" onClick={() => navigiere("/kunden/neu")}>Neuer Kunde</Knopf></>}
    </>}>
      {meldung && <Meldung {...meldung} onSchliessen={() => setMeldung(null)} />}
      <Section>
        <div style={{ marginBottom: 12, maxWidth: 420 }}><Eingabe placeholder="Suchen: Name, Firma, Ort, E-Mail" aria-label="Suchen" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Tabelle zeilen={l.daten?.zeilen} leer={l.laedt ? "Lädt …" : "Keine Kunden gefunden."} onZeile={(k) => navigiere(`/kunden/${k.id}`)} spalten={[
          { titel: "Firma", wert: (k) => k.firma || "–" }, { titel: "Ansprechpartner", feld: "name" }, { titel: "Ort", wert: (k) => [k.plz, k.ort].filter(Boolean).join(" ") },
          { titel: "Telefon", feld: "telefon" }, { titel: "E-Mail", feld: "email" },
        ]} />
      </Section>
      {vorschau && <ImportVorschau vorschau={vorschau} onFertig={(k) => { setVorschau(null); if (k) navigiere(`/kunden/${k.id}`); }} />}
    </Seite>
  );
}

function DublettenListe({ dubletten }) {
  return (
    <Tabelle zeilen={dubletten.map((d) => ({ ...d.kunde, gruende: d.gruende.join(", ") }))} spalten={[
      { titel: "Vorhanden", wert: (k) => <a href={`#/kunden/${k.id}`}>{k.firma || k.name}</a> }, { titel: "Ansprechpartner", feld: "name" },
      { titel: "Ort", feld: "ort" }, { titel: "Grund", feld: "gruende" },
    ]} />
  );
}

function ImportVorschau({ vorschau, onFertig }) {
  const { api } = useLager();
  const [fehler, setFehler] = useState(null);
  const w = vorschau.werte;
  const anlegen = async () => {
    try { const r = await api.post("/api/v1/kunden", { ...w, trotzdem: true }); onFertig(r.kunde); } catch (e) { setFehler(fehlerText(e)); }
  };
  return (
    <Modal titel="Vorschau: Kontaktformular" breite={680} onSchliessen={() => onFertig(null)}
      fuss={<><Knopf art="geist" onClick={() => onFertig(null)}>Abbrechen</Knopf><Knopf art="primaer" icon="Plus" onClick={anlegen} disabled={!!Object.keys(vorschau.felder).length}>Als neuen Kunden anlegen</Knopf></>}>
      <div className="lp-raster">{Object.entries(w).filter(([, v]) => v).map(([k, v]) => <div key={k}><div className="lp-label">{TITEL[k] || k}</div>{v}</div>)}</div>
      {Object.values(vorschau.felder).map((t) => <div key={t} style={{ marginTop: 10 }}><Meldung level="error" text={t} /></div>)}
      {vorschau.dubletten.length > 0 && <div style={{ marginTop: 14 }}>
        <Meldung level="warning" text="Mögliche Dubletten gefunden. Prüfe, ob der Kunde schon existiert, bevor du ihn neu anlegst." />
        <div style={{ marginTop: 8 }}><DublettenListe dubletten={vorschau.dubletten} /></div>
      </div>}
      {fehler && <div style={{ marginTop: 10 }}><Meldung level="error" text={fehler} /></div>}
    </Modal>
  );
}

/** Adressfeld mit Vorschlägen (serverseitige Adresssuche). */
function AdressSuche({ onWahl }) {
  const { api } = useLager();
  const [q, setQ] = useState("");
  const [tr, setTr] = useState([]);
  const [fehler, setFehler] = useState(null);
  useEffect(() => {
    if (q.trim().length < 3) { setTr([]); return; }
    const t = setTimeout(() => api.get(`/api/v1/adresse?q=${encodeURIComponent(q)}`).then((r) => { setTr(r); setFehler(null); }, (e) => setFehler(fehlerText(e))), 350);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div style={{ gridColumn: "1/-1", position: "relative" }}>
      <Feld label="Adresse suchen" hinweis="Tippe Straße und Ort, dann einen Vorschlag wählen." fehler={fehler}>
        <Eingabe value={q} onChange={(e) => setQ(e.target.value)} placeholder="z. B. Domkloster 4 Köln" />
      </Feld>
      {tr.length > 0 && <div className="lp-modal" role="listbox" style={{ position: "absolute", top: 62, left: 0, right: 0, zIndex: 20 }}>
        {tr.map((a) => <button key={a.text} className="lp-menue-eintrag" onClick={() => { onWahl(a); setTr([]); setQ(""); }}>{a.text}</button>)}
      </div>}
    </div>
  );
}

export function KundeFormular({ params }) {
  const { api, navigiere } = useLager();
  const neu = !params.id;
  const f = useFormular(LEER);
  const [dubletten, setDubletten] = useState(null);
  useEffect(() => { if (!neu) api.get(`/api/v1/kunden/${params.id}`).then((k) => f.setWerte(k)); }, [params.id]);
  const speichern = (trotzdem = false) => f.absenden(async (w) => {
    try {
      const r = neu ? await api.post("/api/v1/kunden", { ...w, trotzdem }) : await api.put(`/api/v1/kunden/${params.id}`, w);
      navigiere(`/kunden/${r.kunde.id}`);
      return r;
    } catch (e) { if (e.status === 409 && e.daten?.dubletten) setDubletten(e.daten.dubletten); throw e; }
  });
  const w = f.werte;
  const feld = (k, label, extra = {}) => <Feld label={label} fehler={f.fehler[k]} pflicht={k === "name"} breit={extra.breit}>{extra.text ? <Textfeld value={w[k]} onChange={f.setze(k)} /> : <Eingabe value={w[k]} onChange={f.setze(k)} />}</Feld>;
  return (
    <Seite titel={neu ? "Neuer Kunde" : `Kunde bearbeiten`} aktionen={<Knopf art="geist" onClick={() => history.back()}>Zurück</Knopf>}>
      <Section>
        <div className="lp-raster">
          {feld("firma", "Firma")}{feld("name", "Ansprechpartner")}{feld("email", "E-Mail")}{feld("telefon", "Telefon")}
          <AdressSuche onWahl={(a) => f.setWerte({ ...w, strasse: a.strasse, plz: a.plz, ort: a.ort })} />
          {feld("strasse", "Straße")}{feld("plz", "PLZ")}{feld("ort", "Ort")}{feld("ust_id", "USt-IdNr.")}
          {feld("notizen", "Notizen", { breit: true, text: true })}
        </div>
      </Section>
      {dubletten && <Section titel="Mögliche Dubletten" icon="AlertTriangle">
        <DublettenListe dubletten={dubletten} />
        <div className="lp-zeile" style={{ marginTop: 10 }}><Knopf onClick={() => speichern(true)}>Trotzdem als neuen Kunden anlegen</Knopf></div>
      </Section>}
      {f.meldung && <Meldung {...f.meldung} />}
      <div className="lp-zeile"><Knopf art="primaer" icon="Save" onClick={() => speichern(false)}>Speichern</Knopf></div>
    </Seite>
  );
}

export function KundeDetail({ params }) {
  const { api, navigiere, nutzer } = useLager();
  const d = useDaten(() => api.get(`/api/v1/kunden/${params.id}`), [params.id]);
  const [meldung, setMeldung] = useState(null);
  const [fragen, dialog] = useBestaetigung();
  useLive(["kunde", "projekt", "angebot"], () => d.laden());
  const k = d.daten;
  if (d.fehler) return <Seite titel="Kunde"><Meldung level="error" text={d.fehler} /></Seite>;
  if (!k) return null;
  const darf = nutzer.admin || nutzer.rechte.kunden === "w";
  return (
    <Seite titel={k.firma || k.name} untertitel={k.firma ? k.name : ""} aktionen={darf && <>
      <Knopf icon="Pencil" onClick={() => navigiere(`/kunden/${k.id}/bearbeiten`)}>Bearbeiten</Knopf>
      <Knopf art="gefahr" icon="Trash2" onClick={async () => {
        if (!(await fragen({ titel: "Kunden löschen?", text: `„${k.firma || k.name}“ wird gelöscht. Kunden mit Projekten lassen sich nicht löschen.`, knopf: "Löschen" }))) return;
        try { await api.del(`/api/v1/kunden/${k.id}`); navigiere("/kunden"); } catch (e) { setMeldung({ level: "error", text: fehlerText(e) }); }
      }}>Löschen</Knopf></>}>
      {meldung && <Meldung {...meldung} onSchliessen={() => setMeldung(null)} />}
      <Section titel="Kontakt">
        <div className="lp-raster">
          <div><div className="lp-label">Adresse</div>{k.strasse}<br />{k.plz} {k.ort}</div>
          <div><div className="lp-label">Telefon</div>{k.telefon || "–"}</div>
          <div><div className="lp-label">E-Mail</div>{k.email ? <a href={`mailto:${k.email}`}>{k.email}</a> : "–"}</div>
          <div><div className="lp-label">USt-IdNr.</div>{k.ust_id || "–"}</div>
          <div><div className="lp-label">Kunde seit</div>{datumAnzeige(k.erstellt)}</div>
        </div>
        {k.notizen && <p style={{ whiteSpace: "pre-wrap" }}>{k.notizen}</p>}
      </Section>
      <Section titel="Projekte" icon="FolderKanban" aktionen={(nutzer.admin || nutzer.rechte.projekte === "w") && <Knopf icon="Plus" onClick={() => navigiere(`/projekte/neu?kunde=${k.id}`)}>Neues Projekt</Knopf>}>
        <Tabelle zeilen={k.projekte} leer="Noch keine Projekte." onZeile={(p) => navigiere(`/projekte/${p.id}`)} spalten={[
          { titel: "Nummer", feld: "nummer" }, { titel: "Name", feld: "name" }, { titel: "Status", wert: (p) => <StatusBadge s={p.status} /> }, { titel: "Beginn", wert: (p) => datumAnzeige(p.beginn) },
        ]} />
      </Section>
      <Section titel="Angebote" icon="FileText">
        <Tabelle zeilen={k.angebote} leer="Noch keine Angebote." onZeile={(a) => navigiere(`/angebote/${a.id}`)} spalten={[
          { titel: "Nummer", feld: "nummer" }, { titel: "Projekt", feld: "projekt_nummer" }, { titel: "Status", feld: "status" }, { titel: "Summe", rechts: true, wert: (a) => euro(a.summe) },
        ]} />
      </Section>
      <KundeDatenschutz k={k} onFertig={(r) => { setMeldung(r); d.laden(); }} />
      <AenderungsVerlauf tabelle="kunde" id={k.id} />
      {dialog}
    </Seite>
  );
}

/** NFA-03 Löschkonzept: Aufbewahrungsfrist, Datenauskunft (Art. 15 DSGVO), Anonymisieren nach Fristablauf (nur Admin). */
function KundeDatenschutz({ k, onFertig }) {
  const { api, nutzer } = useLager();
  const d = useDaten(() => api.get(`/api/v1/kunden/${k.id}/datenschutz`), [k.id, k.version]);
  const [offen, setOffen] = useState(false);
  const [text, setText] = useState("");
  const [fehler, setFehler] = useState(null);
  const darf = nutzer.admin || nutzer.rechte.kunden === "w";
  if (!d.daten) return null;
  return (
    <Section titel="Datenschutz" icon="ShieldCheck" aktionen={<>
      {darf && <Knopf icon="Download" onClick={() => ladeHerunter(api, `/api/v1/kunden/${k.id}/auskunft`, `Datenauskunft-Kunde-${k.id}.json`).catch((e) => setFehler(fehlerText(e)))}>Datenauskunft</Knopf>}
      {nutzer.admin && d.daten.anonymisieren && <Knopf art="gefahr" icon="EyeOff" onClick={() => setOffen(true)}>Kundendaten anonymisieren</Knopf>}</>}>
      {fehler && <Meldung level="error" text={fehler} onSchliessen={() => setFehler(null)} />}
      <p style={{ marginTop: 0 }} data-testid="datenschutz">{d.daten.text}</p>
      {d.daten.sperrt.length > 0 && <ul className="lp-liste">{d.daten.sperrt.slice(0, 5).map((x) => <li key={x.art + x.nummer}>{x.nummer} · {x.text} · bis {datumAnzeige(x.bis)}</li>)}</ul>}
      {offen && <Modal titel="Kundendaten anonymisieren?" onSchliessen={() => setOffen(false)} fuss={<>
        <Knopf art="geist" onClick={() => setOffen(false)}>Abbrechen</Knopf>
        <Knopf art="gefahr" disabled={text !== "ANONYMISIEREN"} onClick={async () => {
          try { const r = await api.post(`/api/v1/kunden/${k.id}/anonymisieren`, { bestaetigung: text }); setOffen(false); onFertig(r); } catch (e) { setFehler(fehlerText(e)); setOffen(false); }
        }}>Anonymisieren</Knopf></>}>
        <p style={{ marginTop: 0 }}>Name, Firma, Adresse, Telefon, E-Mail und Notizen werden endgültig gelöscht. Projekte und Belege bleiben mit der Kundennummer erhalten. Das lässt sich nicht rückgängig machen.</p>
        <Feld label="Zur Bestätigung ANONYMISIEREN eintippen"><Eingabe aria-label="Bestätigung" value={text} onChange={(e) => setText(e.target.value)} /></Feld>
      </Modal>}
    </Section>
  );
}
