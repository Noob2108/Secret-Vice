// lib/generateHardMap.js

/**
 * Convert analysis → Beat Saber v3 map (Hard).
 * Uses seconds for analysis; converts to beats using BPM.
 */
export function generateHardMap(analysis, preset = "tech") {
  const bpm = analysis.tempo || 120;
  const secToBeats = (s) => (s * bpm) / 60;

  // v3 container
  const map = {
    version: "3.3.0",
    bpmEvents: [],
    rotationEvents: [],
    colorNotes: [],
    sliders: [],
    burstSliders: [],
    obstacles: [],
    basicBeatmapEvents: [],
    colorBoostBeatmapEvents: []
  };

  // Hand alternation with simple flow rules
  let left = true;
  const usedByBeat = new Set();

  for (const t of analysis.onsets) {
    // snap to nearest beat
    const beat = nearest(analysis.beatGrid, t);
    const b = secToBeats(beat);
    const key = Math.round(b * 1000);
    if (usedByBeat.has(key)) continue; // avoid double-place
    usedByBeat.add(key);

    // placement heuristics
    const x = left ? 1 : 2;                           // inner columns for Hard
    const y = Math.random() < 0.5 ? 1 : 2;            // mid / top
    const d = left ? 5 : 4;                           // diag up-left / up-right

    map.colorNotes.push({ b, x, y, c: left ? 0 : 1, d, a: 0 });
    left = !left;
  }

  // basic light pulses on every bar (optional)
  for (let i = 0; i < analysis.beatGrid.length; i += 4) {
    const b = secToBeats(analysis.beatGrid[i]);
    map.basicBeatmapEvents.push({ b, et: 0, i: 5, f: 1 }); // simple on
  }

  return { bpm, map };
}

function nearest(arr, v) {
  let best = arr[0], db = Math.abs(v - best);
  for (let i = 1; i < arr.length; i++) {
    const d = Math.abs(v - arr[i]);
    if (d < db) { db = d; best = arr[i]; }
  }
  return best;
}
