import { put, list } from '@vercel/blob';
import { randomBytes } from 'node:crypto';
import { json } from './_lib';

/** Configurações de personalização salvas pelos clientes (link curto). */
export async function POST(req: Request) {
  const text = await req.text();
  if (text.length > 20000) return json({ error: 'Configuração grande demais.' }, 413);
  try {
    JSON.parse(text);
  } catch {
    return json({ error: 'JSON inválido.' }, 400);
  }
  const id = randomBytes(6).toString('base64url');
  await put(`configs/${id}.json`, text, { access: 'public', contentType: 'application/json', addRandomSuffix: false });
  return json({ id });
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!/^[\w-]{4,20}$/.test(id)) return json({ error: 'id inválido' }, 400);
  const { blobs } = await list({ prefix: `configs/${id}.json`, limit: 1 });
  if (!blobs.length) return json({ error: 'não encontrada' }, 404);
  const r = await fetch(blobs[0].url);
  return new Response(await r.text(), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' } });
}
