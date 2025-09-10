// lib/generateHardMap.js

// seeded RNG so results are reproducible per song
function mulberry32(seed) {
  return function() {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateHardMap(analysis, preset = "tech") {
  const bpm = analysis.tempo || 120;
  const secToBeats = s => (s * bpm) / 60;

  // base container (v3)
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

  // ---- motif library (relative patterns over a single beat) ----
  // Each entry returns an array of {dx, dy, d (cut), hand} steps
  const motifs = {
    quiet_tap: (left) => [{ dx: 0, dy: 0, d: left ? 5 : 4, hand: left ? 0 : 1 }],
    alt_diags: (left) => [
      { dx: 0, dy: 0, d: left ? 5 : 4, hand: left ? 0 : 1 },
      { dx: (left ? +1 : -1), dy: +1, d: left ? 3 : 1, hand: left ? 1 : 0 }
    ],
    staircase: (left) => [
      { dx: 0, dy: 0, d: left ? 5 : 4, hand: left ? 0 : 1 },
      { dx: +1, dy: +1, d: 6, hand: left ? 0 : 1 },
      { dx: -1, dy: 0, d: 2, hand: left ? 1 : 0 }
    ],
    jab_reset: (left) => [
      { dx: 0, dy: -1, d: 0, hand: left ? 0 : 1 },
      { dx: 0, dy: +1, d: 1, hand: left ? 1 : 0 }
    ],
    burst_3: (left) => [
      { dx: 0, dy: 0, d: left ? 5 : 4, hand: left ? 0 : 1 },
      { dx: (left ? +1 : -1), dy: 0, d: 8, hand: left ? 0 : 1 },
      { dx: 0, dy: +1, d: left ? 2 : 3, hand: left ? 1 : 0 }
    ]
  };

  // choose motif set by style preset
  const styleMotifs = preset === "dancey"
    ? ["alt_diags", "staircase", "jab_reset"]
    : preset === "showpiece"
    ? ["staircase", "burst_3", "alt_diags"]
    : ["alt_diags", "jab_reset", "burst_3"]; // tech default

  // seeded randomness from title for reproducibility
  const seed = hashString(analysis.meta?.title || "secret-vice");
  const rand = mulberry32(seed);

  // placement state
  let baseX = 1;   // start near center
  let baseY = 1;
  let leftHandLead = true;

  // helper to clamp grid
  const clampXY = (x,y) => ({ x: Math.max(0, Math.min(3, x)), y: Math.max(0, Math.min(2, y)) });

  // spread over beats with intensity
  for (let i = 0; i < analysis.beatFeatures.length; i++) {
    const bf = analysis.beatFeatures[i];
    const tSec = bf.timeSec;
    const b = secToBeats(tSec);

    // pick density by bucket
    const density =
      bf.bucket === "loud" ? 1.0 :
      bf.bucket === "mid"  ? 0.65 :
                             0.35;

    if (rand() > density) continue; // skip this beat

    // downbeat emphasis → always place something
    const mustPlace = bf.downbeat;

    if (!mustPlace && rand() > density) continue;

    // choose a motif
    const motifName =
      bf.bucket === "quiet" ? "quiet_tap" :
      styleMotifs[Math.floor(rand()*styleMotifs.length)];
    const motif = motifs[motifName](leftHandLead);

    // random base lane near center, but avoid repeating same column/row too long
    baseX = clampToInner(baseX + (rand()<0.5 ? -1 : +1));
    baseY = clampY(baseY + (rand()<0.5 ? 0 : (rand()<0.5 ? -1 : +1)));

    // stamp motif
    let stepOffset = 0;
    for (const step of motif) {
      const px = baseX + step.dx;
      const py = baseY + step.dy;
      const { x, y } = clampXY(px, py);

      // avoid identical back-to-back
      const last = map.colorNotes[map.colorNotes.length - 1];
      const handColor = step.hand; // 0 left, 1 right
      const dir = step.d;

      const nb = b + stepOffset;
      const newNote = { b: nb, x, y, c: handColor, d: dir, a: 0 };

      if (!last || !(last.x === x && last.y === y && last.c === handColor && last.d === dir && Math.abs(last.b - nb) < 0.01)) {
        map.colorNotes.push(newNote);
      }

      stepOffset += 0.125; // 1/8 beat spacing inside beat for bursts
    }

    // alternate lead hand by section to keep parity fresh
    if (bf.downbeat) leftHandLead = !leftHandLead;
  }

  // lighting: pulses on downbeats, stronger on loud beats, plus small phrase pops every 8 beats
  for (const bf of analysis.beatFeatures) {
    if (!bf.downbeat) continue;
    const b = secToBeats(bf.timeSec);
    const intensity = bf.bucket === "loud" ? 7 : bf.bucket === "mid" ? 5 : 3;
    map.basicBeatmapEvents.push({ b, et: 0, i: intensity, f: 1 }); // simple env light
  }
  for (let i = 0; i < analysis.beatFeatures.length; i += 8) {
    const b = secToBeats(analysis.beatFeatures[i].timeSec);
    map.basicBeatmapEvents.push({ b, et: 2, i: 1, f: 1 }); // ring zoom pulse
  }

  return { bpm, map };
}

function clampToInner(x) {
  if (x < 1) return 1;
  if (x > 2) return 2;
  return x;
}
function clampY(y) {
  if (y < 0) return 0;
  if (y > 2) return 2;
  return y;
}
function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
