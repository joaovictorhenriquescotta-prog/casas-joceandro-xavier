// Visita cinematográfica (botão "Iniciar visita").
// Abertura de drone com as renderizações → planta humanizada interativa → descida até cada ambiente.
// A planta é uma imagem em CSS 3D com uma "câmera" própria (camera.ts); os renders passam no palco (stage.ts).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './tour.css';
import { useStore } from '../store';
import { PROJECT } from '../config/project';
import {
  DEFAULT_SHOT_MS, FACHADA_ON_PLAN, LOT_SHOT, OPENING, PLAN_IMAGE, ROOM_NAMES, ROOM_ORDER, ROOM_SHOTS, type Shot, type Spot,
} from '../config/tour';
import { PLAN_HOUSES, PLAN_ROOMS, PLAN_SIZE } from '../config/tourPlan.generated';
import { camTransform, clampCam, easeInOut, easeOut, fitBox, fly, perspectiveFor, project, projectCam, wait, type Box, type Cam, type Flight } from './camera';
import { Stage, preload, preloadWithin } from './stage';
import { Icon } from '../ui/icons';

interface Stop {
  key: string; type: string; house: string | null; houseLabel: string; label: string; area?: number;
  anchor: [number, number]; box: Box; path?: string; shots: Shot[];
}

function buildStops(): Stop[] {
  const stops: Stop[] = [{
    key: 'fachada', type: 'fachada', house: null, houseLabel: '', label: ROOM_NAMES.fachada,
    anchor: FACHADA_ON_PLAN.anchor, box: FACHADA_ON_PLAN.box, shots: ROOM_SHOTS.fachada ?? [],
  }];
  for (const h of PLAN_HOUSES) {
    for (const type of ROOM_ORDER) {
      const r = PLAN_ROOMS.find((x) => x.house === h.id && x.type === type);
      if (!r) continue;
      stops.push({
        key: r.id, type, house: h.id, houseLabel: h.label, label: ROOM_NAMES[type] ?? r.label, area: r.area,
        anchor: r.anchor, box: r.box, path: r.path, shots: ROOM_SHOTS[r.id] ?? ROOM_SHOTS[type] ?? [],
      });
    }
  }
  return stops;
}

const W = PLAN_SIZE.width, H = PLAN_SIZE.height;
const fmtArea = (a: number) => `${a.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
const shotMs = (s: Shot) => s.ms ?? DEFAULT_SHOT_MS;

type View = 'loading' | 'opening' | 'plan' | 'moving' | 'room' | 'error';

export function Tour() {
  const stops = useMemo(buildStops, []);
  const env = useMemo(() => {
    const mm = (q: string) => typeof matchMedia === 'function' && matchMedia(q).matches;
    const coarse = mm('(pointer: coarse)');
    const reduced = mm('(prefers-reduced-motion: reduce)');
    const nav = navigator as Navigator & { deviceMemory?: number };
    const lowEnd = reduced || (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
    const hi = !coarse && Math.max(screen.width, screen.height) * (devicePixelRatio || 1) > 2200;
    const planSrc = hi ? PLAN_IMAGE.hi : PLAN_IMAGE.lo;
    const k = (hi ? PLAN_IMAGE.hiWidth : PLAN_IMAGE.loWidth) / W;
    return { coarse, reduced, lowEnd, planSrc, k };
  }, []);
  // caixa da planta que interessa: as duas casas e a frente do lote
  const planBox = useMemo<Box>(() => {
    const xs = PLAN_HOUSES.flatMap((h) => [h.box[0], h.box[2]]);
    return [Math.min(...xs) - 120, 0, Math.max(...xs) + 120, H];
  }, []);

  const [view, setView] = useState<View>('loading');
  const [stopIdx, setStopIdx] = useState<number | null>(null);
  const [shotIdx, setShotIdx] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [title, setTitle] = useState(false);
  const [letterbox, setLetterbox] = useState(true);
  const [planVisible, setPlanVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [rotateHint, setRotateHint] = useState(false);
  const [vp, setVp] = useState({ w: innerWidth, h: innerHeight });
  const [zoomSpot, setZoomSpot] = useState<Spot | null>(null);
  const zoomRef = useRef<Spot | null>(null);
  const spotEls = useRef<(HTMLButtonElement | null)[]>([]);
  zoomRef.current = zoomSpot;

  const vpRef = useRef(vp);
  const layerRef = useRef<HTMLDivElement>(null);
  const stageEl = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null);
  const cam = useRef<Cam>({ x: W / 2, y: H / 2, z: 0.3, tilt: 0, rot: 0 });
  const flight = useRef<Flight | null>(null);
  const drift = useRef(0);
  const cycle = useRef(0);
  const seq = useRef(0);
  const pointerType = useRef('mouse');
  const touchX = useRef<number | null>(null);
  const hintShown = useRef(false);
  const viewRef = useRef<View>('loading');
  viewRef.current = view;
  const stopRef = useRef<number | null>(null);
  stopRef.current = stopIdx;
  const shotRef = useRef(0);
  shotRef.current = shotIdx;

  const persp = perspectiveFor(vp.w, vp.h);
  const portrait = vp.h > vp.w * 1.1;

  // ---------------------------------------------------------------- câmera
  const clamp = useCallback((c: Cam) => {
    const { w, h } = vpRef.current;
    return clampCam(c, w, h, perspectiveFor(w, h), { w: W, h: H });
  }, []);

  const applyCam = useCallback((raw: Cam) => {
    const c = clamp(raw);
    cam.current = c;
    const el = layerRef.current;
    if (!el) return;
    const { w, h } = vpRef.current;
    el.style.transform = camTransform(c, w, h, env.k, { w: W, h: H }, perspectiveFor(w, h));
  }, [env.k, clamp]);

  const planCam = useCallback((): Cam => {
    const { w, h } = vpRef.current;
    const rot = h > w * 1.1 ? 90 : 0;
    const fit = fitBox(planBox, w, h, { pad: 1.02, rot });
    const cover = rot ? w / H : h / H; // a altura da imagem sempre preenche a tela
    return clamp({ ...fit, z: Math.max(fit.z, cover), y: H / 2 });
  }, [planBox, clamp]);

  // Enquadramento "de drone" do ambiente: a maior inclinação que ainda deixa o ambiente no centro da tela
  // (nos cômodos da borda da planta a câmera inclina menos, para não enxergar além da imagem).
  const roomCam = useCallback((s: Stop): Cam => {
    const { w, h } = vpRef.current;
    const persp = perspectiveFor(w, h);
    // cômodos pequenos (banheiros) são vistos de um pouco mais alto, com o entorno
    const pad = s.type === 'fachada' ? 1.05 : (s.area ?? 10) < 5 ? 1.5 : 1.25;
    // no celular em pé a vista fica girada 90°, como a planta: o lado comprido do cômodo acompanha a tela
    const base = h > w * 1.1 ? 90 : 0;
    const yaw = env.reduced ? 0 : s.house === PLAN_HOUSES[0]?.id ? -3 : s.house ? 3 : 0;
    const cx = (s.box[0] + s.box[2]) / 2, cy = (s.box[1] + s.box[3]) / 2;
    // inclinação suave: com muita perspectiva a parte da frente da imagem estica e perde nitidez
    const tilts = env.reduced ? [0] : [s.type === 'fachada' ? 20 : 16, 11, 6, 0];
    let best: Cam | null = null;
    // aproximação máxima: 1 pixel da planta carregada por pixel da tela (não amplia além da imagem)
    const zMax = env.k;
    for (const tilt of tilts) {
      const f = fitBox(s.box, w, h, { pad, tilt, rot: base });
      const c0 = { ...f, z: Math.min(f.z, zMax) };
      const lean = (tilt / 16) * 0.03;
      const c = clamp({
        ...c0, rot: base + (tilt ? yaw : 0),
        ...(base ? { x: c0.x - (s.box[2] - s.box[0]) * lean } : { y: c0.y + (s.box[3] - s.box[1]) * lean }),
      });
      const [sx, sy] = projectCam(c, cx, cy, w, h, persp);
      best = c;
      if (sy > h * 0.3 && sy < h * 0.68 && sx > w * 0.22 && sx < w * 0.78) break;
    }
    return best!;
  }, [env.reduced, env.k, clamp]);

  const runFlight = useCallback((from: Cam, to: Cam, ms: number, opts?: Parameters<typeof fly>[4]) => {
    flight.current?.cancel();
    flight.current = fly(from, to, env.reduced ? Math.min(ms, 600) : ms, applyCam, opts);
    return flight.current.done;
  }, [applyCam, env.reduced]);

  const stopDrift = () => { cancelAnimationFrame(drift.current); drift.current = 0; };
  const startDrift = useCallback((base: Cam) => {
    stopDrift();
    if (env.reduced) return;
    const t0 = performance.now();
    const loop = (now: number) => {
      const t = (now - t0) / 1000, e = Math.min(1, t / 3);
      applyCam({
        ...base,
        rot: base.rot + e * 2.4 * Math.sin((t * 2 * Math.PI) / 18),
        z: base.z * (1 + e * 0.035 * Math.sin((t * 2 * Math.PI) / 12)),
        x: base.x + e * 14 * Math.sin((t * 2 * Math.PI) / 15),
      });
      drift.current = requestAnimationFrame(loop);
    };
    drift.current = requestAnimationFrame(loop);
  }, [applyCam, env.reduced]);

  const clearCycle = () => { clearTimeout(cycle.current); cycle.current = 0; };
  const startCycle = useCallback((s: Stop, from = 0) => {
    clearCycle();
    if (s.shots.length < 2) return;
    for (const sh of s.shots) preload(sh.src);
    let i = from;
    const schedule = () => {
      cycle.current = window.setTimeout(async () => {
        i = (i + 1) % s.shots.length;
        setShotIdx(i);
        await stage.current?.show(s.shots[i], 'through', shotMs(s.shots[i]));
        if (cycle.current) schedule();
      }, shotMs(s.shots[i]) - 900);
    };
    schedule();
  }, []);

  const maybeRotateHint = useCallback(() => {
    const { w, h } = vpRef.current;
    if (hintShown.current || h < w * 1.1) return;
    hintShown.current = true;
    setRotateHint(true);
    setTimeout(() => setRotateHint(false), 4200);
  }, []);

  // ---------------------------------------------------------------- sequências
  const enterPlan = useCallback(async (animated: boolean) => {
    const target = planCam();
    setLetterbox(false);
    setTitle(false);
    if (animated && !env.reduced) {
      applyCam({ ...target, z: target.z * 1.08, tilt: 12 });
      setPlanVisible(true);
      stage.current?.hide('fade', 1200);
      await runFlight(cam.current, target, 1900, { ease: easeOut });
    } else {
      applyCam(target);
      setPlanVisible(true);
      stage.current?.hide('fade', 500);
    }
    setStopIdx(null);
    setView('plan');
    // só a 1ª imagem de cada ambiente; as demais são baixadas ao entrar no ambiente
    for (const list of Object.values(ROOM_SHOTS)) if (list[0]) preload(list[0].src);
  }, [applyCam, env.reduced, planCam, runFlight]);

  const runOpening = useCallback(async () => {
    const my = ++seq.current;
    const alive = () => seq.current === my;
    const first = await preloadWithin(OPENING[0].src, 12000);
    for (const s of [...OPENING.slice(1), LOT_SHOT]) preload(s.src);
    preload(env.planSrc);
    if (!alive()) return;
    const st = stage.current!;
    if (!first) { await preloadWithin(env.planSrc, 15000); if (alive()) await enterPlan(false); return; }
    setView('opening');
    for (let i = 0; i < OPENING.length; i++) {
      const s = OPENING[i], ms = shotMs(s);
      if (i > 0 && !(await preloadWithin(s.src, 6000))) continue;
      if (!alive()) return;
      await st.show(s, i === 0 ? 'fade' : 'through', ms, i === 0 ? 1800 : 1300);
      if (!alive()) return;
      if (i === 1) setTitle(true);
      if (i === OPENING.length - 1) setTimeout(() => alive() && setTitle(false), ms * 0.6);
      await wait(ms - 900);
      if (!alive()) return;
    }
    // o drone sobe da fachada até o lote inteiro e desce até a planta
    if (await preloadWithin(LOT_SHOT.src, 5000)) {
      if (!alive()) return;
      await st.show(LOT_SHOT, 'rise', shotMs(LOT_SHOT), 1400);
    }
    const planOk = await preloadWithin(env.planSrc, 20000);
    await wait(Math.max(0, shotMs(LOT_SHOT) - 1300));
    if (!alive()) return;
    if (!planOk && !(await preload(env.planSrc))) { setView('error'); return; }
    await enterPlan(true);
  }, [enterPlan, env.planSrc]);

  const goTo = useCallback(async (idx: number) => {
    const s = stops[idx];
    if (!s) return;
    const my = ++seq.current;
    const alive = () => seq.current === my;
    stopDrift(); clearCycle();
    setSelected(null); setHover(null);
    setView('moving'); setStopIdx(idx); setShotIdx(0);
    const st = stage.current!;
    const target = roomCam(s);
    // já dentro de um render: passa direto para o render do próximo ambiente, sem voltar à planta
    if (st.visible && s.shots.length && (await preloadWithin(s.shots[0].src, 8000))) {
      if (!alive()) return;
      applyCam(target);
      await st.show(s.shots[0], 'fade', shotMs(s.shots[0]), 1000);
      if (!alive()) return;
      setView('room');
      startCycle(s);
      return;
    }
    if (st.visible) { setPlanVisible(true); await st.hide('back', 900); }
    if (!alive()) return;
    const from = cam.current;
    const fromPlan = from.tilt < 1;
    const dist = Math.hypot(target.x - from.x, target.y - from.y);
    const ms = fromPlan ? 2000 : Math.min(2200, Math.max(1400, 1100 + dist * 0.4));
    await runFlight(from, target, ms, { arc: fromPlan ? 0 : Math.min(0.45, dist / 4200), ease: easeInOut });
    if (!alive()) return;
    if (s.shots.length && (await preloadWithin(s.shots[0].src, 8000))) {
      if (!alive()) return;
      // o ambiente fica destacado na planta por um instante e o render entra com transição suave
      await wait(env.reduced ? 0 : 450);
      if (!alive()) return;
      runFlight(target, { ...target, z: target.z * 1.04 }, 1100, { ease: easeOut });
      const shown = st.show(s.shots[0], 'fade', shotMs(s.shots[0]), 1100);
      setTimeout(() => alive() && setPlanVisible(false), 1100);
      await shown;
      if (!alive()) return;
      setView('room');
      startCycle(s);
      maybeRotateHint();
    } else {
      setView('room');
      startDrift(target);
    }
  }, [stops, roomCam, runFlight, env.reduced, startCycle, startDrift, maybeRotateHint]);

  const step = useCallback((d: number) => {
    const cur = stopRef.current ?? (d > 0 ? -1 : 0);
    goTo((cur + d + stops.length) % stops.length);
  }, [goTo, stops.length]);

  /** Troca manual de imagem dentro do ambiente (setas laterais, bolinhas, teclado, deslize). Retoma a troca automática. */
  const showShot = useCallback(async (i: number) => {
    const idx = stopRef.current;
    if (idx === null || viewRef.current !== 'room') return;
    const s = stops[idx];
    const n = s.shots.length;
    if (n < 2) return;
    const k = ((i % n) + n) % n;
    const my = ++seq.current;
    clearCycle();
    setShotIdx(k);
    await stage.current?.show(s.shots[k], 'fade', shotMs(s.shots[k]), 700);
    if (seq.current === my) startCycle(s, k);
  }, [stops, startCycle]);

  /** Próxima/anterior imagem; na última (ou única) imagem passa para o ambiente vizinho. */
  const flip = useCallback((d: number) => {
    const idx = stopRef.current;
    const s = idx !== null ? stops[idx] : null;
    if (viewRef.current === 'room' && s && s.shots.length > 1) {
      const next = shotRef.current + d;
      if (next >= 0 && next < s.shots.length) { showShot(next); return; }
    }
    step(d);
  }, [stops, showShot, step]);

  const backToPlan = useCallback(async () => {
    const my = ++seq.current;
    stopDrift(); clearCycle();
    setView('moving');
    const st = stage.current!;
    if (st.visible) { setPlanVisible(true); await st.hide('back', 900); }
    if (seq.current !== my) return;
    await runFlight(cam.current, planCam(), 1900, { ease: easeInOut });
    if (seq.current !== my) return;
    setStopIdx(null);
    setView('plan');
  }, [planCam, runFlight]);

  const skip = useCallback(() => {
    ++seq.current;
    setTitle(false);
    preloadWithin(env.planSrc, 20000).then((ok) => (ok ? enterPlan(false) : setView('error')));
  }, [enterPlan, env.planSrc]);

  const close = useCallback(() => {
    ++seq.current;
    flight.current?.cancel(); stopDrift(); clearCycle();
    setClosing(true);
    setTimeout(() => useStore.getState().set({ phase: 'intro' }), 650);
  }, []);

  const open3d = useCallback((room?: string) => {
    ++seq.current;
    flight.current?.cancel(); stopDrift(); clearCycle();
    useStore.getState().set({ pendingRoom: room ?? null, phase: 'carregando' });
  }, []);

  // ---------------------------------------------------------------- pontos clicáveis sobre o render
  const openSpot = useCallback((sp: Spot) => { clearCycle(); setZoomSpot(sp); }, []);
  const closeSpot = useCallback(() => {
    setZoomSpot(null);
    const idx = stopRef.current;
    if (idx !== null && viewRef.current === 'room') startCycle(stops[idx], shotRef.current);
  }, [stops, startCycle]);

  // ---------------------------------------------------------------- ciclo de vida
  useEffect(() => {
    stage.current = new Stage(stageEl.current!, { blur: !env.lowEnd, reduced: env.reduced });
    runOpening();
    return () => {
      ++seq.current;
      flight.current?.cancel();
      cancelAnimationFrame(drift.current);
      clearTimeout(cycle.current);
    };
  }, [env, runOpening]);

  useEffect(() => {
    const onResize = () => {
      const next = { w: innerWidth, h: innerHeight };
      vpRef.current = next;
      setVp(next);
      const v = viewRef.current;
      if (v === 'plan') applyCam(planCam());
      else if (v === 'room' && stopRef.current !== null) {
        const s = stops[stopRef.current];
        if (stage.current?.visible) stage.current.resize();
        else startDrift(roomCam(s));
      } else applyCam(cam.current);
    };
    addEventListener('resize', onResize);
    return () => removeEventListener('resize', onResize);
  }, [applyCam, planCam, roomCam, startDrift, stops]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const v = viewRef.current;
      if (zoomRef.current) { if (e.key === 'Escape' || e.key === 'Backspace') closeSpot(); return; }
      if (e.key === 'Escape') { if (v === 'room' || v === 'moving') backToPlan(); else close(); }
      else if (v === 'opening' || v === 'loading') { if (e.key === ' ' || e.key === 'Enter') skip(); }
      else if (e.key === 'ArrowRight') flip(1);
      else if (e.key === 'ArrowLeft') flip(-1);
      else if (e.key.toLowerCase() === 'p' && v !== 'plan') backToPlan();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [backToPlan, close, skip, flip, closeSpot]);

  // pontos clicáveis acompanham a imagem enquanto ela se move (aproximação lenta / panorâmica)
  useEffect(() => {
    const spots = view === 'room' && stopIdx !== null ? stops[stopIdx].shots[shotIdx]?.spots : undefined;
    if (!spots?.length) return;
    let raf = 0;
    const loop = () => {
      const el = stage.current?.element;
      if (el) {
        const r = el.getBoundingClientRect();
        const { w, h } = vpRef.current;
        spots.forEach((sp, i) => {
          const b = spotEls.current[i];
          if (!b) return;
          const x = r.left + sp.x * r.width, y = r.top + sp.y * r.height;
          b.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
          b.classList.toggle('off', x < 24 || x > w - 24 || y < 70 || y > h - 130);
        });
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [view, stopIdx, shotIdx, stops]);

  // ---------------------------------------------------------------- interação com a planta
  const tapStop = (s: Stop) => {
    if (viewRef.current !== 'plan') return;
    const idx = stops.indexOf(s);
    if (pointerType.current !== 'mouse' && selected !== s.key) { setSelected(s.key); return; }
    goTo(idx);
  };

  const current = stopIdx !== null ? stops[stopIdx] : null;
  const pc = planCam();
  const marks = stops.map((s) => ({ s, p: project(pc, s.anchor[0], s.anchor[1], vp.w, vp.h) }));
  // nome de cada casa na frente do lote (o topo da planta é ocupado pelos banheiros)
  const houseTags = PLAN_HOUSES.map((h) => {
    const [x0, , x1] = h.box;
    return { h, p: project(pc, (x0 + x1) / 2, portrait ? H - 440 : H - 170, vp.w, vp.h) };
  });
  const active = hover ?? selected;
  const inRoom = view === 'room' || (view === 'moving' && current !== null);
  const hasRender = !!current?.shots.length;
  const shot = hasRender ? current!.shots[shotIdx] : null;

  return (
    <div
      className={`tour ${closing ? 'is-closing' : ''} view-${view} ${portrait ? 'is-portrait' : ''}`}
      onPointerDown={(e) => (pointerType.current = e.pointerType)}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null || viewRef.current !== 'room' || zoomRef.current) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 60) flip(dx < 0 ? 1 : -1);
      }}
      role="application"
      aria-label="Visita virtual cinematográfica"
    >
      {/* planta humanizada em CSS 3D */}
      <div className="tour-plan" style={{ perspective: `${persp}px`, opacity: planVisible ? 1 : 0 }}>
        <div className="tour-plan-layer" ref={layerRef} style={{ width: W * env.k, height: H * env.k }}>
          <img src={env.planSrc} alt="Planta humanizada das duas casas" draggable={false} />
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="tour-hot">
            {stops.filter((s) => s.path).map((s) => (
              <path
                key={s.key}
                d={s.path}
                className={`${active === s.key ? 'on' : ''} ${current?.key === s.key ? 'current' : ''}`}
                onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(s.key)}
                onPointerLeave={(e) => e.pointerType === 'mouse' && setHover((h) => (h === s.key ? null : h))}
                onClick={() => tapStop(s)}
              />
            ))}
          </svg>
        </div>
      </div>

      {/* renderizações em tela cheia */}
      <div className="tour-stage" ref={stageEl} aria-live="polite">
        <img alt="" draggable={false} />
        <img alt="" draggable={false} />
      </div>

      <div className="tour-vignette" />
      <div className={`tour-letterbox ${letterbox ? 'on' : ''}`}><i /><i /></div>

      {/* marcadores dos ambientes */}
      <div className={`tour-marks ${view === 'plan' ? 'on' : ''}`}>
        {houseTags.map(({ h, p }) => (
          <span key={h.id} className="tour-house" style={{ left: p[0], top: p[1] }}>{h.label}</span>
        ))}
        {marks.map(({ s, p }) => (
          <button
            key={s.key}
            className={`tour-mark ${active === s.key ? 'on' : ''} ${s.type === 'fachada' ? 'is-fachada' : ''}`}
            style={{ left: p[0], top: p[1] }}
            onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(s.key)}
            onPointerLeave={(e) => e.pointerType === 'mouse' && setHover((h) => (h === s.key ? null : h))}
            onClick={() => tapStop(s)}
            aria-label={`Entrar: ${s.houseLabel ? `${s.houseLabel}, ` : ''}${s.label}`}
            tabIndex={view === 'plan' ? 0 : -1}
          >
            <span className="dot" />
            <span className="tag">
              <strong>{s.label}</strong>
              {s.area ? <small>{fmtArea(s.area)}</small> : null}
              <em>{env.coarse ? 'Toque para entrar' : 'Clique para entrar'}</em>
            </span>
          </button>
        ))}
      </div>

      {/* cabeçalho */}
      <div className="tour-top">
        <div className={`tour-brand ${view === 'opening' ? 'dim' : ''}`}>
          <span>{PROJECT.name}</span>
          <small>{view === 'plan' ? 'Planta humanizada' : inRoom && current ? (current.houseLabel || 'Área externa') : 'Visita virtual'}</small>
        </div>
        <div className="tour-actions">
          {(view === 'room' || view === 'moving') && (
            <button className="tour-icon" onClick={backToPlan} aria-label="Voltar para a planta" title="Planta"><Icon.plan /></button>
          )}
          {(view === 'plan' || view === 'room' || view === 'moving') && (
            <button className="tour-icon" onClick={() => goTo(0)} aria-label="Voltar para a fachada" title="Fachada"><Icon.home /></button>
          )}
          <button className="tour-icon" onClick={close} aria-label="Encerrar visita" title="Encerrar"><Icon.close /></button>
        </div>
      </div>

      {/* título da abertura */}
      <div className={`tour-title ${title ? 'on' : ''}`}>
        <p>Visita virtual</p>
        <h2>{PROJECT.name}</h2>
        <span>{PROJECT.location}</span>
      </div>

      {(view === 'loading' || view === 'opening') && (
        <button className="tour-skip" onClick={skip}>Pular apresentação <Icon.chevR /></button>
      )}
      {view === 'loading' && (
        <div className="tour-loading"><span>Preparando a visita</span><i /></div>
      )}
      {view === 'error' && (
        <div className="tour-error">
          <p>Não foi possível carregar as imagens da visita. Verifique a conexão e tente de novo.</p>
          <button className="btn-primary small" onClick={close}>Voltar</button>
        </div>
      )}

      {/* planta: dica e acesso ao modelo 3D */}
      <div className={`tour-plan-ui ${view === 'plan' ? 'on' : ''}`}>
        <p className="tour-hint">{env.coarse ? 'Toque em um ambiente para entrar' : 'Clique em um ambiente para entrar'}</p>
        <button className="tour-link" onClick={() => open3d()}><Icon.cube /> Modelo 3D interativo</button>
      </div>

      {/* ambiente: indicador e navegação */}
      <div className={`tour-room-ui ${inRoom && current ? 'on' : ''}`}>
        {hasRender && current!.shots.length > 1 && (
          <div className="tour-dots">
            {current!.shots.map((s, i) => (
              <button key={s.src} className={i === shotIdx ? 'on' : ''} onClick={() => showShot(i)} aria-label={`Imagem ${i + 1} de ${current!.shots.length}`} />
            ))}
          </div>
        )}
        {shot?.caption && view === 'room' && <p className="tour-caption" key={shot.src}>{shot.caption}</p>}
        <div className="tour-bar">
          <button className="tour-nav" onClick={() => step(-1)} aria-label="Ambiente anterior"><Icon.chevL /></button>
          <div className="tour-where">
            {current?.houseLabel && <small>{current.houseLabel}</small>}
            <strong>{current?.label}</strong>
            {current?.area ? <span>{fmtArea(current.area)}</span> : null}
          </div>
          <button className="tour-nav" onClick={() => step(1)} aria-label="Próximo ambiente"><Icon.chevR /></button>
        </div>
        {view === 'room' && current && !hasRender && (
          <button className="tour-link tour-3d" onClick={() => open3d(current.key)}><Icon.cube /> Ver este ambiente em 3D</button>
        )}
      </div>

      {/* pontos clicáveis sobre o render (ex.: livro na suíte da Casa 2) */}
      {view === 'room' && shot?.spots?.map((sp, i) => (
        <button key={shot.src + i} ref={(el) => { spotEls.current[i] = el; }} className="tour-spot off" onClick={() => openSpot(sp)} aria-label={`Abrir: ${sp.label}`}>
          <i />
          <span>{sp.cta ?? 'Ver'}</span>
        </button>
      ))}
      {zoomSpot && (
        <div className="tour-zoom" role="dialog" aria-modal="true" aria-label={zoomSpot.label} onClick={closeSpot}>
          <img src={zoomSpot.image} alt={zoomSpot.label} onClick={(e) => e.stopPropagation()} />
          <p>{zoomSpot.label}</p>
          <button className="tour-zoom-back" onClick={closeSpot} autoFocus><Icon.chevL /> Voltar</button>
        </div>
      )}

      {/* setas laterais: trocar a imagem do ambiente */}
      {view === 'room' && hasRender && current!.shots.length > 1 && (
        <>
          <button className="tour-side left" onClick={() => showShot(shotIdx - 1)} aria-label="Imagem anterior"><Icon.chevL /></button>
          <button className="tour-side right" onClick={() => showShot(shotIdx + 1)} aria-label="Próxima imagem"><Icon.chevR /></button>
        </>
      )}

      <div className={`tour-rotate ${rotateHint ? 'on' : ''}`}>Gire o celular para ver a imagem inteira</div>
      <div className="tour-fade" />
    </div>
  );
}
