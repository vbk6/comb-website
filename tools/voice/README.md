# Comby's voice clips

Comby's lines are pre-recorded with [ElevenLabs](https://elevenlabs.io), premade voice
**Liam**, and saved in `audio/voice/`. Each file is named after a
hash of the line's exact text, so editing a line in `script.js` without re-recording just
makes that line fall back to the browser's built-in voice.

## Re-recording (macOS)

Needs Node 18+ and an ElevenLabs API key (elevenlabs.io → Developers → API Keys).
Keep the key in your shell environment; never commit it.

```bash
node tools/voice/extract_lines.mjs > /tmp/comby-lines.json
ELEVENLABS_API_KEY=... node tools/voice/make_clips_elevenlabs.mjs /tmp/comby-lines.json
```

Options: `--missing` records only lines that don't have a clip yet; `--only "<regex>"`
re-records just the matching lines; `--voice <id>` uses a different ElevenLabs voice.

Unused clips (from lines that were changed) can be deleted from `audio/voice/`.

## Older recordings

The first set of clips was made with [Kokoro](https://github.com/thewh1teagle/kokoro-onnx)
(Apache-2.0), voice `am_echo`, using `make_clips.py`. That script still works if you want to
go back to an offline voice:

```bash
python3.11 -m venv .venv && .venv/bin/pip install kokoro-onnx soundfile
mkdir -p models && cd models
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
cd ..
.venv/bin/python tools/voice/make_clips.py models /tmp/comby-lines.json --voice am_echo
```
