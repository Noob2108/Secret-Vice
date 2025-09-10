// lib/generateHardMap.js
// Secret Vice — Hard generator v3 (defensive)
// - Fills gaps, flowy directions, sightline safety, repetition guard
// - Intensity-aware density, staccato vs legato heuristics
// - Lighting packs: "concert" | "cyberpunk"
// - Now robust if analysis.beatFeatures is missing (builds from beatGrid/onsets)

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

// Direction follow-ups to keep swing fluid
const FLOW_FOLLOW = {
  0: [5, 4, 8], // Up
  1: [2, 3, 8], // Down
  2: [5, 1, 8], // Left
  3: [4, 0, 8], // Right
  4: [0, 3, 8], // UpRight
  5: [0, 2, 8], // UpLeft
  6: [1, 3, 8], // DownRight
  7: [1, 2, 8], // DownLeft
  8: [5, 4, 2, 3] // Dot
};

// Motif snippets
const MOTIFS = {
  quietTap: (left) => [{ dx: 0, dy: 0, d: left ? 5 : 4, c: left ? 0 : 1 }],
  altDiag2: (left) => [
    { dx: 0, dy: 0, d: left ? 5 : 4, c: left ? 0 : 1 },
    { dx: (left ? +1 : -1), dy: +1, d: left ? 3 : 1, c: left ? 1 : 0 }
  ],
  staircase3: (left) => [
    { dx: 0, dy: 0, d: left ? 5 : 4, c: left ? 0 : 1 },
    { dx: +1, dy: +1, d: 6, c: left ? 0 : 1 },
    { dx: -1, dy: 0, d: 2, c: left ? 1 : 0 }
  ],
  jabReset2: (left) => [
    { dx: 0, dy: -1, d: 0, c: left ? 0 : 1 },
    { dx: 0, dy: +1, d: 1, c: left ? 1 : 0 }
  ],
  burst3: (left) => [
    { dx: 0, dy: 0, d: left ? 5 : 4, c: left ? 0 : 1 },
    { dx: (left ? +1 : -1), dy: 0, d: 8, c: left ? 0 : 1 },
    { dx: 0, dy: +1, d: left ? 2 : 3, c: left ? 1 : 0 }
  ]
};

// ---- Resilience: build beatFeatures if missing ----
function buildBeatFeaturesFallback(analysis) {
  const beatGrid = Array.isArray(analysis.beatGrid) ? analysis.beatGrid : [];
  const onsets = Array.isArray(analysis.onsets) ? analysis.onsets.slice().sort((a,b)=>a-b) : [];
  const tempo = analysis?.tempo || estimateTempoFromBeatGrid(beatGrid) || 120;

  const beatFeatures = beatGrid.map((t, i) => {
    // Count onsets near the beat (±60ms)
    const count = countOnsetsInWindow(onsets, t, 0.06);
    const bucket = count >= 2 ? "loud" : count === 1 ? "mid" : "quiet";
    return { index: i, timeSec: t, flux: count, bucket, downbeat: (i % 4) === 0 };
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

// Classify articulation from onsets near beat
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

// Sightline: avoid hidden arrow behind another
function sightlineSafe(last, next) {
  if (!last) return true;
  const sameCell = last.x === next.x && last.y === next.y;
  const veryClose = Math.abs(last.b - next.b) < 0.01;
  if (sameCell && veryClose) {
    return last.d === 8 || next.d === 8; // allow if either is dot
  }
  return true;
}

// Repetition guard signature
function patternSig(notes, startIdx, span = 8) {
  const slice = notes.slice(Math.max(0, startIdx - span), startIdx);
  return slice.map(n => `${n.c}${n.x}${n.y}${n.d}`).join("-");
}

export function generateHardMap(analysis, options = {}) {
  const preset = options.preset || "tech";        // "tech" | "dancey" | "showpiece"
  const lights = options.lights || "concert";     // "concert" | "cyberpunk"
  // colors option is accepted but not used yet (safe no-op)

  // Use provided beatFeatures or build a fallback
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

  // seeded RNG from title for reproducibility
  const seed = hashString(meta?.title || "secret-vice");
  const rand = mulberry32(seed);

  // style motif menu
  const styleMotifs = preset === "dancey"
    ? ["altDiag2", "staircase3", "jabReset2"]
    : preset === "showpiece"
      ? ["staircase3", "burst3", "altDiag2"]
      : ["altDiag2", "jabReset2", "burst3"]; // tech

  // placement state
  let baseX = 1, baseY = 1;
  let leadLeft = true;
  let lastDir = 5; // start on a diagonal
  const usedBeatKeys = new Set();

  const clampInnerX = (x) => clamp(x, 1, 2);
  const clampY = (y) => clamp(y, 0, 2);

  // iterate EVERY beat → no dead gaps
  for (let i = 0; i < beatFeatures.length; i++) {
    const bf = beatFeatures[i];
    const beatSec = bf.timeSec;
    const b = secToBeats(beatSec);
    const bKey = Math.round(b * 1000);
    if (usedBeatKeys.has(bKey)) continue;

    // density by bucket
    const density =
      bf.bucket === "loud" ? 1.0 :
      bf.bucket === "mid"  ? 0.8  : 0.55;

    const artic = classifyBeat(beatSec, onsets, 0.22); // staccato / legato / neutral
    const mustPlace = bf.downbeat;

    if (!mustPlace && rand() > density) {
      addBeatLight(map, b, lights, bf.bucket);
      continue;
    }

    // choose motif
    let motifName;
    if (artic === "staccato")       motifName = "burst3";
    else if (artic === "legato")    motifName = "staircase3";
    else                            motifName = styleMotifs[Math.floor(rand()*styleMotifs.length)];

    // drift base lane, keep readable
    baseX = clampInnerX(baseX + (rand() < 0.5 ? -1 : +1));
    baseY = clampY(baseY + (rand() < 0.4 ? 0 : (rand() < 0.5 ? -1 : +1)));

    const motif = MOTIFS[motifName](leadLeft);

    // repetition guard snapshot before stamping
    const prevSig = patternSig(map.colorNotes, map.colorNotes.length, 8);

    // stamp motif with micro-spacing
    let stepOffset = 0;
    for (let s = 0; s < motif.length; s++) {
      const step = motif[s];
      let x = clampInnerX(baseX + step.dx);
      let y = clampY(baseY + step.dy);
      let d = pickFlowDir(lastDir, step.d);

      const nb = b + stepOffset;
      const candidate = { b: nb, x, y, c: step.c, d, a: 0 };

      // sightline safety
      const last = map.colorNotes[map.colorNotes.length - 1];
      if (!sightlineSafe(last, candidate)) {
        if (rand() < 0.5) candidate.d = 8; // dot
        else candidate.x = clampInnerX(candidate.x + (rand() < 0.5 ? -1 : +1));
      }

      // avoid exact duplicates
      if (!last || !(last.x === candidate.x && last.y === candidate.y && last.c === candidate.c && last.d === candidate.d && Math.abs(last.b - candidate.b) < 0.01)) {
        map.colorNotes.push(candidate);
        lastDir = candidate.d;
      }

      stepOffset += (motifName === "burst3" ? 0.125 : 0.25); // denser for staccato
    }

    // repetition guard: if signature didn't change, inject corrective jab
    const newSig = patternSig(map.colorNotes, map.colorNotes.length, 8);
    if (newSig === prevSig) {
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

    addBeatLight(map, b, lights, bf.bucket);
    if (bf.downbeat) leadLeft = !leadLeft;

    usedBeatKeys.add(bKey);
  }

  // phrase accents: every 8 beats
  for (let i = 0; i < beatFeatures.length; i += 8) {
    const b = secToBeats(beatFeatures[i].timeSec);
    addPhraseLight(map, b, lights);
  }

  return { bpm, map };
}

// Flow-friendly direction selection
function pickFlowDir(lastDir, suggested) {
  const opts = FLOW_FOLLOW[lastDir] || [suggested, 8];
  if (opts.includes(suggested)) return suggested;
  return opts[0];
}

// Lighting helpers
function addBeatLight(map, b, pack, bucket) {
  if (pack === "cyberpunk") {
    const i = bucket === "loud" ? 7 : bucket === "mid" ? 5 : 3;
    map.basicBeatmapEvents.push({ b, et: 0, i, f: 1 });
    map.basicBeatmapEvents.push({ b: b + 0.05, et: 0, i: 0, f: 0 }); // <-- fixed (b:)
  } else {
    const i = bucket === "loud" ? 6 : 4;
    map.basicBeatmapEvents.push({ b, et: 0, i, f: 1 });
  }
}
function addPhraseLight(map, b, pack) {
  if (pack === "cyberpunk") {
    map.basicBeatmapEvents.push({ b, et: 2, i: 1, f: 1 });
    map.basicBeatmapEvents.push({ b: b + 0.25, et: 2, i: 0, f: 0 }); // <-- fixed (b:)
  } else {
    map.basicBeatmapEvents.push({ b, et: 1, i: 3, f: 1 });
  }
}
