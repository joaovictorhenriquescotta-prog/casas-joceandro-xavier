export interface ModelVersion {
  id: string;
  url: string;
  fileName: string;
  createdAt: string;
  status: 'publicado' | 'previa' | 'arquivado';
  sizeBytes?: number;
  notes?: string;
  stats?: { rooms: number; doors: number; materials: number };
}

export interface Manifest {
  current: string;
  versions: ModelVersion[];
}

/** Manifesto das versões do modelo: primeiro o do servidor (Vercel Blob), senão o estático. */
export async function fetchManifest(): Promise<Manifest> {
  try {
    const r = await fetch('/api/manifest', { cache: 'no-store' });
    if (r.ok) {
      const m = (await r.json()) as Manifest;
      if (m?.versions?.length) return m;
    }
  } catch {
    /* sem servidor: usa o manifesto estático */
  }
  const r = await fetch('/models/manifest.json', { cache: 'no-store' });
  return r.json();
}
