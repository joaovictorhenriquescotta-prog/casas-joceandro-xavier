import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../store';
import { timeState } from './runtime';

const DAY = new THREE.Color('#fff7ee');

/*
 * Claridade de dia dentro dos ambientes.
 * No navegador não há luz rebatida (a luz que entra pelas janelas e clareia o cômodo inteiro, como nos renders):
 * com o telhado fazendo sombra, o interior ficava escuro. Duas luzes suaves sem sombra, no teto do cômodo atual,
 * fazem esse papel. Somem à noite (aí valem as luminárias) e fora da casa.
 */
export function InteriorFill() {
  const { scene } = useThree();
  const lights = useMemo(
    () => [0, 1].map(() => {
      const l = new THREE.PointLight(DAY, 0, 9, 1.1);
      l.castShadow = false;
      return l;
    }),
    [],
  );
  useEffect(() => {
    lights.forEach((l) => scene.add(l));
    return () => lights.forEach((l) => scene.remove(l));
  }, [lights, scene]);

  useFrame(() => {
    const st = useStore.getState();
    const room = st.meta?.rooms.find((r) => r.id === st.currentRoom);
    const k = timeState.interior * (1 - timeState.night);
    if (!room || k < 0.01) {
      for (const l of lights) l.intensity = 0;
      return;
    }
    const sx = room.max[0] - room.min[0], sz = room.max[2] - room.min[2];
    const y = room.floorY + 2.35;
    const cx = (room.min[0] + room.max[0]) / 2, cz = (room.min[2] + room.max[2]) / 2;
    // duas luzes ao longo do lado comprido do cômodo
    const along = sx > sz;
    const off = (along ? sx : sz) * 0.25;
    lights[0].position.set(along ? cx - off : cx, y, along ? cz : cz - off);
    lights[1].position.set(along ? cx + off : cx, y, along ? cz : cz + off);
    const area = room.area ?? sx * sz;
    const power = THREE.MathUtils.clamp(area * 0.25, 1.5, 5);
    for (const l of lights) {
      l.intensity = power * k;
      l.distance = Math.max(sx, sz) + 3;
    }
  });
  return null;
}
