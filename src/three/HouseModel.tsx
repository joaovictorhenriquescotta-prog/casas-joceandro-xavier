import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../store';
import type { LoadedModel } from './useModel';
import { applyCustomization } from './customize';
import { physics } from './runtime';
import { pointInFootprint } from './rooms';

interface DoorRig {
  id: string;
  pivot: THREE.Object3D;
  mesh: THREE.Object3D;
  open: number; // ângulo atual
  target: number; // ângulo quando aberta
}

export function HouseModel({ model }: { model: LoadedModel }) {
  const { scene } = useThree();
  const custom = useStore((s) => s.custom);
  const showOriginal = useStore((s) => s.showOriginal);
  const preview = useStore((s) => s.preview);
  const cutaway = useStore((s) => s.cutaway);
  const quality = useStore((s) => s.quality);
  const rigs = useRef<DoorRig[]>([]);

  // Portas: pivô no eixo da dobradiça e sentido de abertura escolhido sem colisão
  useMemo(() => {
    const ray = new THREE.Raycaster();
    rigs.current = model.meta.doors.flatMap((d) => {
      const mesh = model.doors.get(d.node);
      if (!mesh) return [];
      const pivot = new THREE.Object3D();
      pivot.name = `PIVOT__${d.id}`;
      pivot.position.set(d.hinge[0], d.hinge[1], d.hinge[2]);
      model.scene.add(pivot);
      pivot.updateMatrixWorld(true);
      pivot.attach(mesh);
      const box = new THREE.Box3().setFromObject(mesh);
      const center = box.getCenter(new THREE.Vector3());
      const arm = new THREE.Vector3(center.x - d.hinge[0], 0, center.z - d.hinge[2]);
      const max = d.kind === 'pivotante' ? 1.4 : 1.5;
      const rooms = model.meta.rooms.filter((r) => d.rooms.includes(r.id));
      let best = max, bestScore = -Infinity;
      for (const sgn of [1, -1]) {
        const a = max * sgn;
        const end = arm.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a).multiplyScalar(d.kind === 'pivotante' ? 1 : 2);
        const p = new THREE.Vector3(d.hinge[0] + end.x, d.hinge[1] + 1, d.hinge[2] + end.z);
        let score = 0;
        const inRoom = rooms.find((r) => pointInFootprint(r, p.x, p.z));
        if (inRoom) score += 1 + (inRoom.type === 'estar' || inRoom.type === 'garagem' ? 0 : 1);
        const origin = new THREE.Vector3(d.hinge[0], d.hinge[1] + 1, d.hinge[2]);
        const dir = p.clone().sub(origin);
        ray.set(origin.addScaledVector(dir.clone().normalize(), 0.12), dir.normalize());
        ray.far = d.width * 0.95;
        if (ray.intersectObjects(model.colliders, false).length) score -= 3;
        if (score > bestScore) {
          bestScore = score;
          best = a;
        }
      }
      mesh.userData.doorId = d.id;
      return [{ id: d.id, pivot, mesh, open: 0, target: best }];
    });
    const dyn: THREE.Mesh[] = [];
    for (const d of model.doors.values()) d.traverse((o) => { if ((o as THREE.Mesh).isMesh) dyn.push(o as THREE.Mesh); });
    physics.dynamic = dyn;
    physics.colliders = model.colliders;
  }, [model]);

  useEffect(() => {
    applyCustomization(model.materials, model.meta, showOriginal ? {} : { ...custom, ...(preview ?? {}) }, quality === 'baixa' ? 512 : 1024);
  }, [model, custom, preview, showOriginal, quality]);

  useEffect(() => {
    model.scene.traverse((o) => {
      if (o.name.startsWith('ROOF__')) o.visible = !cutaway;
    });
  }, [model, cutaway]);

  useEffect(() => {
    scene.add(model.scene);
    return () => {
      scene.remove(model.scene);
    };
  }, [scene, model]);

  useFrame((_, dt) => {
    const doors = useStore.getState().doors;
    for (const r of rigs.current) {
      const goal = doors[r.id] ? r.target : 0;
      const k = 1 - Math.exp(-dt * 3.2);
      r.open += (goal - r.open) * k;
      r.pivot.rotation.y = r.open;
    }
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    let o: THREE.Object3D | null = e.object;
    while (o && !o.userData.doorId) o = o.parent;
    if (o && e.distance < 8) {
      e.stopPropagation();
      useStore.getState().toggleDoor(o.userData.doorId);
    }
  };

  return (
    <group>
      {rigs.current.map((r) => (
        <primitive key={r.id} object={r.pivot} onClick={onClick} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')} />
      ))}
    </group>
  );
}
