/* build-guide.js — regenerate the teacher's guide from the live site data.
 *
 *   node teacher-guide/build-guide.js
 *
 * Reads the current curriculum (grammar notes, examples, pitfalls, topic order)
 * straight out of the two site pages, joins it with the archived four-step
 * teaching sequences in data/steps-*.json, counts the exercises in the two
 * question banks, and writes a single self-contained HTML guide.
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
  { key: 'fr', label: 'FLE — Français langue étrangère', html: 'fle/index.html',
    js: 'js/exercises-french.js', varName: 'EXFR', colour: '#0f6e56', tint: '#d1fae5',
    seqTitle: 'Séquence pédagogique', noteTitle: 'Note de grammaire',
    pitTitle: 'Piège courant', exLabel: 'questions', supportLabel: 'Support' },
  { key: 'en', label: 'ESL — English as a Second Language', html: 'esl/index.html',
    js: 'js/exercises-english.js', varName: 'EXEN', colour: '#2563eb', tint: '#dbeafe',
    seqTitle: 'Teaching sequence', noteTitle: 'Grammar note',
    pitTitle: 'Common pitfall', exLabel: 'questions', supportLabel: 'Support' },
];

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

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

const parts = [];
const stats = [];
let missingSteps = 0;

for (const L of LANGS) {
  const D = readD(path.join(SITE, L.html));
  const steps = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', `steps-${L.key}.json`), 'utf8'));
  const bank = readBank(path.join(SITE, L.js), L.varName);

  let topics = 0, stepCount = 0;
  const levelNav = D.map(lv => `<a href="#${L.key}-${lv.id}">${esc(lv.id)}</a>`).join('');
  const body = D.map(lv => {
    const secs = lv.sections.map(sec => {
      const items = sec.items.map(it => {
        topics++;
        const seq = steps[it.name] || [];
        if (!seq.length) missingSteps++;
        stepCount += seq.length;
        const n = bank[it.name] ? bank[it.name].ex.length : 0;
        const ge = (it.ge || []).map(g => `<li>${esc(g)}</li>`).join('');
        const stepRows = seq.map(s => `
          <div class="step">
            <div class="step-n">${esc(s.n)}</div>
            <div class="step-b">
              <div class="step-l">${esc(s.label)}</div>
              <p>${esc(s.text)}</p>
              ${s.ex ? `<p class="support"><strong>${L.supportLabel} :</strong> ${esc(s.ex)}</p>` : ''}
            </div>
          </div>`).join('');
        return `
      <article class="topic" id="${L.key}-${slug(it.name)}">
        <h4>${esc(it.name)} <span class="lvl">${esc(lv.id)}</span>${n ? `<span class="qn">${n} ${L.exLabel}</span>` : ''}</h4>
        ${it.gn ? `<div class="note"><div class="note-h">${L.noteTitle}</div><p>${esc(it.gn)}</p>${ge ? `<ul>${ge}</ul>` : ''}</div>` : ''}
        ${stepRows ? `<div class="seq"><div class="seq-h">${L.seqTitle}</div>${stepRows}</div>` : ''}
        ${it.pitfall ? `<div class="pit"><strong>${L.pitTitle} :</strong> ${esc(it.pitfall)}</div>` : ''}
      </article>`;
      }).join('');
      return `<section class="sec"><h3>${esc(sec.label)}</h3>${items}</section>`;
    }).join('');
    return `<section class="lvl-block" id="${L.key}-${lv.id}">
      <h2>${esc(lv.id)} <span class="lvl-t">${esc(lv.title || '')}</span></h2>
      ${lv.desc ? `<p class="lvl-d">${esc(lv.desc)}</p>` : ''}
      ${secs}</section>`;
  }).join('');

  stats.push({ label: L.label, topics, steps: stepCount });
  parts.push(`<section class="lang" id="${L.key}" style="--c:${L.colour};--tint:${L.tint}">
    <header class="lang-h"><h1>${esc(L.label)}</h1>
      <nav class="jump">${levelNav}</nav>
      <p class="count">${topics} points de grammaire · ${stepCount} étapes</p>
    </header>${body}</section>`);
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
  :root{--bg:#f8f7fc;--surface:#fff;--text:#1a1a2e;--muted:#5c6370;--accent:#7c3aed;--line:#e6e2f2}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--text);line-height:1.6;
       font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  .wrap{max-width:940px;margin:0 auto;padding:32px 20px 80px}
  .cover{border-bottom:3px solid var(--accent);padding-bottom:20px;margin-bottom:28px}
  .cover h1{margin:0 0 6px;font-size:clamp(26px,4.5vw,34px);line-height:1.15}
  .cover p{margin:0;color:var(--muted)}
  .cover .meta{margin-top:12px;font-size:13.5px}
  .toc{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px 20px;margin-bottom:34px}
  .toc h2{margin:0 0 8px;font-size:15px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}
  .toc a{color:var(--accent);text-decoration:none;font-weight:600}
  .toc a:hover{text-decoration:underline}
  .toc li{margin:3px 0}
  .lang{margin-bottom:56px}
  .lang-h{border-left:5px solid var(--c);padding:10px 0 10px 16px;margin:0 0 24px}
  .lang-h h1{margin:0;font-size:24px;color:var(--c)}
  .jump{margin-top:8px;display:flex;flex-wrap:wrap;gap:8px}
  .jump a{font-size:12.5px;font-weight:700;padding:3px 10px;border-radius:999px;
          background:var(--tint);color:var(--c);text-decoration:none}
  .count{margin:8px 0 0;font-size:13px;color:var(--muted)}
  .lvl-block{margin-bottom:34px}
  .lvl-block h2{font-size:19px;margin:0 0 2px;padding-bottom:6px;border-bottom:2px solid var(--line)}
  .lvl-t{font-weight:400;color:var(--muted);font-size:15px}
  .lvl-d{margin:4px 0 14px;color:var(--muted);font-size:13.5px}
  .sec h3{font-size:13px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);
          margin:22px 0 10px}
  .topic{background:var(--surface);border:1px solid var(--line);border-radius:12px;
         padding:16px 18px;margin-bottom:14px;break-inside:avoid;page-break-inside:avoid}
  .topic h4{margin:0 0 10px;font-size:16.5px;line-height:1.35}
  .lvl{display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;
       background:var(--tint);color:var(--c);margin-left:6px;vertical-align:middle}
  .qn{display:inline-block;font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;
      background:#f1eefb;color:var(--accent);margin-left:5px;vertical-align:middle}
  .note{background:#f0faf5;border-left:3px solid #1d9e75;border-radius:0 8px 8px 0;padding:10px 14px;margin-bottom:12px}
  .note-h{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#0f6e56;margin-bottom:4px}
  .note p{margin:0;font-size:14.5px}
  .note ul{margin:6px 0 0;padding-left:16px}
  .note li{font-size:12.5px;font-style:italic;color:var(--muted);line-height:1.5}
  .seq{margin:12px 0}
  .seq-h{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:8px}
  .step{display:flex;gap:11px;align-items:flex-start;margin-bottom:9px}
  .step-n{flex:0 0 24px;height:24px;border-radius:50%;background:var(--accent);color:#fff;
          font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center}
  .step-l{font-weight:700;font-size:13.5px}
  .step-b p{margin:1px 0 0;font-size:14px}
  .support{color:var(--muted);font-size:12.5px !important;font-style:italic}
  .pit{background:#fff5f5;border-left:3px solid #e05252;border-radius:0 8px 8px 0;
       padding:9px 13px;font-size:13.5px}
  .pit strong{color:#c33}
  footer{margin-top:40px;padding-top:18px;border-top:1px solid var(--line);
         color:var(--muted);font-size:12.5px;text-align:center}
  @media print{
    body{background:#fff}
    .wrap{max-width:none;padding:0}
    .jump,.toc{display:none}
    .topic{border:none;border-bottom:1px solid #ddd;border-radius:0;padding:10px 0}
    .lang-h{break-before:page;page-break-before:always}
    #fr.lang .lang-h{break-before:auto;page-break-before:auto}
  }
  @media (prefers-color-scheme:dark){
    :root{--bg:#12121c;--surface:#1b1b28;--text:#eceaf5;--muted:#9d9ab0;--line:#2c2b3d}
    .note{background:#04342c;border-color:#0f6e56}
    .note-h{color:#5dcaa5}
    .pit{background:#3a1b1b;border-color:#e05252}
    .pit strong{color:#ff8f8f}
    .qn{background:#241d3d}
  }
</style>
</head>
<body>
<div class="wrap">
  <div class="cover">
    <h1>Guide de l'enseignant · Teacher's Guide</h1>
    <p>Séquences pédagogiques, notes de grammaire et pièges courants — FLE &amp; ESL, A1 → C2</p>
    <p class="meta"><strong>${totalTopics}</strong> points de grammaire · <strong>${totalSteps}</strong> étapes pédagogiques ·
       document de travail interne, à ne pas publier</p>
  </div>
  <nav class="toc">
    <h2>Sommaire · Contents</h2>
    <ul>${stats.map((s, i) => `<li><a href="#${LANGS[i].key}">${esc(s.label)}</a> — ${s.topics} points, ${s.steps} étapes</li>`).join('')}</ul>
  </nav>
  ${parts.join('\n')}
  <footer>ASD · Guide de l'enseignant · Généré à partir de exercices/ — ne pas modifier à la main :
    relancer <code>node teacher-guide/build-guide.js</code></footer>
</div>
</body>
</html>`;

fs.writeFileSync(OUT, html);
stats.forEach(s => console.log(`${s.label}: ${s.topics} topics, ${s.steps} steps`));
if (missingSteps) console.log(`WARNING: ${missingSteps} topic(s) have no archived teaching sequence`);
console.log(`\nwrote ${path.relative(ROOT, OUT)} (${(html.length / 1024).toFixed(0)} KB)`);
