// app/page.js
"use client";

import { useRef, useState, useMemo } from "react";
import { analyzeAudioFromFile } from "../lib/analyzeAudio";
import { generateHardMap } from "../lib/generateHardMap";
import { exportZip } from "../lib/exportZip";

const MAP_TYPES = [
  { value: "tech", label: "Tech (streamy / competitive)" },
  { value: "dancey", label: "Dancey (flow / body movement)" },
  { value: "showpiece", label: "Showpiece (cinematic flair)" },
];

const LIGHT_TYPES = [
  { value: "concert", label: "Concert (stage flash)" },
  { value: "cyberpunk", label: "Cyberpunk (neon pulses + rings)" },
];

export default function Page() {
  const fileRef = useRef(null);
  const [status, setStatus] = useState("Drop a song and hit Generate");
  const [bpm, setBpm] = useState(null);

  // UI controls
  const [mapType, setMapType] = useState("dancey");
  const [lightType, setLightType] = useState("cyberpunk");
  const [primaryColor, setPrimaryColor] = useState("#ff2aa0");   // hot pink vibe
  const [secondaryColor, setSecondaryColor] = useState("#6a5cff"); // violet/blue
  const [isWorking, setIsWorking] = useState(false);

  // simple seedable rng (so Auto Pick can feel stable per-file name)
  const rng = useMemo(() => {
    return (seedStr = "secret-vice") => {
      let h = 2166136261 >>> 0;
      for (let i = 0; i < seedStr.length; i++) {
        h ^= seedStr.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return () => {
        let t = (h += 0x6D2B79F5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    };
  }, []);

  function autoPickFrom(arr, rnd) {
    return arr[Math.floor(rnd() * arr.length)];
  }

  async function onAutoPick(e) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    const seed = file ? file.name : `${Date.now()}`;
    const rnd = rng(seed);

    // randomize map & lights
    const newMap = autoPickFrom(MAP_TYPES.map(m => m.value), rnd);
    const newLight = autoPickFrom(LIGHT_TYPES.map(l => l.value), rnd);

    // randomize colors in HSV-ish space then convert to hex quickly
    const randHex = () =>
      "#" + Math.floor(rnd() * 0xffffff).toString(16).padStart(6, "0");

    setMapType(newMap);
    setLightType(newLight);
    setPrimaryColor(randHex());
    setSecondaryColor(randHex());

    setStatus(`Auto-picked → Map: ${newMap}, Lights: ${newLight}`);
  }

  async function onGenerate(e) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setStatus("Pick an audio file first.");
      return;
    }

    setIsWorking(true);
    try {
      setStatus("Analyzing…");
      const analysis = await analyzeAudioFromFile(file);
      setBpm(analysis.tempo);

      setStatus(`Generating Hard (BPM ${analysis.tempo})…`);
      const { bpm, map } = generateHardMap(analysis, {
        preset: mapType,         // "tech" | "dancey" | "showpiece"
        lights: lightType,       // "concert" | "cyberpunk"
        colors: {                // passed through for future lighting palettes
          primary: primaryColor,
          secondary: secondaryColor,
        },
      });

      setStatus("Packaging zip…");
      await exportZip(file, bpm, map, analysis.meta.title);

      setStatus("Done! Try another track.");
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${err?.message || "something went wrong"}`);
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="w-full max-w-xl p-6 rounded-2xl bg-zinc-900 shadow-xl">
        <h1 className="text-2xl font-bold mb-2">Secret Vice Automapper</h1>
        <p className="text-sm opacity-80 mb-4">
          Upload audio → analyze in-browser → auto-map (Hard) → download a Beat Saber zip.
        </p>

        <form className="space-y-4" onSubmit={onGenerate}>
          {/* File input */}
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-fuchsia-600 file:text-white file:px-4 file:py-2"
          />

          {/* Controls row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Map type */}
            <label className="text-sm">
              <span className="block mb-1 opacity-80">Map type</span>
              <select
                value={mapType}
                onChange={(e) => setMapType(e.target.value)}
                className="w-full bg-zinc-800 rounded-lg px-3 py-2 outline-none"
              >
                {MAP_TYPES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </label>

            {/* Lighting */}
            <label className="text-sm">
              <span className="block mb-1 opacity-80">Lighting</span>
              <select
                value={lightType}
                onChange={(e) => setLightType(e.target.value)}
                className="w-full bg-zinc-800 rounded-lg px-3 py-2 outline-none"
              >
                {LIGHT_TYPES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </label>

            {/* Primary colour */}
            <label className="text-sm">
              <span className="block mb-1 opacity-80">Primary colour</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-10 h-10 p-0 bg-transparent border-0"
                  title="Pick primary color"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="flex-1 bg-zinc-800 rounded-lg px-3 py-2 outline-none"
                  placeholder="#ff00aa"
                />
              </div>
            </label>

            {/* Secondary colour */}
            <label className="text-sm">
              <span className="block mb-1 opacity-80">Secondary colour</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-10 h-10 p-0 bg-transparent border-0"
                  title="Pick secondary color"
                />
                <input
                  type="text"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="flex-1 bg-zinc-800 rounded-lg px-3 py-2 outline-none"
                  placeholder="#6a5cff"
                />
              </div>
            </label>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onAutoPick}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition"
              disabled={isWorking}
            >
              Auto Pick Everything
            </button>

            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 transition disabled:opacity-60"
              disabled={isWorking}
            >
              {isWorking ? "Working…" : "Generate Hard"}
            </button>
          </div>
        </form>

        <div className="mt-4 text-sm opacity-80">
          {status}{bpm ? ` • BPM ${bpm}` : ""}
        </div>

        <div className="mt-3 text-xs opacity-60">
          For best compatibility, prefer <b>.ogg</b>. By uploading, you confirm you have rights to the track.
        </div>
      </div>
    </main>
  );
}
