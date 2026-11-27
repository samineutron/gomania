/**
 * ============================================================================
 * QUÉ HACE:
 * Genera de manera procedural en Canvas2D todas las texturas de alta resolución
 * del envase 3D GoManía: logotipo vectorial, cara frontal (2048×3072) + alfa,
 * cara trasera (2048×3072) + alfa, fuelle inferior celeste, mapas de relieve
 * y sombra de contacto.
 *
 * CON QUÉ MÓDULO CONECTA:
 * - Lee `BRAND_3D`, `POUCH_CONFIG` desde `./pouch-constants`.
 * - Usa `traceKidneyWindow2D` y `traceEuroHole2D` desde `./pouch-geometry`.
 * - Consumido por `pouch-marshmallows.ts` y `pouch-viewer.client.ts`.
 * ============================================================================
 */
import * as THREE from 'three';
import { BRAND_3D, POUCH_CONFIG } from './pouch-constants';
import { traceEuroHole2D, traceKidneyWindow2D } from './pouch-geometry';

export interface PanelTexturePair {
  colorTex: THREE.CanvasTexture;
  alphaTex: THREE.CanvasTexture;
}

function createCanvas2D(width: number, height: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo obtener contexto Canvas 2D para texturas 3D.');
  }
  return { canvas, ctx };
}

function traceBeanHeartPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number
): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - ry * 0.52);
  ctx.bezierCurveTo(cx + rx * 0.55, cy - ry * 1.05, cx + rx * 1.12, cy - ry * 0.35, cx + rx * 0.86, cy + ry * 0.35);
  ctx.bezierCurveTo(cx + rx * 0.60, cy + ry * 0.92, cx + rx * 0.18, cy + ry * 1.02, cx, cy + ry * 1.02);
  ctx.bezierCurveTo(cx - rx * 0.18, cy + ry * 1.02, cx - rx * 0.60, cy + ry * 0.92, cx - rx * 0.86, cy + ry * 0.35);
  ctx.bezierCurveTo(cx - rx * 1.12, cy - ry * 0.35, cx - rx * 0.55, cy - ry * 1.05, cx, cy - ry * 0.52);
  ctx.closePath();
}

/**
 * Dibuja el logotipo oficial GOMANÍA usando trazados vectoriales puros Canvas2D
 * con contorno blanco grueso troquelado.
 */
function drawGomaniaVectorLogo(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  scale = 1.0,
  tiltRad = -0.05
): void {
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(tiltRad);
  ctx.scale(scale, scale);

  const pathG = (): void => {
    ctx.beginPath();
    ctx.moveTo(-142, -334);
    ctx.bezierCurveTo(-225, -354, -345, -340, -372, -268);
    ctx.bezierCurveTo(-396, -204, -384, -108, -338, -74);
    ctx.bezierCurveTo(-290, -40, -195, -52, -135, -80);
    ctx.lineTo(-140, -214);
    ctx.lineTo(-244, -198);
    ctx.lineTo(-238, -138);
    ctx.bezierCurveTo(-258, -135, -264, -158, -264, -194);
    ctx.bezierCurveTo(-264, -234, -248, -252, -198, -248);
    ctx.lineTo(-146, -240);
    ctx.closePath();
  };

  const pathO = (): void => {
    ctx.beginPath();
    ctx.moveTo(-36, -254);
    ctx.bezierCurveTo(26, -256, 48, -222, 50, -162);
    ctx.bezierCurveTo(52, -100, 30, -70, -30, -68);
    ctx.bezierCurveTo(-94, -66, -114, -98, -114, -160);
    ctx.bezierCurveTo(-114, -224, -92, -252, -36, -254);
    ctx.closePath();
  };

  const pathM = (): void => {
    ctx.beginPath();
    ctx.moveTo(74, -330);
    ctx.quadraticCurveTo(136, -342, 198, -330);
    ctx.lineTo(222, -232);
    ctx.lineTo(246, -332);
    ctx.quadraticCurveTo(312, -332, 368, -308);
    ctx.lineTo(364, -62);
    ctx.lineTo(272, -66);
    ctx.lineTo(270, -172);
    ctx.lineTo(216, -106);
    ctx.lineTo(166, -174);
    ctx.lineTo(166, -70);
    ctx.lineTo(72, -72);
    ctx.closePath();
  };

  const pathA1 = (): void => {
    ctx.beginPath();
    ctx.moveTo(-314, -32);
    ctx.quadraticCurveTo(-258, -44, -200, -24);
    ctx.lineTo(-158, 194);
    ctx.lineTo(-244, 194);
    ctx.lineTo(-246, 162);
    ctx.lineTo(-274, 164);
    ctx.lineTo(-276, 198);
    ctx.lineTo(-358, 214);
    ctx.closePath();
  };

  const pathN = (): void => {
    ctx.beginPath();
    ctx.moveTo(-136, -24);
    ctx.quadraticCurveTo(-102, -32, -64, -24);
    ctx.lineTo(-36, 56);
    ctx.lineTo(-32, -20);
    ctx.quadraticCurveTo(8, -28, 46, -16);
    ctx.lineTo(42, 232);
    ctx.lineTo(-38, 224);
    ctx.lineTo(-64, 152);
    ctx.lineTo(-68, 214);
    ctx.lineTo(-138, 206);
    ctx.closePath();
  };

  const pathIStem = (): void => {
    ctx.beginPath();
    ctx.moveTo(78, 56);
    ctx.quadraticCurveTo(118, 48, 158, 56);
    ctx.lineTo(158, 250);
    ctx.lineTo(84, 244);
    ctx.closePath();
  };

  const pathIBean = (): void => {
    ctx.beginPath();
    ctx.moveTo(132, -46);
    ctx.bezierCurveTo(164, -56, 180, -20, 162, 12);
    ctx.bezierCurveTo(144, 42, 102, 50, 82, 34);
    ctx.bezierCurveTo(68, 22, 74, 2, 94, -4);
    ctx.bezierCurveTo(114, -10, 118, -24, 122, -36);
    ctx.bezierCurveTo(124, -42, 128, -45, 132, -46);
    ctx.closePath();
  };

  const pathA2 = (): void => {
    ctx.beginPath();
    ctx.moveTo(214, -36);
    ctx.quadraticCurveTo(282, -52, 346, -34);
    ctx.lineTo(422, 224);
    ctx.lineTo(330, 248);
    ctx.lineTo(320, 198);
    ctx.lineTo(292, 202);
    ctx.lineTo(296, 252);
    ctx.lineTo(198, 256);
    ctx.closePath();
  };

  const pathWaveRibbon = (): void => {
    ctx.beginPath();
    ctx.moveTo(-348, 244);
    ctx.bezierCurveTo(-190, 200, -50, 272, 130, 294);
    ctx.bezierCurveTo(270, 310, 368, 286, 440, 246);
    ctx.lineTo(466, 298);
    ctx.bezierCurveTo(378, 346, 260, 368, 114, 348);
    ctx.bezierCurveTo(-60, 322, -196, 238, -342, 274);
    ctx.closePath();
  };

  const taglineText = 'MAS DE 100 SABORES';
  const getTaglineTransform = (u: number): { x: number; y: number } => {
    const x = -318 + u * 756;
    const y =
      328 -
      Math.sin(u * Math.PI * 1.15 + 0.55) * -18 +
      Math.sin((u - 0.12) * Math.PI) * 58 +
      (u > 0.5 ? (u - 0.5) * 18 : 0);
    return { x, y };
  };

  const drawTaglineLetters = (isOutline: boolean): void => {
    ctx.font = '700 66px "Fredoka", "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const chars = taglineText.split('');
    const total = chars.length - 1;

    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (ch === ' ') continue;
      const u = i / total;
      const p0 = getTaglineTransform(Math.max(0, u - 0.02));
      const p1 = getTaglineTransform(Math.min(1, u + 0.02));
      const pos = getTaglineTransform(u);
      const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(angle);
      if (isOutline) {
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = 66;
        ctx.strokeStyle = BRAND_3D.white;
        ctx.strokeText(ch, 0, 0);
        ctx.fillStyle = BRAND_3D.white;
        ctx.fillText(ch, 0, 0);
      } else {
        ctx.lineJoin = 'round';
        ctx.lineWidth = 5;
        ctx.strokeStyle = BRAND_3D.cyan;
        ctx.strokeText(ch, 0, 0);
        ctx.fillStyle = BRAND_3D.cyan;
        ctx.fillText(ch, 0, 0);
      }
      ctx.restore();
    }
  };

  const allLetterPaths = [pathG, pathO, pathM, pathA1, pathN, pathIStem, pathIBean, pathA2, pathWaveRibbon];

  // CAPA 1: Contorno blanco troquelado continuo
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.fillStyle = BRAND_3D.white;
  ctx.strokeStyle = BRAND_3D.white;

  ctx.beginPath();
  ctx.roundRect(-340, -255, 695, 495, 95);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-340, 175);
  ctx.bezierCurveTo(-120, 170, 180, 225, 420, 200);
  ctx.lineTo(445, 345);
  ctx.bezierCurveTo(180, 415, -120, 345, -335, 330);
  ctx.closePath();
  ctx.fill();

  ctx.lineWidth = 74;
  allLetterPaths.forEach((drawFn) => {
    drawFn();
    ctx.stroke();
    ctx.fill();
  });

  drawTaglineLetters(true);
  ctx.restore();

  // CAPA 2: Rellenos vectoriales de marca
  const fillShape = (drawFn: () => void, color: string): void => {
    drawFn();
    ctx.fillStyle = color;
    ctx.fill();
  };

  fillShape(pathG, BRAND_3D.cyan);
  fillShape(pathO, BRAND_3D.pinkLogo);
  fillShape(pathM, BRAND_3D.cyan);
  fillShape(pathA1, BRAND_3D.pinkLogo);
  fillShape(pathN, BRAND_3D.cyan);
  fillShape(pathIStem, BRAND_3D.cyan);
  fillShape(pathIBean, BRAND_3D.cyan);
  fillShape(pathA2, BRAND_3D.pinkLogo);
  fillShape(pathWaveRibbon, BRAND_3D.cyan);

  // CAPA 3: Detalles internos blancos
  ctx.fillStyle = BRAND_3D.white;
  traceBeanHeartPath(ctx, -31, -155, 42, 34);
  ctx.fill();
  traceBeanHeartPath(ctx, -258, 72, 42, 33);
  ctx.fill();
  traceBeanHeartPath(ctx, 298, 102, 54, 42);
  ctx.fill();

  ctx.save();
  ctx.strokeStyle = BRAND_3D.white;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(152, -26);
  ctx.bezierCurveTo(160, -10, 152, 10, 134, 22);
  ctx.stroke();
  ctx.restore();

  drawTaglineLetters(false);
  ctx.restore();
}

function drawHeart(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  ctx.moveTo(0, size * 0.42);
  ctx.bezierCurveTo(-size * 0.65, -size * 0.05, -size * 0.58, -size * 0.72, 0, -size * 0.25);
  ctx.bezierCurveTo(size * 0.58, -size * 0.72, size * 0.65, -size * 0.05, 0, size * 0.42);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawCurvedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  flipBottom = false
): void {
  ctx.save();
  ctx.translate(cx, cy);
  const chars = text.split('');
  const denom = Math.max(1, chars.length - 1);
  chars.forEach((ch, idx) => {
    const t = chars.length === 1 ? 0.5 : idx / denom;
    const a = startAngle + (endAngle - startAngle) * t;
    ctx.save();
    ctx.rotate(a);
    ctx.translate(0, flipBottom ? radius : -radius);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
  ctx.restore();
}

function drawCandyPouchBackground(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  seedVal = 17
): void {
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#EE5D8A');
  grad.addColorStop(0.5, '#EC5886');
  grad.addColorStop(1, '#E44E7C');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 232, 240, 0.36)';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  let s = seedVal;
  const rand = (): number => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  for (let i = 0; i < 82; i++) {
    const dx = W * (0.04 + rand() * 0.92);
    const dy = H * (0.14 + rand() * 0.76);
    const rot = rand() * Math.PI * 2;
    const sc = 0.7 + rand() * 0.85;
    const kind = i % 6;

    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(rot);
    ctx.scale(sc, sc);
    ctx.lineWidth = 4.6;

    if (kind === 0) {
      ctx.beginPath();
      ctx.moveTo(-28, 0);
      ctx.bezierCurveTo(-30, -26, 28, -28, 30, -2);
      ctx.bezierCurveTo(32, 22, 4, 24, -4, 13);
      ctx.bezierCurveTo(-12, 24, -26, 18, -28, 0);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-8, -7, 7, Math.PI, Math.PI * 1.6);
      ctx.stroke();
    } else if (kind === 1) {
      for (let seg = -36; seg <= 36; seg += 13) {
        const sy = Math.sin(seg * 0.065) * 9;
        ctx.beginPath();
        ctx.ellipse(seg, sy, 9, 14, 0.25, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (kind === 2) {
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.stroke();
    } else if (kind === 3) {
      ctx.beginPath();
      ctx.moveTo(0, -24);
      ctx.quadraticCurveTo(28, -12, 18, 22);
      ctx.quadraticCurveTo(0, 30, -18, 22);
      ctx.quadraticCurveTo(-28, -12, 0, -24);
      ctx.stroke();
      for (let p = 0; p < 5; p++) {
        ctx.beginPath();
        ctx.arc((p - 2) * 7, (p % 2) * 8 - 2, 2.0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (kind === 4) {
      ctx.beginPath();
      ctx.moveTo(0, 16);
      ctx.bezierCurveTo(-26, -4, -22, -26, 0, -10);
      ctx.bezierCurveTo(22, -26, 26, -4, 0, 16);
      ctx.stroke();
    } else {
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 4.5; a += 0.3) {
        const r = 2 + a * 1.7;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (a === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();

  const numStripes = 11;
  const stripeW = W / numStripes;
  const topStraightH = H * 0.145;
  const rArc = stripeW * 0.5;

  for (let i = 0; i < numStripes; i++) {
    const sx = i * stripeW;
    const isLight = i % 2 === 1;
    ctx.fillStyle = isLight ? BRAND_3D.pinkStripeLight : '#EE6A94';
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx + stripeW, 0);
    ctx.lineTo(sx + stripeW, topStraightH);
    ctx.arc(sx + rArc, topStraightH, rArc, 0, Math.PI, false);
    ctx.closePath();
    ctx.fill();
  }

  const botStartY = H * 0.912;
  for (let i = 0; i < numStripes; i++) {
    const sx = i * stripeW;
    const isLight = i % 2 === 1;
    ctx.fillStyle = isLight ? BRAND_3D.pinkStripeLight : '#EE6A94';
    ctx.beginPath();
    ctx.moveTo(sx, H);
    ctx.lineTo(sx, botStartY);
    ctx.arc(sx + rArc, botStartY, rArc, Math.PI, 0, false);
    ctx.lineTo(sx + stripeW, H);
    ctx.closePath();
    ctx.fill();
  }

  const zipV = (POUCH_CONFIG.zipNy + 1) * 0.5;
  const zipY = (1 - zipV) * H;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
  ctx.fillRect(W * 0.06, zipY - 9, W * 0.88, 5);
  ctx.fillStyle = 'rgba(170, 35, 80, 0.18)';
  ctx.fillRect(W * 0.06, zipY + 3, W * 0.88, 6);

  const leftGrad = ctx.createLinearGradient(0, 0, W * 0.06, 0);
  leftGrad.addColorStop(0, 'rgba(130, 22, 60, 0.24)');
  leftGrad.addColorStop(1, 'rgba(130, 22, 60, 0)');
  ctx.fillStyle = leftGrad;
  ctx.fillRect(0, 0, W * 0.06, H);

  const rightGrad = ctx.createLinearGradient(W, 0, W * 0.94, 0);
  rightGrad.addColorStop(0, 'rgba(130, 22, 60, 0.24)');
  rightGrad.addColorStop(1, 'rgba(130, 22, 60, 0)');
  ctx.fillStyle = rightGrad;
  ctx.fillRect(W * 0.94, 0, W * 0.06, H);
}

function drawChileanOctagon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number
): void {
  const traceOct = (rad: number): void => {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i * Math.PI) / 4;
      const px = cx + Math.cos(a) * rad;
      const py = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };

  ctx.save();
  traceOct(r * 1.075);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  traceOct(r * 1.015);
  ctx.fillStyle = '#111111';
  ctx.fill();

  traceOct(r * 0.94);
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = r * 0.05;
  ctx.stroke();

  traceOct(r * 0.915);
  ctx.fillStyle = '#111111';
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = `700 ${Math.round(r * 0.30)}px "Oswald", "Inter", sans-serif`;
  ctx.fillText('ALTO EN', cx, cy - r * 0.25);

  ctx.font = `700 ${Math.round(r * 0.31)}px "Oswald", "Inter", sans-serif`;
  ctx.fillText('CALORÍAS', cx, cy + r * 0.07);

  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillRect(cx - r * 0.38, cy + r * 0.28, r * 0.76, r * 0.022);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `500 ${Math.round(r * 0.14)}px "Inter", sans-serif`;
  ctx.fillText('Ministerio', cx, cy + r * 0.44);
  ctx.fillText('de Salud', cx, cy + r * 0.59);
  ctx.restore();
}

function drawWomenFoundedSeal(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number
): void {
  ctx.save();
  const scallops = 18;
  ctx.beginPath();
  for (let i = 0; i <= scallops * 8; i++) {
    const a = (i / (scallops * 8)) * Math.PI * 2;
    const rad = r * (0.962 + 0.038 * Math.cos(a * scallops));
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#F7CAD9';
  ctx.stroke();

  drawHeart(ctx, cx, cy + r * 0.04, r * 0.72, BRAND_3D.pinkLogo);

  ctx.fillStyle = '#2B1D25';
  ctx.font = `800 ${Math.round(r * 0.175)}px "Inter", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  drawCurvedText(ctx, 'EMPRESA FUNDADA', cx, cy, r * 0.73, -1.34, 1.34, false);
  drawCurvedText(ctx, 'POR MUJERES', cx, cy, r * 0.74, 1.06, -1.06, true);

  ctx.beginPath();
  ctx.arc(cx - r * 0.73, cy + r * 0.04, r * 0.032, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.73, cy + r * 0.04, r * 0.032, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Crea las texturas de la CARA FRONTAL (2048×3072): color + mapa alfa.
 */
export function createFrontTextures(): PanelTexturePair {
  const W = 2048;
  const H = 3072;

  const { canvas: colorCanvas, ctx } = createCanvas2D(W, H);
  drawCandyPouchBackground(ctx, W, H, 23);

  const octR = 136;
  drawChileanOctagon(ctx, W * 0.685, H * 0.242, octR);
  drawChileanOctagon(ctx, W * 0.855, H * 0.242, octR);
  drawChileanOctagon(ctx, W * 0.855, H * 0.352, octR);

  drawGomaniaVectorLogo(ctx, W * 0.438, H * 0.455, 1.24, -0.052);

  ctx.save();
  traceKidneyWindow2D(ctx, W, H, 1.012);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(138, 22, 62, 0.25)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;

  const weightX = W * 0.822;
  const weightY = H * 0.798;
  ctx.font = '700 118px "Fredoka", "Inter", sans-serif';
  ctx.fillText('80gr', weightX, weightY);

  ctx.shadowBlur = 6;
  ctx.font = '700 44px "Inter", sans-serif';
  ctx.fillText('Peso neto', weightX, weightY + 86);
  ctx.restore();

  const badgeCx = POUCH_CONFIG.badge.u * W;
  const badgeCy = (1.0 - POUCH_CONFIG.badge.v) * H;
  const badgeR = POUCH_CONFIG.badge.rU * W;
  drawWomenFoundedSeal(ctx, badgeCx, badgeCy, badgeR);

  const { canvas: alphaCanvas, ctx: aCtx } = createCanvas2D(W, H);
  aCtx.fillStyle = '#FFFFFF';
  aCtx.fillRect(0, 0, W, H);

  traceKidneyWindow2D(aCtx, W, H, 1.0);
  aCtx.fillStyle = '#000000';
  aCtx.fill();

  aCtx.beginPath();
  aCtx.arc(badgeCx, badgeCy, badgeR * 0.99, 0, Math.PI * 2);
  aCtx.fillStyle = '#FFFFFF';
  aCtx.fill();

  traceEuroHole2D(aCtx, W, H);
  aCtx.fillStyle = '#000000';
  aCtx.fill();

  const colorTex = new THREE.CanvasTexture(colorCanvas);
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.anisotropy = 16;

  const alphaTex = new THREE.CanvasTexture(alphaCanvas);
  alphaTex.anisotropy = 8;

  return { colorTex, alphaTex };
}

function drawCyanQRCode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number
): void {
  const cells = 21;
  const cell = size / cells;
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x - 10, y - 10, size + 20, size + 20);
  ctx.fillStyle = BRAND_3D.cyan;

  const drawFinder = (gx: number, gy: number): void => {
    ctx.fillRect(x + gx * cell, y + gy * cell, 7 * cell, 7 * cell);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x + (gx + 1) * cell, y + (gy + 1) * cell, 5 * cell, 5 * cell);
    ctx.fillStyle = BRAND_3D.cyan;
    ctx.fillRect(x + (gx + 2) * cell, y + (gy + 2) * cell, 3 * cell, 3 * cell);
  };

  drawFinder(0, 0);
  drawFinder(cells - 7, 0);
  drawFinder(0, cells - 7);

  let s = 90210;
  const rand = (): number => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      const inTL = r < 8 && c < 8;
      const inTR = r < 8 && c >= cells - 8;
      const inBL = r >= cells - 8 && c < 8;
      if (inTL || inTR || inBL) continue;
      if (r === 6 || c === 6) {
        if ((r + c) % 2 === 0) ctx.fillRect(x + c * cell, y + r * cell, Math.ceil(cell), Math.ceil(cell));
        continue;
      }
      if (rand() > 0.48) {
        ctx.fillRect(x + c * cell, y + r * cell, Math.ceil(cell), Math.ceil(cell));
      }
    }
  }
  ctx.restore();
}

/**
 * Crea las texturas de la CARA TRASERA (2048×3072).
 */
export function createBackTextures(): PanelTexturePair {
  const W = 2048;
  const H = 3072;

  const { canvas: colorCanvas, ctx } = createCanvas2D(W, H);
  drawCandyPouchBackground(ctx, W, H, 109);
  drawGomaniaVectorLogo(ctx, W * 0.5, H * 0.215, 0.44, -0.02);

  const drawWrapped = (
    text: string,
    x: number,
    y: number,
    maxW: number,
    lineH: number,
    font: string,
    color: string
  ): number => {
    ctx.save();
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const words = text.split(' ');
    let line = '';
    let yy = y;
    for (let i = 0; i < words.length; i++) {
      const test = line ? `${line} ${words[i]}` : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, yy);
        line = words[i];
        yy += lineH;
      } else {
        line = test;
      }
    }
    if (line) {
      ctx.fillText(line, x, yy);
      yy += lineH;
    }
    ctx.restore();
    return yy;
  };

  const cardTop = H * 0.305;
  const cardH = H * 0.528;

  // TARJETA IZQUIERDA: INFORMACIÓN NUTRICIONAL + INGREDIENTES
  const lx = W * 0.088;
  const lw = W * 0.445;
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(lx, cardTop, lw, cardH, 34);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(233, 85, 125, 0.22)';
  ctx.stroke();

  const lPad = 36;
  const lInnerW = lw - lPad * 2;
  let y = cardTop + 68;

  ctx.fillStyle = BRAND_3D.cyan;
  ctx.font = '700 48px "Oswald", "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('INFORMACIÓN NUTRICIONAL', lx + lw * 0.5, y);

  y += 24;
  ctx.fillStyle = BRAND_3D.cyan;
  ctx.fillRect(lx + lPad, y, lInnerW, 6);

  y += 42;
  ctx.fillStyle = '#2B2228';
  ctx.textAlign = 'left';
  ctx.font = '600 28px "Inter", sans-serif';
  ctx.fillText('Porción: 1 taza (30 g)', lx + lPad, y);
  y += 38;
  ctx.fillText('Porciones por envase: aprox. 2,7', lx + lPad, y);

  y += 24;
  ctx.fillStyle = '#2B2228';
  ctx.fillRect(lx + lPad, y, lInnerW, 5);

  y += 40;
  ctx.font = '700 26px "Inter", sans-serif';
  ctx.fillStyle = BRAND_3D.cyan;
  ctx.textAlign = 'left';
  ctx.fillText('Nutriente', lx + lPad, y);
  ctx.textAlign = 'right';
  ctx.fillText('100 g', lx + lPad + lInnerW - 150, y);
  ctx.fillText('1 Porción', lx + lPad + lInnerW, y);

  y += 16;
  ctx.fillStyle = '#DCE8EF';
  ctx.fillRect(lx + lPad, y, lInnerW, 4);

  const nutRows: readonly [string, string, string][] = [
    ['Energía (kcal)', '338', '101'],
    ['Proteínas (g)', '3,4', '1,0'],
    ['Grasas totales (g)', '0,1', '0,0'],
    ['Hidratos de carbono (g)', '80,8', '24,2'],
    ['  Azúcares totales (g)', '63,5', '19,1'],
    ['Sodio (mg)', '45', '14'],
  ];

  nutRows.forEach((row, idx) => {
    y += 58;
    const isMain = !row[0].startsWith('  ');
    ctx.fillStyle = '#241D21';
    ctx.font = `${isMain ? '600' : '400'} 28px "Inter", sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(row[0], lx + lPad, y);
    ctx.textAlign = 'right';
    ctx.fillText(row[1], lx + lPad + lInnerW - 150, y);
    ctx.font = '700 28px "Inter", sans-serif';
    ctx.fillText(row[2], lx + lPad + lInnerW, y);

    if (idx < nutRows.length - 1) {
      ctx.fillStyle = '#EFE6EA';
      ctx.fillRect(lx + lPad, y + 18, lInnerW, 3);
    }
  });

  y += 44;
  ctx.fillStyle = BRAND_3D.pinkLogo;
  ctx.fillRect(lx + lPad, y, lInnerW, 5);

  y += 52;
  ctx.fillStyle = BRAND_3D.pinkLogo;
  ctx.font = '700 34px "Fredoka", "Inter", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('INGREDIENTES:', lx + lPad, y);

  y += 40;
  y = drawWrapped(
    'Jarabe de glucosa, azúcar, agua purificada, gelatina comestible, dextrosa, almidón de maíz, estabilizante (tetrasodio difosfato), aromatizantes idénticos a natural (frutilla, vainilla, manzana verde, limón y arándano) y colorantes permitidos.',
    lx + lPad,
    y,
    lInnerW,
    39,
    '500 26px "Inter", sans-serif',
    '#3E3238'
  );

  y += 26;
  drawWrapped(
    'ALÉRGENOS: Elaborado en líneas que también procesan derivados de leche y soya. Conservar en lugar fresco y seco.',
    lx + lPad,
    y,
    lInnerW,
    36,
    '600 24px "Inter", sans-serif',
    BRAND_3D.pinkLogo
  );
  ctx.restore();

  // TARJETA DERECHA: HISTORIA, EMBLEMA, CONTACTO Y QR
  const rx = W * 0.556;
  const rw = W * 0.356;
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(rx, cardTop, rw, cardH, 34);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(0, 147, 196, 0.22)';
  ctx.stroke();

  const rPad = 34;
  const rInnerW = rw - rPad * 2;
  let ry = cardTop + 68;

  ctx.fillStyle = BRAND_3D.pinkLogo;
  ctx.font = '700 38px "Fredoka", "Inter", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Con mucho cariño...', rx + rPad, ry);

  ry += 46;
  ry = drawWrapped(
    'Hoy este sueño se transforma en Gomanía, una dulcería pensada para compartir sonrisas y más de 100 sabores distintos en cada bolsita.',
    rx + rPad,
    ry,
    rInnerW,
    39,
    '500 27px "Inter", sans-serif',
    '#3E3238'
  );

  ry += 18;
  ry = drawWrapped(
    'Gracias por ser parte de esta historia y acompañarnos en este dulce camino.',
    rx + rPad,
    ry,
    rInnerW,
    38,
    '600 27px "Inter", sans-serif',
    BRAND_3D.pinkLogo
  );

  const embCx = rx + rw * 0.5;
  const embCy = ry + 135;
  const embR = 104;

  ctx.save();
  ctx.beginPath();
  ctx.arc(embCx, embCy, embR, 0, Math.PI * 2);
  ctx.strokeStyle = BRAND_3D.cyan;
  ctx.lineWidth = 5;
  ctx.setLineDash([12, 8]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.arc(embCx, embCy, embR * 0.60, 0, Math.PI * 2);
  ctx.fillStyle = '#EAF7FC';
  ctx.fill();

  drawHeart(ctx, embCx, embCy + 4, embR * 0.58, BRAND_3D.cyan);

  ctx.fillStyle = BRAND_3D.cyan;
  ctx.font = '700 20px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  drawCurvedText(ctx, 'HECHO CON CARIÑO', embCx, embCy, embR * 0.80, -1.35, 1.35, false);
  drawCurvedText(ctx, 'PYME CHILENA', embCx, embCy, embR * 0.80, 1.05, -1.05, true);
  ctx.restore();

  let cy = embCy + embR + 54;
  ctx.fillStyle = BRAND_3D.pinkLogo;
  ctx.font = '700 32px "Fredoka", "Inter", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Contacto y ventas:', rx + rPad, cy);

  cy += 46;
  ctx.fillStyle = BRAND_3D.cyan;
  ctx.font = '700 27px "Inter", sans-serif';
  ctx.fillText('IG  @gomania.cl', rx + rPad, cy);
  cy += 42;
  ctx.fillText('WA +56 9 9458 2202', rx + rPad, cy);
  cy += 42;
  ctx.font = '600 24px "Inter", sans-serif';
  ctx.fillText('contacto@gomania.cl', rx + rPad, cy);

  const qrSize = 265;
  drawCyanQRCode(ctx, rx + (rw - qrSize) * 0.5, cardTop + cardH - qrSize - 42, qrSize);
  ctx.restore();

  // Píldora inferior de Lote y Vencimiento
  ctx.save();
  const pillW = W * 0.52;
  const pillH = 68;
  const pillX = (W - pillW) * 0.5;
  const pillY = H * 0.856;
  ctx.fillStyle = '#2B1822';
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillW, pillH, 34);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 29px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('LOTE: GM26 · CONSUMIR ANTES DE: 11/2027', W * 0.5, pillY + pillH * 0.5);
  ctx.restore();

  const { canvas: alphaCanvas, ctx: aCtx } = createCanvas2D(W, H);
  aCtx.fillStyle = '#FFFFFF';
  aCtx.fillRect(0, 0, W, H);
  traceEuroHole2D(aCtx, W, H);
  aCtx.fillStyle = '#000000';
  aCtx.fill();

  const colorTex = new THREE.CanvasTexture(colorCanvas);
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.anisotropy = 16;

  const alphaTex = new THREE.CanvasTexture(alphaCanvas);
  alphaTex.anisotropy = 8;

  return { colorTex, alphaTex };
}

/**
 * Crea la textura celeste del FUELLE INFERIOR (Bottom Gusset).
 */
export function createBlueGussetTexture(): THREE.CanvasTexture {
  const W = 1536;
  const H = 640;
  const { canvas, ctx } = createCanvas2D(W, H);

  ctx.fillStyle = BRAND_3D.cyan;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(0, 90, 128, 0.22)';
  ctx.fillRect(0, H * 0.5 - 3, W, 6);

  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = '700 28px "Inter", sans-serif';
  ctx.fillText('ENVASADO Y DISTRIBUIDO POR GOMANÍA SpA', W * 0.36, H * 0.31);
  ctx.font = '500 24px "Inter", sans-serif';
  ctx.fillText('QUILPUÉ, REGIÓN DE VALPARAÍSO, CHILE.', W * 0.36, H * 0.40);
  ctx.font = '500 22px "Inter", sans-serif';
  ctx.fillText('MANTENER EN UN LUGAR FRESCO, SECO Y LIMPIO.', W * 0.36, H * 0.58);
  ctx.fillText('RES. SANITARIA SEREMI DE SALUD · VER VENCIMIENTO EN ENVASE.', W * 0.36, H * 0.67);
  ctx.restore();

  const fx = W * 0.70;
  const fy = H * 0.25;
  const fw = 112;
  const fh = 72;
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(fx - 4, fy - 4, fw + 8, fh + 8);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(fx, fy, fw, fh * 0.5);
  ctx.fillStyle = '#0039A6';
  ctx.fillRect(fx, fy, fw * 0.36, fh * 0.5);
  ctx.fillStyle = '#D52B1E';
  ctx.fillRect(fx, fy + fh * 0.5, fw, fh * 0.5);

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  const sx = fx + fw * 0.18;
  const sy = fy + fh * 0.25;
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? 11 : 4.5;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = sx + Math.cos(a) * rad;
    const py = sy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 22px "Inter", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('ENVASADO', fx + fw + 16, fy + fh * 0.32);
  ctx.fillText('EN CHILE', fx + fw + 16, fy + fh * 0.72);
  ctx.restore();

  const rx = W * 0.76;
  const ry = H * 0.65;
  ctx.save();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(rx, ry - 38);
  ctx.lineTo(rx + 36, ry + 26);
  ctx.lineTo(rx - 36, ry + 26);
  ctx.closePath();
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 26px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('7', rx, ry + 6);
  ctx.font = '700 20px "Inter", sans-serif';
  ctx.fillText('OTROS · RECICLA', rx + 115, ry + 4);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  return tex;
}

/**
 * Mapa de relieve (bumpMap) de la lámina Doypack.
 */
export function createPouchBumpTexture(): THREE.CanvasTexture {
  const W = 1024;
  const H = 1536;
  const { canvas, ctx } = createCanvas2D(W, H);

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, W, H);

  let s = 555;
  const rand = (): number => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  for (let i = 0; i < 36; i++) {
    const gx = rand() * W;
    const gy = rand() * H;
    const gr = 70 + rand() * 170;
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
    const lum = i % 2 === 0 ? 140 : 116;
    g.addColorStop(0, `rgba(${lum},${lum},${lum},0.14)`);
    g.addColorStop(1, 'rgba(128,128,128,0)');
    ctx.fillStyle = g;
    ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
  }

  const sealPx = Math.floor(W * (1 - POUCH_CONFIG.sideSealNx) * 0.5);
  for (let y = 0; y < H; y += 6) {
    ctx.fillStyle = (y / 6) % 2 === 0 ? '#ACACAC' : '#565656';
    ctx.fillRect(0, y, sealPx, 3);
    ctx.fillRect(W - sealPx, y, sealPx, 3);
  }

  const topSealPx = Math.floor(H * 0.038);
  for (let x = 0; x < W; x += 6) {
    ctx.fillStyle = (x / 6) % 2 === 0 ? '#ACACAC' : '#565656';
    ctx.fillRect(x, 0, 3, topSealPx);
  }

  const zipV = (POUCH_CONFIG.zipNy + 1) * 0.5;
  const zipY = (1 - zipV) * H;
  ctx.fillStyle = '#DEDEDE';
  ctx.fillRect(sealPx, zipY - 8, W - sealPx * 2, 5);
  ctx.fillStyle = '#4A4A4A';
  ctx.fillRect(sealPx, zipY - 2, W - sealPx * 2, 4);
  ctx.fillStyle = '#D8D8D8';
  ctx.fillRect(sealPx, zipY + 4, W - sealPx * 2, 5);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  return tex;
}

/**
 * Microtextura granulada y costrosa para simular el baño de azúcar caramelizada
 * del maní confitado.
 */
export function createCandiedSugarBumpTexture(): THREE.CanvasTexture {
  const S = 256;
  const { canvas, ctx } = createCanvas2D(S, S);
  const img = ctx.createImageData(S, S);
  const data = img.data;

  let s = 314159;
  for (let i = 0; i < data.length; i += 4) {
    s = (s * 16807) % 2147483647;
    const v = 92 + (s % 76);
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  // Grumos de azúcar cristalizada de mayor relieve sobre el grano fino
  let gs = 77177;
  const rand = (): number => {
    gs = (gs * 16807) % 2147483647;
    return (gs - 1) / 2147483646;
  };
  for (let i = 0; i < 160; i++) {
    const cx = rand() * S;
    const cy = rand() * S;
    const r = 3 + rand() * 8;
    const lum = i % 2 === 0 ? 225 : 55;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `rgba(${lum},${lum},${lum},0.55)`);
    grad.addColorStop(1, 'rgba(128,128,128,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

/**
 * Sombra radial suave de contacto sobre el suelo blanco puro.
 */
export function createContactShadowTexture(): THREE.CanvasTexture {
  const S = 512;
  const { canvas, ctx } = createCanvas2D(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.05, S / 2, S / 2, S * 0.48);
  g.addColorStop(0, 'rgba(20, 24, 34, 0.22)');
  g.addColorStop(0.45, 'rgba(20, 24, 34, 0.085)');
  g.addColorStop(0.8, 'rgba(20, 24, 34, 0.018)');
  g.addColorStop(1, 'rgba(20, 24, 34, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(canvas);
}
