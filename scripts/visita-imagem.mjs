// Prepara uma imagem para a visita cinematográfica: redimensiona e salva em public/visita/<nome>.webp.
// O arquivo original não é alterado.
//
// Uso:  node scripts/visita-imagem.mjs "<caminho da imagem>" <nome> [largura=3840] [qualidade=80]
// Ex.:  node scripts/visita-imagem.mjs "C:/.../Casa-Joceandro-Sala-8K.png" sala
// Depois, associe o arquivo ao ambiente em src/config/tour.ts (ROOM_SHOTS).
import sharp from 'sharp';
import { mkdirSync, statSync } from 'node:fs';
import path from 'node:path';

const [input, name, width = '3840', quality = '80'] = process.argv.slice(2);
if (!input || !name) {
  console.error('Uso: node scripts/visita-imagem.mjs "<imagem>" <nome> [largura] [qualidade]');
  process.exit(1);
}
const outDir = path.join('public', 'visita');
mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `${name}.webp`);
const info = await sharp(input, { limitInputPixels: false })
  .resize({ width: Number(width), withoutEnlargement: true })
  .webp({ quality: Number(quality), effort: 5 })
  .toFile(out);
console.log(`${out}  ${info.width}x${info.height}  ${Math.round(statSync(out).size / 1024)} KB`);
