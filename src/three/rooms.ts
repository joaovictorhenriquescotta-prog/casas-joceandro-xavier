import type { RoomMeta, SceneMeta } from '../pipeline/meta';
import type { Viewpoint } from '../store';

export function pointInFootprint(r: RoomMeta, x: number, z: number) {
  if (x < r.min[0] || x > r.max[0] || z < r.min[2] || z > r.max[2]) return false;
  const f = r.footprint ?? [];
  for (let i = 0; i < f.length; i += 6) {
    const d1 = (x - f[i + 2]) * (f[i + 1] - f[i + 3]) - (f[i] - f[i + 2]) * (z - f[i + 3]);
    const d2 = (x - f[i + 4]) * (f[i + 3] - f[i + 5]) - (f[i + 2] - f[i + 4]) * (z - f[i + 5]);
    const d3 = (x - f[i]) * (f[i + 5] - f[i + 1]) - (f[i + 4] - f[i]) * (z - f[i + 1]);
    const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
    if (!(neg && pos)) return true;
  }
  return false;
}

export function roomAt(meta: SceneMeta, x: number, y: number, z: number) {
  return meta.rooms.find((r) => y > r.floorY - 0.6 && y < r.floorY + 3 && pointInFootprint(r, x, z)) ?? null;
}

/** Bordas do contorno do piso: arestas que aparecem em apenas um triângulo. */
function boundaryEdges(r: RoomMeta) {
  const f = r.footprint ?? [];
  const key = (x: number, z: number) => `${x.toFixed(2)},${z.toFixed(2)}`;
  const count = new Map<string, { n: number; e: number[] }>();
  const tris = new Set<string>();
  for (let i = 0; i < f.length; i += 6) {
    // pisos com face dupla (frente e verso) repetem o triângulo: conta só uma vez
    const tk = [key(f[i], f[i + 1]), key(f[i + 2], f[i + 3]), key(f[i + 4], f[i + 5])].sort().join('/');
    if (tris.has(tk)) continue;
    tris.add(tk);
    for (let k = 0; k < 3; k++) {
      const a = k * 2, b = ((k + 1) % 3) * 2;
      const e = [f[i + a], f[i + a + 1], f[i + b], f[i + b + 1]];
      const ka = key(e[0], e[1]), kb = key(e[2], e[3]);
      const id = ka < kb ? ka + '|' + kb : kb + '|' + ka;
      const c = count.get(id);
      if (c) c.n++;
      else count.set(id, { n: 1, e });
    }
  }
  return [...count.values()].filter((c) => c.n === 1).map((c) => c.e);
}

function distToSegment(x: number, z: number, e: number[]) {
  const dx = e[2] - e[0], dz = e[3] - e[1];
  const l2 = dx * dx + dz * dz || 1e-9;
  const t = Math.max(0, Math.min(1, ((x - e[0]) * dx + (z - e[1]) * dz) / l2));
  return Math.hypot(x - (e[0] + t * dx), z - (e[1] + t * dz));
}

interface Sample { x: number; z: number; clear: number }

/** Pontos do piso a cada 25 cm com a distância livre até as paredes. */
function sampleRoom(r: RoomMeta, step = 0.25): Sample[] {
  const edges = boundaryEdges(r);
  const out: Sample[] = [];
  for (let x = r.min[0] + step / 2; x < r.max[0]; x += step)
    for (let z = r.min[2] + step / 2; z < r.max[2]; z += step) {
      if (!pointInFootprint(r, x, z)) continue;
      let clear = Infinity;
      for (const e of edges) clear = Math.min(clear, distToSegment(x, z, e));
      out.push({ x, z, clear });
    }
  return out;
}

function best<T>(arr: T[], score: (t: T) => number) {
  let b: T | undefined, bs = -Infinity;
  for (const a of arr) {
    const s = score(a);
    if (s > bs) { bs = s; b = a; }
  }
  return b;
}

export const houseLabel = (meta: SceneMeta, id: string) => meta.houses.find((h) => h.id === id)?.label ?? id;

/**
 * Pontos de vista calculados a partir dos ambientes do modelo.
 * Interno: próximo à porta de acesso, olhando para o centro do ambiente.
 */
/** Consulta de visibilidade no modelo: distância livre a partir de um ponto numa direção. */
export type FreeProbe = (x: number, y: number, z: number, dx: number, dy: number, dz: number, max: number) => number;

export function buildViewpoints(meta: SceneMeta, eye = 1.6, probe?: FreeProbe): Viewpoint[] {
  const b = meta.houseBounds;
  const cx = (b.min[0] + b.max[0]) / 2;
  const floor = Math.min(...meta.rooms.map((r) => r.floorY));
  const front = b.max[2];
  const vps: Viewpoint[] = [
    { id: 'fachada', label: 'Fachada', group: 'Exterior', position: [cx + 11, floor + 6, front + 12.5], target: [cx - 1, floor + 1.8, front - 7.5], mode: 'orbita' },
    { id: 'aerea', label: 'Vista aérea (planta)', group: 'Exterior', position: [cx, floor + 30, front - 6], target: [cx, floor, front - 8.5], mode: 'orbita' },
  ];
  for (const h of meta.houses) {
    const rs = meta.rooms.filter((r) => r.house === h.id);
    if (!rs.length) continue;
    const gar = rs.find((r) => r.type === 'garagem');
    const estar = rs.find((r) => r.type === 'estar');
    if (gar && estar) {
      // frente do lote, de pé na entrada da garagem, como nas imagens de referência
      const gx = (gar.min[0] + gar.max[0]) / 2;
      const hx = (estar.min[0] + estar.max[0]) / 2;
      vps.push({
        id: `${h.id}-frente`, label: 'Jardim e garagem', group: h.label,
        position: [gx + (hx - gx) * 0.45, gar.floorY + eye, gar.max[2] - 1.3],
        target: [hx, gar.floorY + 2.2, estar.max[2] - 2], room: gar.id, mode: 'caminhar',
      });
    }
    for (const r of rs) {
      if (r.type === 'garagem') continue;
      const samples = sampleRoom(r);
      if (!samples.length) continue;
      const free = samples.filter((p) => p.clear >= 0.5);
      let pool = free.length ? free : samples;
      // com o modelo carregado: descarta pontos dentro ou colados em móveis
      const ok = new Map<Sample, boolean>();
      const standing = (p: Sample) => {
        if (!probe) return true;
        if (ok.has(p)) return ok.get(p)!;
        let good = true;
        for (const hy of [0.5, 1.0, eye]) {
          for (let a = 0; a < 8 && good; a++) {
            const ang = (a / 8) * Math.PI * 2;
            if (probe(p.x, r.floorY + hy, p.z, Math.cos(ang), 0, Math.sin(ang), 0.45) < 0.45) good = false;
          }
        }
        ok.set(p, good);
        return good;
      };
      const vis = (p: Sample, t: { x: number; z: number }, ty: number, slack = 0.4) => {
        if (!probe) return 1;
        const dx = t.x - p.x, dy = ty - (r.floorY + eye), dz = t.z - p.z;
        const d = Math.hypot(dx, dy, dz) || 1;
        const f = probe(p.x, r.floorY + eye, p.z, dx / d, dy / d, dz / d, d);
        return f >= d - slack ? 1 : f / d;
      };
      // campo de visão livre: raios a ±25° do olhar precisam alcançar ao menos 1,8 m
      const cone = (p: Sample, t: { x: number; z: number }) => {
        if (!probe) return 1;
        const base = Math.atan2(t.z - p.z, t.x - p.x);
        let sum = 0;
        for (const da of [-0.44, -0.22, 0.22, 0.44]) sum += Math.min(1, probe(p.x, r.floorY + eye, p.z, Math.cos(base + da), 0, Math.sin(base + da), 1.8) / 1.8);
        return sum / 4;
      };
      /**
       * Melhor enquadramento: posição e alvo com a maior linha de visão livre (diagonal do
       * ambiente), como um fotógrafo de arquitetura faria. Sem o modelo, usa só o piso.
       */
      const longView = (from: Sample[], to: Sample[], bonus: (p: Sample) => number) => {
        let bestP = from[0], bestT = to[0], bs = -Infinity;
        for (const p of from) {
          const far2 = [...to].sort((a, b) => Math.hypot(b.x - p.x, b.z - p.z) - Math.hypot(a.x - p.x, a.z - p.z)).slice(0, 24);
          for (let i = 0; i < far2.length; i += 3) {
            const t = far2[i];
            const d = Math.hypot(t.x - p.x, t.z - p.z);
            if (d < 1.2) continue;
            const sc = Math.min(d, 7) * vis(p, t, r.floorY + 1.2) + cone(p, t) * 1.5 + bonus(p);
            if (sc > bs) { bs = sc; bestP = p; bestT = t; }
          }
        }
        return { p: bestP, t: bestT };
      };
      if (probe) {
        const coarse = pool.filter((p) => Math.round((p.x - r.min[0]) / 0.25) % 2 === 0 && Math.round((p.z - r.min[2]) / 0.25) % 2 === 0);
        const stand = coarse.filter(standing);
        if (stand.length) pool = stand;
      }
      if (r.type === 'estar') {
        const k = r.kitchen ? { x: r.kitchen[0], z: r.kitchen[1] } : best(pool, (p) => -Math.hypot(p.x - r.min[0], p.z - r.min[2]))!;
        const dk = (p: { x: number; z: number }) => Math.hypot(p.x - k.x, p.z - k.z);
        // sala: região do piso mais afastada da cozinha
        const far = samples.filter((p) => dk(p) > 3.5);
        const sala = longView(pool, far.length ? far : samples, (p) => Math.min(p.clear, 1) * 0.6 - Math.max(0, 1.6 - dk(p)) * 2);
        vps.push({ id: `${r.id}-sala`, label: 'Sala de estar e jantar', group: h.label, position: [sala.p.x, r.floorY + eye, sala.p.z], target: [sala.t.x, r.floorY + 1.2, sala.t.z], room: r.id, mode: 'caminhar' });
        const coz = best(pool, (p) => -Math.abs(dk(p) - 2.6) + Math.min(p.clear, 1.2) * 0.8 + vis(p, k, r.floorY + 0.95, 0.9) * 6 + cone(p, k) * 2)!;
        vps.push({ id: `${r.id}-cozinha`, label: 'Cozinha', group: h.label, position: [coz.x, r.floorY + eye, coz.z], target: [k.x, r.floorY + 0.95, k.z], room: r.id, mode: 'caminhar' });
        continue;
      }
      // demais ambientes: logo depois da porta, olhando para o fundo do ambiente
      const door = meta.doors.find((d) => d.rooms.includes(r.id) && d.rooms.length > 1 && meta.rooms.find((x) => x.id !== r.id && d.rooms.includes(x.id))?.type === 'estar')
        ?? meta.doors.find((d) => d.rooms.includes(r.id));
      const dd = (p: Sample) => (door ? Math.hypot(p.x - door.hinge[0], p.z - door.hinge[2]) : 0);
      const v = longView(pool, samples, (p) => Math.min(p.clear, 0.8) * 0.5 - Math.max(0, dd(p) - 1.2) * 0.6);
      vps.push({ id: r.id, label: r.label, group: h.label, position: [v.p.x, r.floorY + eye, v.p.z], target: [v.t.x, r.floorY + 1.15, v.t.z], room: r.id, mode: 'caminhar' });
    }
  }
  return vps;
}

/** Pontos de vista refinados ficam guardados no navegador para a próxima visita. */
const vpKey = (url: string | null, gen: string) => `cjx-vps:${url}:${gen}`;
export function cachedViewpoints(url: string | null, gen: string): Viewpoint[] | null {
  try {
    const raw = localStorage.getItem(vpKey(url, gen));
    return raw ? (JSON.parse(raw) as Viewpoint[]) : null;
  } catch {
    return null;
  }
}
export function cacheViewpoints(url: string | null, gen: string, vps: Viewpoint[]) {
  try {
    localStorage.setItem(vpKey(url, gen), JSON.stringify(vps));
  } catch {
    /* armazenamento indisponível: segue sem cache */
  }
}
