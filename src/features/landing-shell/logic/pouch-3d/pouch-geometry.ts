/**
 * ============================================================================
 * QUÉ HACE:
 * Funciones matemáticas compartidas de la superficie del Doypack y
 * constructores de geometrías 3D (paneles frontal/trasero, fuelle inferior,
 * sellados laterales, canto Euro-slot y geometría del maní confitado).
 *
 * CON QUÉ MÓDULO CONECTA:
 * - Lee `POUCH_CONFIG` desde `./pouch-constants`.
 * - Consumido por `pouch-textures.ts`, `pouch-marshmallows.ts` y
 *   `pouch-viewer.client.ts`.
 * ============================================================================
 */
import * as THREE from 'three';
import { POUCH_CONFIG } from './pouch-constants';

export interface Point2D {
  x: number;
  y: number;
}

export interface UVPoint {
  u: number;
  v: number;
}

/**
 * Devuelve la semiprofundidad Z del paquete en coordenadas normalizadas:
 * nx en [-1, 1] (izquierda a derecha en el frente)
 * ny en [-1, 1] (base inferior a borde superior)
 */
export function getPouchHalfDepth(nx: number, ny: number): number {
  const absNx = Math.abs(nx);
  let belly = 0;

  if (absNx < POUCH_CONFIG.sideSealNx && ny >= -1.0 && ny < POUCH_CONFIG.topBellyNy) {
    const tx = absNx / POUCH_CONFIG.sideSealNx;
    const hx = Math.pow(Math.cos(tx * Math.PI * 0.5), 0.56);

    const ty = (ny + 1.0) / (POUCH_CONFIG.topBellyNy + 1.0);
    let hy: number;
    if (ty < 0.27) {
      const k = ty / 0.27;
      hy = 0.78 + 0.22 * Math.sin(k * Math.PI * 0.5);
    } else {
      const k = (ty - 0.27) / 0.73;
      hy = Math.pow(Math.cos(k * Math.PI * 0.5), 1.42);
    }

    const flex = 0.0028 * Math.sin(nx * Math.PI * 2.5 + ty * 3.8) * hx * hy;
    belly = POUCH_CONFIG.maxHalfZ * hx * hy + flex;
  }

  // Relieve horizontal sutil del cierre resellable (zip-lock)
  let zipRidge = 0;
  if (absNx < POUCH_CONFIG.sideSealNx * 1.02) {
    const edgeFade = Math.min(1, Math.max(0, (POUCH_CONFIG.sideSealNx * 1.02 - absNx) / 0.05));
    const d1 = (ny - (POUCH_CONFIG.zipNy - 0.011)) / 0.0085;
    const d2 = (ny - (POUCH_CONFIG.zipNy + 0.011)) / 0.0085;
    zipRidge = (Math.exp(-d1 * d1) * 0.0105 + Math.exp(-d2 * d2) * 0.009) * edgeFade;
  }

  return POUCH_CONFIG.sealHalfZ + Math.max(0, belly) + zipRidge;
}

/**
 * Coordenadas 3D locales (x, y) en el sistema centrado del paquete,
 * incluyendo muescas de apertura en V y esquinas redondeadas.
 */
export function getPouchLocalXY(nx: number, ny: number): Point2D {
  let x = nx * POUCH_CONFIG.halfW;
  let y = ny * POUCH_CONFIG.halfH;

  const dNotch = Math.abs(ny - POUCH_CONFIG.notchNy);
  if (dNotch < 0.022 && Math.abs(nx) > 0.91) {
    const notchFactor = 1.0 - dNotch / 0.022;
    const edgeFactor = (Math.abs(nx) - 0.91) / 0.09;
    x -= Math.sign(nx) * 0.068 * notchFactor * edgeFactor;
  }

  if (Math.abs(ny) > 0.94 && Math.abs(nx) > 0.90) {
    const ty = (Math.abs(ny) - 0.94) / 0.06;
    const tx = (Math.abs(nx) - 0.90) / 0.10;
    const inset = (1.0 - Math.sqrt(Math.max(0, 1.0 - ty * ty))) * 0.032 * tx;
    x -= Math.sign(nx) * inset;
  }

  return { x, y };
}

/**
 * Altura Y local del pliegue interior del fuelle celeste en (nx, s) con s ∈ [0, 1].
 */
export function getGussetLocalY(nx: number, s: number): number {
  const absNx = Math.abs(nx);
  if (absNx >= POUCH_CONFIG.sideSealNx) return -POUCH_CONFIG.halfH;
  const tx = absNx / POUCH_CONFIG.sideSealNx;
  const archX = Math.pow(Math.cos(tx * Math.PI * 0.5), 0.62);
  const archZ = Math.sin(s * Math.PI);
  return -POUCH_CONFIG.halfH + POUCH_CONFIG.gussetArchMax * archX * archZ;
}

/**
 * Traza la ventana transparente en forma de frijol / sonrisa ancha curva.
 */
export function traceKidneyWindow2D(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  scale = 1.0
): void {
  const cx = 0.445 * W;
  const cy = (1.0 - 0.258) * H;
  const rx = 0.285 * W * scale;
  const ry = 0.128 * H * scale;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(0.03);
  ctx.beginPath();
  ctx.moveTo(-rx * 0.88, -ry * 0.56);
  ctx.bezierCurveTo(-rx * 0.42, -ry * 1.02, rx * 0.36, -ry * 0.94, rx * 0.86, -ry * 0.44);
  ctx.bezierCurveTo(rx * 1.08, -ry * 0.08, rx * 1.02, ry * 0.62, rx * 0.60, ry * 0.90);
  ctx.bezierCurveTo(rx * 0.14, ry * 1.12, -rx * 0.42, ry * 1.12, -rx * 0.78, ry * 0.82);
  ctx.bezierCurveTo(-rx * 1.10, ry * 0.50, -rx * 1.12, -ry * 0.18, -rx * 0.88, -ry * 0.56);
  ctx.closePath();
  ctx.restore();
}

/**
 * Genera los puntos (u, v) del contorno de la perforación superior Euro-slot (sombrero).
 */
export function getEuroHolePointsUV(): UVPoint[] {
  const cx = 0.5;
  const cyV = POUCH_CONFIG.euroHoleV;
  const aspect = POUCH_CONFIG.W / POUCH_CONFIG.H;

  const slotHalfW = 0.118;
  const slotHalfH = 0.021;
  const topBulgeR = 0.036;
  const pts: UVPoint[] = [];

  const addPt = (du: number, dvU: number): void => {
    pts.push({ u: cx + du, v: cyV + dvU * aspect });
  };

  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI * 0.5 + (i / 10) * Math.PI;
    addPt(slotHalfW - slotHalfH + Math.cos(a) * slotHalfH, Math.sin(a) * slotHalfH);
  }

  const neckX = topBulgeR * 0.88;
  addPt(neckX + 0.008, slotHalfH);
  for (let i = 0; i <= 16; i++) {
    const a = 0.18 + (i / 16) * (Math.PI - 0.36);
    addPt(Math.cos(a) * topBulgeR, slotHalfH + Math.sin(a) * (topBulgeR * 0.92));
  }
  addPt(-neckX - 0.008, slotHalfH);

  for (let i = 0; i <= 10; i++) {
    const a = Math.PI * 0.5 + (i / 10) * Math.PI;
    addPt(-(slotHalfW - slotHalfH) + Math.cos(a) * slotHalfH, Math.sin(a) * slotHalfH);
  }

  return pts;
}

/**
 * Traza la perforación Euro-slot en un contexto Canvas 2D.
 */
export function traceEuroHole2D(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const pts = getEuroHolePointsUV();
  ctx.beginPath();
  pts.forEach((p, idx) => {
    const px = p.u * W;
    const py = (1.0 - p.v) * H;
    if (idx === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
}

/**
 * Construye el panel frontal o trasero esculpido con `getPouchHalfDepth(nx, ny)`.
 */
export function buildPouchPanelGeometry(
  isBack: boolean,
  segU = 92,
  segV = 128,
  zOffset = 0,
  uMin = 0,
  uMax = 1,
  vMin = 0,
  vMax = 1
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let j = 0; j <= segV; j++) {
    const v = vMin + (j / segV) * (vMax - vMin);
    const ny = v * 2.0 - 1.0;
    for (let i = 0; i <= segU; i++) {
      const u = uMin + (i / segU) * (uMax - uMin);
      const nx = isBack ? (1.0 - u) * 2.0 - 1.0 : u * 2.0 - 1.0;
      const { x, y } = getPouchLocalXY(nx, ny);
      const halfZ = getPouchHalfDepth(nx, ny) + zOffset;
      const z = isBack ? -halfZ : halfZ;

      positions.push(x, y, z);
      uvs.push(u, v);
    }
  }

  const row = segU + 1;
  for (let j = 0; j < segV; j++) {
    for (let i = 0; i < segU; i++) {
      const a = j * row + i;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Construye el fuelle inferior elíptico doblado hacia adentro (Bottom Gusset).
 */
export function buildBottomGussetGeometry(segU = 92, segS = 28): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let j = 0; j <= segS; j++) {
    const s = j / segS;
    for (let i = 0; i <= segU; i++) {
      const u = i / segU;
      const nx = u * 2.0 - 1.0;
      const { x } = getPouchLocalXY(nx, -1.0);
      const halfZ = getPouchHalfDepth(nx, -1.0);
      const z = halfZ * (1.0 - 2.0 * s);
      const y = getGussetLocalY(nx, s);

      positions.push(x, y, z);
      uvs.push(u, 1.0 - s);
    }
  }

  const row = segU + 1;
  for (let j = 0; j < segS; j++) {
    for (let i = 0; i < segU; i++) {
      const a = j * row + i;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, d, b, a, c, d);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Cierra herméticamente los cantos termosellados (izquierdo, superior y derecho).
 */
export function buildSeamEdgesGeometry(segU = 92, segV = 128): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vIdx = 0;

  const addStrip = (sampleFn: (t: number) => { nx: number; ny: number }, count: number): void => {
    const start = vIdx;
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const { nx, ny } = sampleFn(t);
      const { x, y } = getPouchLocalXY(nx, ny);
      const z = getPouchHalfDepth(nx, ny);
      positions.push(x, y, z);
      uvs.push(t, 0);
      positions.push(x, y, -z);
      uvs.push(t, 1);
      vIdx += 2;
    }
    for (let i = 0; i < count; i++) {
      const a = start + i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, c, d, a, d, b);
    }
  };

  addStrip((t) => ({ nx: -1, ny: -1 + t * 2 }), segV);
  addStrip((t) => ({ nx: -1 + t * 2, ny: 1 }), segU);
  addStrip((t) => ({ nx: 1, ny: 1 - t * 2 }), segV);

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Construye el espesor 3D del canto interior de la perforación Euro-slot.
 */
export function buildEuroHoleRimGeometry(): THREE.BufferGeometry {
  const pts = getEuroHolePointsUV();
  const positions: number[] = [];
  const indices: number[] = [];
  const n = pts.length;

  for (let i = 0; i < n; i++) {
    const nx = pts[i].u * 2.0 - 1.0;
    const ny = pts[i].v * 2.0 - 1.0;
    const { x, y } = getPouchLocalXY(nx, ny);
    const z = getPouchHalfDepth(nx, ny);
    positions.push(x, y, z);
    positions.push(x, y, -z);
  }

  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const a = i * 2;
    const b = a + 1;
    const c = next * 2;
    const d = next * 2 + 1;
    indices.push(a, d, c, a, b, d);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Geometría orgánica e irregular de maní confitado con costra grumosa de azúcar
 * y sombreado por vértices para dar profundidad opaca en los relieves.
 */
export function createCandiedPeanutGeometry(variantIndex = 0): THREE.BufferGeometry {
  const geom = new THREE.IcosahedronGeometry(1, 3);
  const posAttr = geom.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);

  const seed = (variantIndex + 1) * 1.73;
  const rx = 0.082;
  const ry = 0.118;
  const rz = 0.076;

  for (let i = 0; i < posAttr.count; i++) {
    const ux = posAttr.getX(i);
    const uy = posAttr.getY(i);
    const uz = posAttr.getZ(i);

    // Leve cintura de maní + asimetría natural entre polos
    const taper = 1.0 - 0.14 * uy - 0.06 * Math.exp(-uy * uy * 5.0);
    const bendX = 0.09 * Math.sin(uy * 2.2 + seed);

    // Bultos gruesos de la costra caramelizada + gránulos medianos + textura fina
    const lump1 =
      Math.sin(ux * 4.3 + uy * 3.1 + seed) *
      Math.cos(uz * 4.7 - uy * 2.6 + seed * 0.7);
    const lump2 =
      Math.sin(ux * 8.9 - uz * 7.4 + seed * 1.9) *
      Math.sin(uy * 8.2 + ux * 5.1 - seed);
    const grit = Math.cos(ux * 16.5 + uy * 14.3 - uz * 15.1 + seed * 2.3);

    const radialDisp = 1.0 + lump1 * 0.13 + lump2 * 0.068 + grit * 0.026;

    const px = (ux * taper + bendX) * rx * radialDisp;
    const py = uy * ry * (1.0 + lump1 * 0.07 + lump2 * 0.04);
    const pz = uz * taper * rz * radialDisp;

    posAttr.setXYZ(i, px, py, pz);

    // Variación tonal en vértices: hendiduras más oscuras y crestas de azúcar sutilmente opacas
    const bumpVal = lump1 * 0.65 + lump2 * 0.35;
    const shade = THREE.MathUtils.clamp(0.90 + bumpVal * 0.16, 0.74, 1.04);
    const sugarHighlight = bumpVal > 0.42 ? (bumpVal - 0.42) * 0.14 : 0.0;

    colors[i * 3] = Math.min(1.0, shade + sugarHighlight);
    colors[i * 3 + 1] = Math.min(1.0, shade + sugarHighlight * 0.92);
    colors[i * 3 + 2] = Math.min(1.0, shade + sugarHighlight * 0.84);
  }

  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geom.computeVertexNormals();
  return geom;
}
