// Бэкенд «Не стыдно»: одна функция Yandex Cloud Functions (Node.js 22).
// Вход через Telegram-бота (диплинк t.me/<бот>?start=<код>) и хранение прогресса в Object Storage.
//
// Как работает вход:
//  1) сайт: POST ?r=start            → функция создает одноразовый код, сайт открывает t.me/<бот>?start=<код>
//  2) Telegram: POST ?r=tg (вебхук)   → ученик нажал «Старт», бот привязывает код к его Telegram id
//  3) сайт: GET ?r=check&code=<код>   → раз в 2 секунды; когда код привязан — выдаем токен сессии
//  4) сайт: GET/PUT ?r=progress       → с заголовком Authorization: Bearer <токен>
//  Счетчик (анонимный): POST ?r=ping {d: случайный id устройства, s: предмет, n: тренировок с прошлого раза}
//                       GET  ?r=stats → {devices, trainings, accounts, today, week, subjects} — публично, для страницы stats.html
//  Один раз после настройки: GET ?r=setup — функция сама подключает вебхук бота (токен никому показывать не нужно)
//
// Переменные окружения функции:
//  BOT_TOKEN       — токен бота от @BotFather (секрет, только здесь, в репозиторий не кладем)
//  BOT_USERNAME    — имя бота без @, например NeStydnoBot
//  BUCKET          — имя бакета Object Storage
//  SESSION_SECRET  — длинная случайная строка, подписывает токены сессии
//  WEBHOOK_SECRET  — случайная строка, Telegram присылает ее в заголовке, чтобы чужие не дергали вебхук
//  SITE_URL        — адрес сайта (для CORS и кнопки «Вернуться в тренажер»)
//
// Храним минимум: Telegram id (как ключ), ник, аватар, прогресс. Имя из Telegram — только как ник по умолчанию.

const crypto = require('crypto');

const ENV = process.env;
const S3 = 'https://storage.yandexcloud.net';
const CODE_TTL = 10 * 60 * 1000;            // код входа живет 10 минут
const SESSION_TTL = 180 * 24 * 3600 * 1000; // сессия — полгода
const MAX_BODY = 300 * 1024;                // прогресс больше 300 КБ не принимаем

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
async function s3(ctx, method, key, body) {
  const headers = { 'X-YaCloud-SubjectToken': ctx.token.access_token };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const r = await fetch(`${S3}/${ENV.BUCKET}/${key}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (method === 'GET') {
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`storage ${method} ${key}: ${r.status}`);
    return r.json();
  }
  if (!r.ok && !(method === 'DELETE' && r.status === 404)) throw new Error(`storage ${method} ${key}: ${r.status}`);
  return true;
}

// ---------- токен сессии: base64url(данные).подпись ----------
const b64 = (s) => Buffer.from(s).toString('base64url');
const sign = (s) => crypto.createHmac('sha256', ENV.SESSION_SECRET).update(s).digest('base64url');
function makeToken(uid) {
  const p = b64(JSON.stringify({ uid: String(uid), exp: Date.now() + SESSION_TTL }));
  return `${p}.${sign(p)}`;
}
function readToken(h) {
  const t = (h || '').replace(/^Bearer\s+/i, '');
  const [p, s] = t.split('.');
  if (!p || !s) return null;
  const good = Buffer.from(sign(p)), got = Buffer.from(s);
  if (good.length !== got.length || !crypto.timingSafeEqual(good, got)) return null;
  const d = JSON.parse(Buffer.from(p, 'base64url').toString());
  return d.exp > Date.now() ? d.uid : null;
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

// ---------- Telegram ----------
async function tg(method, payload) {
  await fetch(`https://api.telegram.org/bot${ENV.BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
}
const backButton = () => ({ inline_keyboard: [[{ text: 'Вернуться в тренажер', url: ENV.SITE_URL }]] });

async function onTelegram(ctx, update) {
  const m = update.message;
  if (!m || !m.text || !m.from) return;
  const code = (m.text.match(/^\/start\s+([a-f0-9]{16})$/) || [])[1];
  if (!code) {
    await tg('sendMessage', { chat_id: m.chat.id, text: 'Привет! Это бот тренажера «Не стыдно». Войти можно кнопкой «Войти через Telegram» в кабинете тренажера.', reply_markup: backButton() });
    return;
  }
  const p = await s3(ctx, 'GET', `pending/${code}.json`);
  if (!p || p.uid || Date.now() - p.t > CODE_TTL) {
    await tg('sendMessage', { chat_id: m.chat.id, text: 'Эта ссылка для входа устарела. Нажми «Войти через Telegram» в тренажере еще раз.', reply_markup: backButton() });
    return;
  }
  await s3(ctx, 'PUT', `pending/${code}.json`, { ...p, uid: String(m.from.id), name: m.from.first_name || m.from.username || '' });
  await tg('sendMessage', { chat_id: m.chat.id, text: 'Готово, ты вошел! Возвращайся в тренажер — прогресс теперь не потеряется.', reply_markup: backButton() });
}

// ---------- обработчик ----------
module.exports.handler = async function (event, ctx) {
  try {
    const method = event.httpMethod;
    if (method === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
    const q = event.queryStringParameters || {};
    const h = Object.fromEntries(Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    let raw = event.body || '';
    if (event.isBase64Encoded) raw = Buffer.from(raw, 'base64').toString();
    if (raw.length > MAX_BODY) return reply(413, { error: 'too_big' });
    const body = raw ? JSON.parse(raw) : {};

    switch (q.r) {
      case 'tg': { // вебхук Telegram
        if (h['x-telegram-bot-api-secret-token'] !== ENV.WEBHOOK_SECRET) return reply(403, { error: 'forbidden' });
        await onTelegram(ctx, body);
        return reply(200, { ok: true });
      }
      case 'start': { // сайт просит код для входа
        if (method !== 'POST') return reply(405, { error: 'method' });
        const code = crypto.randomBytes(8).toString('hex');
        await s3(ctx, 'PUT', `pending/${code}.json`, { t: Date.now() });
        return reply(200, { code, link: `https://t.me/${ENV.BOT_USERNAME}?start=${code}` });
      }
      case 'setup': { // подключить вебхук бота к этой функции (можно вызывать повторно, секреты не покидают функцию)
        const url = `https://functions.yandexcloud.net/${ctx.functionName}?r=tg`;
        const r = await fetch(`https://api.telegram.org/bot${ENV.BOT_TOKEN}/setWebhook`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, secret_token: ENV.WEBHOOK_SECRET, allowed_updates: ['message'], drop_pending_updates: true }),
        });
        const t = await r.json();
        return reply(200, { ok: !!t.ok, telegram: t.description || '' });
      }
      case 'ping': { // анонимный счетчик
        if (method !== 'POST') return reply(405, { error: 'method' });
        return reply((await onPing(ctx, body)) ? 200 : 400, { ok: true });
      }
      case 'stats': { // публичная сводка для хвастовства
        const r = reply(200, publicStats(await loadStats(ctx)));
        r.headers['Cache-Control'] = 'public, max-age=300';
        r.headers['Access-Control-Allow-Origin'] = '*'; // сводку можно показывать где угодно
        return r;
      }
      case 'check': { // сайт ждет, пока ученик нажмет «Старт» в боте
        const code = String(q.code || '');
        if (!/^[a-f0-9]{16}$/.test(code)) return reply(400, { error: 'code' });
        const p = await s3(ctx, 'GET', `pending/${code}.json`);
        if (!p || Date.now() - p.t > CODE_TTL) return reply(410, { error: 'expired' });
        if (!p.uid) return reply(200, { wait: true });
        await s3(ctx, 'DELETE', `pending/${code}.json`);
        const old = await s3(ctx, 'GET', `users/${p.uid}.json`);
        const user = old || { nick: p.name, created: Date.now() };
        if (!user.nick) user.nick = p.name;
        if (!old) { const st = await loadStats(ctx); st.accounts++; await s3(ctx, 'PUT', 'stats.json', st); } // вариант 3: сколько завели аккаунт
        await s3(ctx, 'PUT', `users/${p.uid}.json`, user);
        return reply(200, { token: makeToken(p.uid), nick: user.nick, avatar: user.avatar || null, state: user.state || null, updated: user.updated || 0 });
      }
      case 'progress': { // прогресс: прочитать или сохранить
        const uid = readToken(h.authorization);
        if (!uid) return reply(401, { error: 'auth' });
        const user = (await s3(ctx, 'GET', `users/${uid}.json`)) || { created: Date.now() };
        if (method === 'GET') return reply(200, { nick: user.nick || '', avatar: user.avatar || null, state: user.state || null, updated: user.updated || 0 });
        if (method === 'PUT') {
          if (body.state !== undefined) user.state = body.state;
          if (typeof body.nick === 'string') user.nick = body.nick.slice(0, 24);
          if (body.avatar !== undefined) user.avatar = body.avatar;
          user.updated = Date.now();
          await s3(ctx, 'PUT', `users/${uid}.json`, user);
          return reply(200, { ok: true, updated: user.updated });
        }
        return reply(405, { error: 'method' });
      }
      default:
        return reply(200, { ok: true, service: 'ne-stydno' });
    }
  } catch (e) {
    console.error(e);
    return reply(500, { error: 'server' });
  }
};
