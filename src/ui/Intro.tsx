import { useStore } from '../store';
import { PROJECT } from '../config/project';
import { sharedName } from '../lib/share';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { FACADE_COLORS } from '../config/facadeColors';
import { Gallery } from './Gallery';
import { Icon } from './icons';

const colorById = (id: string) => FACADE_COLORS.find((c) => c.id === id) ?? FACADE_COLORS[0];

export function Intro({ ready, error }: { ready: boolean; error: string | null }) {
  const [gallery, setGallery] = useState(false);
  const closeGallery = useCallback(() => setGallery(false), []);
  // cores da fachada: troca a imagem de fundo por renders com o mesmo enquadramento
  const [palette, setPalette] = useState(false);
  const [colorId, setColorId] = useState('original');
  const [loadingColor, setLoadingColor] = useState<string | null>(null);
  const [layers, setLayers] = useState<string[]>(['original']); // a última fica por cima (aparece com transição)
  const wanted = useRef('original');
  const pickColor = (id: string) => {
    wanted.current = id;
    setColorId(id);
    setLoadingColor(id);
    const img = new Image();
    const done = () => {
      if (wanted.current !== id) return;
      setLoadingColor(null);
      setLayers((l) => [...l.filter((x) => x !== id), id].slice(-3));
    };
    img.onload = done;
    img.onerror = done;
    img.src = colorById(id).image;
  };
  useEffect(() => {
    if (palette) FACADE_COLORS.forEach((c) => { new Image().src = c.image; }); // troca imediata depois
  }, [palette]);

  const phase = useStore((s) => s.phase);
  const progress = useStore((s) => s.progress);
  const set = useStore((s) => s.set);
  const shared = sharedName();
  const loading3d = phase === 'carregando';
  // prévia do painel administrativo (?modelo=): o botão principal continua abrindo o modelo 3D
  const adminPreview = new URLSearchParams(location.search).has('modelo');
  const open3d = () => set({ phase: 'carregando' });
  const current = colorById(colorId);

  return (
    <div className="intro">
      <div className="intro-bg">
        {layers.map((id) => (
          <div key={id} className="intro-bg-layer" style={{ backgroundImage: `url(${colorById(id).image})` }} />
        ))}
      </div>
      <div className="intro-shade" />
      <div className="intro-content">
        <p className="eyebrow">Visita virtual</p>
        <h1>{PROJECT.name}</h1>
        <p className="intro-sub">{PROJECT.tagline}</p>
        <p className="intro-loc">{PROJECT.location}</p>
        {shared && <p className="intro-shared">Configuração personalizada: <strong>{shared}</strong></p>}
        <div className="intro-actions">
          <button
            className="btn-primary"
            onClick={adminPreview ? open3d : () => set({ phase: 'tour' })}
            disabled={adminPreview && loading3d && !ready}
          >
            {adminPreview && loading3d && !ready ? `Carregando ${Math.round(progress * 100)}%` : 'Iniciar visita'}
          </button>
          <button className="btn-secondary" onClick={() => setGallery(true)}>
            <Icon.images /> Ver imagens
          </button>
          <button
            className={'btn-secondary' + (palette ? ' on' : '')}
            onClick={() => setPalette((p) => !p)}
            aria-expanded={palette}
            aria-controls="intro-palette"
          >
            <Icon.palette /> Cores da fachada
          </button>
        </div>
        {palette && (
          <div className="intro-palette" id="intro-palette">
            <div className="intro-palette-swatches" role="radiogroup" aria-label="Cores da fachada">
              {FACADE_COLORS.map((c) => (
                <button
                  key={c.id}
                  role="radio"
                  aria-checked={c.id === colorId}
                  aria-label={c.name}
                  title={c.name}
                  className={'swatch' + (c.id === colorId ? ' on' : '') + (loadingColor === c.id ? ' busy' : '')}
                  style={{ '--sw': c.color } as CSSProperties}
                  onClick={() => pickColor(c.id)}
                />
              ))}
            </div>
            <p className="intro-palette-name">
              <strong>{current.name}</strong>
              <span>Opções de cores do projeto · imagens ilustrativas</span>
            </p>
          </div>
        )}
        {error && loading3d ? (
          <p className="intro-error">Não foi possível carregar o modelo 3D. {error}</p>
        ) : (
          !adminPreview && (
            <button className="intro-3d" onClick={open3d} disabled={loading3d}>
              {loading3d
                ? `Carregando o modelo 3D… ${Math.round(progress * 100)}%`
                : shared ? 'Ver sua configuração no modelo 3D interativo →' : 'Explorar o modelo 3D interativo →'}
            </button>
          )
        )}
        {loading3d && (
          <div className="intro-progress" aria-hidden>
            <span style={{ transform: `scaleX(${ready ? 1 : progress})` }} />
          </div>
        )}
        <p className="intro-hint">Funciona no navegador do celular, tablet ou computador. Não é preciso instalar nada.</p>
      </div>
      {gallery && <Gallery onClose={closeGallery} />}
    </div>
  );
}
