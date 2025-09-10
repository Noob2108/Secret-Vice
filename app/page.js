// app/page.js
"use client";

import { useRef, useState } from "react";
import { analyzeAudioFromFile } from "../lib/analyzeAudio";
import { generateHardMap } from "../lib/generateHardMap";
import { exportZip } from "../lib/exportZip";

export default function Page() {
  const fileRef = useRef(null);
  const [status, setStatus] = useState("Drop a song and hit Generate");
  const [bpm, setBpm] = useState(null);

  async function onGenerate(e) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) { setStatus("Pick an audio file first."); return; }

    setStatus("Analyzing…");
    const analysis = await analyzeAudioFromFile(file);
    setBpm(analysis.tempo);

    setStatus(`Generating Hard (BPM ${analysis.tempo})…`);
    const { bpm, map } = generateHardMap(analysis, "tech");

    setStatus("Packaging zip…");
    await exportZip(file, bpm, map, analysis.meta.title);

    setStatus("Done! Try another track.");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="w-full max-w-xl p-6 rounded-2xl bg-zinc-900 shadow-xl">
        <h1 className="text-2xl font-bold mb-2">Secret Vice Automapper</h1>
        <p className="text-sm opacity-80 mb-4">
          Upload audio → analyze in browser → auto-map (Hard) → download Beat Saber zip.
        </p>

        <form onSubmit={onGenerate} className="space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-fuchsia-600 file:text-white file:px-4 file:py-2"
          />

          <button
            className="px-5 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 transition"
            type="submit"
          >
            Generate Hard
          </button>
        </form>

        <div className="mt-4 text-sm opacity-80">
          {status}{bpm ? ` • BPM ${bpm}` : ""}
        </div>

        <div className="mt-3 text-xs opacity-60">
          Heads up: for best compatibility, prefer <b>.ogg</b> audio. You confirm you have rights to upload the track.
        </div>
      </div>
    </main>
  );
}
