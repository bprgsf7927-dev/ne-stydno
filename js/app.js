/* Истори-тренажер, этап 1b.
   Уроки по 8 заданий, шесть механик, подготовка к контрольной уровнями, микс дня.
   Без сборки и без аккаунтов: прогресс в localStorage (схема v2). */

const SUBJECTS = [
  { id: 'istoria', title: 'Истори-тренажер', course: 'srednie-veka-6', courseTitle: 'История, 6 класс', on: true },
  { id: 'geografia', title: 'Гео-тренажер', course: null, courseTitle: '6 класс', on: false },
  { id: 'biologia', title: 'Био-тренажер', course: null, courseTitle: '6 класс', on: false },
];
const SUBJECT = SUBJECTS[0];
const COURSE = SUBJECT.course;
const LESSON_LEN = 8;
const STORE_KEY = 'istoria-trainer-v3';
const OLD_KEY2 = 'istoria-trainer-v2';
const OLD_KEY = 'istoria-trainer-v1';
const XP_PER_TASK = 10;

const $ = (id) => document.getElementById(id);
const shuffle = (a) => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
const pick = (a, n) => shuffle(a).slice(0, n);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const today = () => new Date().toISOString().slice(0, 10);

// ---------- хранилище ----------
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s) return s;
    const s2 = JSON.parse(localStorage.getItem(OLD_KEY2));
    if (s2) return { v: 3, xp: s2.xp || 0, streak: s2.streak || 0, lastDay: s2.lastDay || null, wrong: s2.wrong || [], seen: s2.seen || {}, moreClicks: s2.moreClicks || 0 };
    const old = JSON.parse(localStorage.getItem(OLD_KEY));
    if (old) return { v: 2, streak: old.streak || 0, lastDay: old.lastDay || null, wrong: old.wrongIds || [] };
  } catch { /* нет доступа к хранилищу — работаем в памяти */ }
  return {};
}
const state = Object.assign({ v: 3, xp: 0, streak: 0, lastDay: null, wrong: [], seen: {}, steps: {}, layouts: {}, hearts: 0, bosses: {}, gym: {}, current: null, moreClicks: 0 }, loadState());
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* приватный режим */ } }
function touchStreak() {
  const t = today();
  if (state.lastDay === t) return;
  const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  state.streak = state.lastDay === y ? state.streak + 1 : 1;
  state.lastDay = t; save();
}
function renderStats() { $('xp').innerHTML = STAR() + ' ' + state.xp; $('streak').innerHTML = FIRE() + ' ' + state.streak; $('pizza').innerHTML = PIZZA(); }

// ---------- персонажи (js/characters.js) ----------
const ROLE = { optimist: 'opti', panic: 'nik', nerd: 'dushka', neutral: null };
const MOOD = { optimist: 'happy', panic: 'upset', nerd: 'upset', neutral: 'idle' };
let lastChar = 'opti';
function speak(role, text) {
  const id = ROLE[role] || ['opti', 'nik', 'dushka'][Math.floor(Math.random() * 3)];
  lastChar = id;
  const costume = run && run.meta && run.meta.tid ? run.meta.tid : null;
  $('char-face').innerHTML = charSVG(id, MOOD[role], costume, 56);
  const line = charLine(id, MOOD[role]);
  $('char-say').innerHTML = `<b>${CHARS[id].name}:</b> ${esc(text ? `${line} ${text}` : line)}`;
}

// ---------- данные ----------
const D = {};
async function loadContent() {
  const names = ['topics', 'facts', 'terms', 'persons', 'causes', 'cloze', 'truefalse', 'lessons'];
  const res = await Promise.all(names.map(n => fetch(`content/${COURSE}/${n}.json?v=${window.APP_V || ''}`).then(r => { if (!r.ok) throw new Error(n); return r.json(); })));
  names.forEach((n, i) => D[n] = res[i]);
  D.factById = Object.fromEntries(D.facts.map(f => [f.id, f]));
  D.topicById = Object.fromEntries(D.topics.topics.map(t => [t.id, t]));
}
const byTopics = (arr, topics) => arr.filter(x => topics.includes(x.topic));

// ---------- экраны ----------
// прокручивается только середина экрана (main), панели сверху и снизу стоят на месте
const scrollTop = () => { $('app').scrollTop = 0; };
// автообновление: приложение с экрана «Домой» на айфоне подолгу живет в памяти и не видит новую версию.
// При возврате в приложение сверяем версию на сервере; если вышла новая — перезагружаемся (но не посреди тренировки).
let updateReady = false;
// новый адрес с ?v= — браузер не возьмет старую страницу из кэша
const reloadTo = (v) => location.replace(location.pathname + '?v=' + v);
async function checkUpdate() {
  try {
    const html = await (await fetch('index.html?check=' + Date.now(), { cache: 'no-store' })).text();
    const m = html.match(/window\.APP_V="([^"]+)"/);
    if (m && window.APP_V && m[1] !== window.APP_V && !location.search.includes('v=' + m[1])) { updateReady = m[1]; if ($('screen-task').classList.contains('hidden')) reloadTo(m[1]); }
  } catch (e) { /* нет сети — проверим в следующий раз */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkUpdate(); });
function show(id) {
  if (updateReady && id !== 'screen-task') { reloadTo(updateReady); return; }
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  $(id).classList.remove('hidden');
  // верхняя и нижняя панели закреплены на всех экранах, кроме стартовой; там подпись автора внутри экрана
  // на стартовой панелей нет — только персонажи, заголовок и «Начать»
  document.body.classList.toggle('on-welcome', id === 'screen-welcome');
  measureBars();
  if (id === 'screen-home') renderTabs('map');
  scrollTop();
}

// ---------- карта параграфа ----------
// Узлы параграфа: знакомство → тесты → сундук (после 2-го теста) → тесты → контрольная.
// Число тестов зависит от объема параграфа: каждый факт должен встретиться ~3 раза, тест покрывает ~16 упоминаний.
const REPEATS = 3, PER_TEST = 16, MIN_TESTS = 3, MAX_TESTS = 8;
function topicFactCount(tid) { return D.facts.filter(f => f.topic === tid).length + D.terms.filter(t => t.topic === tid).length + D.persons.filter(p => p.topic === tid).length; }
function testsFor(tid) { return Math.max(MIN_TESTS, Math.min(MAX_TESTS, Math.round(topicFactCount(tid) * REPEATS / PER_TEST))); }
function planFor(tid) {
  const n = testsFor(tid), plan = [];
  for (let i = 0; i < n; i++) { plan.push('step'); if (i === 1) plan.push('chest'); }
  plan.push('exam');
  return plan;
}
const LANES = ['c', 'r', 'c', 'l', 'c', 'r', 'c', 'l', 'c', 'r', 'c', 'l'];
const STEP_MECH = [ // механики теста по номеру; первые два — проще (без порядка и ввода), дальше по кругу
  ['pairs', 'choice', 'tf', 'cloze', 'pairs', 'choice', 'pairsx', 'tf'],
  ['choice', 'pairsx', 'tf', 'choice', 'cloze', 'pairs', 'choice', 'tf'],
  ['tf', 'pairs', 'choice', 'type', 'order', 'choice', 'cloze', 'pairsx'],
  ['pairs', 'type', 'choice', 'cloze', 'tf', 'order', 'choice', 'pairs'],
  ['order', 'choice', 'pairsx', 'type', 'tf', 'pairs', 'cloze', 'choice'],
  ['choice', 'order', 'pairs', 'type', 'cloze', 'pairsx', 'tf', 'type'],
];
// каракули-иконки узлов (рисуются ручкой, как персонажи)
// штриховка ручкой: косые линии внутри фигуры
const HATCH = (id, col) => `<defs><pattern id="${id}" width="3.5" height="3.5" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><path d="M0 0v3.5" stroke="${col}" stroke-width="2.6"/></pattern></defs>`;
let _hid = 0;
const HEART = (on) => { const id = 'hh' + (_hid++); return `<svg viewBox="0 0 32 30" width="24" height="22">${HATCH(id, '#D9480F')}<path d="M16 27L4 15Q-1 9 5 5q6-3 11 4q5-7 11-4q6 4 1 10z" fill="${on ? 'url(#' + id + ')' : 'none'}" stroke="#1e2235" stroke-width="2.5" stroke-linejoin="round"/></svg>`; };
const STAR = () => `<svg viewBox="0 0 32 32" width="22" height="22">${HATCH('hs', '#e0a800')}<path d="M16 3l4 9l9 1l-7 6l2 10l-8-5l-8 5l2-10l-7-6l9-1z" fill="url(#hs)" stroke="#1e2235" stroke-width="2.2" stroke-linejoin="round"/></svg>`;
const FIRE = () => `<svg viewBox="0 0 32 32" width="22" height="22">${HATCH('hf', '#e8641b')}<path d="M16 2q2 7 7 11q5 6 1 13q-4 5-9 4q-7-1-8-8q-1-6 4-10q-1 5 3 6q0-6 2-16z" fill="url(#hf)" stroke="#1e2235" stroke-width="2.2" stroke-linejoin="round"/></svg>`;
const PIZZA = () => `<svg viewBox="0 0 32 32" width="24" height="24">${HATCH('hp', '#e8a43b')}<path d="M4 6l24 4l-16 20z" fill="url(#hp)" stroke="#1e2235" stroke-width="2.2" stroke-linejoin="round"/><path d="M4 6q14 0 24 4" stroke="#D9480F" stroke-width="3" fill="none"/><circle cx="12" cy="12" r="2" fill="#D9480F"/><circle cx="17" cy="16" r="2" fill="#D9480F"/><circle cx="11" cy="20" r="1.8" fill="#D9480F"/></svg>`;
const DONATE_URL = 'https://pay.cloudtips.ru/p/266b3d2a'; // CloudTips, аккаунт Алены
const heartsHTML = (n, max = 3) => Array.from({ length: max }, (_, i) => HEART(i < n)).join('');
const DOODLE = {
  star:  '<path d="M32 8l7 16l17 2l-13 11l5 17l-16-9l-16 9l5-17l-13-11l17-2z"/>',
  check: '<path d="M14 34l12 12l26-28"/>',
  chest: '<path d="M8 26q24-20 48 0l1 26H7z"/><path d="M8 26h48"/><path d="M20 26v-12M44 26v-12"/><path d="M28 32h8v8h-8z"/><path d="M32 36v4"/><path d="M8 40h48"/>',
  exam:  '<path d="M18 8h22l10 10v38H18z"/><path d="M24 30h20M24 40h14M40 8v10h10"/>',
  trophy:'<path d="M20 10h24v14q0 14-12 14t-12-14z"/><path d="M20 14q-10 0-8 10q2 8 10 8M44 14q10 0 8 10q-2 8-10 8M32 38v10M22 50h20"/>',
  boss:  '<path d="M16 44q-6-26 16-32q22 6 16 32z"/><path d="M22 20l-8-10M42 20l8-10M26 28q3-4 6 0M38 28q3-4 6 0M24 40q8-6 16 0"/>',
  lock:  '<path d="M20 28h24v22H20z"/><path d="M24 28v-8q8-10 16 0v8"/>',
  book:  '<path d="M10 14q11-4 22 2v34q-11-6-22-2z"/><path d="M32 16q11-6 22-2v34q-11-4-22 2"/><path d="M16 24h10M16 32h10M38 24h10M38 32h10"/>',
};
// корона за 100%: кривая, золотая штриховка
const CROWN = () => `<svg class="crown" viewBox="0 0 64 40" width="44" height="28">${HATCH('hc', '#e0a800')}<path d="M6 34l-2-24l14 10l14-16l14 16l14-10l-2 24z" fill="url(#hc)" stroke="#1e2235" stroke-width="3" stroke-linejoin="round"/><path d="M8 34h48" stroke="#1e2235" stroke-width="3"/><circle cx="4" cy="10" r="2.5" fill="#1e2235"/><circle cx="32" cy="4" r="2.5" fill="#1e2235"/><circle cx="60" cy="10" r="2.5" fill="#1e2235"/></svg>`;
const dood = (k, col) => `<svg viewBox="0 0 64 64" width="36" height="36" fill="none" stroke="${col}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${DOODLE[k]}</svg>`;
// кривой кружок узла
const wobble = (col, fill, r = 44) => { let d = ''; for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI * 2, rr = r + Math.sin(i * 2.7) * 3 + (i % 3) * 1.5; d += (i ? 'L' : 'M') + (50 + Math.cos(a) * rr).toFixed(1) + ' ' + (50 + Math.sin(a) * rr).toFixed(1); } return `<svg class="ring" viewBox="0 0 100 100"><path d="${d}z" fill="${fill}" stroke="${col}" stroke-width="4" stroke-linejoin="round"/></svg>`; };
const EPOCH = { '15': '🏹', '16-17': '🐉', '18': '🐘', '19': '🐪', '20': '🦅', '21-22': '🏰', '23': '🕌', '24': '🧭' };

// дорожка: кривой пунктир от предыдущего узла (выше) к текущему
function trailSVG(from, to) {
  const x = { l: 22, c: 50, r: 78 };
  const x1 = x[from], x2 = x[to];
  let d = `M${x1} -6`;
  for (let i = 1; i <= 6; i++) { const t = i / 6; const x = x1 + (x2 - x1) * t + Math.sin(i * 2.1) * 5 + (i % 2 ? 3 : -3); const y = -6 + 60 * t + (i % 2 ? 2 : -2); d += ` L${x.toFixed(1)} ${y.toFixed(1)}`; }
  return `<svg viewBox="0 0 100 60" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="#1e2235" stroke-width="2" stroke-dasharray="5 6" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/></svg>`;
}
function topicOrder() { return D.topics.chapters.flatMap(c => c.topics); }
function prevTopic(tid) { const o = topicOrder(); const i = o.indexOf(tid); return i > 0 ? o[i - 1] : null; }
// сундук повторяет ближайший пройденный раньше параграф (если начал курс с середины — не спросит то, чего не учил)
function chestTopic(tid) { let t = prevTopic(tid); while (t && !stepDone(t, 0)) t = prevTopic(t); return t; }
function nextTopic(tid) { const o = topicOrder(); const i = o.indexOf(tid); return i < o.length - 1 ? o[i + 1] : null; }
const BOOK_SHORT = { 'Всеобщая история': 'Средние века', 'История России': 'История России' };
const chName = (ch) => `глава ${ch.num || ch.id}`;
const ChName = (ch) => `Глава ${ch.num || ch.id}`;
function chById(id) { return D.topics.chapters.find(c => c.id === id); }
function chapterOf(tid) { return D.topics.chapters.find(c => c.topics.includes(tid)); }
function isLastInChapter(tid) { const ch = chapterOf(tid); return ch.topics[ch.topics.length - 1] === tid; }

// Раскладка фактов параграфа по тестам: фиксируется один раз на ученика.
function layoutFor(tid) {
  const n = testsFor(tid);
  if (state.layouts[tid] && state.layouts[tid].facts.length === n) return state.layouts[tid];
  const facts = D.facts.filter(f => f.topic === tid).map(f => f.id);
  const terms = D.terms.filter(t => t.topic === tid).map(t => t.id);
  const persons = D.persons.filter(p => p.topic === tid).map(p => p.id);
  const spread = (ids) => { // каждый id в ~3 теста из n (все тесты — если их 3)
    const steps = Array.from({ length: n }, () => []);
    shuffle(ids).forEach(id => pick([...Array(n).keys()], Math.min(n, REPEATS)).forEach(k => steps[k].push(id)));
    return steps;
  };
  const lay = { facts: spread(facts), terms: spread(terms), persons: spread(persons) };
  state.layouts[tid] = lay; save();
  return lay;
}
const stepKey = (tid, i) => `${tid}:${i}`;
function stepBest(tid, i) { return (state.steps[stepKey(tid, i)] || {}).best || 0; }
function stepDone(tid, i) { return stepBest(tid, i) >= 70; }
function nodeOpen(tid, idx) { // индекс в plan
  const plan = planFor(tid);
  if (plan[idx] === 'chest') return true;
  for (let k = 0; k < idx; k++) if (plan[k] !== 'chest' && !stepDone(tid, k)) return false;
  return true;
}
function topicDone(tid) { return planFor(tid).every((k, i) => k === 'chest' || stepDone(tid, i)); }
function stepNoOf(tid, idx) { return planFor(tid).slice(0, idx).filter(x => x === 'step').length; } // 0-based номер теста
function topicProgress(tid) { const p = planFor(tid); const all = p.map((k, i) => [k, i]).filter(([k]) => k !== 'chest'); return [all.filter(([, i]) => stepDone(tid, i)).length, all.length]; }

function currentTopic() {
  if (state.current && D.topicById[state.current]) return state.current;
  const first = topicOrder().find(t => !topicDone(t)) || topicOrder()[0];
  state.current = first; return first;
}

function renderHome() {
  $('picker').classList.add('hidden'); $('map').classList.remove('hidden'); document.querySelector('.home-row').classList.remove('hidden');
  const tid = currentTopic();
  const t = D.topicById[tid], ch = chapterOf(tid);
  const dailyPool = dailyFacts();
  const ready = dailyPool.length >= 3;
  $('daily').classList.toggle('off', !ready);
  $('daily-sub').textContent = ready ? '5 заданий из подзабытого' : 'появится после первой тренировки';
  $('daily-btn').disabled = !ready;
  $('topic-pill-para').textContent = `${BOOK_SHORT[ch.book] || ch.book} · ${ChName(ch)} · ${t.paragraph}`;
  $('topic-pill-title').textContent = t.title;
  $('hearts-home').innerHTML = heartsHTML(state.hearts);

  const box = $('map'); box.innerHTML = ''; sprinkle(box, 10, topicOrder().indexOf(tid) + 3);
  const plan = planFor(tid);
  let currentIdx = plan.findIndex((k, i) => k !== 'chest' && !stepDone(tid, i));
  if (currentIdx < 0) currentIdx = plan.length;
  let stepNo = 0;
  plan.forEach((kind, idx) => {
    const row = document.createElement('div');
    row.className = 'node-row ' + LANES[idx];
    const b = document.createElement('button');
    const open = nodeOpen(tid, idx) && !(kind === 'chest' && !chestTopic(tid));
    const best = stepBest(tid, idx);
    b.className = `node ${kind}` + (open ? '' : ' locked') + (idx === currentIdx ? ' current' : '') + (best >= 70 ? ' done' : '');
    b.disabled = !open;
    let icon = 'star', label = '';
    if (kind === 'step') { stepNo++; icon = best >= 70 ? 'check' : 'star'; }
    if (kind === 'chest') { icon = 'chest'; label = chestTopic(tid) ? `${D.topicById[chestTopic(tid)].paragraph}` : '<span class="small muted">когда будет что вспомнить</span>'; }
    if (kind === 'exam') { icon = best >= 70 ? 'trophy' : 'exam'; }
    if (!open) icon = 'lock';
    const col = !open ? '#9aa0a6' : best >= 70 ? '#3FA66A' : kind === 'chest' ? '#c48a00' : kind === 'exam' ? '#7c5cff' : '#1F3FBF';
    b.innerHTML = `${wobble(col, open ? '#ffffff' : '#f0f0ec')}<span class="node-icon">${dood(icon, col)}</span>${best === 100 ? CROWN() : ''}`;
    if (idx > 0) { const path = document.createElement('div'); path.className = 'trail'; path.innerHTML = trailSVG(LANES[idx-1], LANES[idx]); row.appendChild(path); }
    b.onclick = () => kind === 'step' ? startStep(tid, idx) : kind === 'chest' ? startChest(tid) : startTopicExam(tid);
    row.appendChild(b);
    const cap = document.createElement('div');
    cap.className = 'node-cap';
    cap.innerHTML = `${label}${best ? `<span class="small muted">${best}%</span>` : ''}`;
    row.appendChild(cap);
    if (idx === currentIdx) {
      const c = document.createElement('div'); c.className = 'mascot';
      const who = ['opti', 'nik', 'dushka'][idx % 3];
      c.innerHTML = charSVG(who, 'idle', tid, 60); row.appendChild(c);
    }
    box.appendChild(row);
  });

  // переход дальше
  const nt = nextTopic(tid);
  const foot = document.createElement('div'); foot.className = 'map-foot';
  const lastInCh = isLastInChapter(tid), chOpen = ch.topics.every(topicDone);
  if (lastInCh) foot.innerHTML = `<button class="btn ${chOpen ? 'primary' : ''}" id="to-boss" ${chOpen ? '' : 'disabled'}>${chOpen ? `Дальше: босс, ${chName(ch)} →` : `Босс, ${chName(ch)}: пройди все параграфы`}</button>`;
  else foot.innerHTML = nt ? `<button class="btn ${topicDone(tid) ? 'primary' : ''}" id="next-topic">Дальше: ${esc(D.topicById[nt].paragraph)} ${esc(D.topicById[nt].title)} →</button>` : '';
  box.appendChild(foot);
  if ($('next-topic')) $('next-topic').onclick = () => { state.current = nt; save(); renderHome(); scrollTop(); };
  if ($('to-boss')) $('to-boss').onclick = () => renderBoss(ch.id);
}

// список параграфов (плашка)
function renderTopicPicker() {
  const box = $('picker-list'); box.innerHTML = '';
  let book = null;
  for (const ch of D.topics.chapters) {
    if (ch.book !== book) {
      book = ch.book;
      const bh = document.createElement('div'); bh.className = 'picker-book'; bh.textContent = book; box.appendChild(bh);
    }
    const frame = document.createElement('div'); frame.className = 'picker-frame'; box.appendChild(frame);
    const h = document.createElement('div'); h.className = 'picker-ch'; h.innerHTML = `<span>${ChName(ch)}</span> ${esc(ch.title)}`; frame.appendChild(h);
    for (const tid of ch.topics) {
      const t = D.topicById[tid];
      const [done, total] = topicProgress(tid);
      const allPerfect = planFor(tid).every((k, i) => k === 'chest' || stepBest(tid, i) === 100);
      const b = document.createElement('button'); b.className = 'picker-item' + (tid === state.current ? ' active' : '') + (topicDone(tid) ? ' done' : '');
      const boxes = Array.from({ length: total }, (_, i) => `<span class="tick ${i < done ? 'on' : ''}"></span>`).join('');
      const who = ['opti', 'nik', 'dushka'][ch.topics.indexOf(tid) % 3];
      b.innerHTML = `<div class="picker-char">${charSVG(who, topicDone(tid) ? 'happy' : 'idle', tid, 34)}</div>
        <div class="picker-body"><div class="picker-para">${esc(t.paragraph)}</div><div class="picker-title">${esc(t.title)}</div><div class="ticks">${boxes}${allPerfect ? CROWN() : topicDone(tid) ? '<span class="small" style="color:var(--ok)">готово</span>' : ''}</div></div>`;
      b.onclick = () => { state.current = tid; save(); togglePicker(false); renderHome(); };
      frame.appendChild(b);
    }
    // босс главы — отдельной карточкой
    const open = ch.topics.every(topicDone), bs = bossState(ch.id);
    const lv = BOSS_LEVELS.filter(l => (bs['l' + l.id] || 0) >= 70).length;
    const bb = document.createElement('button'); bb.className = 'picker-item boss' + (open ? '' : ' locked') + (bs.won ? ' done' : '');
    bb.innerHTML = `<div class="picker-char">${BOSS_HOUSE[ch.id] || BOSS_HOUSE.VI}</div>
      <div class="picker-body"><div class="picker-para">Босс</div><div class="picker-title">Босс: ${chName(ch)}</div>
      <div class="ticks">${[0,1,2].map(i => `<span class="tick ${i < lv ? 'on' : ''}"></span>`).join('')}<span class="small muted">${open ? (bs.won ? 'повержен' : 'три уровня') : 'пройди все параграфы'}</span></div></div>`;
    bb.onclick = () => { if (!open) return; togglePicker(false); renderBoss(ch.id); };
    frame.appendChild(bb);
  }
}
const PICKER_FOOT = [
  'Две книги, десять боссов. Кто дойдет до Кремля — тот знает шестой класс лучше учителя. Ну, почти.',
  'Где-то в середине списка — 988 год. Владимир выбирал веру дольше, чем ты пройдешь параграф.',
  'Каждый параграф — это 6 шагов по три минуты. Вся книга — меньше, чем один сезон сериала.',
  'Где-то в середине этого списка — 1492 год. Колумб доплыл, доплывешь и ты.',
];
function togglePicker(open) {
  $('picker').classList.toggle('hidden', !open);
  $('map').classList.toggle('hidden', open);
  document.querySelector('.home-row').classList.toggle('hidden', open);
  if (open) { renderTopicPicker(); $('picker-foot').textContent = PICKER_FOOT[new Date().getDate() % PICKER_FOOT.length]; scrollTop(); }
}
$('topic-pill').onclick = () => togglePicker($('picker').classList.contains('hidden'));
function openSubjects() {
  $('hint-title').textContent = 'Предмет';
  $('hint-text').innerHTML = `<div class="subjects">${SUBJECTS.map(s => `<div class="subject${s.on ? ' on' : ''}${s.id === SUBJECT.id ? ' active' : ''}"><b>${esc(s.title)}</b><span class="small muted">${s.on ? esc(s.courseTitle) : 'скоро'}</span></div>`).join('')}</div><p class="small muted">Пока только история. Другие предметы появятся, когда допилим этот.</p>`;
  $('hint').classList.remove('hidden');
}
$('subject-btn').onclick = openSubjects;
$('picker-close').onclick = () => togglePicker(false);

// ---------- экран босса главы: три уровня ----------
const BOSS_HOUSE = {
  // юрта, криво: дрожащий купол, войлочные полосы, дымок
  V:  '<svg class="house" viewBox="0 0 120 100" fill="none" stroke="#1e2235" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 80q6-30 24-44q12-10 26-11q16 1 26 12q14 14 22 42l-4 3q-46 4-92 1z"/><path d="M22 60q38-10 78 2M16 72q44-8 90 1"/><path d="M48 82v-20q12-9 24 1v20"/><path d="M60 24q-2-6 1-10q4 3 1 10M62 14q-6-8 2-12q6 6 2 11"/><path d="M68 10q6-6 2-12M72 4q8-4 4-10"/><path d="M30 46q3-2 6 1M84 44q3-2 6 2"/></svg>',
  // замок, криво: зубцы разной высоты, флаг, окошки
  // романская церковь: толстые стены, полукруглые арки, башенка
  I:  '<svg class="house" viewBox="0 0 120 100" fill="none" stroke="#1e2235" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 88V52l46-22 46 22v36z"/><path d="M48 40V12l12-6 12 6v27"/><path d="M60 6V-2M56 2h8"/><path d="M50 88V70q10-12 20 0v18"/><path d="M26 64q4-6 8 0v8h-8zM86 64q4-6 8 0v8h-8z"/><path d="M56 22q4-5 8 0v6h-8z"/></svg>',
  // мечеть: купол, минарет с полумесяцем
  II: '<svg class="house" viewBox="0 0 120 100" fill="none" stroke="#1e2235" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 88V58h64v30z"/><path d="M20 58q2-28 30-30q28 2 30 30"/><path d="M50 28v-8"/><path d="M92 88V30h12v58"/><path d="M90 30l8-14 8 14"/><path d="M98 16q-6-6 0-12q-2 6 4 8"/><path d="M42 88V72q8-10 16 0v16"/></svg>',
  // мельница у деревни
  III: '<svg class="house" viewBox="0 0 120 100" fill="none" stroke="#1e2235" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M44 88l4-50h24l4 50z"/><path d="M46 38l14-12 14 12"/><path d="M60 30L28 8M60 30l32-22M60 30L30 54M60 30l30 24"/><path d="M28 8l-6 8 10 4M92 8l6 8-10 4"/><path d="M54 88V74q6-6 12 0v14"/><path d="M6 88h108"/></svg>',
  // готический собор: две башни со шпилями, роза
  IV: '<svg class="house" viewBox="0 0 120 100" fill="none" stroke="#1e2235" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 88V30l10-24 10 24v58M78 88V30l10-24 10 24v58"/><path d="M42 88V46l18-16 18 16v42"/><circle cx="60" cy="52" r="7"/><path d="M52 88V72q8-14 16 0v16"/><path d="M28 44q4-8 8 0v10h-8zM84 44q4-8 8 0v10h-8z"/></svg>',
  // терем: высокая крыша-бочка, крыльцо, резные наличники
  R1: '<svg class="house" viewBox="0 0 120 100" fill="none" stroke="#1e2235" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M28 88V48l32-2 32 3-1 39z"/><path d="M22 50q18-34 38-42q22 8 40 43"/><path d="M44 30q16-14 32 0"/><path d="M50 88V66q10-8 20 0v22"/><path d="M34 58h10v10H34zM76 57h10v11H76z"/><path d="M32 54q7-5 14 0M74 53q7-5 14 1"/><path d="M60 8V0"/></svg>',
  // белокаменный храм: луковка, крест, арки-закомары
  R2: '<svg class="house" viewBox="0 0 120 100" fill="none" stroke="#1e2235" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M26 88V50l68 1-1 37z"/><path d="M26 52q11-14 23 0q11-14 22 0q11-14 23 0"/><path d="M44 42V30l32 1v11"/><path d="M48 30q-2-14 12-20q14 6 12 21"/><path d="M60 10V0M55 4h10"/><path d="M52 88V70q8-8 16 0v18"/><path d="M36 62v8M84 61v9"/></svg>',
  // ордынский шатер с бунчуком
  R3: '<svg class="house" viewBox="0 0 120 100" fill="none" stroke="#1e2235" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 86q20-30 46-62q26 32 46 62q-46 4-92 0z"/><path d="M60 24q-12 30-10 62M60 24q12 30 10 62"/><path d="M50 86q10-16 20 0"/><path d="M60 24V4"/><path d="M60 6q8 2 10 10q-8-1-10-6"/><path d="M28 72q6-3 10 1M84 71q6-3 10 2"/></svg>',
  // кремлевская башня: шатер, ласточкины хвосты
  R4: '<svg class="house" viewBox="0 0 120 100" fill="none" stroke="#1e2235" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 88V66l4-5 3 5 4-5 3 5 4-5 3 5h8M80 66h8l3-5 4 5 3-5 4 5 3-5 4 5v22z"/><path d="M8 88h104"/><path d="M40 88V44l40 1-1 43z"/><path d="M38 46q11-1 22-28q11 27 22 28"/><path d="M60 18V4M56 8l4-5 4 5"/><path d="M52 88V72q8-8 16 0v16"/><path d="M50 56h20"/></svg>',
  VI: '<svg class="house" viewBox="0 0 120 100" fill="none" stroke="#1e2235" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 88V38l10 2-1-11 12-1v10l12 1-1-14 11-2 1 15 12 1-1-10 12-1 1 12 11-2-1 50z"/><path d="M48 88V62q12-12 25 1v25"/><path d="M28 54l9 1-1 9-8-1zM84 52l9 1-1 10-9-1z"/><path d="M61 25l-1-20 16 5-15 5"/><path d="M22 76q8-2 14 1M86 74q8-3 14 1"/></svg>',
};
const BOSS_LEVELS = [
  { id: 1, title: 'Разминка', sub: 'пары и правда-ложь · 10', n: 10 },
  { id: 2, title: 'Как учитель спросит', sub: 'порядок, вставка, причины · 10', n: 10 },
  { id: 3, title: 'Босс', sub: 'даты с клавиатуры · 8 · жизни', n: 8 },
];
function bossState(chId) { return state.bosses[chId] || {}; }
function renderBoss(chId) {
  const ch = D.topics.chapters.find(c => c.id === chId), bs = bossState(chId);
  $('boss-house').innerHTML = BOSS_HOUSE[chId] || BOSS_HOUSE.VI;
  $('boss-title').textContent = `Босс: ${chName(ch)}`; $('boss-title').dataset.ch = ch.id;
  const nt = nextTopic(ch.topics[ch.topics.length - 1]); $('boss-next').classList.toggle('hidden', !bs.won || !nt); if (nt) $('boss-next').textContent = `Дальше: ${D.topicById[nt].paragraph} ${D.topicById[nt].title} →`;
  $('boss-sub').textContent = ch.title;
  $('boss-hearts').innerHTML = heartsHTML(state.hearts);
  const list = $('boss-levels'); list.innerHTML = '';
  BOSS_LEVELS.forEach((lv, i) => {
    const best = bs['l' + lv.id] || 0;
    const open = i === 0 || (bs['l' + BOSS_LEVELS[i - 1].id] || 0) >= 70;
    const b = document.createElement('button');
    b.className = 'level' + (open ? '' : ' locked') + (best >= 70 ? ' done' : '');
    b.disabled = !open;
    b.innerHTML = `<b>${lv.id}. ${lv.title}</b><span>${lv.sub}</span><em>${!open ? 'нужно 70% выше' : best ? best + '%' : ''}</em>`;
    b.onclick = () => startBoss(chId, lv.id);
    list.appendChild(b);
  });
  $('boss-badge').classList.toggle('hidden', !bs.won);
  show('screen-boss');
}
$('boss-back').onclick = () => { renderHome(); show('screen-home'); };
$('boss-next').onclick = () => { const chId = $('boss-title').dataset.ch; const ch = D.topics.chapters.find(c => c.id === chId); const nt = nextTopic(ch.topics[ch.topics.length - 1]); if (nt) { state.current = nt; save(); } renderHome(); show('screen-home'); };

// ---------- карточки перед уроком ----------
let cards = null;
function openCards(tid, idx, peek = false) {
  const t = D.topicById[tid];
  const cardsOf = (facts, terms, persons) => [
    ...facts.map(f => ({ front: f.date, back: f.event, kind: 'дата' })),
    ...terms.map(x => ({ front: x.term, back: x.definition, kind: 'термин' })),
    ...persons.map(x => ({ front: x.name, back: x.who, kind: 'кто это' })),
  ];
  let list;
  if (peek) { // перед тестом: только материал этого теста
    const lay = layoutFor(tid), k = stepNoOf(tid, idx), p = topicPool(tid);
    const sub = (all, ids) => { const s = all.filter(x => ids.includes(x.id)); return s.length ? s : all; };
    list = cardsOf(sub(p.facts, lay.facts[k]), sub(p.terms, lay.terms[k]), sub(p.persons, lay.persons[k]));
  } else list = cardsOf(D.facts.filter(f => f.topic === tid), D.terms.filter(x => x.topic === tid), D.persons.filter(x => x.topic === tid));
  cards = { tid, idx, peek, i: 0, flipped: false, list, seen: new Set([0]) };
  $('cards-title').textContent = peek ? `${t.paragraph} · освежить память` : `${t.paragraph} · Знакомство`;
  $('cards-sub').textContent = peek ? 'Только то, что будет в этой тренировке.' : `${list.length} карточек: даты, термины, имена. Нажми, чтобы перевернуть. Долистай до конца — и откроется первая тренировка.`;
  $('cards-start').textContent = peek ? 'Поехали' : 'Я все посмотрел';
  $('cards-start').disabled = !peek;
  renderCard();
  show('screen-cards');
}
function renderCard() {
  const f = cards.list[cards.i];
  $('flip-front').innerHTML = cards.flipped ? `<div class="small muted">${esc(f.front)}</div><div>${esc(f.back)}</div>` : `<div class="date">${esc(f.front)}</div><div class="small muted">${f.kind} · нажми</div>`;
  $('flip').classList.toggle('back', cards.flipped);
  const f2 = cards.list[cards.i]; const grp = cards.list.filter(x => x.kind === f2.kind); const gi = grp.indexOf(f2) + 1;
  $('cards-count').innerHTML = `<b>${esc(f2.kind)}</b> ${gi}/${grp.length} <span class="muted">· всего ${cards.i + 1}/${cards.list.length}</span>`;
  if (!cards.peek && cards.seen.size === cards.list.length) $('cards-start').disabled = false;
}
$('flip').onclick = () => { cards.flipped = !cards.flipped; renderCard(); };
$('cards-prev').onclick = () => { cards.i = (cards.i - 1 + cards.list.length) % cards.list.length; cards.flipped = false; cards.seen.add(cards.i); renderCard(); };
$('cards-next').onclick = () => { cards.i = (cards.i + 1) % cards.list.length; cards.flipped = false; cards.seen.add(cards.i); renderCard(); };
$('cards-start').onclick = () => {
  if (cards.peek) return runStep(cards.tid, cards.idx);
  // знакомство пройдено
  const key = stepKey(cards.tid, cards.idx); state.steps[key] = { best: 100, rounds: ((state.steps[key] || {}).rounds || 0) + 1 }; save();
  renderHome(); show('screen-home');
};
$('cards-home').onclick = () => { renderHome(); show('screen-home'); };
$('soon-back').onclick = () => { renderHome(); show('screen-home'); };

// ---------- генераторы заданий ----------
// Каждое задание: { kind, render(el), check() -> {ok, half?, answerText}, fact? }
const yearFacts = (facts) => facts.filter(f => f.year && !/в\./.test(f.date));

function tChoiceDate(fact, pool) {
  const ask = Math.random() < 0.5;
  const others = pool.filter(f => f.id !== fact.id);
  if (ask) { // событие → дата
    const opts = shuffle([fact.date, ...pick([...new Set(others.filter(f => f.date !== fact.date).map(f => f.date))], 3)]);
    return choice(`Когда: ${fact.event}?`, opts, fact.date, fact);
  }
  const opts = shuffle([fact.event, ...pick(others.filter(f => f.event !== fact.event).map(f => f.event), 3)]);
  return choice(`${fact.date} — что произошло?`, opts, fact.event, fact);
}
function tChoiceTerm(term, pool) {
  const opts = shuffle([term.definition, ...pick(pool.filter(t => t.id !== term.id).map(t => t.definition), 3)]);
  return choice(`${term.term} — это…`, opts, term.definition, null, `${term.term} — ${term.definition[0].toLowerCase() + term.definition.slice(1)}`);
}
function tChoicePerson(p, pool) {
  const opts = shuffle([p.who, ...pick(pool.filter(x => x.id !== p.id).map(x => x.who), 3)]);
  return choice(`${p.name} — кто это?`, opts, p.who, null, `${p.name} — ${p.who[0].toLowerCase() + p.who.slice(1)}`);
}
function tCause(c) {
  const opts = shuffle([c.effect, ...c.wrong]);
  return choice(`${c.cause}. Что из этого следует?`, opts, c.effect, null, `${c.cause} → ${c.effect[0].toLowerCase() + c.effect.slice(1)}`);
}
function choice(q, opts, answer, fact, answerText, lead = false) {
  let chosen = null;
  return {
    kind: lead ? 'lead' : 'choice', lead, fact, answerText: answerText || (fact ? `${fact.date} — ${fact.event}` : answer),
    render(el, hint = 0) {
      // подсказка: уровень 1 убирает один неверный вариант, уровень 2 оставляет два
      let shown = opts;
      if (hint > 0 && opts.length > 2) { const wrong = shuffle(opts.filter(o => o !== answer)); shown = shuffle([answer, ...wrong.slice(0, hint === 1 ? opts.length - 2 : 1)]); }
      el.innerHTML = `${lead ? '<p class="lead-tag">первая встреча</p>' : ''}${hintTag(hint)}<h2>${esc(q)}</h2><div class="options">${shown.map(o => `<button class="opt">${esc(o)}</button>`).join('')}</div>`;
      el.querySelectorAll('.opt').forEach(b => b.onclick = () => {
        chosen = b.textContent;
        el.querySelectorAll('.opt').forEach(x => { x.disabled = true; if (x.textContent === answer) x.classList.add('correct'); });
        if (chosen !== answer) b.classList.add('wrong');
        finishTask(chosen === answer);
      });
    },
  };
}

const PAIR_LIMIT = 3;
function tPairs(facts) {
  return pairsTask(pick(facts, Math.min(4, facts.length)).map(f => ({ id: f.id, l: f.date, r: f.event })), 'Соедини даты и события');
}
function tPairsTerms(terms) {
  return pairsTask(pick(terms, 4).map(t => ({ id: t.id, l: t.term, r: t.definition })), 'Соедини термины и значения');
}
function tPairsPersons(persons) {
  return pairsTask(pick(persons, 4).map(p => ({ id: p.id, l: p.name, r: p.who })), 'Кто есть кто: соедини');
}
function pairsTask(set, title) {
  return {
    kind: 'pairs', answerText: set.map(x => `${x.l} — ${x.r}`).join('; '), quiet: true,
    render(el, hint = 0) {
      let left = null, mistakes = 0, done = 0;
      const pre = new Set(hint === 1 ? [set[0].id] : hint >= 2 ? set.slice(0, set.length - 2).map(x => x.id) : []);
      const L = shuffle(set), R = shuffle(set);
      el.innerHTML = `${hintTag(hint)}<h2>${esc(title)}</h2><div class="pairs">${
        L.map((x, i) => `<button class="pair${pre.has(x.id) ? ' matched' : ''}" data-id="${x.id}" data-side="l">${esc(x.l)}</button><button class="pair${pre.has(R[i].id) ? ' matched' : ''}" data-id="${R[i].id}" data-side="r">${esc(R[i].r)}</button>`).join('')}</div>`;
      done = pre.size;
      const all = () => el.querySelectorAll('.pair');
      all().forEach(b => b.onclick = () => {
        if (b.classList.contains('matched') || b.disabled) return;
        if (!left || left.dataset.side === b.dataset.side) { all().forEach(x => x.classList.remove('sel')); left = b; b.classList.add('sel'); return; }
        if (left.dataset.id === b.dataset.id) {
          [left, b].forEach(x => { x.classList.remove('sel'); x.classList.add('matched'); });
          if (++done === set.length) finishTask(mistakes === 0);
        } else {
          mistakes++;
          [left, b].forEach(x => x.classList.add('shake'));
          setTimeout(() => all().forEach(x => x.classList.remove('shake', 'sel')), 400);
          if (mistakes >= PAIR_LIMIT) { // показываем пары и идем дальше, задание не засчитано
            all().forEach(x => { x.disabled = true; x.classList.remove('sel'); if (!x.classList.contains('matched')) x.classList.add('reveal'); });
            finishTask(false);
          }
        }
        left = null;
      });
    },
  };
}

function tOrder(facts) {
  const uniq = []; const seen = new Set();
  for (const f of shuffle(facts)) { if (!seen.has(f.year)) { seen.add(f.year); uniq.push(f); } if (uniq.length === 4) break; }
  const sorted = [...uniq].sort((a, b) => a.year - b.year);
  return {
    kind: 'order', answerText: sorted.map(f => `${f.date} ${f.event}`).join(' → '),
    render(el, hint = 0) {
      const preN = hint === 1 ? 1 : hint >= 2 ? Math.max(0, sorted.length - 2) : 0;
      const chosen = sorted.slice(0, preN).map(f => f.id);
      el.innerHTML = `${hintTag(hint)}<h2>Расставь по порядку: от раннего к позднему</h2><div class="slots" id="slots">${sorted.map((f, i) => i < preN ? `<div class="slot filled">${i + 1}. ${esc(f.event)}</div>` : `<div class="slot">${i + 1}</div>`).join('')}</div>
        <div class="options" id="order-opts">${shuffle(uniq.filter(f => !chosen.includes(f.id))).map(f => `<button class="opt" data-id="${f.id}">${esc(f.event)}${hint >= 1 ? ` <span class="small muted">(${esc(String(f.date))})</span>` : ''}</button>`).join('')}</div>`;
      el.querySelectorAll('#order-opts .opt').forEach(b => b.onclick = () => {
        if (b.disabled) return;
        b.disabled = true; chosen.push(+b.dataset.id);
        const slot = el.querySelectorAll('.slot')[chosen.length - 1];
        slot.textContent = `${chosen.length}. ${b.firstChild.textContent}`; slot.classList.add('filled');
        if (chosen.length === sorted.length) {
          const ok = chosen.every((id, i) => id === sorted[i].id);
          el.querySelectorAll('.slot').forEach((s, i) => s.classList.add(chosen[i] === sorted[i].id ? 'correct' : 'wrong'));
          finishTask(ok);
        }
      });
    },
  };
}

function tCloze(c) {
  return {
    kind: 'cloze', answerText: c.text.replace(/\{(\d)\}/g, (_, i) => c.answers[+i]),
    render(el, hint = 0) {
      const filled = [];
      const words = shuffle(hint >= 1 ? [...c.answers] : [...c.answers, ...c.extra]);
      const html = c.text.replace(/\{(\d)\}/g, (_, i) => `<span class="blank" data-i="${i}">${hint >= 2 ? esc(c.answers[+i][0]) + '___' : '____'}</span>`);
      el.innerHTML = `${hintTag(hint)}<h2>Вставь пропущенное</h2><p class="cloze">${html}</p><div class="chips">${words.map(w => `<button class="chip">${esc(w)}</button>`).join('')}</div>`;
      const blanks = el.querySelectorAll('.blank');
      el.querySelectorAll('.chip').forEach(ch => ch.onclick = () => {
        if (ch.disabled || filled.length >= blanks.length) return;
        ch.disabled = true; filled.push({ w: ch.textContent, chip: ch });
        blanks[filled.length - 1].textContent = ch.textContent; blanks[filled.length - 1].classList.add('filled');
        if (filled.length === blanks.length) {
          const ok = filled.every((f, i) => f.w === c.answers[i]);
          blanks.forEach((b, i) => b.classList.add(filled[i].w === c.answers[i] ? 'correct' : 'wrong'));
          finishTask(ok);
        }
      });
      blanks.forEach((b, i) => b.onclick = () => { // убрать слово назад
        if (filled.length !== i + 1 || b.classList.contains('correct') || b.classList.contains('wrong')) return;
        const f = filled.pop(); f.chip.disabled = false; b.textContent = hint >= 2 ? c.answers[i][0] + '___' : '____'; b.classList.remove('filled');
      });
    },
  };
}

function tTrueFalse(s) {
  return {
    kind: 'tf', answerText: s.isTrue ? `Верно: ${s.statement}` : `Неверно. ${s.note}`,
    render(el, hint = 0) {
      el.innerHTML = `${hintTag(hint)}<h2>Правда или ложь?</h2><p class="statement">${esc(s.statement)}</p>${hint >= 2 ? `<p class="small muted">Подумай: ${esc(s.isTrue ? 'похоже на правду, если ничего не перепутано' : 'что-то здесь не сходится — дата, место или кто')}.</p>` : ''}<div class="options tf"><button class="opt" data-v="1">Правда</button><button class="opt" data-v="0">Ложь</button></div>`;
      el.querySelectorAll('.opt').forEach(b => b.onclick = () => {
        const v = b.dataset.v === '1';
        el.querySelectorAll('.opt').forEach(x => { x.disabled = true; if ((x.dataset.v === '1') === s.isTrue) x.classList.add('correct'); });
        if (v !== s.isTrue) b.classList.add('wrong');
        finishTask(v === s.isTrue);
      });
    },
  };
}

function tType(fact) {
  const period = /[—-]/.test(fact.date) && !/^ок/.test(fact.date);
  return {
    kind: 'type', fact, answerText: `${fact.date} — ${fact.event}`,
    render(el, hint = 0) {
      const y = String(fact.year);
      const mask = y.split('').map((ch, i) => (i === 1 || i === y.length - 1) ? '_' : ch).join('');
      const h = hint === 1 ? `<p class="small muted">Подсказка: ${fact.century}-й век, то есть ${y[0]}${y.length === 4 ? y[1] : ''}__.</p>` : hint >= 2 ? `<p class="small muted">Подсказка: ${esc(mask)}</p>` : '';
      el.innerHTML = `${hintTag(hint)}<h2>${period ? 'В каком году началось' : 'В каком году'}: ${esc(fact.event)}?</h2>${h}
        <input class="year" id="year-input" type="number" inputmode="numeric" placeholder="год" min="100" max="1600">`;
      const inp = el.querySelector('#year-input');
      inp.focus();
      const btn = $('check-btn');
      btn.classList.remove('hidden');
      btn.onclick = () => {
        const v = parseInt(inp.value, 10);
        if (!v) { inp.focus(); return; }
        btn.classList.add('hidden'); inp.disabled = true;
        const diff = Math.abs(v - fact.year);
        inp.classList.add(diff === 0 ? 'correct' : 'wrong');
        finishTask(diff === 0, diff === 1);
      };
      inp.onkeydown = (e) => { if (e.key === 'Enter') btn.onclick(); };
    },
  };
}

const hintTag = (h) => h === 1 ? '<p class="hint-tag">еще раз, ты справишься</p>' : h >= 2 ? '<p class="hint-tag strong">с подсказкой</p>' : '';

// ---------- подводки: первая встреча с фактом, ответ почти очевиден из контекста ----------
const SILLY = ['Это про футбол.', 'Это рецепт пирога.', 'Это название группы в телефоне.', 'Это марка машины.', 'Так называли домашнего кота.', 'Это погода на завтра.'];
function leadKey(x) { return x.date !== undefined ? 'f' + x.id : x.term !== undefined ? 't' + x.id : 'p' + x.id; }
function tLeadFact(f) { // дата + событие в контексте, пропуск — ключевое слово события
  const words = f.event.split(' ').filter(w => w.length > 4 && /^[А-ЯЁ]/.test(w));
  const key = words.length ? words[Math.floor(words.length / 2)] : null;
  if (!key) return tLeadFactDate(f);
  const text = f.event.replace(key, '____');
  const wrong = pick(SILLY.map(s => s.split(' ')[1]).concat(['Колумб', 'Наполеон', 'Пушкин']), 1)[0];
  return choice(`${f.date}: ${text}`, shuffle([key, wrong]), key, f, `${f.date} — ${f.event}`, true);
}
function tLeadFactDate(f) {
  const d = String(f.date); const fake = /^\d{4}/.test(d) ? String(+d.slice(0, 4) + 300) : '2024';
  return choice(`${f.event}. Когда?`, shuffle([d, fake]), d, f, `${f.date} — ${f.event}`, true);
}
function tLeadTerm(t) { // перефразируй своими словами
  const opts = shuffle([t.definition, ...pick(SILLY, 2)]);
  return choice(`${t.term}. Своими словами — это…`, opts, t.definition, null, `${t.term} — ${t.definition[0].toLowerCase() + t.definition.slice(1)}`, true);
}
function tLeadPerson(p) {
  const opts = shuffle([p.who, ...pick(SILLY, 2)]);
  return choice(`${p.name}. Кто это, судя по всему?`, opts, p.who, null, `${p.name} — ${p.who[0].toLowerCase() + p.who.slice(1)}`, true);
}
function markMet(items) { state.met = state.met || {}; items.forEach(x => state.met[leadKey(x)] = 1); save(); }
function unmet(pool) { const m = state.met || {}; return [...pool.facts, ...pool.terms, ...pool.persons].filter(x => !m[leadKey(x)]); }

// ---------- сборка шага / сундука / контрольной / босса ----------
function buildTasksFrom(pool, mech) {
  // pool: {facts, terms, persons, causes, cloze, tf} — массивы объектов; mech — список механик
  const yf = yearFacts(pool.facts);
  const wrongFirst = [...pool.facts.filter(f => state.wrong.includes(f.id)), ...shuffle(pool.facts.filter(f => !state.wrong.includes(f.id)))];
  let fi = 0; const nextFact = () => wrongFirst[fi++ % wrongFirst.length];
  const usedTf = new Set(), usedCloze = new Set(), usedCause = new Set();
  const tasks = [];
  const allFacts = D.facts, allTopicFacts = pool.allFacts || pool.facts;
  for (const m of mech) {
    if (m === 'pairs' && pool.facts.length >= 3) tasks.push(tPairs(pool.facts.length >= 4 ? pool.facts : allTopicFacts));
    else if (m === 'pairsx' && (pool.terms.length >= 4 || pool.persons.length >= 4)) tasks.push(pool.terms.length >= 4 && (pool.persons.length < 4 || Math.random() < 0.5) ? tPairsTerms(pool.terms) : tPairsPersons(pool.persons));
    else if ((m === 'pairsx' || m === 'pairs') && allTopicFacts.length >= 3) tasks.push(tPairs(allTopicFacts));
    else if (m === 'order' && yearFacts(allTopicFacts).length >= 4) tasks.push(tOrder(yf.length >= 4 ? pool.facts : allTopicFacts));
    else if (m === 'cloze' && pool.cloze.some(c => !usedCloze.has(c.id))) { const c = pick(pool.cloze.filter(c => !usedCloze.has(c.id)), 1)[0]; usedCloze.add(c.id); tasks.push(tCloze(c)); }
    else if (m === 'tf' && pool.tf.some(x => !usedTf.has(x.id))) { const x = pick(pool.tf.filter(x => !usedTf.has(x.id)), 1)[0]; usedTf.add(x.id); tasks.push(tTrueFalse(x)); }
    else if (m === 'type' && yf.length) tasks.push(tType(pick(yf, 1)[0]));
    else {
      const r = Math.random();
      if (r < 0.5 && pool.facts.length) tasks.push(tChoiceDate(nextFact(), allTopicFacts.length >= 4 ? allTopicFacts : allFacts));
      else if (r < 0.7 && pool.terms.length) tasks.push(tChoiceTerm(pick(pool.terms, 1)[0], D.terms));
      else if (r < 0.85 && pool.persons.length) tasks.push(tChoicePerson(pick(pool.persons, 1)[0], D.persons));
      else if (pool.causes.some(c => !usedCause.has(c.id))) { const c = pick(pool.causes.filter(c => !usedCause.has(c.id)), 1)[0]; usedCause.add(c.id); tasks.push(tCause(c)); }
      else if (pool.facts.length) tasks.push(tChoiceDate(nextFact(), allFacts));
      else if (pool.terms.length) tasks.push(tChoiceTerm(pick(pool.terms, 1)[0], D.terms));
    }
  }
  return tasks.slice(0, LESSON_LEN);
}
function topicPool(tid) {
  return { facts: D.facts.filter(f => f.topic === tid), allFacts: D.facts.filter(f => f.topic === tid),
    terms: D.terms.filter(x => x.topic === tid), persons: D.persons.filter(x => x.topic === tid),
    causes: D.causes.filter(x => x.topic === tid), cloze: D.cloze.filter(x => x.topic === tid), tf: D.truefalse.filter(x => x.topic === tid) };
}
function buildStep(tid, idx) {
  const k = stepNoOf(tid, idx);
  const lay = layoutFor(tid), p = topicPool(tid);
  const sub = (all, ids) => { const s = all.filter(x => ids.includes(x.id)); return s.length ? s : all; };
  const pool = { ...p, facts: sub(p.facts, lay.facts[k]), terms: sub(p.terms, lay.terms[k]), persons: sub(p.persons, lay.persons[k]) };
  // подводки: только в первых трех тренировках (5 → 3 → 2), из всего параграфа, каждый факт один раз;
  // в первую очередь — факты этой тренировки, чтобы их спросили через одно задание
  const cap = [5, 3, 2][k] || 0;
  const freshAll = unmet(p), inStep = new Set([...pool.facts, ...pool.terms, ...pool.persons].map(leadKey));
  const fresh = [...shuffle(freshAll.filter(x => inStep.has(leadKey(x)))), ...shuffle(freshAll.filter(x => !inStep.has(leadKey(x))))];
  const chosen = fresh.slice(0, cap), nLead = chosen.length;
  const leads = chosen.map(x => x.date !== undefined ? tLeadFact(x) : x.term !== undefined ? tLeadTerm(x) : tLeadPerson(x));
  markMet(chosen);
  const rest = buildTasksFrom(pool, STEP_MECH[k % STEP_MECH.length]).slice(0, LESSON_LEN - nLead);
  // чередуем: подводка, задание, подводка, задание… чтобы спросили через одно
  const out = []; let li = 0, ri = 0;
  // подводки на четных местах, обычные на нечетных; если подводок больше половины — лишние в конец
  while (out.length < LESSON_LEN && (li < leads.length || ri < rest.length)) {
    if (li < leads.length && (out.length % 2 === 0 || ri >= rest.length)) out.push(leads[li++]);
    else if (ri < rest.length) out.push(rest[ri++]);
    else out.push(leads[li++]);
  }
  return out;
}
function buildChest(tid) {
  const pt = chestTopic(tid);
  const p = topicPool(pt);
  return buildTasksFrom(p, ['pairs', 'tf', 'choice', 'order', 'pairsx', 'choice', 'cloze', 'type']);
}
function buildTopicExam(tid) {
  const p = topicPool(tid);
  return buildTasksFrom(p, ['order', 'cloze', 'choice', 'pairsx', 'type', 'choice', 'tf', 'cloze']);
}
function buildBoss(ch, level) {
  const topics = ch.topics;
  const facts = byTopics(D.facts, topics), yf = yearFacts(facts);
  const tf = byTopics(D.truefalse, topics), cloze = byTopics(D.cloze, topics), terms = byTopics(D.terms, topics), persons = byTopics(D.persons, topics), causes = byTopics(D.causes, topics);
  const tasks = [];
  if (level === 1) {
    const tfs = pick(tf, 5);
    const kinds = [() => tPairs(pick(facts, 6)), () => tPairsTerms(terms), () => tPairs(pick(facts, 6)), () => tPairsPersons(persons), () => tPairs(pick(facts, 6))];
    for (let i = 0; i < 10; i++) tasks.push(i % 2 === 0 ? kinds[i / 2]() : tTrueFalse(tfs[((i - 1) / 2) % tfs.length]));
  } else if (level === 2) {
    const cl = pick(cloze, 3), cs = pick(causes, 3);
    const plan = ['order', 'cloze', 'choice', 'cause', 'order', 'cloze', 'choice', 'cause', 'cloze', 'cause'];
    let ci = 0, ca = 0;
    for (const k of plan) {
      if (k === 'order') tasks.push(tOrder(pick(yf, 7)));
      else if (k === 'cloze') tasks.push(tCloze(cl[ci++ % cl.length]));
      else if (k === 'cause') tasks.push(tCause(cs[ca++ % cs.length]));
      else { const r = Math.random(); tasks.push(r < 0.4 ? tChoiceDate(pick(facts, 1)[0], facts) : r < 0.7 ? tChoiceTerm(pick(terms, 1)[0], D.terms) : tChoicePerson(pick(persons, 1)[0], D.persons)); }
    }
  } else {
    for (const f of pick(yf, 8)) tasks.push(tType(f));
  }
  return tasks;
}

function dailyFacts() {
  const wrong = state.wrong.map(id => D.factById[id]).filter(Boolean);
  const seenIds = new Set(Object.keys(state.seen).map(Number));
  const stale = D.facts.filter(f => seenIds.has(f.id) && !state.wrong.includes(f.id))
    .sort((a, b) => state.seen[a.id] - state.seen[b.id]);
  return [...wrong, ...stale];
}
function buildDaily() {
  const facts = dailyFacts().slice(0, 5);
  return facts.map((f, i) => i % 3 === 2 && f.year ? tType(f) : tChoiceDate(f, D.facts));
}

// ---------- прогон раунда ----------
let run = null;
function startRun(kind, tasks, meta) {
  // tasks — основной круг; wrong — задания на доработку; round — номер круга (0 основной); hint — уровень подсказки в круге
  run = { kind, tasks, i: 0, score: 0, hearts: kind === 'boss' && meta.level === 3 ? Math.max(1, state.hearts) : null, meta, xp: 0,
          firstPass: null, wrong: [], round: 0, hint: 0, redo: kind === 'step' || kind === 'exam' || kind === 'chest' || kind === 'gym' };
  touchStreak(); renderStats();
  $('hearts').classList.toggle('hidden', run.hearts === null);
  speak('neutral', meta.intro || '');
  show('screen-task');
  renderTask();
}
function startStep(tid, idx) { runStep(tid, idx); }
function runStep(tid, idx) { const k = stepNoOf(tid, idx); startRun('step', buildStep(tid, idx), { tid, idx, intro: `${D.topicById[tid].paragraph}, ${['первая','вторая','третья','четвертая','пятая','шестая','седьмая','восьмая'][k] || (k + 1) + '-я'} тренировка. ${LESSON_LEN} заданий.` }); }
function startChest(tid) {
  const pt = chestTopic(tid);
  if (!pt) return;
  startRun('chest', buildChest(tid), { tid, idx: planFor(tid).indexOf('chest'), intro: `Сундук: вспоминаем ${D.topicById[pt].paragraph}. За 70% — сердце на босса.` });
}
function startTopicExam(tid) { startRun('exam', buildTopicExam(tid), { tid, idx: planFor(tid).indexOf('exam'), intro: `Контрольная по ${D.topicById[tid].paragraph}. Как учитель спросит.` }); }
function startBoss(chId, level) {
  const ch = D.topics.chapters.find(c => c.id === chId);
  const intro = level === 3 ? `Босс. Даты с клавиатуры, жизней: ${Math.max(1, state.hearts)}.` : `${ChName(ch)}, уровень ${level}: ${BOSS_LEVELS[level - 1].title}.`;
  startRun('boss', buildBoss(ch, level), { chapter: ch, level, intro });
}
// ---------- качалка: вся глава за одну тренировку ----------
// Каждый пункт главы (дата, термин, личность) встречается дважды, во второй раз — в другой механике.
// Задания собираются заново при каждом запуске, ошибки возвращаются в конце с подсказкой.
const GYM_MODES = {
  dates:   { title: 'Даты', items: (ts) => byTopics(D.facts, ts), word: ['дата', 'даты', 'дат'] },
  terms:   { title: 'Термины', items: (ts) => byTopics(D.terms, ts), word: ['термин', 'термина', 'терминов'] },
  persons: { title: 'Личности', items: (ts) => byTopics(D.persons, ts), word: ['личность', 'личности', 'личностей'] },
};
const GYM_SEC = 10; // в среднем секунд на одну встречу с пунктом (пары и порядок — 4 пункта за ~30 с)
const GYM_TARGET = 7.5 * 60; // цель по длительности: 7–10 минут
// сколько раз встречается каждый пункт: минимум 2, в маленьких главах больше (до 4), чтобы набрать 7–10 минут
const gymSec = (mode) => mode === 'dates' ? 12 : GYM_SEC; // с датами дольше: год печатают с клавиатуры
const gymReps = (n, mode) => Math.min(4, Math.max(2, Math.ceil(GYM_TARGET / (n * gymSec(mode)))));
const plural = (n, w) => w[(n % 10 === 1 && n % 100 !== 11) ? 0 : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? 1 : 2];
const mmss = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
let gymMode = 'terms';
function tTermByDef(term, pool) {
  const opts = shuffle([term.term, ...pick(pool.filter(t => t.id !== term.id).map(t => t.term), 3)]);
  return choice(`${term.definition}. Как это называется?`, opts, term.term, null, `${term.term} — ${term.definition[0].toLowerCase() + term.definition.slice(1)}`);
}
function tPersonByWho(p, pool) {
  const opts = shuffle([p.name, ...pick(pool.filter(x => x.id !== p.id).map(x => x.name), 3)]);
  return choice(`${p.who}. Кто это?`, opts, p.name, null, `${p.name} — ${p.who[0].toLowerCase() + p.who.slice(1)}`);
}
function buildGym(mode, ch) {
  const items = GYM_MODES[mode].items(ch.topics);
  const all = mode === 'dates' ? D.facts : mode === 'terms' ? D.terms : D.persons;
  const pool = items.length >= 6 ? items : all; // для дистракторов
  // механики: [имя, вес, сколько пунктов берет, генератор]
  const M = mode === 'dates' ? [
    ['choice', 3, 1, ([f]) => tChoiceDate(f, pool)],
    ['pairs', 2, 4, (fs) => tPairs(fs)],
    ['type', 2, 1, ([f]) => tType(f)],
    ['order', 1, 4, (fs) => tOrder(fs)],
  ] : mode === 'terms' ? [
    ['choice', 3, 1, ([t]) => tChoiceTerm(t, pool)],
    ['rev', 3, 1, ([t]) => tTermByDef(t, pool)],
    ['pairs', 2, 4, (ts) => tPairsTerms(ts)],
  ] : [
    ['choice', 3, 1, ([p]) => tChoicePerson(p, pool)],
    ['rev', 3, 1, ([p]) => tPersonByWho(p, pool)],
    ['pairs', 2, 4, (ps) => tPairsPersons(ps)],
  ];
  const ok = (m, it) => !(m[0] === 'type' && !yearFacts([it]).length);
  const queue = [];
  for (let k = 0; k < gymReps(items.length, mode); k++) { // круги: каждый — все пункты в новом порядке, без повтора на стыке
    const r = shuffle(items);
    if (queue.length && r.length > 1 && r[0].id === queue[queue.length - 1].id) r.push(r.shift());
    queue.push(...r);
  }
  const last = {}, tasks = [];
  const weighted = M.flatMap(m => Array(m[1]).fill(m));
  while (queue.length) {
    let m = pick(weighted, 1)[0], tries = 0;
    while ((last[queue[0].id] === m[0] || !ok(m, queue[0])) && tries++ < 6) m = pick(weighted, 1)[0];
    let take = [queue[0]];
    if (m[2] > 1) { // групповая механика: следующие разные пункты (для порядка — с разными годами)
      take = []; const ids = new Set(), years = new Set();
      for (const it of queue) {
        if (ids.has(it.id) || (m[0] === 'order' && (years.has(it.year) || !yearFacts([it]).length))) continue;
        ids.add(it.id); years.add(it.year); take.push(it); if (take.length === m[2]) break;
      }
      if (take.length < Math.min(3, m[2])) { m = M[0]; take = [queue[0]]; }
    }
    for (const it of take) { queue.splice(queue.indexOf(it), 1); last[it.id] = m[0]; }
    tasks.push(m[3](take));
  }
  return tasks;
}
function startGym(mode, chId) {
  const ch = chById(chId), n = GYM_MODES[mode].items(ch.topics).length;
  startRun('gym', buildGym(mode, ch), { mode, chId, start: Date.now(), intro: `Качалка: ${GYM_MODES[mode].title.toLowerCase()}, ${chName(ch)}. ${n} ${plural(n, GYM_MODES[mode].word)}, каждый пункт ${gymReps(n, mode) === 2 ? 'дважды' : gymReps(n, mode) + ' раза'}.` });
}
function renderGym() {
  $('gym-seg').innerHTML = Object.entries(GYM_MODES).map(([k, m]) => `<button class="seg-btn${k === gymMode ? ' active' : ''}" data-mode="${k}">${m.title}</button>`).join('');
  $('gym-seg').querySelectorAll('.seg-btn').forEach(b => b.onclick = () => { gymMode = b.dataset.mode; renderGym(); });
  $('gym-pic').innerHTML = charSVG('dushka', 'idle', null, 46);
  const box = $('gym-list'); box.innerHTML = ''; let book = null;
  for (const ch of D.topics.chapters) {
    const n = GYM_MODES[gymMode].items(ch.topics).length; if (!n) continue;
    if (ch.book !== book) { book = ch.book; const h = document.createElement('div'); h.className = 'picker-book'; h.textContent = book; box.appendChild(h); }
    const g = state.gym[gymMode + ':' + ch.id];
    const b = document.createElement('button'); b.className = 'picker-item gym-item' + (g ? ' done' : '');
    b.innerHTML = `<div class="picker-body"><div class="picker-para">${ChName(ch)}</div><div class="picker-title">${esc(ch.title)}</div>
      <div class="small muted">${n} ${plural(n, GYM_MODES[gymMode].word)} · около ${Math.max(1, Math.round(n * gymReps(n, gymMode) * gymSec(gymMode) / 60))} мин${g ? ` · лучший ${g.best}%, ${mmss(g.time)}` : ''}</div></div>
      <span class="gym-go">${tabSVG('gym')}</span>`;
    b.onclick = () => startGym(gymMode, ch.id);
    box.appendChild(b);
  }
}
function startDaily() { startRun('daily', buildDaily(), { intro: 'Микс дня: то, что подзабылось.' }); }

function renderHearts() { if (run.hearts !== null) $('hearts').innerHTML = heartsHTML(run.hearts, Math.max(run.hearts, 1)); }
function renderTask() {
  const t = run.tasks[run.i];
  $('progress-bar').style.width = (run.i / run.tasks.length * 100) + '%';
  renderHearts();
  ['feedback', 'assoc', 'more-btn', 'more-text', 'check-btn'].forEach(id => $(id).classList.add('hidden'));
  $('feedback').classList.remove('ok', 'bad', 'half');
  const el = $('task'); el.innerHTML = '';
  t.render(el, run.round > 0 ? run.hint : 0);
}

function finishTask(ok, half = false) {
  const t = run.tasks[run.i];
  const fb = $('feedback');
  fb.classList.remove('hidden');
  fb.classList.add(ok ? 'ok' : half ? 'half' : 'bad');
  const hook = t.fact && t.fact.hook ? ` ${t.fact.hook}` : '';
  if (t.lead) { // подводка: знакомство, без штрафов
    run.score++; run.xp += XP_PER_TASK / 2;
    speak('nerd', ok ? 'Запомни это.' : 'Вот так правильно. Через пару заданий спрошу.');
    $('feedback-text').innerHTML = `<b>${ok ? 'Да.' : 'Вот так.'}</b> ${esc(t.answerText)}.`;
    if (t.fact) { state.seen[t.fact.id] = Date.now(); if (t.fact.assoc && !ok) { $('assoc').textContent = `💡 ${t.fact.assoc}`; $('assoc').classList.remove('hidden'); } }
    save(); return;
  }
  if (!ok && run.redo && !t.lead) run.wrong.push(t);
  if (ok) {
    run.score++; run.xp += XP_PER_TASK;
    speak(run.round > 0 ? 'nerd' : 'optimist');
    $('feedback-text').innerHTML = t.quiet ? '<b>Ты прав.</b> Все пары на месте.' : `<b>Ты прав.</b> ${esc(t.answerText)}.${esc(hook)}`;
    if (t.fact) state.wrong = state.wrong.filter(id => id !== t.fact.id);
  } else {
    if (half) {
      run.score += 0.5; run.xp += XP_PER_TASK / 2; speak('nerd', 'Одна промашка — засчитываю половину.');
      $('feedback-text').innerHTML = t.quiet ? '<b>Почти.</b> Собрал, но с одной ошибкой.' : `<b>Почти.</b> Правильно: ${esc(t.answerText)}.`;
    } else {
      speak(run.round > 0 ? 'nerd' : 'panic', run.round > 0 ? 'Ничего, вернемся к этому.' : '');
      $('feedback-text').innerHTML = `<b>Ты не прав.</b> Правильно: ${esc(t.answerText)}.`;
    }
    if (t.fact) {
      if (t.fact.assoc) { $('assoc').textContent = `💡 ${t.fact.assoc}`; $('assoc').classList.remove('hidden'); }
      if (!state.wrong.includes(t.fact.id)) state.wrong.push(t.fact.id);
    }
    if (run.hearts !== null && !half) { run.hearts--; renderHearts(); }
  }
  if (t.fact) state.seen[t.fact.id] = Date.now();
  if (t.fact && t.fact.more) { $('more-btn').classList.remove('hidden'); $('more-text').textContent = t.fact.more; }
  save();
}
$('more-btn').onclick = () => { $('more-text').classList.remove('hidden'); $('more-btn').classList.add('hidden'); state.moreClicks++; save(); };

function next() {
  if (run.hearts === 0) return finishRun(true);
  run.i++;
  if (run.i >= run.tasks.length) {
    if (run.round === 0) run.firstPass = Math.round(run.score / run.tasks.length * 100);
    if (run.redo && run.wrong.length) { // круг доработки: те же задания, с подсказкой
      run.round++; run.hint = Math.min(2, run.round);
      run.tasks = run.wrong; run.wrong = []; run.i = 0;
      speak('dushka' in CHARS ? 'nerd' : 'nerd', run.round === 1 ? `Разберем, что не далось: ${run.tasks.length}.` : `Еще ${run.tasks.length}, теперь с подсказкой.`);
      $('progress-bar').style.width = '0%';
      renderTask(); return;
    }
    return finishRun(false);
  }
  renderTask();
}

function finishRun(lost) {
  $('progress-bar').style.width = '100%';
  const n = run.tasks.length, s = run.score;
  const pct = run.redo ? (run.firstPass ?? Math.round(s / n * 100)) : Math.round(s / n * 100);
  state.xp += run.xp;
  let title, text, face = 'opti';
  const passed = run.redo ? !lost : pct >= 70; // для тренировок: закрыта, если дошел до конца доработки
  let firstStep = false;
  if (run.kind === 'step' || run.kind === 'exam' || run.kind === 'chest') {
    const { tid, idx } = run.meta;
    const key = stepKey(tid, idx), prev = state.steps[key] || { best: 0, rounds: 0 };
    firstStep = run.kind === 'step' && stepNoOf(tid, idx) === 0;
    // best: 100 = закрыта с первого прохода (корона); 70..99 = закрыта через доработку, число = результат первого прохода
    const closed = Math.max(70, pct);
    state.steps[key] = { best: Math.max(prev.best, closed), rounds: prev.rounds + 1, first: Math.max(prev.first || 0, pct) };
    const name = run.kind === 'step' ? 'Тренировка' : run.kind === 'exam' ? 'Контрольная' : 'Сундук';
    if (run.kind === 'chest' && passed && !prev.rewarded) { state.hearts = Math.min(3, state.hearts + 1); state.steps[key].rewarded = true; }
    else if (prev.rewarded) state.steps[key].rewarded = true;
    title = pct === 100 ? 'Все верно с первого раза. Корона твоя.' : run.round > 0 ? `Добил до конца. С первого раза было ${pct}%.` : `${pct}%. ${name} закрыт${run.kind === 'exam' ? 'а' : ''}.`;
    text = run.kind === 'chest' && passed ? `+1 сердце на босса (всего ${state.hearts})` : `${D.topicById[tid].paragraph} · ${D.topicById[tid].title}`;
    face = pct === 100 ? 'opti' : passed ? 'opti' : 'dushka';
  } else if (run.kind === 'boss') {
    const ch = run.meta.chapter.id, lv = run.meta.level, bs = state.bosses[ch] || {};
    if (lost) { title = 'Жизни кончились.'; text = `Босс устоял. Прошел ${run.i} из ${n}. Сердца копятся в сундуках.`; face = 'nik'; }
    else {
      bs['l' + lv] = Math.max(bs['l' + lv] || 0, pct);
      if (lv === 3 && passed) bs.won = true;
      title = passed ? (lv === 3 ? `Босс повержен: ${chName(chById(ch))}.` : `Уровень ${lv} пройден: ${pct}%`) : `${pct}%. Нужно 70, чтобы открыть следующий.`;
      text = run.meta.chapter.title; face = passed ? 'opti' : 'nik';
    }
    state.bosses[ch] = bs;
    if (lv === 3) state.hearts = 0;
  } else if (run.kind === 'gym') {
    const { mode, chId, start } = run.meta, key = mode + ':' + chId, prev = state.gym[key] || { best: 0, time: 0, runs: 0 };
    const sec = Math.round((Date.now() - start) / 1000);
    const better = pct > prev.best || (pct === prev.best && (!prev.time || sec < prev.time));
    state.gym[key] = { best: better ? pct : prev.best, time: better ? sec : prev.time, runs: prev.runs + 1 };
    title = pct === 100 ? `Вся глава без единой ошибки. ${mmss(sec)}` : `${pct}% с первого раза. Добил до конца за ${mmss(sec)}.`;
    text = `${GYM_MODES[mode].title}, ${chName(chById(chId))}${better && prev.runs ? ' · новый рекорд' : ''}`;
    face = pct >= 90 ? 'opti' : 'dushka';
  } else {
    title = `${s} из ${n}`; text = 'Микс дня закрыт. Завтра будет новый.'; face = s === n ? 'opti' : 'dushka';
  }
  save(); renderStats();
  $('result-face').innerHTML = charSVG(face, face === 'nik' ? 'upset' : 'happy', run.meta && run.meta.tid ? run.meta.tid : null, 90);
  $('result-title').textContent = title;
  $('result-text').textContent = text;
  $('result-xp').textContent = run.xp ? `+${run.xp} XP` : '';
  const failedStep = run.kind === 'step' && pct < 70 && !firstStep;
  $('cards-btn').classList.toggle('hidden', !failedStep);
  $('home-btn').textContent = run.kind === 'gym' ? 'К качалке' : run.kind === 'boss' ? 'К боссу' : 'На главную';
  show('screen-result');
}

// ---------- кнопки ----------
$('next-btn').onclick = next;
$('check-btn').onclick = () => {};
function askQuit() {
  const box = $('hint'); $('hint-title').textContent = 'Бросить тренировку?';
  $('hint-text').innerHTML = `<b>Ник:</b> Если уйдешь сейчас, прогресс этой тренировки сгорит. Осталось совсем немного.<div class="row"><button class="btn" id="quit-yes">Все равно уйти</button><button class="btn primary" id="quit-no">Остаюсь</button></div>`;
  box.classList.remove('hidden');
  $('quit-no').onclick = (e) => { e.stopPropagation(); box.classList.add('hidden'); };
  $('quit-yes').onclick = (e) => { e.stopPropagation(); box.classList.add('hidden'); if (run && run.kind === 'gym') { renderGym(); show('screen-gym'); renderTabs('gym'); return; } renderHome(); show('screen-home'); };
}
$('again-btn').onclick = () => run.kind === 'step' ? runStep(run.meta.tid, run.meta.idx) : run.kind === 'chest' ? startChest(run.meta.tid) : run.kind === 'exam' ? startTopicExam(run.meta.tid) : run.kind === 'boss' ? startBoss(run.meta.chapter.id, run.meta.level) : run.kind === 'gym' ? startGym(run.meta.mode, run.meta.chId) : startDaily();
$('home-btn').onclick = () => { if (run && run.kind === 'boss') return renderBoss(run.meta.chapter.id); if (run && run.kind === 'gym') { renderGym(); show('screen-gym'); renderTabs('gym'); return; } renderHome(); show('screen-home'); };
$('cards-btn').onclick = () => openCards(run.meta.tid, run.meta.idx, true);
$('daily-btn').onclick = startDaily;
// нижняя панель
const TAB_ICON = {
  gym:    '<path d="M8 26v12M16 18v28M48 18v28M56 26v12M16 32h32"/>',
  map:    '<path d="M8 50l14-10l12 8l14-12l12 8" /><path d="M8 50v-36l14-10l12 8l14-12l12 8v36" />',
  cabinet:'<path d="M32 10q-12 0-12 12t12 12t12-12t-12-12z"/><path d="M12 56q0-18 20-18t20 18"/>',
  events: '<path d="M12 16h40v38H12z"/><path d="M12 28h40M22 10v10M42 10v10"/><path d="M22 40l6 6l12-12"/>',
  book:   '<path d="M10 14q11-4 22 2v34q-11-6-22-2z"/><path d="M32 16q11-6 22-2v34q-11-4-22 2"/>',
};
const tabSVG = (k) => `<svg viewBox="0 0 64 64" width="26" height="26" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">${TAB_ICON[k]}</svg>`;
function renderTabs(active) {
  const tabs = [['map', 'Карта'], ['gym', 'Качалка'], ['book', 'Книжка'], ['events', 'События'], ['cabinet', 'Кабинет']];
  $('tabs').innerHTML = tabs.map(([k, t]) => `<button class="tab${k === active ? ' active' : ''}" data-tab="${k}">${tabSVG(k)}<span>${t}</span></button>`).join('');
  $('tabs').querySelectorAll('.tab').forEach(b => b.onclick = () => goTab(b.dataset.tab));
}
function goTab(k) {
  if (!$('screen-task').classList.contains('hidden')) return askQuit();
  if (k === 'map') { renderHome(); show('screen-home'); }
  else if (k === 'gym') { renderGym(); show('screen-gym'); }
  else if (k === 'book') { openCards(currentTopic(), 0, false); }
  else { renderSoon(k); show('screen-soon'); }
  renderTabs(k);
}
function renderSoon(k) {
  const who = k === 'events' ? 'nik' : 'dushka';
  $('soon-pic').innerHTML = charSVG(who, 'idle', null, 90);
  $('soon-title').textContent = k === 'events' ? 'События' : 'Кабинет';
  $('soon-text').textContent = k === 'events' ? 'Здесь будут игровые события и календарь: недели эпох, двойной опыт, даты из учебника. Пока строится.' : 'Здесь будут твой профиль, ачивки и рекорды. Появится вместе с аккаунтами.';
}
$('brand').onclick = () => { if (!$('screen-task').classList.contains('hidden')) return askQuit(); if (!$('screen-home').classList.contains('hidden')) { renderWelcome(); show('screen-welcome'); } else { renderHome(); show('screen-home'); renderTabs('map'); } };
// подсказки по значкам
const HINTS = {
  xp: ['Звезды', 'Опыт. 10 за каждое верное задание, 5 за «почти». Просто растут — это приятно.'],
  streak: ['Огонек', 'Дней подряд, когда ты заходил и проходил хотя бы один шаг. Пропустил день — сгорает.'],
  hearts: ['Сердца', 'Жизни на третьем уровне босса. Дает сундук: пройди тест по прошлому параграфу на 70%. Максимум три, после босса сгорают.'],
  nodes: ['Что на карте', 'Звезда — тренировка на 8 заданий; в первых тренировках есть «первые встречи» — там нельзя ошибиться по-настоящему. Книжка внизу — весь параграф карточками, на любой момент. Сундук — повторение прошлого параграфа, дает сердце. Лист — контрольная по параграфу, как спросит учитель. Тренировка не отпускает, пока не ответишь на все: ошибки возвращаются, сначала просто еще раз, потом с подсказкой. Корона — если все верно с первого раза.'],
  crown: ['Корона', 'За тренировку или контрольную без единой ошибки с первого раза. Любую можно переиграть и добрать до короны. Короны на всех тренировках параграфа — корона в списке.'],
  daily: ['Микс дня', '5 заданий из того, в чем ты ошибался, и того, что давно не повторял. Собирается заново каждый день.'],
};
function showHint(k) { const [t, body] = HINTS[k]; $('hint-title').textContent = t; $('hint-text').textContent = body; $('hint').classList.remove('hidden'); }
$('xp').onclick = () => showHint('xp');
$('pizza').onclick = () => {
  $('hint-title').textContent = 'Накормить автора пиццей';
  $('hint-text').innerHTML = `<div class="donate-pic">${charSVG('opti', 'happy', null, 70)}</div>
    <p>Этот тренажер делает школьник по имени Даня — между уроками и домашкой. Если он помог тебе с учебой, можно скинуть ему на пиццу в столовой.</p>
    <p class="small muted">Это подарок, а не покупка: ничего не открывает и не ускоряет. Все открыто для всех.</p>
    <div class="row">${DONATE_URL ? `<a class="btn primary" href="${DONATE_URL}" target="_blank" rel="noopener">Скинуть на пиццу</a>` : '<button class="btn primary" disabled>Скоро</button>'}</div>`;
  $('hint').classList.remove('hidden');
};
$('hint').addEventListener('click', (e) => { if (e.target.closest('a')) e.stopPropagation(); }, true); $('streak').onclick = () => showHint('streak');
document.querySelector('.hearts-home').onclick = () => showHint('hearts');
$('daily-info').onclick = (e) => { e.stopPropagation(); showHint('daily'); };
$('hint').onclick = () => $('hint').classList.add('hidden');
document.addEventListener('click', (e) => { if (e.target.closest('.crown')) { e.stopPropagation(); showHint('crown'); } }, true);
$('map-info').onclick = () => showHint('nodes');

const DECOR = [
  '<path d="M6 30q10-26 24-4q8-22 20 0q10-18 18 2" />',                                         // облачко
  '<path d="M4 20l10-16l6 14l8-18l6 16l8-12" />',                                                // зигзаг
  '<path d="M20 4v10M20 30v10M4 22h10M30 22h10M9 11l7 7M31 11l-7 7M9 33l7-7M31 33l-7 7" />',      // лучики
  '<path d="M10 24q10-24 20-2q10-22 20 2" /><path d="M14 30h30" />',                              // сердечко-крыша
  '<path d="M4 8q14 10 0 20q16 10 0 20" />',                                                      // волна
  '<circle cx="24" cy="24" r="14"/><circle cx="24" cy="24" r="5" fill="#1e2235"/>',               // глаз
  '<path d="M6 40l12-32l12 32M12 26h12" />',                                                      // буква А как значок
  '<path d="M8 36l8-8l-8-8l8-8M24 36l8-8l-8-8l8-8" />',                                           // стрелки
];
function decorSVG(i, size = 44, rot = 0) { return `<svg class="decor" viewBox="0 0 48 48" width="${size}" height="${size}" style="transform:rotate(${rot}deg)" fill="none" stroke="#a9b0c4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${DECOR[i % DECOR.length]}</svg>`; }
function sprinkle(el, n, seed) {
  // декор вокруг: позиции детерминированы seed, чтобы не прыгали
  let s = seed; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  let html = '';
  for (let i = 0; i < n; i++) {
    const side = rnd() < 0.5; const left = side ? rnd() * 14 : 84 + rnd() * 12; // только по краям, не под текстом
    html += `<div class="decor-pos" style="left:${left.toFixed(0)}%;top:${(rnd() * 92 + 2).toFixed(0)}%;opacity:${(rnd() * .3 + .35).toFixed(2)}">${decorSVG(Math.floor(rnd() * DECOR.length), 22 + rnd() * 24, rnd() * 60 - 30)}</div>`;
  }
  el.insertAdjacentHTML('beforeend', html);
}
function renderWelcome() {
  $('welcome-decor').innerHTML = ''; sprinkle($('welcome-decor'), 14, 7);
  $('welcome-chars').innerHTML = ['opti', 'nik', 'dushka'].map(id => charSVG(id, 'idle', null, 80)).join('');
  $('welcome-bubbles').innerHTML = ['opti', 'nik', 'dushka'].map(id => `<div class="bubble b-${id}"><b>${CHARS[id].name}</b> ${esc(charLine(id, 'idle'))}</div>`).join('');
}
$('welcome-start').onclick = () => { state.started = true; save(); renderHome(); show('screen-home'); };
const hasProgress = () => state.started || Object.keys(state.steps || {}).length > 0;

// высоты закрепленных панелей — в CSS-переменные, чтобы стартовая помещалась ровно в экран
function measureBars() {
  const r = document.documentElement.style; if (!document.querySelector('.top')) return;
  r.setProperty('--top-h', document.querySelector('.top').offsetHeight + 'px');
  r.setProperty('--tabs-h', $('tabs').offsetHeight + 'px');
}
if (window.ResizeObserver) { const ro = new ResizeObserver(measureBars); ro.observe(document.querySelector('.top')); ro.observe($('tabs')); }
window.addEventListener('resize', measureBars);
loadContent().then(() => { checkUpdate(); renderStats(); renderWelcome(); renderTabs('map'); if (hasProgress()) { renderHome(); show('screen-home'); } else show('screen-welcome'); })
  .catch(e => { $('map').innerHTML = `<p class="muted">Не удалось загрузить контент (${esc(e.message)}). Открой сайт через сервер, а не как файл.</p>`; });
