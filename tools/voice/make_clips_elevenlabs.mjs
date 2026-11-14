// Record Comby's lines with an ElevenLabs voice (default: "Liam").
//
// Each clip is saved as audio/voice/<fnv1a(text)>.m4a, where the hash is taken over
// the exact line text (emoji included), matching voiceClipUrl() in script.js. Lines
// without a clip fall back to the browser's built-in voice.
//
// Usage (macOS, needs Node 18+ and an ElevenLabs API key):
//   node tools/voice/extract_lines.mjs > /tmp/comby-lines.json
//   ELEVENLABS_API_KEY=... node tools/voice/make_clips_elevenlabs.mjs /tmp/comby-lines.json [--voice <id>] [--only <regex>] [--missing]
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const LIAM = 'TX3LPaxmHKxFdv7VOQHJ'; // "Liam", an ElevenLabs premade voice
const OUT_DIR = new URL('../../audio/voice/', import.meta.url).pathname;

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const linesFile = args.find((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--'));
const voice = opt('--voice') || LIAM;
const only = opt('--only') ? new RegExp(opt('--only')) : null;
const missingOnly = args.includes('--missing'); // skip lines that already have a clip
const key = process.env.ELEVENLABS_API_KEY;
if (!linesFile || !key) {
  console.error('usage: ELEVENLABS_API_KEY=... node make_clips_elevenlabs.mjs <lines.json> [--voice <id>] [--only <regex>] [--missing]');
  process.exit(1);
}

// 32-bit FNV-1a over UTF-16 code units, same as script.js
function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// What actually gets read out: no emoji, no filler "Hmm", and the brand read as a word
function speakable(text) {
  let t = text.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '');
  t = t.replace(/^\s*h+m+\W*/i, ''); // the bubble keeps "Hmm…", the voice skips it
  t = t.charAt(0).toUpperCase() + t.slice(1);
  return t.replace(/COMB/g, 'Comb').replace(/\s+/g, ' ').trim();
}

mkdirSync(OUT_DIR, { recursive: true });
const lines = JSON.parse(readFileSync(linesFile, 'utf8'));
for (const text of lines) {
  if (only && !only.test(text)) continue;
  if (missingOnly && existsSync(join(OUT_DIR, `${fnv1a(text)}.m4a`))) continue;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: speakable(text),
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true },
    }),
  });
  if (!res.ok) {
    console.error(`failed (${res.status}): ${text}\n${await res.text()}`);
    process.exit(1);
  }
  const mp3 = join(tmpdir(), `comby-${fnv1a(text)}.mp3`);
  writeFileSync(mp3, Buffer.from(await res.arrayBuffer()));
  const out = join(OUT_DIR, `${fnv1a(text)}.m4a`);
  // 48 kbps mono AAC: clear speech in a few KB per second
  execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '48000', '-c', '1', mp3, out]);
  unlinkSync(mp3);
  console.log(`${fnv1a(text)}.m4a  ${String(Math.round(statSync(out).size / 1024)).padStart(3)} KB  ${text}`);
}
