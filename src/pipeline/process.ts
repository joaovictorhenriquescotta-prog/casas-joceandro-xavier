/*
 * Pipeline de importação do modelo arquitetônico (GLB exportado do SketchUp).
 *
 * Regra fundamental: este pipeline NÃO altera a geometria da arquitetura.
 * Ele apenas:
 *  - remove camadas técnicas (curvas de nível, pontos cotados, volume de corte, câmeras);
 *  - converte materiais para PBR metal/rugosidade e corrige transparências;
 *  - identifica ambientes, portas, luminárias e superfícies personalizáveis;
 *  - separa (sem mover vértices) as faces internas das paredes por ambiente;
 *  - agrupa malhas estáticas por material para reduzir chamadas de desenho;
 *  - comprime (Meshopt, precisão submilimétrica) para carregar rápido na web.
 *
 * Roda tanto no Node (scripts/process-model.ts) quanto no navegador
 * (painel administrativo), por isso não depende de APIs do Node.
 */
import {
  Document, Material, Node, Primitive, Mesh, Accessor, Texture,
  type mat4, type vec3,
} from '@gltf-transform/core';
import {
  metalRough, dedup, prune, flatten, join, transformPrimitive, meshopt, weld, clearNodeTransform,
  weldPrimitive, simplifyPrimitive,
} from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import {
  transformPoint, normalize, cross, sub, invert, multiply, emptyBox, expandBox, boxSize,
  pointInTri2, type Box,
} from './geom';
import { classifyMaterial, ROOM_TYPES, TECHNICAL_NODE_PATTERNS, VEGETATION_MATERIAL, WALL_MATERIAL, type ElementId } from './rules';
import type { SceneMeta, RoomMeta, DoorMeta, FixtureMeta, LedMeta } from './meta';

export type Log = (msg: string) => void;

export interface ProcessOptions {
  /** Texturas em resolução original, indexadas pelo nome do material no SketchUp. */
  textureOverrides?: Map<string, { data: Uint8Array; mimeType: string }>;
  /** Indica se uma imagem possui pixels transparentes (decodificação depende da plataforma). */
  hasTransparency?: (data: Uint8Array, mimeType: string) => Promise<boolean>;
  /** Compressão final de texturas (ex.: sharp no Node). Opcional. */
  compressTextures?: (doc: Document) => Promise<void>;
  /**
   * Simplifica objetos decorativos muito pesados (plantas, luminárias, carros, cortinas) acima deste número de
   * triângulos (somando as repetições). Paredes, pisos, lajes, portas e terreno nunca são simplificados. 0 desliga (padrão: 8000).
   */
  simplifyAbove?: number;
  /** Cor média e variação (0–1) de uma imagem; com ela, texturas quase lisas de objetos decorativos viram cor. */
  textureStats?: (data: Uint8Array, mimeType: string) => Promise<{ mean: number[]; std: number } | null>;
  /** Retira as plantas do modelo (padrão: true). */
  removeVegetation?: boolean;
  /** Aplica compressão Meshopt na geometria (padrão: true). */
  meshopt?: boolean;
  log?: Log;
}

const IDENTITY: mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

export async function processModel(doc: Document, opts: ProcessOptions = {}): Promise<SceneMeta> {
  const log = opts.log ?? (() => {});
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];

  // 1. Camadas técnicas e câmeras -------------------------------------------------
  let removed = 0;
  for (const node of root.listNodes()) {
    const name = node.getName();
    if (node.getCamera() || TECHNICAL_NODE_PATTERNS.some((re) => re.test(name))) {
      disposeSubtree(node);
      removed++;
    }
  }
  for (const cam of root.listCameras()) cam.dispose();
  log(`Camadas técnicas removidas: ${removed}`);
  if (opts.removeVegetation !== false) log(`Plantas retiradas: ${removeVegetation(root)}`);

  // 2. Materiais --------------------------------------------------------------------
  await doc.transform(metalRough());
  // faces sem material no SketchUp ("Default"): no glTF viram metal branco (metallic 1),
  // que espelha o céu e o gramado. Usa o material padrão do SketchUp, fosco e claro.
  // Dupla face como os demais materiais do SketchUp: muitas paredes sem pintura estão com a face invertida.
  let defaultMat: Material | null = null;
  for (const mesh of root.listMeshes())
    for (const prim of mesh.listPrimitives())
      if (!prim.getMaterial()) {
        defaultMat ??= doc.createMaterial('Padrão SketchUp').setBaseColorFactor([0.93, 0.92, 0.9, 1]).setDoubleSided(true);
        prim.setMaterial(defaultMat);
      }
  if (opts.textureOverrides) {
    let replaced = 0;
    const byImage = new Map<Texture, Texture>();
    for (const mat of root.listMaterials()) {
      const ov = opts.textureOverrides.get(normName(mat.getName()));
      const tex = mat.getBaseColorTexture();
      if (!ov || !tex) continue;
      let t = byImage.get(tex);
      if (!t) {
        t = doc.createTexture(mat.getName()).setImage(ov.data).setMimeType(ov.mimeType);
        byImage.set(tex, t);
        replaced++;
      }
      mat.setBaseColorTexture(t);
    }
    log(`Texturas substituídas pela versão em alta resolução: ${replaced}`);
  }
  const alphaCache = new Map<Texture, boolean>();
  for (const mat of root.listMaterials()) {
    const cls = classifyMaterial(mat.getName());
    mat.setMetallicRoughnessTexture(null);
    mat.setMetallicFactor(cls.metallic).setRoughnessFactor(cls.roughness);
    if (cls.glass) {
      const c = mat.getBaseColorFactor();
      mat.setBaseColorFactor([c[0], c[1], c[2], Math.min(c[3], 0.28)]).setAlphaMode('BLEND').setDoubleSided(true);
    } else if (mat.getAlphaMode() !== 'OPAQUE') {
      const tex = mat.getBaseColorTexture();
      let transparent = mat.getBaseColorFactor()[3] < 0.99;
      if (!transparent && tex && opts.hasTransparency) {
        if (!alphaCache.has(tex)) alphaCache.set(tex, await opts.hasTransparency(tex.getImage()!, tex.getMimeType()));
        transparent = alphaCache.get(tex)!;
      }
      if (transparent) {
        mat.setAlphaMode(mat.getBaseColorFactor()[3] < 0.99 ? 'BLEND' : 'MASK').setAlphaCutoff(0.5);
      } else mat.setAlphaMode('OPAQUE');
    }
    mat.setExtras({ ...(mat.getExtras() as object), element: cls.element, original: mat.getName() });
  }

  // 3. Ambientes (pisos nomeados no SketchUp) -------------------------------------
  const rooms: (RoomMeta & { tris: number[][][] })[] = [];
  const clones = new Map<string, Material>();
  const cloneFor = (orig: Material, key: string, extras: Record<string, unknown>) => {
    const k = `${key}|${orig.getName()}`;
    let m = clones.get(k);
    if (!m) {
      m = orig.clone().setName(`${key}__${orig.getName()}`);
      m.setExtras({ ...(orig.getExtras() as object), ...extras });
      clones.set(k, m);
    }
    return m;
  };
  for (const node of root.listNodes()) {
    const name = node.getName();
    if (!/^PISO - /.test(name) || /V[ÃA]O DE PORTA/.test(name)) continue;
    const type = ROOM_TYPES.find((t) => t.match(name));
    if (!type) continue;
    const house = /\+17,91/.test(name) ? 'casa1' : 'casa2';
    const id = `${house}-${type.id}`;
    const box = emptyBox();
    const tris: number[][][] = [];
    let floorY = -Infinity;
    forEachMeshNode(node, (mn) => {
      const wm = mn.getWorldMatrix();
      for (const prim of mn.getMesh()!.listPrimitives()) {
        eachTriangle(prim, wm, (a, b, c) => {
          const n = normalize(cross(sub(b, a), sub(c, a)));
          expandBox(box, a); expandBox(box, b); expandBox(box, c);
          if (Math.abs(n[1]) > 0.9) {
            tris.push([[a[0], a[2]], [b[0], b[2]], [c[0], c[2]]]);
            floorY = Math.max(floorY, a[1], b[1], c[1]);
          }
        });
        const mat = prim.getMaterial();
        if (mat) prim.setMaterial(cloneFor(mat, `PISO_${id}`, { surface: 'piso', room: id }));
        addPlanarUV1(doc, prim, wm, 'floor');
      }
    });
    rooms.push({
      id, house, type: type.id, label: type.label, area: parseArea(name),
      floorY, min: box.min, max: box.max, sourceName: name, tris,
    });
  }
  log(`Ambientes identificados: ${rooms.length}`);

  const roomAt = (p: vec3): (typeof rooms)[number] | undefined => {
    for (const r of rooms) {
      if (p[0] < r.min[0] || p[0] > r.max[0] || p[2] < r.min[2] || p[2] > r.max[2]) continue;
      if (p[1] < r.floorY - 0.05 || p[1] > r.floorY + 3.4) continue;
      for (const t of r.tris) if (pointInTri2(p[0], p[2], t[0], t[1], t[2])) return r;
    }
    return undefined;
  };

  // 4. Portas: folhas separadas no modelo -----------------------------------------
  const doors: DoorMeta[] = [];
  const entryClones = new Map<Material, Material>();
  const doorNodes = detectDoorLeaves(root.listNodes(), log);
  doorNodes.forEach((d, i) => {
    const center: vec3 = [(d.box.min[0] + d.box.max[0]) / 2, d.box.min[1] + 1, (d.box.min[2] + d.box.max[2]) / 2];
    // ambiente mais próximo: testa os dois lados da folha
    const thinX = d.size[0] < d.size[2];
    const probes: vec3[] = thinX
      ? [[center[0] + 0.4, center[1], center[2]], [center[0] - 0.4, center[1], center[2]]]
      : [[center[0], center[1], center[2] + 0.4], [center[0], center[1], center[2] - 0.4]];
    const rs = probes.map(roomAt).filter(Boolean) as RoomMeta[];
    const house = rs[0]?.house ?? (center[0] < (rooms.reduce((a, r) => a + r.min[0] + r.max[0], 0) / (2 * rooms.length || 1)) ? 'casa1' : 'casa2');
    const id = `porta-${String(i + 1).padStart(2, '0')}`;
    bakeSubtreeIntoNode(doc, d.node);
    d.node.setName(`DOOR__${id}`);
    if (d.kind === 'pivotante') {
      // folha da porta de entrada vira um elemento próprio do painel de cores
      for (const prim of d.node.getMesh()?.listPrimitives() ?? []) {
        const m = prim.getMaterial();
        const el = (m?.getExtras() as { element?: string } | undefined)?.element;
        if (!m || el === 'metais' || el === 'vidros' || m.getMetallicFactor() > 0.5) continue;
        let c = entryClones.get(m);
        if (!c) {
          c = m.clone().setName(`PORTA_ENTRADA__${m.getName()}`).setExtras({ ...(m.getExtras() as object), element: 'porta-entrada' });
          entryClones.set(m, c);
        }
        prim.setMaterial(c);
      }
    }
    doors.push({
      id, node: `DOOR__${id}`, kind: d.kind, hinge: d.hinge, width: d.width, height: d.size[1], house,
      rooms: [...new Set(rs.map((r) => r.id))],
      label: doorLabel(rs, d.kind),
    });
  });
  log(`Portas com folha separada: ${doors.length}`);

  // 5. Paredes internas: separa as faces voltadas para cada ambiente ---------------
  let wallTris = 0;
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh || node.getName().startsWith('DOOR__')) continue;
    for (const prim of mesh.listPrimitives()) {
      const mat = prim.getMaterial();
      if (!mat || !WALL_MATERIAL.test(mat.getName())) continue;
      wallTris += splitInteriorWalls(doc, mesh, prim, node.getWorldMatrix(), roomAt, (room) =>
        cloneFor(mat, `PAREDE_${room}`, { surface: 'parede', room, element: 'paredes-internas' }));
    }
  }
  log(`Faces de parede interna separadas por ambiente: ${wallTris}`);

  // 6. Luminárias e fitas de LED -------------------------------------------------
  const fixtures: FixtureMeta[] = [];
  const leds: LedMeta[] = [];
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    for (const prim of mesh.listPrimitives()) {
      const name = prim.getMaterial()?.getName() ?? '';
      if (/^Fixture Light/.test(name) || /^LR_LED/.test(name)) {
        const box = primBox(prim, node.getWorldMatrix());
        const c: vec3 = [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, (box.min[2] + box.max[2]) / 2];
        if (/^Fixture/.test(name)) fixtures.push({ id: `lum-${fixtures.length + 1}`, position: c, room: roomAt([c[0], c[1] - 1.5, c[2]])?.id ?? null, kind: 'painel' });
        else leds.push({ min: box.min, max: box.max });
      }
    }
  }
  for (const mat of root.listMaterials()) {
    const n = mat.getName();
    if (/LR_LED|^\.LED$/.test(n)) mat.setEmissiveFactor([1, 0.82, 0.48]).setExtras({ ...(mat.getExtras() as object), emissiveRole: 'led-fachada' });
    if (/^Fixture Light/.test(n)) mat.setEmissiveFactor([1, 0.9, 0.75]).setExtras({ ...(mat.getExtras() as object), emissiveRole: 'luminaria' });
  }

  // 6b. Cozinha: bancadas na altura de trabalho dentro da sala integrada ---------------
  const kitchenAcc = new Map<string, [number, number, number]>();
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh || node.getName().startsWith('DOOR__')) continue;
    const wm = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const el = (prim.getMaterial()?.getExtras() as { element?: string } | undefined)?.element;
      if (el !== 'bancadas') continue;
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const v: vec3 = [0, 0, 0];
      for (let i = 0; i < pos.getCount(); i++) {
        transformPoint(wm, pos.getElement(i, v) as vec3, v);
        const r = roomAt([v[0], v[1] - 0.9, v[2]]);
        if (!r || r.type !== 'estar' || v[1] - r.floorY < 0.7 || v[1] - r.floorY > 1.15) continue;
        const a = kitchenAcc.get(r.id) ?? [0, 0, 0];
        a[0] += v[0]; a[1] += v[2]; a[2]++;
        kitchenAcc.set(r.id, a);
      }
    }
  }
  for (const r of rooms) {
    const a = kitchenAcc.get(r.id);
    if (a && a[2] > 0) r.kitchen = [a[0] / a[2], a[1] / a[2]];
  }
  log(`Cozinhas localizadas pelas bancadas: ${kitchenAcc.size}`);

  // 7. Lajes de cobertura ficam separadas (vista em corte / planta humanizada) -----
  let roofs = 0;
  for (const node of root.listNodes()) {
    if (/^LAJE (DE COBERTURA|SUPERIOR|- BANHEIRO)/.test(node.getName())) {
      bakeSubtreeIntoNode(doc, node);
      node.setName(`ROOF__${++roofs}`);
    }
  }
  log(`Lajes de cobertura separadas: ${roofs}`);

  // 7c. Materiais decorativos repetidos ---------------------------------------------
  await doc.transform(dedup({ propertyTypes: ['Texture'] }));
  if (opts.textureStats) log(`Texturas lisas trocadas pela cor: ${await flattenPlainTextures(doc, opts.textureStats)}`);

  // 8. Otimização sem alterar geometria ---------------------------------------------
  const keep = /^(DOOR|ROOF)__/;
  for (const node of root.listNodes()) if (!keep.test(node.getName())) node.setName('');
  for (const mesh of root.listMeshes()) mesh.setName('');
  await doc.transform(flatten());
  // aplica as transformações nos vértices (posições finais idênticas, em metros)
  for (const node of scene.listChildren()) {
    if (!node.getName().startsWith('DOOR__') && node.getMesh()) clearNodeTransform(node);
  }
  await doc.transform(join({ keepNamed: true }));
  await simplifyDecor(doc, opts.simplifyAbove ?? 8000, log);
  // depois de simplificar cada material separadamente (unir antes muda o que é simplificado e superfícies coladas brigam)
  log(`Materiais decorativos unidos: ${mergeDecorMaterials(doc)}`);
  await doc.transform(join({ keepNamed: true }));
  await doc.transform(
    weld(),
    dedup({ keepUniqueNames: true }),
    prune({ keepAttributes: true }),
  );
  log(`Normais inválidas corrigidas: ${fixZeroNormals(doc)}`);
  if (opts.compressTextures) await opts.compressTextures(doc);
  if (opts.meshopt !== false) {
    await MeshoptEncoder.ready;
    await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  }

  // 9. Metadados --------------------------------------------------------------------
  const bounds = emptyBox();
  for (const r of rooms) { expandBox(bounds, r.min); expandBox(bounds, r.max); }
  const meta: SceneMeta = {
    version: 1,
    generatedAt: new Date().toISOString(),
    houseBounds: bounds,
    houses: [
      { id: 'casa1', label: 'Casa 1', floorLevel: '+17,91' },
      { id: 'casa2', label: 'Casa 2', floorLevel: '+17,26' },
    ],
    rooms: rooms.map(({ tris, ...r }) => ({ ...r, footprint: tris.flat(2) })),
    doors,
    fixtures,
    leds,
    materials: root.listMaterials().map((m) => {
      const e = m.getExtras() as { element?: ElementId; surface?: string; room?: string; original?: string };
      return { name: m.getName(), original: e.original ?? m.getName(), element: e.element ?? null, surface: e.surface ?? null, room: e.room ?? null };
    }),
  };
  scene.setExtras({ visitaVirtual: meta });
  return meta;
}

/* ---------------------------------------------------------------------------- */

function normName(n: string) {
  return n.trim().toLowerCase();
}

function parseArea(name: string): number | null {
  const m = name.match(/\(([\d.]+) m²/);
  return m ? parseFloat(m[1]) : null;
}

function disposeSubtree(node: Node) {
  for (const c of node.listChildren()) disposeSubtree(c);
  node.dispose();
}

function forEachMeshNode(node: Node, fn: (n: Node) => void) {
  if (node.getMesh()) fn(node);
  for (const c of node.listChildren()) forEachMeshNode(c, fn);
}

function eachTriangle(prim: Primitive, wm: mat4, fn: (a: vec3, b: vec3, c: vec3, i: number) => void) {
  const pos = prim.getAttribute('POSITION');
  if (!pos || prim.getMode() !== Primitive.Mode.TRIANGLES) return;
  const idx = prim.getIndices();
  const count = idx ? idx.getCount() : pos.getCount();
  const p: vec3[] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < count; i += 3) {
    for (let k = 0; k < 3; k++) {
      const vi = idx ? idx.getScalar(i + k) : i + k;
      pos.getElement(vi, p[k] as unknown as number[]);
      transformPoint(wm, [p[k][0], p[k][1], p[k][2]], p[k]);
    }
    fn([...p[0]] as vec3, [...p[1]] as vec3, [...p[2]] as vec3, i / 3);
  }
}

function primBox(prim: Primitive, wm: mat4): Box {
  const b = emptyBox();
  const pos = prim.getAttribute('POSITION');
  if (!pos) return b;
  const v: vec3 = [0, 0, 0];
  for (let i = 0; i < pos.getCount(); i++) {
    pos.getElement(i, v as unknown as number[]);
    expandBox(b, transformPoint(wm, v));
  }
  return b;
}

export function subtreeBox(node: Node): Box {
  const b = emptyBox();
  forEachMeshNode(node, (mn) => {
    for (const prim of mn.getMesh()!.listPrimitives()) {
      const pb = primBox(prim, mn.getWorldMatrix());
      expandBox(b, pb.min); expandBox(b, pb.max);
    }
  });
  return b;
}

/** UV secundário em metros (coordenadas de mundo) para revestimentos personalizados. */
function addPlanarUV1(doc: Document, prim: Primitive, wm: mat4, mode: 'floor') {
  const pos = prim.getAttribute('POSITION');
  if (!pos || mode !== 'floor') return;
  const uv = new Float32Array(pos.getCount() * 2);
  const v: vec3 = [0, 0, 0];
  for (let i = 0; i < pos.getCount(); i++) {
    pos.getElement(i, v as unknown as number[]);
    transformPoint(wm, [v[0], v[1], v[2]], v);
    uv[i * 2] = v[0];
    uv[i * 2 + 1] = v[2];
  }
  const buffer = doc.getRoot().listBuffers()[0];
  prim.setAttribute('TEXCOORD_1', doc.createAccessor().setType('VEC2').setArray(uv).setBuffer(buffer));
}

/**
 * Separa as faces de parede voltadas para um ambiente em primitivas próprias.
 * As posições dos vértices são copiadas sem nenhuma alteração.
 */
function splitInteriorWalls(
  doc: Document, mesh: Mesh, prim: Primitive, wm: mat4,
  roomAt: (p: vec3) => { id: string } | undefined,
  materialFor: (room: string) => Material,
): number {
  const pos = prim.getAttribute('POSITION');
  const nor = prim.getAttribute('NORMAL');
  if (!pos || !nor || prim.getMode() !== Primitive.Mode.TRIANGLES) return 0;
  const inv = invert(wm);
  const nm = (n: vec3): vec3 => normalize([
    inv[0] * n[0] + inv[1] * n[1] + inv[2] * n[2],
    inv[4] * n[0] + inv[5] * n[1] + inv[6] * n[2],
    inv[8] * n[0] + inv[9] * n[1] + inv[10] * n[2],
  ]);
  const idx = prim.getIndices();
  const count = idx ? idx.getCount() : pos.getCount();
  const groups = new Map<string, number[]>(); // room -> lista de índices de vértice (3 por triângulo)
  const keep: number[] = [];
  const v: vec3 = [0, 0, 0], n: vec3 = [0, 0, 0];
  for (let i = 0; i < count; i += 3) {
    const vi = [0, 1, 2].map((k) => (idx ? idx.getScalar(i + k) : i + k));
    const w = vi.map((x) => { pos.getElement(x, v as unknown as number[]); return transformPoint(wm, [v[0], v[1], v[2]]); });
    const nn: vec3 = [0, 0, 0];
    for (const x of vi) { nor.getElement(x, n as unknown as number[]); nn[0] += n[0]; nn[1] += n[1]; nn[2] += n[2]; }
    const N = nm(nn);
    let room: string | undefined;
    if (Math.abs(N[1]) < 0.3) {
      const c: vec3 = [(w[0][0] + w[1][0] + w[2][0]) / 3, (w[0][1] + w[1][1] + w[2][1]) / 3, (w[0][2] + w[1][2] + w[2][2]) / 3];
      room = roomAt([c[0] + N[0] * 0.1, c[1], c[2] + N[2] * 0.1])?.id;
    }
    if (room) {
      if (!groups.has(room)) groups.set(room, []);
      groups.get(room)!.push(...vi);
    } else keep.push(...vi);
  }
  if (!groups.size) return 0;
  const buffer = doc.getRoot().listBuffers()[0];
  let moved = 0;
  for (const [room, list] of groups) {
    const np = doc.createPrimitive().setMaterial(materialFor(room));
    for (const sem of prim.listSemantics()) {
      const src = prim.getAttribute(sem)!;
      const size = src.getElementSize();
      const out = new Float32Array(list.length * size);
      const el: number[] = [];
      list.forEach((vi, j) => { src.getElement(vi, el); for (let k = 0; k < size; k++) out[j * size + k] = el[k]; });
      np.setAttribute(sem, doc.createAccessor().setType(src.getType()).setArray(out).setBuffer(buffer).setNormalized(src.getNormalized()));
    }
    // UV secundário em metros: horizontal ao longo da parede, vertical = altura
    const uv = new Float32Array(list.length * 2);
    for (let t = 0; t < list.length; t += 3) {
      const w = [0, 1, 2].map((k) => { pos.getElement(list[t + k], v as unknown as number[]); return transformPoint(wm, [v[0], v[1], v[2]]); });
      const N = normalize(cross(sub(w[1], w[0]), sub(w[2], w[0])));
      const T = normalize(cross([0, 1, 0], N));
      for (let k = 0; k < 3; k++) {
        uv[(t + k) * 2] = w[k][0] * T[0] + w[k][2] * T[2];
        uv[(t + k) * 2 + 1] = w[k][1];
      }
    }
    np.setAttribute('TEXCOORD_1', doc.createAccessor().setType('VEC2').setArray(uv).setBuffer(buffer));
    mesh.addPrimitive(np);
    moved += list.length / 3;
  }
  // primitiva original fica só com as faces externas
  const IdxArr = pos.getCount() > 65535 ? Uint32Array : Uint16Array;
  if (keep.length) prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new IdxArr(keep)).setBuffer(buffer));
  else { mesh.removePrimitive(prim); prim.dispose(); }
  return moved;
}

/* ---------------------------------- Portas ----------------------------------- */

interface DoorCandidate {
  node: Node; box: Box; size: vec3; hinge: vec3; width: number; kind: 'giro' | 'pivotante';
}

export function detectDoorLeaves(nodes: Node[], log: Log): DoorCandidate[] {
  const parentOf = new Map<Node, Node>();
  for (const n of nodes) for (const c of n.listChildren()) parentOf.set(c, n);
  const found = new Map<Node, DoorCandidate>();
  for (const mn of nodes) {
    const mesh = mn.getMesh();
    if (!mesh) continue;
    for (const prim of mesh.listPrimitives()) {
      const mname = prim.getMaterial()?.getName() ?? '';
      if (/vidro|glass|translucent|cristal/i.test(mname)) continue;
      const b = primBox(prim, mn.getWorldMatrix());
      const s = boxSize(b);
      const thin = Math.min(s[0], s[2]), wide = Math.max(s[0], s[2]);
      if (!(thin < 0.06 && wide > 0.6 && wide < 1.25 && s[1] > 1.9 && s[1] < 2.35)) continue;
      // sobe na hierarquia enquanto o grupo continuar do tamanho da folha
      let leaf = mn, lb = b;
      for (let p = parentOf.get(mn); p; p = parentOf.get(p)) {
        const pb = subtreeBox(p);
        const ps = boxSize(pb);
        const pthin = Math.min(ps[0], ps[2]), pwide = Math.max(ps[0], ps[2]);
        if (pwide - wide > 0.07 || ps[1] - s[1] > 0.07 || pthin - thin > 0.12) break;
        leaf = p; lb = pb;
      }
      if (found.has(leaf)) continue;
      const h = findHinge(leaf, lb);
      if (!h) continue;
      found.set(leaf, { node: leaf, box: lb, size: boxSize(lb), hinge: h.hinge, width: wide, kind: h.kind });
    }
  }
  // descarta candidatos contidos em outros
  const list = [...found.values()];
  const out = list.filter((d) => !list.some((o) => o !== d && isAncestor(o.node, d.node, parentOf)));
  log(`Candidatos a porta: ${list.length}, aceitos: ${out.length}`);
  return out;
}

function isAncestor(a: Node, b: Node, parentOf: Map<Node, Node>) {
  for (let p = parentOf.get(b); p; p = parentOf.get(p)) if (p === a) return true;
  return false;
}

/** Eixo da dobradiça: borda vertical oposta ao puxador (peça pequena a ~1 m do piso). */
export function findHinge(leaf: Node, lb: Box): { hinge: vec3; kind: 'giro' | 'pivotante' } | null {
  const s = boxSize(lb);
  const alongX = s[0] > s[2];
  const lo = alongX ? lb.min[0] : lb.min[2];
  const hi = alongX ? lb.max[0] : lb.max[2];
  let handle: number | null = null;
  let longBar = false;
  forEachMeshNode(leaf, (mn) => {
    for (const prim of mn.getMesh()!.listPrimitives()) {
      const b = primBox(prim, mn.getWorldMatrix());
      const bs = boxSize(b);
      if (bs[1] > 0.8 && Math.max(bs[0], bs[2]) < 0.08 && (b.min[1] - lb.min[1]) > 0.1) longBar = true;
      const h = (b.min[1] + b.max[1]) / 2 - lb.min[1];
      if (Math.max(bs[0], bs[1], bs[2]) < 0.3 && h > 0.8 && h < 1.25) {
        const c = alongX ? (b.min[0] + b.max[0]) / 2 : (b.min[2] + b.max[2]) / 2;
        if (handle === null || Math.abs(c - (lo + hi) / 2) > Math.abs(handle - (lo + hi) / 2)) handle = c;
      }
    }
  });
  if (handle === null || Math.abs(handle - (lo + hi) / 2) < (hi - lo) * 0.2) return null;
  // porta pivotante (puxador em barra longa): eixo deslocado ~12 cm da borda
  const kind = longBar ? 'pivotante' : 'giro';
  const off = kind === 'pivotante' ? 0.12 : 0;
  const edge = handle > (lo + hi) / 2 ? lo + off : hi - off;
  const mid = alongX ? (lb.min[2] + lb.max[2]) / 2 : (lb.min[0] + lb.max[0]) / 2;
  return { hinge: alongX ? [edge, lb.min[1], mid] : [mid, lb.min[1], edge], kind };
}

/** Junta as malhas da folha (incluindo puxador e dobradiças) em um único nó animável. */
function bakeSubtreeIntoNode(doc: Document, leaf: Node) {
  const inv = invert(leaf.getWorldMatrix());
  const mesh = doc.createMesh();
  const visit = (n: Node) => {
    const m = n.getMesh();
    if (m) {
      const rel = multiply(inv, n.getWorldMatrix());
      for (const prim of m.listPrimitives()) {
        const p = prim.clone();
        for (const sem of p.listSemantics()) p.setAttribute(sem, p.getAttribute(sem)!.clone());
        const ix = p.getIndices();
        if (ix) p.setIndices(ix.clone());
        if (!isIdentity(rel)) transformPrimitive(p, rel);
        mesh.addPrimitive(p);
      }
    }
    for (const c of n.listChildren()) visit(c);
  };
  visit(leaf);
  for (const c of leaf.listChildren()) disposeSubtree(c);
  leaf.setMesh(mesh);
}

function isIdentity(m: mat4) {
  return m.every((v, i) => Math.abs(v - IDENTITY[i]) < 1e-9);
}

const DOOR_PRIORITY = ['banho-suite', 'banheiro', 'suite', 'quarto', 'garagem', 'estar'];
function doorLabel(rooms: RoomMeta[], kind: string) {
  if (kind === 'pivotante') return 'Porta de entrada';
  if (!rooms.length) return 'Porta';
  const inner = [...rooms].sort((a, b) => DOOR_PRIORITY.indexOf(a.type) - DOOR_PRIORITY.indexOf(b.type))[0];
  return `Porta ${inner.type === 'garagem' ? 'da garagem' : `do ${inner.label.toLowerCase()}`}`.replace('do suíte', 'da suíte');
}

export type { Accessor };

/**
 * Objetos decorativos pesados (plantas, plafons, carros, cortinas): modelos de biblioteca chegam com centenas de
 * milhares de triângulos e deixam o arquivo grande demais para o navegador. Depois de juntar as malhas por material,
 * cada material decorativo acima do limite é simplificado com desvio máximo de ~2,5 cm. Paredes, pisos, lajes,
 * portas, fachada, muros, vidros e terreno nunca são simplificados.
 */
async function simplifyDecor(doc: Document, limit: number, log: Log) {
  if (limit <= 0) return;
  await MeshoptSimplifier.ready;
  const arch = /^(PAREDE|PISO|ROOF|DOOR)|TINTA|MURO|Muro|LAJE|TERRENO|terreno|vidro|Vidro|VIDRO|Glass|glass|ESQUADR|esquadr|Esquadr|BIANCOGRES|GRANITO|Granito|CALACATA|LR_LED/;
  const triCount = (p: Primitive) => (p.getIndices()?.getCount() ?? p.getAttribute('POSITION')?.getCount() ?? 0) / 3;
  let before = 0, after = 0;
  const report: string[] = [];
  for (const node of doc.getRoot().listNodes()) {
    if (/^(DOOR|ROOF)__/.test(node.getName())) continue;
    for (const prim of node.getMesh()?.listPrimitives() ?? []) {
      const name = prim.getMaterial()?.getName() ?? '';
      const tris = triCount(prim);
      if (tris <= limit || prim.getMode() !== 4 || arch.test(name)) continue;
      const pos = prim.getAttribute('POSITION')!;
      const lo = pos.getMin([0, 0, 0]), hi = pos.getMax([0, 0, 0]);
      const diag = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) || 1;
      const textured = !!prim.getMaterial()?.getBaseColorTexture();
      // normais separam os vértices em cada aresta e travam a simplificação: saem e são recalculadas (com quinas)
      prim.setAttribute('NORMAL', null);
      for (const k of prim.listSemantics()) if (k !== 'POSITION' && !(textured && k === 'TEXCOORD_0')) prim.setAttribute(k, null);
      weldPrimitive(prim);
      // triângulos soltos (cada canto com sua própria coordenada de textura): junta pela posição
      if (prim.getAttribute('POSITION')!.getCount() > tris * 1.5) weldByPosition(doc, prim);
      simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: Math.max(0.05, limit / tris), error: Math.min(0.2, 0.025 / diag), lockBorder: false });
      creaseNormals(doc, prim, 40);
      const now = triCount(prim);
      before += tris; after += now;
      if (tris > 100000) report.push(`${name} ${Math.round(tris / 1000)}k→${Math.round(now / 1000)}k`);
    }
  }
  log(`Objetos decorativos simplificados: ${Math.round(before / 1000)} mil → ${Math.round(after / 1000)} mil triângulos`);
  if (report.length) log('  ' + report.join(' · '));
}

/**
 * Modelos de biblioteca trazem milhares de materiais quase iguais ([Color_008]1…7, *12, Material~3…); cada um vira uma
 * chamada de desenho e o 3D fica lento para abrir e para mover. Materiais decorativos (sem elemento personalizável,
 * sem luz, sem vidro) com a mesma textura e cor muito próxima (diferença < 3%) passam a ser um só.
 */
function mergeDecorMaterials(doc: Document): number {
  const q = (v: number, step: number) => Math.round(v / step);
  const canon = new Map<string, Material>();
  let merged = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const m = prim.getMaterial();
      if (!m) continue;
      if (!isDecor(m)) continue;
      const c = m.getBaseColorFactor(), e = m.getEmissiveFactor();
      const key = [
        m.getBaseColorTexture()?.getImage()?.byteLength ?? 'x', m.getBaseColorTexture() ? doc.getRoot().listTextures().indexOf(m.getBaseColorTexture()!) : -1,
        q(Math.sqrt(c[0]), 0.03), q(Math.sqrt(c[1]), 0.03), q(Math.sqrt(c[2]), 0.03), q(c[3], 0.1),
        q(m.getMetallicFactor(), 0.2), q(m.getRoughnessFactor(), 0.15), e.map((x) => q(x, 0.1)).join(','),
        m.getAlphaMode(), m.getDoubleSided(), !!m.getNormalTexture(),
      ].join('|');
      const k = canon.get(key);
      if (!k) { canon.set(key, m); continue; }
      if (k !== m) { prim.setMaterial(k); merged++; }
    }
  }
  return merged;
}

const KEEP_MATERIAL = /^(PAREDE|PISO|PORTA_ENTRADA)_|shtora|TINTA|BIANCOGRES|Elizabeth|GRANITO|Granito|CALACATA|Padrão SketchUp/;
const isDecor = (m: Material) => {
  const ex = m.getExtras() as Record<string, unknown>;
  return !ex.element && !ex.emissiveRole && !ex.surface && !KEEP_MATERIAL.test(m.getName()) && m.getAlphaMode() === 'OPAQUE';
};

/** Em objetos decorativos, texturas de cor quase uniforme (variação < 7%) viram a cor média. */
async function flattenPlainTextures(doc: Document, stats: NonNullable<ProcessOptions['textureStats']>): Promise<number> {
  const cache = new Map<Texture, { mean: number[]; std: number } | null>();
  let n = 0;
  for (const m of doc.getRoot().listMaterials()) {
    const tex = m.getBaseColorTexture();
    if (!tex || !isDecor(m)) continue;
    if (!cache.has(tex)) cache.set(tex, await stats(tex.getImage()!, tex.getMimeType()));
    const s = cache.get(tex);
    if (!s || s.std > 0.07) continue;
    const c = m.getBaseColorFactor();
    // a textura está em sRGB; o fator é linear
    const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    m.setBaseColorFactor([c[0] * lin(s.mean[0]), c[1] * lin(s.mean[1]), c[2] * lin(s.mean[2]), c[3]]).setBaseColorTexture(null);
    n++;
  }
  return n;
}

/** Normais de comprimento zero (triângulos degenerados) viram NaN no shader e manchas pretas com o bloom. */
function fixZeroNormals(doc: Document): number {
  let fixed = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const n = prim.getAttribute('NORMAL');
      if (!n) continue;
      const v = [0, 0, 0];
      for (let i = 0; i < n.getCount(); i++) {
        n.getElement(i, v);
        const l = Math.hypot(v[0], v[1], v[2]);
        if (l > 0.5 && Number.isFinite(l)) continue;
        n.setElement(i, l > 1e-6 && Number.isFinite(l) ? [v[0] / l, v[1] / l, v[2] / l] : [0, 1, 0]);
        fixed++;
      }
    }
  }
  return fixed;
}

/** Retira cada planta inteira: sobe da malha com folhas até o maior grupo em que folhas são ≥ 35% dos triângulos. */
function removeVegetation(root: ReturnType<Document['getRoot']>): number {
  const parent = new Map<Node, Node>();
  for (const n of root.listNodes()) for (const c of n.listChildren()) parent.set(c, n);
  const cache = new Map<Node, [number, number]>();
  const stat = (n: Node): [number, number] => {
    const c = cache.get(n); if (c) return c;
    let leaf = 0, all = 0;
    for (const p of n.getMesh()?.listPrimitives() ?? []) {
      const t = (p.getIndices()?.getCount() ?? p.getAttribute('POSITION')?.getCount() ?? 0) / 3;
      all += t; if (VEGETATION_MATERIAL.test(p.getMaterial()?.getName() ?? '')) leaf += t;
    }
    for (const ch of n.listChildren()) { const [l, a] = stat(ch); leaf += l; all += a; }
    const r: [number, number] = [leaf, all]; cache.set(n, r); return r;
  };
  const tops = new Set<Node>();
  for (const n of root.listNodes()) {
    if (!n.getMesh()?.listPrimitives().some((p) => VEGETATION_MATERIAL.test(p.getMaterial()?.getName() ?? ''))) continue;
    let best = n;
    for (let p = parent.get(n); p; p = parent.get(p)) { const [l, a] = stat(p); if (!a || l / a < 0.35) break; best = p; }
    tops.add(best);
  }
  // um grupo pode estar dentro de outro: descarta só os mais externos
  const outer = [...tops].filter((t) => { for (let p = parent.get(t); p; p = parent.get(p)) if (tops.has(p)) return false; return true; });
  for (const t of outer) disposeSubtree(t);
  return outer.length;
}

/** Junta vértices na mesma posição (1 mm), ficando com a coordenada de textura do primeiro. */
function weldByPosition(doc: Document, prim: Primitive) {
  const pos = prim.getAttribute('POSITION')!;
  const uv = prim.getAttribute('TEXCOORD_0');
  const idx = prim.getIndices();
  const n = idx ? idx.getCount() : pos.getCount();
  const key = new Map<string, number>();
  const P: number[] = [], U: number[] = [];
  const out = new Uint32Array(n);
  const v = [0, 0, 0], e = [0, 0];
  for (let i = 0; i < n; i++) {
    const src = idx ? idx.getScalar(i) : i;
    pos.getElement(src, v);
    const k = `${Math.round(v[0] * 1000)},${Math.round(v[1] * 1000)},${Math.round(v[2] * 1000)}`;
    let j = key.get(k);
    if (j === undefined) {
      j = P.length / 3; key.set(k, j); P.push(v[0], v[1], v[2]);
      if (uv) { uv.getElement(src, e); U.push(e[0], e[1]); }
    }
    out[i] = j;
  }
  const buffer = doc.getRoot().listBuffers()[0];
  prim.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(P)).setBuffer(buffer));
  if (uv) prim.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(U)).setBuffer(buffer));
  prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(out).setBuffer(buffer));
}

/** Normais suaves nas superfícies curvas e quinas vivas acima de `creaseDeg` (resultado sem índices; o weld junta depois). */
function creaseNormals(doc: Document, prim: Primitive, creaseDeg: number) {
  const pos = prim.getAttribute('POSITION')!;
  const uv = prim.getAttribute('TEXCOORD_0');
  const idx = prim.getIndices();
  const nTri = (idx ? idx.getCount() : pos.getCount()) / 3;
  const corner = (i: number) => (idx ? idx.getScalar(i) : i);
  const fn = new Float32Array(nTri * 3);
  const p = [0, 0, 0], q = [0, 0, 0], r = [0, 0, 0];
  const faces = new Map<number, number[]>();
  for (let t = 0; t < nTri; t++) {
    const i0 = corner(t * 3), i1 = corner(t * 3 + 1), i2 = corner(t * 3 + 2);
    pos.getElement(i0, p); pos.getElement(i1, q); pos.getElement(i2, r);
    const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], vx = r[0] - p[0], vy = r[1] - p[1], vz = r[2] - p[2];
    fn[t * 3] = uy * vz - uz * vy; fn[t * 3 + 1] = uz * vx - ux * vz; fn[t * 3 + 2] = ux * vy - uy * vx;
    for (const v of [i0, i1, i2]) { const l = faces.get(v); if (l) l.push(t); else faces.set(v, [t]); }
  }
  const cos = Math.cos((creaseDeg * Math.PI) / 180);
  const unit = (t: number) => { const l = Math.hypot(fn[t * 3], fn[t * 3 + 1], fn[t * 3 + 2]) || 1; return [fn[t * 3] / l, fn[t * 3 + 1] / l, fn[t * 3 + 2] / l]; };
  const P = new Float32Array(nTri * 9), N = new Float32Array(nTri * 9), U = uv ? new Float32Array(nTri * 6) : null;
  const e = [0, 0];
  for (let t = 0; t < nTri; t++) {
    const ft = unit(t);
    for (let k = 0; k < 3; k++) {
      const v = corner(t * 3 + k), o = (t * 3 + k);
      pos.getElement(v, p); P.set(p, o * 3);
      if (U && uv) { uv.getElement(v, e); U.set(e, o * 2); }
      let nx = 0, ny = 0, nz = 0;
      for (const f of faces.get(v)!) {
        const g = unit(f);
        if (g[0] * ft[0] + g[1] * ft[1] + g[2] * ft[2] >= cos) { nx += fn[f * 3]; ny += fn[f * 3 + 1]; nz += fn[f * 3 + 2]; }
      }
      const l = Math.hypot(nx, ny, nz) || 1;
      N[o * 3] = nx / l; N[o * 3 + 1] = ny / l; N[o * 3 + 2] = nz / l;
    }
  }
  const buffer = doc.getRoot().listBuffers()[0];
  const acc = (type: 'VEC3' | 'VEC2', arr: Float32Array<ArrayBuffer>) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buffer);
  prim.setIndices(null);
  prim.setAttribute('POSITION', acc('VEC3', P));
  prim.setAttribute('NORMAL', acc('VEC3', N));
  if (U) prim.setAttribute('TEXCOORD_0', acc('VEC2', U));
}
