/* build-guide.js — regenerate the teacher's guide from the live site data.
 *
 *   node teacher-guide/build-guide.js
 *
 * The guide is navigated exactly like the FLE / ESL pages: a language switch,
 * CEFR level tabs, colour-coded chips per section, and a panel that opens on
 * click. It reuses the site's own stylesheet, so it always looks like the site.
 * The panel shows what the teacher needs: the grammar note and its examples,
 * the four-step teaching sequence (archived in data/steps-*.json, no longer on
 * the site), and the common pitfall.
 *
 * A "tout afficher" toggle renders every topic linearly for reading or printing.
 *
 * Run this whenever exercices/ changes, and ship the guide with the site.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SITE = path.join(ROOT, 'exercices');
const OUT = path.join(__dirname, 'guide-enseignant.html');

const LANGS = [
  { key: 'fr', tab: 'FLE', label: 'FLE — Français langue étrangère',
    html: 'fle/index.html', js: 'js/exercises-french.js', varName: 'EXFR' },
  { key: 'en', tab: 'ESL', label: 'ESL — English as a Second Language',
    html: 'esl/index.html', js: 'js/exercises-english.js', varName: 'EXEN' },
];

function readD(file) {
  const src = fs.readFileSync(file, 'utf8');
  const s = src.indexOf('const D = [');
  let i = src.indexOf('[', s), d = 0, e = -1, S = false, ch = '';
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (S) { if (c === '\\') { j++; continue; } if (c === ch) S = false; continue; }
    if (c === '"' || c === "'") { S = true; ch = c; continue; }
    if (c === '[') d++; else if (c === ']') { d--; if (!d) { e = j; break; } }
  }
  return eval(src.slice(i, e + 1));
}

function readBank(file, varName) {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(file, 'utf8') + `;__r=${varName};`, ctx, { timeout: 10000 });
  return ctx.__r;
}

/* the site's own stylesheet keeps the guide visually in sync with the site */
function siteCss() {
  const src = fs.readFileSync(path.join(SITE, 'fle/index.html'), 'utf8').replace(/\r/g, '');
  return [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
}

const DATA = {};
const stats = [];
let missing = 0;

for (const L of LANGS) {
  const D = readD(path.join(SITE, L.html));
  const steps = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', `steps-${L.key}.json`), 'utf8'));
  const bank = readBank(path.join(SITE, L.js), L.varName);
  let topics = 0, stepCount = 0;

  const levels = D.map(lv => ({
    id: lv.id, title: lv.title || '', desc: lv.desc || '', note: lv.note || '',
    sections: lv.sections.map(sec => ({
      label: sec.label, type: sec.type,
      items: sec.items.map(it => {
        topics++;
        const seq = steps[it.name] || [];
        if (!seq.length) missing++;
        stepCount += seq.length;
        return {
          name: it.name,
          gn: it.gn || '', ge: it.ge || [], pitfall: it.pitfall || '',
          steps: seq, n: bank[it.name] ? bank[it.name].ex.length : 0,
        };
      }),
    })),
  }));

  DATA[L.key] = { tab: L.tab, label: L.label, levels };
  stats.push({ label: L.label, topics, steps: stepCount });
}

const totalTopics = stats.reduce((n, s) => n + s.topics, 0);
const totalSteps = stats.reduce((n, s) => n + s.steps, 0);

const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Guide de l'enseignant · Teacher's Guide — ASD</title>
<style>
${siteCss()}
</style>
<style>
  /* ── guide-specific chrome ──────────────────────────────────────────
     Surfaces, text and borders reuse the site's own tokens so light and
     dark stay in step with the site. Only the violet accents are ours,
     and they carry explicit dark values.                              */
  :root{
    --g-btn-bg:#7c3aed; --g-btn-ink:#ffffff;
    --g-accent:#7c3aed; --g-accent-soft:#f1eefb; --g-accent-ink:#6d28d9;
    --g-mark-bg:#f3e8ff; --g-mark-ink:#3b2a5c;
  }
  @media(prefers-color-scheme:dark){
    :root{
      --g-btn-bg:#6d28d9; --g-btn-ink:#ffffff;
      --g-accent:#a78bfa; --g-accent-soft:#2b2440; --g-accent-ink:#c4b5fd;
      --g-mark-bg:#5b21b6; --g-mark-ink:#f5f3ff;
    }
  }
  .guide-head{max-width:1100px;margin:0 auto;padding:26px 20px 0}
  .guide-head h1{font-size:clamp(22px,4vw,30px);line-height:1.2;margin:0 0 6px}
  .guide-head p{margin:0;color:var(--color-text-secondary);font-size:14.5px}
  .guide-meta{margin-top:8px !important;font-size:13px !important}
  .lang-switch{display:flex;gap:8px;justify-content:center;margin:18px 0 4px;flex-wrap:wrap}
  .lang-btn{font:inherit;font-weight:700;font-size:14px;cursor:pointer;padding:8px 22px;
    border-radius:999px;border:1px solid var(--color-border-secondary);
    background:var(--color-background-primary);color:var(--color-text-primary)}
  .lang-btn.active{background:var(--g-btn-bg);border-color:var(--g-btn-bg);color:var(--g-btn-ink)}
  .guide-tools{display:flex;gap:10px;justify-content:center;align-items:center;
    flex-wrap:wrap;margin:10px 0 14px}
  .guide-search{font:inherit;font-size:14px;padding:9px 14px;border-radius:999px;min-width:min(330px,80vw);
    border:1px solid var(--color-border-secondary);
    background:var(--color-background-primary);color:var(--color-text-primary)}
  .guide-search::placeholder{color:var(--color-text-tertiary);opacity:1}
  .guide-toggle{font:inherit;font-size:13px;font-weight:600;cursor:pointer;padding:8px 16px;
    border-radius:999px;border:1px solid var(--color-border-secondary);
    background:var(--color-background-primary);color:var(--color-text-primary)}
  .guide-toggle.on{background:var(--g-btn-bg);border-color:var(--g-btn-bg);color:var(--g-btn-ink)}
  .hits{max-width:1100px;margin:0 auto 14px;padding:0 20px}
  .hit{display:block;width:100%;text-align:left;font:inherit;cursor:pointer;margin-bottom:6px;
    padding:9px 13px;border-radius:10px;border:1px solid var(--color-border-tertiary);
    background:var(--color-background-primary);color:var(--color-text-primary)}
  .hit:hover{border-color:var(--g-accent)}
  .hit b{color:var(--g-accent)}
  .hit .hit-meta{font-size:11.5px;color:var(--color-text-secondary);margin-left:6px}
  .hit mark{background:var(--g-mark-bg);color:var(--g-mark-ink);border-radius:3px;padding:0 2px}
  .seq-steps{margin-top:12px}
  .seq-steps-h{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
    color:var(--color-text-secondary);margin-bottom:8px}
  .qcount{display:inline-block;font-size:11px;font-weight:600;padding:2px 9px;border-radius:999px;
    background:var(--g-accent-soft);color:var(--g-accent-ink);margin-left:8px;vertical-align:middle}
  /* linear "tout afficher" view, also what prints */
  .all-topic{background:var(--color-background-primary);border:1px solid var(--color-border-tertiary);
    border-radius:12px;padding:15px 17px;margin-bottom:13px;break-inside:avoid;page-break-inside:avoid}
  .all-topic h4{margin:0 0 9px;font-size:16px;color:var(--color-text-primary)}
  .all-lvl{display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;
    background:var(--g-accent-soft);color:var(--g-accent-ink);margin-left:6px;vertical-align:middle}
  .all-sec{font-size:12px;letter-spacing:.07em;text-transform:uppercase;
    color:var(--color-text-secondary);margin:20px 0 9px}
  .all-lang-h{font-size:20px;margin:30px 0 4px;padding-bottom:7px;
    border-bottom:2px solid var(--color-border-secondary);color:var(--color-text-primary)}
  #all-view{max-width:1100px;margin:0 auto;padding:0 20px 60px}
  footer.guide-foot{max-width:1100px;margin:26px auto 0;padding:16px 20px 40px;text-align:center;
    font-size:12.5px;color:var(--color-text-secondary)}
  @media print{
    /* force the light palette: printing from a dark-themed OS must stay readable */
    :root{
      --color-background-primary:#ffffff; --color-background-secondary:#f5f6f7;
      --color-text-primary:#1f2328; --color-text-secondary:#5b6470; --color-text-tertiary:#8a929c;
      --color-border-secondary:#d6dadf; --color-border-tertiary:#e7e9ec;
      --g-accent:#7c3aed; --g-accent-soft:#f1eefb; --g-accent-ink:#6d28d9;
    }
    .lang-switch,.guide-tools,.hits,#tabs,#level-display,#seq-display,.guide-foot{display:none !important}
    #all-view{display:block !important;padding:0}
    body{background:#fff;color:#1f2328}
    .all-topic{border:none;border-bottom:1px solid #ddd;border-radius:0}
    .gn-box{background:#f0faf5 !important;border-color:#1d9e75 !important}
    .gn-label{color:#0f6e56 !important}
    .gn-text{color:#1f2328 !important}
    .gn-ex{color:#5b6470 !important;border-color:#5dcaa5 !important}
    .pitfall-box{background:#fff5f5 !important;color:#7a1a1a !important;border-color:#e05252 !important}
    .step-num{background:#7c3aed !important;color:#fff !important}
    .step-text,.step-label{color:#1f2328 !important}
  }
</style>
</head>
<body>
<div class="guide-head">
  <h1>Guide de l'enseignant <span style="font-weight:400;color:var(--color-text-tertiary,#8b8798)">· Teacher's Guide</span></h1>
  <p>Séquences pédagogiques, notes de grammaire et pièges courants — FLE &amp; ESL, A1 → C2.
     Navigation identique aux pages du site : choisissez une langue, un niveau, puis une notion.</p>
  <p class="guide-meta"><strong>${totalTopics}</strong> notions · <strong>${totalSteps}</strong> étapes pédagogiques ·
     document de travail interne, non publié</p>
</div>

<div class="lang-switch" id="lang-switch"></div>

<div class="guide-tools">
  <input id="guide-search" class="guide-search" type="search" autocomplete="off" spellcheck="false"
         placeholder="Rechercher une notion, une règle, un piège…" aria-label="Rechercher">
  <button id="all-btn" class="guide-toggle" type="button">Tout afficher · Show all</button>
</div>

<div class="hits" id="hits"></div>

<div class="wrap">
  <div class="level-tabs" id="tabs"></div>
  <div id="level-display"></div>
  <div id="seq-display"></div>
</div>

<div id="all-view" style="display:none"></div>

<footer class="guide-foot">ASD · Guide de l'enseignant · généré depuis <code>exercices/</code> —
  ne pas modifier à la main : relancer <code>node teacher-guide/build-guide.js</code></footer>

<script>
const GUIDE = ${JSON.stringify(DATA)};
const LANG_KEYS = ${JSON.stringify(LANGS.map(l => l.key))};

const esc = s => String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');

let lang = 'fr', level = 'A1', openKey = null, allOn = false;
try {
  const s = localStorage.getItem('guide-lang'); if (LANG_KEYS.includes(s)) lang = s;
  const l = localStorage.getItem('guide-level-' + lang); if (l) level = l;
} catch (e) {}

const levels = () => GUIDE[lang].levels;
const curLevel = () => levels().find(l => l.id === level) || levels()[0];

function renderLangs() {
  document.getElementById('lang-switch').innerHTML = LANG_KEYS.map(k =>
    '<button class="lang-btn' + (k === lang ? ' active' : '') + '" data-k="' + k + '">' +
    esc(GUIDE[k].tab) + '</button>').join('');
}

function renderTabs() {
  document.getElementById('tabs').innerHTML = levels().map(lv =>
    '<button class="tab-btn' + (lv.id === level ? ' active' : '') + '" data-lv="' + lv.id + '">' +
    esc(lv.id) + '</button>').join('');
}

function renderLevel() {
  const lv = curLevel();
  let h = '<div class="level-card"><div class="level-header"><div class="level-badge">' + esc(lv.id) +
    '</div><div><div class="level-title">' + esc(lv.title) + '</div><div class="level-desc">' +
    esc(lv.desc) + '</div></div></div><div class="level-body">';
  if (lv.note) h += '<div class="note-box">' + esc(lv.note) + '</div>';
  lv.sections.forEach((sec, si) => {
    h += '<div><div class="section-label">' + esc(sec.label) + '</div><div class="chip-grid">';
    sec.items.forEach((it, ii) => {
      h += '<span class="chip ' + esc(sec.type) + '" data-si="' + si + '" data-ii="' + ii + '">' +
           esc(it.name) + '</span>';
    });
    h += '</div></div>';
  });
  document.getElementById('level-display').innerHTML = h + '</div></div>';
}

function topicHtml(it) {
  let h = '';
  if (it.gn) {
    h += '<div class="gn-box"><div class="gn-label">Note de grammaire · Grammar note</div>' +
         '<div class="gn-text">' + esc(it.gn) + '</div>' +
         it.ge.map(g => '<div class="gn-ex">' + esc(g) + '</div>').join('') + '</div>';
  }
  if (it.steps && it.steps.length) {
    h += '<div class="seq-steps"><div class="seq-steps-h">Séquence pédagogique · Teaching sequence</div>' +
      it.steps.map(s =>
        '<div class="step-row"><div class="step-num">' + esc(s.n) + '</div><div class="step-content">' +
        '<div class="step-label">' + esc(s.label) + '</div><div class="step-text">' + esc(s.text) + '</div>' +
        (s.ex ? '<div class="step-ex">' + esc(s.ex) + '</div>' : '') +
        '</div></div>').join('') + '</div>';
  }
  if (it.pitfall) {
    h += '<div class="pitfall-box"><strong>Piège courant · Common pitfall :</strong> ' + esc(it.pitfall) + '</div>';
  }
  return h;
}

function openTopic(si, ii) {
  const lv = curLevel();
  const it = lv.sections[si].items[ii];
  const key = lang + '|' + lv.id + '|' + si + '|' + ii;
  const box = document.getElementById('seq-display');
  if (openKey === key) { box.innerHTML = ''; openKey = null; markChips(); return; }
  box.innerHTML = '<div class="seq-panel"><div class="seq-header"><div class="seq-title">' +
    esc(it.name) + (it.n ? '<span class="qcount">' + it.n + ' questions</span>' : '') +
    '</div><span class="close-btn" id="guide-close">✕ fermer · close</span></div>' +
    '<div class="seq-body">' + topicHtml(it) + '</div></div>';
  openKey = key;
  markChips();
  document.getElementById('guide-close').onclick = () => {
    box.innerHTML = ''; openKey = null; markChips();
  };
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function markChips() {
  const parts = openKey ? openKey.split('|') : null;
  document.querySelectorAll('#level-display .chip').forEach(c => {
    const on = parts && parts[0] === lang && parts[1] === curLevel().id &&
      parts[2] === c.dataset.si && parts[3] === c.dataset.ii;
    c.classList.toggle('chip-active', !!on);
  });
}

function renderAll() {
  if (document.getElementById('all-view').dataset.built) return;
  let h = '';
  LANG_KEYS.forEach(k => {
    h += '<h2 class="all-lang-h">' + esc(GUIDE[k].label) + '</h2>';
    GUIDE[k].levels.forEach(lv => {
      lv.sections.forEach(sec => {
        h += '<div class="all-sec">' + esc(lv.id) + ' · ' + esc(sec.label) + '</div>';
        sec.items.forEach(it => {
          h += '<article class="all-topic"><h4>' + esc(it.name) +
            '<span class="all-lvl">' + esc(lv.id) + '</span>' +
            (it.n ? '<span class="qcount">' + it.n + ' questions</span>' : '') + '</h4>' +
            topicHtml(it) + '</article>';
        });
      });
    });
  });
  const el = document.getElementById('all-view');
  el.innerHTML = h;
  el.dataset.built = '1';
}

/* ── search across names, notes, examples, steps and pitfalls ─────────── */
const INDEX = [];
LANG_KEYS.forEach(k => GUIDE[k].levels.forEach(lv => lv.sections.forEach((sec, si) =>
  sec.items.forEach((it, ii) => {
    const hay = [it.name, it.gn, ...(it.ge || []), it.pitfall]
      .concat((it.steps || []).flatMap(s => [s.label, s.text, s.ex || '']));
    INDEX.push({ lang: k, lvl: lv.id, si, ii, name: it.name, section: sec.label,
                 hay: norm(hay.filter(Boolean).join(' • ')), raw: hay.filter(Boolean) });
  }))));

function runSearch(q) {
  const hits = document.getElementById('hits');
  const n = norm(q.trim());
  if (n.length < 2) { hits.innerHTML = ''; return; }
  const found = INDEX.filter(r => r.hay.includes(n)).slice(0, 40);
  if (!found.length) { hits.innerHTML = '<div class="hit">Aucun résultat · No match</div>'; return; }
  hits.innerHTML = found.map((r, i) => {
    const snip = r.raw.find(t => norm(t).includes(n)) || '';
    const at = norm(snip).indexOf(n);
    const cut = snip.slice(Math.max(0, at - 40), at + 90);
    const shown = esc(cut).replace(new RegExp('(' + q.trim().replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&') + ')', 'i'), '<mark>$1</mark>');
    return '<button class="hit" data-h="' + i + '"><b>' + esc(r.name) + '</b>' +
      '<span class="hit-meta">' + esc(GUIDE[r.lang].tab) + ' · ' + esc(r.lvl) + ' · ' + esc(r.section) + '</span>' +
      '<br><span class="hit-meta">…' + shown + '…</span></button>';
  }).join('');
  hits.querySelectorAll('.hit[data-h]').forEach(b => b.onclick = () => {
    const r = found[+b.dataset.h];
    lang = r.lang; level = r.lvl;
    save(); renderLangs(); renderTabs(); renderLevel();
    openTopic(r.si, r.ii);
  });
}

function save() {
  try { localStorage.setItem('guide-lang', lang); localStorage.setItem('guide-level-' + lang, level); } catch (e) {}
}

/* ── wiring ───────────────────────────────────────────────────────────── */
document.getElementById('lang-switch').addEventListener('click', e => {
  const b = e.target.closest('.lang-btn'); if (!b) return;
  lang = b.dataset.k;
  try { const l = localStorage.getItem('guide-level-' + lang); level = l || GUIDE[lang].levels[0].id; } catch (e2) { level = GUIDE[lang].levels[0].id; }
  if (!levels().some(l => l.id === level)) level = levels()[0].id;
  openKey = null; document.getElementById('seq-display').innerHTML = '';
  save(); renderLangs(); renderTabs(); renderLevel();
});
document.getElementById('tabs').addEventListener('click', e => {
  const b = e.target.closest('.tab-btn'); if (!b) return;
  level = b.dataset.lv; openKey = null;
  document.getElementById('seq-display').innerHTML = '';
  save(); renderTabs(); renderLevel();
});
document.getElementById('level-display').addEventListener('click', e => {
  const c = e.target.closest('.chip'); if (!c) return;
  openTopic(+c.dataset.si, +c.dataset.ii);
});
document.getElementById('guide-search').addEventListener('input', e => runSearch(e.target.value));
document.getElementById('all-btn').addEventListener('click', () => {
  allOn = !allOn;
  renderAll();
  document.getElementById('all-view').style.display = allOn ? 'block' : 'none';
  document.querySelector('.wrap').style.display = allOn ? 'none' : '';
  document.getElementById('all-btn').classList.toggle('on', allOn);
  document.getElementById('all-btn').textContent = allOn ? 'Vue par niveaux · Level view' : 'Tout afficher · Show all';
});

if (!levels().some(l => l.id === level)) level = levels()[0].id;
renderLangs(); renderTabs(); renderLevel();
</script>
</body>
</html>`;

fs.writeFileSync(OUT, html);
stats.forEach(s => console.log(`${s.label}: ${s.topics} topics, ${s.steps} steps`));
if (missing) console.log(`WARNING: ${missing} topic(s) have no archived teaching sequence`);
console.log(`\nwrote ${path.relative(ROOT, OUT)} (${(html.length / 1024).toFixed(0)} KB)`);
