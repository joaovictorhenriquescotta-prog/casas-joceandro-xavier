import { useStore } from '../store';
import { Icon } from './icons';

export function RoomsPanel() {
  const viewpoints = useStore((s) => s.viewpoints);
  const set = useStore((s) => s.set);
  const groups = [...new Set(viewpoints.map((v) => v.group))];
  return (
    <aside className="panel panel-left" aria-label="Ambientes">
      <div className="panel-head">
        <h2>Ambientes</h2>
        <button className="icon-btn" onClick={() => set({ panel: null })} aria-label="Fechar"><Icon.close /></button>
      </div>
      <div className="panel-body">
        {groups.map((g) => (
          <section key={g} className="room-group">
            <h3>{g}</h3>
            <div className="room-list">
              {viewpoints.filter((v) => v.group === g).map((v) => (
                <button
                  key={v.id}
                  className="room-btn"
                  onClick={() => {
                    set({ flyTo: { ...v }, panel: matchMedia('(max-width: 720px)').matches ? null : 'ambientes', cutaway: v.id === 'aerea' });
                  }}
                >
                  <span>{v.label}</span>
                  <small>{v.mode === 'caminhar' ? 'entrar' : 'ver'}</small>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}
