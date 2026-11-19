import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { SceneMeta } from '../pipeline/meta';
import { lookFor } from '../config/renderLook';

export interface LoadedModel {
  scene: THREE.Group;
  meta: SceneMeta;
  /** materiais por nome (após o pipeline, nomes são únicos) */
  materials: Map<string, THREE.MeshStandardMaterial>;
  doors: Map<string, THREE.Mesh>;
  colliders: THREE.Mesh[];
}

const cache = new Map<string, Promise<LoadedModel>>();

export function loadModel(url: string, onProgress?: (p: number) => void): Promise<LoadedModel> {
  if (!cache.has(url)) {
    cache.set(
      url,
      new Promise<LoadedModel>((resolve, reject) => {
        const loader = new GLTFLoader();
        loader.setMeshoptDecoder(MeshoptDecoder);
        loader.load(url, (gltf) => resolve(prepare(gltf)), (e) => e.total && onProgress?.(e.loaded / e.total), reject);
      }),
    );
  }
  return cache.get(url)!;
}

function prepare(gltf: GLTF): LoadedModel {
  const scene = gltf.scene;
  const meta = (scene.userData.visitaVirtual ?? gltf.scenes[0]?.userData?.visitaVirtual) as SceneMeta;
  if (!meta) throw new Error('O arquivo não contém os metadados da visita. Processe o GLB pelo painel administrativo.');
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const doors = new Map<string, THREE.Mesh>();
  const colliders: THREE.Mesh[] = [];
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats as THREE.MeshStandardMaterial[]) {
      materials.set(m.name, m);
      m.userData.originalName = m.name;
      if (!m.userData.lookApplied) {
        // acabamentos aproximados aos renders (src/config/renderLook.ts)
        m.userData.lookApplied = true;
        // no SketchUp todo material é visto dos dois lados; paredes com a face invertida sumiam (ficavam invisíveis)
        m.side = THREE.DoubleSide;
        const look = lookFor(m.name);
        if (look?.color) m.color.set(look.color);
        if (look?.roughness !== undefined) m.roughness = look.roughness;
        if (look?.env !== undefined) m.envMapIntensity = look.env;
        if (look?.opacity !== undefined) { m.transparent = true; m.opacity = look.opacity; m.depthWrite = false; m.side = THREE.DoubleSide; }
      }
      if (m.map) m.map.anisotropy = 8;
      if (m.transparent) mesh.renderOrder = 2;
    }
    const isGlass = mats.some((m) => m.transparent && m.opacity < 0.5);
    mesh.castShadow = !isGlass;
    mesh.receiveShadow = true;
    if (o.name.startsWith('DOOR__')) doors.set(o.name, mesh);
    else colliders.push(mesh);
  });
  // o GLTFLoader pode criar nós-pai para malhas com várias primitivas
  scene.traverse((o) => {
    if (o.name.startsWith('DOOR__') && !(o as THREE.Mesh).isMesh) {
      doors.set(o.name, o as unknown as THREE.Mesh);
      o.traverse((c) => {
        const i = colliders.indexOf(c as THREE.Mesh);
        if (i >= 0) colliders.splice(i, 1);
      });
    }
  });
  return { scene, meta, materials, doors, colliders };
}

export function useLoadedModel(url: string | null, onProgress?: (p: number) => void) {
  const [model, setModel] = useState<LoadedModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    loadModel(url, onProgress).then((m) => alive && setModel(m)).catch((e) => alive && setError(String(e?.message ?? e)));
    return () => {
      alive = false;
    };
  }, [url, onProgress]);
  return { model, error };
}
