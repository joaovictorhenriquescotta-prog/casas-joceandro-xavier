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
const Tour = lazy(() => import('./tour/Tour').then((m) => ({ default: m.Tour })));
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
  const preview = new URLSearchParams(location.search).get('modelo');
  // O modelo 3D (~54 MB) só é baixado quando alguém pede o modelo interativo (ou na prévia do painel).
  const want3d = phase === 'carregando' || phase === 'visita' || !!preview;

  useEffect(() => {
    document.title = `${PROJECT.name} · Visita virtual 3D`;
    const shared = readSharedConfig();
    if (shared) useStore.getState().applyMany(shared);
  }, []);

  useEffect(() => {
    if (!want3d) return;
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
  }, [want3d, preview, set, onProgress]);

  useEffect(() => {
    if (phase === 'carregando' && model) set({ phase: 'visita' });
  }, [phase, model, set]);

  // vindo da visita cinematográfica: voa até o ambiente escolhido assim que a cena 3D estiver montada
  useEffect(() => {
    if (phase !== 'visita') return;
    const room = useStore.getState().pendingRoom;
    if (!room) return;
    const t = setTimeout(() => {
      const vps = useStore.getState().viewpoints;
      const vp = vps.find((v) => v.id === room) ?? vps.find((v) => v.room === room);
      useStore.getState().set({ pendingRoom: null, ...(vp ? { flyTo: { ...vp } } : {}) });
    }, 700);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <div className="app">
      {model && (phase === 'visita' || phase === 'carregando') && (
        <Suspense fallback={null}>
          <Experience model={model} />
        </Suspense>
      )}
      {phase === 'visita' && model && <Hud />}
      {phase !== 'visita' && <Intro ready={!!model} error={error} />}
      {phase === 'tour' && (
        <Suspense fallback={<div className="tour-boot" />}>
          <Tour />
        </Suspense>
      )}
    </div>
  );
}
