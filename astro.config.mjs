/**
 * ============================================================================
 * QUÉ HACE:
 * Configura Astro 5 en modo 100% estático (output: 'static') para compilar
 * la web completa en la carpeta `dist/` lista para HostGator Plan Negocios.
 *
 * QUÉ PUEDES EDITAR AQUÍ:
 * - `site`: reemplaza el subdominio placeholder cuando tengas tu dominio final
 *   (por ejemplo: 'https://gomania.cl').
 * - `base`: déjalo en '/' si va en raíz o subdominio; cámbialo solo si subes
 *   la web a una subcarpeta (ej. '/tienda').
 *
 * CON QUÉ MÓDULO CONECTA:
 * - Núcleo global de compilación (usado por `npm run dev` y `npm run build`).
 * ============================================================================
 */
import { defineConfig } from 'astro/config';

export default defineConfig({
  // Genera HTML/CSS/JS estático puro en `dist/` (compatible con HostGator).
  output: 'static',

  // URL pública del sitio (usada para metadatos Open Graph y URLs canónicas).
  site: 'https://gomania.cl',

  // Carpeta de salida al ejecutar `npm run build`.
  outDir: './dist',

  build: {
    // Mantiene los assets compilados ordenados en `dist/_astro/`.
    assets: '_astro',
  },
});
