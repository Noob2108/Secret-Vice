import Meyda from "meyda";

export async function analyzeAudioFromFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  const channelData = audioBuffer.getChannelData(0);

  const bufferSize = 1024, hopSize = 512;
  const rms = [], flux = [], onsetTimes = [];
  let prevSpectrum = null;

  for (let i = 0; i + bufferSize <= channelData.length; i += hopSize) {
    const frame = channelData.subarray(i, i + bufferSize);
    const f = Meyda.extract(["rms", "amplitudeSpectrum"], frame);
    if (!f) continue;
    rms.push(f.rms);

    if (prevSpectrum) {
      let sum = 0, len = Math.min(prevSpectrum.length, f.amplitudeSpectrum.length);
      for (let k = 0; k < len; k++) {
        const diff = f.amplitudeSpectrum[k] - prevSpectrum[k];
        if (diff > 0) sum += diff;
      }
      flux.push(sum);
    } else {
      flux.push(0);
    }
    prevSpectrum = f.amplitudeSpectrum;

    if (flux.length > 30) {
      const recent = flux.slice(-30);
      const m = median(recent);
      const thr = m * 2.0;
      if (flux[flux.length - 1] > thr) onsetTimes.push(i / audioCtx.sampleRate);
    }
  }

  const bpm = clamp(estimateTempo(rms, audioCtx.sampleRate, hopSize), 60, 200);
  const beatInterval = 60 / bpm;
  const beatGrid = [];
  for (let t = 0; t <= audioBuffer.duration; t += beatInterval) beatGrid.push(t);

  return {
    meta: { title: file.name.replace(/\.[^.]+$/, ""), duration: audioBuffer.duration },
    tempo: Math.round(bpm * 10) / 10,
    beatGrid,
    onsets: dedupe(onsetTimes, 0.08),
  };
}

function estimateTempo(rms, sampleRate, hop) {
  if (!rms.length) return 120;
  const mean = rms.reduce((a,b)=>a+b,0)/rms.length;
  const x = rms.map(v=>v-mean);
  let bestLag = 0, best = -Infinity, maxLag = Math.min(2000, x.length-1);
  for (let lag=20; lag<maxLag; lag++){
    let s = 0;
    for (let i=0; i+lag<x.length; i++) s += x[i]*x[i+lag];
    if (s>best){best=s;bestLag=lag;}
  }
  const spb = (bestLag*hop)/sampleRate;
  return 60/(spb||0.5);
}

const median = a => { const s=[...a].sort((p,q)=>p-q); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; };
const dedupe = (times,w) => times.filter((t,i,arr)=> i===0 || t-arr[i-1]>w);
const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
