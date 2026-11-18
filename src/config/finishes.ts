/*
 * Biblioteca de acabamentos (porcelanatos e revestimentos) e paletas de cores.
 * As texturas são geradas no navegador (src/textures/procedural.ts) a partir
 * destes parâmetros, em escala real: tile = dimensões da peça em metros.
 *
 * Para cadastrar um produto real com foto de catálogo, preencha `image`
 * com a URL de uma textura de uma peça (ou de 2x2 peças com `imageTiles: 2`).
 */

export type Pattern = 'marmore' | 'liso' | 'cimento' | 'madeira' | 'pedra' | 'travertino' | 'terrazzo' | 'zellige';

export interface Finish {
  id: string;
  name: string;
  category: CategoryId;
  /** largura x comprimento da peça em metros */
  tile: [number, number];
  pattern: Pattern;
  base: string;
  vein?: string;
  /** juntas: cor e largura em mm */
  grout: string;
  groutMm: number;
  roughness: number;
  /** assentamento: alinhado ou amarração 1/2 */
  layout?: 'alinhado' | 'amarracao';
  image?: string;
  imageTiles?: number;
  /** superfícies onde a opção pode ser usada */
  use: ('piso' | 'parede' | 'externo')[];
}

export type CategoryId =
  | 'marmorizado' | 'acetinado' | 'polido' | 'amadeirado' | 'cimenticio' | 'pedras'
  | 'grandes-formatos' | 'parede' | 'externo';

export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'marmorizado', label: 'Marmorizados' },
  { id: 'acetinado', label: 'Acetinados' },
  { id: 'polido', label: 'Polidos' },
  { id: 'amadeirado', label: 'Amadeirados' },
  { id: 'cimenticio', label: 'Cimentícios' },
  { id: 'pedras', label: 'Pedras naturais' },
  { id: 'grandes-formatos', label: 'Grandes formatos' },
  { id: 'parede', label: 'Revestimentos de parede' },
  { id: 'externo', label: 'Áreas externas' },
];

const P = 'piso' as const, W = 'parede' as const, E = 'externo' as const;

export const FINISHES: Finish[] = [
  // Marmorizados
  { id: 'calacatta-oro', name: 'Calacatta Oro 120×120', category: 'marmorizado', tile: [1.2, 1.2], pattern: 'marmore', base: '#f3f0ea', vein: '#b9a27e', grout: '#e6e1d8', groutMm: 2, roughness: 0.18, use: [P, W] },
  { id: 'carrara', name: 'Carrara 90×90', category: 'marmorizado', tile: [0.9, 0.9], pattern: 'marmore', base: '#eeeeec', vein: '#9ea2a6', grout: '#dcdcda', groutMm: 2, roughness: 0.22, use: [P, W] },
  { id: 'statuario', name: 'Statuario 60×120', category: 'marmorizado', tile: [0.6, 1.2], pattern: 'marmore', base: '#f6f5f2', vein: '#7f8186', grout: '#e2e2df', groutMm: 2, roughness: 0.15, use: [P, W] },
  { id: 'nero-marquina', name: 'Nero Marquina 60×120', category: 'marmorizado', tile: [0.6, 1.2], pattern: 'marmore', base: '#1d1d1f', vein: '#d8d6d2', grout: '#2a2a2a', groutMm: 2, roughness: 0.15, use: [P, W] },
  // Acetinados
  { id: 'frozen-acetinado', name: 'Branco gelo acetinado 120×120', category: 'acetinado', tile: [1.2, 1.2], pattern: 'liso', base: '#e9e8e4', grout: '#d9d8d3', groutMm: 2, roughness: 0.45, use: [P, W] },
  { id: 'offwhite-acetinado', name: 'Off-white acetinado 90×90', category: 'acetinado', tile: [0.9, 0.9], pattern: 'liso', base: '#ece5d8', grout: '#dcd3c3', groutMm: 2, roughness: 0.5, use: [P, W] },
  { id: 'cinza-acetinado', name: 'Cinza claro acetinado 60×120', category: 'acetinado', tile: [0.6, 1.2], pattern: 'cimento', base: '#c9c8c4', grout: '#b9b8b4', groutMm: 2, roughness: 0.5, use: [P, W] },
  // Polidos
  { id: 'branco-polido', name: 'Branco polido 84×84', category: 'polido', tile: [0.84, 0.84], pattern: 'liso', base: '#f1f0ec', grout: '#e3e2dd', groutMm: 2, roughness: 0.08, use: [P, W] },
  { id: 'onix-polido', name: 'Ônix bianco polido 120×120', category: 'polido', tile: [1.2, 1.2], pattern: 'marmore', base: '#efe9df', vein: '#d6c6a8', grout: '#e3dccf', groutMm: 2, roughness: 0.07, use: [P, W] },
  { id: 'bege-polido', name: 'Bege polido 80×80', category: 'polido', tile: [0.8, 0.8], pattern: 'travertino', base: '#ddd0bb', vein: '#c8b796', grout: '#cfc2ac', groutMm: 2, roughness: 0.1, use: [P, W] },
  // Amadeirados
  { id: 'carvalho', name: 'Carvalho natural 20×120', category: 'amadeirado', tile: [0.2, 1.2], pattern: 'madeira', base: '#b48a5f', vein: '#8a6340', grout: '#6f5238', groutMm: 2, roughness: 0.55, layout: 'amarracao', use: [P, W] },
  { id: 'freijo', name: 'Freijó 26×160', category: 'amadeirado', tile: [0.26, 1.6], pattern: 'madeira', base: '#a07850', vein: '#74522f', grout: '#5f4630', groutMm: 2, roughness: 0.55, layout: 'amarracao', use: [P, W] },
  { id: 'nogueira', name: 'Nogueira 20×120', category: 'amadeirado', tile: [0.2, 1.2], pattern: 'madeira', base: '#6e4a31', vein: '#4a2f1d', grout: '#3f2a1b', groutMm: 2, roughness: 0.55, layout: 'amarracao', use: [P, W] },
  { id: 'carvalho-claro', name: 'Carvalho claro 20×120', category: 'amadeirado', tile: [0.2, 1.2], pattern: 'madeira', base: '#d2b48f', vein: '#a9845d', grout: '#8f7253', groutMm: 2, roughness: 0.55, layout: 'amarracao', use: [P, W] },
  // Cimentícios
  { id: 'cimento-cinza', name: 'Cimento cinza 120×120', category: 'cimenticio', tile: [1.2, 1.2], pattern: 'cimento', base: '#a9a7a2', grout: '#9b9994', groutMm: 2, roughness: 0.6, use: [P, W, E] },
  { id: 'concreto-claro', name: 'Concreto claro 90×90', category: 'cimenticio', tile: [0.9, 0.9], pattern: 'cimento', base: '#c7c3bb', grout: '#b9b5ad', groutMm: 2, roughness: 0.62, use: [P, W, E] },
  { id: 'grafite', name: 'Grafite 60×120', category: 'cimenticio', tile: [0.6, 1.2], pattern: 'cimento', base: '#55555a', grout: '#4a4a4e', groutMm: 2, roughness: 0.55, use: [P, W] },
  { id: 'terrazzo', name: 'Granilite claro 80×80', category: 'cimenticio', tile: [0.8, 0.8], pattern: 'terrazzo', base: '#e3ddd2', vein: '#8a8278', grout: '#d6d0c5', groutMm: 2, roughness: 0.3, use: [P, W] },
  // Pedras naturais
  { id: 'travertino', name: 'Travertino romano 60×120', category: 'pedras', tile: [0.6, 1.2], pattern: 'travertino', base: '#d8c8ad', vein: '#bfa985', grout: '#cbbb9f', groutMm: 2, roughness: 0.45, use: [P, W, E] },
  { id: 'ardosia', name: 'Ardósia grafite 60×60', category: 'pedras', tile: [0.6, 0.6], pattern: 'pedra', base: '#4c4f52', vein: '#3a3c3f', grout: '#55585b', groutMm: 3, roughness: 0.7, use: [P, W, E] },
  { id: 'limestone', name: 'Limestone areia 60×60', category: 'pedras', tile: [0.6, 0.6], pattern: 'pedra', base: '#d9cfbd', vein: '#c4b89f', grout: '#cdc2ae', groutMm: 2, roughness: 0.6, use: [P, W, E] },
  // Grandes formatos
  { id: 'calacatta-gf', name: 'Calacatta 120×240', category: 'grandes-formatos', tile: [1.2, 2.4], pattern: 'marmore', base: '#f4f1eb', vein: '#a99372', grout: '#e5e0d6', groutMm: 2, roughness: 0.14, use: [P, W] },
  { id: 'cimento-gf', name: 'Cimento claro 120×270', category: 'grandes-formatos', tile: [1.2, 2.7], pattern: 'cimento', base: '#bdbab3', grout: '#b1aea7', groutMm: 2, roughness: 0.55, use: [P, W] },
  { id: 'travertino-gf', name: 'Travertino 100×200', category: 'grandes-formatos', tile: [1.0, 2.0], pattern: 'travertino', base: '#ddd0b8', vein: '#c3ae8a', grout: '#d0c3ab', groutMm: 2, roughness: 0.4, use: [P, W] },
  // Revestimentos de parede
  { id: 'metro-branco', name: 'Metrô branco 7,5×15', category: 'parede', tile: [0.15, 0.075], pattern: 'liso', base: '#f2f1ee', grout: '#cfcdc8', groutMm: 2, roughness: 0.12, layout: 'amarracao', use: [W] },
  { id: 'bastao-verde', name: 'Bastão verde-sálvia 7,5×30', category: 'parede', tile: [0.075, 0.3], pattern: 'zellige', base: '#8e9b84', grout: '#d6d3cb', groutMm: 2, roughness: 0.2, use: [W] },
  { id: 'zellige-terracota', name: 'Zellige terracota 10×10', category: 'parede', tile: [0.1, 0.1], pattern: 'zellige', base: '#b5653d', grout: '#d8cdbf', groutMm: 2, roughness: 0.2, use: [W] },
  { id: 'zellige-branco', name: 'Zellige branco 10×10', category: 'parede', tile: [0.1, 0.1], pattern: 'zellige', base: '#ece8df', grout: '#d4cfc5', groutMm: 2, roughness: 0.15, use: [W] },
  { id: 'filete-grafite', name: 'Filete grafite 5×30', category: 'parede', tile: [0.3, 0.05], pattern: 'liso', base: '#3e3f42', grout: '#2c2d2f', groutMm: 2, roughness: 0.35, layout: 'amarracao', use: [W] },
  // Externos
  { id: 'sao-tome', name: 'Pedra São Tomé 40×40', category: 'externo', tile: [0.4, 0.4], pattern: 'pedra', base: '#dccbb0', vein: '#c9b28f', grout: '#bfb3a0', groutMm: 6, roughness: 0.85, use: [E, P] },
  { id: 'externo-cimenticio', name: 'Cimentício antiderrapante 60×60', category: 'externo', tile: [0.6, 0.6], pattern: 'cimento', base: '#b5b1a9', grout: '#a19d95', groutMm: 4, roughness: 0.85, use: [E, P] },
  { id: 'deck', name: 'Deck cumaru 14×100', category: 'externo', tile: [0.14, 1.0], pattern: 'madeira', base: '#8a5a37', vein: '#5f3b22', grout: '#2a1d14', groutMm: 5, roughness: 0.7, layout: 'amarracao', use: [E, P] },
  { id: 'travertino-ext', name: 'Travertino levigado 60×60', category: 'externo', tile: [0.6, 0.6], pattern: 'travertino', base: '#d6c5a8', vein: '#bda67f', grout: '#c9b99c', groutMm: 3, roughness: 0.75, use: [E, P] },
];

export const finishById = (id: string) => FINISHES.find((f) => f.id === id);

/* ------------------------------- Cores e paletas ------------------------------- */

/** Elementos personalizáveis por cor. Os materiais são identificados no pipeline. */
export const COLOR_ELEMENTS: { id: string; label: string; hint?: string }[] = [
  { id: 'paredes-internas', label: 'Paredes internas (todas)' },
  { id: 'fachada', label: 'Fachada (cor principal)' },
  { id: 'fachada-destaque', label: 'Fachada (volume de destaque)' },
  { id: 'muros', label: 'Muros' },
  { id: 'faixa-muro', label: 'Faixa do muro' },
  { id: 'portoes', label: 'Portões' },
  { id: 'esquadrias', label: 'Esquadrias' },
  { id: 'portas', label: 'Portas internas' },
  { id: 'porta-entrada', label: 'Porta de entrada' },
  { id: 'marcenaria', label: 'Marcenaria e armários' },
  { id: 'bancadas', label: 'Bancadas' },
];

export interface Palette {
  id: string;
  name: string;
  description: string;
  swatches: string[];
  colors: Partial<Record<string, string>>;
}

export const PALETTES: Palette[] = [
  {
    id: 'contemporaneo', name: 'Contemporâneo sofisticado', description: 'Branco, cinza-claro, grafite e madeira natural',
    swatches: ['#f4f3f0', '#d9d9d6', '#4a4c4f', '#b38a5e'],
    colors: { 'paredes-internas': '#f4f3f0', fachada: '#e2e2df', 'fachada-destaque': '#4a4c4f', muros: '#e2e2df', 'faixa-muro': '#4a4c4f', esquadrias: '#2b2c2e', portas: '#efeeea', 'porta-entrada': '#a27b55', portoes: '#2b2c2e', marcenaria: '#b38a5e' },
  },
  {
    id: 'minimalista', name: 'Minimalista', description: 'Branco quente, bege, areia e off-white',
    swatches: ['#f7f2ea', '#e8dcc8', '#d9c7ae', '#efe8dc'],
    colors: { 'paredes-internas': '#f7f2ea', fachada: '#efe8dc', 'fachada-destaque': '#d9c7ae', muros: '#e8dcc8', 'faixa-muro': '#d9c7ae', esquadrias: '#ebe6de', portas: '#f3eee6', 'porta-entrada': '#d9c7ae', portoes: '#d9c7ae', marcenaria: '#e5d9c6' },
  },
  {
    id: 'moderno', name: 'Moderno', description: 'Cinza, preto, branco e tons de concreto',
    swatches: ['#f2f2f2', '#8c8c8a', '#a7a5a0', '#1e1e1f'],
    colors: { 'paredes-internas': '#f2f2f2', fachada: '#a7a5a0', 'fachada-destaque': '#1e1e1f', muros: '#8c8c8a', 'faixa-muro': '#1e1e1f', esquadrias: '#1e1e1f', portas: '#e9e9e9', 'porta-entrada': '#3a3a3a', portoes: '#1e1e1f', marcenaria: '#6e6c68' },
  },
  {
    id: 'natural', name: 'Natural', description: 'Verde-oliva, bege, terracota e madeira',
    swatches: ['#e7dcc6', '#6b6b47', '#b5653d', '#a87a4f'],
    colors: { 'paredes-internas': '#f1ebdd', fachada: '#e7dcc6', 'fachada-destaque': '#6b6b47', muros: '#e7dcc6', 'faixa-muro': '#b5653d', esquadrias: '#4b3a2a', portas: '#efe7d8', 'porta-entrada': '#9b6b43', portoes: '#6b6b47', marcenaria: '#a87a4f' },
  },
  {
    id: 'luxo', name: 'Luxo contemporâneo', description: 'Fendi, champagne, marrom e detalhes em preto',
    swatches: ['#cdbfae', '#eee6da', '#5b4334', '#1c1a19'],
    colors: { 'paredes-internas': '#eee6da', fachada: '#cdbfae', 'fachada-destaque': '#5b4334', muros: '#cdbfae', 'faixa-muro': '#1c1a19', esquadrias: '#1c1a19', portas: '#e8dfd2', 'porta-entrada': '#5b4334', portoes: '#1c1a19', marcenaria: '#6f513d' },
  },
  {
    id: 'praiano', name: 'Praiano', description: 'Branco, areia, azul acinzentado e madeira clara',
    swatches: ['#f5f2eb', '#e6d8bf', '#8fa1ab', '#d8c3a0'],
    colors: { 'paredes-internas': '#fafaf7', fachada: '#f5f2eb', 'fachada-destaque': '#8fa1ab', muros: '#e6d8bf', 'faixa-muro': '#8fa1ab', esquadrias: '#efede8', portas: '#f6f3ed', 'porta-entrada': '#d8c3a0', portoes: '#8fa1ab', marcenaria: '#d8c3a0' },
  },
  {
    id: 'acolhedor', name: 'Elegante e acolhedor', description: 'Greige, caramelo, creme e tons amadeirados',
    swatches: ['#f3ede2', '#cfc6b8', '#b07a4b', '#8a5e3c'],
    colors: { 'paredes-internas': '#f3ede2', fachada: '#cfc6b8', 'fachada-destaque': '#b07a4b', muros: '#cfc6b8', 'faixa-muro': '#b07a4b', esquadrias: '#3b302a', portas: '#efe8dc', 'porta-entrada': '#8a5e3c', portoes: '#3b302a', marcenaria: '#9c6e47' },
  },
  // As quatro opções do painel de fachada enviado pela cliente
  {
    id: 'fachada-op1', name: 'Fachada 1: Moderna e atemporal', description: 'Off-white, caramelo e preto',
    swatches: ['#efeae2', '#a97b50', '#232323'],
    colors: { fachada: '#efeae2', muros: '#efeae2', 'fachada-destaque': '#a97b50', 'faixa-muro': '#a97b50', esquadrias: '#232323', portoes: '#232323' },
  },
  {
    id: 'fachada-op2', name: 'Fachada 2: Sofisticada e natural', description: 'Off-white, verde-oliva e preto',
    swatches: ['#efeae2', '#6e6f55', '#232323'],
    colors: { fachada: '#efeae2', muros: '#efeae2', 'fachada-destaque': '#6e6f55', 'faixa-muro': '#6e6f55', esquadrias: '#232323', portoes: '#232323' },
  },
  {
    id: 'fachada-op3', name: 'Fachada 3: Quente e acolhedora', description: 'Bege, terracota e preto',
    swatches: ['#e2d3bf', '#a4532f', '#232323'],
    colors: { fachada: '#e2d3bf', muros: '#e2d3bf', 'fachada-destaque': '#a4532f', 'faixa-muro': '#a4532f', esquadrias: '#232323', portoes: '#232323' },
  },
  {
    id: 'fachada-op4', name: 'Fachada 4: Contemporânea e elegante', description: 'Cinza-claro, pedra natural e preto',
    swatches: ['#cfcfcc', '#9c968c', '#232323'],
    colors: { fachada: '#cfcfcc', muros: '#cfcfcc', 'fachada-destaque': '#9c968c', 'faixa-muro': '#8f8a82', esquadrias: '#232323', portoes: '#232323' },
  },
];

/** Cores avulsas sugeridas (tintas de mercado em tons neutros). */
export const SWATCHES = [
  '#ffffff', '#f7f2ea', '#efe8dc', '#e8dcc8', '#d9c7ae', '#cfc6b8', '#e2e2df', '#c9c8c4',
  '#a7a5a0', '#8c8c8a', '#4a4c4f', '#232323', '#a97b50', '#b07a4b', '#a4532f', '#b5653d',
  '#6e6f55', '#6b6b47', '#8fa1ab', '#5b4334', '#9c6e47', '#d8c3a0',
];
