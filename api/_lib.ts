/*
 * Funções da Vercel (pasta /api). Guardam o manifesto de versões do modelo e as
 * configurações salvas no Vercel Blob. Variáveis de ambiente necessárias:
 *   BLOB_READ_WRITE_TOKEN  (criada ao conectar um Blob store ao projeto)
 *   ADMIN_PASSWORD         (senha do painel administrativo)
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { list, put } from '@vercel/blob';

export interface ModelVersion {
  id: string;
  url: string;
  fileName: string;
  createdAt: string;
  status: 'publicado' | 'previa' | 'arquivado';
  sizeBytes?: number;
  notes?: string;
  stats?: Record<string, number>;
}
export interface Manifest {
  current: string;
  versions: ModelVersion[];
  updatedAt?: string;
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/** Senha configurada na Vercel, sem espaços ou quebras de linha coladas sem querer. */
const adminPassword = () => (process.env.ADMIN_PASSWORD ?? '').trim();

const secret = () => {
  const p = adminPassword();
  if (!p) throw new Error('ADMIN_PASSWORD não configurada na Vercel');
  return `${p}:${process.env.ADMIN_SECRET ?? 'cjx'}`;
};

/** Token assinado com validade (12 h), sem banco de dados. */
export function issueToken() {
  const exp = Date.now() + 12 * 3600 * 1000;
  const sig = createHmac('sha256', secret()).update(String(exp)).digest('hex');
  return `${exp}.${sig}`;
}

export function checkPassword(pw: unknown) {
  if (typeof pw !== 'string') return false;
  const a = Buffer.from(pw.trim()), b = Buffer.from(adminPassword());
  return a.length === b.length && b.length > 0 && timingSafeEqual(a, b);
}

export function verifyToken(token: string | null | undefined) {
  if (!token) return false;
  const [exp, sig] = token.replace(/^Bearer\s+/i, '').split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const good = createHmac('sha256', secret()).update(exp).digest('hex');
  return good.length === sig.length && timingSafeEqual(Buffer.from(good), Buffer.from(sig));
}

export const isAdmin = (req: Request) => verifyToken(req.headers.get('authorization'));

/**
 * Cada alteração grava um manifesto novo (manifests/<data>.json); o mais recente vale.
 * Assim nenhuma versão anterior se perde e não há problema de cache de CDN.
 */
export async function readManifest(): Promise<Manifest | null> {
  const { blobs } = await list({ prefix: 'manifests/', limit: 1000 });
  if (!blobs.length) return null;
  blobs.sort((a, b) => b.pathname.localeCompare(a.pathname));
  const r = await fetch(blobs[0].url, { cache: 'no-store' });
  return r.ok ? ((await r.json()) as Manifest) : null;
}

export async function writeManifest(m: Manifest) {
  m.updatedAt = new Date().toISOString();
  const name = `manifests/${m.updatedAt.replace(/[:.]/g, '-')}.json`;
  await put(name, JSON.stringify(m, null, 2), { access: 'public', contentType: 'application/json', addRandomSuffix: false, cacheControlMaxAge: 60 });
  return m;
}

/** Manifesto inicial: o modelo que acompanha o código (public/models). */
export async function initialManifest(origin: string): Promise<Manifest> {
  try {
    const r = await fetch(new URL('/models/manifest.json', origin), { cache: 'no-store' });
    if (r.ok) return (await r.json()) as Manifest;
  } catch {
    /* ignora */
  }
  return { current: '', versions: [] };
}
