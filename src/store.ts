import { create } from 'zustand';
import type { SceneMeta } from './pipeline/meta';

export type TimeOfDay = 'manha' | 'tarde' | 'noite';
export type NavMode = 'orbita' | 'caminhar';
export type Quality = 'baixa' | 'media' | 'alta';

/** Uma escolha de acabamento: alvo (superfície) -> opção (id da biblioteca ou cor hex). */
export type Customization = Record<string, string>;

export interface Viewpoint {
  id: string;
  label: string;
  group: string;
  position: [number, number, number];
  target: [number, number, number];
  room?: string;
  mode: NavMode;
}

interface State {
  /** intro = tela inicial · tour = visita cinematográfica · carregando/visita = modelo 3D interativo */
  phase: 'intro' | 'tour' | 'carregando' | 'visita';
  progress: number;
  /** ambiente (id do modelo, ex.: casa1-suite) para abrir direto ao entrar no modelo 3D a partir da visita */
  pendingRoom: string | null;
  meta: SceneMeta | null;
  modelUrl: string | null;
  modelVersion: string | null;

  mode: NavMode;
  eyeHeight: number;
  currentRoom: string | null;
  flyTo: Viewpoint | null;
  viewpoints: Viewpoint[];

  time: TimeOfDay;
  lights: Record<string, boolean>; // circuito -> ligado
  doors: Record<string, boolean>; // porta -> aberta

  custom: Customization;
  /** alteração em pré-visualização (ainda não aplicada) */
  preview: Customization | null;
  history: Customization[];
  showOriginal: boolean;

  quality: Quality;
  cutaway: boolean;
  panel: null | 'ambientes' | 'luzes' | 'personalizar' | 'info' | 'ajuda';

  set: (p: Partial<State>) => void;
  setTime: (t: TimeOfDay) => void;
  toggleLight: (id: string, on?: boolean) => void;
  setAllLights: (on: boolean) => void;
  toggleDoor: (id: string) => void;
  applyCustom: (key: string, value: string | null) => void;
  applyMany: (entries: Customization) => void;
  undo: () => void;
  resetCustom: () => void;
}

export const useStore = create<State>((set, get) => ({
  phase: 'intro',
  progress: 0,
  pendingRoom: null,
  meta: null,
  modelUrl: null,
  modelVersion: null,

  mode: 'orbita',
  eyeHeight: 1.6,
  currentRoom: null,
  flyTo: null,
  viewpoints: [],

  time: 'manha',
  lights: {},
  doors: {},

  custom: {},
  preview: null,
  history: [],
  showOriginal: false,

  quality: 'alta',
  cutaway: false,
  panel: null,

  set: (p) => set(p),
  setTime: (time) => {
    // à noite, acende automaticamente todas as luzes
    if (time === 'noite') {
      const lights = { ...get().lights };
      for (const k of Object.keys(lights)) lights[k] = true; // ao anoitecer, a casa toda acesa, como nas imagens
      set({ time, lights });
    } else set({ time });
  },
  toggleLight: (id, on) => set((s) => ({ lights: { ...s.lights, [id]: on ?? !s.lights[id] } })),
  setAllLights: (on) => set((s) => ({ lights: Object.fromEntries(Object.keys(s.lights).map((k) => [k, on])) })),
  toggleDoor: (id) => set((s) => ({ doors: { ...s.doors, [id]: !s.doors[id] } })),
  applyCustom: (key, value) =>
    set((s) => {
      const next = { ...s.custom };
      if (value === null) delete next[key];
      else next[key] = value;
      return { custom: next, preview: null, history: [...s.history.slice(-49), s.custom], showOriginal: false };
    }),
  applyMany: (entries) =>
    set((s) => ({ custom: { ...s.custom, ...entries }, preview: null, history: [...s.history.slice(-49), s.custom], showOriginal: false })),
  undo: () =>
    set((s) => (s.history.length ? { custom: s.history[s.history.length - 1], history: s.history.slice(0, -1) } : {})),
  resetCustom: () => set((s) => ({ custom: {}, preview: null, history: [...s.history, s.custom] })),
}));
