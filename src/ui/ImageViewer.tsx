import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';

type View = { s: number; x: number; y: number };
type Gesture = { d0: number; s0: number; cx: number; cy: number; x0: number; y0: number; moved: boolean; sx: number; sy: number };

/*
 * Imagem em tela cheia com zoom: pinça (dois dedos), toque duplo, roda do mouse; arrastar move a imagem ampliada.
 * Sem zoom, deslizar para o lado troca de imagem. Fecha no X, em Esc ou no botão Voltar do celular (history).
 */
export function ImageViewer({ src, alt, onClose, onStep }: { src: string; alt: string; onClose: () => void; onStep: (d: number) => void }) {
  const [t, setT] = useState<View>({ s: 1, x: 0, y: 0 });
  const tRef = useRef(t);
  tRef.current = t;
  const box = useRef<HTMLDivElement>(null);
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const [dragging, setDragging] = useState(false);
  const lastTap = useRef(0);
  const [hint, setHint] = useState(true);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => setT({ s: 1, x: 0, y: 0 }), [src]);
  useEffect(() => {
    const id = setTimeout(() => setHint(false), 2600);
    return () => clearTimeout(id);
  }, []);

  // botão "voltar" do celular fecha o visualizador em vez de sair da página
  useEffect(() => {
    history.pushState({ viewer: true }, '');
    const onPop = () => closeRef.current();
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const close = () => {
    if (history.state?.viewer) history.back();
    else onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.stopImmediatePropagation();
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') onStep(1);
      else if (e.key === 'ArrowLeft') onStep(-1);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  /** limita o deslocamento para a imagem não sair da tela */
  const clamp = (s: number, x: number, y: number): View => {
    const r = box.current?.getBoundingClientRect();
    const img = box.current?.querySelector('img');
    if (!r || !img || s <= 1) return { s: Math.max(1, s), x: 0, y: 0 };
    // tamanho exibido da imagem sem zoom (clientWidth ignora o transform)
    const mx = Math.max(0, (img.clientWidth * s - r.width) / 2), my = Math.max(0, (img.clientHeight * s - r.height) / 2);
    return { s, x: Math.min(mx, Math.max(-mx, x)), y: Math.min(my, Math.max(-my, y)) };
  };
  /** zoom em torno de um ponto (cx, cy relativos ao centro da tela) */
  const zoomAt = (s: number, cx: number, cy: number, base: View = tRef.current): View => {
    s = Math.min(6, Math.max(1, s));
    const k = s / base.s;
    return clamp(s, cx - (cx - base.x) * k, cy - (cy - base.y) * k);
  };
  const rel = (x: number, y: number) => {
    const r = box.current!.getBoundingClientRect();
    return { x: x - r.left - r.width / 2, y: y - r.top - r.height / 2 };
  };

  const onDown = (e: React.PointerEvent) => {
    box.current?.setPointerCapture(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = [...pts.current.values()];
    const c = p.length === 2 ? rel((p[0].x + p[1].x) / 2, (p[0].y + p[1].y) / 2) : rel(e.clientX, e.clientY);
    const cur = tRef.current;
    gesture.current = {
      d0: p.length === 2 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0,
      s0: cur.s, cx: c.x, cy: c.y, x0: cur.x, y0: cur.y, moved: p.length === 2, sx: e.clientX, sy: e.clientY,
    };
    setDragging(true);
  };
  const onMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!pts.current.has(e.pointerId) || !g) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = [...pts.current.values()];
    if (p.length === 2 && g.d0) {
      const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      const c = rel((p[0].x + p[1].x) / 2, (p[0].y + p[1].y) / 2);
      const z = zoomAt(g.s0 * (d / g.d0), g.cx, g.cy, { s: g.s0, x: g.x0, y: g.y0 });
      setT(clamp(z.s, z.x + (c.x - g.cx), z.y + (c.y - g.cy)));
    } else if (p.length === 1) {
      const dx = e.clientX - g.sx, dy = e.clientY - g.sy;
      if (Math.abs(dx) + Math.abs(dy) > 6) g.moved = true;
      if (tRef.current.s > 1) setT(clamp(tRef.current.s, g.x0 + dx, g.y0 + dy));
    }
  };
  const onUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    const wasPinch = pts.current.size === 2;
    pts.current.delete(e.pointerId);
    if (!g) return;
    if (pts.current.size === 1) {
      // continua arrastando com o dedo que sobrou
      const [q] = [...pts.current.values()];
      gesture.current = { ...g, d0: 0, x0: tRef.current.x, y0: tRef.current.y, sx: q.x, sy: q.y, moved: true };
      return;
    }
    gesture.current = null;
    setDragging(false);
    if (wasPinch) return;
    const dx = e.clientX - g.sx;
    if (g.moved) {
      if (tRef.current.s <= 1 && Math.abs(dx) > 50) onStep(dx < 0 ? 1 : -1);
      return;
    }
    // toque duplo: aproxima 2,5× no ponto tocado / volta ao normal
    const now = Date.now();
    if (now - lastTap.current < 320) {
      const c = rel(e.clientX, e.clientY);
      setT(tRef.current.s > 1 ? { s: 1, x: 0, y: 0 } : zoomAt(2.5, c.x, c.y));
      lastTap.current = 0;
    } else lastTap.current = now;
  };
  const onWheel = (e: React.WheelEvent) => {
    const c = rel(e.clientX, e.clientY);
    setT(zoomAt(tRef.current.s * Math.exp(-e.deltaY * 0.0015), c.x, c.y));
  };

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={alt}>
      <div
        ref={box}
        className="viewer-stage"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          style={{ transform: `translate3d(${t.x}px, ${t.y}px, 0) scale(${t.s})`, transition: dragging ? 'none' : 'transform 0.25s ease' }}
        />
      </div>
      <div className="viewer-top">
        <span>{alt}</span>
        <button className="icon-btn" onClick={close} aria-label="Fechar imagem"><Icon.close /></button>
      </div>
      {t.s > 1 ? (
        <button className="viewer-reset" onClick={() => setT({ s: 1, x: 0, y: 0 })}>Ver inteira</button>
      ) : (
        hint && <p className="viewer-hint">Use dois dedos ou toque duas vezes para aproximar</p>
      )}
    </div>
  );
}
