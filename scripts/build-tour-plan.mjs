// Gera src/config/tourPlan.generated.ts: o contorno de cada ambiente sobre a planta humanizada
// (public/visita/planta-*.webp), calculado a partir dos pisos do modelo 3D (model.meta.json).
// Nada é desenhado à mão: os contornos vêm da geometria real do projeto.
//
// Uso:  node scripts/build-tour-plan.mjs [caminho/model.meta.json]
//
// Calibração (planta "Casa-Joceandro-Planta-Humanizada-27-01-8K.png", 8192 x 2844 px, vista de cima ortogonal):
//   px = AX + S * x      py = AZ + S * z      (x, z em metros no sistema do modelo)
// Conferida sobrepondo os contornos às paredes da imagem. Se a planta for trocada por outra imagem,
// recalibre (CAL="AX,AZ,S") e confira com OVERLAY="<planta>|<saida.jpg>" antes de gravar.
import { readFileSync, writeFileSync } from 'node:fs';

const [AX, AZ, S] = (process.env.CAL ?? '1124.3,4487.3,231.89').split(',').map(Number);
const W = 8192, H = 2844;

const metaPath = process.argv[2] ?? 'public/models/v10/model.meta.json';
const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
const P = (x, z) => [AX + S * x, AZ + S * z];
const key = (p) => `${Math.round(p[0])},${Math.round(p[1])}`;

function outline(fp) {
  // arestas que aparecem uma só vez entre os triângulos = borda do piso
  // o piso traz faces de cima e de baixo: triângulos repetidos são descartados
  const tris = [], seen = new Set();
  for (let i = 0; i < fp.length; i += 6) {
    const t = [P(fp[i], fp[i + 1]), P(fp[i + 2], fp[i + 3]), P(fp[i + 4], fp[i + 5])];
    const k = t.map(key).sort().join('|');
    if (seen.has(k)) continue;
    seen.add(k); tris.push(t);
  }
  const edges = new Map();
  let area = 0, cx = 0, cy = 0;
  for (const t of tris) {
    const a2 = (t[1][0] - t[0][0]) * (t[2][1] - t[0][1]) - (t[2][0] - t[0][0]) * (t[1][1] - t[0][1]);
    const A = Math.abs(a2) / 2;
    if (A < 1) continue;
    area += A; cx += A * (t[0][0] + t[1][0] + t[2][0]) / 3; cy += A * (t[0][1] + t[1][1] + t[2][1]) / 3;
    for (let k = 0; k < 3; k++) {
      const p = t[k], q = t[(k + 1) % 3];
      const kp = key(p), kq = key(q);
      if (kp === kq) continue;
      const id = kp < kq ? `${kp}|${kq}` : `${kq}|${kp}`;
      const e = edges.get(id);
      if (e) e.n++; else edges.set(id, { n: 1, a: kp, b: kq });
    }
  }
  const adj = new Map();
  for (const e of edges.values()) if (e.n === 1) {
    (adj.get(e.a) ?? adj.set(e.a, []).get(e.a)).push(e.b);
    (adj.get(e.b) ?? adj.set(e.b, []).get(e.b)).push(e.a);
  }
  // encadeia as arestas de borda em laços fechados
  const used = new Set(), loops = [];
  for (const start of adj.keys()) {
    if ([...adj.get(start)].every((n) => used.has(`${start}|${n}`))) continue;
    const loop = [start];
    let prev = null, cur = start;
    for (let guard = 0; guard < 2000; guard++) {
      const next = adj.get(cur).find((n) => n !== prev && !used.has(`${cur}|${n}`)) ?? adj.get(cur).find((n) => !used.has(`${cur}|${n}`));
      if (!next) break;
      used.add(`${cur}|${next}`); used.add(`${next}|${cur}`);
      if (next === start) break;
      loop.push(next); prev = cur; cur = next;
    }
    if (loop.length >= 3) loops.push(loop);
  }
  const path = loops.map((l) => 'M' + l.join('L') + 'Z').join('');
  return { path, area, cx: cx / area, cy: cy / area, tris };
}

const inside = (x, y, tris) => tris.some(([a, b, c]) => {
  const s = (p, q) => (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
  const d1 = s(a, b), d2 = s(b, c), d3 = s(c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
});

const rooms = meta.rooms.map((r) => {
  const o = outline(r.footprint);
  // âncora do rótulo: centróide, ou o centro do maior triângulo se o centróide cair fora (piso em L)
  let ax = o.cx, ay = o.cy;
  if (!inside(ax, ay, o.tris)) {
    const big = o.tris.reduce((m, t) => {
      const A = Math.abs((t[1][0] - t[0][0]) * (t[2][1] - t[0][1]) - (t[2][0] - t[0][0]) * (t[1][1] - t[0][1]));
      return A > m.A ? { A, t } : m;
    }, { A: 0, t: o.tris[0] }).t;
    ax = (big[0][0] + big[1][0] + big[2][0]) / 3; ay = (big[0][1] + big[1][1] + big[2][1]) / 3;
  }
  const [x0, y0] = P(r.min[0], r.min[2]), [x1, y1] = P(r.max[0], r.max[2]);
  const clamp = (v, m) => Math.max(0, Math.min(m, v));
  return {
    id: r.id, house: r.house, type: r.type, label: r.label, area: r.area,
    path: o.path,
    anchor: [Math.round(ax), Math.round(Math.min(ay, H - 120))],
    box: [Math.round(clamp(x0, W)), Math.round(clamp(y0, H)), Math.round(clamp(x1, W)), Math.round(clamp(y1, H))],
  };
});

const houses = meta.houses.map((h) => {
  const rs = rooms.filter((r) => r.house === h.id);
  return { id: h.id, label: h.label, box: [Math.min(...rs.map((r) => r.box[0])), Math.min(...rs.map((r) => r.box[1])), Math.max(...rs.map((r) => r.box[2])), Math.max(...rs.map((r) => r.box[3]))] };
});

const out = `// Arquivo gerado por scripts/build-tour-plan.mjs a partir de ${metaPath.replace(/\\/g, '/')}. Não edite à mão.
// Coordenadas em pixels da planta humanizada (${W} x ${H}).
export interface PlanRoom { id: string; house: string; type: string; label: string; area: number; path: string; anchor: [number, number]; box: [number, number, number, number] }
export interface PlanHouse { id: string; label: string; box: [number, number, number, number] }
export const PLAN_SIZE = { width: ${W}, height: ${H} } as const;
export const PLAN_HOUSES: PlanHouse[] = ${JSON.stringify(houses)};
export const PLAN_ROOMS: PlanRoom[] = ${JSON.stringify(rooms, null, 0).replace(/\},\{/g, '},\n  {')};
`;
if (process.env.OVERLAY) {
  // conferência: desenha os contornos sobre a imagem  (OVERLAY="<planta> <saida.jpg>")
  const [img, dst] = process.env.OVERLAY.split('|');
  const sharp = (await import('sharp')).default;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${rooms.map((r) => `<path d="${r.path}" fill="rgba(255,0,0,0.12)" stroke="red" stroke-width="10"/>`).join('')}</svg>`;
  const base = await sharp(img, { limitInputPixels: false }).resize(W, H, { fit: "fill" }).png().toBuffer();
  const merged = await sharp(base, { limitInputPixels: false }).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
  await sharp(merged, { limitInputPixels: false }).resize(2400).jpeg().toFile(dst);
} else writeFileSync('src/config/tourPlan.generated.ts', out);
console.log(rooms.map((r) => `${r.id}: laços=${(r.path.match(/M/g) || []).length} âncora=${r.anchor}`).join('\n'));
