import type { Customization } from '../store';

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

export interface SavedConfig {
  id: string;
  name: string;
  client?: string;
  createdAt: string;
  custom: Customization;
}

export function shareUrl(custom: Customization, name?: string) {
  const u = new URL(location.origin + '/');
  u.searchParams.set('c', b64(JSON.stringify({ n: name ?? '', c: custom })));
  return u.toString();
}

export function readSharedConfig(): Customization | null {
  const p = new URLSearchParams(location.search).get('c');
  if (!p) return null;
  try {
    const v = JSON.parse(unb64(p));
    return v?.c ?? null;
  } catch {
    return null;
  }
}

export function sharedName(): string | null {
  const p = new URLSearchParams(location.search).get('c');
  if (!p) return null;
  try {
    return JSON.parse(unb64(p))?.n || null;
  } catch {
    return null;
  }
}

const KEY = 'cjx-configuracoes';
export function listSaved(): SavedConfig[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}
export function saveConfig(c: SavedConfig) {
  try {
    localStorage.setItem(KEY, JSON.stringify([c, ...listSaved().filter((x) => x.id !== c.id)].slice(0, 30)));
  } catch {
    /* armazenamento indisponível */
  }
}
export function deleteSaved(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(listSaved().filter((x) => x.id !== id)));
  } catch {
    /* */
  }
}

/** Registra a configuração no servidor para o corretor (se o servidor existir). */
export async function registerConfig(c: SavedConfig): Promise<string | null> {
  try {
    const r = await fetch('/api/configs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(c) });
    if (!r.ok) return null;
    return (await r.json()).id ?? null;
  } catch {
    return null;
  }
}
