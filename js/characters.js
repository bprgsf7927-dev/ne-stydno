/* Персонажи команды «кривой дудл»: Опти, Ник, Душка.
   Рисуются inline-SVG, нарочно криво: дрожащая линия, головы-многоугольники, глаза разного размера.
   Каждый персонаж: три эмоции (idle, happy, upset) и необязательный костюм эпохи.
   Редактировать можно прямо здесь — это обычные SVG-пути. */

const CHARS = {
  // ---------- ОПТИ: радуется всему, улыбка шире головы ----------
  opti: {
    name: 'Опти', color: '#1F3FBF',
    say: {
      idle:  ['Поехали!', 'Я верю в тебя. Вообще всегда.', 'Сейчас будет легко. Наверное.'],
      happy: ['ДА! Я так и знал!', 'Это было красиво.', 'Еще одна дата в копилке!', 'Красавчик.'],
      upset: ['Ну почти же! Почти!', 'Зато теперь точно запомнишь.', 'Это была ловушка, я видел.'],
    },
    draw(mood) {
      const mouth = mood === 'happy' ? 'M38 86q32 40 68-6q-24 12-68 6z' : mood === 'upset' ? 'M44 92q28-12 54 2' : 'M42 90q30 22 60-4q-22 6-60 4z';
      const eyes = mood === 'upset'
        ? '<circle cx="58" cy="60" r="9"/><circle cx="96" cy="56" r="5"/><circle cx="59" cy="62" r="2.5" fill="#1F3FBF"/><circle cx="97" cy="57" r="2" fill="#1F3FBF"/><path d="M48 46l16 6M106 44l-14 8"/>'
        : '<circle cx="58" cy="60" r="9"/><circle cx="96" cy="54" r="5"/><circle cx="60" cy="62" r="2.5" fill="#1F3FBF"/><circle cx="97" cy="55" r="2" fill="#1F3FBF"/>';
      const arms = mood === 'happy' ? 'M76 150l-32-16l-20-30M80 148l34-8l16-30' : mood === 'upset' ? 'M76 150l-30 12l-14-22M80 148l30 10l12-24' : 'M76 150l-30-10l-26 20M80 146l34 2l18 24';
      const sparks = mood === 'happy' ? '<path d="M18 40l6-14M32 34l2-14M6 52l-12-8M150 30l-6-14M136 26l-2-14M160 44l12-8"/>' : '';
      return `<g fill="none" stroke="#1F3FBF" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M38 36l34-14l40 10l14 36l-8 36l-34 14l-38-6l-20-30z"/>
        ${eyes}<path d="${mouth}"/>${mood === 'happy' ? '<path d="M56 94v12M70 96v14M84 94v12"/>' : ''}
        <path d="M80 118l-6 36l10 30"/><path d="${arms}"/>
        <path d="M84 184l-30 24l-6 36"/><path d="M84 184l26 30l-4 32"/>
        <path d="M48 244l-22 6"/><path d="M106 246l22 2"/>${sparks}</g>`;
    },
  },
  // ---------- НИК: тревожинка, волосы дыбом, руки трясутся ----------
  nik: {
    name: 'Ник', color: '#D9480F',
    say: {
      idle:  ['А вдруг не получится…', 'Я уже волнуюсь за тебя.', 'Только не 1453. Только не 1453.'],
      happy: ['Фух. Я думал, все.', 'Получилось?! Получилось!', 'Я не смотрел. Но рад.'],
      upset: ['Все пропало… ладно, не все.', 'Я же говорил, что дата страшная!', 'Сердце. Мое сердце.'],
    },
    draw(mood) {
      const hair = '<path d="M46 40l6-24l10 16l8-22l6 20l10-18l4 22l12-14l-2 20"/>';
      const eyes = mood === 'upset'
        ? '<circle cx="60" cy="80" r="13"/><circle cx="96" cy="78" r="13"/><circle cx="60" cy="80" r="3" fill="#D9480F"/><circle cx="96" cy="78" r="3" fill="#D9480F"/>'
        : mood === 'happy'
        ? '<path d="M50 80q10-12 20 0M86 78q10-12 20 0"/>'
        : '<circle cx="60" cy="80" r="11"/><circle cx="96" cy="78" r="8"/><circle cx="62" cy="82" r="3" fill="#D9480F"/><circle cx="97" cy="79" r="2.5" fill="#D9480F"/>';
      const mouth = mood === 'upset' ? '<path d="M66 110q14-8 28 0q2 24-14 26q-16-2-14-26z"/>' : mood === 'happy' ? '<path d="M60 112q20 18 40 0"/>' : '<path d="M62 114q10-6 20 0t20 0"/>';
      const arms = mood === 'upset' ? 'M74 160l-14 6l-12-6l-10 8l-10-6M76 156l16 8l10-6l10 8l10-6' : mood === 'happy' ? 'M74 160l-28-20l-6-28M76 156l30-18l8-26' : 'M74 160l-26 4l-10 20M76 156l28 8l6 22';
      const sweat = mood === 'upset' ? '<path d="M140 50q-8 14 0 22q8-8 0-22z"/><path d="M152 86q-6 10 0 16q6-6 0-16z"/>' : '';
      return `<g fill="none" stroke="#D9480F" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M42 60l24-20l40 6l20 30l-4 40l-30 18l-40-4l-18-32z"/>${hair}${eyes}${mouth}
        <path d="M76 136l-4 44l8 26"/><path d="${arms}"/>
        <path d="M80 206l-28 30l-2 28"/><path d="M80 206l30 28l2 30"/>
        <path d="M50 264l-24 4"/><path d="M112 264l24 4"/>${sweat}</g>`;
    },
  },
  // ---------- ДУШКА: самодовольный заучка в очках, все знает ----------
  dushka: {
    name: 'Душка', color: '#3FA66A',
    say: {
      idle:  ['Я это знаю. Проверим, знаешь ли ты.', 'Вообще-то, это легко.', 'Записывай, повторять не буду. Буду.'],
      happy: ['Ну, это было очевидно.', 'Я бы ответил быстрее. Но ок.', 'Принято. Для протокола: верно.'],
      upset: ['Вообще-то, вот что надо запомнить:', 'Маленький лайфхак:', 'Для протокола:'],
    },
    draw(mood) {
      const brows = mood === 'happy' ? '<path d="M48 44l20-8M90 40l18-4"/>' : mood === 'upset' ? '<path d="M48 50l20-2M90 46l18 6"/>' : '<path d="M48 48l20-4M90 44l18 2"/>';
      const glasses = '<rect x="44" y="52" width="30" height="24" rx="5"/><rect x="84" y="50" width="30" height="24" rx="5"/><path d="M74 64h10"/>';
      const pupils = mood === 'happy' ? '<path d="M52 64h14M92 62h14"/>' : '<circle cx="60" cy="64" r="2.5" fill="#3FA66A"/><circle cx="100" cy="62" r="2.5" fill="#3FA66A"/>';
      const mouth = mood === 'happy' ? '<path d="M60 98q22 14 44-2"/>' : mood === 'upset' ? '<path d="M64 98h34"/>' : '<path d="M62 98q20 6 40-2"/>';
      const arms = mood === 'upset' ? 'M74 150l-30 14l-8 30M76 148l22-30l4-28' : mood === 'happy' ? 'M74 150l-28 6l-14 24M76 148l28 2l16 26' : 'M74 150l-30 14l-8 30M76 148l26 8l12 26';
      const book = mood === 'upset' ? '' : '<path d="M30 194l-14-6l-14 10l16 8z"/>';
      return `<g fill="none" stroke="#3FA66A" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M46 36l30-10l34 12l12 34l-6 42l-30 14l-36-8l-16-34z"/>${brows}${glasses}${pupils}
        <path d="M78 70l-10 24l18 2"/>${mouth}
        <path d="M74 128l-2 44l6 34"/><path d="M72 132l4 10l-6 30l8 10l6-36l-4-14z"/><path d="${arms}"/>${book}
        <path d="M78 206l-30 30l-4 30"/><path d="M78 206l26 32l6 28"/>
        <path d="M44 266l-22 4"/><path d="M110 266l22 4"/></g>`;
    },
  },
};

// Костюмы эпох: накладываются поверх головы. Ключ — id параграфа. Даня, дорисовывай тут.
const COSTUMES = {
  'r':     '<g fill="none" stroke="#5b6270" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M40 36q2-24 40-34q38 10 40 34z"/><path d="M80 2v-10"/><path d="M40 36q40 8 80 0"/></g>', // шлем-шишак
  'rk':    '<g fill="none" stroke="#c48a00" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M42 36q-2-22 38-28q40 6 38 28z"/><path d="M80 8v-12M74 -2h12"/><path d="M40 38q40 8 80 0" stroke="#6b4a1e" stroke-width="8"/></g>', // шапка Мономаха
  'rm':    '<g fill="none" stroke="#1e2235" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M38 40q0-34 42-36q42 2 42 36"/><path d="M38 40q42 6 84 0"/></g>', // монашеский клобук

  '15':    '<g fill="none" stroke="#6b4a1e" stroke-width="5" stroke-linecap="round"><path d="M40 34q40-26 80-4l-6-18q-36-14-70 4z"/><path d="M78 12v-10"/></g>', // степная шапка
  '16-17': '<g fill="none" stroke="#b5451b" stroke-width="5" stroke-linecap="round"><path d="M30 36q50-22 100 0"/><path d="M80 34q-30-36 0-30q30-6 0 30z"/></g>', // соломенная шляпа
  '18':    '<g fill="none" stroke="#c48a00" stroke-width="5" stroke-linecap="round"><path d="M44 34q36-30 70-2"/><path d="M58 22q22-14 44 0M78 10v12"/></g>', // тюрбан
  '19':    '<g fill="none" stroke="#1a1a1a" stroke-width="5" stroke-linecap="round"><path d="M40 36q40-20 80-2M48 28q32-16 64 0"/></g>', // повязка
  '20':    '<g fill="none" stroke="#2f9e5b" stroke-width="5" stroke-linecap="round"><path d="M60 30l-10-28M80 28l0-30M100 30l10-28"/></g>', // перья
  '21-22': '<g fill="none" stroke="#6a7179" stroke-width="5" stroke-linecap="round"><path d="M40 38q40-30 80-4l-4-18l-36-8l-36 10z"/><path d="M62 24h36"/></g>', // шлем
  '23':    '<g fill="none" stroke="#7c5cff" stroke-width="5" stroke-linecap="round"><path d="M44 36q36-40 72 0"/><path d="M50 30q30-18 60 0"/></g>', // тюрбан-чалма
  '24':    '<g fill="none" stroke="#1a1a1a" stroke-width="5" stroke-linecap="round"><path d="M30 36h100M50 36l6-24h44l6 24"/></g>', // шляпа Колумба
};

function charSVG(id, mood = 'idle', costume = null, size = 96) {
  const c = CHARS[id];
  return `<svg class="char char-${id}" viewBox="-20 -40 200 324" width="${size}" height="${size * 1.6}" aria-label="${c.name}">${c.draw(mood)}${costume && costumeOf(costume) ? `<g transform="translate(-30 -44) scale(1.38)">${costumeOf(costume)}</g>` : ''}</svg>`;
}
function costumeOf(tid) {
  if (COSTUMES[tid]) return COSTUMES[tid];
  if (!/^r/.test(tid)) return '';
  if (['r12', 'r36-37', 'r40-41'].includes(tid)) return COSTUMES.rk;
  if (['r19-20', 'r42-43'].includes(tid)) return COSTUMES.rm;
  return COSTUMES.r;
}
function charLine(id, mood) { const a = CHARS[id].say[mood] || CHARS[id].say.idle; return a[Math.floor(Math.random() * a.length)]; }
