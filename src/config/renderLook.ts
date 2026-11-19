// Aproximação dos acabamentos do modelo 3D aos renders finais ("renders/AQUI REALMENTE ESTAO AS FINAIS").
// Aplicada ao carregar o modelo, antes da personalização: vira o "original" do 3D (restaurar volta para cá).
// Só muda cor/brilho de materiais existentes; geometria, aberturas e ambientes não são tocados.
// Os nomes são os do SketchUp após o pipeline (PAREDE_<ambiente>__..., PISO_<ambiente>__...).
export interface LookRule {
  re: RegExp;
  color?: string;
  roughness?: number;
  /** multiplica a intensidade de reflexos do ambiente (envMapIntensity) */
  env?: number;
  /** deixa o material translúcido (0–1) */
  opacity?: number;
  note: string;
}

export const RENDER_LOOK: LookRule[] = [
  // fachada: volume principal laranja como nos renders (no modelo está pêssego claro)
  { re: /^TINTA 01$/, color: '#d9843f', note: 'volume principal da fachada, laranja dos renders' },
  // paredes pintadas: Casa 1 em cinza quente (greige), Casa 2 em off-white, como nos renders de cada casa
  { re: /^PAREDE_casa1-(estar|quarto|suite)__/, color: '#c7c2bb', roughness: 0.85, note: 'Casa 1: paredes cinza quente' },
  { re: /^PAREDE_casa2-(estar|quarto|suite)__/, color: '#eeebe6', roughness: 0.85, note: 'Casa 2: paredes off-white' },
  // pisos: porcelanato claro polido nas duas casas
  { re: /^PISO_casa[12]-(estar|quarto|suite)__Padrão SketchUp$/, color: '#efede9', roughness: 0.18, env: 1.6, note: 'piso claro polido' },
  { re: /BIANCOGRES|Elizabeth Le Blanc/, roughness: 0.14, env: 1.6, note: 'porcelanato polido com reflexo' },
  // cortinas de voil: translúcidas como nos renders (a luz da janela passa)
  { re: /^shtora-tul$/, color: '#f6f3ee', opacity: 0.62, note: 'cortinas de voil translúcidas' },
  { re: /GRANITO|Granito|CALACATA/, roughness: 0.08, env: 1.8, note: 'bancadas com brilho de pedra polida' },
];

export function lookFor(name: string): LookRule | undefined {
  return RENDER_LOOK.find((r) => r.re.test(name));
}
