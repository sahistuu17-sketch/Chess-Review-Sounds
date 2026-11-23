// Detection logic for Chess Review Sounds.
//
// Pure functions that read a document (a real one in the browser, jsdom in the tests) and
// report which classification or game-end state the selected move has. No browser APIs
// besides the DOM are used, so everything here can be unit tested in Node.
//
// Loaded as a classic content script (exposes `ChessSoundsDetect`) and via require() in tests.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ChessSoundsDetect = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const TYPES = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder'];
  const END_TYPES = ['checkmate', 'draw', 'gameover'];
  const ALIASES = { greatfind: 'great', bestmove: 'best' };

  // "Brilliant", "greatFind" and "great-find" all become a plain lower-case name.
  function normalize(raw) {
    const t = String(raw || '').toLowerCase().replace(/[^a-z]/g, '');
    return ALIASES[t] || t;
  }

  // Game-end type, only when the selected move is the very last move of the game:
  //   checkmate: the move ends with "#"
  //   draw:      the result row reads 1/2-1/2 (stalemate, agreement, repetition look the same)
  //   gameover:  decisive result without mate (resignation, timeout, abandonment look the same)
  function detectEnd(doc, sel, node) {
    if (!node) return null;
    const plies = doc.querySelectorAll('.main-line-ply');
    if (!plies.length || plies[plies.length - 1] !== node) return null;
    if (/#/.test(sel.textContent || '')) return 'checkmate';
    const resultEl = doc.querySelector('.game-result');
    const result = resultEl ? (resultEl.textContent || '').trim() : '';
    if (/1\/2|½/.test(result)) return 'draw';
    if (/^(1-0|0-1)$/.test(result)) return 'gameover';
    return null;
  }

  // Reads the selected move of the review and returns
  //   { nodeKey, type, source, end, sel, unknown }   or null when no move is selected.
  // `type` is null for moves without a classification. `source` says where it was read from:
  //   'style' (colour variable on the move), 'icon' (annotation icon next to the move),
  //   'board' (badge on the board). `unknown` holds a classification name we do not know.
  function detect(doc) {
    // Prefer the selected move inside the move list (it has a data-node ancestor).
    const sel = doc.querySelector('[data-node] .node-highlight-content.selected')
      || doc.querySelector('.node-highlight-content.selected');
    if (!sel) return null;
    const node = sel.closest('[data-node]');
    const nodeKey = node ? node.getAttribute('data-node') : (sel.textContent || '').trim();

    let raw = null;
    let source = '';

    // 1) inline style: color: var(--color-classification-brilliant)
    const m = /--color-classification-([a-z-]+)/i.exec(sel.getAttribute('style') || '');
    if (m) { raw = m[1]; source = 'style'; }

    // 2) annotation icon next to the move: <g id="Brilliant">
    if (!raw && node) {
      const g = node.querySelector('.node-annotation-icon g[id]');
      if (g) { raw = g.id; source = 'icon'; }
    }

    // 3) the badge drawn on the destination square of the board: <svg><g id="best">
    //    (the move list only colours a few classifications, the board badges every move)
    if (!raw) {
      for (const g of doc.querySelectorAll('svg g[id]')) {
        if (g.closest('[data-node]') || g.closest('.highcharts-container')) continue;
        if (TYPES.includes(normalize(g.id))) { raw = g.id; source = 'board'; break; }
      }
    }

    const end = detectEnd(doc, sel, node);
    const type = normalize(raw);
    if (raw && !TYPES.includes(type)) {
      return { nodeKey, type: null, source: 'unknown:' + raw, end, sel, unknown: raw };
    }
    return { nodeKey, type: raw ? type : null, source, end, sel, unknown: null };
  }

  // Identifies a state so the same one never plays twice. With a game-end sound the
  // classification is left out, so a badge that shows up late cannot trigger it again.
  function makeKey(found, hasEndSound) {
    if (hasEndSound && found.end) return found.nodeKey + '|end:' + found.end;
    return found.nodeKey + '|' + (found.type || '-');
  }

  return { TYPES, END_TYPES, normalize, detectEnd, detect, makeKey };
});
