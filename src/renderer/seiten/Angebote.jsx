// Angebote (FA-41–FA-44): Liste, Editor mit Überbuchungshinweis, Statuswechsel mit Fassungen, PDF, Packliste.
// Kalkulator und Zeitrechner (FA-45). Rechnen über @lager/domain (gleiche Formeln wie der Server).
import React, { useEffect, useMemo, useState } from "react";
import { Seite, Section, Knopf, Tabelle, Eingabe, Auswahl, Feld, Meldung, Textfeld, Modal, Badge, Leerzustand, GeldEingabe, useDaten, useBestaetigung, FassungsKonflikt, AenderungsBand, Praesenz } from "@lager/ui/bausteine.jsx";
import { useLager, useLive, usePlanungsProjekt } from "@lager/ui/huelle.jsx";
import { ladeHerunter } from "@lager/ui/download.js";
import { fehlerText } from "@lager/ui/texte.js";
import { datumAnzeige, zeitpunktAnzeige } from "@lager/domain/zeit.js";
import { euro } from "@lager/domain/geld.js";
import {
  ANGEBOT_STATUS, ANGEBOT_FARBE, POSITION_ARTEN, angebotBearbeitbar, angebotWechselErlaubt, positionSumme, angebotSumme,
  mengenschrittFehler, ueberbuchungHinweis, zeitrechner, tagesfaktor, kalkulatorPosition,
} from "@lager/domain/angebot.js";

export const AngebotBadge = ({ s }) => <Badge farbe={ANGEBOT_FARBE[s]} text="#fff">{ANGEBOT_STATUS[s] || s}</Badge>;
const STATUS_OPT = Object.entries(ANGEBOT_STATUS).map(([wert, titel]) => ({ wert, titel }));
const darfA = (n) => n.admin || n.rechte.angebote === "w";
const mengeText = (m) => String(Math.round(Number(m) * 100) / 100).replace(".", ",");
const zahl = (v) => (v === "" || v == null ? "" : Number(String(v).replace(",", ".")));

/* ── Liste ── */
export function AngebotListe({ query }) {
  const { api, navigiere, nutzer } = useLager();
  const [f, setF] = useState({ q: query.q || "", status: query.status || "" });
  const [neu, setNeu] = useState(false);
  const l = useDaten(() => api.get(`/api/v1/angebote?${new URLSearchParams(Object.entries(f).filter(([, v]) => v))}`), [f.q, f.status]);
  useLive(["angebot"], () => l.laden());
  return (
    <Seite titel="Angebote" tour="angebote" untertitel="Alle Angebote mit Status, Projekt und Nettosumme"
      aktionen={darfA(nutzer) && <Knopf art="primaer" icon="Plus" onClick={() => setNeu(true)}>Neues Angebot</Knopf>}>
      <Section>
        <div className="lp-zeile" style={{ marginBottom: 12 }}>
          <div style={{ flex: "1 1 240px" }}><Eingabe placeholder="Suchen: Nummer, Betreff, Projekt, Kunde" aria-label="Suchen" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></div>
          <div style={{ width: 180 }}><Auswahl aria-label="Status" leer="Alle Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} optionen={STATUS_OPT} /></div>
        </div>
        {l.fehler && <Meldung level="error" text={l.fehler} />}
        <Tabelle zeilen={l.daten?.zeilen} onZeile={(a) => navigiere(`/angebote/${a.id}`)} leer={l.laedt ? "Lädt …" : "Keine Angebote gefunden. Lege ein Angebot zu einem Projekt an."} spalten={[
          { titel: "Nummer", wert: (a) => <strong>{a.nummer}</strong> }, { titel: "Betreff", feld: "betreff" },
          { titel: "Projekt", wert: (a) => `${a.projekt_nummer} ${a.projekt_name}` }, { titel: "Kunde", wert: (a) => a.kunde_firma || a.kunde },
          { titel: "Datum", wert: (a) => datumAnzeige(a.datum) }, { titel: "Netto", rechts: true, wert: (a) => euro(a.summe_netto) },
          { titel: "Status", wert: (a) => <AngebotBadge s={a.status} /> },
        ]} />
      </Section>
      {neu && <NeuesAngebot onSchliessen={() => setNeu(false)} />}
    </Seite>
  );
}

/** Dialog: Projekt wählen und Angebot anlegen. */
export function NeuesAngebot({ projektId, onSchliessen }) {
  const { api, navigiere } = useLager();
  const [pid, setPid] = useState(projektId ? String(projektId) : "");
  const [fehler, setFehler] = useState(null);
  const projekte = useDaten(() => api.get("/api/v1/projekte?limit=500&status=anfrage,angebot_gesendet,bestaetigt,laeuft"), []);
  const anlegen = async () => {
    try { const r = await api.post("/api/v1/angebote", { projekt_id: Number(pid) }); navigiere(`/angebote/${r.angebot.id}`); } catch (e) { setFehler(fehlerText(e)); }
  };
  return (
    <Modal titel="Neues Angebot" onSchliessen={onSchliessen} fuss={<><Knopf onClick={onSchliessen}>Abbrechen</Knopf><Knopf art="primaer" icon="Plus" disabled={!pid} onClick={anlegen}>Angebot anlegen</Knopf></>}>
      {fehler && <Meldung level="error" text={fehler} />}
      <Feld label="Projekt" pflicht><Auswahl value={pid} onChange={(e) => setPid(e.target.value)} leer="Projekt wählen"
        optionen={(projekte.daten?.zeilen || []).map((p) => ({ wert: String(p.id), titel: `${p.nummer} ${p.name}` }))} /></Feld>
      <p className="lp-hinweis">Texte, Gültigkeit (Standard 14 Tage), Folgetag-Satz und Umsatzsteuer kommen aus den Einstellungen.</p>
    </Modal>
  );
}

/** PDF in der App ansehen (Blob, eingebaute PDF-Ansicht). */
function PdfAnsicht({ pfad, titel, onSchliessen }) {
  const { api } = useLager();
  const [url, setUrl] = useState(null);
  const [fehler, setFehler] = useState(null);
  useEffect(() => {
    let u = null;
    api.anfrage("GET", pfad, undefined, { roh: true }).then((r) => r.blob()).then((b) => { u = URL.createObjectURL(b); setUrl(u); }).catch((e) => setFehler(fehlerText(e)));
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [pfad]);
  return (
    <Modal titel={titel} breite={900} onSchliessen={onSchliessen}>
      {fehler && <Meldung level="error" text={fehler} />}
      {url ? <object aria-label={titel} data={url} type="application/pdf" style={{ width: "100%", height: "70vh" }} data-testid="pdf-ansicht">
        <p className="lp-hinweis">Die Vorschau ist hier nicht möglich. Lade das PDF herunter.</p></object> : !fehler && <p className="lp-hinweis">Lädt …</p>}
    </Modal>
  );
}

/* ── Editor (FA-41, FA-42, FA-43) ── */
const neuePosition = (art, tage) => ({ _k: Math.random().toString(36).slice(2), art, artikel_id: "", bezeichnung: "", menge: 1, tage: art === "verkauf" ? 1 : tage, einzelpreis: 0, folgetag_prozent: "", einheit: "", beschreibung: "", stunden: "" });

export function AngebotDetail({ params }) {
  const { api, navigiere, nutzer } = useLager();
  const d = useDaten(() => api.get(`/api/v1/angebote/${params.id}`), [params.id]);
  const artikel = useDaten(() => api.get("/api/v1/artikel?aktiv=1&limit=500"), []);
  const basis = useDaten(() => api.get("/api/v1/einstellungen/basis"), []);
  usePlanungsProjekt(d.daten?.projekt_id); // R-62: Angebot zählt als Planung am Projekt
  const [k, setK] = useState(null);
  const [pos, setPos] = useState([]);
  const [geaendert, setGeaendert] = useState(false);
  const [meldung, setMeldung] = useState(null);
  const [verf, setVerf] = useState({});
  const [pdf, setPdf] = useState(null);
  const [fragen, dialog] = useBestaetigung();
  // GLEICH: eigene Fassung beim „Meine Eingaben behalten“, Band bei Änderung woanders während eigener Eingaben
  const [ueberVersion, setUeberVersion] = useState(null);
  const [band, setBand] = useState(null);
  useLive(["angebot"], (m) => {
    if (m.id !== Number(params.id)) return;
    if (!geaendert) { d.laden(); return; }
    const v = ueberVersion ?? d.daten?.version;
    if (m.version != null && v != null && Number(m.version) > Number(v)) setBand({ von: m.von });
  });
  useEffect(() => {
    if (!d.daten) return;
    const a = d.daten;
    setK({ betreff: a.betreff, datum: a.datum, gueltig_bis: a.gueltig_bis || "", tage: a.tage, folgetag_prozent: a.folgetag_prozent, rabatt_prozent: a.rabatt_prozent, einleitung: a.einleitung, schlusstext: a.schlusstext });
    setPos(a.positionen.map((p) => ({ ...p, _k: String(p.id), folgetag_prozent: p.folgetag_prozent ?? "", stunden: p.stunden ?? "", artikel_id: p.artikel_id ? String(p.artikel_id) : "" })));
    setGeaendert(false); setUeberVersion(null); setBand(null);
  }, [d.daten]);
  const artikelKarte = useMemo(() => new Map((artikel.daten?.zeilen || []).map((x) => [String(x.id), x])), [artikel.daten]);
  // R-27 Live-Verfügbarkeit für alle Mietartikel (eigenes Angebot ausgenommen)
  const mietIds = [...new Set(pos.filter((p) => p.art === "miete" && p.artikel_id).map((p) => Number(p.artikel_id)))].sort().join(",");
  useEffect(() => {
    if (!d.daten || !mietIds) { setVerf({}); return; }
    api.post("/api/v1/verfuegbarkeit", { projekt_id: d.daten.projekt_id, artikel_ids: mietIds.split(",").map(Number), ausser_angebot: d.daten.id })
      .then((r) => setVerf(r.artikel)).catch(() => setVerf({}));
  }, [mietIds, d.daten]);

  if (d.fehler) return <Seite titel="Angebot"><Meldung level="error" text={d.fehler} /></Seite>;
  const a = d.daten;
  if (!a || !k) return <Seite titel="Angebot"><p className="lp-hinweis">Lädt …</p></Seite>;
  const darf = darfA(nutzer);
  const offen = darf && angebotBearbeitbar(a.status);
  const kopfSetze = (f) => (e) => { setK({ ...k, [f]: e?.target ? e.target.value : e }); setGeaendert(true); };
  const posSetze = (i, w) => { setPos(pos.map((p, j) => (j === i ? { ...p, ...w } : p))); setGeaendert(true); };
  const effektiv = (p) => ({ ...p, menge: Number(zahl(p.menge)) || 0, tage: Number(p.tage) || 1, einzelpreis: Number(p.einzelpreis) || 0,
    folgetag_prozent: p.folgetag_prozent === "" ? Number(k.folgetag_prozent) : Number(p.folgetag_prozent) });
  const summen = angebotSumme(pos.map(effektiv), { rabatt_prozent: Number(zahl(k.rabatt_prozent)) || 0, kleinunternehmer: a.kleinunternehmer, ust_satz: a.ust_satz });
  const einst = basis.daten || { tag_stunden_standard: 8, tag_stunden_erweitert: 10 };

  const waehleArtikel = (i, id) => {
    const x = artikelKarte.get(id);
    const p = pos[i];
    if (!x) return posSetze(i, { artikel_id: "" });
    const w = { artikel_id: id, bezeichnung: x.name, einheit: x.einheit || "Stück", mengenschritt: x.mengenschritt || 1 };
    if (p.art === "miete") Object.assign(w, { einzelpreis: x.preis_tag, folgetag_prozent: x.folgetag_prozent ?? "", menge: Math.max(Number(p.menge) || 1, x.mengenschritt || 1) });
    if (p.art === "verkauf") Object.assign(w, { einzelpreis: x.verkaufspreis ?? x.preis_tag });
    if (p.art === "frei" && x.ist_leistung) {
      const st = p.stunden === "" ? einst.tag_stunden_standard : Number(p.stunden);
      Object.assign(w, { stunden: st, einzelpreis: zeitrechner(st, { tagessatz: x.preis_tag, erweitert: x.preis_erweitert, zeitmodell: x.zeitmodell }, einst).summe });
    }
    posSetze(i, w);
  };
  const setzeStunden = (i, v) => {
    const p = pos[i];
    const x = artikelKarte.get(p.artikel_id);
    const w = { stunden: v };
    if (x?.ist_leistung && v !== "") w.einzelpreis = zeitrechner(Number(zahl(v)), { tagessatz: x.preis_tag, erweitert: x.preis_erweitert, zeitmodell: x.zeitmodell }, einst).summe;
    posSetze(i, w);
  };
  const verschiebe = (i, r) => { const n = [...pos]; const [x] = n.splice(i, 1); n.splice(i + r, 0, x); setPos(n); setGeaendert(true); };
  const artikelOpt = (art) => (artikel.daten?.zeilen || [])
    .filter((x) => (art === "miete" ? !x.ist_leistung && !x.verbrauch : art === "verkauf" ? !x.ist_leistung && (x.verkaeuflich || x.verbrauch) : x.ist_leistung))
    .map((x) => ({ wert: String(x.id), titel: `${x.name}${x.mengenschritt > 1 ? ` (${x.mengenschritt}er-Set)` : ""}` }));

  const speichern = async () => {
    setMeldung(null);
    try {
      const r = await api.put(`/api/v1/angebote/${a.id}`, { ...k, version: ueberVersion ?? a.version, tage: Number(k.tage), folgetag_prozent: Number(k.folgetag_prozent), rabatt_prozent: Number(zahl(k.rabatt_prozent)) || 0,
        positionen: pos.map((p) => ({ art: p.art, artikel_id: p.artikel_id ? Number(p.artikel_id) : null, bezeichnung: p.bezeichnung, menge: zahl(p.menge), tage: Number(p.tage),
          einzelpreis: p.einzelpreis, folgetag_prozent: p.folgetag_prozent === "" ? null : Number(p.folgetag_prozent), einheit: p.einheit, beschreibung: p.beschreibung, stunden: p.stunden === "" ? null : zahl(p.stunden) })) });
      setMeldung({ level: r.level, text: r.text });
      setGeaendert(false);
      d.laden();
      return true;
    } catch (e) {
      const aktuell = e.status === 409 ? e.daten?.aktuell : null;
      setMeldung(aktuell ? { level: "error", text: fehlerText(e), children: <FassungsKonflikt werte={k} aktuell={aktuell}
        titel={{ betreff: "Betreff", datum: "Datum", gueltig_bis: "Gültig bis", tage: "Miettage", folgetag_prozent: "Folgetag %", rabatt_prozent: "Rabatt %", einleitung: "Einleitung", schlusstext: "Schlusstext" }}
        onLaden={() => { setMeldung({ level: "info", text: "Neue Fassung geladen. Übernimm deine Änderungen und speichere erneut." }); d.laden(); }}
        onBehalten={() => { setUeberVersion(aktuell.version); setMeldung({ level: "warning", text: "Deine Eingaben bleiben stehen. Wenn du jetzt speicherst, ersetzen sie die neue Fassung." }); }} /> }
        : { level: "error", text: fehlerText(e) });
      return false;
    }
  };
  const status = async (nach) => {
    if (geaendert && !(await speichern())) return;
    if (nach === "versendet" && !(await fragen({ titel: a.status === "versendet" ? "Neue Fassung versenden?" : "Angebot versenden?", gefahr: false, knopf: "Versenden",
      text: `Es entsteht Fassung ${a.fassung + 1} als PDF im Projektordner. Das Material ist danach bis ${k.gueltig_bis ? datumAnzeige(k.gueltig_bis) : "auf Weiteres"} vorgemerkt.` }))) return;
    try { const r = await api.post(`/api/v1/angebote/${a.id}/status`, { status: nach }); setMeldung({ level: r.level, text: r.text }); d.laden(); }
    catch (e) { setMeldung({ level: "error", text: fehlerText(e) }); }
  };

  return (
    <Seite titel={`${a.nummer} ${a.betreff || ""}`.trim()} untertitel={`Projekt ${a.projekt_nummer} ${a.projekt_name} · ${a.kunde_firma || a.kunde}${a.beginn ? ` · ${datumAnzeige(a.beginn)}${a.ende && a.ende !== a.beginn ? ` – ${datumAnzeige(a.ende)}` : ""}` : " · ohne Termin"}${a.fassung ? ` · Fassung ${a.fassung}` : ""}`}
      aktionen={<>
        <Praesenz ort={`projekt:${a.projekt_id}`} />
        <AngebotBadge s={a.status} />
        <Knopf icon="Eye" onClick={() => setPdf({ pfad: `/api/v1/angebote/${a.id}/pdf${a.status === "entwurf" || geaendert ? "?vorschau=1" : ""}`, titel: `${a.nummer} PDF` })}>PDF</Knopf>
        <Knopf icon="ClipboardList" onClick={() => navigiere(`/angebote/${a.id}/packliste`)}>Packliste</Knopf>
        {darf && angebotWechselErlaubt(a.status, "versendet") && <Knopf art="primaer" icon="Send" onClick={() => status("versendet")}>{a.status === "versendet" ? "Neue Fassung versenden" : "Versenden"}</Knopf>}
        {darf && angebotWechselErlaubt(a.status, "angenommen") && <Knopf icon="Check" onClick={() => status("angenommen")}>Angenommen</Knopf>}
        {darf && angebotWechselErlaubt(a.status, "abgelehnt") && <Knopf icon="X" onClick={() => status("abgelehnt")}>Abgelehnt</Knopf>}
        {darf && angebotWechselErlaubt(a.status, "entwurf") && <Knopf icon="Undo2" onClick={() => status("entwurf")}>Zurück auf Entwurf</Knopf>}
        {darf && a.status === "entwurf" && <Knopf art="gefahr" icon="Trash2" aria-label="Angebot löschen" onClick={async () => {
          if (!(await fragen({ titel: "Angebot löschen?", text: `${a.nummer} wird gelöscht. Das geht nur, solange es nicht versendet wurde.`, knopf: "Löschen" }))) return;
          try { await api.del(`/api/v1/angebote/${a.id}`); navigiere(`/projekte/${a.projekt_id}?tab=angebote`); } catch (e) { setMeldung({ level: "error", text: fehlerText(e) }); }
        }} />}
      </>}>
      {dialog}
      {band && <AenderungsBand von={band.von} onNeuLaden={() => { setBand(null); d.laden(); }} onBehalten={() => setBand(null)} />}
      {meldung && <Meldung {...meldung} onSchliessen={() => setMeldung(null)} />}
      {!angebotBearbeitbar(a.status) && <Meldung level="info" text={`Dieses Angebot ist „${ANGEBOT_STATUS[a.status]}“ und nur noch lesbar.`} />}
      <Section titel="Kopf" icon="FileText">
        <div className="lp-raster">
          <Feld label="Betreff" breit><Eingabe value={k.betreff} disabled={!offen} onChange={kopfSetze("betreff")} /></Feld>
          <Feld label="Datum"><Eingabe type="date" value={k.datum} disabled={!offen} onChange={kopfSetze("datum")} /></Feld>
          <Feld label="Gültig bis"><Eingabe type="date" value={k.gueltig_bis} disabled={!offen} onChange={kopfSetze("gueltig_bis")} /></Feld>
          <Feld label="Miettage" hinweis="Standard für neue Positionen"><Eingabe type="number" min="1" value={k.tage} disabled={!offen} onChange={kopfSetze("tage")} /></Feld>
          <Feld label="Folgetag %"><Eingabe type="number" min="0" max="100" value={k.folgetag_prozent} disabled={!offen} onChange={kopfSetze("folgetag_prozent")} /></Feld>
          <Feld label="Rabatt %"><Eingabe inputMode="decimal" value={String(k.rabatt_prozent).replace(".", ",")} disabled={!offen} onChange={kopfSetze("rabatt_prozent")} /></Feld>
        </div>
        <Feld label="Einleitung"><Textfeld rows={2} value={k.einleitung} disabled={!offen} onChange={kopfSetze("einleitung")} /></Feld>
      </Section>
      <Section titel="Positionen" icon="ListChecks" aktionen={offen && <>
        <Knopf icon="Plus" onClick={() => { setPos([...pos, neuePosition("miete", k.tage)]); setGeaendert(true); }}>Material hinzufügen</Knopf>
        <Knopf icon="Plus" onClick={() => { setPos([...pos, neuePosition("verkauf", 1)]); setGeaendert(true); }}>Verkauf hinzufügen</Knopf>
        <Knopf icon="Plus" onClick={() => { setPos([...pos, { ...neuePosition("frei", k.tage), stunden: einst.tag_stunden_standard }]); setGeaendert(true); }}>Personal hinzufügen</Knopf>
        <Knopf icon="Plus" onClick={() => { setPos([...pos, neuePosition("frei", 1)]); setGeaendert(true); }}>Freie Position</Knopf>
      </>}>
        {!pos.length ? <Leerzustand text="Noch keine Positionen. Füge Material, Personal oder freie Positionen hinzu." icon="ListChecks" /> :
          <div className="lp-tabelle-wrap"><table className="lp-tabelle" data-testid="positionen">
            <thead><tr><th>#</th><th>Art</th><th>Artikel / Bezeichnung</th><th className="rechts">Menge</th><th className="rechts">Tage</th><th className="rechts">Folgetag %</th><th className="rechts">Einzelpreis</th><th className="rechts">Summe</th><th /></tr></thead>
            <tbody>{pos.map((p, i) => {
              const e = effektiv(p);
              const x = artikelKarte.get(p.artikel_id);
              const schritt = p.art === "miete" ? mengenschrittFehler(e.menge, x?.mengenschritt || p.mengenschritt || 1) : null;
              const v = p.art === "miete" && p.artikel_id ? verf[p.artikel_id] : null;
              // eigene andere Positionen desselben Artikels zählen mit
              const gleich = p.art === "miete" ? pos.filter((q, j) => j !== i && q.art === "miete" && q.artikel_id === p.artikel_id).reduce((s, q) => s + (Number(zahl(q.menge)) || 0), 0) : 0;
              const hinweis = v ? ueberbuchungHinweis(e.menge + gleich, v) : null;
              const personal = p.art === "frei" && x?.ist_leistung;
              return (
                <React.Fragment key={p._k}>
                  <tr aria-label={`Position ${i + 1}`}>
                    <td>{i + 1}</td>
                    <td>{POSITION_ARTEN[p.art]}</td>
                    <td style={{ minWidth: 240 }}>
                      {(p.art !== "frei" || p.artikel_id || p.stunden !== "") && <Auswahl aria-label={`Artikel Position ${i + 1}`} disabled={!offen} value={p.artikel_id} leer={p.art === "frei" ? "Leistung wählen" : "Artikel wählen"}
                        onChange={(ev) => waehleArtikel(i, ev.target.value)} optionen={artikelOpt(p.art)} />}
                      <Eingabe aria-label={`Bezeichnung Position ${i + 1}`} placeholder="Bezeichnung" disabled={!offen} value={p.bezeichnung} onChange={(ev) => posSetze(i, { bezeichnung: ev.target.value })} style={{ marginTop: 4 }} />
                      {personal && <div className="lp-zeile" style={{ marginTop: 4, alignItems: "center" }}><span className="lp-meta">Stunden/Tag</span>
                        <Eingabe aria-label={`Stunden Position ${i + 1}`} inputMode="decimal" style={{ width: 70 }} disabled={!offen} value={String(p.stunden).replace(".", ",")} onChange={(ev) => setzeStunden(i, ev.target.value)} />
                        <span className="lp-meta">{zeitrechnerText(zeitrechner(Number(zahl(p.stunden)) || 0, { tagessatz: x.preis_tag, erweitert: x.preis_erweitert, zeitmodell: x.zeitmodell }, einst))}</span></div>}
                    </td>
                    <td className="rechts"><Eingabe aria-label={`Menge Position ${i + 1}`} inputMode="decimal" style={{ width: 70, textAlign: "right" }} disabled={!offen} value={String(p.menge).replace(".", ",")} onChange={(ev) => posSetze(i, { menge: ev.target.value })} /></td>
                    <td className="rechts">{p.art === "verkauf" ? "–" : <Eingabe aria-label={`Tage Position ${i + 1}`} type="number" min="1" style={{ width: 64, textAlign: "right" }} disabled={!offen} value={p.tage} onChange={(ev) => posSetze(i, { tage: ev.target.value })} />}</td>
                    <td className="rechts">{p.art === "miete" ? <Eingabe aria-label={`Folgetag Position ${i + 1}`} type="number" min="0" max="100" placeholder={String(k.folgetag_prozent)} style={{ width: 64, textAlign: "right" }} disabled={!offen} value={p.folgetag_prozent} onChange={(ev) => posSetze(i, { folgetag_prozent: ev.target.value })} /> : "–"}</td>
                    <td className="rechts"><GeldEingabe aria-label={`Einzelpreis Position ${i + 1}`} style={{ width: 100, textAlign: "right" }} disabled={!offen} cent={p.einzelpreis} onCent={(c) => posSetze(i, { einzelpreis: Number.isFinite(c) ? c : 0 })} /></td>
                    <td className="rechts" data-testid={`summe-${i + 1}`}><strong>{euro(positionSumme(e))}</strong>
                      {p.art !== "verkauf" && e.tage > 1 && <div className="lp-meta">× {String(tagesfaktor(p.art, e.tage, e.folgetag_prozent)).replace(".", ",")}</div>}</td>
                    <td>{offen && <div className="lp-zeile" style={{ flexWrap: "nowrap" }}>
                      <Knopf klein art="geist" icon="ArrowUp" aria-label={`Position ${i + 1} nach oben`} disabled={i === 0} onClick={() => verschiebe(i, -1)} />
                      <Knopf klein art="geist" icon="ArrowDown" aria-label={`Position ${i + 1} nach unten`} disabled={i === pos.length - 1} onClick={() => verschiebe(i, 1)} />
                      <Knopf klein art="geist" icon="Trash2" aria-label={`Position ${i + 1} entfernen`} onClick={() => { setPos(pos.filter((_, j) => j !== i)); setGeaendert(true); }} />
                    </div>}</td>
                  </tr>
                  {(schritt || hinweis || (v && v.verfuegbar != null)) && <tr><td /><td colSpan={8} style={{ paddingTop: 0 }}>
                    {schritt && <div style={{ color: "var(--lp-err)" }} role="alert">{schritt}</div>}
                    {hinweis ? <div className="lp-warnhinweis" role="status" data-testid="ueberbuchung">{hinweis}</div>
                      : v && v.verfuegbar != null && <span className="lp-meta">Verfügbar im Zeitraum: {mengeText(v.verfuegbar - gleich)} von {v.bestand}</span>}
                  </td></tr>}
                </React.Fragment>
              );
            })}</tbody>
          </table></div>}
        <div className="lp-angebot-summen" data-testid="summen">
          <div><span>Zwischensumme</span><span>{euro(summen.zwischensumme)}</span></div>
          {summen.rabatt > 0 && <div><span>Rabatt {String(k.rabatt_prozent).replace(".", ",")} %</span><span>−{euro(summen.rabatt)}</span></div>}
          <div><strong>Summe netto</strong><strong>{euro(summen.netto)}</strong></div>
          {a.kleinunternehmer ? <div className="lp-meta">Kleinunternehmer: keine Umsatzsteuer (§ 19 UStG)</div> : <div><span>Umsatzsteuer {String(a.ust_satz).replace(".", ",")} %</span><span>{euro(summen.ust)}</span></div>}
          <div><strong>Summe brutto</strong><strong>{euro(summen.brutto)}</strong></div>
        </div>
      </Section>
      <Section titel="Schluss">
        <Feld label="Schlusstext"><Textfeld rows={2} value={k.schlusstext} disabled={!offen} onChange={kopfSetze("schlusstext")} /></Feld>
        {offen && <div className="lp-zeile"><Knopf art="primaer" icon="Save" disabled={!geaendert} onClick={speichern}>Speichern</Knopf><span className="lp-meta">{geaendert ? "Ungespeicherte Änderungen" : "Keine offenen Änderungen."}</span></div>}
      </Section>
      {a.fassungen.length > 0 && <Section titel="Fassungen (Archiv)" icon="Archive">
        <Tabelle zeilen={a.fassungen} spalten={[
          { titel: "Fassung", wert: (f) => <strong>{f.fassung}{f.fassung === a.fassung ? " (aktuell)" : ""}</strong> },
          { titel: "Versendet", wert: (f) => `${zeitpunktAnzeige(f.erstellt)}${f.erstellt_von ? ` · ${f.erstellt_von}` : ""}` },
          { titel: "Netto", rechts: true, wert: (f) => euro(f.summe_netto) },
          { titel: "", wert: (f) => f.hat_pdf && <div className="lp-zeile" style={{ justifyContent: "flex-end" }}>
            <Knopf klein icon="Eye" onClick={() => setPdf({ pfad: `/api/v1/angebote/${a.id}/fassungen/${f.fassung}/pdf`, titel: `${a.nummer} Fassung ${f.fassung}` })}>Ansehen</Knopf>
            <Knopf klein icon="Download" aria-label={`Fassung ${f.fassung} herunterladen`} onClick={() => ladeHerunter(api, `/api/v1/angebote/${a.id}/fassungen/${f.fassung}/pdf?download=1`, `${a.nummer}-F${f.fassung}.pdf`).catch((e) => setMeldung({ level: "error", text: fehlerText(e) }))} />
          </div> },
        ]} />
      </Section>}
      {pdf && <PdfAnsicht {...pdf} onSchliessen={() => setPdf(null)} />}
    </Seite>
  );
}

const STUFE = { standard: "Tagessatz", erweitert: "erweiterter Tagessatz", ueberstunden: "erweitert + Überstunden", stunde: "nach Stunden", pauschale: "Pauschale" };
function zeitrechnerText(z) {
  return z.stufe === "ueberstunden" ? `${STUFE[z.stufe]}: ${mengeText(z.ueberstunden)} h × ${euro(z.ueberstundenSatz)}` : STUFE[z.stufe];
}

/* ── Packliste (FA-44, R-51–R-54) ── */
export function Packliste({ params }) {
  const { api, navigiere } = useLager();
  const d = useDaten(() => api.get(`/api/v1/angebote/${params.id}/packliste`), [params.id]);
  const [pdf, setPdf] = useState(false);
  useLive(["angebot", "geraet"], () => d.laden());
  if (d.fehler) return <Seite titel="Packliste"><Meldung level="error" text={d.fehler} /></Seite>;
  const pl = d.daten;
  if (!pl) return <Seite titel="Packliste"><p className="lp-hinweis">Lädt …</p></Seite>;
  const a = pl.angebot;
  return (
    <Seite titel={`Packliste ${a.projekt_nummer} ${a.projekt_name}`} untertitel={`Aus Angebot ${a.nummer}. Vorschläge buchen nichts; gepackt wird im Materialplaner.`}
      aktionen={<>
        <Knopf icon="FileText" onClick={() => navigiere(`/angebote/${a.id}`)}>Zum Angebot</Knopf>
        <Knopf icon="Eye" onClick={() => setPdf(true)}>PDF ansehen</Knopf>
        <Knopf icon="Download" onClick={() => ladeHerunter(api, `/api/v1/angebote/${a.id}/packliste.pdf?download=1`, `Packliste ${a.projekt_nummer}.pdf`)}>PDF herunterladen</Knopf>
      </>}>
      <Section>
        <Tabelle zeilen={pl.zeilen} schluessel="artikel_id" leer="Keine packbaren Positionen im Angebot." spalten={[
          { titel: "Kategorie", feld: "kategorie" },
          { titel: "Artikel", wert: (z) => <div><strong>{z.artikel}</strong>
            {z.set && <div className="lp-meta">{z.set.text}{z.set.vorschlag?.length ? ` · Vorschlag: ${z.set.vorschlag.map((t) => t.code).join(", ")}` : " · Keine freie, volle Tasche im Lager – packe die Teile einzeln."}</div>}
            {z.inhalt && <div className="lp-meta">{z.inhalt.text}</div>}
            {z.verbrauch && <div className="lp-meta">Verbrauch – von Hand kontrollieren</div>}</div> },
          { titel: "Soll", rechts: true, wert: (z) => `${mengeText(z.soll)} ${z.einheit}` },
          { titel: "Im Projekt", rechts: true, wert: (z) => z.ist ?? "–" },
          { titel: "Gepackt", rechts: true, wert: (z) => z.gepackt ?? "–" },
          { titel: "Fertig", wert: (z) => (z.fertig == null ? "–" : z.fertig ? <Badge farbe="#1f6e32" text="#fff">fertig</Badge> : <Badge farbe="#8a4b00" text="#fff">offen</Badge>) },
        ]} />
      </Section>
      {pdf && <PdfAnsicht pfad={`/api/v1/angebote/${a.id}/packliste.pdf`} titel={`Packliste ${a.projekt_nummer}`} onSchliessen={() => setPdf(false)} />}
    </Seite>
  );
}

/* ── Kalkulator (FA-45): grob kalkulieren ohne Angebot ── */
export function Kalkulator() {
  const { api } = useLager();
  const artikel = useDaten(() => api.get("/api/v1/artikel?aktiv=1&limit=500"), []);
  const basis = useDaten(() => api.get("/api/v1/einstellungen/basis"), []);
  const einst = basis.daten || { tag_stunden_standard: 8, tag_stunden_erweitert: 10, folgetag_prozent: 50, ust_satz: 19, kleinunternehmer: false };
  const [tage, setTage] = useState(1);
  const [rabatt, setRabatt] = useState("0");
  const [zeilen, setZeilen] = useState([{ k: 1, artikel_id: "", menge: 1, stunden: "" }]);
  const karte = new Map((artikel.daten?.zeilen || []).map((x) => [String(x.id), x]));
  const pos = zeilen.map((z) => {
    const x = karte.get(z.artikel_id);
    return x ? kalkulatorPosition(x, { menge: zahl(z.menge), tage, stunden: z.stunden === "" ? null : zahl(z.stunden) }, einst) : null;
  });
  const s = angebotSumme(pos.filter(Boolean), { rabatt_prozent: Number(zahl(rabatt)) || 0, kleinunternehmer: einst.kleinunternehmer, ust_satz: einst.ust_satz });
  const setze = (i, w) => setZeilen(zeilen.map((z, j) => (j === i ? { ...z, ...w } : z)));
  return (
    <Seite titel="Kalkulator" untertitel="Material und Personal grob kalkulieren. Nichts wird gespeichert oder reserviert.">
      <Section>
        <div className="lp-zeile" style={{ marginBottom: 12 }}>
          <div style={{ width: 120 }}><Feld label="Tage"><Eingabe type="number" min="1" value={tage} onChange={(e) => setTage(e.target.value)} /></Feld></div>
          <div style={{ width: 120 }}><Feld label="Rabatt %"><Eingabe inputMode="decimal" value={rabatt} onChange={(e) => setRabatt(e.target.value)} /></Feld></div>
        </div>
        <div className="lp-tabelle-wrap"><table className="lp-tabelle" data-testid="kalkulator">
          <thead><tr><th>Artikel / Leistung</th><th className="rechts">Menge</th><th className="rechts">Stunden/Tag</th><th className="rechts">Summe</th><th /></tr></thead>
          <tbody>{zeilen.map((z, i) => {
            const x = karte.get(z.artikel_id);
            return <tr key={z.k}>
              <td style={{ minWidth: 260 }}><Auswahl aria-label={`Kalkulator Artikel ${i + 1}`} value={z.artikel_id} leer="Artikel oder Leistung wählen" onChange={(e) => setze(i, { artikel_id: e.target.value })}
                optionen={(artikel.daten?.zeilen || []).map((a) => ({ wert: String(a.id), titel: `${a.name}${a.ist_leistung ? " (Personal)" : ""}` }))} /></td>
              <td className="rechts"><Eingabe aria-label={`Kalkulator Menge ${i + 1}`} inputMode="decimal" style={{ width: 70, textAlign: "right" }} value={z.menge} onChange={(e) => setze(i, { menge: e.target.value })} /></td>
              <td className="rechts">{x?.ist_leistung ? <Eingabe aria-label={`Kalkulator Stunden ${i + 1}`} inputMode="decimal" style={{ width: 70, textAlign: "right" }} placeholder={String(einst.tag_stunden_standard)} value={z.stunden} onChange={(e) => setze(i, { stunden: e.target.value })} /> : "–"}</td>
              <td className="rechts">{pos[i] ? euro(positionSumme(pos[i])) : "–"}</td>
              <td><Knopf klein art="geist" icon="Trash2" aria-label={`Zeile ${i + 1} entfernen`} onClick={() => setZeilen(zeilen.filter((_, j) => j !== i))} /></td>
            </tr>;
          })}</tbody>
        </table></div>
        <div className="lp-zeile" style={{ marginTop: 8 }}><Knopf icon="Plus" onClick={() => setZeilen([...zeilen, { k: Date.now(), artikel_id: "", menge: 1, stunden: "" }])}>Zeile</Knopf></div>
        <div className="lp-angebot-summen" data-testid="kalkulator-summen">
          <div><span>Zwischensumme</span><span>{euro(s.zwischensumme)}</span></div>
          {s.rabatt > 0 && <div><span>Rabatt</span><span>−{euro(s.rabatt)}</span></div>}
          <div><strong>Netto</strong><strong>{euro(s.netto)}</strong></div>
          {!einst.kleinunternehmer && <div><span>Umsatzsteuer {String(einst.ust_satz).replace(".", ",")} %</span><span>{euro(s.ust)}</span></div>}
          <div><strong>Brutto</strong><strong>{euro(s.brutto)}</strong></div>
        </div>
      </Section>
    </Seite>
  );
}

/* ── Zeitrechner (FA-45, R-28c) ── */
export function Zeitrechner() {
  const { api } = useLager();
  const basis = useDaten(() => api.get("/api/v1/einstellungen/basis"), []);
  const leistungen = useDaten(() => api.get("/api/v1/artikel?aktiv=1&typ=leistung&limit=500").catch(() => ({ zeilen: [] })), []);
  const einst = basis.daten || { tag_stunden_standard: 8, tag_stunden_erweitert: 10 };
  const [w, setW] = useState({ artikel_id: "", stunden: "12", tagessatz: 40000, erweitert: 50000, tage: 1, personen: 1 });
  const waehle = (id) => {
    const x = (leistungen.daten?.zeilen || []).find((a) => String(a.id) === id);
    setW({ ...w, artikel_id: id, ...(x ? { tagessatz: x.preis_tag, erweitert: x.preis_erweitert ?? x.preis_tag } : {}) });
  };
  const z = zeitrechner(Number(zahl(w.stunden)) || 0, { tagessatz: w.tagessatz || 0, erweitert: w.erweitert }, einst);
  const gesamt = z.summe * (Number(w.tage) || 1) * (Number(w.personen) || 1);
  return (
    <Seite titel="Zeitrechner" untertitel={`Tagessatz bis ${einst.tag_stunden_standard} h, erweiterter Tagessatz bis ${einst.tag_stunden_erweitert} h, darüber Überstunden.`}>
      <Section>
        <div className="lp-raster">
          <Feld label="Leistung" breit><Auswahl value={w.artikel_id} leer="Eigene Sätze" onChange={(e) => waehle(e.target.value)} optionen={(leistungen.daten?.zeilen || []).map((a) => ({ wert: String(a.id), titel: a.name }))} /></Feld>
          <Feld label="Stunden pro Tag"><Eingabe inputMode="decimal" value={w.stunden} onChange={(e) => setW({ ...w, stunden: e.target.value })} /></Feld>
          <Feld label="Tagessatz"><GeldEingabe cent={w.tagessatz} onCent={(c) => setW({ ...w, tagessatz: Number.isFinite(c) ? c : 0 })} /></Feld>
          <Feld label="Erweiterter Tagessatz"><GeldEingabe cent={w.erweitert} onCent={(c) => setW({ ...w, erweitert: Number.isFinite(c) ? c : null })} /></Feld>
          <Feld label="Tage"><Eingabe type="number" min="1" value={w.tage} onChange={(e) => setW({ ...w, tage: e.target.value })} /></Feld>
          <Feld label="Personen"><Eingabe type="number" min="1" value={w.personen} onChange={(e) => setW({ ...w, personen: e.target.value })} /></Feld>
        </div>
        <div className="lp-angebot-summen" data-testid="zeitrechner-ergebnis">
          <div><span>Stufe</span><span>{zeitrechnerText(z)}</span></div>
          <div><span>Überstunden je Tag</span><span>{mengeText(z.ueberstunden)} h</span></div>
          <div><span>Betrag je Person und Tag</span><span>{euro(z.summe)}</span></div>
          <div><strong>Gesamt</strong><strong>{euro(gesamt)}</strong></div>
        </div>
      </Section>
    </Seite>
  );
}
