/**
 * ============================================================================
 * QUÉ HACE:
 * Orquestador de cliente (TypeScript + Three.js) para el visor 3D interactivo
 * del paquete Doypack GoManía dentro de `Pouch3DViewer.astro`.
 * - Monta la escena fotográfica blanca con iluminación de 3 puntos y
 *   entorno `RoomEnvironment`.
 * - Adapta cámara y renderer al tamaño exacto del contenedor mediante
 *   `ResizeObserver`.
 * - Pausa el bucle de renderizado cuando el visor sale del viewport o la
 *   pestaña está oculta.
 * - Activa automáticamente el slot `fallback` si WebGL no está disponible.
 *
 * CON QUÉ MÓDULO CONECTA:
 * - Usa `./pouch-constants`, `./pouch-geometry`, `./pouch-textures` y
 *   `./pouch-marshmallows`.
 * - Montado desde `src/features/landing-shell/ui/Pouch3DViewer.astro`.
 * ============================================================================
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  PASTEL_PALETTE,
  POUCH_CONFIG,
  type CameraViewPreset,
  type PouchViewerState,
} from './pouch-constants';
import {
  buildBottomGussetGeometry,
  buildEuroHoleRimGeometry,
  buildPouchPanelGeometry,
  buildSeamEdgesGeometry,
} from './pouch-geometry';
import { populateMarshmallowsStrictlyInside } from './pouch-marshmallows';
import {
  createBackTextures,
  createBlueGussetTexture,
  createFrontTextures,
  createPouchBumpTexture,
} from './pouch-textures';

const HERO_CAM_POS = new THREE.Vector3(0.45, 2.2, 7.35);
const HERO_TARGET = new THREE.Vector3(0, POUCH_CONFIG.halfH - 0.12, 0);

/**
 * Inicializa el visor 3D dentro de `rootEl` (`[data-pouch3d-viewer]`).
 * Retorna una función de limpieza para liberar recursos WebGL/observers.
 */
export async function initPouch3DViewer(rootEl: HTMLElement): Promise<() => void> {
  const canvasContainer = rootEl.querySelector<HTMLElement>('[data-pouch3d-canvas]');
  const loaderEl = rootEl.querySelector<HTMLElement>('[data-pouch3d-loader]');
  const dragHintEl = rootEl.querySelector<HTMLElement>('[data-pouch3d-hint]');
  const fallbackEl = rootEl.querySelector<HTMLElement>('[data-pouch3d-fallback]');
  const btnAutoRotate = rootEl.querySelector<HTMLButtonElement>('[data-pouch3d-autorotate]');
  const btnColors = rootEl.querySelector<HTMLButtonElement>('[data-pouch3d-colors]');
  const iconPause = rootEl.querySelector<SVGElement>('[data-pouch3d-icon-pause]');
  const iconPlay = rootEl.querySelector<SVGElement>('[data-pouch3d-icon-play]');
  const labelColors = rootEl.querySelector<HTMLElement>('[data-pouch3d-label-colors]');
  const speedSlider = rootEl.querySelector<HTMLInputElement>('[data-pouch3d-speed]');
  const viewButtons = rootEl.querySelectorAll<HTMLButtonElement>('[data-pouch3d-view]');

  if (!canvasContainer) {
    return () => {};
  }

  const activateFallback = (): void => {
    if (loaderEl) loaderEl.hidden = true;
    if (dragHintEl) dragHintEl.hidden = true;
    const toolbarEl = rootEl.querySelector<HTMLElement>('[data-pouch3d-toolbar]');
    if (toolbarEl) toolbarEl.hidden = true;
    if (canvasContainer) canvasContainer.hidden = true;
    if (fallbackEl) fallbackEl.hidden = false;
  };

  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Continuar con tipografías de respaldo si falla la carga de fuentes
    }
  }

  let renderer: THREE.WebGLRenderer;
  const isTransparent = rootEl.dataset.pouch3dTransparent === 'true';

  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: isTransparent,
      powerPreference: 'high-performance',
    });
  } catch (error) {
    console.warn('[Pouch3DViewer] WebGL no disponible, activando fallback:', error);
    activateFallback();
    return () => {};
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state: PouchViewerState = {
    autoRotate: !prefersReducedMotion,
    animateColors: !prefersReducedMotion,
    colorSpeed: 1.0,
    colorTime: 0,
    cameraAnim: null,
  };

  const scene = new THREE.Scene();
  if (isTransparent) {
    scene.background = null;
    renderer.setClearColor(0x000000, 0);
  } else {
    scene.background = new THREE.Color(0xffffff);
  }

  const initialWidth = Math.max(1, canvasContainer.clientWidth);
  const initialHeight = Math.max(1, canvasContainer.clientHeight);
  const camera = new THREE.PerspectiveCamera(34, initialWidth / initialHeight, 0.1, 60);
  camera.position.copy(HERO_CAM_POS);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(initialWidth, initialHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.86;
  renderer.shadowMap.enabled = false;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  canvasContainer.appendChild(renderer.domElement);

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  const envRT = pmremGenerator.fromScene(roomEnv, 0.045);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.45;
  roomEnv.dispose();
  pmremGenerator.dispose();

  // Iluminación de estudio calibrada (sin sombras proyectadas, reflejos suaves para preservar el color)
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0xf2f4f8, 0.52);
  hemiLight.position.set(0, 10, 0);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfffdf9, 0.95);
  keyLight.position.set(3.8, 6.8, 5.2);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xf3f8ff, 0.48);
  fillLight.position.set(-4.6, 3.2, 4.0);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xfffdf9, 0.95);
  rimLight.position.set(-3.8, 6.8, -5.2);
  scene.add(rimLight);

  const backFillLight = new THREE.DirectionalLight(0xf3f8ff, 0.52);
  backFillLight.position.set(4.6, 3.2, -4.0);
  scene.add(backFillLight);

  const cavityLight = new THREE.PointLight(0xffffff, 0.32, 4.0);
  cavityLight.position.set(-0.15, 1.15, 1.85);
  scene.add(cavityLight);

  // Ensamblaje del paquete Doypack GoManía
  const pouchGroup = new THREE.Group();
  pouchGroup.position.y = POUCH_CONFIG.halfH;
  scene.add(pouchGroup);

  const { colorTex: frontTex, alphaTex: frontAlphaTex } = createFrontTextures();
  const { colorTex: backTex, alphaTex: backAlphaTex } = createBackTextures();
  const gussetTex = createBlueGussetTexture();
  const pouchBumpTex = createPouchBumpTexture();

  const frontMat = new THREE.MeshPhysicalMaterial({
    map: frontTex,
    alphaMap: frontAlphaTex,
    alphaTest: 0.5,
    roughness: 0.48,
    metalness: 0.02,
    clearcoat: 0.14,
    clearcoatRoughness: 0.42,
    bumpMap: pouchBumpTex,
    bumpScale: 0.006,
    envMapIntensity: 0.32,
    side: THREE.FrontSide,
  });
  const frontMesh = new THREE.Mesh(buildPouchPanelGeometry(false, 92, 128, 0), frontMat);
  pouchGroup.add(frontMesh);

  const backMat = new THREE.MeshPhysicalMaterial({
    map: backTex,
    alphaMap: backAlphaTex,
    alphaTest: 0.5,
    roughness: 0.48,
    metalness: 0.02,
    clearcoat: 0.14,
    clearcoatRoughness: 0.42,
    bumpMap: pouchBumpTex,
    bumpScale: 0.006,
    envMapIntensity: 0.32,
    side: THREE.FrontSide,
  });
  const backMesh = new THREE.Mesh(buildPouchPanelGeometry(true, 92, 128, 0), backMat);
  pouchGroup.add(backMesh);

  const gussetMat = new THREE.MeshPhysicalMaterial({
    map: gussetTex,
    roughness: 0.48,
    metalness: 0.02,
    clearcoat: 0.12,
    clearcoatRoughness: 0.42,
    envMapIntensity: 0.3,
    side: THREE.FrontSide,
  });
  const gussetMesh = new THREE.Mesh(buildBottomGussetGeometry(92, 28), gussetMat);
  pouchGroup.add(gussetMesh);

  const seamMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#E34E7C'),
    roughness: 0.36,
    metalness: 0.02,
    clearcoat: 0.28,
  });
  pouchGroup.add(new THREE.Mesh(buildSeamEdgesGeometry(92, 128), seamMat));
  pouchGroup.add(new THREE.Mesh(buildEuroHoleRimGeometry(), seamMat));

  const innerLiningMatBack = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#F3EFF4'),
    alphaMap: backAlphaTex,
    alphaTest: 0.5,
    roughness: 0.62,
    metalness: 0.12,
    side: THREE.BackSide,
  });
  pouchGroup.add(new THREE.Mesh(buildPouchPanelGeometry(true, 56, 76, -0.008), innerLiningMatBack));

  const innerLiningMatFront = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#F3EFF4'),
    alphaMap: frontAlphaTex,
    alphaTest: 0.5,
    roughness: 0.62,
    metalness: 0.12,
    side: THREE.BackSide,
  });
  pouchGroup.add(new THREE.Mesh(buildPouchPanelGeometry(false, 68, 92, -0.008), innerLiningMatFront));

  const innerGussetMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#F2EFF4'),
    roughness: 0.65,
    metalness: 0.1,
    side: THREE.BackSide,
  });
  const innerGussetMesh = new THREE.Mesh(buildBottomGussetGeometry(48, 16), innerGussetMat);
  innerGussetMesh.position.y = 0.008;
  pouchGroup.add(innerGussetMesh);

  const marshmallows = populateMarshmallowsStrictlyInside(pouchGroup);

  const clearWindowGeom = buildPouchPanelGeometry(false, 52, 40, -0.0025, 0.13, 0.76, 0.10, 0.42);
  const clearFilmMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#FFFFFF'),
    transparent: true,
    opacity: 0.13,
    roughness: 0.05,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    reflectivity: 0.9,
    envMapIntensity: 1.55,
    depthWrite: false,
  });
  const clearFilmMesh = new THREE.Mesh(clearWindowGeom, clearFilmMat);
  clearFilmMesh.renderOrder = 2;
  pouchGroup.add(clearFilmMesh);

  // Controles de órbita 360°
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(HERO_TARGET);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.enablePan = false;
  controls.minDistance = 3.1;
  controls.maxDistance = 10.5;
  controls.minPolarAngle = 0.08;
  controls.maxPolarAngle = Math.PI - 0.08;
  controls.autoRotate = state.autoRotate;
  controls.autoRotateSpeed = 1.05;
  controls.update();

  const onControlsStart = (): void => {
    if (dragHintEl) dragHintEl.classList.add('is-hidden');
    state.cameraAnim = null;
  };
  controls.addEventListener('start', onControlsStart);

  const syncAutoRotateUI = (enabled: boolean): void => {
    state.autoRotate = enabled;
    controls.autoRotate = enabled;
    if (btnAutoRotate) {
      btnAutoRotate.classList.toggle('is-active', enabled);
      btnAutoRotate.setAttribute('aria-pressed', String(enabled));
    }
  };

  const syncColorUI = (enabled: boolean): void => {
    state.animateColors = enabled;
    if (iconPause) iconPause.classList.toggle('is-hidden', !enabled);
    if (iconPlay) iconPlay.classList.toggle('is-hidden', enabled);
    if (labelColors) labelColors.textContent = enabled ? 'Pausar' : 'Reanudar';
    if (btnColors) btnColors.setAttribute('aria-pressed', String(enabled));
  };

  syncAutoRotateUI(state.autoRotate);
  syncColorUI(state.animateColors);

  const animateCameraTo = (
    targetPos: THREE.Vector3,
    targetLookAt: THREE.Vector3,
    disableAutoRotate = true
  ): void => {
    if (disableAutoRotate && state.autoRotate) {
      syncAutoRotateUI(false);
    }
    state.cameraAnim = {
      startPos: camera.position.clone(),
      endPos: targetPos.clone(),
      startTarget: controls.target.clone(),
      endTarget: targetLookAt.clone(),
      elapsed: 0,
      duration: 0.72,
    };
  };

  const handleAutoRotateClick = (): void => syncAutoRotateUI(!state.autoRotate);
  const handleColorsClick = (): void => syncColorUI(!state.animateColors);
  const handleSpeedInput = (event: Event): void => {
    const target = event.target as HTMLInputElement;
    state.colorSpeed = parseFloat(target.value) || 1.0;
  };

  btnAutoRotate?.addEventListener('click', handleAutoRotateClick);
  btnColors?.addEventListener('click', handleColorsClick);
  speedSlider?.addEventListener('input', handleSpeedInput);

  const viewHandlers: Array<{ btn: HTMLButtonElement; handler: () => void }> = [];
  viewButtons.forEach((btn) => {
    const handler = (): void => {
      const view = btn.dataset.pouch3dView as CameraViewPreset | undefined;
      if (view === 'front') {
        animateCameraTo(new THREE.Vector3(0, 1.95, 7.05), HERO_TARGET, true);
      } else if (view === 'back') {
        animateCameraTo(new THREE.Vector3(0, 1.95, -7.05), HERO_TARGET, true);
      } else if (view === 'bottom') {
        animateCameraTo(new THREE.Vector3(0.4, -2.55, 4.95), new THREE.Vector3(0, 0.65, 0), true);
      } else if (view === 'reset') {
        animateCameraTo(HERO_CAM_POS, HERO_TARGET, false);
        syncAutoRotateUI(true);
      }
    };
    btn.addEventListener('click', handler);
    viewHandlers.push({ btn, handler });
  });

  // Ajuste responsivo vinculado al tamaño real del contenedor en Hero.astro
  const handleResize = (): void => {
    const w = canvasContainer.clientWidth;
    const h = canvasContainer.clientHeight;
    if (w <= 0 || h <= 0) return;

    const aspect = w / h;
    camera.aspect = aspect;
    camera.fov = aspect < 0.85 ? 40 : 34;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };

  const resizeObserver = new ResizeObserver(handleResize);
  resizeObserver.observe(canvasContainer);
  handleResize();

  // Ocultar loader suavemente tras el primer montaje
  if (loaderEl) {
    loaderEl.classList.add('is-done');
    window.setTimeout(() => {
      loaderEl.hidden = true;
    }, 450);
  }

  // Pausa inteligente si el visor sale de pantalla o la pestaña está oculta
  let isInViewport = true;
  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      isInViewport = entries.some((entry) => entry.isIntersecting);
    },
    { threshold: 0.05 }
  );
  intersectionObserver.observe(rootEl);

  let lastTimeMs = performance.now();
  let rafId = 0;

  const animate = (nowMs: number = performance.now()): void => {
    rafId = window.requestAnimationFrame(animate);
    const dt = Math.min((nowMs - lastTimeMs) / 1000, 0.05);
    lastTimeMs = nowMs;

    if (!isInViewport || document.hidden) {
      return;
    }

    if (state.animateColors) {
      state.colorTime += dt * 0.44 * state.colorSpeed;
      const nColors = PASTEL_PALETTE.length;

      for (let i = 0; i < marshmallows.length; i++) {
        const m = marshmallows[i];
        const prog = m.phase + state.colorTime * m.speedFactor;
        const idxA = Math.floor(prog) % nColors;
        const idxB = (idxA + 1) % nColors;
        const frac = prog - Math.floor(prog);
        const smoothT = 0.5 - 0.5 * Math.cos(frac * Math.PI);

        m.material.color.lerpColors(
          PASTEL_PALETTE[m.sequence[idxA]],
          PASTEL_PALETTE[m.sequence[idxB]],
          smoothT
        );
      }
    }

    if (state.cameraAnim) {
      const anim = state.cameraAnim;
      anim.elapsed += dt;
      const t = Math.min(1, anim.elapsed / anim.duration);
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      camera.position.lerpVectors(anim.startPos, anim.endPos, ease);
      controls.target.lerpVectors(anim.startTarget, anim.endTarget, ease);
      if (t >= 1) state.cameraAnim = null;
    }

    controls.update();
    renderer.render(scene, camera);
  };

  animate();

  return () => {
    window.cancelAnimationFrame(rafId);
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    controls.removeEventListener('start', onControlsStart);
    controls.dispose();
    btnAutoRotate?.removeEventListener('click', handleAutoRotateClick);
    btnColors?.removeEventListener('click', handleColorsClick);
    speedSlider?.removeEventListener('input', handleSpeedInput);
    viewHandlers.forEach(({ btn, handler }) => btn.removeEventListener('click', handler));
    envRT.dispose();
    renderer.dispose();
  };
}
