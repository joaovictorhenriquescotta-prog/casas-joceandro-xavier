import { useMemo, useState } from 'react';
import { useStore, type Customization } from '../store';
import { Icon } from './icons';
import { CATEGORIES, COLOR_ELEMENTS, FINISHES, PALETTES, SWATCHES, finishById, type CategoryId } from '../config/finishes';
import { finishThumb } from '../textures/procedural';
import { listTargets } from '../three/customize';
import { houseLabel } from '../three/rooms';
import { PROJECT } from '../config/project';
import { deleteSaved, listSaved, registerConfig, saveConfig, shareUrl, type SavedConfig } from '../lib/share';

type Tab = 'pisos' | 'paredes' | 'cores' | 'paletas' | 'salvar';

export function CustomizePanel() {
  const meta = useStore((s) => s.meta)!;
  const custom = useStore((s) => s.custom);
  const preview = useStore((s) => s.preview);
  const set = useStore((s) => s.set);
  const showOriginal = useStore((s) => s.showOriginal);
  const history = useStore((s) => s.history);
  const currentRoom = useStore((s) => s.currentRoom);
  const [tab, setTab] = useState<Tab>('pisos');
  const targets = useMemo(() => listTargets(meta), [meta]);
  const [house, setHouse] = useState(meta.rooms.find((r) => r.id === currentRoom)?.house ?? meta.houses[0].id);
  const [room, setRoom] = useState<string>(currentRoom ?? meta.rooms.find((r) => r.house === house && r.type === 'estar')!.id);
  const [scope, setScope] = useState<'ambiente' | 'casa' | 'tudo'>('ambiente');

  const merged = { ...custom, ...(preview ?? {}) };
  const roomsOfHouse = meta.rooms.filter((r) => r.house === house);

  const keysFor = (kind: 'piso' | 'parede') => {
    const map = kind === 'piso' ? targets.floors : targets.walls;
    const list = scope === 'tudo' ? meta.rooms : scope === 'casa' ? roomsOfHouse : meta.rooms.filter((r) => r.id === room);
    return list.filter((r) => map.has(r.id)).map((r) => `${kind}:${r.id}`);
  };
  const doPreview = (entries: Customization) => set({ preview: entries, showOriginal: false });
  const commit = () => {
    if (!preview) return;
    const st = useStore.getState();
    const clean: Customization = {};
    const removed: string[] = [];
    for (const [k, v] of Object.entries(preview)) (v ? (clean[k] = v) : removed.push(k));
    st.applyMany(clean);
    for (const k of removed) st.applyCustom(k, null);
  };

  return (
    <aside className="panel panel-right customize" aria-label="Personalize sua casa">
      <div className="panel-head">
        <div>
          <h2>Personalize sua casa</h2>
          <p className="panel-sub">Experimente acabamentos e cores em tempo real</p>
        </div>
        <button className="icon-btn" onClick={() => set({ panel: null, preview: null })} aria-label="Fechar"><Icon.close /></button>
      </div>

      <div className="tabs" role="tablist">
        {([['pisos', 'Pisos'], ['paredes', 'Paredes'], ['cores', 'Cores'], ['paletas', 'Paletas'], ['salvar', 'Salvar']] as [Tab, string][]).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => { setTab(id); set({ preview: null }); }}>{label}</button>
        ))}
      </div>

      <div className="panel-body">
        {(tab === 'pisos' || tab === 'paredes') && (
          <div className="target-pick">
            <div className="seg small">
              {meta.houses.map((h) => (
                <button key={h.id} className={house === h.id ? 'on' : ''} onClick={() => { setHouse(h.id); setRoom(meta.rooms.find((r) => r.house === h.id && r.type === 'estar')!.id); }}>{h.label}</button>
              ))}
            </div>
            <div className="chips">
              {roomsOfHouse.filter((r) => (tab === 'pisos' ? targets.floors : targets.walls).has(r.id)).map((r) => (
                <button key={r.id} className={`chip ${scope === 'ambiente' && room === r.id ? 'on' : ''}`} onClick={() => { setRoom(r.id); setScope('ambiente'); }}>{r.label}</button>
              ))}
              <button className={`chip ${scope === 'casa' ? 'on' : ''}`} onClick={() => setScope('casa')}>Toda a {houseLabel(meta, house).toLowerCase()}</button>
              <button className={`chip ${scope === 'tudo' ? 'on' : ''}`} onClick={() => setScope('tudo')}>As duas casas</button>
            </div>
          </div>
        )}

        {tab === 'pisos' && <FinishLibrary kind="piso" current={merged[keysFor('piso')[0]]} onPick={(id) => doPreview(Object.fromEntries(keysFor('piso').map((k) => [k, id])))} />}

        {tab === 'paredes' && (
          <>
            <h4>Pintura</h4>
            <ColorPicker
              current={merged[keysFor('parede')[0]]}
              onPick={(c) => doPreview(Object.fromEntries(keysFor('parede').map((k) => [k, c])))}
            />
            <h4>Revestimentos de parede</h4>
            <p className="note">Indicado para banheiros e cozinha. A peça é aplicada em todas as paredes do ambiente escolhido.</p>
            <FinishLibrary kind="parede" current={merged[keysFor('parede')[0]]} onPick={(id) => doPreview(Object.fromEntries(keysFor('parede').map((k) => [k, id])))} />
          </>
        )}

        {tab === 'cores' && <ElementColors targets={targets.elements} merged={merged} onPick={doPreview} />}

        {tab === 'paletas' && (
          <div className="palettes">
            {PALETTES.map((p) => {
              const entries = Object.fromEntries(Object.entries(p.colors).filter(([el]) => targets.elements.has(el)).map(([el, c]) => [`el:${el}`, c!]));
              const active = Object.entries(entries).every(([k, v]) => merged[k] === v);
              return (
                <button key={p.id} className={`palette ${active ? 'on' : ''}`} onClick={() => doPreview(entries)}>
                  <span className="swatches">{p.swatches.map((c) => <i key={c} style={{ background: c }} />)}</span>
                  <strong>{p.name}</strong>
                  <small>{p.description}</small>
                </button>
              );
            })}
          </div>
        )}

        {tab === 'salvar' && <SavePanel />}

        <p className="disclaimer">{PROJECT.disclaimer}</p>
      </div>

      <div className="panel-foot">
        {preview ? (
          <>
            <button className="btn-ghost" onClick={() => set({ preview: null })}>Cancelar</button>
            <button className="btn-primary small" onClick={commit}>Aplicar</button>
          </>
        ) : (
          <>
            <button className="icon-btn labeled" onClick={() => useStore.getState().undo()} disabled={!history.length} title="Desfazer"><Icon.undo /><span>Desfazer</span></button>
            <button className={`icon-btn labeled ${showOriginal ? 'on' : ''}`} onClick={() => set({ showOriginal: !showOriginal })} disabled={!Object.keys(custom).length} title="Comparar com o original">
              <Icon.compare /><span>{showOriginal ? 'Ver personalizado' : 'Ver original'}</span>
            </button>
            <button className="icon-btn labeled" onClick={() => useStore.getState().resetCustom()} disabled={!Object.keys(custom).length} title="Restaurar projeto original"><Icon.reset /><span>Restaurar</span></button>
          </>
        )}
      </div>
    </aside>
  );
}

function FinishLibrary({ kind, current, onPick }: { kind: 'piso' | 'parede'; current?: string; onPick: (id: string) => void }) {
  const cats = CATEGORIES.filter((c) => FINISHES.some((f) => f.category === c.id && f.use.includes(kind)));
  const [cat, setCat] = useState<CategoryId | 'todos'>('todos');
  const list = FINISHES.filter((f) => f.use.includes(kind) && (cat === 'todos' || f.category === cat));
  return (
    <>
      <div className="chips scroll">
        <button className={`chip ${cat === 'todos' ? 'on' : ''}`} onClick={() => setCat('todos')}>Todos</button>
        {cats.map((c) => <button key={c.id} className={`chip ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)}>{c.label}</button>)}
      </div>
      <div className="finish-grid">
        <button className={`finish ${!current ? 'on' : ''}`} onClick={() => onPick('')}>
          <span className="finish-img original">Original</span>
          <strong>Original do projeto</strong>
        </button>
        {list.map((f) => (
          <button key={f.id} className={`finish ${current === f.id ? 'on' : ''}`} onClick={() => onPick(f.id)}>
            <span className="finish-img" style={{ backgroundImage: `url(${finishThumb(f)})` }} />
            <strong>{f.name}</strong>
            <small>{CATEGORIES.find((c) => c.id === f.category)?.label}</small>
          </button>
        ))}
      </div>
    </>
  );
}

function ColorPicker({ current, onPick }: { current?: string; onPick: (c: string) => void }) {
  const isColor = current?.startsWith('#');
  return (
    <div className="swatch-grid">
      <button className={`swatch original ${!current ? 'on' : ''}`} onClick={() => onPick('')} title="Original do projeto">↺</button>
      {SWATCHES.map((c) => (
        <button key={c} className={`swatch ${current === c ? 'on' : ''}`} style={{ background: c }} onClick={() => onPick(c)} title={c} aria-label={`Cor ${c}`} />
      ))}
      <label className="swatch custom" title="Outra cor">
        <input type="color" value={isColor ? current : '#e8dcc8'} onChange={(e) => onPick(e.target.value)} />+
      </label>
    </div>
  );
}

function ElementColors({ targets, merged, onPick }: { targets: Map<string, string[]>; merged: Customization; onPick: (e: Customization) => void }) {
  const available = COLOR_ELEMENTS.filter((e) => targets.has(e.id));
  const [el, setEl] = useState(available[0]?.id);
  if (!el) return <p className="note">Nenhum elemento personalizável foi identificado neste modelo.</p>;
  return (
    <>
      <div className="chips">
        {available.map((e) => <button key={e.id} className={`chip ${el === e.id ? 'on' : ''}`} onClick={() => setEl(e.id)}>{e.label}</button>)}
      </div>
      <ColorPicker current={merged[`el:${el}`]} onPick={(c) => onPick({ [`el:${el}`]: c })} />
    </>
  );
}

function SavePanel() {
  const custom = useStore((s) => s.custom);
  const applyMany = useStore((s) => s.applyMany);
  const resetCustom = useStore((s) => s.resetCustom);
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [saved, setSaved] = useState(listSaved());
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const count = Object.keys(custom).length;

  const save = async () => {
    const c: SavedConfig = { id: crypto.randomUUID(), name: name || 'Minha versão', client: client || undefined, createdAt: new Date().toISOString(), custom };
    saveConfig(c);
    setSaved(listSaved());
    registerConfig(c);
    setLink(shareUrl(custom, [c.name, c.client].filter(Boolean).join(' · ')));
  };
  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* */
    }
  };
  return (
    <div className="save">
      <p className="note">{count ? `${count} alteração(ões) nesta versão.` : 'Faça alguma alteração para salvar uma versão personalizada.'}</p>
      <label className="field"><span>Nome da versão</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Casa 1 com piso amadeirado" /></label>
      <label className="field"><span>Seu nome (opcional)</span><input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Para o corretor identificar" /></label>
      <button className="btn-primary small" onClick={save} disabled={!count}><Icon.share /> Salvar e gerar link</button>
      {link && (
        <div className="share-box">
          <input readOnly value={link} onFocus={(e) => e.target.select()} />
          <div className="row">
            <button className="btn-ghost" onClick={copy}>{copied ? 'Copiado' : 'Copiar link'}</button>
            <a className="btn-ghost" href={`https://wa.me/?text=${encodeURIComponent(`Minha versão personalizada da ${PROJECT.name}: ${link}`)}`} target="_blank" rel="noreferrer">Enviar pelo WhatsApp</a>
          </div>
        </div>
      )}
      {saved.length > 0 && (
        <>
          <h4>Versões salvas neste aparelho</h4>
          <ul className="saved-list">
            {saved.map((c) => (
              <li key={c.id}>
                <div>
                  <strong>{c.name}</strong>
                  <small>{new Date(c.createdAt).toLocaleString('pt-BR')} · {Object.keys(c.custom).length} alterações</small>
                  <small>{describe(c.custom)}</small>
                </div>
                <div className="row">
                  <button className="link" onClick={() => { resetCustom(); applyMany(c.custom); }}>abrir</button>
                  <button className="link" onClick={() => { deleteSaved(c.id); setSaved(listSaved()); }}>excluir</button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function describe(c: Customization) {
  return Object.values(c).slice(0, 3).map((v) => (v.startsWith('#') ? v : finishById(v)?.name ?? v)).join(', ');
}
