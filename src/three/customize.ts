import * as THREE from 'three';
import type { SceneMeta } from '../pipeline/meta';
import type { Customization } from '../store';
import { finishById } from '../config/finishes';
import { finishTextures } from '../textures/procedural';

interface Snapshot {
  color: THREE.Color;
  map: THREE.Texture | null;
  normalMap: THREE.Texture | null;
  roughness: number;
  metalness: number;
}

/** Alvos de personalização disponíveis no modelo carregado. */
export function listTargets(meta: SceneMeta) {
  const floors = new Map<string, string[]>();
  const walls = new Map<string, string[]>();
  const elements = new Map<string, string[]>();
  for (const m of meta.materials) {
    if (m.surface === 'piso' && m.room) push(floors, m.room, m.name);
    else if (m.surface === 'parede' && m.room) {
      push(walls, m.room, m.name);
      push(elements, 'paredes-internas', m.name);
    } else if (m.element) push(elements, m.element, m.name);
  }
  return { floors, walls, elements };
}

function push(map: Map<string, string[]>, k: string, v: string) {
  if (!map.has(k)) map.set(k, []);
  map.get(k)!.push(v);
}

/** Resolve o valor escolhido para cada material (ambiente tem prioridade sobre o geral). */
export function resolveCustomization(meta: SceneMeta, custom: Customization): Map<string, string> {
  const out = new Map<string, string>();
  const t = listTargets(meta);
  const assign = (names: string[] | undefined, v: string | undefined) => {
    if (!names || !v) return;
    for (const n of names) out.set(n, v);
  };
  for (const [el, names] of t.elements) assign(names, custom[`el:${el}`]);
  for (const [room, names] of t.walls) assign(names, custom[`parede:${room}`]);
  for (const [room, names] of t.floors) assign(names, custom[`piso:${room}`]);
  return out;
}

export function applyCustomization(
  materials: Map<string, THREE.MeshStandardMaterial>,
  meta: SceneMeta,
  custom: Customization,
  texSize: number,
) {
  const values = resolveCustomization(meta, custom);
  for (const [name, mat] of materials) {
    const snap = (mat.userData.snapshot ??= {
      color: mat.color.clone(),
      map: mat.map,
      normalMap: mat.normalMap,
      roughness: mat.roughness,
      metalness: mat.metalness,
    }) as Snapshot;
    const v = values.get(name);
    const prevKey = mat.userData.appliedKey ?? null;
    if ((v ?? null) === prevKey) continue;
    mat.userData.appliedKey = v ?? null;
    if (!v) {
      mat.color.copy(snap.color);
      mat.map = snap.map;
      mat.normalMap = snap.normalMap;
      mat.roughness = snap.roughness;
      mat.metalness = snap.metalness;
    } else if (v.startsWith('#')) {
      mat.color.set(v);
      mat.map = null;
      mat.normalMap = null;
      mat.metalness = Math.min(snap.metalness, 0.6);
    } else {
      const f = finishById(v);
      if (!f) continue;
      const tex = finishTextures(f, texSize);
      mat.color.set('#ffffff');
      mat.map = tex.map;
      mat.normalMap = tex.normal;
      mat.normalScale.set(0.6, 0.6);
      mat.roughness = f.roughness;
      mat.metalness = 0;
    }
    mat.needsUpdate = true;
  }
}
