import * as THREE from 'three';

/** Estado mutável compartilhado entre componentes 3D (fora do React para não re-renderizar). */
export const timeState = { t: 1, night: 0.15, interior: 0 };

export interface LightSource {
  id: string;
  circuit: string;
  position: THREE.Vector3;
  color: THREE.Color;
  /** intensidade em candela aproximada */
  intensity: number;
  distance: number;
}

export interface Circuit {
  id: string;
  label: string;
  group: string;
  materials: THREE.MeshStandardMaterial[];
  emissive: number;
}

export const lighting = {
  sources: [] as LightSource[],
  circuits: new Map<string, Circuit>(),
  /** fator 0..1 animado por circuito */
  level: new Map<string, number>(),
};

export const physics = {
  colliders: [] as THREE.Mesh[],
  dynamic: [] as THREE.Mesh[],
  ready: false,
};

export const cameraState = {
  /** posição do jogador no modo caminhar (pés) */
  feet: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,
  transitioning: false,
};
