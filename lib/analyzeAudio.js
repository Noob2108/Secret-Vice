// lib/analyzeAudio.js
import Meyda from "meyda";

/**
 * Client-side analysis: decode audio, estimate tempo, make beat grid, detect onsets.
 * Returns seconds-based times; mapping will convert to beats.
 */
export async function analyzeAudioFromFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  const channelData = audioBuffer.getChannelData(0);

  const bufferSize = 1024;
  const hopSize = 512;

  const rms = [];
  const flux = [];
  const onsetTimes = [];

  // compute RMS + crude spectral flux
  let prevSpectrum = null;
  for (let i = 0; i + bufferSize <= channelData.length; i += hopSize) {
    const frame = channelData.subarray(i, i + bufferSize);
    const f = Meyda.extract(["rms", "amplitudeSpectrum"], frame);
    if (!f) continue;
    rms.push(f.rms);

    if (prevSpectrum) {
      let sum = 0;
      const len = Math.min(prevSpectrum.length, f.amplitudeSpectrum.length);
      for (let k = 0; k < len; k++) {
        const diff = f.amplitudeSpectrum[k] - prevSpectrum[k];
        if (diff > 0) sum += diff;
      }
      flux.push(sum);
    } else {
      flux.push(0);
    }
    prevSpectrum = f.amplitudeSpectrum;

    // onset: rising flux vs rolling median
    if (flux.length > 30) {
      const recent = flux.slice(-30);
      const m = median(recent);
      const thr = m * 2.0; // tweakable
      if (flux[flux.length - 1] > thr) {
        onsetTimes.push(i / audioCtx.sampleRate);
      }
    }
  }

  const estTempo = estimateTempo(rms, audioCtx.sampleRate, hopSize);
  const beatInterval = 60 / Math.max(60, Math.min(200, estTempo || 120));
  const duration = audioBuffer.duration;

  const beatGrid = [];
  for (let t = 0; t <= duration; t += beatInterval) beatGrid.push(t);

  return {
    meta: { title: file.name.replace(/\.[^.]+$/, ""), duration },
    tempo: Math.round((60 / beatInterval) * 10) / 10,
    beatGrid,
    onsets: dedupeOnsets(onsetTimes, 0.08) // collapse near-duplicates
  };
}

function estimateTempo(rms, sampleRate, hop) {
  if (!rms.length) return 120;
  const mean = rms.reduce((a, b) => a + b, 0) / rms.length;
  const x = rms.map(v => v - mean);

  const maxLag = Math.min(2000, x.length - 1);
  let bestLag = 0, best = -Infinity;
  for (let lag = 20; lag < maxLag; lag++) {
    let s = 0;
    for (let i = 0; i + lag < x.length; i++) s += x[i] * x[i + lag];
    if (s > best) { best = s; bestLag = lag; }
  }
  const secondsPerHop = hop / sampleRate;
  const spb = bestLag * secondsPerHop;
  const bpm = 60 / (spb || 0.5);
  return Math.max(60, Math.min(200, bpm)); // clamp
}

function median(arr) {
  const a = [...arr].sort((p, q) => p - q);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

function dedupeOnsets(times, windowSec) {
  const out = [];
  for (const t of times) {
    if (!out.length || t - out[out.length - 1] > windowSec) out.push(t);
  }
  return out;
}
