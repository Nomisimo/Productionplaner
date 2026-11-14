// FA-28 Ansprechpartner je Kunde und Kundenhistorie (Kommunikation, Notizen mit Zeit/Person).
import React, { useState } from "react";
import { Section, Knopf, Tabelle, Eingabe, Auswahl, Textfeld, Feld, Meldung, Modal, Toggle, Badge, useFormular, useBestaetigung } from "@lager/ui/bausteine.jsx";
import { useLager } from "@lager/ui/huelle.jsx";
import { fehlerText } from "@lager/ui/texte.js";
import { zeitpunktAnzeige } from "@lager/domain/zeit.js";

const ARTEN = { notiz: "Notiz", telefon: "Telefonat", email: "E-Mail", treffen: "Treffen" };

function KontaktDialog({ kundeId, kontakt, onFertig, onSchliessen }) {
  const { api } = useLager();
  const f = useFormular({ name: kontakt?.name || "", funktion: kontakt?.funktion || "", telefon: kontakt?.telefon || "", email: kontakt?.email || "", notiz: kontakt?.notiz || "", haupt: kontakt?.haupt || false });
  const speichern = async () => {
    const r = await f.absenden((w) => (kontakt ? api.put(`/api/v1/kontakte/${kontakt.id}`, w) : api.post(`/api/v1/kunden/${kundeId}/kontakte`, w)));
    if (r) onFertig(r);
  };
  return (
    <Modal titel={kontakt ? `${kontakt.name} bearbeiten` : "Ansprechpartner hinzufügen"} onSchliessen={onSchliessen}
      fuss={<><Knopf onClick={onSchliessen}>Abbrechen</Knopf><Knopf art="primaer" icon="Save" onClick={speichern}>Speichern</Knopf></>}>
      {f.meldung && <Meldung {...f.meldung} />}
      <Feld label="Name" pflicht fehler={f.fehler.name}><Eingabe value={f.werte.name} onChange={f.setze("name")} autoFocus /></Feld>
      <Feld label="Funktion" hinweis="z. B. Technische Leitung, Einkauf"><Eingabe value={f.werte.funktion} onChange={f.setze("funktion")} /></Feld>
      <div className="lp-raster">
        <Feld label="Telefon"><Eingabe value={f.werte.telefon} onChange={f.setze("telefon")} /></Feld>
        <Feld label="E-Mail" fehler={f.fehler.email}><Eingabe type="email" value={f.werte.email} onChange={f.setze("email")} /></Feld>
      </div>
      <Feld label="Notiz"><Eingabe value={f.werte.notiz} onChange={f.setze("notiz")} /></Feld>
      <Feld label="Hauptkontakt"><Toggle checked={f.werte.haupt} onChange={f.setze("haupt")} label="erster Ansprechpartner" /></Feld>
    </Modal>
  );
}

export function KundeKontakte({ k, darf, onGeaendert }) {
  const { api } = useLager();
  const [form, setForm] = useState(null);
  const [meldung, setMeldung] = useState(null);
  const [fragen, dialog] = useBestaetigung();
  const fertig = (r) => { setForm(null); setMeldung({ level: "success", text: r.text }); onGeaendert(); };
  const anonym = !!k.anonymisiert;
  return (
    <Section titel={`Ansprechpartner (${k.kontakte.length})`} icon="Users" aktionen={darf && !anonym && <Knopf icon="Plus" onClick={() => setForm({})}>Ansprechpartner</Knopf>}>
      {dialog}
      {meldung && <Meldung {...meldung} onSchliessen={() => setMeldung(null)} />}
      <Tabelle zeilen={k.kontakte} leer="Noch keine Ansprechpartner. Der Kunde selbst steht oben unter Kontakt." onZeile={darf && !anonym ? (x) => setForm(x) : undefined} spalten={[
        { titel: "Name", wert: (x) => <div><strong>{x.name}</strong> {x.haupt && <Badge farbe="#2f6fb0" text="#fff">Hauptkontakt</Badge>}<div className="lp-meta">{x.funktion}</div></div> },
        { titel: "Telefon", wert: (x) => (x.telefon ? <a href={`tel:${x.telefon.replace(/\s/g, "")}`} onClick={(e) => e.stopPropagation()}>{x.telefon}</a> : "–") },
        { titel: "E-Mail", wert: (x) => (x.email ? <a href={`mailto:${x.email}`} onClick={(e) => e.stopPropagation()}>{x.email}</a> : "–") },
        { titel: "Notiz", wert: (x) => x.notiz || "" },
        ...(darf ? [{ titel: "", wert: (x) => <Knopf klein art="gefahr" icon="Trash2" aria-label={`${x.name} entfernen`} onClick={async (e) => {
          e.stopPropagation();
          if (!(await fragen({ titel: `${x.name} entfernen?`, text: "Der Ansprechpartner wird gelöscht. Einträge in der Historie bleiben.", knopf: "Entfernen" }))) return;
          try { fertig(await api.del(`/api/v1/kontakte/${x.id}`)); } catch (er) { setMeldung({ level: "error", text: fehlerText(er) }); }
        }} /> }] : []),
      ]} />
      {form && <KontaktDialog kundeId={k.id} kontakt={form.id ? form : null} onSchliessen={() => setForm(null)} onFertig={fertig} />}
    </Section>
  );
}

export function KundeHistorie({ k, darf, onGeaendert }) {
  const { api, nutzer } = useLager();
  const [neu, setNeu] = useState({ art: "notiz", text: "", kontakt_id: "" });
  const [meldung, setMeldung] = useState(null);
  const eintragen = async () => {
    setMeldung(null);
    try {
      const r = await api.post(`/api/v1/kunden/${k.id}/historie`, { ...neu, kontakt_id: neu.kontakt_id ? Number(neu.kontakt_id) : null });
      setNeu({ art: "notiz", text: "", kontakt_id: "" }); setMeldung({ level: "success", text: r.text }); onGeaendert();
    } catch (e) { setMeldung({ level: "error", text: fehlerText(e) }); }
  };
  const loeschen = async (h) => {
    try { const r = await api.del(`/api/v1/historie/${h.id}`); setMeldung({ level: "success", text: r.text }); onGeaendert(); }
    catch (e) { setMeldung({ level: "error", text: fehlerText(e) }); }
  };
  return (
    <Section titel="Historie" icon="History">
      {meldung && <Meldung {...meldung} onSchliessen={() => setMeldung(null)} />}
      {darf && !k.anonymisiert && <div className="lp-zeile" style={{ alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ width: 150 }}><Feld label="Art"><Auswahl value={neu.art} onChange={(e) => setNeu({ ...neu, art: e.target.value })} optionen={Object.entries(ARTEN).map(([wert, titel]) => ({ wert, titel }))} /></Feld></div>
        {k.kontakte.length > 0 && <div style={{ width: 200 }}><Feld label="Mit"><Auswahl value={neu.kontakt_id} leer="–" onChange={(e) => setNeu({ ...neu, kontakt_id: e.target.value })} optionen={k.kontakte.map((x) => ({ wert: String(x.id), titel: x.name }))} /></Feld></div>}
        <div style={{ flex: 1, minWidth: 240 }}><Feld label="Eintrag"><Textfeld rows={2} value={neu.text} onChange={(e) => setNeu({ ...neu, text: e.target.value })} placeholder="Worum ging es?" /></Feld></div>
        <Knopf art="primaer" icon="Plus" disabled={!neu.text.trim()} onClick={eintragen}>Eintragen</Knopf>
      </div>}
      <Tabelle zeilen={k.historie} leer="Noch keine Einträge." spalten={[
        { titel: "Wann", wert: (h) => <div>{zeitpunktAnzeige(h.zeit)}<div className="lp-meta">{h.von}</div></div> },
        { titel: "Art", wert: (h) => `${ARTEN[h.art]}${h.kontakt ? ` mit ${h.kontakt}` : ""}` },
        { titel: "Eintrag", wert: (h) => <span style={{ whiteSpace: "pre-wrap" }}>{h.text}</span> },
        { titel: "", wert: (h) => ((nutzer.admin || h.von_id === nutzer.id) ? <Knopf klein art="gefahr" icon="Trash2" aria-label="Eintrag löschen" onClick={() => loeschen(h)} /> : null) },
      ]} />
    </Section>
  );
}
