# Chess Review Sounds

Chrome/Brave extension that plays your own sounds for each move type (Brilliant, Mistake, Blunder, ...)
while you review games on chess.com. Only runs on analysis/review pages, never during live games.

## Features
- One sound per move type, chosen from your own files (stored locally, nothing is uploaded)
- Per-sound start offset and length (trim the drop of a song)
- Volume, on/off, default max length
- Export / import sound packs as JSON
- Language-independent detection (reads chess.com's classification CSS variable, not the UI text)

## Install (developer mode)
1. Open `chrome://extensions` (or `brave://extensions`) and enable Developer mode
2. Load unpacked, select this folder
3. Open the popup, pick sounds, then open a game review on chess.com

## Roadmap
- [ ] Checkmate / draw / resignation sounds
- [ ] TypeScript + React popup, tests for the detection logic
- [ ] Built-in royalty-free default pack
- [ ] Chrome Web Store release

## Tip
If chess.com's own move sounds overlap with yours, turn them off in chess.com's sound settings or mute the tab (right-click the tab, Mute site).
