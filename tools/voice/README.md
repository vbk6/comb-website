# Comby's voice clips

Comby's lines are pre-recorded with [Kokoro](https://github.com/thewh1teagle/kokoro-onnx)
(Apache-2.0), voice `am_echo`, and saved in `audio/voice/`. Each file is named after a
hash of the line's exact text, so editing a line in `script.js` without re-recording just
makes that line fall back to the browser's built-in voice.

## Re-recording (macOS)

Needs Python 3.10+ and Node.

```bash
python3.11 -m venv .venv && .venv/bin/pip install kokoro-onnx soundfile
mkdir -p models && cd models
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
cd ..

node tools/voice/extract_lines.mjs > /tmp/comby-lines.json
.venv/bin/python tools/voice/make_clips.py models /tmp/comby-lines.json --voice am_echo
```

Unused clips (from lines that were changed) can be deleted from `audio/voice/`.
