// app/page.js
"use client";

import { useRef, useState, useMemo } from "react";
import { analyzeAudioFromFile } from "../lib/analyzeAudio";
import { generateHardMap } from "../lib/generateHardMap";
import { exportZip } from "../lib/exportZip";

const MAP_TYPES = [
  { value: "tech", label: "Tech — streamy" },
  { value: "dancey", label: "Dancey — flow" },
  { value: "showpiece", label: "Showpiece — cinematic" },
];

const LIGHT_TYPES = [
  { value: "concert", label: "Concert — stage" },
  { value: "cyberpunk", label: "Cyberpunk — neon" },
];

export default function Page() {
  const fileRef = useRef(null);
  const [status, setStatus] = useState("Drop a track, pick options, hit Generate.");
  const [bpm, setBpm] = useState(null);
  const [isWorking, setIsWorking] = useState(false);

  // BRAND: SV neon
  const brandPink = "#ff2aa0";
  const brandCyan = "#00c9ff";

  // Controls
  const [mapType, setMapType] = useState("dancey");
  const [lightType, setLightType] = useState("cyberpunk");
  const [primaryColor, setPrimaryColor] = useState(brandPink);
  const [secondaryColor, setSecondaryColor] = useState(brandCyan);
  const [leadInBeats, setLeadInBeats] = useState(4); // NEW

  const rng = useMemo(() => {
    return (seedStr = "secret-vice") => {
      let h = 2166136261 >>> 0;
      for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
      return () => {
        let t = (h += 0x6D2B79F5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    };
  }, []);
  const randHex = (rnd) => "#" + Math.floor(rnd() * 0xffffff).toString(16).padStart(6, "0");
  const autoPickFrom = (arr, rnd) => arr[Math.floor(rnd()*arr.length)];

  async function onAutoPick(e) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    const seed = file ? file.name : `${Date.now()}`;
    const rnd = rng(seed);
    setMapType(autoPickFrom(MAP_TYPES.map(x=>x.value), rnd));
    setLightType(autoPickFrom(LIGHT_TYPES.map(x=>x.value), rnd));
    setPrimaryColor(randHex(rnd));
    setSecondaryColor(randHex(rnd));
    setLeadInBeats(4 + Math.floor(rnd()*4)); // 4–7 beats
    setStatus("Auto-picked style, lights, colours, lead-in.");
  }

  async function onGenerate(e) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) { setStatus("Pick an audio file first."); return; }

    setIsWorking(true);
    try {
      setStatus("Analyzing…");
      const analysis = await analyzeAudioFromFile(file);
      setBpm(analysis.tempo);

      setStatus(`Generating Hard (BPM ${analysis.tempo})…`);
      const { bpm, map } = generateHardMap(analysis, {
        preset: mapType,
        lights: lightType,
        colors: { primary: primaryColor, secondary: secondaryColor },
        startOffsetBeats: Number(leadInBeats) || 0,  // NEW: pass lead-in
      });

      setStatus("Packaging zip…");
      await exportZip(file, bpm, map, analysis.meta?.title);

      setStatus("Done! Try another track.");
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${err?.message || "something went wrong"}`);
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div
        className="w-full max-w-4xl rounded-3xl p-6 shadow-2xl"
        style={{
          background:
            "radial-gradient(1200px 400px at -10% -10%, rgba(255,42,160,0.15), transparent 60%)," +
            "radial-gradient(1200px 400px at 110% 110%, rgba(0,201,255,0.15), transparent 60%)," +
            "linear-gradient(180deg, rgba(20,20,24,0.9), rgba(12,12,16,0.9))"
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-4 mb-5">
          {/* Place your logo file at /public/sv-logo.png */}
          <img src="/sv-logo.png" alt="Secret Vice" className="w-14 h-14 rounded" />
          <div>
            <h1 className="text-3xl font-extrabold tracking-wide" style={{letterSpacing: '0.02em'}}>
              <span style={{color: brandPink}}>SECRET</span>{" "}
              <span style={{color: brandCyan}}>VICE</span>
            </h1>
            <p className="text-sm opacity-75">Automapper • Hard • UI → Map options respected</p>
          </div>
        </div>

        {/* Controls */}
        <form className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4" onSubmit={onGenerate}>
          {/* File */}
          <div className="md:col-span-3 rounded-2xl bg-zinc-900 p-4 shadow-lg">
            <label className="text-sm opacity-80 block mb-2">Audio file</label>
            <input
              ref={fileRef}
              type="file"
              accept="audio/*"
              className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0"
              style={{ ['--tw-file-bg']: brandPink }}
            />
          </div>

          {/* Map type */}
          <div className="rounded-2xl bg-zinc-900 p-4 shadow-lg">
            <div className="text-sm opacity-80 mb-2">Map type</div>
            <select
              value={mapType}
              onChange={(e)=>setMapType(e.target.value)}
              className="w-full bg-zinc-800 rounded-xl px-3 py-2 outline-none"
            >
              {MAP_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          {/* Lighting */}
          <div className="rounded-2xl bg-zinc-900 p-4 shadow-lg">
            <div className="text-sm opacity-80 mb-2">Lighting</div>
            <select
              value={lightType}
              onChange={(e)=>setLightType(e.target.value)}
              className="w-full bg-zinc-800 rounded-xl px-3 py-2 outline-none"
            >
              {LIGHT_TYPES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>

          {/* Lead-in */}
          <div className="rounded-2xl bg-zinc-900 p-4 shadow-lg">
            <div className="text-sm opacity-80 mb-2">Lead-in (beats)</div>
            <input
              type="number"
              min={0}
              max={16}
              value={leadInBeats}
              onChange={(e)=>setLeadInBeats(e.target.value)}
              className="w-full bg-zinc-800 rounded-xl px-3 py-2 outline-none"
            />
            <div className="text-xs opacity-60 mt-1">Delay before first blocks appear.</div>
          </div>

          {/* Colours */}
          <div className="md:col-span-3 rounded-2xl bg-zinc-900 p-4 shadow-lg">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-sm opacity-80 mb-2">Primary colour</div>
                <div className="flex items-center gap-3">
                  <input type="color" value={primaryColor} onChange={(e)=>setPrimaryColor(e.target.value)} className="w-10 h-10 p-0 bg-transparent border-0"/>
                  <input type="text" value={primaryColor} onChange={(e)=>setPrimaryColor(e.target.value)} className="flex-1 bg-zinc-800 rounded-xl px-3 py-2 outline-none"/>
                </div>
              </div>
              <div>
                <div className="text-sm opacity-80 mb-2">Secondary colour</div>
                <div className="flex items-center gap-3">
                  <input type="color" value={secondaryColor} onChange={(e)=>setSecondaryColor(e.target.value)} className="w-10 h-10 p-0 bg-transparent border-0"/>
                  <input type="text" value={secondaryColor} onChange={(e)=>setSecondaryColor(e.target.value)} className="flex-1 bg-zinc-800 rounded-xl px-3 py-2 outline-none"/>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="md:col-span-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onAutoPick}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition"
              disabled={isWorking}
            >
              Auto Pick
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl"
              style={{ backgroundColor: brandPink }}
              disabled={isWorking}
            >
              {isWorking ? "Working…" : "Generate Hard"}
            </button>
            <div className="text-sm opacity-80 ml-auto">{status}{bpm ? ` • BPM ${bpm}` : ""}</div>
          </div>
        </form>

        <div className="text-xs opacity-60">
          Prefer <b>.ogg</b>. By uploading, you confirm you have rights to the track.
        </div>
      </div>
    </main>
  );
}
