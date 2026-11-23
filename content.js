// Chess Review Sounds - content script
// Plays a user-chosen sound when the selected move in analysis/review has a given classification.
(() => {
  const TYPES = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder'];
  const ALIASES = { greatfind: 'great', bestmove: 'best' };
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

  const normalize = (raw) => {
    const t = String(raw || '').toLowerCase().replace(/[^a-z]/g, '');
    return ALIASES[t] || t;
  };

  // Reads the classification of the currently selected move in the move list.
  // Returns { node, type, why } where type is null for unclassified moves.
  function detect() {
    // Prefer the selected move inside the move list (it has a data-node ancestor).
    const sel = document.querySelector('[data-node] .node-highlight-content.selected')
      || document.querySelector('.node-highlight-content.selected');
    if (!sel) return null;
    const node = sel.closest('[data-node]');
    const nodeKey = node ? node.getAttribute('data-node') : sel.textContent.trim();

    // 1) inline style: color: var(--color-classification-brilliant)
    let raw = null;
    let source = '';
    const m = /--color-classification-([a-z-]+)/i.exec(sel.getAttribute('style') || '');
    if (m) { raw = m[1]; source = 'style'; }

    // 2) fallback: annotation icon <g id="Brilliant">
    if (!raw && node) {
      const g = node.querySelector('.node-annotation-icon g[id]');
      if (g) { raw = g.id; source = 'icon'; }
    }

    // 3) the badge drawn on the destination square of the board: <svg><g id="best">
    //    (chess.com only colours a few classifications in the move list, but badges every move)
    if (!raw) {
      for (const g of document.querySelectorAll('svg g[id]')) {
        if (g.closest('[data-node]') || g.closest('.highcharts-container')) continue;
        if (TYPES.includes(normalize(g.id))) { raw = g.id; source = 'board'; break; }
      }
    }

    const end = detectEnd(sel, node);
    const type = normalize(raw);
    if (raw && !TYPES.includes(type)) {
      log('Unknown classification name (tell the developer):', raw);
      return { nodeKey, type: null, source: 'unknown:' + raw, end, sel };
    }
    return { nodeKey, type: raw ? type : null, source, end, sel };
  }

  // Game-end types, only when the selected move is the very last move of the game:
  //   checkmate: the move ends with "#"
  //   draw:      the result row reads 1/2-1/2 (stalemate, agreement, repetition, ... look the same here)
  //   gameover:  decisive result without mate (resignation, timeout, abandonment look the same here)
  function detectEnd(sel, node) {
    if (!node) return null;
    const plies = document.querySelectorAll('.main-line-ply');
    if (!plies.length || plies[plies.length - 1] !== node) return null;
    if (/#/.test(sel.textContent || '')) return 'checkmate';
    const resultEl = document.querySelector('.game-result');
    const result = resultEl ? (resultEl.textContent || '').trim() : '';
    if (/1\/2|½/.test(result)) return 'draw';
    if (/^(1-0|0-1)$/.test(result)) return 'gameover';
    return null;
  }

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
    const found = detect();
    if (!found) return;
    // The key includes the classification, so a classification that shows up a moment
    // after the move was selected still plays, and the same state never plays twice.
    // On the last move of the game a game-end sound (if you set one) replaces the move sound.
    // Its key ignores the classification, so a late-arriving badge cannot trigger it twice.
    const endSound = found.end && sounds[found.end];
    const key = endSound
      ? found.nodeKey + '|end:' + found.end
      : found.nodeKey + '|' + (found.type || '-');
    if (key === lastKey) return;
    lastKey = key;
    if (endSound) {
      log('Move', found.nodeKey, '->', found.end, '(game end)');
      play(found.end);
    } else if (found.type && found.source === 'board') {
      // The board badge can lag a moment behind the selection, so only play it once it
      // has stayed the same for a short while (avoids playing the previous move's badge).
      setTimeout(() => {
        const again = detect();
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
