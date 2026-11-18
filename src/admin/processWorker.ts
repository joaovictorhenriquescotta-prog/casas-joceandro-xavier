/// <reference lib="webworker" />
/*
 * Processa o modelo no navegador do administrador, com o mesmo pipeline do script de linha
 * de comando. Roda num Web Worker para a tela continuar respondendo.
 */
import { WebIO, type Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { unzipSync } from 'fflate';
import { processModel } from '../pipeline/process';

export interface WorkerRequest {
  model: ArrayBuffer;
  fileName: string;
  /** .zip com as texturas exportadas do SketchUp (opcional) */
  textures?: ArrayBuffer;
}

export type WorkerMessage =
  | { type: 'log'; text: string }
  | { type: 'progress'; step: string; value: number }
  | { type: 'done'; glb: ArrayBuffer; meta: unknown; stats: { triangles: number; inputBytes: number; outputBytes: number } }
  | { type: 'error'; text: string };

const post = (m: WorkerMessage, transfer: Transferable[] = []) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m, transfer);

const MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

async function hasTransparency(data: Uint8Array, mimeType: string) {
  if (mimeType === 'image/jpeg') return false;
  try {
    const bmp = await createImageBitmap(new Blob([data as BlobPart], { type: mimeType }), { resizeWidth: 128, resizeHeight: 128 });
    const c = new OffscreenCanvas(128, 128);
    const g = c.getContext('2d')!;
    g.drawImage(bmp, 0, 0);
    const px = g.getImageData(0, 0, 128, 128).data;
    for (let i = 3; i < px.length; i += 4) if (px[i] < 250) return true;
    return false;
  } catch {
    return false;
  }
}

/** Converte as texturas para WebP (até 2048 px), como o script faz com o sharp. */
async function compressTextures(doc: Document) {
  doc.createExtension(EXTTextureWebP).setRequired(true);
  const list = doc.getRoot().listTextures();
  let i = 0;
  for (const tex of list) {
    i++;
    const img = tex.getImage();
    const mime = tex.getMimeType();
    if (!img || mime === 'image/webp') continue;
    try {
      const probe = await createImageBitmap(new Blob([img as BlobPart], { type: mime }));
      const k = Math.min(1, 2048 / Math.max(probe.width, probe.height));
      const w = Math.max(1, Math.round(probe.width * k)), h = Math.max(1, Math.round(probe.height * k));
      const c = new OffscreenCanvas(w, h);
      c.getContext('2d')!.drawImage(probe, 0, 0, w, h);
      probe.close();
      const blob = await c.convertToBlob({ type: 'image/webp', quality: 0.88 });
      if (blob.type !== 'image/webp') continue; // navegador sem codificador WebP: mantém o original
      tex.setImage(new Uint8Array(await blob.arrayBuffer())).setMimeType('image/webp');
      if (tex.getURI()) tex.setURI(tex.getURI().replace(/\.(png|jpe?g)$/i, '.webp'));
    } catch {
      /* textura ilegível: mantém a original */
    }
    if (i % 10 === 0) post({ type: 'progress', step: 'Otimizando texturas', value: 0.75 + 0.15 * (i / list.length) });
  }
}

function textureOverrides(zip?: ArrayBuffer) {
  const map = new Map<string, { data: Uint8Array; mimeType: string }>();
  if (!zip) return map;
  const files = unzipSync(new Uint8Array(zip));
  for (const [path, data] of Object.entries(files)) {
    const base = path.split('/').pop() ?? '';
    const ext = base.split('.').pop()?.toLowerCase() ?? '';
    if (!MIME[ext] || !data.length) continue;
    const name = base.replace(/^\d+_/, '').slice(0, -(ext.length + 1)).trim().toLowerCase();
    map.set(name, { data, mimeType: MIME[ext] });
    map.set(name.replace(/\.(jpg|png)$/i, ''), { data, mimeType: MIME[ext] });
  }
  return map;
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  try {
    const { model, textures } = e.data;
    await MeshoptDecoder.ready;
    await MeshoptEncoder.ready;
    const io = new WebIO()
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
    post({ type: 'progress', step: 'Lendo o arquivo', value: 0.05 });
    const doc = await io.readBinary(new Uint8Array(model));
    let triangles = 0;
    for (const m of doc.getRoot().listMeshes())
      for (const p of m.listPrimitives()) triangles += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION')?.getCount() ?? 0) / 3;
    post({ type: 'log', text: `Arquivo lido: ${doc.getRoot().listNodes().length} nós, ${doc.getRoot().listMaterials().length} materiais, ${Math.round(triangles).toLocaleString('pt-BR')} triângulos` });
    const overrides = textureOverrides(textures);
    if (overrides.size) post({ type: 'log', text: `Texturas no .zip: ${overrides.size}` });
    post({ type: 'progress', step: 'Identificando ambientes, portas e materiais', value: 0.15 });
    const meta = await processModel(doc, {
      textureOverrides: overrides,
      hasTransparency,
      compressTextures: async (d) => {
        post({ type: 'progress', step: 'Otimizando texturas', value: 0.75 });
        await compressTextures(d);
        post({ type: 'progress', step: 'Comprimindo geometria', value: 0.9 });
      },
      log: (text) => post({ type: 'log', text }),
    });
    post({ type: 'progress', step: 'Gerando o arquivo final', value: 0.95 });
    const out = await io.writeBinary(doc);
    const glb = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
    post({ type: 'done', glb, meta, stats: { triangles: Math.round(triangles), inputBytes: model.byteLength, outputBytes: glb.byteLength } }, [glb]);
  } catch (err) {
    post({ type: 'error', text: err instanceof Error ? err.message : String(err) });
  }
};
