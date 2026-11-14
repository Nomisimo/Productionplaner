// FA-37 Personal (Qualifikation, Verfügbarkeit, Einsätze, Einsatzplan) und FA-38 Fahrzeuge (Fahrten, Ladeliste) im Productionplaner.
import React, { useState } from "react";
import { Seite, Section, Knopf, Tabelle, Auswahl, Eingabe, Textfeld, Feld, Meldung, Modal, Badge, Tabs, Toggle, GeldEingabe, useDaten, useFormular, useBestaetigung } from "@lager/ui/bausteine.jsx";
import { useLager, useLive } from "@lager/ui/huelle.jsx";
import { fehlerText } from "@lager/ui/texte.js";
import { ladeHerunter } from "@lager/ui/download.js";
import { euro } from "@lager/domain/geld.js";
import { datumAnzeige, zeitpunktAnzeige, heuteIso, berlinZuIso, isoZuBerlin } from "@lager/domain/zeit.js";
import { PERSONAL_ARTEN } from "@lager/domain/ressourcen.js";

const darfPlanen = (n) => n.admin || n.rechte.projekte === "w";
const zeitraum = (a, b) => `${zeitpunktAnzeige(a)} – ${zeitpunktAnzeige(b)}`;
const plusTage = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const Konflikt = ({ an }) => (an ? <Badge farbe="#b3483f" text="#fff">Konflikt bestätigt</Badge> : null);

/** Speichert mit Konfliktprüfung: bei 409 mit Konflikten fragt der Dialog „Trotzdem eintragen?“. */
function useKonfliktSpeichern() {
  const [konflikt, setKonflikt] = useState(null);
  const speichere = async (f, sende) => {
    setKonflikt(null);
    try { const r = await sende(false); return r; }
    catch (e) {
      if (e.status === 409 && e.daten?.konflikte?.length) { setKonflikt({ texte: e.daten.konflikte, nochmal: () => f.absenden(() => sende(true)) }); return null; }
      throw e;
    }
  };
  return { konflikt, setKonflikt, speichere };
}

/* ── Einsatz-Dialog (auch aus dem Projekt) ── */
export function EinsatzDialog({ einsatz, projektId, positionen = [], onSchliessen, onFertig }) {
  const { api } = useLager();
  const leute = useDaten(() => api.get("/api/v1/personal"), []);
  const projekte = useDaten(() => (projektId ? Promise.resolve({ zeilen: [] }) : api.get("/api/v1/projekte?limit=500&status=anfrage,angebot_gesendet,bestaetigt,laeuft")), [projektId]);
  const f = useFormular({ personal_id: einsatz?.personal_id ? String(einsatz.personal_id) : "", projekt_id: String(einsatz?.projekt_id || projektId || ""),
    beginn: isoZuBerlin(einsatz?.beginn) || `${heuteIso()}T08:00`, ende: isoZuBerlin(einsatz?.ende) || `${heuteIso()}T17:00`, rolle: einsatz?.rolle || "",
    angebot_position_id: einsatz?.angebot_position_id ? String(einsatz.angebot_position_id) : "", notiz: einsatz?.notiz || "" });
  const k = useKonfliktSpeichern();
  const sende = (trotzdem) => {
    const w = f.werte;
    const body = { ...w, personal_id: Number(w.personal_id) || null, projekt_id: Number(w.projekt_id) || null, beginn: berlinZuIso(w.beginn), ende: berlinZuIso(w.ende),
      angebot_position_id: w.angebot_position_id ? Number(w.angebot_position_id) : null, trotzdem };
    return einsatz?.id ? api.put(`/api/v1/einsaetze/${einsatz.id}`, body) : api.post("/api/v1/einsaetze", body);
  };
  const speichern = async () => { const r = await f.absenden(() => k.speichere(f, sende)); if (r) onFertig(r); };
  return (
    <Modal titel={einsatz?.id ? "Einsatz bearbeiten" : "Personal einplanen"} onSchliessen={onSchliessen} fuss={<>
      <Knopf onClick={onSchliessen}>Abbrechen</Knopf>
      {k.konflikt ? <Knopf art="gefahr" icon="AlertTriangle" onClick={async () => { const r = await k.konflikt.nochmal(); if (r) onFertig(r); }}>Trotzdem eintragen</Knopf>
        : <Knopf art="primaer" icon="Check" onClick={speichern}>Speichern</Knopf>}</>}>
      {f.meldung && !k.konflikt && <Meldung {...f.meldung} />}
      {k.konflikt && <Meldung level="warning" text={`Konflikt: ${k.konflikt.texte.join(" ")}`} />}
      <Feld label="Person" pflicht fehler={f.fehler.personal_id}>
        <Auswahl value={f.werte.personal_id} leer="Person wählen" onChange={(e) => { k.setKonflikt(null); f.setze("personal_id")(e); }}
          optionen={(leute.daten?.zeilen || []).map((p) => ({ wert: String(p.id), titel: `${p.name}${p.qualifikationen.length ? ` (${p.qualifikationen.join(", ")})` : ""}` }))} />
      </Feld>
      {!projektId && <Feld label="Projekt" pflicht fehler={f.fehler.projekt_id}>
        <Auswahl value={f.werte.projekt_id} leer="Projekt wählen" onChange={f.setze("projekt_id")} optionen={(projekte.daten?.zeilen || []).map((p) => ({ wert: String(p.id), titel: `${p.nummer} ${p.name}` }))} />
      </Feld>}
      <div className="lp-zeile">
        <Feld label="Beginn" pflicht fehler={f.fehler.beginn}><Eingabe type="datetime-local" value={f.werte.beginn} onChange={(e) => { k.setKonflikt(null); f.setze("beginn")(e); }} /></Feld>
        <Feld label="Ende" pflicht fehler={f.fehler.ende}><Eingabe type="datetime-local" value={f.werte.ende} onChange={(e) => { k.setKonflikt(null); f.setze("ende")(e); }} /></Feld>
      </div>
      <Feld label="Rolle"><Eingabe value={f.werte.rolle} onChange={f.setze("rolle")} placeholder="z. B. Aufbau Licht" /></Feld>
      {positionen.length > 0 && <Feld label="Personalposition im Angebot" fehler={f.fehler.angebot_position_id}>
        <Auswahl value={f.werte.angebot_position_id} leer="– keine –" onChange={f.setze("angebot_position_id")} optionen={positionen.map((p) => ({ wert: String(p.id), titel: `${p.bezeichnung} (${p.besetzt}/${p.benoetigt} besetzt)` }))} />
      </Feld>}
      <Feld label="Notiz"><Eingabe value={f.werte.notiz} onChange={f.setze("notiz")} /></Feld>
    </Modal>
  );
}

/* ── Fahrt-Dialog mit Ladeliste ── */
export function FahrtDialog({ fahrt, projektId, onSchliessen, onFertig }) {
  const { api } = useLager();
  const fahrzeuge = useDaten(() => api.get("/api/v1/fahrzeuge"), []);
  const leute = useDaten(() => api.get("/api/v1/personal"), []);
  const projekte = useDaten(() => (projektId ? Promise.resolve({ zeilen: [] }) : api.get("/api/v1/projekte?limit=500&status=anfrage,angebot_gesendet,bestaetigt,laeuft")), [projektId]);
  const f = useFormular({ fahrzeug_id: fahrt?.fahrzeug_id ? String(fahrt.fahrzeug_id) : "", projekt_id: String(fahrt?.projekt_id || projektId || ""),
    abholung: isoZuBerlin(fahrt?.abholung) || `${heuteIso()}T07:00`, rueckkehr: isoZuBerlin(fahrt?.rueckkehr) || `${heuteIso()}T12:00`, ziel: fahrt?.ziel || "",
    fahrer_id: fahrt?.fahrer_id ? String(fahrt.fahrer_id) : "", notiz: fahrt?.notiz || "" });
  const k = useKonfliktSpeichern();
  const sende = (trotzdem) => {
    const w = f.werte;
    const body = { ...w, fahrzeug_id: Number(w.fahrzeug_id) || null, projekt_id: Number(w.projekt_id) || null, abholung: berlinZuIso(w.abholung), rueckkehr: berlinZuIso(w.rueckkehr),
      fahrer_id: w.fahrer_id ? Number(w.fahrer_id) : null, trotzdem };
    return fahrt?.id ? api.put(`/api/v1/fahrten/${fahrt.id}`, body) : api.post("/api/v1/fahrten", body);
  };
  const speichern = async () => { const r = await f.absenden(() => k.speichere(f, sende)); if (r) onFertig(r); };
  return (
    <Modal titel={fahrt?.id ? "Fahrt bearbeiten" : "Fahrt planen"} onSchliessen={onSchliessen} fuss={<>
      <Knopf onClick={onSchliessen}>Abbrechen</Knopf>
      {k.konflikt ? <Knopf art="gefahr" icon="AlertTriangle" onClick={async () => { const r = await k.konflikt.nochmal(); if (r) onFertig(r); }}>Trotzdem eintragen</Knopf>
        : <Knopf art="primaer" icon="Check" onClick={speichern}>Speichern</Knopf>}</>}>
      {f.meldung && !k.konflikt && <Meldung {...f.meldung} />}
      {k.konflikt && <Meldung level="warning" text={`Konflikt: ${k.konflikt.texte.join(" ")}`} />}
      <Feld label="Fahrzeug" pflicht fehler={f.fehler.fahrzeug_id}>
        <Auswahl value={f.werte.fahrzeug_id} leer="Fahrzeug wählen" onChange={(e) => { k.setKonflikt(null); f.setze("fahrzeug_id")(e); }}
          optionen={(fahrzeuge.daten?.zeilen || []).map((z) => ({ wert: String(z.id), titel: `${z.name}${z.kennzeichen ? ` (${z.kennzeichen})` : ""}${z.zuladung_kg ? ` · ${z.zuladung_kg} kg` : ""}` }))} />
      </Feld>
      {!projektId && <Feld label="Projekt" pflicht fehler={f.fehler.projekt_id}>
        <Auswahl value={f.werte.projekt_id} leer="Projekt wählen" onChange={f.setze("projekt_id")} optionen={(projekte.daten?.zeilen || []).map((p) => ({ wert: String(p.id), titel: `${p.nummer} ${p.name}` }))} />
      </Feld>}
      <div className="lp-zeile">
        <Feld label="Abholung" pflicht fehler={f.fehler.abholung}><Eingabe type="datetime-local" value={f.werte.abholung} onChange={(e) => { k.setKonflikt(null); f.setze("abholung")(e); }} /></Feld>
        <Feld label="Rückkehr" pflicht fehler={f.fehler.rueckkehr}><Eingabe type="datetime-local" value={f.werte.rueckkehr} onChange={(e) => { k.setKonflikt(null); f.setze("rueckkehr")(e); }} /></Feld>
      </div>
      <Feld label="Ziel" hinweis="Leer = Ort des Projekts"><Eingabe value={f.werte.ziel} onChange={f.setze("ziel")} /></Feld>
      <Feld label="Fahrer"><Auswahl value={f.werte.fahrer_id} leer="– offen –" onChange={f.setze("fahrer_id")} optionen={(leute.daten?.zeilen || []).map((p) => ({ wert: String(p.id), titel: p.name }))} /></Feld>
      <Feld label="Notiz"><Eingabe value={f.werte.notiz} onChange={f.setze("notiz")} /></Feld>
    </Modal>
  );
}

function LadelisteDialog({ id, onSchliessen, onGeaendert }) {
  const { api, nutzer } = useLager();
  const d = useDaten(() => api.get(`/api/v1/fahrten/${id}`), [id]);
  const [mengen, setMengen] = useState(null);
  const [meldung, setMeldung] = useState(null);
  const darf = darfPlanen(nutzer);
  const fa = d.daten;
  const zeilen = fa ? [...fa.ladung.map((l) => ({ artikel_id: l.artikel_id, artikel: l.artikel, einheit: l.einheit, menge: Number(l.menge) })),
    ...fa.offen.filter((o) => !fa.ladung.some((l) => l.artikel_id === o.artikel_id)).map((o) => ({ artikel_id: o.artikel_id, artikel: o.artikel, einheit: o.einheit, menge: 0 }))] : [];
  const wert = (z) => (mengen?.[z.artikel_id] ?? z.menge);
  const speichern = async (body) => {
    setMeldung(null);
    try { const r = await api.put(`/api/v1/fahrten/${id}/ladung`, body); setMeldung({ level: r.level, text: r.text }); setMengen(null); d.laden(); onGeaendert?.(); }
    catch (e) { setMeldung({ level: "error", text: fehlerText(e) }); }
  };
  return (
    <Modal titel={fa ? `Ladeliste ${fa.fahrzeug} · ${fa.projekt_nummer}` : "Ladeliste"} breite={720} onSchliessen={onSchliessen} fuss={fa && <>
      <Knopf icon="Printer" onClick={() => ladeHerunter(api, `/api/v1/fahrten/${id}/ladeliste.pdf?download=1`, `Ladeliste ${fa.projekt_nummer} ${fa.fahrzeug}.pdf`).catch((e) => setMeldung({ level: "error", text: fehlerText(e) }))}>Ladeliste (PDF)</Knopf>
      {darf && fa.offen.length > 0 && <Knopf icon="ClipboardList" onClick={() => speichern({ packliste: true })}>Rest der Packliste übernehmen</Knopf>}
      {darf && <Knopf art="primaer" icon="Save" onClick={() => speichern({ zeilen: zeilen.map((z) => ({ artikel_id: z.artikel_id, menge: wert(z) })) })}>Speichern</Knopf>}</>}>
      {d.fehler && <Meldung level="error" text={d.fehler} />}
      {meldung && <Meldung {...meldung} />}
      {fa && <>
        <p className="lp-meta" style={{ marginTop: 0 }}>{zeitraum(fa.abholung, fa.rueckkehr)} · Ziel {fa.ziel || "–"} · Fahrer {fa.fahrer || "offen"}</p>
        <p data-testid="ladung-gewicht"><strong>{String(fa.gewicht.kg).replace(".", ",")} kg</strong>{fa.zuladung_kg ? ` von ${fa.zuladung_kg} kg Zuladung` : ""}{fa.gewicht.ohneGewicht ? ` · ${fa.gewicht.ohneGewicht} Position(en) ohne Gewicht` : ""}</p>
        {fa.gewicht.warnung && <Meldung level="warning" text={fa.gewicht.warnung} />}
        <Tabelle zeilen={zeilen} schluessel="artikel_id" leer="Keine Packliste und keine Ladung." spalten={[
          { titel: "Artikel", feld: "artikel" },
          { titel: "Noch offen", rechts: true, wert: (z) => { const o = fa.offen.find((x) => x.artikel_id === z.artikel_id); return o ? `${o.offen} ${z.einheit}` : "–"; } },
          { titel: "Auf diesem Fahrzeug", rechts: true, wert: (z) => (darf
            ? <Eingabe type="number" min="0" step="1" style={{ width: 90 }} aria-label={`Menge ${z.artikel}`} value={wert(z)} onChange={(e) => setMengen((m) => ({ ...(m || {}), [z.artikel_id]: e.target.value }))} />
            : `${z.menge} ${z.einheit}`) },
        ]} />
      </>}
    </Modal>
  );
}

/* ── Projekt-Tab „Personal & Fahrzeuge“ ── */
export function ProjektRessourcen({ projektId }) {
  const { api, nutzer } = useLager();
  const d = useDaten(() => api.get(`/api/v1/projekte/${projektId}/ressourcen`), [projektId]);
  const [einsatz, setEinsatz] = useState(null);
  const [fahrt, setFahrt] = useState(null);
  const [ladung, setLadung] = useState(null);
  const [meldung, setMeldung] = useState(null);
  const [fragen, dialog] = useBestaetigung();
  useLive(["einsatz", "fahrt", "personal", "angebot"], (m) => { if (!m.projekt || m.projekt === projektId) d.laden(); });
  const darf = darfPlanen(nutzer);
  const fertig = (r) => { setEinsatz(null); setFahrt(null); setMeldung({ level: r.level || "success", text: r.text }); d.laden(); };
  const loeschen = async (pfad, text) => {
    if (!(await fragen({ titel: `${text} löschen?`, text: "Der Eintrag wird entfernt.", knopf: "Löschen" }))) return;
    try { const r = await api.del(pfad); setMeldung({ level: "success", text: r.text }); d.laden(); } catch (e) { setMeldung({ level: "error", text: fehlerText(e) }); }
  };
  const x = d.daten;
  return (
    <>
      {dialog}
      {meldung && <Meldung {...meldung} onSchliessen={() => setMeldung(null)} />}
      {d.fehler && <Meldung level="error" text={d.fehler} />}
      {x?.personalpositionen.length > 0 && <Section titel="Personalpositionen im Angebot" icon="Briefcase">
        <Tabelle zeilen={x.personalpositionen} spalten={[{ titel: "Position", feld: "bezeichnung" },
          { titel: "Stunden/Tag", rechts: true, wert: (p) => (p.stunden == null ? "–" : String(p.stunden).replace(".", ",")) },
          { titel: "Besetzt", rechts: true, wert: (p) => <Badge farbe={p.besetzt >= p.benoetigt ? "#1f6e32" : "#c07a12"} text="#fff">{p.besetzt} / {p.benoetigt}</Badge> }]} />
      </Section>}
      <Section titel="Personal" icon="UserCog" aktionen={darf && <Knopf icon="Plus" onClick={() => setEinsatz({})}>Personal einplanen</Knopf>}>
        <Tabelle zeilen={x?.einsaetze || []} leer="Noch niemand eingeplant." onZeile={darf ? (e) => setEinsatz(e) : undefined} spalten={[
          { titel: "Person", wert: (e) => <strong>{e.person}</strong> }, { titel: "Zeit", wert: (e) => zeitraum(e.beginn, e.ende) },
          { titel: "Rolle", wert: (e) => e.rolle || e.position || "–" }, { titel: "", wert: (e) => <Konflikt an={e.konflikt_bestaetigt} /> },
          ...(darf ? [{ titel: "", wert: (e) => <Knopf klein art="gefahr" icon="Trash2" aria-label={`Einsatz ${e.person} löschen`} onClick={(ev) => { ev.stopPropagation(); loeschen(`/api/v1/einsaetze/${e.id}`, "Einsatz"); }} /> }] : []),
        ]} />
      </Section>
      <Section titel="Fahrzeuge" icon="Truck" aktionen={darf && <Knopf icon="Plus" onClick={() => setFahrt({})}>Fahrt planen</Knopf>}>
        <Tabelle zeilen={x?.fahrten || []} leer="Noch keine Fahrt geplant." onZeile={(f) => setLadung(f.id)} spalten={[
          { titel: "Fahrzeug", wert: (f) => <strong>{f.fahrzeug}</strong> }, { titel: "Zeit", wert: (f) => zeitraum(f.abholung, f.rueckkehr) },
          { titel: "Ziel", feld: "ziel" }, { titel: "Fahrer", wert: (f) => f.fahrer || "offen" }, { titel: "", wert: (f) => <Konflikt an={f.konflikt_bestaetigt} /> },
          { titel: "", wert: (f) => <span className="lp-zeile" style={{ gap: 4 }}>
            <Knopf klein icon="ClipboardList" onClick={(ev) => { ev.stopPropagation(); setLadung(f.id); }}>Ladeliste</Knopf>
            {darf && <Knopf klein icon="Pencil" aria-label="Fahrt bearbeiten" onClick={(ev) => { ev.stopPropagation(); setFahrt(f); }} />}
            {darf && <Knopf klein art="gefahr" icon="Trash2" aria-label="Fahrt löschen" onClick={(ev) => { ev.stopPropagation(); loeschen(`/api/v1/fahrten/${f.id}`, "Fahrt"); }} />}</span> },
        ]} />
      </Section>
      {einsatz && <EinsatzDialog einsatz={einsatz.id ? einsatz : null} projektId={projektId} positionen={x?.personalpositionen || []} onSchliessen={() => setEinsatz(null)} onFertig={fertig} />}
      {fahrt && <FahrtDialog fahrt={fahrt.id ? fahrt : null} projektId={projektId} onSchliessen={() => setFahrt(null)} onFertig={fertig} />}
      {ladung && <LadelisteDialog id={ladung} onSchliessen={() => setLadung(null)} onGeaendert={() => d.laden()} />}
    </>
  );
}

/* ── Personal-Seiten ── */
const PERSON_LEER = { name: "", art: "mitarbeiter", qualifikationen: "", telefon: "", email: "", tagessatz: null, aktiv: true, notizen: "" };

function PersonDialog({ person, onSchliessen, onFertig }) {
  const { api } = useLager();
  const f = useFormular(person ? { ...PERSON_LEER, ...person, qualifikationen: (person.qualifikationen || []).join(", ") } : PERSON_LEER);
  const speichern = async () => { const r = await f.absenden((w) => (person?.id ? api.put(`/api/v1/personal/${person.id}`, w) : api.post("/api/v1/personal", w))); if (r) onFertig(r); };
  return (
    <Modal titel={person?.id ? `${person.name} bearbeiten` : "Person anlegen"} onSchliessen={onSchliessen} fuss={<><Knopf onClick={onSchliessen}>Abbrechen</Knopf><Knopf art="primaer" icon="Save" onClick={speichern}>Speichern</Knopf></>}>
      {f.meldung && <Meldung {...f.meldung} />}
      <Feld label="Name" pflicht fehler={f.fehler.name}><Eingabe value={f.werte.name} onChange={f.setze("name")} autoFocus /></Feld>
      <Feld label="Art"><Auswahl value={f.werte.art} onChange={f.setze("art")} optionen={Object.entries(PERSONAL_ARTEN).map(([wert, titel]) => ({ wert, titel }))} /></Feld>
      <Feld label="Qualifikationen" hinweis="Kommagetrennt, z. B. Licht, Rigging, Staplerschein"><Eingabe value={f.werte.qualifikationen} onChange={f.setze("qualifikationen")} /></Feld>
      <div className="lp-zeile">
        <Feld label="Telefon"><Eingabe value={f.werte.telefon} onChange={f.setze("telefon")} /></Feld>
        <Feld label="E-Mail" fehler={f.fehler.email}><Eingabe value={f.werte.email} onChange={f.setze("email")} /></Feld>
      </div>
      {f.werte.art === "freelancer" && <Feld label="Tagessatz" fehler={f.fehler.tagessatz}><GeldEingabe cent={f.werte.tagessatz} onCent={f.setze("tagessatz")} /></Feld>}
      <Feld label="Status"><Toggle checked={f.werte.aktiv} onChange={f.setze("aktiv")} label="aktiv" /></Feld>
      <Feld label="Notizen"><Textfeld value={f.werte.notizen} onChange={f.setze("notizen")} /></Feld>
    </Modal>
  );
}

export function PersonalSeite({ query }) {
  const { api, nutzer, navigiere } = useLager();
  const [tab, setTab] = useState(query?.tab || "liste");
  const [q, setQ] = useState("");
  const l = useDaten(() => api.get(`/api/v1/personal?alle=1${q ? `&q=${encodeURIComponent(q)}` : ""}`), [q]);
  const [von, setVon] = useState(heuteIso());
  const bis = plusTage(von, 13);
  const plan = useDaten(() => api.get(`/api/v1/einsatzplan?von=${von}&bis=${bis}`), [von]);
  const [neu, setNeu] = useState(false);
  const [einsatz, setEinsatz] = useState(false);
  const [meldung, setMeldung] = useState(null);
  useLive(["personal", "einsatz"], () => { l.laden(); plan.laden(); });
  const darf = darfPlanen(nutzer);
  const tage = Array.from({ length: 14 }, (_, i) => plusTage(von, i));
  const leute = l.daten?.zeilen || [];
  const amTag = (pid, tag) => (plan.daten?.zeilen || []).filter((e) => e.personal_id === pid && isoZuBerlin(e.beginn).slice(0, 10) <= tag && isoZuBerlin(new Date(new Date(e.ende).getTime() - 1).toISOString()).slice(0, 10) >= tag);
  return (
    <Seite titel="Personal" untertitel="Mitarbeiter und Freelancer mit Qualifikation, Verfügbarkeit und Einsätzen."
      aktionen={darf && <><Knopf icon="CalendarDays" onClick={() => setEinsatz(true)}>Einsatz planen</Knopf><Knopf art="primaer" icon="Plus" onClick={() => setNeu(true)}>Person anlegen</Knopf></>}>
      {meldung && <Meldung {...meldung} onSchliessen={() => setMeldung(null)} />}
      <Tabs tabs={[{ id: "liste", titel: "Personal" }, { id: "plan", titel: "Einsatzplan" }]} aktiv={tab} onWechsel={setTab} />
      {tab === "liste" && <Section titel="Personal" icon="UserCog" aktionen={<Eingabe placeholder="Suchen (Name, Qualifikation) …" aria-label="Personal suchen" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 240 }} />}>
        {l.fehler && <Meldung level="error" text={l.fehler} />}
        <Tabelle zeilen={leute} leer="Noch kein Personal angelegt." onZeile={(p) => navigiere(`/personal/${p.id}`)} spalten={[
          { titel: "Name", wert: (p) => <strong style={{ opacity: p.aktiv ? 1 : 0.5 }}>{p.name}</strong> }, { titel: "Art", wert: (p) => PERSONAL_ARTEN[p.art] },
          { titel: "Qualifikationen", wert: (p) => p.qualifikationen.join(", ") || "–" }, { titel: "Kommende Einsätze", rechts: true, feld: "kommende_einsaetze" },
        ]} />
      </Section>}
      {tab === "plan" && <Section titel={`Einsatzplan ${datumAnzeige(von)} – ${datumAnzeige(bis)}`} icon="CalendarDays" aktionen={<>
        <Knopf klein icon="ChevronLeft" aria-label="Zwei Wochen zurück" onClick={() => setVon(plusTage(von, -14))} />
        <Knopf klein onClick={() => setVon(heuteIso())}>Heute</Knopf>
        <Knopf klein icon="ChevronRight" aria-label="Zwei Wochen vor" onClick={() => setVon(plusTage(von, 14))} />
        <Knopf klein icon="Printer" onClick={() => ladeHerunter(api, `/api/v1/einsatzplan.pdf?von=${von}&bis=${bis}&download=1`, `Einsatzplan ${von}.pdf`).catch((e) => setMeldung({ level: "error", text: fehlerText(e) }))}>PDF</Knopf></>}>
        <div className="lp-tabelle-wrap"><table className="lp-tabelle" data-testid="einsatzplan">
          <thead><tr><th>Person</th>{tage.map((t) => <th key={t} style={{ textAlign: "center" }}>{datumAnzeige(t).slice(0, 6)}</th>)}</tr></thead>
          <tbody>{leute.filter((p) => p.aktiv).map((p) => <tr key={p.id}><td><strong>{p.name}</strong></td>{tage.map((t) => {
            const e = amTag(p.id, t);
            return <td key={t} title={e.map((x) => `${x.projekt_nummer} ${x.rolle}`).join("\n")} style={{ textAlign: "center", background: e.length > 1 ? "rgba(179,72,63,.25)" : e.length ? "rgba(47,111,176,.2)" : undefined }}>{e.map((x) => x.projekt_nummer.slice(-3)).join(" ")}</td>;
          })}</tr>)}</tbody>
        </table></div>
        <p className="lp-hinweis">Blau = eingeplant, rot = mehrere Einsätze am Tag (Konflikt prüfen).</p>
      </Section>}
      {neu && <PersonDialog onSchliessen={() => setNeu(false)} onFertig={(r) => { setNeu(false); setMeldung({ level: "success", text: r.text }); l.laden(); }} />}
      {einsatz && <EinsatzDialog onSchliessen={() => setEinsatz(false)} onFertig={(r) => { setEinsatz(false); setMeldung({ level: r.level, text: r.text }); plan.laden(); l.laden(); }} />}
    </Seite>
  );
}

export function PersonDetail({ params }) {
  const { api, nutzer, navigiere } = useLager();
  const id = Number(params.id);
  const d = useDaten(() => api.get(`/api/v1/personal/${id}`), [id]);
  const [bearbeiten, setBearbeiten] = useState(false);
  const [ab, setAb] = useState({ von: heuteIso(), bis: heuteIso(), grund: "" });
  const [meldung, setMeldung] = useState(null);
  useLive(["personal", "einsatz"], () => d.laden());
  const darf = darfPlanen(nutzer);
  if (d.fehler) return <Seite titel="Person"><Meldung level="error" text={d.fehler} /></Seite>;
  const p = d.daten;
  if (!p) return <Seite titel="Person"><p className="lp-hinweis">Lädt …</p></Seite>;
  const aktion = async (fn) => { setMeldung(null); try { const r = await fn(); setMeldung({ level: r.level || "success", text: r.text }); d.laden(); } catch (e) { setMeldung({ level: "error", text: fehlerText(e) }); } };
  return (
    <Seite titel={p.name} untertitel={`${PERSONAL_ARTEN[p.art]}${p.qualifikationen.length ? ` · ${p.qualifikationen.join(", ")}` : ""}${p.aktiv ? "" : " · inaktiv"}`}
      aktionen={<>
        <Knopf icon="ArrowLeft" onClick={() => navigiere("/personal")}>Alle</Knopf>
        <Knopf icon="CalendarDays" onClick={() => ladeHerunter(api, `/api/v1/personal/${id}/einsatzplan.ics`, `Einsaetze ${p.name}.ics`).catch((e) => setMeldung({ level: "error", text: fehlerText(e) }))}>Kalender (.ics)</Knopf>
        {darf && <Knopf icon="Pencil" onClick={() => setBearbeiten(true)}>Bearbeiten</Knopf>}
      </>}>
      {meldung && <Meldung {...meldung} onSchliessen={() => setMeldung(null)} />}
      <div className="lp-raster">
        <div><div className="lp-label">Telefon</div>{p.telefon || "–"}</div>
        <div><div className="lp-label">E-Mail</div>{p.email || "–"}</div>
        {p.art === "freelancer" && <div><div className="lp-label">Tagessatz</div>{p.tagessatz == null ? "–" : euro(p.tagessatz)}</div>}
      </div>
      <Section titel="Einsätze" icon="CalendarDays">
        <Tabelle zeilen={p.einsaetze} leer="Keine Einsätze." onZeile={(e) => navigiere(`/projekte/${e.projekt_id}?tab=ressourcen`)} spalten={[
          { titel: "Zeit", wert: (e) => zeitraum(e.beginn, e.ende) }, { titel: "Projekt", wert: (e) => `${e.projekt_nummer} ${e.projekt_name}` },
          { titel: "Rolle", wert: (e) => e.rolle || e.position || "–" }, { titel: "", wert: (e) => <Konflikt an={e.konflikt_bestaetigt} /> }]} />
        {p.fahrten.length > 0 && <p className="lp-meta">Außerdem als Fahrer: {p.fahrten.map((f) => `${f.fahrzeug} ${zeitpunktAnzeige(f.abholung)} (${f.projekt_nummer})`).join(" · ")}</p>}
      </Section>
      <Section titel="Nicht verfügbar" icon="XCircle">
        <Tabelle zeilen={p.abwesenheiten} leer="Keine Abwesenheiten eingetragen." spalten={[
          { titel: "Von", wert: (a) => datumAnzeige(a.von) }, { titel: "Bis", wert: (a) => datumAnzeige(a.bis) }, { titel: "Grund", wert: (a) => a.grund || "–" },
          ...(darf ? [{ titel: "", wert: (a) => <Knopf klein art="gefahr" icon="Trash2" aria-label="Abwesenheit löschen" onClick={() => aktion(() => api.del(`/api/v1/abwesenheiten/${a.id}`))} /> }] : [])]} />
        {darf && <div className="lp-zeile" style={{ marginTop: 8, alignItems: "flex-end" }}>
          <Feld label="Von"><Eingabe type="date" value={ab.von} onChange={(e) => setAb({ ...ab, von: e.target.value, bis: ab.bis < e.target.value ? e.target.value : ab.bis })} /></Feld>
          <Feld label="Bis"><Eingabe type="date" value={ab.bis} onChange={(e) => setAb({ ...ab, bis: e.target.value })} /></Feld>
          <Feld label="Grund"><Eingabe value={ab.grund} onChange={(e) => setAb({ ...ab, grund: e.target.value })} placeholder="z. B. Urlaub" /></Feld>
          <Knopf icon="Plus" onClick={() => aktion(() => api.post(`/api/v1/personal/${id}/abwesenheiten`, ab))}>Eintragen</Knopf>
        </div>}
      </Section>
      {bearbeiten && <PersonDialog person={p} onSchliessen={() => setBearbeiten(false)} onFertig={(r) => { setBearbeiten(false); setMeldung({ level: "success", text: r.text }); d.laden(); }} />}
    </Seite>
  );
}

/* ── Fahrzeug-Seiten ── */
const FZ_LEER = { name: "", kennzeichen: "", zuladung_kg: "", ladevolumen_m3: "", aktiv: true, notizen: "" };
function FahrzeugDialog({ fahrzeug, onSchliessen, onFertig }) {
  const { api } = useLager();
  const f = useFormular(fahrzeug ? { ...FZ_LEER, ...fahrzeug, zuladung_kg: fahrzeug.zuladung_kg ?? "", ladevolumen_m3: fahrzeug.ladevolumen_m3 ?? "" } : FZ_LEER);
  const speichern = async () => {
    const r = await f.absenden((w) => { const b = { ...w, zuladung_kg: w.zuladung_kg === "" ? null : Number(w.zuladung_kg) }; return fahrzeug?.id ? api.put(`/api/v1/fahrzeuge/${fahrzeug.id}`, b) : api.post("/api/v1/fahrzeuge", b); });
    if (r) onFertig(r);
  };
  return (
    <Modal titel={fahrzeug?.id ? `${fahrzeug.name} bearbeiten` : "Fahrzeug anlegen"} onSchliessen={onSchliessen} fuss={<><Knopf onClick={onSchliessen}>Abbrechen</Knopf><Knopf art="primaer" icon="Save" onClick={speichern}>Speichern</Knopf></>}>
      {f.meldung && <Meldung {...f.meldung} />}
      <Feld label="Name" pflicht fehler={f.fehler.name}><Eingabe value={f.werte.name} onChange={f.setze("name")} autoFocus /></Feld>
      <Feld label="Kennzeichen"><Eingabe value={f.werte.kennzeichen} onChange={f.setze("kennzeichen")} /></Feld>
      <div className="lp-zeile">
        <Feld label="Zuladung (kg)" fehler={f.fehler.zuladung_kg}><Eingabe type="number" min="1" value={f.werte.zuladung_kg} onChange={f.setze("zuladung_kg")} /></Feld>
        <Feld label="Ladevolumen (m³)" fehler={f.fehler.ladevolumen_m3}><Eingabe inputMode="decimal" value={f.werte.ladevolumen_m3} onChange={f.setze("ladevolumen_m3")} /></Feld>
      </div>
      <Feld label="Status"><Toggle checked={f.werte.aktiv} onChange={f.setze("aktiv")} label="in Betrieb" /></Feld>
      <Feld label="Notizen"><Textfeld value={f.werte.notizen} onChange={f.setze("notizen")} /></Feld>
    </Modal>
  );
}

export function FahrzeugeSeite() {
  const { api, nutzer } = useLager();
  const l = useDaten(() => api.get("/api/v1/fahrzeuge?alle=1"), []);
  const [form, setForm] = useState(null);
  const [offen, setOffen] = useState(null);
  const [fahrt, setFahrt] = useState(false);
  const [meldung, setMeldung] = useState(null);
  useLive(["fahrzeug", "fahrt"], () => l.laden());
  const darf = darfPlanen(nutzer);
  return (
    <Seite titel="Fahrzeuge" untertitel="Transporter und LKW mit Zuladung, Fahrten je Projekt und Ladeliste."
      aktionen={darf && <><Knopf icon="Truck" onClick={() => setFahrt(true)}>Fahrt planen</Knopf><Knopf art="primaer" icon="Plus" onClick={() => setForm({})}>Fahrzeug anlegen</Knopf></>}>
      {meldung && <Meldung {...meldung} onSchliessen={() => setMeldung(null)} />}
      {l.fehler && <Meldung level="error" text={l.fehler} />}
      <Section titel="Fahrzeuge" icon="Truck">
        <Tabelle zeilen={l.daten?.zeilen || []} leer="Noch kein Fahrzeug angelegt." onZeile={(z) => setOffen(z.id)} spalten={[
          { titel: "Name", wert: (z) => <strong style={{ opacity: z.aktiv ? 1 : 0.5 }}>{z.name}</strong> }, { titel: "Kennzeichen", wert: (z) => z.kennzeichen || "–" },
          { titel: "Zuladung", rechts: true, wert: (z) => (z.zuladung_kg ? `${z.zuladung_kg} kg` : "–") },
          { titel: "Kommende Fahrten", rechts: true, feld: "kommende_fahrten" },
          ...(darf ? [{ titel: "", wert: (z) => <Knopf klein icon="Pencil" aria-label={`${z.name} bearbeiten`} onClick={(e) => { e.stopPropagation(); setForm(z); }} /> }] : []),
        ]} />
      </Section>
      {offen && <FahrzeugFahrten id={offen} onSchliessen={() => setOffen(null)} />}
      {form && <FahrzeugDialog fahrzeug={form.id ? form : null} onSchliessen={() => setForm(null)} onFertig={(r) => { setForm(null); setMeldung({ level: "success", text: r.text }); l.laden(); }} />}
      {fahrt && <FahrtDialog onSchliessen={() => setFahrt(false)} onFertig={(r) => { setFahrt(false); setMeldung({ level: r.level, text: r.text }); l.laden(); }} />}
    </Seite>
  );
}

function FahrzeugFahrten({ id, onSchliessen }) {
  const { api } = useLager();
  const d = useDaten(() => api.get(`/api/v1/fahrzeuge/${id}`), [id]);
  const [ladung, setLadung] = useState(null);
  return (
    <Modal titel={d.daten ? `Fahrten ${d.daten.name}` : "Fahrten"} breite={720} onSchliessen={onSchliessen}>
      {d.fehler && <Meldung level="error" text={d.fehler} />}
      <Tabelle zeilen={d.daten?.fahrten || []} leer="Keine Fahrten in den letzten 90 Tagen oder geplant." onZeile={(f) => setLadung(f.id)} spalten={[
        { titel: "Zeit", wert: (f) => zeitraum(f.abholung, f.rueckkehr) }, { titel: "Projekt", wert: (f) => `${f.projekt_nummer} ${f.projekt_name}` },
        { titel: "Ziel", feld: "ziel" }, { titel: "Fahrer", wert: (f) => f.fahrer || "offen" }, { titel: "", wert: (f) => <Konflikt an={f.konflikt_bestaetigt} /> }]} />
      {ladung && <LadelisteDialog id={ladung} onSchliessen={() => setLadung(null)} />}
    </Modal>
  );
}
