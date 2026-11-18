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
  for (let i = 0; i < f.length; i += 6) {
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
export function buildViewpoints(meta: SceneMeta, eye = 1.6): Viewpoint[] {
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
      const pool = free.length ? free : samples;
      const c = { x: (r.min[0] + r.max[0]) / 2, z: (r.min[2] + r.max[2]) / 2 };
      if (r.type === 'estar') {
        const k = r.kitchen ? { x: r.kitchen[0], z: r.kitchen[1] } : best(pool, (p) => -Math.hypot(p.x - r.min[0], p.z - r.min[2]))!;
        const dk = (p: { x: number; z: number }) => Math.hypot(p.x - k.x, p.z - k.z);
        // sala: região do piso mais afastada da cozinha
        const far = samples.filter((p) => dk(p) > 3.5);
        const living = far.length
          ? { x: far.reduce((a, p) => a + p.x, 0) / far.length, z: far.reduce((a, p) => a + p.z, 0) / far.length }
          : c;
        const dl = (p: { x: number; z: number }) => Math.hypot(p.x - living.x, p.z - living.z);
        const sala = best(pool, (p) => Math.min(dl(p), 5) + Math.min(p.clear, 1.2) - Math.max(0, 1.6 - dk(p)) * 2)!;
        vps.push({ id: `${r.id}-sala`, label: 'Sala de estar e jantar', group: h.label, position: [sala.x, r.floorY + eye, sala.z], target: [living.x, r.floorY + 1.1, living.z], room: r.id, mode: 'caminhar' });
        const coz = best(pool, (p) => -Math.abs(dk(p) - 2.6) + Math.min(p.clear, 1.2) * 0.8)!;
        vps.push({ id: `${r.id}-cozinha`, label: 'Cozinha', group: h.label, position: [coz.x, r.floorY + eye, coz.z], target: [k.x, r.floorY + 0.95, k.z], room: r.id, mode: 'caminhar' });
        continue;
      }
      // demais ambientes: logo depois da porta, olhando para o fundo do ambiente
      const door = meta.doors.find((d) => d.rooms.includes(r.id) && d.rooms.length > 1 && meta.rooms.find((x) => x.id !== r.id && d.rooms.includes(x.id))?.type === 'estar')
        ?? meta.doors.find((d) => d.rooms.includes(r.id));
      const near = door
        ? best(pool, (p) => -Math.abs(Math.hypot(p.x - door.hinge[0], p.z - door.hinge[2]) - 0.9) + Math.min(p.clear, 0.8))!
        : best(pool, (p) => p.clear)!;
      const look = best(samples, (p) => Math.hypot(p.x - near.x, p.z - near.z))!;
      const tx = (c.x + look.x) / 2, tz = (c.z + look.z) / 2;
      vps.push({ id: r.id, label: r.label, group: h.label, position: [near.x, r.floorY + eye, near.z], target: [tx, r.floorY + 1.1, tz], room: r.id, mode: 'caminhar' });
    }
  }
  return vps;
}
