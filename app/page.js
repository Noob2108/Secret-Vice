"use client";

import { useState } from "react";
import Controls from "./components/Controls";
import { analyzeAudioFromFile } from "../lib/analyzeAudio";
import { generateHardMap } from "../lib/generateHardMap";
import { exportZip } from "../lib/exportZip";

export default function Page() {
  const [status, setStatus] = useState("Drop a song and hit Generate");
  const [bpm, setBpm] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onGenerate(file, opts) {
    try {
      setBusy(true);
      setStatus("Analyzing…");
      const analysis = await analyzeAudioFromFile(file);
      setBpm(analysis?.tempo || 120);

      setStatus("Generating (Hard)…");
      const { bpm, map } = generateHardMap(analysis, opts);

      setStatus("Packaging zip…");
      await exportZip(file, bpm, map, analysis?.meta?.title);

      setStatus("Done! Try another track.");
    } catch (e) {
      console.error(e);
      setStatus("Error. See console.");
      alert("Generation failed — check console for details.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container">
      <div className="console">
        <Controls onGenerate={onGenerate} busy={busy} />
        <p className="status">
          {status}{bpm ? ` • BPM ${Math.round(bpm)}` : ""}
        </p>
      </div>
    </main>
  );
}
