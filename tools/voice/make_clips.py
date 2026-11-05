"""Record Comby's lines as audio clips with the Kokoro neural voice.

Each clip is saved as audio/voice/<fnv1a(text)>.m4a, where the hash is taken over the
exact line text (emoji included) as UTF-16 code units, matching voiceClipUrl() in
script.js. Lines without a clip fall back to the browser's built-in voice.

Usage (see README.md for setup):
    node tools/voice/extract_lines.mjs > /tmp/lines.json
    python make_clips.py <kokoro-models-dir> /tmp/lines.json [--voice am_echo] [--speed 1.0]
"""
import argparse
import json
import os
import re
import subprocess
import tempfile
import unicodedata

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro
from kokoro_onnx.tokenizer import Tokenizer

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "audio", "voice")

# "Comby" is said KOHM-bee (the model's own guess is "kum-BYE")
COMBY_PHONEMES = "kˈoʊmbi"
# "salon" is said sa-LOON (the model's default is sa-LAHN)
SALON_FROM, SALON_TO = "sɐlˈɑːn", "sɐlˈuːn"

# lines said slowly because they sound rushed at normal speed (the hairbrush look's demo call)
SLOWER = [re.compile(r"\bBook a demo\b")]
SLOWER_FACTOR = 0.72

# lines whose opening is said slowly and the rest at normal pace:
# "Book, know, run, grow." slowly, then "Step by step." like the other lines
SLOW_OPENING = re.compile(r"^(Book, know, run, grow\.)\s*(.+)$")
SENTENCE_GAP = 0.08  # seconds of silence between the two parts
# the part after the slow opening can have its own pace (default: normal)
REST_SPEED = {"Step by step.": 1.15}


def fnv1a(text):
    """32-bit FNV-1a over UTF-16 code units (same as JS string.charCodeAt)."""
    h = 0x811C9DC5
    data = text.encode("utf-16-le")
    for i in range(0, len(data), 2):
        h ^= data[i] | (data[i + 1] << 8)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return format(h, "08x")


def speakable(text):
    """What actually gets read out: no emoji, no filler "Hmm", and the brand read as a word."""
    kept = "".join(c for c in text if unicodedata.category(c) != "So" and c not in "\ufe0f\u200d")
    kept = re.sub(r"^\s*h+m+\W*", "", kept, flags=re.I)  # the bubble keeps "Hmm…", the voice skips it
    kept = kept[:1].upper() + kept[1:]
    return " ".join(kept.replace("…", "...").replace("COMB", "Comb").split())


def speed_for(text, base):
    return base * SLOWER_FACTOR if any(p.search(text) for p in SLOWER) else base


def phonemes(tok, text, lang):
    ph = tok.phonemize(speakable(text), lang)
    ph = re.sub(r"kəmbˈ?aɪ", COMBY_PHONEMES, ph)
    ph = ph.replace(SALON_FROM, SALON_TO)
    if re.search(r"\bsalon", text, re.I) and SALON_TO not in ph:
        raise ValueError(f"unexpected pronunciation of salon in: {ph}")
    if "kəmb" in ph:
        raise ValueError(f"unexpected pronunciation of Comby in: {ph}")
    return ph


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("models")
    ap.add_argument("lines")
    ap.add_argument("--voice", default="am_echo")
    ap.add_argument("--speed", type=float, default=1.0)
    ap.add_argument("--only", help="regex: re-record only matching lines")
    args = ap.parse_args()

    kokoro = Kokoro(os.path.join(args.models, "kokoro-v1.0.onnx"), os.path.join(args.models, "voices-v1.0.bin"))
    tok = Tokenizer()
    lang = "en-gb" if args.voice.startswith("b") else "en-us"
    os.makedirs(OUT_DIR, exist_ok=True)

    with open(args.lines, encoding="utf-8") as f:
        lines = json.load(f)

    def render(part, speed):
        return kokoro.create(phonemes(tok, part, lang), voice=args.voice, speed=speed, lang=lang, is_phonemes=True)

    for text in lines:
        if args.only and not re.search(args.only, text):
            continue
        split = SLOW_OPENING.match(text)
        if split:
            first, rate = render(split.group(1), args.speed * SLOWER_FACTOR)
            rest, _ = render(split.group(2), args.speed * REST_SPEED.get(split.group(2), 1.0))
            samples = np.concatenate([first, np.zeros(int(rate * SENTENCE_GAP), dtype=first.dtype), rest])
            speed = SLOWER_FACTOR  # for the log line: the opening's speed
        else:
            speed = speed_for(text, args.speed)
            samples, rate = render(text, speed)
        out = os.path.join(OUT_DIR, f"{fnv1a(text)}.m4a")
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            wav = tmp.name
        sf.write(wav, samples, rate)
        # 48 kbps mono AAC: clear speech in a few KB per second
        subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "48000", "-c", "1", wav, out], check=True)
        os.remove(wav)
        print(f"{os.path.basename(out)}  {os.path.getsize(out) // 1024:>3} KB  {len(samples) / rate:4.1f}s  x{speed:.2f}  {text}")


if __name__ == "__main__":
    main()
