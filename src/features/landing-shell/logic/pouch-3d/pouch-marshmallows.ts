/**
 * ============================================================================
 * QUÉ HACE:
 * Empaqueta densamente piezas 3D de maní confitado dentro de la cavidad del
 * Doypack con contención matemática garantizada vértice por vértice (sin
 * protrusiones por frente, costados, dorso ni fuelle inferior) y sin dejar
 * espacios vacíos visibles tras la ventana transparente.
 *
 * CON QUÉ MÓDULO CONECTA:
 * - Lee `CANDIED_PEANUT_PALETTE` y `POUCH_CONFIG` desde `./pouch-constants`.
 * - Usa `createCandiedPeanutGeometry`, `getGussetLocalY`, `getPouchHalfDepth`
 *   desde `./pouch-geometry`.
 * - Usa `createCandiedSugarBumpTexture` desde `./pouch-textures`.
 * - Consumido por `pouch-viewer.client.ts`.
 * ============================================================================
 */
import * as THREE from 'three';
import { CANDIED_PEANUT_PALETTE, POUCH_CONFIG } from './pouch-constants';
import {
  createCandiedPeanutGeometry,
  getGussetLocalY,
  getPouchHalfDepth,
} from './pouch-geometry';
import { createCandiedSugarBumpTexture } from './pouch-textures';

export interface CandiedPeanutColorGroup {
  material: THREE.MeshPhysicalMaterial;
  sequence: number[];
  phase: number;
  speedFactor: number;
}

interface CandidatePeanut {
  pos: THREE.Vector3;
  rot: THREE.Euler;
  scale: THREE.Vector3;
  radius: number;
  layer: number;
  variantIdx: number;
}

interface VariantMetrics {
  geom: THREE.BufferGeometry;
  sampleVerts: THREE.Vector3[];
  boundingRadius: number;
}

/**
 * Pobla la cavidad del Doypack con maní confitado compacto en múltiples capas
 * intercaladas para ocupar toda el área visible sin huecos ni protrusiones.
 */
export function populateCandiedPeanutsStrictlyInside(
  parentGroup: THREE.Group
): CandiedPeanutColorGroup[] {
  const sugarBump = createCandiedSugarBumpTexture();

  // 4 variantes orgánicas de costra caramelizada para evitar repetición visual
  const variants: VariantMetrics[] = [0, 1, 2, 3].map((vIdx) => {
    const geom = createCandiedPeanutGeometry(vIdx);
    const posAttr = geom.attributes.position;
    const sampleVerts: THREE.Vector3[] = [];
    let boundingRadius = 0;

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      const vz = posAttr.getZ(i);
      const d = Math.hypot(vx, vy, vz);
      if (d > boundingRadius) boundingRadius = d;
      if (i % 3 === 0) {
        sampleVerts.push(new THREE.Vector3(vx, vy, vz));
      }
    }
    return { geom, sampleVerts, boundingRadius };
  });

  let seed = 20261127;
  const rand = (): number => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const getMinSampledHalfDepth = (mx: number, my: number, R: number): number => {
    let minHD = Infinity;
    const probeR = R * 0.85;
    const deltas = [-probeR, 0, probeR];
    for (let ix = 0; ix < 3; ix++) {
      for (let iy = 0; iy < 3; iy++) {
        const nx = (mx + deltas[ix]) / POUCH_CONFIG.halfW;
        const ny = (my + deltas[iy]) / POUCH_CONFIG.halfH;
        if (
          Math.abs(nx) >= POUCH_CONFIG.sideSealNx ||
          ny <= -0.99 ||
          ny >= POUCH_CONFIG.topBellyNy
        ) {
          return 0;
        }
        const hd = getPouchHalfDepth(nx, ny);
        if (hd < minHD) minHD = hd;
      }
    }
    return minHD;
  };

  const getMaxGussetBelow = (mx: number, R: number): number => {
    let maxGY = -POUCH_CONFIG.halfH;
    const probeR = R * 0.85;
    const offsets = [-probeR, 0, probeR];
    for (const dx of offsets) {
      const nx = THREE.MathUtils.clamp((mx + dx) / POUCH_CONFIG.halfW, -0.98, 0.98);
      const gy = getGussetLocalY(nx, 0.5);
      if (gy > maxGY) maxGY = gy;
    }
    return maxGY;
  };

  const enforceSafeContainment = (item: CandidatePeanut): void => {
    const R = item.radius;

    item.pos.x = THREE.MathUtils.clamp(item.pos.x, -0.89, 0.69);
    item.pos.y = THREE.MathUtils.clamp(item.pos.y, -1.52, -0.22);

    const minSafeY = getMaxGussetBelow(item.pos.x, R) + R * 0.85 + 0.03;
    if (item.pos.y < minSafeY) item.pos.y = minSafeY;

    let minHD = getMinSampledHalfDepth(item.pos.x, item.pos.y, R);
    let tries = 0;
    while (minHD <= R * 0.88 + 0.032 && tries < 24) {
      item.pos.x *= 0.93;
      item.pos.y = THREE.MathUtils.lerp(item.pos.y, -0.94, 0.12);
      minHD = getMinSampledHalfDepth(item.pos.x, item.pos.y, R);
      tries++;
    }

    const maxAllowedZ = Math.max(0.0, minHD - R * 0.82 - 0.028);
    item.pos.z = THREE.MathUtils.clamp(item.pos.z, -maxAllowedZ, maxAllowedZ);
  };

  const candidates: CandidatePeanut[] = [];

  const pushCandidate = (
    mx: number,
    my: number,
    mz: number,
    layer: number
  ): void => {
    const variantIdx = Math.floor(rand() * variants.length);
    const sXZ = 0.88 + rand() * 0.24;
    const sY = 0.86 + rand() * 0.28;
    const R = variants[variantIdx].boundingRadius * Math.max(sXZ, sY);

    // Orientación predominantemente paralela al plano de la ventana para mostrar el volumen completo
    const rot = new THREE.Euler(
      (rand() - 0.5) * 0.9,
      rand() * Math.PI * 2,
      (rand() - 0.5) * Math.PI
    );

    const item: CandidatePeanut = {
      pos: new THREE.Vector3(mx, my, mz),
      rot,
      scale: new THREE.Vector3(sXZ, sY, sXZ * (0.9 + rand() * 0.18)),
      radius: R,
      layer,
      variantIdx,
    };
    enforceSafeContainment(item);
    candidates.push(item);
  };

  // Capa 0 (Frontal pegada a la ventana: 10×9 = 90 piezas)
  const l0Cols = 10;
  const l0Rows = 9;
  for (let r = 0; r < l0Rows; r++) {
    for (let c = 0; c < l0Cols; c++) {
      const staggerX = r % 2 === 1 ? 0.065 : 0;
      const mx = -0.84 + (c / (l0Cols - 1)) * 1.48 + staggerX + (rand() - 0.5) * 0.045;
      const my = -1.46 + (r / (l0Rows - 1)) * 1.18 + (rand() - 0.5) * 0.045;
      pushCandidate(mx, my, 0.34, 0);
    }
  }

  // Capa 1 (Segunda fila tras los intersticios frontales: 9×8 = 72 piezas)
  const l1Cols = 9;
  const l1Rows = 8;
  for (let r = 0; r < l1Rows; r++) {
    for (let c = 0; c < l1Cols; c++) {
      const staggerX = r % 2 === 0 ? 0.07 : 0;
      const mx = -0.78 + (c / (l1Cols - 1)) * 1.38 + staggerX + (rand() - 0.5) * 0.055;
      const my = -1.42 + (r / (l1Rows - 1)) * 1.10 + (rand() - 0.5) * 0.055;
      pushCandidate(mx, my, 0.16, 1);
    }
  }

  // Capa 2 (Núcleo central: 8×6 = 48 piezas)
  const l2Cols = 8;
  const l2Rows = 6;
  for (let r = 0; r < l2Rows; r++) {
    for (let c = 0; c < l2Cols; c++) {
      const mx = -0.70 + (c / (l2Cols - 1)) * 1.24 + (rand() - 0.5) * 0.07;
      const my = -1.36 + (r / (l2Rows - 1)) * 1.00 + (rand() - 0.5) * 0.07;
      pushCandidate(mx, my, -0.02, 2);
    }
  }

  // Capa 3 (Fondo interior: 6×5 = 30 piezas)
  const l3Cols = 6;
  const l3Rows = 5;
  for (let r = 0; r < l3Rows; r++) {
    for (let c = 0; c < l3Cols; c++) {
      const mx = -0.58 + (c / (l3Cols - 1)) * 1.04 + (rand() - 0.5) * 0.08;
      const my = -1.30 + (r / (l3Rows - 1)) * 0.92 + (rand() - 0.5) * 0.08;
      pushCandidate(mx, my, -0.20, 3);
    }
  }

  // Relajación compacta: acomoda sin dispersar ni abrir huecos
  const diff = new THREE.Vector3();
  for (let iter = 0; iter < 42; iter++) {
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        diff.subVectors(candidates[i].pos, candidates[j].pos);
        const dist = diff.length();
        const minDist = (candidates[i].radius + candidates[j].radius) * 0.72;
        if (dist > 0.0001 && dist < minDist) {
          const push = (minDist - dist) * 0.34;
          diff.normalize().multiplyScalar(push);
          candidates[i].pos.add(diff);
          candidates[j].pos.sub(diff);
        }
      }
    }
    for (const it of candidates) {
      if (it.layer === 0) it.pos.z += 0.011;
      if (it.layer === 1) it.pos.z += 0.005;
      if (it.layer === 3) it.pos.z -= 0.006;
      enforceSafeContainment(it);
    }
  }

  // Crear 30 grupos de color compartidos (6 colores vívidos × 5 fases/ritmos distintos)
  const numColorGroups = 30;
  const nColors = CANDIED_PEANUT_PALETTE.length;
  const colorGroups: CandiedPeanutColorGroup[] = [];

  for (let g = 0; g < numColorGroups; g++) {
    const startColorIdx = g % nColors;
    const rest = CANDIED_PEANUT_PALETTE.map((_, i) => i).filter(
      (i) => i !== startColorIdx
    );
    for (let k = rest.length - 1; k > 0; k--) {
      const swap = Math.floor(rand() * (k + 1));
      [rest[k], rest[swap]] = [rest[swap], rest[k]];
    }
    const sequence = [startColorIdx, ...rest];

    const mat = new THREE.MeshPhysicalMaterial({
      color: CANDIED_PEANUT_PALETTE[sequence[0]].clone(),
      vertexColors: true,
      roughness: 0.80,
      metalness: 0.0,
      clearcoat: 0.08,
      clearcoatRoughness: 0.74,
      sheen: 0.06,
      sheenRoughness: 0.92,
      sheenColor: new THREE.Color('#FFF5EA'),
      bumpMap: sugarBump,
      bumpScale: 0.016,
      envMapIntensity: 0.34,
    });

    colorGroups.push({
      material: mat,
      sequence,
      phase: (g / numColorGroups) * 0.55 + rand() * 0.15,
      speedFactor: 0.72 + rand() * 0.48,
    });
  }

  // Auditoría vértice por vértice contra paneles, sellados y fuelle inferior
  const mat4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const vWorld = new THREE.Vector3();

  const isMeshStrictlyInside = (item: CandidatePeanut): boolean => {
    const sampleVerts = variants[item.variantIdx].sampleVerts;
    quat.setFromEuler(item.rot);
    mat4.compose(item.pos, quat, item.scale);

    for (let k = 0; k < sampleVerts.length; k++) {
      vWorld.copy(sampleVerts[k]).applyMatrix4(mat4);
      const nx = vWorld.x / POUCH_CONFIG.halfW;
      const ny = vWorld.y / POUCH_CONFIG.halfH;

      if (Math.abs(nx) > POUCH_CONFIG.sideSealNx - 0.035) return false;
      if (ny > POUCH_CONFIG.topBellyNy - 0.06 || ny < -0.97) return false;

      const surfaceZ = getPouchHalfDepth(nx, ny);
      if (Math.abs(vWorld.z) > surfaceZ - 0.022) return false;

      const sApprox = THREE.MathUtils.clamp((surfaceZ - vWorld.z) / (2 * surfaceZ), 0, 1);
      const gussetY = getGussetLocalY(nx, sApprox);
      if (vWorld.y < gussetY + 0.024) return false;
    }
    return true;
  };

  candidates.forEach((it, idx) => {
    let safe = isMeshStrictlyInside(it);
    let guard = 0;
    while (!safe && guard < 22) {
      it.pos.x *= 0.94;
      it.pos.z *= 0.88;
      it.pos.y = THREE.MathUtils.lerp(it.pos.y, -0.90, 0.10);
      enforceSafeContainment(it);
      safe = isMeshStrictlyInside(it);
      guard++;
    }
    if (!safe) return;

    const groupIdx = (idx * 7 + it.layer * 11 + Math.floor(rand() * 5)) % numColorGroups;
    const mesh = new THREE.Mesh(
      variants[it.variantIdx].geom,
      colorGroups[groupIdx].material
    );
    mesh.position.copy(it.pos);
    mesh.rotation.copy(it.rot);
    mesh.scale.copy(it.scale);
    parentGroup.add(mesh);
  });

  return colorGroups;
}
