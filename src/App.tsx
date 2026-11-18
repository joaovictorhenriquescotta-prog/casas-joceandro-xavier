import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useStore } from './store';
import { loadModel, type LoadedModel } from './three/useModel';
import { buildViewpoints, cachedViewpoints } from './three/rooms';
import { fetchManifest } from './lib/manifest';
import { readSharedConfig } from './lib/share';
import { Intro } from './ui/Intro';
import { Hud } from './ui/Hud';
import { PROJECT } from './config/project';

const Experience = lazy(() => import('./three/Experience').then((m) => ({ default: m.Experience })));
const Admin = lazy(() => import('./admin/Admin').then((m) => ({ default: m.Admin })));

export default function App() {
  if (location.pathname.startsWith('/admin')) {
    return (
      <Suspense fallback={<div className="loading-screen">Carregando…</div>}>
        <Admin />
      </Suspense>
    );
  }
  return <Visit />;
}

function Visit() {
  const phase = useStore((s) => s.phase);
  const set = useStore((s) => s.set);
  const [model, setModel] = useState<LoadedModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onProgress = useCallback((p: number) => set({ progress: p }), [set]);

  useEffect(() => {
    document.title = `${PROJECT.name} · Visita virtual 3D`;
    const shared = readSharedConfig();
    if (shared) useStore.getState().applyMany(shared);
    const preview = new URLSearchParams(location.search).get('modelo');
    fetchManifest()
      .then((m) => {
        const url = preview ?? m.versions.find((v) => v.id === m.current)?.url ?? m.versions[0].url;
        set({ modelUrl: url, modelVersion: m.current });
        return loadModel(url, onProgress);
      })
      .then((m) => {
        set({ meta: m.meta, viewpoints: cachedViewpoints(useStore.getState().modelUrl, m.meta.generatedAt) ?? buildViewpoints(m.meta) });
        setModel(m);
      })
      .catch((e) => setError(String(e?.message ?? e)));
  }, [set, onProgress]);

  useEffect(() => {
    if (phase === 'carregando' && model) set({ phase: 'visita' });
  }, [phase, model, set]);

  return (
    <div className="app">
      {model && (phase === 'visita' || phase === 'carregando') && (
        <Suspense fallback={null}>
          <Experience model={model} />
        </Suspense>
      )}
      {phase === 'visita' && model && <Hud />}
      {phase !== 'visita' && <Intro ready={!!model} error={error} />}
    </div>
  );
}
