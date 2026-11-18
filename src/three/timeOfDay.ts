import * as THREE from 'three';
import type { TimeOfDay } from '../store';

/** Parâmetros de iluminação de cada período. Interpolados continuamente. */
export interface TimeParams {
  sunAzimuth: number; // graus, 0 = frente (+Z), positivo = leste (+X)
  sunElevation: number; // graus
  sunColor: THREE.Color;
  sunIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  /** cores do ambiente que ilumina por reflexo (céu, horizonte, chão) */
  envTop: THREE.Color;
  envHorizon: THREE.Color;
  envGround: THREE.Color;
  envIntensity: number;
  exposure: number;
  turbidity: number;
  rayleigh: number;
  stars: number;
  night: number; // 0..1, usado para luzes artificiais e emissivos
}

const c = (h: string) => new THREE.Color(h);

export const TIME_KEYS: TimeOfDay[] = ['manha', 'tarde', 'noite'];

export const PRESETS: Record<TimeOfDay, TimeParams> = {
  manha: {
    sunAzimuth: 55, sunElevation: 36, sunColor: c('#fff0dc'), sunIntensity: 3.4,
    hemiSky: c('#e4ecf5'), hemiGround: c('#8c8272'), hemiIntensity: 0.45,
    envTop: c('#9fb8d6'), envHorizon: c('#eef0ee'), envGround: c('#a69f92'),
    envIntensity: 0.6, exposure: 1.0, turbidity: 5, rayleigh: 1.1, stars: 0, night: 0,
  },
  tarde: {
    sunAzimuth: -48, sunElevation: 13, sunColor: c('#ffb06a'), sunIntensity: 2.8,
    hemiSky: c('#ffd7ad'), hemiGround: c('#6e5c4b'), hemiIntensity: 0.35,
    envTop: c('#8fa3c2'), envHorizon: c('#f2d4b0'), envGround: c('#9c8f7f'),
    envIntensity: 0.5, exposure: 1.05, turbidity: 9, rayleigh: 2.6, stars: 0, night: 0.15,
  },
  noite: {
    sunAzimuth: -70, sunElevation: -14, sunColor: c('#9fb4ff'), sunIntensity: 0.0,
    hemiSky: c('#3a4366'), hemiGround: c('#17161a'), hemiIntensity: 0.3,
    envTop: c('#18203a'), envHorizon: c('#3a3a4a'), envGround: c('#1c1b1e'),
    envIntensity: 0.35, exposure: 1.55, turbidity: 2, rayleigh: 0.6, stars: 1, night: 1,
  },
};

const tmp: TimeParams = structuredClone({
  ...PRESETS.manha,
  sunColor: undefined, hemiSky: undefined, hemiGround: undefined, envTop: undefined, envHorizon: undefined, envGround: undefined,
}) as unknown as TimeParams;
tmp.sunColor = new THREE.Color();
tmp.hemiSky = new THREE.Color();
tmp.hemiGround = new THREE.Color();
tmp.envTop = new THREE.Color();
tmp.envHorizon = new THREE.Color();
tmp.envGround = new THREE.Color();

/** t contínuo: 0 = manhã, 1 = tarde, 2 = noite */
export function paramsAt(t: number): TimeParams {
  const i = Math.min(1, Math.floor(t));
  const f = THREE.MathUtils.clamp(t - i, 0, 1);
  const a = PRESETS[TIME_KEYS[i]], b = PRESETS[TIME_KEYS[i + 1]];
  const k = f * f * (3 - 2 * f);
  for (const key of Object.keys(a) as (keyof TimeParams)[]) {
    const va = a[key], vb = b[key];
    if (va instanceof THREE.Color) (tmp[key] as THREE.Color).copy(va).lerp(vb as THREE.Color, k);
    else (tmp as unknown as Record<string, number>)[key] = THREE.MathUtils.lerp(va as number, vb as number, k);
  }
  return tmp;
}

export function sunDirection(p: TimeParams, out = new THREE.Vector3()) {
  const az = THREE.MathUtils.degToRad(p.sunAzimuth);
  const el = THREE.MathUtils.degToRad(p.sunElevation);
  return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
}
