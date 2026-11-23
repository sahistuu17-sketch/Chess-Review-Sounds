# Chess Review Sounds

Chromium extension (Chrome, Brave, Edge) that plays your own sounds for each move type
(Brilliant, Great, Mistake, Blunder, ...) while you review games on chess.com.
It only runs on analysis/review pages, never during live games.

## Features
- One sound per move type: pick a built-in one or load your own file (stored locally, nothing is uploaded)
- 26 built-in sounds, two per slot, plus a "Load defaults" button
- Game-end sounds that play on the last move of a review: checkmate, draw, and resignation/timeout
- Per-sound start offset and length (trim the drop of a song)
- Volume, on/off, default max length, reset-all button
- Detects moves from the move list and from the badge drawn on the board, so all ten types are covered
- Export / import sound packs as JSON
- Language-independent detection (reads chess.com's classification CSS variable, not the UI text)

## Install (developer mode)
1. Open `chrome://extensions` (or `brave://extensions`) and enable Developer mode
2. Load unpacked, select this folder
3. Open the popup, click **Load defaults** (or pick sounds yourself), then open a game review on chess.com

## Built-in sounds
All 26 files in `sounds/` are synthesized from scratch by `tools/generate_sounds.py`
(oscillators, noise and envelopes only), so they are original and free of third-party copyright.
Regenerate them with `python3 tools/generate_sounds.py` (needs numpy, scipy and ffmpeg).

## Where to find more sounds
Pick sounds you are allowed to use. Licenses differ per site and per file, so check the page of each sound.

| Source | Notes |
|---|---|
| [Freesound](https://freesound.org) | Filter by license **Creative Commons 0** for sounds you can freely reuse and share. Needs a free account. |
| [Kenney](https://kenney.nl/assets?q=audio) and [OpenGameArt](https://opengameart.org) | Game sound packs, many CC0. |
| [Pixabay Sound Effects](https://pixabay.com/sound-effects/) | Free to use, no attribution required. Read the license before redistributing files inside a pack. |
| [Mixkit](https://mixkit.co/free-sound-effects/) | Fine for personal use. The license does not allow redistributing the files on their own or inside a tool, so do not bundle them. |
| [MyInstants](https://www.myinstants.com) | Large meme-sound library. Rights are unclear, so keep these for personal use on your own machine. |

### Making your own clips
- **Trim a file you have:** open it in [Audacity](https://www.audacityteam.org), or use ffmpeg:
  `ffmpeg -i video.mp4 -vn -ss 00:00:12 -t 3 clip.mp3` (start at 12 s, keep 3 s).
- **Record what plays on your PC** (personal use): in Audacity set the audio host to *Windows WASAPI*,
  choose your speakers' loopback device as input, press Record while the video plays, then trim and export.
- Keep personal clips out of the repo. The `my-sounds/` folder is already in `.gitignore`.
- Copyrighted clips are fine for your own use, but do not publish them in a pack or in the Chrome Web Store package.

## Tip
If chess.com's own move sounds overlap with yours, turn them off in chess.com's sound settings or mute the tab (right-click the tab, Mute site).

## Game-end sounds
On the last move of a game the extension can play one of three sounds instead of the move sound:
- **Checkmate**: the last move ends with `#`.
- **Draw**: the result reads 1/2-1/2. Stalemate, agreement and repetition look the same on the page, so they share one slot.
- **Resign / timeout**: a decisive result without mate. Resignation, timeout and abandonment look the same on the page, so they share one slot.

If a game-end slot is empty, the normal move sound plays on the last move.

## Troubleshooting
Switch on **Debug logging** in the popup, open the browser console (F12) and filter by `ChessSounds`.
Each move you step onto prints the detected type, for example `Move 0-27 -> blunder (from style)`.

## Privacy
Everything stays on your device. See [PRIVACY.md](PRIVACY.md).

## Disclaimer
Independent project, not affiliated with or endorsed by Chess.com.

## Roadmap
- [x] Built-in sounds and selector
- [x] Icons, license, privacy policy, store listing draft
- [x] Checkmate / draw / resign-or-timeout sounds
- [ ] Tell stalemate, resignation and timeout apart (the review page does not expose the reason)
- [ ] TypeScript + React popup, tests for the detection logic
- [ ] Chrome Web Store release


## Development

```bash
npm install
npm test           # unit tests for the detection logic (jsdom, fixtures built from real chess.com DOM)
npm run package    # clean zip for the Chrome Web Store in dist/
```

Structure: `lib/detect.js` holds the pure detection logic (shared by the extension and the tests), `content.js` handles playback, `popup.*` is the settings UI, `tools/` has the sound and icon generators and the packaging script. CI runs the tests and the packaging on every push.
