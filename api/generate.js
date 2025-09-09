// api/generate.js
import { analyzeAudio } from "../src/audio/analyze.js";
import { planMotifs } from "../src/motif/plan.js";
import { solveChart } from "../src/solver/solve.js";
import { decorateV3 } from "../src/decor/decorate.js";
import { lightChroma } from "../src/lighting/chroma.js";
import { packageZip } from "../src/pack/package.js";

export default async function handler(req, res) {
  try {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: "Missing audio URL" });

    // Step 1: Analyze audio
    const feats = await analyzeAudio(url);

    // Step 2: Plan motifs
    const motifs = planMotifs(feats);

    // Step 3: Solve chart
    const chart = solveChart(feats, motifs);

    // Step 4: Decorate with arcs/chains
    const v3 = decorateV3(chart);

    // Step 5: Lighting
    const lit = lightChroma(v3, feats);

    // Step 6: Package into zip
    const zip = await packageZip(lit, { songName: feats.meta?.title || "Untitled" });

    res.setHeader("Content-Type", "application/zip");
    res.send(zip);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
