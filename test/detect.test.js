const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const D = require('../lib/detect.js');

// Builds a minimal review page. Structure mirrors what chess.com renders (taken from real DOM dumps).
function page({ moves, selected, style = '', icon = '', board = '', result = '', extra = '' }) {
  const list = moves.map((san, i) => {
    const sel = i === selected;
    const key = `0-${i + 1}`;
    return `<div class="node white-move main-line-ply" data-node="${key}">` +
      `<span class="node-highlight-content${sel ? ' selected' : ''}"${sel && style ? ` style="${style}"` : ''}>${san}</span>` +
      (sel && icon ? `<span class="node-annotation-icon"><svg><g id="${icon}"></g></svg></span>` : '') +
      `</div>`;
  }).join('');
  return new JSDOM(`<body><div class="move-list">${list}</div>` +
    (result ? `<div class="game-result">${result}</div>` : '') +
    `<div class="board">${board}</div>${extra}</body>`).window.document;
}
const badge = (id) => `<svg><g id="${id}"></g></svg>`;

test('normalize handles case, separators and aliases', () => {
  assert.equal(D.normalize('Brilliant'), 'brilliant');
  assert.equal(D.normalize('greatFind'), 'great');
  assert.equal(D.normalize('great-find'), 'great');
  assert.equal(D.normalize('bestMove'), 'best');
  assert.equal(D.normalize(null), '');
});

test('no selected move -> null', () => {
  const doc = new JSDOM('<body></body>').window.document;
  assert.equal(D.detect(doc), null);
});

test('reads classification from the style variable', () => {
  const doc = page({ moves: ['e4', 'e5', 'Qh5'], selected: 2, style: 'color: var(--color-classification-blunder);' });
  const f = D.detect(doc);
  assert.equal(f.type, 'blunder');
  assert.equal(f.source, 'style');
  assert.equal(f.nodeKey, '0-3');
});

test('reads classification from the annotation icon', () => {
  const doc = page({ moves: ['e4', 'e5'], selected: 1, icon: 'Brilliant' });
  const f = D.detect(doc);
  assert.equal(f.type, 'brilliant');
  assert.equal(f.source, 'icon');
});

test('icon name "incorrect" is unknown, not guessed', () => {
  const doc = page({ moves: ['e4', 'e5'], selected: 1, icon: 'incorrect' });
  const f = D.detect(doc);
  assert.equal(f.type, null);
  assert.equal(f.unknown, 'incorrect');
});

test('reads the board badge when the list has nothing', () => {
  const doc = page({ moves: ['e4', 'e5'], selected: 1, board: badge('best') });
  const f = D.detect(doc);
  assert.equal(f.type, 'best');
  assert.equal(f.source, 'board');
});

test('style wins over board badge', () => {
  const doc = page({ moves: ['e4', 'e5'], selected: 1, style: 'color: var(--color-classification-mistake)', board: badge('best') });
  assert.equal(D.detect(doc).type, 'mistake');
});

test('svg ids in the move list and the eval graph are ignored', () => {
  const doc = page({
    moves: ['e4', 'e5'], selected: 1,
    extra: '<div class="highcharts-container"><svg><g id="blunder"></g></svg></div>',
  });
  // an unrelated svg inside a move node must not count either
  doc.querySelector('[data-node="0-1"]').insertAdjacentHTML('beforeend', badge('great'));
  assert.equal(D.detect(doc).type, null);
});

test('unclassified move -> type null, no unknown', () => {
  const f = D.detect(page({ moves: ['e4', 'e5'], selected: 0 }));
  assert.equal(f.type, null);
  assert.equal(f.unknown, null);
});

test('checkmate on the last move', () => {
  const doc = page({ moves: ['e4', 'e5', 'Qxd1#'], selected: 2, result: '1-0' });
  assert.equal(D.detect(doc).end, 'checkmate');
});

test('draw result on the last move', () => {
  const doc = page({ moves: ['e4', 'e5'], selected: 1, result: '1/2-1/2' });
  assert.equal(D.detect(doc).end, 'draw');
});

test('decisive result without mate -> gameover', () => {
  assert.equal(D.detect(page({ moves: ['e4', 'e5'], selected: 1, result: '0-1' })).end, 'gameover');
});

test('no end sound before the last move', () => {
  const doc = page({ moves: ['e4', 'e5', 'Nf3'], selected: 1, result: '1/2-1/2' });
  assert.equal(D.detect(doc).end, null);
});

test('no result row -> no end', () => {
  assert.equal(D.detect(page({ moves: ['e4', 'e5'], selected: 1 })).end, null);
});

test('makeKey: same state same key, end sound ignores late badge', () => {
  const a = { nodeKey: '0-5', type: null, end: 'checkmate' };
  const b = { nodeKey: '0-5', type: 'best', end: 'checkmate' };
  assert.equal(D.makeKey(a, true), D.makeKey(b, true));
  assert.notEqual(D.makeKey(a, false), D.makeKey(b, false));
  assert.equal(D.makeKey({ nodeKey: '0-5', type: null, end: null }, false), '0-5|-');
});
