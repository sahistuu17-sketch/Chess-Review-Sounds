const TYPES = {
  brilliant: '#26c2a3', great: '#5c8bb0', best: '#81b64c', excellent: '#96bc4b', good: '#a3b18a',
  book: '#a88865', inaccuracy: '#f7c631', mistake: '#e58f2a', miss: '#ff7769', blunder: '#ca3431',
  checkmate: '#b8a6ff', draw: '#9aa5b1', gameover: '#6b7480',
};
// Labels that differ from the type name. Game-end types only fire on the last move of the game.
const LABELS = { checkmate: 'Checkmate', draw: 'Draw', gameover: 'Resign / timeout' };
const GAME_END = ['checkmate', 'draw', 'gameover'];
const MAX_FILE = 3 * 1024 * 1024;
const rows = document.getElementById('rows');
const msg = document.getElementById('msg');
let builtins = {}; // { type: [{ file, label }] } loaded from sounds/index.json
let sounds = {}; // { type: { name, data } }
let trims = {};  // { type: { start, length } }
let settings = { enabled: true, volume: 0.8, maxSeconds: 4, debug: false };

const say = (t) => { msg.textContent = t; };

function save() {
  chrome.storage.local.set({
    settings,
    trims,
    sounds: Object.fromEntries(Object.entries(sounds).map(([k, v]) => [k, v.data])),
    names: Object.fromEntries(Object.entries(sounds).map(([k, v]) => [k, v.name])),
  });
}

function preview(type) {
  const s = sounds[type];
  if (!s) return;
  const t = trims[type] || {};
  const start = Number(t.start) || 0;
  const length = Number(t.length) > 0 ? Number(t.length) : Number(settings.maxSeconds) || 0;
  const a = new Audio(s.data);
  a.volume = settings.volume;
  a.addEventListener('loadedmetadata', () => {
    if (start > 0 && start < a.duration) a.currentTime = start;
    a.play().then(() => { if (length > 0) setTimeout(() => a.pause(), length * 1000); });
  }, { once: true });
}

function numberField(label, type, key) {
  const wrap = document.createElement('label');
  wrap.append(label + ' ');
  const input = document.createElement('input');
  input.type = 'number'; input.min = '0'; input.step = '0.1';
  input.value = (trims[type] && trims[type][key]) || '';
  input.placeholder = '0';
  input.onchange = () => {
    trims[type] = { ...(trims[type] || {}), [key]: Math.max(0, Number(input.value) || 0) };
    save();
  };
  wrap.append(input);
  return wrap;
}


async function loadBuiltin(type, entry) {
  const res = await fetch(chrome.runtime.getURL('sounds/' + entry.file));
  const buf = await res.arrayBuffer();
  const data = await new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.readAsDataURL(new Blob([buf], { type: 'audio/mpeg' }));
  });
  sounds[type] = { name: 'Built-in: ' + entry.label, data };
  delete trims[type];
}

function builtinSelect(type) {
  const list = builtins[type] || [];
  if (!list.length) return null;
  const sel = document.createElement('select');
  sel.className = 'builtin';
  sel.title = 'Use a built-in sound';
  sel.append(new Option('Built-in…', ''));
  list.forEach((e, i) => sel.append(new Option(e.label, String(i))));
  sel.onchange = async () => {
    if (sel.value === '') return;
    await loadBuiltin(type, list[Number(sel.value)]);
    save(); render();
  };
  return sel;
}

function render() {
  rows.innerHTML = '';
  for (const [type, color] of Object.entries(TYPES)) {
    if (type === GAME_END[0]) {
      const sep = document.createElement('li');
      sep.className = 'divider';
      sep.textContent = 'Game end (plays on the last move of the review)';
      rows.append(sep);
    }
    const li = document.createElement('li');
    const s = sounds[type];
    li.innerHTML = `<span class="dot" style="background:${color}"></span><span class="name">${LABELS[type] || type}</span><span class="file">${s ? s.name : 'none'}</span>`;
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'audio/*';
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return;
      if (file.size > MAX_FILE) { say('That file is over 3 MB. Trim it first or use a shorter clip.'); return; }
      const reader = new FileReader();
      reader.onload = () => { sounds[type] = { name: file.name, data: reader.result }; save(); render(); };
      reader.readAsDataURL(file);
    };
    const pick = document.createElement('button');
    pick.textContent = s ? 'Replace' : 'Choose';
    pick.onclick = () => input.click();
    const bs = builtinSelect(type);
    li.append(input, pick);
    if (bs) li.append(bs);
    if (s) {
      const test = document.createElement('button');
      test.textContent = 'Play';
      test.onclick = () => preview(type);
      const clear = document.createElement('button');
      clear.textContent = 'Clear';
      clear.onclick = () => { delete sounds[type]; delete trims[type]; save(); render(); };
      li.append(test, clear);
      const trim = document.createElement('div');
      trim.className = 'trim';
      trim.append(numberField('Start (s)', type, 'start'), numberField('Length (s)', type, 'length'));
      li.append(trim);
    }
    rows.append(li);
  }
}

// ---- Sound packs (export / import as JSON) ----
document.getElementById('export').onclick = () => {
  if (!Object.keys(sounds).length) { say('Nothing to export yet. Add at least one sound.'); return; }
  const pack = {
    format: 'chess-review-sounds-pack', version: 1,
    sounds: Object.fromEntries(Object.entries(sounds).map(([k, v]) => [k, { name: v.name, data: v.data, ...(trims[k] || {}) }])),
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(pack)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = 'chess-sounds-pack.json'; a.click();
  URL.revokeObjectURL(url);
  say('Pack exported.');
};

const importFile = document.getElementById('importFile');
document.getElementById('import').onclick = () => importFile.click();
importFile.onchange = () => {
  const file = importFile.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const pack = JSON.parse(reader.result);
      if (pack.format !== 'chess-review-sounds-pack' || typeof pack.sounds !== 'object') throw new Error('bad format');
      let n = 0;
      for (const [type, v] of Object.entries(pack.sounds)) {
        if (!(type in TYPES) || !v || typeof v.data !== 'string' || !v.data.startsWith('data:audio/')) continue;
        sounds[type] = { name: String(v.name || 'imported').slice(0, 60), data: v.data };
        trims[type] = { start: Number(v.start) || 0, length: Number(v.length) || 0 };
        n++;
      }
      save(); render();
      say(n ? `Imported ${n} sound${n > 1 ? 's' : ''}.` : 'No valid sounds found in that file.');
    } catch (e) {
      say('That file is not a valid sound pack.');
    }
    importFile.value = '';
  };
  reader.readAsText(file);
};


document.getElementById('defaults').onclick = async () => {
  let n = 0;
  for (const type of Object.keys(TYPES)) {
    if (sounds[type] || !(builtins[type] || []).length) continue;
    await loadBuiltin(type, builtins[type][0]);
    n++;
  }
  save(); render();
  say(n ? `Loaded ${n} built-in sound${n > 1 ? 's' : ''} for empty slots.` : 'All slots already have a sound.');
};

document.getElementById('reset').onclick = () => {
  if (!confirm('Remove all chosen sounds and reset the settings?')) return;
  sounds = {}; trims = {};
  settings = { enabled: true, volume: 0.8, maxSeconds: 4, debug: false };
  chrome.storage.local.clear(() => {
    save();
    document.getElementById('enabled').checked = true;
    document.getElementById('volume').value = settings.volume;
    document.getElementById('maxSeconds').value = settings.maxSeconds;
    document.getElementById('debug').checked = false;
    render();
    say('Everything was reset.');
  });
};

chrome.storage.local.get(['settings', 'sounds', 'names', 'trims'], (r) => {
  settings = { ...settings, ...(r.settings || {}) };
  trims = r.trims || {};
  for (const [t, data] of Object.entries(r.sounds || {})) sounds[t] = { data, name: (r.names || {})[t] || 'custom' };
  const en = document.getElementById('enabled');
  const vol = document.getElementById('volume');
  const max = document.getElementById('maxSeconds');
  const dbg = document.getElementById('debug');
  dbg.checked = !!settings.debug;
  dbg.onchange = () => { settings.debug = dbg.checked; save(); };
  en.checked = settings.enabled; vol.value = settings.volume; max.value = settings.maxSeconds;
  en.onchange = () => { settings.enabled = en.checked; save(); };
  vol.oninput = () => { settings.volume = Number(vol.value); save(); };
  max.onchange = () => { settings.maxSeconds = Number(max.value); save(); };
  fetch(chrome.runtime.getURL('sounds/index.json'))
    .then((r) => r.json()).catch(() => ({}))
    .then((idx) => { builtins = idx; render(); });
});
