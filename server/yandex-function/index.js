// Бэкенд «Не стыдно»: одна функция Yandex Cloud Functions (Node.js 22).
// Аккаунты по логину и паролю (спека docs/tasks/2026-11-10_akkaunty-login.md), прогресс в Object Storage, анонимный счетчик.
//
// Маршруты (?r=...):
//  POST register  {login, password, nick, avatar} → {token, recovery}
//  POST login     {login, password}               → {token, nick, avatar, state, updated}
//  POST recover   {login, recovery, password}     → {token, recovery}   — новый пароль и новый код восстановления
//  POST password  {old, password}  + токен        → {token}             — все старые сессии перестают работать
//  GET  progress  + токен → {nick, avatar, state, updated};  PUT progress {state} + токен
//  PUT  profile   {nick?, avatar?} + токен
//  POST account-delete {password} + токен          — стирает аккаунт, вход и прогресс
//  POST ping {d, s, n} — анонимный счетчик;  GET stats — публичная сводка для stats.html
//  Токен: заголовок Authorization: Bearer <токен>
//
// Ник — не текст, а два id слов из генератора: {a: 'hitryj', n: 'enot'}. Слова живут в файле со списками на сайте.
// Так через API нельзя записать свой текст: ни мат, ни имя, ни «пиши мне в тг».
//
// Храним: логин, хэши пароля и кода восстановления (scrypt с солью), ник (id слов), аватар (id частей), прогресс.
// Не храним: имя, возраст, школу, телефон, почту. Пароль и код не логируем и не храним в открытом виде.
//
// Ключи в бакете:
//  login/<логин>.json — {uid, salt, hash, rsalt, rhash, fails, lock}
//  acc/<uid>.json     — {login, nick, avatar, created, tv}   (tv — версия сессий: при смене пароля +1)
//  prog/<uid>.json    — {state, updated}
//  devices/<id>.json, stats.json — счетчик
//
// Переменные окружения функции:
//  BUCKET          — имя бакета Object Storage
//  SESSION_SECRET  — длинная случайная строка, подписывает токены сессии
//  SITE_URL        — адрес сайта (для CORS)

const crypto = require('crypto');

const ENV = process.env;
const S3 = 'https://storage.yandexcloud.net';
const SESSION_TTL = 180 * 24 * 3600 * 1000; // сессия — полгода
const MAX_BODY = 300 * 1024;                // прогресс больше 300 КБ не принимаем
const LOCK_SOFT = { after: 5, ms: 15 * 60 * 1000 };  // 5 неверных попыток — пауза 15 минут
const LOCK_HARD = { after: 15, ms: 60 * 60 * 1000 }; // 15 — пауза час

// ---------- ответы ----------
function cors() {
  const origin = (ENV.SITE_URL || '').replace(/^(https?:\/\/[^/]+).*$/, '$1') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}
const reply = (code, obj) => ({ statusCode: code, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors() }, body: JSON.stringify(obj) });

// ---------- хранилище: Object Storage по IAM-токену сервисного аккаунта функции ----------
// opts.ifNone — записать, только если объекта еще нет (для уникальности логина). Вернет false, если занято.
async function s3(ctx, method, key, body, opts = {}) {
  const headers = { 'X-YaCloud-SubjectToken': ctx.token.access_token };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.ifNone) headers['If-None-Match'] = '*';
  const r = await (module.exports._fetch || fetch)(`${S3}/${ENV.BUCKET}/${key}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (method === 'GET') {
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`storage ${method} ${key}: ${r.status}`);
    return r.json();
  }
  if (opts.ifNone && (r.status === 412 || r.status === 409)) return false;
  if (!r.ok && !(method === 'DELETE' && r.status === 404)) throw new Error(`storage ${method} ${key}: ${r.status}`);
  return true;
}

// ---------- токен сессии: base64url(данные).подпись ----------
const b64 = (s) => Buffer.from(s).toString('base64url');
const sign = (s) => crypto.createHmac('sha256', ENV.SESSION_SECRET).update(s).digest('base64url');
function makeToken(uid, tv) {
  const p = b64(JSON.stringify({ uid, tv, exp: Date.now() + SESSION_TTL }));
  return `${p}.${sign(p)}`;
}
function readToken(h) {
  const t = (h || '').replace(/^Bearer\s+/i, '');
  const [p, s] = t.split('.');
  if (!p || !s) return null;
  const good = Buffer.from(sign(p)), got = Buffer.from(s);
  if (good.length !== got.length || !crypto.timingSafeEqual(good, got)) return null;
  try {
    const d = JSON.parse(Buffer.from(p, 'base64url').toString());
    return d.exp > Date.now() && d.uid ? d : null;
  } catch { return null; }
}
// Токен годится, только если версия сессий совпадает с аккаунтом (после смены пароля старые токены не работают)
async function auth(ctx, h) {
  const t = readToken(h.authorization);
  if (!t) return null;
  const acc = await s3(ctx, 'GET', `acc/${t.uid}.json`);
  if (!acc || (acc.tv || 0) !== (t.tv || 0)) return null;
  return { uid: t.uid, acc };
}

// ---------- пароли и коды: только хэши ----------
const scrypt = (secret, salt) => new Promise((ok, fail) =>
  crypto.scrypt(secret, salt, 32, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? fail(e) : ok(k.toString('base64')))));
async function makeHash(secret) {
  const salt = crypto.randomBytes(16).toString('base64');
  return { salt, hash: await scrypt(secret, salt) };
}
async function checkHash(secret, salt, hash) {
  if (!salt || !hash) return false;
  const a = Buffer.from(await scrypt(secret, salt)), b = Buffer.from(hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // без похожих 0/O, 1/I/L
function makeRecovery() {
  const bytes = crypto.randomBytes(12);
  const s = [...bytes].map((x) => ALPHA[x % ALPHA.length]).join('');
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}
const normRecovery = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// ---------- проверки ввода ----------
const normLogin = (s) => String(s || '').trim().toLowerCase();
const LOGIN_RE = /^[a-z0-9][a-z0-9._]{3,19}$/;
const COMMON = new Set(['123456', '1234567', '12345678', '123456789', '1234567890', '654321', '111111', '000000', '123123',
  '666666', '777777', '121212', 'qwerty', 'qwerty123', 'qwertyuiop', 'password', 'password1', 'abc123', 'asdfgh', 'zxcvbn',
  'йцукен', 'пароль', '1q2w3e', '1q2w3e4r', 'iloveyou', 'minecraft', 'roblox', 'brawlstars']);
function passwordProblem(pw, login) {
  if (typeof pw !== 'string' || pw.length < 6) return 'short';
  if (pw.length > 64) return 'long';
  const low = pw.toLowerCase();
  if (COMMON.has(low) || low === login || /^(.)\1+$/.test(low)) return 'weak';
  return null;
}
const ID_RE = /^[a-z0-9-]{1,24}$/;
const isId = (v) => typeof v === 'string' && ID_RE.test(v);
function cleanNick(n) { // ник — пара id слов из генератора
  return n && typeof n === 'object' && isId(n.a) && isId(n.n) ? { a: n.a, n: n.n } : null;
}
function cleanAvatar(a) { // аватар — набор id частей (голова, глаза, рот, волосы, аксессуар) и цвет
  if (!a || typeof a !== 'object') return null;
  const out = {};
  for (const [k, v] of Object.entries(a).slice(0, 12)) {
    if (isId(k) && typeof v === 'string' && (isId(v) || /^#[0-9a-fA-F]{6}$/.test(v))) out[k] = v;
  }
  return out;
}

// ---------- защита от подбора ----------
function locked(rec) { return rec.lock && rec.lock > Date.now() ? Math.ceil((rec.lock - Date.now()) / 60000) : 0; }
async function failAttempt(ctx, login, rec) {
  rec.fails = (rec.fails || 0) + 1;
  if (rec.fails >= LOCK_HARD.after) rec.lock = Date.now() + LOCK_HARD.ms;
  else if (rec.fails >= LOCK_SOFT.after && rec.fails % LOCK_SOFT.after === 0) rec.lock = Date.now() + LOCK_SOFT.ms;
  await s3(ctx, 'PUT', `login/${login}.json`, rec);
}
async function okAttempt(ctx, login, rec) {
  if (rec.fails || rec.lock) { rec.fails = 0; rec.lock = 0; await s3(ctx, 'PUT', `login/${login}.json`, rec); }
}

// ---------- счетчик: никаких личных данных, только случайный id устройства ----------
// devices/<id>.json — по файлу на устройство (так одно устройство не считается дважды); stats.json — сводка.
// Сводку обновляем «прочитал-прибавил-записал»: при наших объемах гонки почти невозможны, а ошибка в единицу не страшна.
const day = (t = Date.now()) => new Date(t + 3 * 3600 * 1000).toISOString().slice(0, 10); // день по Москве
const SUBJECTS = ['istoria', 'russkiy', 'geografia'];
async function loadStats(ctx) {
  return (await s3(ctx, 'GET', 'stats.json')) || { devices: 0, trainings: 0, accounts: 0, days: {}, subjects: {} };
}
async function onPing(ctx, b) {
  const id = String(b.d || '');
  if (!/^[a-f0-9]{16,32}$/.test(id)) return false;
  const subj = SUBJECTS.includes(b.s) ? b.s : '';
  const n = Math.max(0, Math.min(200, parseInt(b.n, 10) || 0)); // больше 200 тренировок за раз не бывает — режем накрутку
  const today = day();
  const dev = await s3(ctx, 'GET', `devices/${id}.json`);
  const st = await loadStats(ctx);
  if (!dev) st.devices++;
  if (!dev || dev.last !== today) st.days[today] = (st.days[today] || 0) + 1;
  st.trainings += n;
  if (subj && (!dev || !(dev.subjects || []).includes(subj))) st.subjects[subj] = (st.subjects[subj] || 0) + 1;
  for (const k of Object.keys(st.days).sort().slice(0, -60)) delete st.days[k]; // храним 60 дней
  const subjects = [...new Set([...((dev && dev.subjects) || []), ...(subj ? [subj] : [])])];
  await s3(ctx, 'PUT', `devices/${id}.json`, { first: (dev && dev.first) || today, last: today, subjects });
  await s3(ctx, 'PUT', 'stats.json', st);
  return true;
}
function publicStats(st) {
  const today = day(), weekAgo = day(Date.now() - 6 * 86400000);
  const week = Object.entries(st.days).filter(([k]) => k >= weekAgo).map(([, v]) => v);
  return {
    devices: st.devices, trainings: st.trainings, accounts: st.accounts, subjects: st.subjects,
    today: st.days[today] || 0,
    weekMax: week.length ? Math.max(...week) : 0, // «до N учеников в день за неделю»
    days: Object.fromEntries(Object.entries(st.days).filter(([k]) => k >= day(Date.now() - 29 * 86400000))),
  };
}

// ---------- аккаунты ----------
async function onRegister(ctx, b) {
  const login = normLogin(b.login);
  if (!LOGIN_RE.test(login)) return reply(400, { error: 'login_format' });
  const problem = passwordProblem(b.password, login);
  if (problem) return reply(400, { error: `password_${problem}` });
  const nick = cleanNick(b.nick);
  if (!nick) return reply(400, { error: 'nick' });
  const uid = crypto.randomBytes(12).toString('hex');
  const recovery = makeRecovery();
  const p = await makeHash(b.password), r = await makeHash(normRecovery(recovery));
  const rec = { uid, salt: p.salt, hash: p.hash, rsalt: r.salt, rhash: r.hash, fails: 0, lock: 0 };
  // Сначала проверяем, что логин свободен (иначе без поддержки условия перезаписали бы чужой вход).
  // Потом занимаем условной записью и перечитываем: так ловим и одновременную регистрацию.
  if (await s3(ctx, 'GET', `login/${login}.json`)) return reply(409, { error: 'login_taken' });
  if ((await s3(ctx, 'PUT', `login/${login}.json`, rec, { ifNone: true })) === false) return reply(409, { error: 'login_taken' });
  const check = await s3(ctx, 'GET', `login/${login}.json`);
  if (!check || check.uid !== uid) return reply(409, { error: 'login_taken' });
  await s3(ctx, 'PUT', `acc/${uid}.json`, { login, nick, avatar: cleanAvatar(b.avatar), created: Date.now(), tv: 0 });
  const st = await loadStats(ctx); st.accounts++; await s3(ctx, 'PUT', 'stats.json', st);
  return reply(200, { token: makeToken(uid, 0), recovery });
}

async function onLogin(ctx, b) {
  const login = normLogin(b.login);
  const rec = LOGIN_RE.test(login) ? await s3(ctx, 'GET', `login/${login}.json`) : null;
  if (!rec) return reply(401, { error: 'wrong' }); // не говорим, что именно неверно: логин или пароль
  const wait = locked(rec);
  if (wait) return reply(429, { error: 'locked', minutes: wait });
  if (!(await checkHash(String(b.password || ''), rec.salt, rec.hash))) { await failAttempt(ctx, login, rec); return reply(401, { error: 'wrong' }); }
  await okAttempt(ctx, login, rec);
  const acc = (await s3(ctx, 'GET', `acc/${rec.uid}.json`)) || {};
  const prog = (await s3(ctx, 'GET', `prog/${rec.uid}.json`)) || {};
  return reply(200, { token: makeToken(rec.uid, acc.tv || 0), nick: acc.nick || null, avatar: acc.avatar || null, state: prog.state || null, updated: prog.updated || 0 });
}

async function onRecover(ctx, b) {
  const login = normLogin(b.login);
  const rec = LOGIN_RE.test(login) ? await s3(ctx, 'GET', `login/${login}.json`) : null;
  if (!rec) return reply(401, { error: 'wrong' });
  const wait = locked(rec);
  if (wait) return reply(429, { error: 'locked', minutes: wait });
  if (!(await checkHash(normRecovery(b.recovery), rec.rsalt, rec.rhash))) { await failAttempt(ctx, login, rec); return reply(401, { error: 'wrong' }); }
  const problem = passwordProblem(b.password, login);
  if (problem) return reply(400, { error: `password_${problem}` });
  const recovery = makeRecovery();
  const p = await makeHash(b.password), r = await makeHash(normRecovery(recovery));
  Object.assign(rec, { salt: p.salt, hash: p.hash, rsalt: r.salt, rhash: r.hash, fails: 0, lock: 0 });
  await s3(ctx, 'PUT', `login/${login}.json`, rec);
  const acc = (await s3(ctx, 'GET', `acc/${rec.uid}.json`)) || { login, created: Date.now(), tv: 0 };
  acc.tv = (acc.tv || 0) + 1; // все старые сессии — на выход
  await s3(ctx, 'PUT', `acc/${rec.uid}.json`, acc);
  return reply(200, { token: makeToken(rec.uid, acc.tv), recovery });
}

async function onPassword(ctx, me, b) {
  const rec = await s3(ctx, 'GET', `login/${me.acc.login}.json`);
  if (!rec || rec.uid !== me.uid) return reply(401, { error: 'auth' });
  const wait = locked(rec);
  if (wait) return reply(429, { error: 'locked', minutes: wait });
  if (!(await checkHash(String(b.old || ''), rec.salt, rec.hash))) { await failAttempt(ctx, me.acc.login, rec); return reply(401, { error: 'wrong' }); }
  const problem = passwordProblem(b.password, me.acc.login);
  if (problem) return reply(400, { error: `password_${problem}` });
  const p = await makeHash(b.password);
  Object.assign(rec, { salt: p.salt, hash: p.hash, fails: 0, lock: 0 });
  await s3(ctx, 'PUT', `login/${me.acc.login}.json`, rec);
  me.acc.tv = (me.acc.tv || 0) + 1;
  await s3(ctx, 'PUT', `acc/${me.uid}.json`, me.acc);
  return reply(200, { token: makeToken(me.uid, me.acc.tv) });
}

async function onDelete(ctx, me, b) {
  const rec = await s3(ctx, 'GET', `login/${me.acc.login}.json`);
  if (!rec || rec.uid !== me.uid) return reply(401, { error: 'auth' });
  const wait = locked(rec);
  if (wait) return reply(429, { error: 'locked', minutes: wait });
  if (!(await checkHash(String(b.password || ''), rec.salt, rec.hash))) { await failAttempt(ctx, me.acc.login, rec); return reply(401, { error: 'wrong' }); }
  await s3(ctx, 'DELETE', `prog/${me.uid}.json`);
  await s3(ctx, 'DELETE', `acc/${me.uid}.json`);
  await s3(ctx, 'DELETE', `login/${me.acc.login}.json`);
  return reply(200, { ok: true });
}

// ---------- обработчик ----------
const POST_ONLY = new Set(['register', 'login', 'recover', 'password', 'account-delete', 'ping']);

module.exports.handler = async function (event, ctx) {
  try {
    const method = event.httpMethod;
    if (method === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
    const q = event.queryStringParameters || {};
    const h = Object.fromEntries(Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    let raw = event.body || '';
    if (event.isBase64Encoded) raw = Buffer.from(raw, 'base64').toString();
    if (raw.length > MAX_BODY) return reply(413, { error: 'too_big' });
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { return reply(400, { error: 'json' }); }
    if (POST_ONLY.has(q.r) && method !== 'POST') return reply(405, { error: 'method' });

    switch (q.r) {
      case 'register': return await onRegister(ctx, body);
      case 'login': return await onLogin(ctx, body);
      case 'recover': return await onRecover(ctx, body);
      case 'password': {
        const me = await auth(ctx, h);
        return me ? await onPassword(ctx, me, body) : reply(401, { error: 'auth' });
      }
      case 'account-delete': {
        const me = await auth(ctx, h);
        return me ? await onDelete(ctx, me, body) : reply(401, { error: 'auth' });
      }
      case 'profile': {
        if (method !== 'PUT') return reply(405, { error: 'method' });
        const me = await auth(ctx, h);
        if (!me) return reply(401, { error: 'auth' });
        if (body.nick !== undefined) { const n = cleanNick(body.nick); if (!n) return reply(400, { error: 'nick' }); me.acc.nick = n; }
        if (body.avatar !== undefined) me.acc.avatar = cleanAvatar(body.avatar);
        await s3(ctx, 'PUT', `acc/${me.uid}.json`, me.acc);
        return reply(200, { ok: true });
      }
      case 'progress': {
        const me = await auth(ctx, h);
        if (!me) return reply(401, { error: 'auth' });
        if (method === 'GET') {
          const prog = (await s3(ctx, 'GET', `prog/${me.uid}.json`)) || {};
          return reply(200, { nick: me.acc.nick || null, avatar: me.acc.avatar || null, state: prog.state || null, updated: prog.updated || 0 });
        }
        if (method === 'PUT') {
          const updated = Date.now();
          await s3(ctx, 'PUT', `prog/${me.uid}.json`, { state: body.state === undefined ? null : body.state, updated });
          return reply(200, { ok: true, updated });
        }
        return reply(405, { error: 'method' });
      }
      case 'ping': return reply((await onPing(ctx, body)) ? 200 : 400, { ok: true });
      case 'stats': {
        const r = reply(200, publicStats(await loadStats(ctx)));
        r.headers['Cache-Control'] = 'public, max-age=300';
        r.headers['Access-Control-Allow-Origin'] = '*'; // сводку можно показывать где угодно
        return r;
      }
      default:
        return reply(200, { ok: true, service: 'ne-stydno' });
    }
  } catch (e) {
    console.error(String(e && e.message || e)); // только текст ошибки: без тел запросов, паролей и IP
    return reply(500, { error: 'server' });
  }
};
