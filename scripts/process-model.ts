/*
 * Processa o GLB exportado do SketchUp para a visita virtual.
 *
 *   npx tsx scripts/process-model.ts <entrada.glb> [pasta-de-texturas] [saida.glb]
 *
 * Gera um GLB otimizado com os metadados da visita embutidos.
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { textureCompress } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { processModel } from '../src/pipeline/process';

const [input, texDir, output = 'public/models/v7/model.glb'] = process.argv.slice(2);
if (!input) {
  console.error('uso: tsx scripts/process-model.ts <entrada.glb> [pasta-de-texturas] [saida.glb]');
  process.exit(1);
}

const MIME: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.bmp': 'image/bmp' };

async function main() {
  await MeshoptDecoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  console.time('leitura');
  const doc = await io.read(input);
  console.timeEnd('leitura');

  const overrides = new Map<string, { data: Uint8Array; mimeType: string }>();
  if (texDir) {
    for (const f of readdirSync(texDir)) {
      const ext = extname(f).toLowerCase();
      if (!MIME[ext]) continue;
      let name = f.replace(/^\d+_/, '').slice(0, -ext.length);
      let data: Uint8Array = readFileSync(join(texDir, f));
      let mimeType = MIME[ext];
      if (ext === '.bmp') continue; // formato não suportado no glTF
      overrides.set(name.trim().toLowerCase(), { data, mimeType });
      if (/\.(jpg|png)$/i.test(name)) overrides.set(name.replace(/\.(jpg|png)$/i, '').trim().toLowerCase(), { data, mimeType });
    }
    console.log(`texturas disponíveis: ${overrides.size}`);
  }

  console.time('processamento');
  const meta = await processModel(doc, {
    textureOverrides: overrides,
    textureStats: async (data) => {
      try {
        const st = await sharp(Buffer.from(data), { limitInputPixels: false }).resize(64, 64, { fit: 'fill' }).removeAlpha().stats();
        const [r, g, b] = st.channels;
        return { mean: [r.mean / 255, g.mean / 255, b.mean / 255], std: Math.max(r.stdev, g.stdev, b.stdev) / 255 };
      } catch { return null; }
    },
    hasTransparency: async (data) => {
      try {
        const img = sharp(data);
        const m = await img.metadata();
        if (!m.hasAlpha) return false;
        const st = await img.stats();
        return st.channels[3] ? st.channels[3].min < 250 : false;
      } catch {
        return false;
      }
    },
    compressTextures: async (d) => {
      await d.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [2048, 2048], quality: 88 }));
    },
    log: (m) => console.log('•', m),
  });
  console.timeEnd('processamento');

  mkdirSync(dirname(output), { recursive: true });
  await io.write(output, doc);
  writeFileSync(output.replace(/\.glb$/, '.meta.json'), JSON.stringify(meta, null, 2));
  console.log(`salvo em ${output}`);
  console.log(`ambientes: ${meta.rooms.length}, portas: ${meta.doors.length}, luminárias: ${meta.fixtures.length}, LEDs: ${meta.leds.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
