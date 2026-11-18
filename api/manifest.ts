import { del } from '@vercel/blob';
import { hasBlob, initialManifest, isAdmin, json, readManifest, writeManifest, type ModelVersion } from './_lib.js';

/** Manifesto público das versões do modelo (a visita lê daqui). */
export async function GET(req: Request) {
  try {
    const m = (await readManifest()) ?? (await initialManifest(new URL(req.url).origin));
    return json(m);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}

type Action =
  | { action: 'add'; version: ModelVersion }
  | { action: 'publish'; id: string }
  | { action: 'archive'; id: string }
  | { action: 'delete'; id: string };

/** Operações do painel administrativo (exigem login). */
export async function POST(req: Request) {
  if (!isAdmin(req)) return json({ error: 'Acesso restrito ao administrador.' }, 401);
  if (!hasBlob()) return json({ error: 'Conecte um Blob store ao projeto na Vercel (Storage → Blob) e faça um novo deploy.' }, 503);
  const a = (await req.json()) as Action;
  const m = (await readManifest()) ?? (await initialManifest(new URL(req.url).origin));
  const find = (id: string) => m.versions.find((v) => v.id === id);
  switch (a.action) {
    case 'add': {
      if (find(a.version.id)) return json({ error: 'Versão já existe.' }, 409);
      // nova versão entra como prévia: só vai ao ar depois da confirmação
      m.versions.unshift({ ...a.version, status: 'previa', createdAt: new Date().toISOString() });
      break;
    }
    case 'publish': {
      const v = find(a.id);
      if (!v) return json({ error: 'Versão não encontrada.' }, 404);
      for (const o of m.versions) if (o.status === 'publicado') o.status = 'arquivado';
      v.status = 'publicado';
      m.current = v.id;
      break;
    }
    case 'archive': {
      const v = find(a.id);
      if (!v || v.id === m.current) return json({ error: 'A versão publicada não pode ser arquivada.' }, 400);
      v.status = 'arquivado';
      break;
    }
    case 'delete': {
      const v = find(a.id);
      if (!v || v.status !== 'previa') return json({ error: 'Só prévias não publicadas podem ser excluídas.' }, 400);
      m.versions = m.versions.filter((x) => x.id !== a.id);
      if (v.url.includes('.blob.vercel-storage.com')) await del(v.url).catch(() => {});
      break;
    }
    default:
      return json({ error: 'Ação inválida.' }, 400);
  }
  return json(await writeManifest(m));
}
