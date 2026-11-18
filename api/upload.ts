import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { hasBlob, json, verifyToken } from './_lib.js';

/**
 * Autoriza o envio direto do navegador para o Vercel Blob (arquivos grandes não passam
 * pela função). Só o administrador recebe o token de envio.
 */
export async function POST(req: Request) {
  if (!hasBlob()) return json({ error: 'Conecte um Blob store ao projeto na Vercel (Storage → Blob) e faça um novo deploy.' }, 503);
  const body = (await req.json()) as HandleUploadBody;
  try {
    const res = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const { token } = JSON.parse(clientPayload ?? '{}') as { token?: string };
        if (!verifyToken(token)) throw new Error('Acesso restrito ao administrador.');
        if (!/^modelos\/[\w-]+\/[\w.-]+\.(glb|json)$/.test(pathname)) throw new Error('Caminho inválido.');
        return {
          allowedContentTypes: ['model/gltf-binary', 'application/octet-stream', 'application/json'],
          maximumSizeInBytes: 500 * 1024 * 1024,
          addRandomSuffix: false,
          cacheControlMaxAge: 31536000,
        };
      },
    });
    return json(res);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
}
