// lib/exportZip.js
// Secret Vice — export with correct folder naming + info.dat metadata

import JSZip from "jszip";
import { saveAs } from "file-saver";

// Keep characters Beat Saber and Windows/macOS zip are happy with.
// Allow letters, numbers, spaces, - _ ( ) & . '
// Replace others with space and trim.
function sanitize(str = "") {
  return String(str)
    .replace(/[^a-zA-Z0-9 \-\_\(\)\&\.\']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Try to infer { artist, title } from a few common filename/title shapes:
//  - "Artist - Title"
//  - "Artist – Title" (en dash)
//  - otherwise: title only
function splitArtistTitle(raw) {
  const s = String(raw);
  const dash = s.split(/\s-\s| \u2013 /); // hyphen or en dash with spaces
  if (dash.length >= 2) return { artist: dash[0], title: dash.slice(1).join(" - ") };
  return { artist: "", title: s };
}

// Use metadata first, then filename; keep the actual uploaded filename for _songFilename
function deriveMeta(analysisMeta, uploadFile) {
  const uploadName = uploadFile?.name || "song.ogg";
  const extMatch = uploadName.match(/\.[^.]+$/);
  const ext = extMatch ? extMatch[0] : ".ogg";

  // Prefer the analyzer title if present
  const metaTitle = analysisMeta?.title && analysisMeta.title.toString().trim()
    ? analysisMeta.title.toString().trim()
    : uploadName.replace(/\.[^.]+$/, "");

  // Try to split into artist + title
  const { artist, title } = splitArtistTitle(metaTitle);

  // Build Beat Saber-facing strings (sanitized)
  const safeArtist = sanitize(artist);
  const safeTitle  = sanitize(title);

  // Folder name convention: "Artist - Title (Secret Vice)" or "Title (Secret Vice)"
  const folder = (safeArtist ? `${safeArtist} - ${safeTitle}` : safeTitle) + " (Secret Vice)";

  return {
    artist: safeArtist,
    title: safeTitle,
    folderName: folder,
    songFilename: uploadName, // keep original (e.g., "Dazed Confused (feat. Rittz).ogg")
    coverFilename: "cover.png",
  };
}

export async function exportZip(file, bpm, map, rawTitleFromAnalysis) {
  const zip = new JSZip();

  // Derive meta from analysis + file
  const meta = deriveMeta({ title: rawTitleFromAnalysis }, file);

  // ---- info.dat (v2.0.0) ----
  // Leave _songAuthorName empty unless we truly know it; inferred artist goes into folder and _songName.
  const info = {
    "_version": "2.0.0",
    "_songName": meta.title,
    "_songAuthorName": meta.artist,               // keep blank unless you want to set meta.artist here
    "_levelAuthorName": "Secret Vice",
    "_beatsPerMinute": Math.round((bpm || 120) * 1000) / 1000,
    "_songFilename": meta.songFilename,  // preserve actual uploaded filename
    "_coverImageFilename": meta.coverFilename,
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

  // ---- Add files to zip root folder ----
  const folder = zip.folder(meta.folderName);

  // info.dat
  folder.file("info.dat", JSON.stringify(info, null, 2));

  // difficulty map (our generator already builds v3+ objects, which is fine)
  folder.file("HardStandard.dat", JSON.stringify(map, null, 2));

  // audio: just copy the uploaded file bytes in
  const arrayBuffer = await file.arrayBuffer();
  folder.file(meta.songFilename, arrayBuffer);

  // cover image: if you already generate one elsewhere, drop that here instead.
  // For now, embed a tiny 1x1 transparent PNG as a placeholder to satisfy loaders.
  // (Replace later with your real cover art.)
  const tinyTransparentPng =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
  folder.file(meta.coverFilename, Uint8Array.from(atob(tinyTransparentPng), c => c.charCodeAt(0)));

  // ---- Generate zip and download ----
  const blob = await zip.generateAsync({ type: "blob" });
  const zipName = `${meta.folderName}.zip`;
  saveAs(blob, zipName);
}
