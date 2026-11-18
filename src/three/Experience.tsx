import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr, PerformanceMonitor } from '@react-three/drei';
import { EffectComposer, N8AO, Bloom, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { useStore } from '../store';
import type { LoadedModel } from './useModel';
import { Atmosphere } from './Atmosphere';
import { HouseModel } from './HouseModel';
import { Lights } from './Lights';
import { Navigation } from './Navigation';
import { Landscape } from './Landscape';

export function Experience({ model }: { model: LoadedModel }) {
  const quality = useStore((s) => s.quality);
  const { center, radius } = useMemo(() => {
    const b = model.meta.houseBounds;
    const c = new THREE.Vector3((b.min[0] + b.max[0]) / 2, b.min[1], (b.min[2] + b.max[2]) / 2);
    const r = Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]) * 0.85 + 4;
    return { center: c, radius: r };
  }, [model]);
  const first = useStore.getState().viewpoints.find((v) => v.id === 'fachada');

  return (
    <Canvas
      shadows={quality !== 'baixa' ? 'soft' : false}
      dpr={quality === 'alta' ? [1, 2] : quality === 'media' ? [1, 1.5] : [0.75, 1]}
      gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: THREE.NoToneMapping, preserveDrawingBuffer: true }}
      camera={{ fov: 62, near: 0.08, far: 6000, position: first?.position ?? [30, 30, 30] }}
      onCreated={(state) => {
        if (first) state.camera.lookAt(...first.target);
        if (import.meta.env.DEV || location.search.includes('debug')) (window as unknown as Record<string, unknown>).__r3f = state;
      }}
    >
      <PerformanceMonitor
        onDecline={() => {
          const q = useStore.getState().quality;
          if (q === 'alta') useStore.getState().set({ quality: 'media' });
        }}
      />
      <AdaptiveDpr pixelated={false} />
      <Suspense fallback={null}>
        <Atmosphere center={center} radius={radius} />
      </Suspense>
      <HouseModel model={model} />
      <Lights model={model} />
      <Landscape model={model} />
      <Navigation />
      <EffectComposer multisampling={0} enableNormalPass={false}>
        {quality === 'alta' ? <N8AO aoRadius={0.9} distanceFalloff={0.8} intensity={2.2} halfRes quality="medium" /> : <></>}
        <Bloom mipmapBlur intensity={0.55} luminanceThreshold={1.1} luminanceSmoothing={0.25} />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        <Vignette darkness={0.32} offset={0.25} />
        <SMAA />
      </EffectComposer>
    </Canvas>
  );
}
