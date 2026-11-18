// Metadados gravados no próprio GLB (scene.extras.visitaVirtual).
// A aplicação lê tudo daqui, então atualizar o modelo não exige recompilar o app.
import type { vec3 } from '@gltf-transform/core';
import type { ElementId } from './rules';

export interface RoomMeta {
  id: string;
  house: string;
  type: string;
  label: string;
  area: number | null;
  floorY: number;
  min: vec3;
  max: vec3;
  sourceName: string;
  /** Triângulos do piso no plano XZ: [x0,z0,x1,z1,x2,z2, ...] */
  footprint?: number[];
  /** Centro das bancadas da cozinha (x, z), quando o ambiente tem cozinha */
  kitchen?: [number, number];
}

export interface DoorMeta {
  id: string;
  node: string;
  kind: 'giro' | 'pivotante';
  house: string;
  hinge: vec3;
  width: number;
  height: number;
  rooms: string[];
  label: string;
}

export interface FixtureMeta {
  id: string;
  position: vec3;
  room: string | null;
  kind: string;
}

export interface LedMeta {
  min: vec3;
  max: vec3;
}

export interface SceneMeta {
  version: number;
  generatedAt: string;
  houseBounds: { min: vec3; max: vec3 };
  houses: { id: string; label: string; floorLevel: string }[];
  rooms: RoomMeta[];
  doors: DoorMeta[];
  fixtures: FixtureMeta[];
  leds: LedMeta[];
  materials: { name: string; original: string; element: ElementId; surface: string | null; room: string | null }[];
}
