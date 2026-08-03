import fs from 'node:fs'
import path from 'node:path'

const output = path.join(process.cwd(), 'public', 'music')
fs.mkdirSync(output, { recursive: true })
const tracks = [
  { file: 'calm-pulse.wav', bpm: 84, notes: [220, 277.18, 329.63, 277.18] },
  { file: 'bright-steps.wav', bpm: 112, notes: [261.63, 329.63, 392, 523.25] },
]
for (const track of tracks) {
  const rate = 44100, seconds = 12, samples = rate * seconds
  const data = Buffer.alloc(samples * 2)
  for (let i = 0; i < samples; i++) {
    const beat = Math.floor(i / rate / (60 / track.bpm))
    const frequency = track.notes[beat % track.notes.length]
    const envelope = Math.min(1, (i % Math.floor(rate * 60 / track.bpm)) / 1200) * .18
    const value = Math.sin(2 * Math.PI * frequency * i / rate) * envelope + Math.sin(2 * Math.PI * frequency / 2 * i / rate) * .06
    data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(value * 32767))), i * 2)
  }
  const header = Buffer.alloc(44)
  header.write('RIFF'); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8); header.write('fmt ', 12)
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(rate, 24)
  header.writeUInt32LE(rate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(data.length, 40)
  fs.writeFileSync(path.join(output, track.file), Buffer.concat([header, data]))
}
