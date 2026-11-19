import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useStore } from '../store';
import type { LoadedModel } from './useModel';
import { lighting, timeState } from './runtime';

/*
 * Paisagismo e luminárias externas (autorizados pela cliente: aparecem nas imagens de
 * referência, mas não no modelo). Nada aqui altera a arquitetura: as plantas e luminárias
 * são posicionadas lendo o próprio modelo (gramado e faces internas dos muros).
 */

const CIRCUIT = 'externa';
const WARM = new THREE.Color('#ffc884');
const rand = mulberry(7);

function mulberry(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- texturas geradas no navegador ----------------------------------------------

function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void, srgb = true) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Folhagem miúda (cerca viva tipo podocarpo/clúsia) com transparência. */
const leafTexture = () =>
  canvasTexture(256, (g, s) => {
    const r = mulberry(3);
    for (let i = 0; i < 420; i++) {
      const x = s * (0.08 + r() * 0.84), y = s * (0.05 + r() * 0.9);
      const l = 7 + r() * 9, w = l * 0.38, a = r() * Math.PI * 2;
      const k = 0.55 + r() * 0.45;
      g.fillStyle = `rgb(${Math.round(52 * k + 10)},${Math.round(96 * k + 18)},${Math.round(38 * k + 6)})`;
      g.beginPath();
      g.ellipse(x, y, l, w, a, 0, Math.PI * 2);
      g.fill();
    }
  });

/** Folha de palmeira (pinada) vista de cima: nervura central e folíolos. */
const frondTexture = () =>
  canvasTexture(256, (g, s) => {
    const r = mulberry(11);
    g.strokeStyle = '#5b6a2c';
    g.lineWidth = 4;
    g.beginPath(); g.moveTo(s / 2, 0); g.lineTo(s / 2, s); g.stroke();
    for (let y = 6; y < s; y += 5) {
      const t = y / s;
      const len = s * 0.48 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05));
      for (const side of [-1, 1]) {
        const k = 0.7 + r() * 0.3;
        g.strokeStyle = `rgb(${Math.round(70 * k)},${Math.round(118 * k)},${Math.round(40 * k)})`;
        g.lineWidth = 3.2;
        g.beginPath();
        g.moveTo(s / 2, y);
        g.quadraticCurveTo(s / 2 + side * len * 0.5, y - 10, s / 2 + side * len, y - 26 * (0.6 + r() * 0.5));
        g.stroke();
      }
    }
  });

/** Leque de luz na parede (arandela de facho duplo ou balizador). */
const washTexture = (double: boolean) =>
  canvasTexture(128, (g, s) => {
    const img = g.createImageData(s, s);
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        const u = (x / (s - 1)) * 2 - 1;
        let v = y / (s - 1); // 0 = topo
        let d: number;
        if (double) {
          const vv = Math.abs(v - 0.5) * 2; // 0 no centro
          const spread = 0.12 + vv * 0.75;
          d = Math.max(0, 1 - Math.abs(u) / spread) * Math.pow(1 - vv, 1.6) * Math.min(1, vv * 6);
        } else {
          v = 1 - v; // 0 = base
          const spread = 0.18 + v * 0.8;
          d = Math.max(0, 1 - Math.abs(u) / spread) * Math.pow(1 - v, 1.8) * Math.min(1, v * 10 + 0.2);
        }
        const i = (y * s + x) * 4;
        img.data[i] = 255; img.data[i + 1] = 214; img.data[i + 2] = 150;
        img.data[i + 3] = Math.round(255 * Math.min(1, d * d * 1.4));
      }
    g.putImageData(img, 0, 0);
  });

// ---------- geometrias ----------------------------------------------------------------

function shrubGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  // núcleo escuro para não ver através da planta
  const core = new THREE.IcosahedronGeometry(0.28, 2);
  const pos = core.attributes.position as THREE.BufferAttribute;
  const r = mulberry(5);
  for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) * (0.9 + r() * 0.2), pos.getY(i) * 2.9 + 0.95, pos.getZ(i) * (0.9 + r() * 0.2));
  core.deleteAttribute('uv');
  core.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.count * 2).fill(0.5), 2));
  parts.push(core.toNonIndexed());
  // lâminas de folhagem
  for (let i = 0; i < 14; i++) {
    const q = new THREE.PlaneGeometry(0.62, 0.62);
    q.rotateY(r() * Math.PI);
    q.rotateX((r() - 0.5) * 0.7);
    const h = 0.25 + (i / 14) * 1.55;
    const rad = 0.16 * Math.sin(Math.PI * (h / 1.9)) + 0.05;
    const a = r() * Math.PI * 2;
    q.translate(Math.cos(a) * rad, h, Math.sin(a) * rad);
    parts.push(q.toNonIndexed());
  }
  const g = mergeGeometries(parts.map((p) => { p.deleteAttribute('normal'); return p; }))!;
  g.computeVertexNormals();
  // normais "esféricas": iluminação macia como copa, sem facetas
  const n = g.attributes.normal as THREE.BufferAttribute, p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < n.count; i++) {
    v.set(p.getX(i), (p.getY(i) - 0.95) * 0.5, p.getZ(i)).normalize();
    n.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}

function palmGeometries() {
  const r = mulberry(21);
  const h = 4.6;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.1, h * 0.35, 0.05), new THREE.Vector3(0.28, h * 0.7, 0.1), new THREE.Vector3(0.42, h, 0.12),
  ]);
  const trunk = new THREE.TubeGeometry(curve, 24, 0.13, 10, false);
  const tp = trunk.attributes.position as THREE.BufferAttribute;
  const colors: number[] = [];
  for (let i = 0; i < tp.count; i++) {
    const ring = 0.82 + 0.18 * Math.abs(Math.sin(tp.getY(i) * 14));
    colors.push(0.42 * ring, 0.37 * ring, 0.3 * ring);
  }
  trunk.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const top = curve.getPoint(1);
  const fronds: THREE.BufferGeometry[] = [];
  const N = 13;
  for (let f = 0; f < N; f++) {
    const len = 2.1 + r() * 0.6, segs = 10, width = 0.95;
    const yaw = (f / N) * Math.PI * 2 + r() * 0.3;
    const lift = 0.55 - (f % 3) * 0.35 + r() * 0.2;
    const pts: number[] = [], uvs: number[] = [], idx: number[] = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const x = t * len;
      const y = Math.sin(lift) * x - 0.55 * x * x / len;
      const w = width * Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.04)) * 0.5;
      const tilt = 0.35; // folíolos em "V"
      pts.push(x, y + w * tilt, -w, x, y + w * tilt, w);
      uvs.push(0, t, 1, t);
      if (i < segs) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.rotateY(yaw);
    g.translate(top.x, top.y, top.z);
    fronds.push(g);
  }
  const crown = mergeGeometries(fronds)!;
  crown.computeVertexNormals();
  return { trunk, crown };
}

function grassClumpGeometry() {
  const r = mulberry(9);
  const pts: number[] = [], cols: number[] = [];
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2, lean = 0.15 + r() * 0.45, h = 0.45 + r() * 0.55;
    const bx = Math.cos(a) * 0.06, bz = Math.sin(a) * 0.06;
    const tx = bx + Math.cos(a) * lean * h, tz = bz + Math.sin(a) * lean * h;
    const px = -Math.sin(a) * 0.018, pz = Math.cos(a) * 0.018;
    pts.push(bx - px, 0, bz - pz, bx + px, 0, bz + pz, tx, h, tz);
    const k = 0.75 + r() * 0.35;
    cols.push(0.2 * k, 0.32 * k, 0.12 * k, 0.2 * k, 0.32 * k, 0.12 * k, 0.55 * k, 0.6 * k, 0.32 * k);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.computeVertexNormals();
  return g;
}

// ---------- leitura do modelo ---------------------------------------------------------

interface WallHit { point: THREE.Vector3; normal: THREE.Vector3; dist: number }

function meshesBy(model: LoadedModel, re: RegExp) {
  const out: THREE.Mesh[] = [];
  model.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (re.test(mat.userData?.originalName ?? mat.name ?? '')) out.push(m);
  });
  return out;
}

function analyse(model: LoadedModel) {
  model.scene.updateMatrixWorld(true);
  const grass = meshesBy(model, /Grass/i);
  const walls = meshesBy(model, /^Muro - neutro$|^MURO/i);
  const facade = meshesBy(model, /^TINTA 01$|^\.?TINTA|^PAREDE$/);
  const solids = [...walls, ...facade];
  const rc = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const box = new THREE.Box3();
  for (const g of grass) box.expandByObject(g);
  const pts: THREE.Vector3[] = [];
  if (!box.isEmpty()) {
    const step = 0.4;
    for (let x = box.min.x + step / 2; x < box.max.x; x += step)
      for (let z = box.min.z + step / 2; z < box.max.z; z += step) {
        rc.set(new THREE.Vector3(x, box.max.y + 4, z), down);
        rc.far = box.max.y - box.min.y + 8;
        const h = rc.intersectObjects(grass, false)[0];
        if (h && (!h.face || h.face.normal.clone().transformDirection(h.object.matrixWorld).y > 0.7)) pts.push(h.point);
      }
  }
  const hb = model.meta.houseBounds;
  const center = new THREE.Vector3((hb.min[0] + hb.max[0]) / 2, 0, (hb.min[2] + hb.max[2]) / 2);
  const dirs = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)];
  const cast = (p: THREE.Vector3, d: THREE.Vector3, targets: THREE.Mesh[], far: number): WallHit | null => {
    rc.set(new THREE.Vector3(p.x, p.y + 0.6, p.z), d);
    rc.far = far;
    const h = rc.intersectObjects(targets, false)[0];
    if (!h || !h.face) return null;
    const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
    n.y = 0;
    if (n.lengthSq() < 0.5) return null;
    n.normalize();
    if (n.dot(d) > 0) n.negate();
    return { point: h.point, normal: n, dist: h.distance };
  };
  const along: { p: THREE.Vector3; w: WallHit; facade: boolean }[] = [];
  const open: { p: THREE.Vector3; clear: number }[] = [];
  for (const p of pts) {
    // ponto dentro do lote: cercado por muro/casa e sem muro entre ele e as casas
    const hits = dirs.map((d) => cast(p, d, solids, 30));
    if (hits.filter(Boolean).length < 3) continue;
    const toC = center.clone().setY(p.y).sub(p);
    const dc = toC.length();
    if (dc > 0.5 && cast(p, toC.normalize(), walls, dc)) continue;
    const nearest = hits.reduce<WallHit | null>((a, h) => (h && (!a || h.dist < a.dist) ? h : a), null)!;
    const isWall = walls.length > 0 && dirs.some((d, i) => hits[i] && hits[i]!.dist === nearest.dist && cast(p, d, walls, nearest.dist + 0.01));
    if (nearest.dist < 0.5) along.push({ p, w: nearest, facade: !isWall });
    else open.push({ p, clear: nearest.dist });
  }
  return { along, open };
}

/** Mantém pontos com espaçamento mínimo (amostragem de Poisson simples). */
function spaced<T extends { p: THREE.Vector3 }>(arr: T[], gap: number) {
  const out: T[] = [];
  for (const a of arr) if (out.every((b) => b.p.distanceToSquared(a.p) > gap * gap)) out.push(a);
  return out;
}

// ---------- componente ----------------------------------------------------------------

export function Landscape({ model }: { model: LoadedModel }) {
  const built = useMemo(() => {
    const group = new THREE.Group();
    group.name = 'paisagismo';
    // sem vegetação na visita 3D (decisão de 19/11/2026): o paisagismo gerado ficou só com chão e luminárias
    const { along, open } = { along: [] as ReturnType<typeof analyse>['along'], open: [] as ReturnType<typeof analyse>['open'] };
    const sceneBox = new THREE.Box3().setFromObject(model.scene);

    // chão ao redor do terreno, para o lote não flutuar no vazio
    const groundTex = canvasTexture(256, (g, s) => {
      const r = mulberry(17);
      g.fillStyle = '#66734a';
      g.fillRect(0, 0, s, s);
      for (let i = 0; i < 2600; i++) {
        const k = r();
        g.fillStyle = k < 0.5 ? 'rgba(90,96,60,0.35)' : k < 0.8 ? 'rgba(128,124,92,0.3)' : 'rgba(70,74,46,0.4)';
        g.fillRect(r() * s, r() * s, 2 + r() * 5, 2 + r() * 5);
      }
    });
    groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(220, 220);
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(900, 48).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1, color: '#ffffff' }),
    );
    ground.position.set((sceneBox.min.x + sceneBox.max.x) / 2, sceneBox.min.y - 0.03, (sceneBox.min.z + sceneBox.max.z) / 2);
    ground.receiveShadow = true;
    ground.name = 'chao-entorno';
    group.add(ground);

    // cerca viva ao longo dos muros internos
    // arbustos a menos de 0,7 m de um cômodo atravessariam a parede (ex.: faixa estreita atrás do banho da suíte)
    const nearRoom = (p: THREE.Vector3) =>
      model.meta.rooms.some((r) => r.type !== 'garagem' && p.x > r.min[0] - 0.7 && p.x < r.max[0] + 0.7 && p.z > r.min[2] - 0.7 && p.z < r.max[2] + 0.7);
    const hedge = spaced(
      along.filter((a) => !a.facade && !nearRoom(a.p.clone().addScaledVector(a.w.normal, -(a.w.dist - 0.32)))),
      0.55,
    );
    const leaf = leafTexture();
    const shrubMat = new THREE.MeshStandardMaterial({ map: leaf, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, color: '#ffffff' });
    const shrubGeo = shrubGeometry();
    const shrubs = new THREE.InstancedMesh(shrubGeo, shrubMat, Math.max(1, hedge.length));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
    const tint = new THREE.Color();
    hedge.forEach((a, i) => {
      pos.copy(a.p).addScaledVector(a.w.normal, -(a.w.dist - 0.32));
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2);
      const s = 0.85 + rand() * 0.35;
      sc.set(s, s * (0.9 + rand() * 0.25), s);
      shrubs.setMatrixAt(i, m4.compose(pos, q, sc));
      shrubs.setColorAt(i, tint.setHSL(0.2 + rand() * 0.06, 0.3, 0.66 + rand() * 0.12));
    });
    shrubs.count = hedge.length;
    shrubs.castShadow = true;
    shrubs.receiveShadow = true;
    group.add(shrubs);

    // capim ornamental junto à fachada
    const clumpsAt = spaced(along.filter((a) => a.facade), 0.9);
    const clumps = new THREE.InstancedMesh(grassClumpGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 }), Math.max(1, clumpsAt.length));
    clumpsAt.forEach((a, i) => {
      pos.copy(a.p).addScaledVector(a.w.normal, -(a.w.dist - 0.35));
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2);
      const s = 1 + rand() * 0.5;
      clumps.setMatrixAt(i, m4.compose(pos, q, sc.set(s, s, s)));
    });
    clumps.count = clumpsAt.length;
    clumps.castShadow = true;
    group.add(clumps);

    // palmeiras: uma por jardim frontal, no ponto mais livre perto da frente
    const { trunk, crown } = palmGeometries();
    const trunkMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
    const crownMat = new THREE.MeshStandardMaterial({ map: frondTexture(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.75 });
    const midX = (model.meta.houseBounds.min[0] + model.meta.houseBounds.max[0]) / 2;
    const palms: THREE.Vector3[] = [];
    for (const side of [-1, 1]) {
      const cand = open.filter((o) => Math.sign(o.p.x - midX) === side && o.clear > 0.9 && o.clear < 2.6);
      const best = cand.sort((a, b) => b.p.z - a.p.z)[0];
      if (best) palms.push(best.p.clone());
    }
    for (const p of palms) {
      const g = new THREE.Group();
      const t = new THREE.Mesh(trunk, trunkMat);
      const c = new THREE.Mesh(crown, crownMat);
      t.castShadow = c.castShadow = true;
      g.add(t, c);
      g.position.copy(p);
      g.rotation.y = rand() * Math.PI * 2;
      g.scale.setScalar(0.95 + rand() * 0.15);
      group.add(g);
    }

    // luminárias: balizadores (embutidos no gramado) e arandelas de facho duplo nos muros
    const fixtureMat = new THREE.MeshStandardMaterial({ color: '#2a2a2a', metalness: 0.6, roughness: 0.4 });
    const glowMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', emissive: WARM, emissiveIntensity: 0 });
    const washUp = new THREE.MeshBasicMaterial({ map: washTexture(false), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const washDouble = washUp.clone();
    washDouble.map = washTexture(true);
    const sources: { position: THREE.Vector3; intensity: number; distance: number }[] = [];
    const addWash = (mat: THREE.Material, at: THREE.Vector3, n: THREE.Vector3, w: number, h: number) => {
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      quad.position.copy(at).addScaledVector(n, 0.012);
      quad.lookAt(quad.position.clone().add(n));
      quad.renderOrder = 3;
      group.add(quad);
    };
    // balizador a cada três plantas da cerca e em cada touceira junto à fachada
    const ups = [...hedge.filter((_, i) => i % 3 === 1), ...clumpsAt];
    for (const a of ups) {
      const base = a.p.clone().addScaledVector(a.w.normal, -(a.w.dist - 0.18));
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 12), fixtureMat);
      cyl.position.copy(base).setY(base.y + 0.03);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.035, 12).rotateX(-Math.PI / 2), glowMat);
      lens.position.copy(base).setY(base.y + 0.062);
      group.add(cyl, lens);
      const wallPt = a.w.point.clone().setY(a.p.y + 1.25);
      addWash(washUp, wallPt, a.w.normal, 1.5, 2.5);
      sources.push({ position: base.clone().addScaledVector(a.w.normal, 0.25).setY(base.y + 0.5), intensity: 2.5, distance: 3.2 });
    }
    // arandelas: a cada ~2,8 m ao longo dos muros
    const sconces = spaced(along.filter((a) => !a.facade), 2.8);
    for (const a of sconces) {
      const wallPt = a.w.point.clone().setY(a.p.y + 1.85);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.2, 0.09), fixtureMat);
      body.position.copy(wallPt).addScaledVector(a.w.normal, 0.045);
      body.lookAt(body.position.clone().add(a.w.normal));
      const glow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.205, 0.06), glowMat);
      glow.position.copy(body.position);
      glow.quaternion.copy(body.quaternion);
      group.add(body, glow);
      addWash(washDouble, wallPt, a.w.normal, 0.9, 1.9);
      sources.push({ position: wallPt.clone().addScaledVector(a.w.normal, 0.3), intensity: 3, distance: 3.5 });
    }
    group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o !== ground && !(o as THREE.InstancedMesh).isInstancedMesh) o.castShadow = false;
    });
    return { group, glowMat, washes: [washUp, washDouble], sources, stats: { hedge: hedge.length, clumps: clumpsAt.length, palms: palms.length, ups: ups.length, sconces: sconces.length } };
  }, [model]);

  useEffect(() => {
    lighting.sources = lighting.sources.filter((s) => s.circuit !== CIRCUIT);
    built.sources.forEach((s, i) =>
      lighting.sources.push({ id: `${CIRCUIT}-${i}`, circuit: CIRCUIT, position: s.position, color: WARM, intensity: s.intensity, distance: s.distance }),
    );
    lighting.circuits.set(CIRCUIT, { id: CIRCUIT, label: 'Jardim, balizadores e arandelas', group: 'Exterior', materials: [built.glowMat], emissive: 4 });
    const st = useStore.getState();
    st.set({ lights: { ...st.lights, [CIRCUIT]: st.lights[CIRCUIT] ?? st.time === 'noite' } });
    if (import.meta.env.DEV) console.info('[paisagismo]', built.stats);
  }, [built]);

  useFrame(() => {
    const lv = lighting.level.get(CIRCUIT) ?? 0;
    const k = lv * (0.25 + 0.75 * timeState.night);
    for (const m of built.washes) m.opacity = k * 0.55;
  });

  return <primitive object={built.group} />;
}
