// Chess Review Sounds - content script
// Plays a user-chosen sound when the selected move in analysis/review has a given classification,
// or a game-end sound on the last move. The detection itself lives in lib/detect.js.
(() => {
  const { detect, makeKey } = ChessSoundsDetect;

  let settings = { enabled: true, volume: 0.8, maxSeconds: 4, debug: false };
  // Logging is off by default; the popup has a "Debug logging" switch for troubleshooting.
  const log = (...a) => { if (settings.debug) console.log('[ChessSounds]', ...a); };
  let sounds = {};
  let trims = {};
  let lastKey = '';
  let timer = null;
  let current = null;

  function loadSettings() {
    chrome.storage.local.get(['settings', 'sounds', 'trims'], (r) => {
      settings = { ...settings, ...(r.settings || {}) };
      sounds = r.sounds || {};
      trims = r.trims || {};
    });
  }
  loadSettings();
  chrome.storage.onChanged.addListener(loadSettings);

  // Only run on analysis / game review pages, never on live games.
  const isReviewPage = () => /\/analysis|\/review/.test(location.pathname);

  function play(type) {
    const src = sounds[type];
    if (!settings.enabled) { log('Skipped: extension is switched off in the popup'); return; }
    if (!src) { log('Skipped: no sound set for', type); return; }
    if (current) current.pause();
    const trim = trims[type] || {};
    const start = Number(trim.start) || 0;
    const length = Number(trim.length) > 0 ? Number(trim.length) : Number(settings.maxSeconds) || 0;
    const audio = new Audio(src);
    audio.volume = Math.min(1, Math.max(0, settings.volume));
    current = audio;
    audio.addEventListener('loadedmetadata', () => {
      if (start > 0 && start < audio.duration) audio.currentTime = start;
      audio.play().then(() => {
        if (length > 0) setTimeout(() => { if (current === audio) audio.pause(); }, length * 1000);
      }).catch((e) => log('Playback blocked:', e.message));
    }, { once: true });
    audio.addEventListener('error', () => log('Audio error for', type));
  }

  function tick() {
    if (!isReviewPage()) return;
    const found = detect(document);
    if (!found) return;
    // On the last move of the game a game-end sound (if you set one) replaces the move sound.
    const endSound = found.end && sounds[found.end];
    const key = makeKey(found, Boolean(endSound));
    if (key === lastKey) return;
    lastKey = key;
    if (found.unknown) log('Unknown classification name (tell the developer):', found.unknown);
    if (endSound) {
      log('Move', found.nodeKey, '->', found.end, '(game end)');
      play(found.end);
    } else if (found.type && found.source === 'board') {
      // The board badge can lag a moment behind the selection, so only play it once it
      // has stayed the same for a short while (avoids playing the previous move's badge).
      setTimeout(() => {
        const again = detect(document);
        if (!again || again.nodeKey !== found.nodeKey || again.type !== found.type) {
          log('Ignored a badge that changed right away:', found.nodeKey, found.type);
          return;
        }
        log('Move', found.nodeKey, '->', found.type, '(from board badge)');
        play(found.type);
      }, 150);
    } else if (found.type) {
      log('Move', found.nodeKey, '->', found.type, '(from ' + found.source + ')');
      play(found.type);
    } else {
      const style = found.sel ? (found.sel.getAttribute('style') || '(none)') : '';
      log('Move', found.nodeKey, '-> no classification found', found.source || '', 'style=' + style);
    }
  }

  // Throttle instead of debounce: the first mutation schedules a check, further
  // mutations do not postpone it, so constant page animations cannot starve it.
  const observer = new MutationObserver(() => {
    if (timer) return;
    timer = setTimeout(() => { timer = null; tick(); }, 80);
  });
  observer.observe(document.body, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'],
  });
  log('loaded on', location.pathname);
})();
