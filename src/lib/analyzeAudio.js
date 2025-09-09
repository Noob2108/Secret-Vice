// src/lib/analyzeAudio.js
import Meyda from "meyda";

/**
 * Analyze audio for tempo, beat grid, and onset detection
 * @param {ArrayBuffer} arrayBuffer - Raw audio file buffer (from fetch or upload)
 * @returns {Promise<{tempo: number, beatGrid: number[], onsets: number[]}>}
 */
export async function analyzeAudio(arrayBuffer) {
  // Create Web Audio context
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  // Grab first channel
  const channelData = audioBuffer.getChannelData(0);

  // Meyda analyzer setup
  const bufferSize = 1024;
  const hopSize = 512;
  let rmsValues = [];
  let onsetTimes = [];

  // Step through audio frames
  for (let i = 0; i < channelData.length; i += hopSize) {
    const frame = channelData.slice(i, i + bufferSize);
    if (frame.length < bufferSize) break;

    const features = Meyda.extract(["rms"], frame);

    if (features && features.rms) {
      rmsValues.push(features.rms);

      // crude onset detection: sudden RMS spike
      if (
        rmsValues.length > 2 &&
        features.rms > rmsValues[rmsValues.length - 2] * 1.5
      ) {
        onsetTimes.push(i / audioCtx.sampleRate);
      }
    }
  }

  // Estimate tempo using autocorrelation of RMS
  const estimatedTempo = estimateTempo(rmsValues, audioCtx.sampleRate, hopSize);

  // Build beat grid (snap onsets to BPM grid)
  const beatInterval = 60 / estimatedTempo;
  let beatGrid = [];
  for (let t = 0; t < audioBuffer.duration; t += beatInterval) {
    beatGrid.push(t);
  }

  return {
    tempo: estimatedTempo,
    beatGrid,
    onsets: onsetTimes,
  };
}

// --- helper: crude tempo estimation ---
function estimateTempo(rms, sampleRate, hopSize) {
  // normalize
  const mean = rms.reduce((a, b) => a + b, 0) / rms.length;
  const normalized = rms.map((v) => v - mean);

  // autocorrelation
  let corr = new Array(normalized.length).fill(0);
  for (let lag = 0; lag < normalized.length; lag++) {
    for (let i = 0; i < normalized.length - lag; i++) {
      corr[lag] += normalized[i] * normalized[i + lag];
    }
  }

  // find peak after lag 0
  let peakLag = corr.indexOf(Math.max(...corr.slice(10, 5000)));
  let secondsPerBeat = (peakLag * hopSize) / sampleRate;
  return 60 / secondsPerBeat;
}
