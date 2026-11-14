import React from "react";
import { AppHuelle } from "@lager/ui/huelle.jsx";
import { SEITEN, beiCode } from "./seiten.jsx";

export default function App() {
  return <AppHuelle app="p" seiten={SEITEN} onCode={beiCode} />;
}
