import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';
import { useStore } from '../store';
import { cameraState, physics } from './runtime';
import { input } from './input';
import { roomAt } from './rooms';

THREE.Mesh.prototype.raycast = acceleratedRaycast;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;

const RADIUS = 0.22;
const STEP = 0.32;
const WALK = 1.35;
const RUN = 2.6;

const tmpBox = new THREE.Box3();
const tmpSeg = new THREE.Line3();
const triPoint = new THREE.Vector3();
const capPoint = new THREE.Vector3();
const down = new THREE.Vector3(0, -1, 0);
const ray = new THREE.Raycaster();
ray.firstHitOnly = true;

interface Flight {
  curve: THREE.CatmullRomCurve3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  t: number;
  duration: number;
  done: () => void;
}

function ensureBVH(meshes: THREE.Mesh[]) {
  for (const m of meshes) {
    const g = m.geometry as unknown as { boundsTree?: MeshBVH; index: unknown };
    if (!g.boundsTree && g.index) g.boundsTree = new MeshBVH(m.geometry, { targetLeafSize: 12 });
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
  }
}

export function Navigation() {
  const { camera, gl } = useThree();
  const controls = useRef<CameraControls>(null!);
  const mode = useStore((s) => s.mode);
  const flight = useRef<Flight | null>(null);
  const vel = useRef(new THREE.Vector3());
  const lastRoomCheck = useRef(0);

  // BVH para colisão e raycast rápido (feito uma vez, por partes, sem travar a tela)
  useEffect(() => {
    let cancelled = false;
    const list = [...physics.colliders, ...physics.dynamic];
    const step = () => {
      if (cancelled) return;
      const t0 = performance.now();
      while (list.length && performance.now() - t0 < 12) ensureBVH([list.pop()!]);
      if (list.length) requestAnimationFrame(step);
      else physics.ready = true;
    };
    step();
    return () => {
      cancelled = true;
    };
  }, []);

  // olhar com o mouse / dedo no modo caminhar
  useEffect(() => {
    const el = gl.domElement;
    let dragging = false, lx = 0, ly = 0, id = -1;
    const down = (e: PointerEvent) => {
      if (useStore.getState().mode !== 'caminhar' || cameraState.transitioning) return;
      // no celular, a metade esquerda é do joystick
      if (e.pointerType === 'touch' && e.clientX < window.innerWidth * 0.45) return;
      dragging = true; lx = e.clientX; ly = e.clientY; id = e.pointerId;
    };
    const move = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== id) return;
      const s = e.pointerType === 'touch' ? 0.006 : 0.0032;
      cameraState.yaw -= (e.clientX - lx) * s;
      cameraState.pitch = THREE.MathUtils.clamp(cameraState.pitch - (e.clientY - ly) * s, -1.2, 1.2);
      lx = e.clientX; ly = e.clientY;
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId === id) dragging = false;
    };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [gl]);

  // ao trocar de modo manualmente
  useEffect(() => {
    if (cameraState.transitioning) return;
    if (mode === 'caminhar') {
      const s = useStore.getState();
      const dir = camera.getWorldDirection(new THREE.Vector3());
      cameraState.yaw = Math.atan2(-dir.x, -dir.z);
      cameraState.pitch = 0;
      // se a câmera está no alto, desce até o piso mais próximo do alvo
      const target = controls.current?.getTarget(new THREE.Vector3()) ?? camera.position.clone();
      const meta = s.meta!;
      const r = roomAt(meta, target.x, target.y, target.z) ?? meta.rooms.find((x) => x.type === 'estar')!;
      const p = camera.position.y - r.floorY > 4 ? new THREE.Vector3((r.min[0] + r.max[0]) / 2, r.floorY, (r.min[2] + r.max[2]) / 2) : camera.position.clone().setY(camera.position.y - s.eyeHeight);
      cameraState.feet.copy(p);
    } else if (controls.current) {
      const dir = camera.getWorldDirection(new THREE.Vector3());
      controls.current.setLookAt(camera.position.x, camera.position.y, camera.position.z, camera.position.x + dir.x * 4, camera.position.y + dir.y * 4, camera.position.z + dir.z * 4, false);
    }
  }, [mode, camera]);

  // transições cinematográficas para os pontos de vista
  useEffect(
    () =>
      useStore.subscribe((s, prev) => {
        if (!s.flyTo || s.flyTo === prev.flyTo) return;
        const vp = s.flyTo;
        const from = camera.position.clone();
        const fromTarget = from.clone().add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(5));
        const to = new THREE.Vector3(...vp.position);
        const toTarget = new THREE.Vector3(...vp.target);
        const dist = from.distanceTo(to);
        const lift = dist > 5 ? Math.min(9, 2 + dist * 0.35) : 0;
        const mid = from.clone().lerp(to, 0.5);
        mid.y = Math.max(from.y, to.y) + lift;
        const pts = lift ? [from, mid, to] : [from, to];
        cameraState.transitioning = true;
        flight.current = {
          curve: new THREE.CatmullRomCurve3(pts, false, 'centripetal'),
          fromTarget, toTarget, t: 0,
          duration: THREE.MathUtils.clamp(1.4 + dist * 0.06, 1.6, 3.4),
          done: () => {
            cameraState.transitioning = false;
            const st = useStore.getState();
            if (vp.mode === 'caminhar') {
              cameraState.feet.copy(to).setY(to.y - st.eyeHeight);
              const d = toTarget.clone().sub(to);
              cameraState.yaw = Math.atan2(-d.x, -d.z);
              cameraState.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
            } else {
              controls.current?.setLookAt(to.x, to.y, to.z, toTarget.x, toTarget.y, toTarget.z, false);
            }
            st.set({ mode: vp.mode, flyTo: null, currentRoom: vp.room ?? null });
          },
        };
      }),
    [camera],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const s = useStore.getState();
    const f = flight.current;
    if (f) {
      f.t = Math.min(1, f.t + Math.min(rawDt, 0.25) / f.duration);
      const k = f.t < 0.5 ? 4 * f.t * f.t * f.t : 1 - Math.pow(-2 * f.t + 2, 3) / 2;
      camera.position.copy(f.curve.getPointAt(k));
      camera.lookAt(f.fromTarget.clone().lerp(f.toTarget, Math.min(1, k * 1.15)));
      if (f.t >= 1) {
        flight.current = null;
        f.done();
      }
      return;
    }
    if (s.mode !== 'caminhar') return;

    // --- movimento em primeira pessoa ---
    const fwd = (input.keys.has('w') || input.keys.has('arrowup') ? 1 : 0) - (input.keys.has('s') || input.keys.has('arrowdown') ? 1 : 0) + input.joy.y;
    const side = (input.keys.has('d') ? 1 : 0) - (input.keys.has('a') ? 1 : 0) + input.joy.x;
    if (input.keys.has('arrowleft')) cameraState.yaw += dt * 1.6;
    if (input.keys.has('arrowright')) cameraState.yaw -= dt * 1.6;
    const speed = input.keys.has('shift') ? RUN : WALK;
    const wish = new THREE.Vector3(side, 0, -fwd);
    if (wish.lengthSq() > 1) wish.normalize();
    wish.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraState.yaw).multiplyScalar(speed);
    vel.current.x = THREE.MathUtils.damp(vel.current.x, wish.x, 10, dt);
    vel.current.z = THREE.MathUtils.damp(vel.current.z, wish.z, 10, dt);

    const feet = cameraState.feet;
    feet.x += vel.current.x * dt;
    feet.z += vel.current.z * dt;

    if (physics.ready) {
      // colisão: cápsula do pé+degrau até a cabeça
      const height = s.eyeHeight + 0.12;
      tmpSeg.start.set(feet.x, feet.y + STEP + RADIUS, feet.z);
      tmpSeg.end.set(feet.x, feet.y + height - RADIUS, feet.z);
      tmpBox.makeEmpty().expandByPoint(tmpSeg.start).expandByPoint(tmpSeg.end).expandByScalar(RADIUS);
      for (const m of physics.colliders) collide(m, tmpBox);
      for (const m of physics.dynamic) collide(m, tmpBox);
      feet.x = tmpSeg.start.x;
      feet.z = tmpSeg.start.z;

      // piso e degraus
      ray.set(new THREE.Vector3(feet.x, feet.y + STEP + 0.4, feet.z), down);
      ray.far = STEP + 3;
      const hit = ray.intersectObjects(physics.colliders, false)[0];
      if (hit && hit.point.y <= feet.y + STEP + 0.05) {
        vel.current.y = 0;
        feet.y = THREE.MathUtils.damp(feet.y, hit.point.y, 14, dt);
      } else {
        vel.current.y -= 9.8 * dt;
        feet.y += vel.current.y * dt;
      }
    }

    camera.position.set(feet.x, feet.y + s.eyeHeight, feet.z);
    camera.rotation.set(cameraState.pitch, cameraState.yaw, 0, 'YXZ');

    lastRoomCheck.current += dt;
    if (lastRoomCheck.current > 0.4 && s.meta) {
      lastRoomCheck.current = 0;
      const r = roomAt(s.meta, feet.x, feet.y + 0.5, feet.z);
      if ((r?.id ?? null) !== s.currentRoom) s.set({ currentRoom: r?.id ?? null });
    }
  });

  return <CameraControls ref={controls} enabled={mode === 'orbita'} makeDefault minDistance={1} maxDistance={120} maxPolarAngle={Math.PI * 0.49} smoothTime={0.35} />;
}

const inv = new THREE.Matrix4();
const localBox = new THREE.Box3();
const localSeg = new THREE.Line3();
function collide(mesh: THREE.Mesh, worldBox: THREE.Box3) {
  if (!mesh.visible) return;
  const g = mesh.geometry as unknown as { boundsTree?: MeshBVH; boundingBox: THREE.Box3 | null };
  if (!g.boundsTree) return;
  inv.copy(mesh.matrixWorld).invert();
  localBox.copy(worldBox).applyMatrix4(inv);
  if (g.boundingBox && !g.boundingBox.intersectsBox(localBox)) return;
  localSeg.copy(tmpSeg).applyMatrix4(inv);
  // raio em espaço local (escala uniforme aproximada)
  const scale = new THREE.Vector3().setFromMatrixScale(mesh.matrixWorld);
  const r = RADIUS / ((Math.abs(scale.x) + Math.abs(scale.z)) / 2);
  const box = new THREE.Box3().expandByPoint(localSeg.start).expandByPoint(localSeg.end).expandByScalar(r);
  let moved = false;
  g.boundsTree.shapecast({
    intersectsBounds: (b) => b.intersectsBox(box),
    intersectsTriangle: (tri) => {
      const d = tri.closestPointToSegment(localSeg, triPoint, capPoint);
      if (d < r) {
        const depth = r - d;
        const dir = capPoint.sub(triPoint).normalize();
        dir.y = 0; // empurra só na horizontal (o piso é tratado à parte)
        if (dir.lengthSq() < 1e-6) return;
        dir.normalize();
        localSeg.start.addScaledVector(dir, depth);
        localSeg.end.addScaledVector(dir, depth);
        moved = true;
      }
    },
  });
  if (moved) {
    localSeg.applyMatrix4(mesh.matrixWorld);
    tmpSeg.start.x = localSeg.start.x;
    tmpSeg.start.z = localSeg.start.z;
    tmpSeg.end.x = localSeg.end.x;
    tmpSeg.end.z = localSeg.end.z;
  }
}
