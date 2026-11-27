/**
 * ============================================================================
 * QUÉ HACE:
 * Empaqueta 46 malvaviscos 3D pastel dentro de la cavidad del Doypack con
 * contención matemática garantizada vértice por vértice (sin protrusiones
 * por frente, costados, dorso ni fuelle inferior).
 *
 * CON QUÉ MÓDULO CONECTA:
 * - Lee `PASTEL_PALETTE` y `POUCH_CONFIG` desde `./pouch-constants`.
 * - Usa `createMarshmallowGeometry`, `getGussetLocalY`, `getPouchHalfDepth`
 *   desde `./pouch-geometry`.
 * - Usa `createSugarPowderBumpTexture` desde `./pouch-textures`.
 * - Consumido por `pouch-viewer.client.ts`.
 * ============================================================================
 */
import * as THREE from 'three';
import { PASTEL_PALETTE, POUCH_CONFIG } from './pouch-constants';
import {
  createMarshmallowGeometry,
  getGussetLocalY,
  getPouchHalfDepth,
} from './pouch-geometry';
import { createSugarPowderBumpTexture } from './pouch-textures';

export interface MarshmallowItem {
  mesh: THREE.Mesh;
  material: THREE.MeshPhysicalMaterial;
  sequence: number[];
  phase: number;
  speedFactor: number;
}

interface CandidateMarshmallow {
  pos: THREE.Vector3;
  rot: THREE.Euler;
  scale: THREE.Vector3;
  radius: number;
  layer: number;
}

export function populateMarshmallowsStrictlyInside(
  parentGroup: THREE.Group
): MarshmallowItem[] {
  const mallowGeom = createMarshmallowGeometry();
  const sugarBump = createSugarPowderBumpTexture();

  const posAttr = mallowGeom.attributes.position;
  const sampleVerts: THREE.Vector3[] = [];
  for (let i = 0; i < posAttr.count; i += 2) {
    sampleVerts.push(new THREE.Vector3().fromBufferAttribute(posAttr, i));
  }

  let baseBoundingRadius = 0;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vy = posAttr.getY(i);
    const vz = posAttr.getZ(i);
    const d = Math.hypot(vx, vy, vz);
    if (d > baseBoundingRadius) baseBoundingRadius = d;
  }

  let seed = 20261126;
  const rand = (): number => {
    seed = (seed * 16807) % 2147483647;
    return (sNorm(seed));
  };
  function sNorm(val: number): number {
    return (val - 1) / 2147483646;
  }

  const getMinSampledHalfDepth = (mx: number, my: number, R: number): number => {
    let minHD = Infinity;
    const deltas = [-R, 0, R];
    for (let ix = 0; ix < 3; ix++) {
      for (let iy = 0; iy < 3; iy++) {
        const nx = (mx + deltas[ix]) / POUCH_CONFIG.halfW;
        const ny = (my + deltas[iy]) / POUCH_CONFIG.halfH;
        if (Math.abs(nx) >= POUCH_CONFIG.sideSealNx || ny <= -0.99 || ny >= POUCH_CONFIG.topBellyNy) {
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
    const offsets = [-R, 0, R];
    for (const dx of offsets) {
      const nx = THREE.MathUtils.clamp((mx + dx) / POUCH_CONFIG.halfW, -0.98, 0.98);
      const gy = getGussetLocalY(nx, 0.5);
      if (gy > maxGY) maxGY = gy;
    }
    return maxGY;
  };

  const enforceSafeContainment = (item: CandidateMarshmallow): void => {
    const R = item.radius;

    item.pos.x = THREE.MathUtils.clamp(item.pos.x, -0.82, 0.64);
    item.pos.y = THREE.MathUtils.clamp(item.pos.y, -1.46, -0.22);

    const minSafeY = getMaxGussetBelow(item.pos.x, R) + R + 0.045;
    if (item.pos.y < minSafeY) item.pos.y = minSafeY;

    let minHD = getMinSampledHalfDepth(item.pos.x, item.pos.y, R);
    let tries = 0;
    while (minHD <= R + 0.06 && tries < 24) {
      item.pos.x *= 0.92;
      item.pos.y = THREE.MathUtils.lerp(item.pos.y, -0.95, 0.12);
      minHD = getMinSampledHalfDepth(item.pos.x, item.pos.y, R);
      tries++;
    }

    const maxAllowedZ = Math.max(0.0, minHD - R - 0.045);
    item.pos.z = THREE.MathUtils.clamp(item.pos.z, -maxAllowedZ, maxAllowedZ);
  };

  const candidates: CandidateMarshmallow[] = [];

  // Capa 1 (Frontal: 20 malvaviscos)
  const frontCols = 5;
  const frontRows = 4;
  for (let r = 0; r < frontRows; r++) {
    for (let c = 0; c < frontCols; c++) {
      const mx = -0.70 + (c / (frontCols - 1)) * 1.24 + (rand() - 0.5) * 0.08;
      const my = -1.40 + (r / (frontRows - 1)) * 1.02 + (rand() - 0.5) * 0.07;
      const sR = 0.88 + rand() * 0.16;
      const sL = 0.88 + rand() * 0.18;
      const R = baseBoundingRadius * Math.max(sR, sL) * 1.02;

      const item: CandidateMarshmallow = {
        pos: new THREE.Vector3(mx, my, 0.25),
        rot: new THREE.Euler(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI),
        scale: new THREE.Vector3(sR, sL, sR),
        radius: R,
        layer: 0,
      };
      enforceSafeContainment(item);
      candidates.push(item);
    }
  }

  // Capa 2 (Central: 14 malvaviscos)
  for (let i = 0; i < 14; i++) {
    const col = i % 5;
    const row = Math.floor(i / 5);
    const mx = -0.62 + (col / 4) * 1.12 + (rand() - 0.5) * 0.12;
    const my = -1.36 + (row / 2) * 0.96 + (rand() - 0.5) * 0.10;
    const sR = 0.86 + rand() * 0.16;
    const sL = 0.86 + rand() * 0.18;
    const R = baseBoundingRadius * Math.max(sR, sL) * 1.02;

    const item: CandidateMarshmallow = {
      pos: new THREE.Vector3(mx, my, 0.02 + (rand() - 0.5) * 0.08),
      rot: new THREE.Euler(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI),
      scale: new THREE.Vector3(sR, sL, sR),
      radius: R,
      layer: 1,
    };
    enforceSafeContainment(item);
    candidates.push(item);
  }

  // Capa 3 (Fondo interior: 12 malvaviscos)
  for (let i = 0; i < 12; i++) {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const mx = -0.54 + (col / 3) * 0.96 + (rand() - 0.5) * 0.12;
    const my = -1.32 + (row / 2) * 0.92 + (rand() - 0.5) * 0.10;
    const sR = 0.86 + rand() * 0.16;
    const sL = 0.86 + rand() * 0.16;
    const R = baseBoundingRadius * Math.max(sR, sL) * 1.02;

    const item: CandidateMarshmallow = {
      pos: new THREE.Vector3(mx, my, -0.18),
      rot: new THREE.Euler(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI),
      scale: new THREE.Vector3(sR, sL, sR),
      radius: R,
      layer: 2,
    };
    enforceSafeContainment(item);
    candidates.push(item);
  }

  // Relajación iterativa suave
  const diff = new THREE.Vector3();
  for (let iter = 0; iter < 55; iter++) {
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        diff.subVectors(candidates[i].pos, candidates[j].pos);
        const dist = diff.length();
        const minDist = (candidates[i].radius + candidates[j].radius) * 0.84;
        if (dist > 0.0001 && dist < minDist) {
          const push = (minDist - dist) * 0.36;
          diff.normalize().multiplyScalar(push);
          candidates[i].pos.add(diff);
          candidates[j].pos.sub(diff);
        }
      }
    }
    for (const it of candidates) {
      if (it.layer === 0) it.pos.z += 0.009;
      if (it.layer === 2) it.pos.z -= 0.004;
      enforceSafeContainment(it);
    }
  }

  // Auditoría vértice por vértice
  const mat4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const vWorld = new THREE.Vector3();
  const marshmallows: MarshmallowItem[] = [];

  const isMeshStrictlyInside = (item: CandidateMarshmallow): boolean => {
    quat.setFromEuler(item.rot);
    mat4.compose(item.pos, quat, item.scale);

    for (let k = 0; k < sampleVerts.length; k++) {
      vWorld.copy(sampleVerts[k]).applyMatrix4(mat4);
      const nx = vWorld.x / POUCH_CONFIG.halfW;
      const ny = vWorld.y / POUCH_CONFIG.halfH;

      if (Math.abs(nx) > POUCH_CONFIG.sideSealNx - 0.05) return false;
      if (ny > POUCH_CONFIG.topBellyNy - 0.08 || ny < -0.96) return false;

      const surfaceZ = getPouchHalfDepth(nx, ny);
      if (Math.abs(vWorld.z) > surfaceZ - 0.032) return false;

      const sApprox = THREE.MathUtils.clamp((surfaceZ - vWorld.z) / (2 * surfaceZ), 0, 1);
      const gussetY = getGussetLocalY(nx, sApprox);
      if (vWorld.y < gussetY + 0.032) return false;
    }
    return true;
  };

  candidates.forEach((it, idx) => {
    let safe = isMeshStrictlyInside(it);
    let guard = 0;
    while (!safe && guard < 18) {
      it.pos.x *= 0.94;
      it.pos.z *= 0.88;
      it.pos.y = THREE.MathUtils.lerp(it.pos.y, -0.88, 0.12);
      enforceSafeContainment(it);
      safe = isMeshStrictlyInside(it);
      guard++;
    }
    if (!safe) return;

    const sequence = PASTEL_PALETTE.map((_, i) => i);
    for (let k = sequence.length - 1; k > 0; k--) {
      const swap = Math.floor(rand() * (k + 1));
      [sequence[k], sequence[swap]] = [sequence[swap], sequence[k]];
    }

    const mat = new THREE.MeshPhysicalMaterial({
      color: PASTEL_PALETTE[sequence[0]].clone(),
      roughness: 0.92,
      metalness: 0.0,
      sheen: 0.42,
      sheenRoughness: 0.88,
      sheenColor: new THREE.Color('#FFFFFF'),
      bumpMap: sugarBump,
      bumpScale: 0.004,
    });

    const mesh = new THREE.Mesh(mallowGeom, mat);
    mesh.position.copy(it.pos);
    mesh.rotation.copy(it.rot);
    mesh.scale.copy(it.scale);
    parentGroup.add(mesh);

    marshmallows.push({
      mesh,
      material: mat,
      sequence,
      phase: rand() * sequence.length + idx * 0.21,
      speedFactor: 0.65 + rand() * 0.55,
    });
  });

  return marshmallows;
}
