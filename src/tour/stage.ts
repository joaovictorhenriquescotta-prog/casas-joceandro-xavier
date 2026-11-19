// Palco das renderizações em tela cheia: duas camadas de imagem que se alternam.
// A imagem nunca é distorcida: ela cobre a tela na proporção original e a "câmera" só aproxima e desliza
// por cima dela (Ken Burns). As transições simulam o drone avançando (through), recuando (back) ou subindo (rise).
import type { Frame, Shot } from '../config/tour';

export type ShowMode = 'through' | 'fade' | 'rise' | 'cut';

const cache = new Map<string, Promise<HTMLImageElement | null>>();

/** Baixa e decodifica uma imagem uma única vez. Resolve null se falhar (a cena é pulada). */
export function preload(src: string): Promise<HTMLImageElement | null> {
  let p = cache.get(src);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => img.decode().then(() => resolve(img), () => resolve(img));
      img.onerror = () => resolve(null);
      img.src = src;
    });
    cache.set(src, p);
  }
  return p;
}

/** Espera a imagem, mas no máximo ms (para a apresentação não travar em conexão lenta). */
export function preloadWithin(src: string, ms: number) {
  return Promise.race([preload(src), new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

const IN_EASE = 'cubic-bezier(.22,.61,.36,1)';
const DRIFT_EASE = 'cubic-bezier(.45,.05,.55,.95)';

interface Current { el: HTMLImageElement; shot: Shot; iw: number; ih: number; anim?: Animation; to: Frame }

export class Stage {
  private slots: HTMLImageElement[];
  private cur: Current | null = null;
  /** imagem em exibição (para posicionar pontos clicáveis sobre ela) */
  get element(): HTMLImageElement | null { return this.cur?.el ?? null; }
  private turn = 0;
  private root: HTMLDivElement;
  private opts: { blur: boolean; reduced: boolean };
  constructor(root: HTMLDivElement, opts: { blur: boolean; reduced: boolean }) {
    this.root = root;
    this.opts = opts;
    this.slots = Array.from(root.querySelectorAll('img'));
  }

  get visible() { return !!this.cur; }

  /** Transform que põe o ponto (fx, fy) da imagem no centro, com zoom s sobre o tamanho que cobre a tela. */
  private transform(f: Frame, iw: number, ih: number) {
    const vw = this.root.clientWidth, vh = this.root.clientHeight;
    const cover = Math.max(vw / iw, vh / ih);
    const W = iw * cover * f.s, H = ih * cover * f.s;
    const clamp = (v: number, size: number, view: number) => (size >= view ? Math.min(0, Math.max(view - size, v)) : (view - size) / 2);
    const tx = clamp(vw / 2 - f.fx * W, W, vw), ty = clamp(vh / 2 - f.fy * H, H, vh);
    return `translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,0) scale(${f.s.toFixed(4)})`;
  }

  private size(el: HTMLImageElement, iw: number, ih: number) {
    const vw = this.root.clientWidth, vh = this.root.clientHeight;
    const cover = Math.max(vw / iw, vh / ih);
    el.style.width = `${iw * cover}px`;
    el.style.height = `${ih * cover}px`;
  }

  /** Enquadramentos de início e fim. Em tela em pé, a imagem larga ganha uma panorâmica lateral. */
  private frames(shot: Shot): [Frame, Frame] {
    const from: Frame = { s: 1, fx: 0.5, fy: 0.5, ...shot.from };
    const to: Frame = { s: 1.08, fx: 0.5, fy: 0.5, ...shot.to };
    const vw = this.root.clientWidth, vh = this.root.clientHeight;
    if (vw / vh < 1.1) {
      const dir = this.turn % 2 === 0 ? 1 : -1, mid = (from.fx + to.fx) / 2;
      from.fx = mid - 0.16 * dir;
      to.fx = mid + 0.16 * dir;
    }
    if (this.opts.reduced) return [from, from];
    return [from, to];
  }

  async show(shot: Shot, mode: ShowMode, ms: number, inMs = 1300): Promise<void> {
    const img = await preload(shot.src);
    if (!img) return;
    this.turn++;
    const el = this.slots[this.turn % 2];
    const iw = img.naturalWidth, ih = img.naturalHeight;
    el.src = shot.src;
    el.alt = shot.caption ?? '';
    this.size(el, iw, ih);
    const [from, to] = this.frames(shot);
    if (this.opts.reduced && mode !== 'cut') mode = 'fade';
    const prev = this.cur;
    if (prev) this.leave(prev, mode === 'rise' ? 'rise' : mode === 'through' ? 'through' : 'fade', inMs);

    el.style.zIndex = String(this.turn);
    el.getAnimations().forEach((a) => a.cancel());
    const blur = this.opts.blur && mode !== 'cut' && mode !== 'fade' ? 'blur(10px)' : 'blur(0px)';
    const startScale = mode === 'through' ? 1.16 : mode === 'rise' ? 1.06 : 1;
    const start: Frame = { ...from, s: from.s * startScale };
    const total = (mode === 'cut' ? 0 : inMs) + ms;
    const k = mode === 'cut' ? 0 : inMs / total;
    const frames: Keyframe[] = [
      { offset: 0, transform: this.transform(start, iw, ih), opacity: mode === 'cut' ? 1 : 0, filter: blur, easing: IN_EASE },
      { offset: k, transform: this.transform(from, iw, ih), opacity: 1, filter: 'blur(0px)', easing: DRIFT_EASE },
      { offset: 1, transform: this.transform(to, iw, ih), opacity: 1, filter: 'blur(0px)' },
    ];
    const anim = el.animate(frames, { duration: total, fill: 'forwards' });
    this.cur = { el, shot, iw, ih, anim, to };
    await new Promise((r) => setTimeout(r, mode === 'cut' ? 0 : inMs));
  }

  private leave(c: Current, mode: 'through' | 'rise' | 'fade' | 'back', ms: number) {
    const el = c.el;
    const now = getComputedStyle(el).transform;
    c.anim?.cancel();
    const factor = mode === 'through' ? 1.24 : mode === 'fade' ? 1.02 : 0.94;
    const end: Frame = { ...c.to, s: c.to.s * factor };
    const blur = this.opts.blur && mode !== 'fade' ? 'blur(12px)' : 'blur(0px)';
    const endTransform = this.transform(end, c.iw, c.ih);
    el.animate(
      [
        { transform: now === 'none' ? this.transform(c.to, c.iw, c.ih) : now, opacity: 1, filter: 'blur(0px)' },
        { transform: endTransform, opacity: 0, filter: blur },
      ],
      { duration: ms * 0.9, easing: 'cubic-bezier(.55,0,.75,.45)', fill: 'forwards' },
    );
  }

  /** Some com a imagem atual (o drone recua ou sobe) e libera o palco. */
  async hide(mode: 'back' | 'fade' | 'rise' = 'back', ms = 900) {
    const c = this.cur;
    if (!c) return;
    this.cur = null;
    this.leave(c, mode, ms);
    await new Promise((r) => setTimeout(r, ms * 0.9));
  }

  /** Recalcula depois de girar a tela ou mudar o tamanho da janela (sem transição). */
  resize() {
    const c = this.cur;
    if (!c) return;
    this.size(c.el, c.iw, c.ih);
    c.anim?.cancel();
    c.anim = c.el.animate([{ transform: this.transform(c.to, c.iw, c.ih), opacity: 1 }], { duration: 1, fill: 'forwards' });
  }

  clear() {
    this.cur = null;
    for (const el of this.slots) { el.getAnimations().forEach((a) => a.cancel()); el.style.opacity = '0'; }
  }
}
