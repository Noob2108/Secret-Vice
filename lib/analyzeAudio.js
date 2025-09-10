// lib/analyzeAudio.js
import Meyda from "meyda";

export async function analyzeAudioFromFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  const ch = audioBuffer.getChannelData(0);

  const BUF = 1024, HOP = 512;
  const sr = audioCtx.sampleRate;

  const rms = [], flux = [];
  let prevSpec = null, onsetTimes = [];

  for (let i = 0; i + BUF <= ch.length; i += HOP) {
    const frame = ch.subarray(i, i + BUF);
    const f = Meyda.extract(["rms", "amplitudeSpectrum"], frame);
    if (!f) continue;
    rms.push(f.rms);

    let curFlux = 0;
    if (prevSpec) {
      const len = Math.min(prevSpec.length, f.amplitudeSpectrum.length);
      for (let k = 0; k < len; k++) {
        const d = f.amplitudeSpectrum[k] - prevSpec[k];
        if (d > 0) curFlux += d;
      }
    }
    flux.push(curFlux);
    prevSpec = f.amplitudeSpectrum;

    if (flux.length > 30) {
      const recent = flux.slice(-30);
      const med = median(recent);
      const thr = med * 2.0;
      if (curFlux > thr) onsetTimes.push(i / sr);
    }
  }

  const bpm = clamp(estimateTempo(rms, sr, HOP), 60, 200);
  const beatSec = 60 / bpm;
  const duration = audioBuffer.duration;

  const beatGrid = [];
  for (let t = 0; t <= duration + 1e-6; t += beatSec) beatGrid.push(t);

  // per-beat intensity from flux around each beat
  const fluxTimes = Array.from({ length: flux.length }, (_, n) => (n * HOP) / sr);
  const beatFeatures = beatGrid.map((t, i) => {
    // look ±50ms window
    const w = 0.05;
    let sum = 0, ct = 0;
    // simple linear scan; fine for MVP
    for (let j = 0; j < flux.length; j++) {
      const tj = fluxTimes[j];
      if (tj < t - w) continue;
      if (tj > t + w) break;
      sum += flux[j]; ct++;
    }
    const val = ct ? sum / ct : 0;
    return { index: i, timeSec: t, flux: val };
  });

  // bucket by percentiles
  const vals = beatFeatures.map(b => b.flux);
  const p60 = quantile(vals, 0.6);
  const p85 = quantile(vals, 0.85);
  beatFeatures.forEach(b => {
    b.bucket = b.flux >= p85 ? "loud" : b.flux >= p60 ? "mid" : "quiet";
    b.downbeat = (b.index % 4) === 0; // 4/4 assumption for MVP
  });

  return {
    meta: { title: file.name.replace(/\.[^.]+$/, ""), duration },
    tempo: Math.round(bpm * 10) / 10,
    beatGrid,
    onsets: dedupe(onsetTimes, 0.08),
    beatFeatures
  };
}

function estimateTempo(rms, sr, hop) {
  if (!rms.length) return 120;
  const mean = rms.reduce((a,b)=>a+b,0)/rms.length;
  const x = rms.map(v=>v-mean);
  let best=-Infinity, lagBest=0, maxLag=Math.min(2000, x.length-1);
  for (let lag=20; lag<maxLag; lag++){
    let s=0; for (let i=0;i+lag<x.length;i++) s+=x[i]*x[i+lag];
    if (s>best){best=s;lagBest=lag;}
  }
  const spb = (lagBest*hop)/sr;
  return 60/(spb||0.5);
}

const median = a => { const s=[...a].sort((p,q)=>p-q); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; };
const quantile = (a, q) => { const s=[...a].sort((p,q)=>p-q); const pos=(s.length-1)*q; const lo=Math.floor(pos), hi=Math.ceil(pos); if (lo===hi) return s[lo]; return s[lo]+(s[hi]-s[lo])*(pos-lo); };
const dedupe = (times,w) => times.filter((t,i,arr)=> i===0 || t-arr[i-1]>w);
const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));

