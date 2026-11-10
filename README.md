# Quran Reciter

A lightweight single-page audio player for your own Quran recitation MP3 files. Built with vanilla HTML, CSS, and JavaScript; compatible with GitHub Pages. No backend, build process, user account, or browser storage.

## Add your recordings

Copy your MP3 files into `audio/` using three-digit Surah numbers as filenames: `001.mp3`, `002.mp3`, ..., `114.mp3`. The numbering follows the standard Quran order (`001` is Al-Fatihah; `114` is An-Nas). You can start with any four or five Surahs, and they do not have to be consecutive.

From the repository root, run:

```bash
python3 scripts/update_audio_manifest.py
```

This scans the `audio/` folder and writes `audio-files.json` containing the Surah numbers that actually have recordings. Run it again any time you add or remove an MP3 file. Only these recordings appear in the player list.

The `surahs.json` file already includes the names of all 114 Surahs. Do not edit it when you add an MP3. `audio-files.json` is automatically generated and can be committed with the audio files.

## Run locally on your Mac

```bash
cd /path/to/quran-reciter
python3 scripts/update_audio_manifest.py
python3 scripts/dev_server.py 8000
```

Visit `http://localhost:8000` on your Mac.

For an iPhone on the same Wi-Fi, find your Mac's IP:

```bash
ipconfig getifaddr en0
```

In iPhone Safari, open `http://YOUR_MAC_IP:8000` (for example, `http://192.168.1.105:8000`). macOS firewall and Wi-Fi client isolation can block access. The included local server supports HTTP byte ranges, which browsers need to seek into long audio files. Use it rather than opening `index.html` as a `file://` URL, because the app fetches JSON files.

## Playback controls

- Search the available recordings instantly by number (`114`) or name (`An-Nas`).
- Tap the play button on any Surah row to play it. Tap it again to pause.
- Main controls: play/pause, 5 seconds backward, 5 seconds forward, and progress seeking.
- Default: play Surahs in numerical order and wrap around continuously.
- **Repeat:** loop the current Surah indefinitely. Uses `audio.loop` to avoid swapping files between repeats.
- **Shuffle:** immediately choose a random Surah, then choose another random Surah at the end of each track, excluding the current one when possible. Continues indefinitely.
- Repeat and shuffle are mutually exclusive. Tap an active mode to return to sequential playback.
- Playback uses a single native HTML `<audio>` element and the Media Session API when available for lock-screen controls.

## Important iPhone behavior

A recording generally continues while iPhone is locked if playback began with a user tap. Advancing to the **next MP3 while locked** depends on iOS and the browser: the JavaScript `ended` handler may be delayed, suspended, or blocked from starting the new file. This cannot be guaranteed in a static web application. Test with two short recordings on your specific iPhone and Safari version. Repeat is more reliable than next-track autoplay because it loops the *same* audio source without switching files. For the best iPhone experience, test in Safari; third-party browsers may handle audio differently.

The site **streams the selected MP3**; it does not intentionally download all 114 files on page load. A network connection is required when hosted on GitHub Pages. There is no offline service worker.

## Deploy on GitHub Pages

1. Commit and push the website files, generated `audio-files.json`, and the MP3s in `audio/` to your repository.
2. In GitHub, go to **Settings → Pages → Build and deployment**.
3. Choose **Deploy from a branch**, select `main` and `/(root)`, and save.
4. Open `https://YOUR_USERNAME.github.io/quran-reciter/` (replace username and repo name as appropriate).
5. On iPhone in Safari, Share → **Add to Home Screen** to create a shortcut.

All application asset URLs are relative to the repository path.

### Audio size guidance

GitHub Pages has a published site limit of 1 GB, a recommended source repository limit of 1 GB, and a soft bandwidth limit of 100 GB/month. Standard GitHub uploads reject individual files above 100 MiB. A 600 MB collection may fit, but verify each large Surah MP3 and your final repository size. Avoid frequent replacement of large MP3s, because Git history retains older versions.

## File overview

- `index.html`: mobile-first single-page UI.
- `style.css`: responsive appearance.
- `app.js`: player, filtering, shuffle, repeat, seeking, lock-screen metadata.
- `surahs.json`: 114 Surah names in Quran order.
- `audio-files.json`: generated manifest of MP3 numbers present in `audio/`.
- `scripts/update_audio_manifest.py`: dependency-free manifest generator.
- `audio/`: your MP3 files (empty in the starter download).

## Limitations

- You must own/have permission to distribute the recordings before publishing them in a public repository.
- Cross-file auto-advance while an iPhone is locked is best-effort; OS policies may prevent it.
- No persisted playback position, offline playback, or downloads.
