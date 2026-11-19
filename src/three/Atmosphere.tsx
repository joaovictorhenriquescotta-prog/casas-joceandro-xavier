import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Sky, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store';
import { TIME_KEYS, paramsAt, sunDirection } from './timeOfDay';
import { timeState } from './runtime';

const INTERIOR_SKY = new THREE.Color('#ffffff');
const INTERIOR_GROUND = new THREE.Color('#e6e1d9');

/*
 * Ambiente de iluminação indireta (IBL) gerado a partir de um degradê céu/horizonte/chão.
 * Um HDRI fotográfico (parque) tingia de verde as faces voltadas para baixo (beirais)
 * e de azul o gramado; o degradê neutro acompanha o período do dia sem esse viés.
 */
const envMat = new THREE.ShaderMaterial({
  uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, ground: { value: new THREE.Color() } },
  vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 ground; varying vec3 vDir;
    void main(){ float y = vDir.y; vec3 c = y > 0.0 ? mix(horizon, top, pow(y, 0.6)) : mix(horizon, ground, pow(-y, 0.35));
    gl_FragColor = vec4(c, 1.0); }`,
  side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
});
const FOG = { manha: new THREE.Color('#cdd6de'), tarde: new THREE.Color('#e3c7a6'), noite: new THREE.Color('#0d1220') };
const NIGHT_TOP = new THREE.Color('#03060f');
const NIGHT_HORIZON = new THREE.Color('#2a3352');

/** Céu noturno: degradê simples sobreposto ao céu físico conforme a noite cai. */
function makeNightDome() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { top: { value: NIGHT_TOP }, horizon: { value: NIGHT_HORIZON }, opacity: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform float opacity; varying vec3 vDir;
      void main(){ float h = clamp(vDir.y, 0.0, 1.0); vec3 c = mix(horizon, top, pow(h, 0.45));
      if (vDir.y < 0.0) c = horizon * 0.6; gl_FragColor = vec4(c, opacity); }`,
    side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), mat);
  m.renderOrder = -1;
  m.frustumCulled = false;
  return m;
}

export function Atmosphere({ center, radius }: { center: THREE.Vector3; radius: number }) {
  const { gl, scene } = useThree();
  const quality = useStore((s) => s.quality);
  const sun = useRef<THREE.DirectionalLight>(null!);
  const hemi = useRef<THREE.HemisphereLight>(null!);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sky = useRef<any>(null);
  const stars = useRef<THREE.Points>(null!);
  const [envKey, setEnvKey] = useState(-1);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const dome = useMemo(makeNightDome, []);
  const fog = useMemo(() => new THREE.Fog(FOG.tarde.clone(), radius * 3, radius * 22), [radius]);
  useEffect(() => {
    scene.fog = fog;
    return () => {
      scene.fog = null;
    };
  }, [scene, fog]);
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.copy(center);
    return o;
  }, [center]);

  useEffect(() => {
    scene.add(target);
    return () => {
      scene.remove(target);
    };
  }, [scene, target]);

  useFrame((_, dt) => {
    const goal = TIME_KEYS.indexOf(useStore.getState().time);
    // transição suave, cerca de 2,5 s entre períodos
    const diff = goal - timeState.t;
    timeState.t += Math.sign(diff) * Math.min(Math.abs(diff), dt * 0.45);
    const p = paramsAt(timeState.t);
    timeState.night = p.night;

    sunDirection(p, dir);
    const moon = p.sunElevation < 2;
    const light = sun.current;
    if (moon) {
      light.position.copy(center).add(new THREE.Vector3(-0.35, 0.85, 0.4).normalize().multiplyScalar(radius * 2));
      light.intensity = 0.22 * p.night;
      light.color.set('#b4c0e6');
    } else {
      light.position.copy(center).addScaledVector(dir, radius * 2);
      light.intensity = p.sunIntensity;
      light.color.copy(p.sunColor);
    }
    // dentro dos ambientes a luz do céu (IBL) não é bloqueada pelas paredes:
    // reduz o ambiente azulado e usa um preenchimento neutro, como a luz que entra pelas janelas
    const st = useStore.getState();
    const inside = st.mode === 'caminhar' && !!st.currentRoom && !st.meta?.rooms.find((r) => r.id === st.currentRoom && r.type === 'garagem');
    timeState.interior = THREE.MathUtils.damp(timeState.interior, inside ? 1 : 0, 3, dt);
    const k = timeState.interior;
    hemi.current.color.copy(p.hemiSky).lerp(INTERIOR_SKY, k * (1 - p.night));
    hemi.current.groundColor.copy(p.hemiGround).lerp(INTERIOR_GROUND, k * (1 - p.night));
    hemi.current.intensity = THREE.MathUtils.lerp(p.hemiIntensity, (1 - p.night) * 1.15 + 0.05, k);
    gl.toneMappingExposure = p.exposure * (1 + 0.2 * k * (1 - p.night));
    scene.environmentIntensity = p.envIntensity * (1 - 0.35 * k);
    if (sky.current?.material?.uniforms) {
      const u = sky.current.material.uniforms;
      u.sunPosition.value.copy(dir).multiplyScalar(1000);
      u.turbidity.value = p.turbidity;
      u.rayleigh.value = p.rayleigh;
    }
    if (stars.current) stars.current.visible = p.stars > 0.4;
    (dome.material as THREE.ShaderMaterial).uniforms.opacity.value = THREE.MathUtils.smoothstep(p.night, 0.25, 0.9);
    dome.position.copy(center);
    const t = timeState.t;
    if (t <= 1) fog.color.copy(FOG.manha).lerp(FOG.tarde, t);
    else fog.color.copy(FOG.tarde).lerp(FOG.noite, THREE.MathUtils.smoothstep(t - 1, 0, 1));
    // o cubemap do ambiente é refeito em passos de 1/8 do período (barato)
    const key = Math.round(timeState.t * 8);
    if (key !== envKey) {
      const u = envMat.uniforms;
      u.top.value.copy(p.envTop);
      u.horizon.value.copy(p.envHorizon);
      u.ground.value.copy(p.envGround);
      setEnvKey(key);
    }
  });

  const mapSize = quality === 'alta' ? 4096 : quality === 'media' ? 2048 : 1024;
  return (
    <>
      <directionalLight
        ref={sun}
        target={target}
        castShadow={quality !== 'baixa'}
        shadow-mapSize={[mapSize, mapSize]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-radius}
        shadow-camera-right={radius}
        shadow-camera-top={radius}
        shadow-camera-bottom={-radius}
        shadow-camera-near={1}
        shadow-camera-far={radius * 4}
        shadow-radius={4}
      />
      <hemisphereLight ref={hemi} />
      <Sky ref={sky} distance={4500} mieCoefficient={0.004} mieDirectionalG={0.85} />
      <primitive object={dome} />
      <Stars ref={stars} radius={300} depth={60} count={2500} factor={6} fade speed={0.3} />
      {envKey >= 0 && (
        <Environment key={envKey} frames={1} resolution={64}>
          <mesh material={envMat} scale={100}>
            <sphereGeometry args={[1, 32, 16]} />
          </mesh>
        </Environment>
      )}
    </>
  );
}
