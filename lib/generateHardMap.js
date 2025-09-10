// lib/generateHardMap.js
// Secret Vice — Hard generator v3
// Goals: fill gaps, fluid swing directions, sightline safety, repetition guard,
//        intensity-aware density, staccato vs legato heuristics, punchy lighting packs.

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

// Allowed direction follow-ups (fluid rebound). Keys are Beat Saber cut dirs (0..8)
const FLOW_FOLLOW = {
  0: [5, 4, 8], // Up -> diag ups or dot
  1: [2, 3, 8], // Down -> diag downs or dot
  2: [5, 1, 8], // Left -> up-left, down
  3: [4, 0, 8], // Right -> up-right, up
  4: [0, 3, 8], // UpRight -> up, right
  5: [0, 2, 8], // UpLeft  -> up, left
  6: [1, 3, 8], // DownRight -> down, right
  7: [1, 2, 8], // DownLeft  -> down, left
  8: [5, 4, 2, 3] // Dot -> free-ish, bias to diagonals
};

// Simple motif snippets that *flow*; each returns array of relative steps
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

// classifies staccato/legato around a beat using onsets
function classifyBeat(beatSec, onsets, window = 0.22) {
  // count onsets in ±window
  let n = 0;
  for (let i = 0; i < onsets.length; i++) {
    const dt = Math.abs(onsets[i] - beatSec);
    if (dt <= window) n++;
    if (onsets[i] - beatSec > window) break;
  }
  if (n >= 2) return "staccato";
  if (n === 0) return "legato"; // no transient near beat → likely sustain
  return "neutral";
}

// Avoid placing a note directly behind another with conflicting arrow (sightline)
function sightlineSafe(last, next) {
  if (!last) return true;
  const sameCell = last.x === next.x && last.y === next.y;
  const veryClose = Math.abs(last.b - next.b) < 0.01;
  if (sameCell && veryClose) {
    // allow if either is dot, else it hides direction → not safe
    return last.d === 8 || next.d === 8;
  }
  return true;
}

// Repetition guard over last N beats using a compact signature
function patternSig(notes, startIdx, beatsSpan = 4) {
  const slice = notes.slice(Math.max(0, startIdx - beatsSpan), startIdx);
  return slice.map(n => `${n.c}${n.x}${n.y}${n.d}`).join("-");
}

export function generateHardMap(analysis, options = {}) {
  const preset = options.preset || "tech"; // "tech" | "dancey" | "showpiece"
  const lights = options.lights || "concert"; // "concert" | "cyberpunk"
  const bpm = analysis.tempo || 120;
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
  const seed = hashString(analysis.meta?.title || "secret-vice");
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

  // helper to keep within grid, prefer inner columns for Hard
  const clampInnerX = (x) => clamp(x, 1, 2);
  const clampY = (y) => clamp(y, 0, 2);

  // build a quick lookup to count onsets near a beat faster
  const onsets = analysis.onsets.slice().sort((a,b)=>a-b);

  // iterate every beat so there are no dead gaps
  for (let i = 0; i < analysis.beatFeatures.length; i++) {
    const bf = analysis.beatFeatures[i];
    const beatSec = bf.timeSec;
    const b = secToBeats(beatSec);
    const bKey = Math.round(b * 1000);
    if (usedBeatKeys.has(bKey)) continue;

    // intensity → density
    const density =
      bf.bucket === "loud" ? 1.0 :
      bf.bucket === "mid"  ? 0.8  : 0.55;

    // classification for musical articulation
    const artic = classifyBeat(beatSec, onsets, 0.22); // staccato / legato / neutral

    // always place *something* on downbeats; otherwise probabilistic by density
    const mustPlace = bf.downbeat;
    if (!mustPlace && rand() > density) {
      // still add a tiny light touch so beat isn't visually dead
      addBeatLight(map, b, lights, bf.bucket);
      continue;
    }

    // choose motif
    let motifName;
    if (artic === "staccato")       motifName = "burst3";
    else if (artic === "legato")    motifName = "staircase3";
    else /* neutral */              motifName = styleMotifs[Math.floor(rand()*styleMotifs.length)];

    // choose a base cell that drifts but stays readable
    baseX = clampInnerX(baseX + (rand() < 0.5 ? -1 : +1));
    baseY = clampY(baseY + (rand() < 0.4 ? 0 : (rand() < 0.5 ? -1 : +1)));

    const motif = MOTIFS[motifName](leadLeft);

    // repetition guard: if last 2–4 bars match, flip to a different motif
    const lastSig = patternSig(map.colorNotes, map.colorNotes.length, 8);
    let trialSig;

    // stamp motif (with inside-beat micro-spacing for bursts)
    let stepOffset = 0;
    for (let s = 0; s < motif.length; s++) {
      const step = motif[s];
      let x = clampInnerX(baseX + step.dx);
      let y = clampY(baseY + step.dy);
      let d = pickFlowDir(lastDir, step.d);

      const nb = b + stepOffset;

      const candidate = { b: nb, x, y, c: step.c, d, a: 0 };

      // sightline safety: if it hides direction, convert to dot or nudge lane
      const last = map.colorNotes[map.colorNotes.length - 1];
      if (!sightlineSafe(last, candidate)) {
        if (rand() < 0.5) candidate.d = 8; // dot
        else candidate.x = clampInnerX(candidate.x + (rand() < 0.5 ? -1 : +1));
      }

      // avoid literal duplicate spam
      if (!last || !(last.x === candidate.x && last.y === candidate.y && last.c === candidate.c && last.d === candidate.d && Math.abs(last.b - candidate.b) < 0.01)) {
        map.colorNotes.push(candidate);
        lastDir = candidate.d;
      }

      stepOffset += (motifName === "burst3" ? 0.125 : 0.25); // denser for staccato
    }

    // repetition guard check (after stamping). If too similar, inject a corrective jab.
    trialSig = patternSig(map.colorNotes, map.colorNotes.length, 8);
    if (trialSig === lastSig) {
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

    // downbeat anchor: add a small light pop
    addBeatLight(map, b, lights, bf.bucket);

    // alternate lead hand each bar for parity freshness
    if (bf.downbeat) leadLeft = !leadLeft;

    usedBeatKeys.add(bKey);
  }

  // Phrase accents: every 8 beats
  for (let i = 0; i < analysis.beatFeatures.length; i += 8) {
    const b = secToBeats(analysis.beatFeatures[i].timeSec);
    addPhraseLight(map, b, lights);
  }

  return { bpm, map };
}

// Prefer directions that naturally follow the last swing
function pickFlowDir(lastDir, suggested) {
  const opts = FLOW_FOLLOW[lastDir] || [suggested, 8];
  if (opts.includes(suggested)) return suggested;
  return opts[0];
}

// Lighting helpers
function addBeatLight(map, b, pack, bucket) {
  if (pack === "cyberpunk") {
    // punchier colors (index ~ brightness), subtle on quiet beats
    const i = bucket === "loud" ? 7 : bucket === "mid" ? 5 : 3;
    map.basicBeatmapEvents.push({ b, et: 0, i, f: 1 }); // env on
    map.basicBeatmapEvents.push({ b + 0.05, et: 0, i: 0, f: 0 }); // quick off
  } else {
    // concert: broader flash on downbeats
    const i = bucket === "loud" ? 6 : 4;
    map.basicBeatmapEvents.push({ b, et: 0, i, f: 1 });
  }
}
function addPhraseLight(map, b, pack) {
  if (pack === "cyberpunk") {
    map.basicBeatmapEvents.push({ b, et: 2, i: 1, f: 1 }); // ring zoom pulse
    map.basicBeatmapEvents.push({ b + 0.25, et: 2, i: 0, f: 0 });
  } else {
    map.basicBeatmapEvents.push({ b, et: 1, i: 3, f: 1 }); // back-laser sweep hint
  }
}
