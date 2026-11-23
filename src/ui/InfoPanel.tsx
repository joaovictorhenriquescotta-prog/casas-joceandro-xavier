import { useStore } from '../store';
import { PROJECT, whatsappUrl } from '../config/project';
import { Icon } from './icons';

export function InfoPanel({ tab }: { tab: 'info' | 'ajuda' }) {
  const set = useStore((s) => s.set);
  const meta = useStore((s) => s.meta)!;
  const total = meta.rooms.filter((r) => r.house === meta.houses[0].id).reduce((a, r) => a + (r.area ?? 0), 0);
  return (
    <div className="modal-wrap" onClick={() => set({ panel: null })}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <div className="panel-head">
          <div className="tabs inline">
            <button className={tab === 'info' ? 'on' : ''} onClick={() => set({ panel: 'info' })}>O empreendimento</button>
            <button className={tab === 'ajuda' ? 'on' : ''} onClick={() => set({ panel: 'ajuda' })}>Como navegar</button>
          </div>
          <button className="icon-btn" onClick={() => set({ panel: null })} aria-label="Fechar"><Icon.close /></button>
        </div>
        {tab === 'info' ? (
          <div className="modal-body">
            <h2 className="serif">{PROJECT.name}</h2>
            <p className="muted">{PROJECT.location}</p>
            <p className="info-price"><strong>{PROJECT.price}</strong> <span>{PROJECT.priceNote}</span></p>
            <p>{PROJECT.description}</p>
            <ul className="bullets">{PROJECT.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
            <table className="areas">
              <thead><tr><th>Ambiente</th><th>Área por casa</th></tr></thead>
              <tbody>
                {meta.rooms.filter((r) => r.house === meta.houses[0].id).map((r) => (
                  <tr key={r.id}><td>{r.label}</td><td>{r.area?.toFixed(2).replace('.', ',')} m²</td></tr>
                ))}
                <tr className="total"><td>Total dos ambientes</td><td>{total.toFixed(2).replace('.', ',')} m²</td></tr>
              </tbody>
            </table>
            <a className="btn-wa" href={whatsappUrl()} target="_blank" rel="noreferrer"><Icon.whatsapp /> {PROJECT.contact.label}</a>
            <p className="disclaimer">{PROJECT.disclaimer}</p>
          </div>
        ) : (
          <div className="modal-body help">
            <h3>Explorar (vista externa)</h3>
            <p>Arraste para girar ao redor das casas. Role o mouse ou use dois dedos para aproximar. Com o botão direito (ou dois dedos) você desloca a vista. O botão “Ver por dentro” retira a laje para mostrar a planta.</p>
            <h3>Caminhar</h3>
            <p>No computador: arraste para olhar, use W A S D ou as setas para andar e Shift para andar mais rápido. No celular: o controle no canto esquerdo movimenta, e arrastar à direita da tela muda a direção do olhar. A altura do olhar pode ser ajustada.</p>
            <h3>Portas</h3>
            <p>Clique ou toque em uma porta para abrir ou fechar. No computador, a tecla E abre a porta mais próxima.</p>
            <h3>Ambientes</h3>
            <p>No menu Ambientes, escolha um cômodo e a câmera leva você até ele. O botão Fachada volta ao início.</p>
          </div>
        )}
      </div>
    </div>
  );
}
