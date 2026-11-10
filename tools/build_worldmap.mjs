import fs from 'fs';
import * as topojson from 'topojson-client';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
const topo = JSON.parse(fs.readFileSync('node_modules/world-atlas/countries-110m.json'));
const wc = JSON.parse(fs.readFileSync('node_modules/world-countries/countries.json'));
const byNum = Object.fromEntries(wc.map(c => [c.ccn3, c]));
const byName = Object.fromEntries(wc.map(c => [c.name.common, c]));
const W = 360, H = 188;
const contOf = (c) => {
  if (!c) return null;
  if (c.region === 'Africa') return 'Африка';
  if (c.region === 'Europe' || c.region === 'Asia') return 'Евразия';
  if (c.region === 'Americas') return c.subregion === 'South America' ? 'Южная Америка' : 'Северная Америка';
  if (c.region === 'Antarctic') return 'Антарктида';
  if (c.cca3 === 'AUS') return 'Австралия';
  return null;
};
const geoms = topo.objects.countries.geometries;
const groups = {}, unk = [];
for (const g of geoms) {
  const c = byNum[g.id] || byName[g.properties.name] || (g.properties.name === 'Kosovo' ? byName['Kosovo'] : null);
  let k = contOf(c);
  if (!k && /Somaliland/.test(g.properties.name)) k = 'Африка';
  if (!k && /Cyprus/.test(g.properties.name)) k = 'Евразия';
  if (!k) { unk.push(g.properties.name); k = 'other'; }
  (groups[k] = groups[k] || []).push(g);
}
console.error('без материка:', unk.join(', '));
const land = topojson.feature(topo, topo.objects.land);
const proj = geoNaturalEarth1().fitExtent([[2, 2], [W - 2, H - 2]], { type: 'Sphere' });
const path = geoPath(proj).digits(1);
const conts = {};
for (const [k, gs] of Object.entries(groups)) conts[k] = path(topojson.merge(topo, gs));
// океаны: многоугольники в градусах, ребра уплотняем и проецируем как ломаные (без сферических сюрпризов)
const P = (pts) => { const out = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; const n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / 2)); for (let j = 0; j < n; j++) out.push(proj([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n])); } return 'M' + out.map(p => p.map(v => v.toFixed(1)).join(' ')).join('L') + 'Z'; };
const oceans = {
  'Северный Ледовитый океан': P([[-180, 66], [180, 66], [180, 89.9], [-180, 89.9]]),
  'Атлантический океан': P([[-100, 66], [40, 66], [40, 30], [20, 30], [20, -60], [-68, -60], [-80, 8], [-100, 20]]),
  'Индийский океан': P([[20, 30], [60, 30], [100, 22], [100, -10], [147, -40], [147, -60], [20, -60]]),
  'Тихий океан': P([[100, 22], [140, 66], [179.99, 66], [179.99, -60], [147, -60], [147, -40], [100, -10]]) + ' ' + P([[-179.99, 66], [-150, 66], [-100, 20], [-80, 8], [-68, -60], [-179.99, -60]]),
};
const s = proj.scale(), t = proj.translate();
const out = `// Карта мира для Гео-тренажера. Собрано из Natural Earth (world-atlas, 1:110 млн), проекция Natural Earth.
// Материки — слитые страны (Россия — Евразия, Гренландия — Северная Америка, острова Океании — серые, не нажимаются).
// Океаны — грубые зоны «бассейнов» под сушей. Пересобрать: tools/build_worldmap.mjs (нужны npm-пакеты, см. файл).
window.WORLD_MAP = ${JSON.stringify({ w: W, h: H, scale: +s.toFixed(4), tx: +t[0].toFixed(3), ty: +t[1].toFixed(3), sphere: path({ type: 'Sphere' }), conts, oceans })};
`;
fs.writeFileSync(process.argv[2], out);
console.error('размер', out.length, Object.keys(conts));
