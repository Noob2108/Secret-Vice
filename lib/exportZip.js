// lib/exportZip.js
import JSZip from "jszip";
import { saveAs } from "file-saver";

function stripExt(filename = "") {
  return filename.replace(/\.[^.]+$/, "");
}

export async function exportZip(file, bpm, map, rawTitleFromAnalysis) {
  const zip = new JSZip();

  // actual uploaded filename
  const uploadName = file?.name || "song.ogg";
  const title = rawTitleFromAnalysis?.trim() || stripExt(uploadName);
  const safeTitle = title.trim() || "Untitled";

  // folder = "Title (Secret Vice)"
  const folderName = `${safeTitle} (Secret Vice)`;

  // build info.dat (must be lowercase!)
  const info = {
    "_version": "2.0.0",
    "_songName": safeTitle,
    "_songAuthorName": "",
    "_levelAuthorName": "Secret Vice",
    "_beatsPerMinute": Math.round((bpm || 120) * 1000) / 1000,
    "_songFilename": uploadName,
    "_coverImageFilename": "cover.png",
    "_difficultyBeatmapSets": [
      {
        "_beatmapCharacteristicName": "Standard",
        "_difficultyBeatmaps": [
          {
            "_difficulty": "Hard",
            "_beatmapFilename": "HardStandard.dat"
          }
        ]
      }
    ]
  };

  // create folder inside zip
  const folder = zip.folder(folderName);

  // must be lowercase info.dat
  folder.file("info.dat", JSON.stringify(info, null, 2));
  folder.file("HardStandard.dat", JSON.stringify(map, null, 2));

  // audio
  const arrayBuffer = await file.arrayBuffer();
  folder.file(uploadName, arrayBuffer);

  // placeholder cover (1x1 transparent)
  const tinyTransparentPng =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
  folder.file("cover.png", Uint8Array.from(atob(tinyTransparentPng), c => c.charCodeAt(0)));

  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `${folderName}.zip`);
}
