import { useStore } from '../store';
import { PROJECT } from '../config/project';
import { sharedName } from '../lib/share';
import { useCallback, useState } from 'react';
import { Gallery } from './Gallery';
import { Icon } from './icons';

export function Intro({ ready, error }: { ready: boolean; error: string | null }) {
  const [gallery, setGallery] = useState(false);
  const closeGallery = useCallback(() => setGallery(false), []);
  const phase = useStore((s) => s.phase);
  const progress = useStore((s) => s.progress);
  const set = useStore((s) => s.set);
  const shared = sharedName();
  const loading = phase === 'carregando';

  return (
    <div className="intro">
      <div className="intro-bg" style={{ backgroundImage: 'url(/hero.jpg)' }} />
      <div className="intro-shade" />
      <div className="intro-content">
        <p className="eyebrow">Visita virtual 3D</p>
        <h1>{PROJECT.name}</h1>
        <p className="intro-sub">{PROJECT.tagline}</p>
        <p className="intro-loc">{PROJECT.location}</p>
        {shared && <p className="intro-shared">Configuração personalizada: <strong>{shared}</strong></p>}
        {error ? (
          <p className="intro-error">Não foi possível carregar o modelo 3D. {error}</p>
        ) : (
          <div className="intro-actions">
            <button className="btn-primary" onClick={() => set({ phase: 'carregando' })} disabled={loading && !ready}>
              {loading && !ready ? `Carregando ${Math.round(progress * 100)}%` : 'Iniciar visita'}
            </button>
            <button className="btn-secondary" onClick={() => setGallery(true)}>
              <Icon.images /> Ver imagens
            </button>
          </div>
        )}
        <div className="intro-progress" aria-hidden>
          <span style={{ transform: `scaleX(${ready ? 1 : progress})` }} />
        </div>
        <p className="intro-hint">Funciona no navegador do celular, tablet ou computador. Não é preciso instalar nada.</p>
      </div>
      {gallery && <Gallery onClose={closeGallery} />}
    </div>
  );
}
