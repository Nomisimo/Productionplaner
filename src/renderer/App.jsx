import React, { useEffect, useState } from "react";
import cfg from "../app.json";

// Gerüst (Phase 0): Kopfleiste + Serverstatus. Die echte Hülle kommt aus @lager/ui (Phase 1).
export default function App() {
  const [info, setInfo] = useState(null);
  const [server, setServer] = useState("prüfe …");
  useEffect(() => {
    window.lagerShell?.info().then(async (i) => {
      setInfo(i);
      try {
        const r = await fetch(i.serverUrl + "/health");
        const j = await r.json();
        setServer(j.ok ? `verbunden (Protokoll ${j.protokoll})` : "Server meldet Fehler");
      } catch {
        setServer("nicht erreichbar");
      }
      window.lagerShell.bereit();
    });
  }, []);
  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#15191e", color: "#e8eaed", minHeight: "100vh" }}>
      <header style={{ background: "#1c2127", borderBottom: "2px solid #b3483f", padding: "10px 16px", display: "flex", gap: 12, alignItems: "baseline" }}>
        <b style={{ color: "#b3483f", fontSize: 18 }}>{cfg.titel}</b>
        <span style={{ color: "#9aa4af", fontSize: 12 }}>Version {info?.version || "…"}</span>
        <span style={{ marginLeft: "auto", fontSize: 12 }} data-testid="server-status">Server: {server}</span>
      </header>
    </div>
  );
}
