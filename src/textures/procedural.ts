/*
 * Gera texturas de porcelanato em escala real no navegador.
 * Cada textura cobre 2×2 peças (com variação entre elas) e inclui as juntas.
 * O mapa normal é derivado das juntas (rebaixo) e da textura superficial.
 */
import * as THREE from 'three';
import type { Finish } from '../config/finishes';

function hash(x: number, y: number, s: number) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function smooth(t: number) {
  return t * t * (3 - 2 * t);
}
/** ruído de valor periódico (período p) para textura sem emendas */
function noise(x: number, y: number, p: number, s: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = smooth(x - xi), yf = smooth(y - yi);
  const m = (v: number) => ((v % p) + p) % p;
  const a = hash(m(xi), m(yi), s), b = hash(m(xi + 1), m(yi), s);
  const c = hash(m(xi), m(yi + 1), s), d = hash(m(xi + 1), m(yi + 1), s);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}
function fbm(x: number, y: number, p: number, s: number, oct = 5) {
  let v = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    v += amp * noise(x * f, y * f, p * f, s + i * 17);
    amp *= 0.5;
    f *= 2;
  }
  return v;
}
function hex(c: string): [number, number, number] {
  const v = parseInt(c.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function mix(a: number[], b: number[], t: number) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

const cache = new Map<string, { map: THREE.Texture; normal: THREE.Texture; repeat: THREE.Vector2 }>();

export function finishTextures(f: Finish, size = 1024) {
  const key = `${f.id}@${size}`;
  if (cache.has(key)) return cache.get(key)!;
  // textura cobre 2 peças em cada direção; mantém pixels quadrados aproximados
  const aspect = f.tile[1] / f.tile[0];
  const W = size, H = Math.max(64, Math.min(size * 2, Math.round(size * aspect)));
  const col = new Uint8ClampedArray(W * H * 4);
  const height = new Float32Array(W * H);
  const base = hex(f.base), vein = hex(f.vein ?? f.base), grout = hex(f.grout);
  const groutPx = Math.max(1, Math.round((f.groutMm / 1000 / (f.tile[0] * 2)) * W));
  const seed = [...f.id].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const tileW = W / 2, tileH = H / 2;

  for (let y = 0; y < H; y++) {
    const row = Math.floor(y / tileH);
    const offset = f.layout === 'amarracao' && row % 2 === 1 ? tileW / 2 : 0;
    for (let x = 0; x < W; x++) {
      const xs = (x + offset) % W;
      const tx = Math.floor(xs / tileW), ty = row;
      const lx = xs - tx * tileW, ly = y - ty * tileH;
      const tileSeed = seed + tx * 31 + ty * 57;
      const u = x / W, v = y / H;
      let c: number[] = base;
      let h = 0.5;
      const tv = hash(tx, ty, seed) - 0.5; // variação de tonalidade entre peças
      switch (f.pattern) {
        case 'marmore': {
          const n = fbm(u * 4, v * 4 * (H / W), 4, seed, 6);
          const veinV = Math.abs(Math.sin((u * 3 + v * 5 * (H / W) + n * 6 + tv) * Math.PI));
          const t = Math.pow(1 - veinV, 9) * 0.9 + Math.pow(1 - veinV, 40) * 0.6;
          c = mix(base, vein, Math.min(1, t));
          c = mix(c, [255, 255, 255], (fbm(u * 16, v * 16 * (H / W), 16, seed + 5, 3) - 0.5) * 0.08);
          h = 0.5 + t * 0.05;
          break;
        }
        case 'cimento': {
          const n = fbm(u * 6, v * 6 * (H / W), 6, tileSeed, 6);
          const fine = fbm(u * 64, v * 64 * (H / W), 64, seed, 2);
          c = mix(base, n > 0.5 ? [255, 255, 255] : [0, 0, 0], Math.abs(n - 0.5) * 0.35 + (fine - 0.5) * 0.08);
          h = 0.5 + (fine - 0.5) * 0.2;
          break;
        }
        case 'madeira': {
          const n = fbm(u * 3, v * 0.6, 3, tileSeed, 4);
          const grain = Math.sin((u * 2 * 60 + n * 18 + tv * 10) * Math.PI) * 0.5 + 0.5;
          const fine = fbm(u * 120, v * 8, 120, tileSeed, 2);
          c = mix(base, vein, grain * 0.45 + fine * 0.25);
          c = mix(c, [0, 0, 0], tv * 0.25);
          h = 0.5 + (grain - 0.5) * 0.15;
          break;
        }
        case 'pedra': {
          const n = fbm(u * 8, v * 8 * (H / W), 8, tileSeed, 6);
          const spots = fbm(u * 30, v * 30 * (H / W), 30, seed + 9, 3);
          c = mix(base, vein, n * 0.9 + (spots > 0.62 ? 0.3 : 0));
          c = mix(c, [0, 0, 0], tv * 0.3);
          h = 0.35 + n * 0.4;
          break;
        }
        case 'travertino': {
          const n = fbm(u * 2, v * 10 * (H / W), 2, tileSeed, 5);
          const bands = Math.sin((v * 30 * (H / W) + n * 8) * Math.PI) * 0.5 + 0.5;
          const holes = fbm(u * 40, v * 40 * (H / W), 40, seed + 3, 2) > 0.7 ? 0.35 : 0;
          c = mix(base, vein, bands * 0.5 + holes);
          h = 0.5 - holes * 0.3;
          break;
        }
        case 'terrazzo': {
          const n = fbm(u * 50, v * 50 * (H / W), 50, seed, 2);
          const chips = n > 0.62 ? 1 : 0;
          c = mix(base, chips ? vein : base, chips * (0.5 + hash(x >> 3, y >> 3, seed) * 0.5));
          break;
        }
        case 'zellige': {
          const n = fbm(lx / tileW * 2, ly / tileH * 2, 1e9, tileSeed, 4);
          c = mix(base, n > 0.5 ? [255, 255, 255] : [0, 0, 0], Math.abs(n - 0.5) * 0.5 + tv * 0.4);
          h = 0.5 + (n - 0.5) * 0.6;
          break;
        }
        default: {
          const fine = fbm(u * 40, v * 40 * (H / W), 40, seed, 3);
          c = mix(base, fine > 0.5 ? [255, 255, 255] : [0, 0, 0], Math.abs(fine - 0.5) * 0.06 + tv * 0.04);
        }
      }
      // juntas
      const gx = Math.min(lx, tileW - lx), gy = Math.min(ly, tileH - ly);
      const g = Math.min(gx, gy);
      if (g < groutPx) {
        c = grout;
        h = 0;
      } else if (g < groutPx + 1.5) {
        h *= 0.7; // borda bisotada
      }
      const i = (y * W + x) * 4;
      col[i] = c[0]; col[i + 1] = c[1]; col[i + 2] = c[2]; col[i + 3] = 255;
      height[y * W + x] = h;
    }
  }

  const nrm = new Uint8ClampedArray(W * H * 4);
  const strength = 3;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const hl = height[y * W + ((x - 1 + W) % W)], hr = height[y * W + ((x + 1) % W)];
      const hu = height[((y - 1 + H) % H) * W + x], hd = height[((y + 1) % H) * W + x];
      const nx = (hl - hr) * strength, ny = (hu - hd) * strength, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const i = (y * W + x) * 4;
      nrm[i] = (nx / l * 0.5 + 0.5) * 255;
      nrm[i + 1] = (ny / l * 0.5 + 0.5) * 255;
      nrm[i + 2] = (nz / l * 0.5 + 0.5) * 255;
      nrm[i + 3] = 255;
    }

  const make = (data: Uint8ClampedArray, srgb: boolean) => {
    const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.anisotropy = 8;
    t.channel = 1;
    t.flipY = false;
    t.needsUpdate = true;
    return t;
  };
  const out = {
    map: make(col, true),
    normal: make(nrm, false),
    repeat: new THREE.Vector2(1 / (f.tile[0] * 2), 1 / (f.tile[1] * 2)),
  };
  out.map.repeat.copy(out.repeat);
  out.normal.repeat.copy(out.repeat);
  cache.set(key, out);
  return out;
}

/** Miniatura (data URL) para os cartões da biblioteca. */
const thumbs = new Map<string, string>();
export function finishThumb(f: Finish): string {
  if (thumbs.has(f.id)) return thumbs.get(f.id)!;
  const t = finishTextures(f, 256).map;
  const img = t.image as { data: Uint8ClampedArray; width: number; height: number };
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  const url = canvas.toDataURL('image/jpeg', 0.85);
  thumbs.set(f.id, url);
  return url;
}
