import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../store';
import type { LoadedModel } from './useModel';
import { lighting, type LightSource } from './runtime';
import { houseLabel } from './rooms';

const WARM = new THREE.Color('#ffd2a1');

/** Monta circuitos e pontos de luz a partir dos ambientes e luminárias do modelo. */
export function buildCircuits(model: LoadedModel) {
  const { meta } = model;
  lighting.sources = lighting.sources.filter((s) => s.circuit === 'externa');
  for (const k of [...lighting.circuits.keys()]) if (k !== 'externa') lighting.circuits.delete(k);
  for (const r of meta.rooms) {
    lighting.circuits.set(r.id, { id: r.id, label: r.label, group: houseLabel(meta, r.house), materials: [], emissive: 0 });
    const fx = meta.fixtures.filter((f) => f.room === r.id);
    const ceiling = r.floorY + (r.type === 'garagem' ? 2.6 : 2.55);
    const pts: THREE.Vector3[] = [];
    if (fx.length) for (const f of fx) pts.push(new THREE.Vector3(f.position[0], f.position[1] - 0.15, f.position[2]));
    const sx = r.max[0] - r.min[0], sz = r.max[2] - r.min[2];
    const n = Math.max(1, Math.round((r.area ?? sx * sz) / 11)) - fx.length;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      pts.push(sx > sz
        ? new THREE.Vector3(r.min[0] + sx * t, ceiling, (r.min[2] + r.max[2]) / 2)
        : new THREE.Vector3((r.min[0] + r.max[0]) / 2, ceiling, r.min[2] + sz * t));
    }
    pts.forEach((p, i) =>
      lighting.sources.push({ id: `${r.id}-${i}`, circuit: r.id, position: p, color: WARM, intensity: r.type === 'garagem' ? 30 : 22, distance: 7 }),
    );
  }
  // fitas de LED da fachada (já existem no modelo)
  const led: THREE.MeshStandardMaterial[] = [];
  const fixtures: THREE.MeshStandardMaterial[] = [];
  for (const [, m] of model.materials) {
    if (/LR_LED|^\.LED$/.test(m.userData.originalName ?? m.name)) led.push(m);
    if (/^Fixture Light/.test(m.name)) fixtures.push(m);
  }
  for (const m of [...led, ...fixtures]) {
    m.emissive.set(fixtures.includes(m) ? '#fff1dc' : '#ffcf86');
    m.emissiveIntensity = 0;
    m.toneMapped = true;
  }
  lighting.circuits.set('fachada', { id: 'fachada', label: 'Fitas de LED da fachada', group: 'Exterior', materials: led, emissive: 6 });
  for (const r of meta.rooms) {
    if (meta.fixtures.some((f) => f.room === r.id)) {
      const c = lighting.circuits.get(r.id)!;
      c.materials = fixtures;
      c.emissive = 2.5;
    }
  }
  // luz que as fitas projetam na parede: pontos ao longo de cada fita vertical
  const ledBoxes = meta.leds.filter((b) => b.max[1] - b.min[1] > 2);
  const seen = new Set<string>();
  for (const b of ledBoxes) {
    const key = `${b.min[0].toFixed(1)}|${b.min[2].toFixed(1)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const h of [0.25, 0.75]) {
      lighting.sources.push({
        id: `led-${seen.size}-${h}`, circuit: 'fachada',
        position: new THREE.Vector3(b.min[0], b.min[1] + (b.max[1] - b.min[1]) * h, b.max[2] + 0.25),
        color: new THREE.Color('#ffc978'), intensity: 6, distance: 3.5,
      });
    }
  }
  return [...lighting.circuits.keys()];
}

export function Lights({ model }: { model: LoadedModel }) {
  const quality = useStore((s) => s.quality);
  const { camera, scene } = useThree();
  const poolSize = quality === 'alta' ? 16 : quality === 'media' ? 10 : 6;
  const pool = useMemo(
    () =>
      Array.from({ length: poolSize }, () => {
        const l = new THREE.PointLight('#ffffff', 0, 7, 2);
        l.castShadow = false;
        return l;
      }),
    [poolSize],
  );
  const assigned = useRef<(LightSource | null)[]>([]);
  const timer = useRef(0);

  useEffect(() => {
    const ids = buildCircuits(model);
    const cur = useStore.getState().lights;
    useStore.getState().set({ lights: Object.fromEntries(ids.map((id) => [id, cur[id] ?? false])) });
  }, [model]);

  useEffect(() => {
    pool.forEach((l) => scene.add(l));
    assigned.current = pool.map(() => null);
    return () => pool.forEach((l) => scene.remove(l));
  }, [pool, scene]);

  useFrame((_, dt) => {
    const on = useStore.getState().lights;
    for (const id of lighting.circuits.keys()) {
      const cur = lighting.level.get(id) ?? 0;
      const next = THREE.MathUtils.damp(cur, on[id] ? 1 : 0, 6, dt);
      lighting.level.set(id, next);
    }
    // materiais compartilhados entre circuitos: usa o maior nível
    const shared = new Map<THREE.Material, number>();
    for (const [id, c] of lighting.circuits) for (const m of c.materials) shared.set(m, Math.max(shared.get(m) ?? 0, (lighting.level.get(id) ?? 0) * c.emissive));
    for (const [m, v] of shared) (m as THREE.MeshStandardMaterial).emissiveIntensity = v;

    timer.current -= dt;
    if (timer.current <= 0) {
      timer.current = 0.2;
      const active = lighting.sources.filter((s) => (lighting.level.get(s.circuit) ?? 0) > 0.01 || on[s.circuit]);
      active.sort((a, b) => a.position.distanceToSquared(camera.position) - b.position.distanceToSquared(camera.position));
      const chosen = new Set(active.slice(0, pool.length));
      // mantém atribuições estáveis para não piscar
      const free: number[] = [];
      assigned.current.forEach((s, i) => {
        if (s && chosen.has(s)) chosen.delete(s);
        else free.push(i);
      });
      for (const s of chosen) {
        const i = free.shift();
        if (i === undefined) break;
        assigned.current[i] = s;
        pool[i].position.copy(s.position);
        pool[i].color.copy(s.color);
        pool[i].distance = s.distance;
      }
      for (const i of free) assigned.current[i] = null;
    }
    pool.forEach((l, i) => {
      const s = assigned.current[i];
      const goal = s ? s.intensity * (lighting.level.get(s.circuit) ?? 0) : 0;
      l.intensity = THREE.MathUtils.damp(l.intensity, goal, 8, dt);
    });
  });
  return null;
}
