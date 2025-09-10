// lib/generateHardMap.js
// Secret Vice — Hard generator v4 (Trial 4)
// - Density smoothing per bar (no clumps/no dead bars)
// - Swing planner (natural rebound directions)
// - Sightline safety with forward horizon
// - Wider motif pool + stronger repetition guard
// - Lighting packs that use custom colours (Chroma-friendly)
//   * Works vanilla (lights still fire); Chroma-capable loaders use _customData.color

// ---------- utils ----------
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const nearest = (arr, v) => {
  let best = arr[0], db = Math.abs(v - best);
  for (let i = 1; i < arr.length; i++) {
    const d = Math.abs(v - arr[i]);
    if (d < db) { db = d; best = arr[i]; }
  }
  return best;
};
const HEX2RGB = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "#ff2aa0");
  if (!m) return [1, 0, 0.65];
  return [parseInt(m[1], 16)/255, parseInt(m[2], 16)/255, parseInt(m[3], 16)/255];
};

// ---------- flow rules ----------
const FLOW_FOLLOW = {
  0: [5, 4, 8], // Up -> up-left/up-right/dot
  1: [2, 3, 8], // Down -> left/right/dot
  2: [5, 1, 8], // Left -> up-left/down/dot
  3: [4, 0, 8], // Right -> up-right/up/dot
  4: [0, 3, 8], // UpRight
  5: [0, 2, 8], // UpLeft
  6: [1, 3, 8], // DownRight
  7: [1, 2, 8], // DownLeft
  8: [5, 4, 2, 3] // Dot -> free-ish
};

// ---------- motifs (relative steps) ----------
const M = {
  quietTap: (L) => [{ dx: 0, dy: 0, d: L ? 5 : 4, c: L ? 0 : 1 }],
  altDiag2: (L) => [
    { dx: 0, dy: 0, d: L ? 5 : 4, c: L ? 0 : 1 },
    { dx: (L ? +1 : -1), dy: +1, d: L ? 3 : 1, c: L ? 1 : 0 }
  ],
  staircase3: (L) => [
    { dx: 0, dy: 0, d: L ? 5 : 4, c: L ? 0 : 1 },
    { dx: +1, dy: +1, d: 6, c: L ? 0 : 1 },
    { dx: -1, dy: 0, d: 2, c: L ? 1 : 0 }
  ],
  jabReset2: (L) => [
    { dx: 0, dy: -1, d: 0, c: L ? 0 : 1 },
    { dx: 0, dy: +1, d: 1, c: L ? 1 : 0 }
  ],
  burst3: (L) => [
    { dx: 0, dy: 0, d: L ? 5 : 4, c: L ? 0 : 1 },
    { dx: (L ? +1 : -1), dy: 0, d: 8, c: L ? 0 : 1 },
    { dx: 0, dy: +1, d: L ? 2 : 3, c: L ? 1 : 0 }
  ],
  inOut3: (L) => [
    { dx: (L ? -1 : +1), dy: 0, d: L ? 2 : 3, c: L ? 0 : 1 },
    { dx: 0, dy: 0, d: 8, c: L ? 1 : 0 },
    { dx: (L ? +1 : -1), dy: 0, d: L ? 3 : 2, c: L ? 0 : 1 }
  ],
  cross2: (L) => [
    { dx: (L ? -1 : +1), dy: +1, d: L ? 7 : 6, c: L ? 0 : 1 },
    { dx: (L ? +1 : -1), dy: -1, d: L ? 4 : 5, c: L ? 1 : 0 }
  ]
};

// ---------- fallbacks / analysis helpers ----------
function buildBeatFeaturesFallback(analysis) {
  const beatGrid = Array.isArray(analysis.beatGrid) ? analysis.beatGrid : [];
  const onsets = Array.isArray(analysis.onsets) ? analysis.onsets.slice().sort((a,b)=>a-b) : [];
  const tempo = analysis?.tempo || estimateTempoFromBeatGrid(beatGrid) || 120;

  const beatFeatures = beatGrid.map((t, i) => {
    const cnt = countOnsetsInWindow(onsets, t, 0.06);
    const bucket = cnt >= 2 ? "loud" : cnt === 1 ? "mid" : "quiet";
    return { index: i, timeSec: t, flux: cnt, bucket, downbeat: (i % 4) === 0 };
  });

  return { tempo, beatFeatures, onsets, beatGrid, meta: analysis.meta || { title: "Untitled" } };
}
function estimateTempoFromBeatGrid(beatGrid) {
  if (!beatGrid || beatGrid.length < 2) return 120;
  const interval = beatGrid[1] - beatGrid[0];
  return interval > 0 ? 60 / interval : 120;
}
function countOnsetsInWindow(onsets, center, w) {
  let n = 0;
  for (let i = 0; i < onsets.length; i++) {
    const dt = onsets[i] - center;
    if (dt < -w) continue;
    if (dt >  w) break;
    n++;
  }
  return n;
}
function classifyBeat(beatSec, onsets, window = 0.22) {
  let n = 0;
  for (let i = 0; i < onsets.length; i++) {
    const dt = Math.abs(onsets[i] - beatSec);
    if (dt <= window) n++;
    if (onsets[i] - beatSec > window) break;
  }
  if (n >= 2) return "staccato";
  if (n === 0) return "legato";
  return "neutral";
}

// ---------- safety / repetition ----------
function sightlineSafe(lastNotes, candidate, horizonBeats = 0.5) {
  // avoid hidden arrow in the same cell within horizon
  for (let i = lastNotes.length - 1; i >= 0; i--) {
    const n = lastNotes[i];
    if (candidate.b - n.b > horizonBeats) break;
    if (n.x === candidate.x && n.y === candidate.y) {
      if (!(n.d === 8 || candidate.d === 8)) return false; // not a dot → risk
    }
  }
  return true;
}
function bumpLane(candidate, rand) {
  candidate.x = clamp(candidate.x + (rand() < 0.5 ? -1 : +1), 0, 3);
}
function patternSig(notes, startIdx, beatsSpan = 16) {
  const slice = notes.slice(Math.max(0, startIdx - beatsSpan), startIdx);
  return slice.map(n => `${n.c}${n.x}${n.y}${n.d}`).join("-");
}
function tooRepetitive(notes, span = 16) {
  const sig = patternSig(notes, notes.length, span);
  if (!sig) return false;
  const hay = notes.slice(0, Math.max(0, notes.length - span)).map(n => `${n.c}${n.x}${n.y}${n.d}`).join("-");
  return hay.includes(sig);
}

// ---------- lighting ----------
function addBeatLight(map, b, pack, bucket, rgbA, rgbB, useB = false) {
  const [r, g, bl] = (useB ? rgbB : rgbA);
  const cd = { _color: [r, g, bl, 1] }; // Chroma-friendly
  if (pack === "cyberpunk") {
    const i = bucket === "loud" ? 7 : bucket === "mid" ? 5 : 3;
    map.basicBeatmapEvents.push({ b, et: 0, i, f: 1, customData: cd, _customData: cd });
    map.basicBeatmapEvents.push({ b: b + 0.05, et: 0, i: 0, f: 0, customData: cd, _customData: cd });
  } else {
    const i = bucket === "loud" ? 6 : 4;
    map.basicBeatmapEvents.push({ b, et: 0, i, f: 1, customData: cd, _customData: cd });
  }
}
function addPhraseLight(map, b, pack, rgbA, rgbB) {
  const cdA = { _color: [...rgbA, 1] }, cdB = { _color: [...rgbB, 1] };
  if (pack === "cyberpunk") {
    map.basicBeatmapEvents.push({ b, et: 2, i: 1, f: 1, customData: cdA, _customData: cdA });
    map.basicBeatmapEvents.push({ b: b + 0.25, et: 2, i: 0, f: 0, customData: cdB, _customData: cdB });
  } else {
    map.basicBeatmapEvents.push({ b, et: 1, i: 3, f: 1, customData: cdA, _customData: cdA });
  }
}

// ---------- main ----------
export function generateHardMap(analysis, options = {}) {
  const preset = options.preset || "tech";        // "tech" | "dancey" | "showpiece"
  const lights = options.lights || "concert";     // "concert" | "cyberpunk"
  const colors = options.colors || { primary: "#ff2aa0", secondary: "#6a5cff" };
  const rgbA = HEX2RGB(colors.primary);
  const rgbB = HEX2RGB(colors.secondary);

  const haveBF = Array.isArray(analysis?.beatFeatures) && analysis.beatFeatures.length > 0;
  const { tempo, beatFeatures, onsets, beatGrid, meta } = haveBF
    ? { tempo: analysis.tempo || estimateTempoFromBeatGrid(analysis.beatGrid), beatFeatures: analysis.beatFeatures, onsets: analysis.onsets || [], beatGrid: analysis.beatGrid || [], meta: analysis.meta || { title: "Untitled" } }
    : buildBeatFeaturesFallback(analysis);

  const bpm = tempo || 120;
  const secToBeats = (s) => (s * bpm) / 60;

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

  // seeded RNG
  const seed = hashString(meta?.title || "secret-vice");
  const rand = mulberry32(seed);

  // style menu
  const styleMotifs = preset === "dancey"
    ? ["altDiag2", "staircase3", "jabReset2", "inOut3"]
    : preset === "showpiece"
      ? ["staircase3", "burst3", "altDiag2", "cross2"]
      : ["altDiag2", "jabReset2", "burst3", "inOut3"]; // tech

  // placement state
  let baseX = 1, baseY = 1, leadLeft = true, lastDir = 5;
  const clampInnerX = (x) => clamp(x, 1, 2);
  const clampY = (y) => clamp(y, 0, 2);

  // ---- DENSITY SMOOTHING PER BAR (4 beats) ----
  for (let i = 0; i < beatFeatures.length; i += 4) {
    const bar = beatFeatures.slice(i, i + 4);
    if (!bar.length) continue;

    // target notes per bar by average intensity
    const loudCt = bar.filter(b => b.bucket === "loud").length;
    const midCt  = bar.filter(b => b.bucket === "mid").length;
    // baseline: quiet=2, mid=3, loud=4 (Hard)
    let target = 2 + Math.min(2, Math.floor(midCt*0.5 + loudCt*0.9));
    target = clamp(target, 2, 4);

    // Ensure at least 1 placement each beat; distribute extras on louder beats
    const placements = new Array(bar.length).fill(1);
    let extras = target - bar.length;
    while (extras > 0) {
      // pick the loudest remaining slot
      let idx = 0, score = -1;
      for (let k = 0; k < bar.length; k++) {
        const sc = (bar[k].bucket === "loud" ? 3 : bar[k].bucket === "mid" ? 2 : 1) - placements[k]*0.9;
        if (sc > score) { score = sc; idx = k; }
      }
      placements[idx] += 1;
      extras--;
    }

    // generate the bar
    for (let j = 0; j < bar.length; j++) {
      const bf = bar[j];
      const b = secToBeats(bf.timeSec);
      const beatsThisSlot = placements[j];

      // articulation
      const artic = classifyBeat(bf.timeSec, onsets, 0.22);

      // choose motif per slot (legato→staircase, staccato→burst)
      let motifName;
      if (artic === "staccato")       motifName = "burst3";
      else if (artic === "legato")    motifName = "staircase3";
      else                            motifName = styleMotifs[Math.floor(rand()*styleMotifs.length)];

      // drift base lane within inner cols
      baseX = clampInnerX(baseX + (rand() < 0.5 ? -1 : +1));
      baseY = clampY(baseY + (rand() < 0.4 ? 0 : (rand() < 0.5 ? -1 : +1)));

      // stamp required number of notes this beat (1..3)
      let stepOffset = 0;
      for (let s = 0; s < beatsThisSlot; s++) {
        const motif = s === 0 ? M[motifName](leadLeft) : M.quietTap(leadLeft);
        for (let t = 0; t < motif.length; t++) {
          const step = motif[t];
          let x = clampInnerX(baseX + step.dx);
          let y = clampY(baseY + step.dy);
          let d = pickFlowDir(lastDir, step.d);

          const nb = b + stepOffset;
          const candidate = { b: nb, x, y, c: step.c, d, a: 0 };

          // sightline safety (0.5 beat horizon) → dot or lane bump
          if (!sightlineSafe(map.colorNotes, candidate, 0.5)) {
            if (rand() < 0.5) candidate.d = 8; else bumpLane(candidate, rand);
          }

          // avoid exact duplicates
          const last = map.colorNotes[map.colorNotes.length - 1];
          if (!last || !(last.x === candidate.x && last.y === candidate.y && last.c === candidate.c && last.d === candidate.d && Math.abs(last.b - candidate.b) < 0.01)) {
            map.colorNotes.push(candidate);
            lastDir = candidate.d;
          }

          // within-beat spacing: denser for staccato
          stepOffset += (motifName === "burst3" ? 0.125 : 0.25);
        }
      }

      // repetition guard across last 16 notes → inject corrective dot if needed
      if (tooRepetitive(map.colorNotes, 16)) {
        const fix = {
          b: b + 0.375,
          x: clampInnerX(baseX + (leadLeft ? +1 : -1)),
          y: clampY(baseY + 1),
          c: leadLeft ? 1 : 0,
          d: 8, a: 0
        };
        map.colorNotes.push(fix);
        lastDir = fix.d;
      }

      // lighting on every beat (intensity-aware, colorised)
      addBeatLight(map, b, lights, bf.bucket, rgbA, rgbB, (j % 2 === 1));
    }

    // phrase pop at bar start
    const bStart = secToBeats(bar[0].timeSec);
    addPhraseLight(map, bStart, lights, rgbA, rgbB);

    // parity freshness each bar
    leadLeft = !leadLeft;
  }

  return { bpm, map };
}

// flow-friendly dir
function pickFlowDir(lastDir, suggested) {
  const opts = FLOW_FOLLOW[lastDir] || [suggested, 8];
  if (opts.includes(suggested)) return suggested;
  return opts[0];
}
