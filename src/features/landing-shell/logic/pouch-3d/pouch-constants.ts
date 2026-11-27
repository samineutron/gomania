/**
 * ============================================================================
 * QUÉ HACE:
 * Define las constantes de marca, proporciones geométricas del envase Doypack
 * GoManía (120 mm × 195 mm), paleta pastel para los malvaviscos y tipos de
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

/** Paleta estrictamente pastel y luminosa SOLO para los malvaviscos. */
export const PASTEL_PALETTE: readonly THREE.Color[] = [
  new THREE.Color('#B8F3D8'), // Verde menta pastel
  new THREE.Color('#FFC7DF'), // Rosado pastel
  new THREE.Color('#FFF1B5'), // Amarillo pastel
  new THREE.Color('#BFE8FF'), // Celeste pastel
  new THREE.Color('#E3CEFF'), // Lavanda pastel
  new THREE.Color('#FFD9BE'), // Durazno pastel
  new THREE.Color('#FFF8E6'), // Crema vainilla
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
