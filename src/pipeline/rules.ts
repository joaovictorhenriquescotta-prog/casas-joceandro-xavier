// Regras de reconhecimento baseadas nos nomes usados no arquivo SketchUp.
// Para outro empreendimento, ajuste apenas este arquivo.

export type ElementId =
  | 'fachada' | 'fachada-destaque' | 'porta-entrada' | 'muros' | 'faixa-muro' | 'portoes' | 'esquadrias' | 'portas' | 'marcenaria'
  | 'bancadas' | 'revestimentos' | 'paredes-internas' | 'pisos' | 'pisos-externos' | 'metais'
  | 'vidros' | 'decorativos' | 'entorno' | null;

/** Grupos de nós que não fazem parte da visita (camadas técnicas e câmeras salvas). */
export const TECHNICAL_NODE_PATTERNS: RegExp[] = [
  /^Cena\d+$/, /^Active View$/, /^TERRENO - ISOMETRICA$/,
  /^CURVAS DE NIVEL/, /^CURVAS MESTRAS$/, /^PONTOS COTADOS/, /^VOLUME DE CORTE/,
];

/** Materiais de pintura que podem estar em paredes (faces internas viram "paredes internas"). */
export const WALL_MATERIAL = /^(\.?TINTA|PAREDE$|\.CINZA CLASSICO|Material#1$|\*1$|\*2$|Padrão SketchUp$)/i;

export const ROOM_TYPES: { id: string; label: string; match: (n: string) => boolean }[] = [
  { id: 'suite', label: 'Suíte', match: (n) => /PISO - QUARTO/.test(n) && /10\.50 m²/.test(n) },
  { id: 'quarto', label: 'Quarto', match: (n) => /PISO - QUARTO/.test(n) && /9\.00 m²/.test(n) },
  // No modelo, o "BANHEIRO (FUNDOS)" tem porta para a suíte; o "BANHO" abre para a sala.
  { id: 'banheiro', label: 'Banheiro social', match: (n) => /PISO - BANHO /.test(n) },
  { id: 'banho-suite', label: 'Banho da suíte', match: (n) => /PISO - BANHEIRO \(FUNDOS\)/.test(n) },
  { id: 'estar', label: 'Estar, jantar e cozinha', match: (n) => /PISO - COZINHA/.test(n) },
  { id: 'garagem', label: 'Garagem', match: (n) => /PISO - GARAGEM/.test(n) },
];

const RULES: { re: RegExp; element: ElementId; metallic?: number; roughness?: number; glass?: boolean }[] = [
  { re: /vidro|glass|translucent|cristal/i, element: 'vidros', roughness: 0.05, glass: true },
  { re: /^LR_LED|^\.LED$|Fixture Light/i, element: null, roughness: 0.4 },
  { re: /PORT[AÃ]O|Alum[ií]nio - port/i, element: 'portoes', metallic: 0.6, roughness: 0.45 },
  { re: /PORTA CINZA|Madeira - porta/i, element: 'portas', roughness: 0.55 },
  { re: /Preto Met[aá]lico|Metal Preto/i, element: 'esquadrias', metallic: 0.7, roughness: 0.4 },
  { re: /^Muro - neutro$|^MURO 02$/i, element: 'muros', roughness: 0.92 },
  // cores da fachada lidas no modelo: TINTA 01 (pêssego) no corpo principal; TINTA 03, .TINTA 02 e PAREDE nos volumes cinza
  { re: /^TINTA 01$|SUVINIL/i, element: 'fachada', roughness: 0.9 },
  { re: /^\.?TINTA|^PAREDE$/i, element: 'fachada-destaque', roughness: 0.9 },
  { re: /GRANITO|Granito|CALACATA/i, element: 'bancadas', roughness: 0.12 },
  { re: /BIANCOGRES|Onix|Elizabeth|PISO$|^\.PISO|CONCRETO POLIDO/i, element: 'pisos', roughness: 0.2 },
  { re: /CAL[ÇC]ADA|Concreto|ASFALTO|Asfalto|Bloco|Terreno|Grass|PISO TATIL/i, element: 'entorno', roughness: 0.95 },
  { re: /JEQUITIB|FRAP[ÊE]|MDF|Tauari|tauari|Suprema|BRANCO LACCA|DURATEX|int marc|Cinza Puro|madfreijo/i, element: 'marcenaria', roughness: 0.6 },
  { re: /cromado|Cromado|chrome|Chrome|krom|inox|Docol|DOURADO|Gold/i, element: 'metais', metallic: 1, roughness: 0.15 },
  { re: /alumin|Alumin|Metal|METAL|FERRO|Steel|aluminio/i, element: null, metallic: 0.9, roughness: 0.35 },
];

export function classifyMaterial(name: string) {
  for (const r of RULES) {
    if (r.re.test(name)) {
      return { element: r.element, metallic: r.metallic ?? 0, roughness: r.roughness ?? 0.7, glass: !!r.glass };
    }
  }
  return { element: null as ElementId, metallic: 0, roughness: 0.75, glass: false };
}
