// lib/exportZip.js
import JSZip from "jszip";
import { saveAs } from "file-saver";

/**
 * Bundle v3 map + info + original audio into a Beat Saber zip.
 * We keep original file extension; users should prefer .ogg for best compatibility.
 */
export async function exportZip(file, bpm, map, songName = "Secret Vice") {
  const zip = new JSZip();

  const cleanName = songName.replace(/[^\w\s-]/g, "").trim();

  // Info.dat (v2 schema container pointing to v3 difficulty file is fine for most loaders)
  const infoDat = {
    _version: "2.0.0",
    _songName: cleanName,
    _songAuthorName: "",
    _levelAuthorName: "Secret Vice",
    _beatsPerMinute: bpm,
    _songFilename: file.name,
    _coverImageFilename: "cover.png",
    _difficultyBeatmapSets: [{
      _beatmapCharacteristicName: "Standard",
      _difficultyBeatmaps: [{
        _difficulty: "Hard",
        _beatmapFilename: "HardStandard.dat"
      }]
    }]
  };

  zip.file("Info.dat", JSON.stringify(infoDat, null, 2));
  zip.file("HardStandard.dat", JSON.stringify(map, null, 2));

  const arrayBuffer = await file.arrayBuffer();
  zip.file(file.name, arrayBuffer);

  // tiny placeholder cover
  const pngBlank1x1 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGP4BwQACfsD/ctPqYkAAAAASUVORK5CYII=";
  zip.file("cover.png", Uint8Array.from(atob(pngBlank1x1), c => c.charCodeAt(0)));

  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `${cleanName}_Hard.zip`);
}
