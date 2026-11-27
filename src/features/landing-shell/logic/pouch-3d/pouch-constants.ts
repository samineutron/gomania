/**
 * ============================================================================
 * QUÉ HACE:
 * Define las constantes de marca, proporciones geométricas del envase Doypack
 * GoManía (120 mm × 195 mm), paleta vívida para el maní confitado y tipos de
 * estado del visor 3D.
 *
 * CON QUÉ MÓDULO CONECTA:
 * - Consumido por `pouch-geometry.ts`, `pouch-textures.ts`,
 *   `pouch-marshmallows.ts` y `pouch-viewer.client.ts`.
 * ============================================================================
 */
import * as THREE from 'three';

export const BRAND_3D = {
  pinkBg: '#EC5D88',
  pinkRich: '#E75280',
  pinkStripeLight: '#F8C5D6',
  pinkLogo: '#E9557D',
  cyan: '#0093C4',
  white: '#FFFFFF',
} as const;

export const POUCH_CONFIG = {
  W: 2.4,              // Ancho 3D (proporción 120mm)
  H: 3.9,              // Alto 3D (proporción 195mm)
  halfW: 1.2,
  halfH: 1.95,
  maxHalfZ: 0.52,      // Semiprofundidad máxima en el vientre inferior
  sealHalfZ: 0.015,    // Semiespesor de los sellados térmicos planos
  sideSealNx: 0.88,    // A partir de |nx| > 0.88 los bordes son planos sellados
  topBellyNy: 0.68,    // A partir de ny > 0.68 comienza zona plana de cremallera y cabezal
  zipNy: 0.725,        // Línea de cremallera resellable (zipper)
  notchNy: 0.79,       // Muescas de apertura en V
  euroHoleV: 0.935,    // Centro vertical de la perforación Euro-slot (sombrero)
  gussetArchMax: 0.25, // Altura del arco interior del fuelle inferior celeste
  badge: {
    u: 0.215,
    v: 0.168,
    rU: 0.088,
  },
} as const;

/** Paleta fuerte, vívida y ligeramente opaca para el maní confitado azucarado. */
export const CANDIED_PEANUT_PALETTE: readonly THREE.Color[] = [
  new THREE.Color('#D41926'), // Rojo intenso
  new THREE.Color('#D19205'), // Amarillo mostaza fuerte
  new THREE.Color('#D9117A'), // Fucsia fuerte
  new THREE.Color('#8E4B18'), // Café vívido acaramelado
  new THREE.Color('#6E1B94'), // Morado intenso
  new THREE.Color('#4D9E1C'), // Verde intenso
];

export type CameraViewPreset = 'front' | 'back' | 'bottom' | 'reset';

export interface CameraAnimationState {
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  startTarget: THREE.Vector3;
  endTarget: THREE.Vector3;
  elapsed: number;
  duration: number;
}

export interface PouchViewerState {
  autoRotate: boolean;
  animateColors: boolean;
  colorSpeed: number;
  colorTime: number;
  cameraAnim: CameraAnimationState | null;
}
