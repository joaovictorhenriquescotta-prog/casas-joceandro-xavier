// Câmera de "drone" sobre a planta humanizada (uma imagem plana em CSS 3D).
// x, y: ponto da planta (px da planta 8192) no centro da tela · z: px de tela por px da planta
// tilt: inclinação da câmera em graus (0 = olhando reto para baixo) · rot: giro em graus.

export interface Cam { x: number; y: number; z: number; tilt: number; rot: number }
export type Box = [number, number, number, number];

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function perspectiveFor(vw: number, vh: number) {
  return Math.round(Math.max(vw, vh) * 1.15);
}

/** Enquadra uma caixa da planta na tela (pad = folga), considerando giro de 90° e a inclinação. */
export function fitBox(box: Box, vw: number, vh: number, opts: { pad?: number; rot?: number; tilt?: number } = {}): Cam {
  const pad = opts.pad ?? 1.15, rot = opts.rot ?? 0, tilt = opts.tilt ?? 0;
  const bw = box[2] - box[0], bh = box[3] - box[1];
  const turned = Math.abs(Math.round(rot / 90)) % 2 === 1;
  const w = turned ? bh : bw, h = (turned ? bw : bh) * Math.cos((tilt * Math.PI) / 180);
  const z = Math.min(vw / (w * pad), vh / (h * pad));
  return { x: (box[0] + box[2]) / 2, y: (box[1] + box[3]) / 2, z, tilt, rot };
}

/**
 * Limita a inclinação para a parte da planta mais próxima da câmera nunca passar "atrás" dela
 * (evita falhas de desenho no Safari com CSS 3D).
 */
function safeTilt(c: Cam, size: { w: number; h: number }, persp: number) {
  if (c.tilt <= 0) return c.tilt;
  const r = (c.rot * Math.PI) / 180, sin = Math.sin(r), cos = Math.cos(r);
  let near = 0;
  for (const [px, py] of [[0, 0], [size.w, 0], [0, size.h], [size.w, size.h]]) {
    const dy = ((px - c.x) * sin + (py - c.y) * cos) * c.z; // distância na direção "para baixo" da tela
    near = Math.max(near, dy);
  }
  if (near <= 0) return c.tilt;
  const max = (Math.asin(Math.min(1, (0.8 * persp) / near)) * 180) / Math.PI;
  return Math.min(c.tilt, max);
}

/**
 * Mantém a câmera dentro da imagem: com a câmera inclinada, a borda de cima da tela enxerga mais longe.
 * Para cômodos na borda da planta (banho no topo, garagem embaixo), desloca o centro para não aparecer o vazio.
 * Funciona com a vista normal (giro perto de 0°) e com a vista girada do celular em pé (perto de 90°).
 */
export function clampCam(c: Cam, vw: number, vh: number, persp: number, size: { w: number; h: number }): Cam {
  const turned = Math.abs(c.rot - 90) < 30;
  if (!turned && Math.abs(c.rot) > 30) return c;
  const t = (Math.max(0, c.tilt) * Math.PI) / 180;
  // folga para os cantos quando a câmera está girada/inclinada
  const m = Math.abs(Math.sin(((c.rot - (turned ? 90 : 0)) * Math.PI) / 180)) * Math.max(vw, vh) * 0.5 + (c.tilt > 0.5 ? 16 : 0);
  const hh = vh / 2 + m, hw = vw / 2 + m;
  const den = persp * Math.cos(t) - hh * Math.sin(t);
  if (den <= 0) return c; // horizonte visível: não acontece com as inclinações usadas
  const far = (hh * persp) / den; // distância (px de tela, no plano) até a borda de cima
  const near = (hh * persp) / (persp * Math.cos(t) + hh * Math.sin(t));
  // eixo da imagem que corre na vertical da tela (y na vista normal; x na girada, com o "alto" da tela em x menor)
  const vSize = turned ? size.w : size.h, hSize = turned ? size.h : size.w;
  let z = c.z;
  // se não cabe com folga, afasta um pouco a câmera
  if ((far + near) / z > vSize) z = (far + near) / vSize;
  const halfW = (hw * (1 + Math.sin(t) * 0.6)) / z;
  if (2 * halfW > hSize) z *= (2 * halfW) / hSize;
  const top = far / z, bottom = near / z, side = (hw * (1 + Math.sin(t) * 0.6)) / z;
  const fit = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.min(Math.max(v, lo), hi));
  if (turned) {
    // giro de 90°: o alto da tela aponta para x menor e a direita da tela para y menor
    return { ...c, z, x: fit(c.x, top, size.w - bottom), y: fit(c.y, side, size.h - side) };
  }
  return { ...c, z, y: fit(c.y, top, size.h - bottom), x: fit(c.x, side, size.w - side) };
}

/** Transform CSS da camada da planta. k = px da imagem carregada por px da planta 8192. */
export function camTransform(c: Cam, vw: number, vh: number, k: number, size: { w: number; h: number }, persp: number) {
  const tilt = safeTilt(c, size, persp);
  const s = c.z / k;
  return `translate3d(${(vw / 2).toFixed(2)}px,${(vh / 2).toFixed(2)}px,0) rotateX(${tilt.toFixed(3)}deg) rotateZ(${c.rot.toFixed(3)}deg) scale(${s.toFixed(5)}) translate3d(${(-c.x * k).toFixed(2)}px,${(-c.y * k).toFixed(2)}px,0)`;
}

/** Posição na tela de um ponto da planta, com inclinação e perspectiva (igual ao CSS 3D usado). */
export function projectCam(c: Cam, px: number, py: number, vw: number, vh: number, persp: number): [number, number] {
  const r = (c.rot * Math.PI) / 180, t = (c.tilt * Math.PI) / 180;
  const dx = (px - c.x) * c.z, dy = (py - c.y) * c.z;
  const x = dx * Math.cos(r) - dy * Math.sin(r), y = dx * Math.sin(r) + dy * Math.cos(r);
  const k = persp / (persp - y * Math.sin(t));
  return [vw / 2 + x * k, vh / 2 + y * Math.cos(t) * k];
}

/** Posição na tela de um ponto da planta (válido com a câmera sem inclinação). */
export function project(c: Cam, px: number, py: number, vw: number, vh: number): [number, number] {
  const r = (c.rot * Math.PI) / 180, dx = (px - c.x) * c.z, dy = (py - c.y) * c.z;
  return [vw / 2 + dx * Math.cos(r) - dy * Math.sin(r), vh / 2 + dx * Math.sin(r) + dy * Math.cos(r)];
}

export interface Flight { done: Promise<void>; cancel: () => void }

/**
 * Voo de câmera: interpola posição, zoom (em escala logarítmica, como um drone subindo/descendo),
 * inclinação e giro, com aceleração e frenagem suaves. arc > 0 sobe no meio do trajeto.
 */
export function fly(
  from: Cam, to: Cam, ms: number, apply: (c: Cam) => void,
  opts: { arc?: number; tiltPeak?: number; ease?: (t: number) => number } = {},
): Flight {
  const ease = opts.ease ?? easeInOut, arc = opts.arc ?? 0;
  let raf = 0, cancelled = false, resolve!: () => void;
  const done = new Promise<void>((r) => (resolve = r));
  const lz0 = Math.log(from.z), lz1 = Math.log(to.z);
  // menor giro entre os dois ângulos
  let dr = to.rot - from.rot;
  if (dr > 180) dr -= 360;
  if (dr < -180) dr += 360;
  const t0 = performance.now();
  const step = (now: number) => {
    if (cancelled) return;
    const t = Math.min(1, (now - t0) / Math.max(1, ms));
    const e = ease(t), bump = Math.sin(Math.PI * t);
    const z = Math.exp(lerp(lz0, lz1, e)) * (1 - arc * bump);
    let tilt = lerp(from.tilt, to.tilt, e);
    if (opts.tiltPeak !== undefined) tilt += (opts.tiltPeak - Math.max(from.tilt, to.tilt)) * bump * 0.5;
    apply({ x: lerp(from.x, to.x, e), y: lerp(from.y, to.y, e), z, tilt, rot: from.rot + dr * e });
    if (t < 1) raf = requestAnimationFrame(step);
    else resolve();
  };
  raf = requestAnimationFrame(step);
  return { done, cancel: () => { cancelled = true; cancelAnimationFrame(raf); resolve(); } };
}

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
