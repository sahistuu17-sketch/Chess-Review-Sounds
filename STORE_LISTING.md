# Chrome Web Store listing (draft)

Copy these texts into the Chrome Web Store developer dashboard.

## Name
Chess Review Sounds

## Short description (max 132 characters)
Play your own sounds for Brilliant, Blunder and every other move type while reviewing games on chess.com.

## Category
Fun (or Productivity)

## Detailed description
Turn game review on chess.com into something you can hear.

Pick a sound for every move type (Brilliant, Great, Best, Excellent, Good, Book, Inaccuracy, Mistake,
Miss, Blunder) and hear it the moment you step onto that move in a review or analysis.

FEATURES
• One sound per move type: choose one of the 26 built-in sounds or load your own audio file
• Game-end sounds on the last move: checkmate, draw, and resignation/timeout
• Trim each sound (start and length) so only the best part plays
• Volume control and a global on/off switch
• Export and import sound packs to share your setup or move it to another browser
• Works only on analysis and review pages, never during live games
• Works in any language of the chess.com interface
• Private by design: your sounds stay on your device, nothing is uploaded, no tracking

HOW IT WORKS
Open the extension, click "Load defaults" (or choose your own files), then open a game review on
chess.com. If chess.com's own move sounds overlap with yours, switch them off in chess.com's sound
settings or mute the tab.

Open source: https://github.com/sahistuu17-sketch/Chess-Review-Sounds

Chess Review Sounds is an independent project and is not affiliated with or endorsed by Chess.com.

## Single purpose
Play user-selected sounds on chess.com analysis and review pages when the selected move has a given classification.

## Permission justifications
- **storage**: saves the user's chosen sounds and settings in the browser.
- **unlimitedStorage**: user-selected audio files can exceed the default 10 MB extension storage quota.
- **Host access (chess.com)**: the content script reads the classification of the selected move on review pages. It does not read or send any other data.

## Data usage disclosures (dashboard form)
- Does not collect or use any user data.
- Does not use remote code.
- Privacy policy URL: https://github.com/sahistuu17-sketch/Chess-Review-Sounds/blob/main/PRIVACY.md

## Graphics to prepare
- Store icon 128x128: `icons/icon128.png`
- At least 1 screenshot, 1280x800 (popup next to a game review). Up to 5 are allowed.
- Small promo tile 440x280 (optional but recommended)
