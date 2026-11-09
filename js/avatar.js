/* Аватар ученика — человечек-палочка из слоев, в том же кривом дудле, что и Опти/Ник/Душка.
   Слои рисуются по очереди снизу вверх: голова → глаза → рот → волосы → штука (аксессуар) → тело.
   Каждый вариант — обычный SVG-путь в поле 160×280 (как у персонажей). Даня, дорисовывай варианты тут:
   добавил объект в массив — он сам появится в конструкторе. Магазин за экспу потом будет добавлять
   сюда вещи с ценой (поле price) — пока все бесплатно. */

const AVATAR_COLORS = ['#1e2235', '#1F3FBF', '#D9480F', '#3FA66A', '#8e44ad', '#c2185b'];

const AVATAR_PARTS = {
  head: {
    title: 'Голова',
    items: [
      { id: 'poly',   name: 'многоугольник', d: '<path d="M40 40l32-14l40 8l16 34l-6 38l-32 16l-40-6l-18-32z"/>' },
      { id: 'egg',    name: 'яйцо',          d: '<path d="M78 24q40 2 44 50q0 50-40 54q-44 0-46-50q2-52 42-54z"/>' },
      { id: 'square', name: 'кирпич',        d: '<path d="M44 34l70-4l6 10l-2 76l-8 8l-66 2l-8-10l2-72z"/>' },
      { id: 'potato', name: 'картошка',      d: '<path d="M36 60q-4-30 30-34q24-10 50 6q18 14 8 40q4 28-18 46q-30 14-56-2q-18-22-14-56z"/>' },
    ],
  },
  eyes: {
    title: 'Глаза',
    items: [
      { id: 'dots',   name: 'точки',      d: '<circle cx="60" cy="66" r="4" fill="currentColor"/><circle cx="98" cy="62" r="3" fill="currentColor"/>' },
      { id: 'uneven', name: 'разные',     d: '<circle cx="58" cy="66" r="11"/><circle cx="98" cy="62" r="6"/><circle cx="60" cy="68" r="3" fill="currentColor"/><circle cx="99" cy="63" r="2" fill="currentColor"/>' },
      { id: 'happy',  name: 'щелочки',    d: '<path d="M48 68q10-12 22 0M88 64q10-12 22 0"/>' },
      { id: 'wide',   name: 'в шоке',     d: '<circle cx="60" cy="68" r="13"/><circle cx="98" cy="64" r="13"/><circle cx="60" cy="68" r="3" fill="currentColor"/><circle cx="98" cy="64" r="3" fill="currentColor"/>' },
      { id: 'glasses',name: 'очки',       d: '<rect x="44" y="54" width="30" height="24" rx="5"/><rect x="84" y="52" width="30" height="24" rx="5"/><path d="M74 66h10"/><circle cx="60" cy="66" r="2.5" fill="currentColor"/><circle cx="100" cy="64" r="2.5" fill="currentColor"/>' },
    ],
  },
  mouth: {
    title: 'Рот',
    items: [
      { id: 'smile', name: 'улыбка',      d: '<path d="M52 96q26 22 54-4"/>' },
      { id: 'grin',  name: 'во все зубы', d: '<path d="M44 92q34 36 70-6q-26 10-70 6z"/><path d="M60 98v10M74 100v12M88 98v10"/>' },
      { id: 'flat',  name: 'ровно',       d: '<path d="M60 98h40"/>' },
      { id: 'wave',  name: 'волна',       d: '<path d="M56 100q10-8 20 0t22 0"/>' },
      { id: 'o',     name: 'ой',          d: '<path d="M70 96q10-6 20 0q2 16-10 18q-12-2-10-18z"/>' },
    ],
  },
  hair: {
    title: 'Волосы',
    items: [
      { id: 'none',   name: 'нет',        d: '' },
      { id: 'spiky',  name: 'дыбом',      d: '<path d="M46 40l6-24l10 16l8-22l6 20l10-18l4 22l12-14l-2 20"/>' },
      { id: 'fringe', name: 'челка',      d: '<path d="M40 44q20-26 50-22q30-4 48 20M56 36l-4 16M78 28l2 18M100 30l6 16"/>' },
      { id: 'curls',  name: 'кудри',      d: '<path d="M38 50q-6-18 10-18q2-16 18-10q8-14 22-4q14-10 22 4q16-6 16 12q14 2 8 18"/>' },
      { id: 'tail',   name: 'хвостик',    d: '<path d="M44 44q30-22 68-6M118 40q22-6 28 14q-6 18-20 10"/>' },
      { id: 'long',   name: 'длинные',    d: '<path d="M42 50q30-30 76-6M40 56q-6 40 4 70M120 50q10 36 2 72"/>' },
       { id: 'curls2', name: 'кудряшки', d: '<path d="M36 80l-2 1l-1 2l-3 0l-2 -1l-1 -2l-1 -2l-1 -2l-1 -2l0 -4l0 -3l2 -3l1 -3l2 -2l2 -1l3 -2l3 -1l3 1l1 4l0 3l-1 4l-1 2l-2 1l-3 0l-2 -3l0 -5l1 -4l2 -2l1 -3l2 -3l1 -2l2 -2l1 -2l2 -2l1 -2l2 -1l3 1l1 3l0 5l0 3l-1 2l-1 2l-2 -1l-1 -2l0 -3l-1 -3l0 -4l1 -4l1 -3l2 -3l2 -2l2 -1l2 -1l3 0l2 -1l4 1l3 2l1 2l1 4l-1 2l-1 2l-3 2l-3 -1l0 -3l1 -5l2 -3l2 -2l2 -1l3 -2l2 -1l2 -1l3 0l2 3l1 5l0 3l-1 4l-1 2l-3 0l-1 -2l1 -4l1 -3l2 -3l3 -2l2 -2l3 -1l3 -1l4 -1l2 1l3 2l1 3l1 3l0 4l0 3l-1 2l-2 -1l-3 -2l-3 0l2 -2l2 -1l3 -2l2 -2l2 -1l2 -1l3 0l3 1l2 3l0 3l0 3l0 5l0 3l-3 -1l-2 -1l-2 -2l-1 -2l2 -2l2 -1l5 -1l5 0l4 1l1 2l1 2l1 3l1 3l0 3l-1 4l-2 3l-1 2l-2 2l-2 3l-2 1l-3 0l-1 -2l-1 -2l2 -2l2 -1l4 0l3 0l2 1l2 1l2 2l1 2l0 4l-1 4l-1 2l-2 2l-2 1l-3 0l-1 -2"/><path d="M23 82l-1 -2l0 -3l1 2l0 3l1 2l2 1l3 0l4 -2l3 -2l2 -4l1 -5l1 -7l0 -5l-1 -4l-1 -3l-2 -2l-3 -1l-3 0l-2 1l-1 2l0 3l0 4l1 3l2 3l3 0l2 1l2 -1l2 -2l1 -2l0 -5l0 -3l0 -3l0 -3l0 -3l0 -3l-1 -4l-1 -2l-3 1l1 3l2 3l2 2l2 2l2 2l4 -2l2 -4l2 -5l3 -4l1 -2l2 -3l1 -4l0 -4l0 -3l-1 -3l-2 -1l-1 2l-1 3l0 5l1 5l1 2l2 3l2 2l3 1l4 -1l2 -2l1 -2l1 -2l1 -2l1 -2l1 -4l0 -3l-2 -1l-2 -1l0 3l1 3l1 2l2 4l1 3l2 1l3 0l2 -1l4 -2l2 -1l1 -2l1 -3l0 -4l1 -2l0 -3l-1 -2l-2 1l0 3l1 2l1 2l1 3l1 2l2 2l2 1l3 0l2 -2l2 -2l0 -4l0 -4l0 -4l0 -3l-3 1l-1 2l-2 3l-1 2l0 4l0 3l1 2l3 3l2 2l1 2l2 3l3 2l3 -1l3 -1l2 -2l0 -3l0 -4l-1 -3l-1 -3l-2 -1l-2 2l-1 2l-1 2l0 3l0 3l1 5l1 2l2 3l1 2l2 3l2 1l2 2l3 1l3 -1l1 -2l2 -3l0 -3l-1 -5l-2 -3l-1 -2l-3 -1l-2 1l-3 2l-1 2l-1 3l-1 6l0 3l0 3l1 2l2 2l2 2l2 2l3 0l4 0l3 -1l3 0l2 -2l1 -3l0 -4l0 -5l-1 -3l-1 -2l-1 -2l-2 -1l-2 -1l-3 2l-2 1l-1 2l-1 3l-2 2l0 4l-1 4l-1 4l0 3l0 3l0 3l1 2l1 3l2 1l2 2l4 0l4 -2l2 -1l1 -2l1 -2l1 -2l0 -4l-1 -2l-2 -3l-2 -1l-3 -1l-4 1l-2 1l-2 1l-1 2l0 5l0 3l1 3l1 3l1 2l2 2l2 1l4 -2l3 -3"/>' },
    ],
  },
  extra: {
    title: 'Штука',
    items: [
      { id: 'none',   name: 'нет',        d: '' },
      { id: 'cap',    name: 'кепка',      d: '<path d="M38 44q40-30 84-4l-4 10q-40-14-78 2z"/><path d="M118 44l34 8"/>' },
      { id: 'crown',  name: 'корона',     d: '<path d="M46 40l-4-26l16 12l18-20l18 20l16-12l-4 26z"/>' },
      { id: 'bow',    name: 'бантик',     d: '<path d="M106 30l24-12l-4 22l-20-6l20 14l-22-4z"/>' },
      { id: 'horns',  name: 'рожки',      d: '<path d="M50 36l-10-24l18 14M110 32l12-24l-16 16"/>' },
      { id: 'halo',   name: 'нимб',       d: '<path d="M46 14q34-14 70 0q-34 12-70 0z"/>' },
      { id: 'scarf',  name: 'шарф',       d: '<path d="M52 132q28 10 56-2M54 136l-8 36M100 134l-2 40"/>' },
    ],
  },
};

const AVATAR_DEFAULT = { head: 'poly', eyes: 'uneven', mouth: 'smile', hair: 'spiky', extra: 'none', color: '#1e2235' };

function avatarPart(layer, id) {
  const items = AVATAR_PARTS[layer].items;
  return items.find(p => p.id === id) || items[0];
}

function avatarSVG(cfg, size = 96) {
  const a = Object.assign({}, AVATAR_DEFAULT, cfg || {});
  const body = '<path d="M80 122l-4 40l8 28"/><path d="M78 150l-30-10l-20 22M80 148l32 4l16 26"/><path d="M84 190l-30 26l-4 34"/><path d="M84 190l28 28l-2 32"/><path d="M50 250l-22 6"/><path d="M110 250l22 4"/>';
  const inner = ['head', 'eyes', 'mouth', 'hair', 'extra'].map(l => avatarPart(l, a[l]).d).join('') + body;
  return `<svg viewBox="0 0 160 280" width="${size}" height="${Math.round(size * 1.75)}" style="color:${a.color}"><g fill="none" stroke="${a.color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">${inner}</g></svg>`;
}

/* Случайный человечек — для кнопки «Собери сам» и для тех, кто не хочет выбирать. */
function avatarRandom() {
  const r = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const out = { color: r(AVATAR_COLORS) };
  for (const l of Object.keys(AVATAR_PARTS)) out[l] = r(AVATAR_PARTS[l].items).id;
  return out;
}
