# Integración del Paquete 3D GoManía (Astro 5 + Three.js)

## 1. Extraer archivos
Descomprime este `.zip` directamente en la raíz de tu proyecto `gomania/`. Quedarán creados estos 4 archivos respetando tu arquitectura modular:

- `src/features/landing-shell/logic/gomania-pouch-textures.ts`
- `src/features/landing-shell/logic/gomania-pouch-geometry.ts`
- `src/features/landing-shell/logic/gomania-pouch-scene.ts`
- `src/features/landing-shell/ui/GomaniaPouch3D.astro`

## 2. Tipos de TypeScript (recomendado)
Si usas `astro check` o TypeScript estricto, instala los tipos de Three.js:

```bash
npm install -D @types/three
```

## 3. Insertar en `src/features/landing-shell/ui/Hero.astro`
Importa el componente en el frontmatter de `Hero.astro`:

```astro
---
import GomaniaPouch3D from './GomaniaPouch3D.astro';
---
```

Y reemplaza el contenido de `.gm-hero__media-frame` manteniendo tu ilustración actual en el slot `fallback` (se muestra mientras carga o si el navegador no soporta WebGL):

```astro
<div class="gm-hero__media-wrap">
  <div class="gm-hero__media-frame" data-hero-media-frame>
    <GomaniaPouch3D background="white" autoRotate={true} showControls={true}>
      <div slot="fallback" class="gm-hero__fallback" data-hero-fallback>
        <!-- Pega aquí tu bloque actual .gm-hero__fallback -->
      </div>
    </GomaniaPouch3D>
  </div>
</div>
```

> Si prefieres que el paquete flote sin caja blanca sobre el fondo del hero, cambia `background="white"` por `background="transparent"`.
