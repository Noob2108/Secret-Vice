// pages/api/generate.js
import formidable from "formidable";
import fs from "fs";
import { analyzeAudio } from "../../src/analyzeAudio";
import { generateHardMap } from "../../src/generateHardMap";

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  const form = formidable({ multiples: false });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: "Upload failed" });

    const audioPath = files.file.filepath;

    // 1. Analyze audio
    const analysis = await analyzeAudio(audioPath);

    // 2. Generate Hard map
    const outputPath = "./tmp/Hard.dat";
    generateHardMap(analysis, outputPath);

    // 3. Send back file
    const fileBuffer = fs.readFileSync(outputPath);
    res.setHeader("Content-Disposition", "attachment; filename=Hard.dat");
    res.setHeader("Content-Type", "application/json");
    res.send(fileBuffer);
  });
}
