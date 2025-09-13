"use client";
import { useRef, useState } from "react";

export default function Controls({ onGenerate, busy }) {
  const fileRef = useRef(null);
  const [preset, setPreset] = useState("dancey");
  const [lights, setLights] = useState("cyberpunk");
  const [primary, setPrimary] = useState("#ff2aa0");
  const [secondary, setSecondary] = useState("#00c9ff");
  const [startOffsetBeats, setStartOffsetBeats] = useState(4);

  function autoPick() {
    // quick taste: dancey + cyberpunk + SV brand colours + 4 beat lead-in
    setPreset("dancey");
    setLights("cyberpunk");
    setPrimary("#ff2aa0");
    setSecondary("#00c9ff");
    setStartOffsetBeats(4);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return alert("Pick an audio file first.");
    const opts = { preset, lights, colors: { primary, secondary }, startOffsetBeats: Number(startOffsetBeats) };
    onGenerate(file, opts);
  }

  return (
    <form onSubmit={handleSubmit} className="glass card">
      <div className="cardHead">
        <h2>Generate a Map</h2>
        <button type="button" className="btn ghost" onClick={autoPick}>Auto-Pick</button>
      </div>

      <div className="row">
        <label className="label">Audio</label>
        <input ref={fileRef} type="file" accept="audio/*" className="input file:bg-brand" />
      </div>

      <div className="row">
        <label className="label">Map Style</label>
        <select className="select" value={preset} onChange={e=>setPreset(e.target.value)}>
          <option value="tech">Tech (streamy)</option>
          <option value="dancey">Dancey (flow)</option>
          <option value="showpiece">Showpiece (flashy)</option>
        </select>
      </div>

      <div className="row">
        <label className="label">Lighting</label>
        <select className="select" value={lights} onChange={e=>setLights(e.target.value)}>
          <option value="concert">Concert</option>
          <option value="cyberpunk">Cyberpunk</option>
        </select>
      </div>

      <div className="row two">
        <div>
          <label className="label">Primary</label>
          <input className="input" type="color" value={primary} onChange={e=>setPrimary(e.target.value)} />
        </div>
        <div>
          <label className="label">Secondary</label>
          <input className="input" type="color" value={secondary} onChange={e=>setSecondary(e.target.value)} />
        </div>
      </div>

      <div className="row">
        <label className="label">Lead-in (beats)</label>
        <input className="slider" type="range" min="0" max="12" step="1"
               value={startOffsetBeats}
               onChange={e=>setStartOffsetBeats(e.target.value)} />
        <span className="value">{startOffsetBeats}</span>
      </div>

      <div className="actions">
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? "Generating…" : "Generate Hard"}
        </button>
      </div>
    </form>
  );
}
