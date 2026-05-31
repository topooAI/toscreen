export function parseWavFile(arrayBuffer: ArrayBuffer) {
  try {
    const view = new DataView(arrayBuffer);
    if (view.byteLength < 44) return null;
    
    // Check RIFF and WAVE
    if (view.getUint32(0, false) !== 0x52494646) return null; 
    if (view.getUint32(8, false) !== 0x57415645) return null; 
    
    let offset = 12;
    let channels = 1;
    let sampleRate = 44100;
    let bitDepth = 16;
    let dataOffset = 0;
    let dataLength = 0;
    
    while (offset < view.byteLength) {
      const chunkId = view.getUint32(offset, false);
      const chunkSize = view.getUint32(offset + 4, true);
      
      if (chunkId === 0x666d7420) { // 'fmt '
        channels = view.getUint16(offset + 8 + 2, true);
        sampleRate = view.getUint32(offset + 8 + 4, true);
        bitDepth = view.getUint16(offset + 8 + 14, true);
      } else if (chunkId === 0x64617461) { // 'data'
        dataOffset = offset + 8;
        dataLength = chunkSize;
        break;
      }
      // If chunk is oddly sized or huge, break early if it goes out of bounds
      if (offset + 8 + chunkSize > view.byteLength) {
        break;
      }
      offset += 8 + chunkSize;
    }
    
    if (dataOffset === 0) return null;
    if (bitDepth !== 16) return null;
    
    const numSamples = Math.floor(dataLength / (channels * 2));
    const durationSec = numSamples / sampleRate;
    
    const samples = Math.max(32000, Math.floor(durationSec * 400));
    const blockSize = Math.floor(numSamples / samples);
    const newPeaks = new Array(samples).fill(0);
    
    for (let i = 0; i < samples; i++) {
      let max = 0;
      const start = i * blockSize;
      const end = Math.min(start + blockSize, numSamples);
      for (let j = start; j < end; j++) {
        for (let c = 0; c < channels; c++) {
          const byteOffset = dataOffset + (j * channels + c) * 2;
          if (byteOffset < view.byteLength - 1) {
            const val = Math.abs(view.getInt16(byteOffset, true)) / 32768;
            if (val > max) max = val;
          }
        }
      }
      newPeaks[i] = max;
    }
    
    // Normalize peaks so quiet audio is clearly visible
    let globalMax = 0;
    for (let i = 0; i < samples; i++) {
      if (newPeaks[i] > globalMax) globalMax = newPeaks[i];
    }
    if (globalMax > 0 && globalMax < 0.95) {
      const scale = 1.0 / globalMax;
      for (let i = 0; i < samples; i++) {
        newPeaks[i] = newPeaks[i] * scale;
      }
    }

    return {
      peaks: newPeaks,
      durationMs: durationSec * 1000
    };
  } catch (e) {
    return null;
  }
}
