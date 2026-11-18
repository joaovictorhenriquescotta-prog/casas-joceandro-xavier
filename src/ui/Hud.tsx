import { useEffect, useState } from 'react';
import { useStore, type TimeOfDay } from '../store';
import { Icon } from './icons';
import { PROJECT } from '../config/project';
import { RoomsPanel } from './RoomsPanel';
import { LightsPanel } from './LightsPanel';
import { CustomizePanel } from './CustomizePanel';
import { InfoPanel } from './InfoPanel';
import { Joystick } from './Joystick';
import { Minimap } from './Minimap';
import { cameraState } from '../three/runtime';
import { houseLabel } from '../three/rooms';

const TIMES: { id: TimeOfDay; label: string; icon: () => React.ReactNode }[] = [
  { id: 'manha', label: 'Manhã', icon: Icon.sun },
  { id: 'tarde', label: 'Tarde', icon: Icon.sunset },
  { id: 'noite', label: 'Noite', icon: Icon.moon },
];

export function Hud() {
  const s = useStore();
  const room = s.meta?.rooms.find((r) => r.id === s.currentRoom);
  const [hint, setHint] = useState(true);
  const touch = typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches;

  // tecla E abre a porta mais próxima; Esc fecha painéis
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const st = useStore.getState();
      if (e.key === 'Escape') st.set({ panel: null });
      if (e.key.toLowerCase() === 'e' && st.mode === 'caminhar' && st.meta) {
        const f = cameraState.feet;
        let best: string | null = null, bd = 2.2;
        for (const d of st.meta.doors) {
          const dist = Math.hypot(d.hinge[0] - f.x, d.hinge[2] - f.z);
          if (dist < bd) { bd = dist; best = d.id; }
        }
        if (best) st.toggleDoor(best);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setHint(false), 9000);
    return () => clearTimeout(t);
  }, [s.mode]);

  const goHome = () => {
    const vp = s.viewpoints.find((v) => v.id === 'fachada');
    if (vp) s.set({ flyTo: { ...vp }, panel: null });
  };
  const fullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  };
  const toggle = (p: NonNullable<typeof s.panel>) => s.set({ panel: s.panel === p ? null : p });

  return (
    <div className="hud">
      <header className="topbar">
        <button className="brand" onClick={goHome} title="Voltar à fachada">
          <span className="brand-name">{PROJECT.name}</span>
          <span className="brand-sub">Visita virtual</span>
        </button>
        <div className="where" aria-live="polite">
          {room ? (
            <>
              <span className="where-house">{houseLabel(s.meta!, room.house)}</span>
              <span className="where-room">{room.label}</span>
            </>
          ) : (
            <span className="where-room">{s.mode === 'orbita' ? 'Vista externa' : 'Área externa'}</span>
          )}
        </div>
        <div className="topbar-actions">
          <button className="icon-btn" onClick={() => toggle('info')} title="Informações do empreendimento"><Icon.info /></button>
          <button className="icon-btn" onClick={() => toggle('ajuda')} title="Como navegar"><Icon.help /></button>
          <button className="icon-btn" onClick={fullscreen} title="Tela cheia"><Icon.full /></button>
        </div>
      </header>

      <nav className="dock" aria-label="Controles da visita">
        <button className={`dock-btn ${s.panel === 'ambientes' ? 'on' : ''}`} onClick={() => toggle('ambientes')}>
          <Icon.rooms /><span>Ambientes</span>
        </button>
        <div className="seg" role="group" aria-label="Período do dia">
          {TIMES.map((t) => (
            <button key={t.id} className={s.time === t.id ? 'on' : ''} onClick={() => s.setTime(t.id)} title={t.label}>
              <t.icon /><span>{t.label}</span>
            </button>
          ))}
        </div>
        <button className={`dock-btn ${s.panel === 'luzes' ? 'on' : ''}`} onClick={() => toggle('luzes')}>
          <Icon.bulb /><span>Luzes</span>
        </button>
        <button className={`dock-btn accent ${s.panel === 'personalizar' ? 'on' : ''}`} onClick={() => toggle('personalizar')}>
          <Icon.palette /><span>Personalize</span>
        </button>
        <div className="seg" role="group" aria-label="Modo de navegação">
          <button className={s.mode === 'orbita' ? 'on' : ''} onClick={() => s.set({ mode: 'orbita' })} title="Girar ao redor">
            <Icon.orbit /><span>Explorar</span>
          </button>
          <button className={s.mode === 'caminhar' ? 'on' : ''} onClick={() => s.set({ mode: 'caminhar' })} title="Caminhar pela casa">
            <Icon.walk /><span>Caminhar</span>
          </button>
        </div>
        <button className="dock-btn" onClick={goHome} title="Voltar à fachada">
          <Icon.home /><span>Fachada</span>
        </button>
      </nav>

      {s.mode === 'caminhar' && (
        <>
          <div className="height-ctl" title="Altura do olhar">
            <span>Altura</span>
            <input type="range" min={1.1} max={1.9} step={0.05} value={s.eyeHeight} onChange={(e) => s.set({ eyeHeight: +e.target.value })} aria-label="Altura da câmera" />
            <span>{s.eyeHeight.toFixed(2).replace('.', ',')} m</span>
          </div>
          <Minimap />
          {touch && <Joystick />}
        </>
      )}
      {s.mode === 'orbita' && (
        <button className={`chip cut ${s.cutaway ? 'on' : ''}`} onClick={() => s.set({ cutaway: !s.cutaway })}>
          <Icon.layers /> {s.cutaway ? 'Mostrar cobertura' : 'Ver por dentro (sem laje)'}
        </button>
      )}

      {hint && !s.panel && (
        <div className="hint" onClick={() => setHint(false)}>
          {s.mode === 'caminhar'
            ? touch
              ? 'Use o controle à esquerda para andar e arraste à direita para olhar. Toque nas portas para abrir.'
              : 'Arraste para olhar · W A S D ou setas para andar · Shift corre · clique nas portas ou tecle E'
            : touch
              ? 'Arraste para girar, use dois dedos para aproximar. Escolha um ambiente para entrar.'
              : 'Arraste para girar, role para aproximar, botão direito para deslocar. Escolha um ambiente para entrar.'}
        </div>
      )}

      {s.panel === 'ambientes' && <RoomsPanel />}
      {s.panel === 'luzes' && <LightsPanel />}
      {s.panel === 'personalizar' && <CustomizePanel />}
      {(s.panel === 'info' || s.panel === 'ajuda') && <InfoPanel tab={s.panel} />}
      {s.showOriginal && <div className="badge-original">Exibindo acabamentos originais do projeto</div>}
    </div>
  );
}
