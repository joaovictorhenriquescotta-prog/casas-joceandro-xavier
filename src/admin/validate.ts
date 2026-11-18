import type { SceneMeta } from '../pipeline/meta';

export interface Check { level: 'ok' | 'aviso' | 'erro'; text: string }

const size = (m: SceneMeta) => m.houseBounds.max.map((v, i) => v - m.houseBounds.min[i]);

/**
 * Confere o modelo processado e compara com a versão no ar. O app nunca corrige a
 * arquitetura sozinho: diferenças viram avisos para o administrador decidir.
 */
export function validate(next: SceneMeta, current: SceneMeta | null): Check[] {
  const out: Check[] = [];
  if (!next.rooms.length) {
    out.push({ level: 'erro', text: 'Nenhum ambiente encontrado. Os pisos precisam estar em grupos nomeados “PISO - …” (ex.: “PISO - QUARTO 9.00 m²”).' });
    return out;
  }
  out.push({ level: 'ok', text: `Ambientes: ${next.rooms.map((r) => `${r.label} (${next.houses.find((h) => h.id === r.house)?.label ?? r.house})`).join(', ')}.` });
  out.push(next.doors.length
    ? { level: 'ok', text: `${next.doors.length} portas com folha separada: abrem e fecham na visita.` }
    : { level: 'aviso', text: 'Nenhuma porta com folha separada: as portas ficarão fixas.' });
  if (!next.leds.length) out.push({ level: 'aviso', text: 'Nenhuma fita de LED (materiais “LR_LED…”) encontrada na fachada.' });
  const els = new Set(next.materials.map((m) => m.element).filter(Boolean));
  const missing = ['fachada', 'muros', 'pisos', 'paredes-internas'].filter((e) => !els.has(e as never));
  if (missing.length) out.push({ level: 'aviso', text: `Sem materiais reconhecidos para: ${missing.join(', ')}. Essas opções somem do painel “Personalize”.` });

  if (current) {
    const gone = current.rooms.filter((r) => !next.rooms.some((n) => n.id === r.id));
    const added = next.rooms.filter((r) => !current.rooms.some((c) => c.id === r.id));
    if (gone.length) out.push({ level: 'aviso', text: `Ambientes da versão atual que não aparecem mais: ${gone.map((r) => r.id).join(', ')}. Personalizações salvas para eles deixam de valer.` });
    if (added.length) out.push({ level: 'aviso', text: `Ambientes novos: ${added.map((r) => r.id).join(', ')}.` });
    if (!gone.length && !added.length) out.push({ level: 'ok', text: 'Mesmos ambientes da versão no ar: personalizações e links salvos continuam valendo.' });
    const a = size(current), b = size(next);
    const d = Math.max(...a.map((v, i) => Math.abs(v - b[i])));
    out.push(d > 0.05
      ? { level: 'aviso', text: `As dimensões gerais das casas mudaram ${Math.round(d * 100)} cm em relação à versão no ar. Confira se a alteração é intencional.` }
      : { level: 'ok', text: 'Dimensões gerais iguais às da versão no ar.' });
    for (const r of next.rooms) {
      const c = current.rooms.find((x) => x.id === r.id);
      if (c?.area && r.area && Math.abs(c.area - r.area) > 0.05) out.push({ level: 'aviso', text: `${r.label} (${r.house}): área mudou de ${c.area} m² para ${r.area} m².` });
    }
    if (current.doors.length !== next.doors.length) out.push({ level: 'aviso', text: `Portas animáveis: eram ${current.doors.length}, agora ${next.doors.length}.` });
  }
  return out;
}
