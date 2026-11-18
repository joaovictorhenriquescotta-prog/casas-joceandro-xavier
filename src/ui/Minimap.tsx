import { useEffect, useMemo, useRef } from 'react';
import { useStore } from '../store';
import { cameraState } from '../three/runtime';

/** Planta simplificada com a posição e a direção do visitante. */
export function Minimap() {
  const meta = useStore((s) => s.meta)!;
  const current = useStore((s) => s.currentRoom);
  const dot = useRef<SVGGElement>(null);
  const { box, paths } = useMemo(() => {
    const b = meta.houseBounds;
    const pad = 0.8;
    const box = { x: b.min[0] - pad, z: b.min[2] - pad, w: b.max[0] - b.min[0] + pad * 2, h: b.max[2] - b.min[2] + pad * 2 };
    const paths = meta.rooms.map((r) => {
      const f = r.footprint ?? [];
      let d = '';
      for (let i = 0; i < f.length; i += 6) d += `M${f[i]} ${f[i + 1]}L${f[i + 2]} ${f[i + 3]}L${f[i + 4]} ${f[i + 5]}Z`;
      return { id: r.id, d };
    });
    return { box, paths };
  }, [meta]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (dot.current) {
        const { x, z } = cameraState.feet;
        dot.current.setAttribute('transform', `translate(${x} ${z}) rotate(${(-cameraState.yaw * 180) / Math.PI})`);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);

  const goTo = (id: string) => {
    const vp = useStore.getState().viewpoints.find((v) => v.room === id && v.mode === 'caminhar');
    if (vp) useStore.getState().set({ flyTo: { ...vp } });
  };

  return (
    <div className="minimap" aria-label="Planta">
      <svg viewBox={`${box.x} ${box.z} ${box.w} ${box.h}`}>
        {paths.map((p) => (
          <path key={p.id} d={p.d} className={p.id === current ? 'on' : ''} onClick={() => goTo(p.id)}>
            <title>{meta.rooms.find((r) => r.id === p.id)?.label}</title>
          </path>
        ))}
        <g ref={dot}>
          <path d="M0 -0.9 L0.55 0.5 L0 0.2 L-0.55 0.5 Z" className="me" />
        </g>
      </svg>
    </div>
  );
}
