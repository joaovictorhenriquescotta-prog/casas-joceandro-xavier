// Visita cinematográfica ("Iniciar visita"): imagens, ordem dos ambientes e associação ambiente → renders.
//
// COMO ACRESCENTAR UMA RENDERIZAÇÃO
// 1. node scripts/visita-imagem.mjs "<caminho do render>" <nome>      (gera public/visita/<nome>.webp)
// 2. Acrescente { src: v('<nome>') } na lista do ambiente em ROOM_SHOTS abaixo.
//    A chave é o tipo de ambiente (vale para as duas casas) ou o id de uma casa específica (ex.: 'casa2-suite'),
//    que tem prioridade sobre o tipo.
//    Tipos: fachada, garagem, estar, banheiro, quarto, suite, banho-suite.
// Ambientes sem render aparecem pela planta humanizada vista de perto, em perspectiva ("vista de drone").
//
// Os contornos clicáveis da planta vêm do modelo 3D: veja scripts/build-tour-plan.mjs.

const v = (name: string) => `/visita/${name}.webp`;

/** Enquadramento de câmera sobre uma imagem: s = zoom (1 = cobre a tela), fx/fy = ponto da imagem no centro (0–1). */
export interface Frame { s: number; fx: number; fy: number }
export interface Shot {
  src: string;
  caption?: string;
  /** movimento de câmera durante a exibição; padrão: aproximação lenta pelo centro */
  from?: Partial<Frame>;
  to?: Partial<Frame>;
  /** duração da cena em ms */
  ms?: number;
}

export const PLAN_IMAGE = {
  hi: v('planta-8k'), // 8192 px, computadores
  lo: v('planta-4k'), // 4096 px, celulares e tablets
  hiWidth: 8192,
  loWidth: 4096,
};

/** Abertura: sobrevoo → aproximação → descida → fachada → subida até a planta. */
export const OPENING: Shot[] = [
  { src: v('aerea'), from: { s: 1.0, fx: 0.55, fy: 0.46 }, to: { s: 1.22, fx: 0.55, fy: 0.44 }, ms: 4600 },
  { src: v('principal'), from: { s: 1.02, fx: 0.55, fy: 0.36 }, to: { s: 1.14, fx: 0.55, fy: 0.5 }, ms: 4200 },
  { src: v('frontal'), from: { s: 1.12, fx: 0.5, fy: 0.5 }, to: { s: 1.0, fx: 0.5, fy: 0.55 }, ms: 4400 },
];
/** Imagem do lote inteiro, usada na subida do drone da fachada até a planta (aproxima até casar com a planta). */
export const LOT_SHOT: Shot = { src: v('lote'), from: { s: 1.0, fx: 0.5, fy: 0.44 }, to: { s: 1.62, fx: 0.5, fy: 0.42 }, ms: 2600 };

/** Renders de cada ambiente, na ordem em que aparecem. */
export const ROOM_SHOTS: Record<string, Shot[]> = {
  fachada: [
    { src: v('frontal'), caption: 'Vista frontal', from: { s: 1.0, fx: 0.5, fy: 0.5 }, to: { s: 1.1, fx: 0.52, fy: 0.55 } },
    { src: v('esquina'), caption: 'Vista da esquina', from: { s: 1.08, fx: 0.4, fy: 0.5 }, to: { s: 1.0, fx: 0.55, fy: 0.5 } },
    { src: v('principal'), caption: 'As duas casas ao entardecer', from: { s: 1.0, fx: 0.55, fy: 0.45 }, to: { s: 1.12, fx: 0.52, fy: 0.5 } },
    { src: v('aerea'), caption: 'Vista aérea', from: { s: 1.15, fx: 0.55, fy: 0.45 }, to: { s: 1.0, fx: 0.55, fy: 0.5 } },
  ],
  garagem: [
    { src: v('garagem-1'), caption: 'Garagem e fachada', from: { s: 1.0, fx: 0.5, fy: 0.55 }, to: { s: 1.12, fx: 0.5, fy: 0.6 } },
    { src: v('garagem-2'), caption: 'Garagem por outro ângulo', from: { s: 1.1, fx: 0.42, fy: 0.55 }, to: { s: 1.0, fx: 0.55, fy: 0.55 } },
    { src: v('garagem-3'), caption: 'Garagem e canteiro lateral', from: { s: 1.0, fx: 0.45, fy: 0.55 }, to: { s: 1.12, fx: 0.55, fy: 0.55 } },
  ],
};

/** Ordem da visita dentro de cada casa (próximo / anterior). */
export const ROOM_ORDER = ['garagem', 'estar', 'banheiro', 'quarto', 'suite', 'banho-suite'];

/** Nomes exibidos (os do projeto; mantidos iguais aos do modelo 3D). */
export const ROOM_NAMES: Record<string, string> = {
  fachada: 'Fachada',
  garagem: 'Garagem',
  estar: 'Estar, jantar e cozinha',
  banheiro: 'Banheiro social',
  quarto: 'Quarto',
  suite: 'Suíte',
  'banho-suite': 'Banho da suíte',
};

/** Ponto da fachada na planta (frente do lote, entre as duas casas), em px da planta 8192. */
export const FACHADA_ON_PLAN = { anchor: [3930, 2560] as [number, number], box: [2250, 1950, 5620, 2844] as [number, number, number, number] };

export const DEFAULT_SHOT_MS = 6500;
