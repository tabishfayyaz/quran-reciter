#!/usr/bin/env python3
"""Regenerate audio-files.json from numbered MP3s in audio/. No dependencies."""
from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]
audio_dir = root / "audio"
audio_dir.mkdir(exist_ok=True)

available = []
for path in audio_dir.iterdir():
    if not path.is_file() or path.suffix.lower() != ".mp3":
        continue
    if not path.stem.isascii() or not path.stem.isdecimal():
        print(f"Ignoring unsupported filename: {path.name} (use 1.mp3 ... 114.mp3)")
        continue
    number = int(path.stem)
    if not 1 <= number <= 114:
        print(f"Ignoring invalid filename: {path.name} (use 1.mp3 ... 114.mp3)")
        continue
    available.append(number)

available = sorted(set(available))
(root / "audio-files.json").write_text(json.dumps(available, indent=2) + "\n", encoding="utf-8")
print(f"Updated audio-files.json: {len(available)} recording(s) found")
if available:
    print("Surahs:", ", ".join(str(n) for n in available))
