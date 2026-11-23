// Chess Review Sounds - content script
// Plays a user-chosen sound when the selected move in analysis/review has a given classification.
(() => {
  const TYPES = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder'];
  const ALIASES = { greatfind: 'great', bestmove: 'best' };
  const DEBUG = true; // set to false once everything works
  const log = (...a) => DEBUG && console.log('[ChessSounds]', ...a);

  let settings = { enabled: true, volume: 0.8, maxSeconds: 4 };
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

  const normalize = (raw) => {
    const t = String(raw || '').toLowerCase().replace(/[^a-z]/g, '');
    return ALIASES[t] || t;
  };

  // Reads the classification of the currently selected move in the move list.
  // Returns { type, key } where type may be null for unclassified moves.
  function detect() {
    const sel = document.querySelector('.node-highlight-content.selected');
    if (!sel) return null;
    const node = sel.closest('[data-node]');
    const key = node ? node.getAttribute('data-node') : sel.textContent.trim();

    // 1) inline style: color: var(--color-classification-brilliant)
    let raw = null;
    const m = /--color-classification-([a-z-]+)/i.exec(sel.getAttribute('style') || '');
    if (m) raw = m[1];

    // 2) fallback: annotation icon <g id="Brilliant">
    if (!raw && node) {
      const g = node.querySelector('.node-annotation-icon g[id]');
      if (g) raw = g.id;
    }

    const type = normalize(raw);
    if (raw && !TYPES.includes(type)) {
      log('Unknown classification name (tell the developer):', raw);
      return { type: null, key };
    }
    return { type: raw ? type : null, key };
  }

  function play(type) {
    const src = sounds[type];
    if (!settings.enabled || !src) return;
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
  }

  function tick() {
    if (!isReviewPage()) return;
    const found = detect();
    if (!found || found.key === lastKey) return;
    lastKey = found.key; // also updated for unclassified moves, so returning to a move replays it
    log('Move', found.key, '->', found.type || 'no classification');
    if (found.type) play(found.type);
  }

  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(tick, 100); // debounce
  });
  observer.observe(document.body, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['class'],
  });
  log('loaded on', location.pathname);
})();
