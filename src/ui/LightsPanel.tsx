import { useStore } from '../store';
import { lighting } from '../three/runtime';
import { Icon } from './icons';

export function LightsPanel() {
  const lights = useStore((s) => s.lights);
  const toggle = useStore((s) => s.toggleLight);
  const setAll = useStore((s) => s.setAllLights);
  const set = useStore((s) => s.set);
  const circuits = [...lighting.circuits.values()];
  const groups = [...new Set(circuits.map((c) => c.group))];
  const anyOn = Object.values(lights).some(Boolean);
  const setGroup = (g: string, on: boolean) => {
    for (const c of circuits.filter((c) => c.group === g)) toggle(c.id, on);
  };
  return (
    <aside className="panel panel-left" aria-label="Iluminação">
      <div className="panel-head">
        <h2>Iluminação</h2>
        <button className="icon-btn" onClick={() => set({ panel: null })} aria-label="Fechar"><Icon.close /></button>
      </div>
      <div className="panel-body">
        <button className="btn-wide" onClick={() => setAll(!anyOn)}>{anyOn ? 'Apagar todas as luzes' : 'Acender todas as luzes'}</button>
        {groups.map((g) => {
          const list = circuits.filter((c) => c.group === g);
          const on = list.some((c) => lights[c.id]);
          return (
            <section key={g} className="room-group">
              <h3>
                {g}
                <button className="link" onClick={() => setGroup(g, !on)}>{on ? 'apagar' : 'acender'} todas</button>
              </h3>
              {list.map((c) => (
                <label key={c.id} className="switch-row">
                  <span>{c.label}</span>
                  <input type="checkbox" role="switch" checked={!!lights[c.id]} onChange={() => toggle(c.id)} />
                  <i className="switch" aria-hidden />
                </label>
              ))}
            </section>
          );
        })}
        <p className="note">As luzes internas foram posicionadas no teto de cada ambiente, já que o modelo não traz as luminárias internas desenhadas, exceto os painéis da sala.</p>
      </div>
    </aside>
  );
}
