# Guía de Compilación y Producción — GoManía SpA (HostGator)

Este proyecto utiliza **Astro 5 (`output: 'static'`) + TypeScript 5 + CSS Variables + Proxy PHP 8** sin frameworks pesados, diseñado para subirse directamente a **HostGator Plan Negocios** (subdominio o dominio propio).

---

## 1. Requisitos Locales (Tu PC)

- **Node.js 20 LTS o 22 LTS**
- Dependencias ya fijadas en `package.json`:
  - `astro@^5`
  - `typescript@^5`
  - `@astrojs/check`

Si acabas de clonar o descomprimir el proyecto por primera vez:

```bash
npm install
```

*(Si npm bloquea scripts de instalación de `esbuild` o `sharp`, apruébalos con `npm install-scripts approve esbuild sharp && npm rebuild esbuild sharp`).*

---

## 2. Comandos de Desarrollo y Verificación

| Comando | Qué hace |
| :--- | :--- |
| `npm run dev` | Levanta servidor local con recarga instantánea en `http://localhost:4321` |
| `npm run check` | Revisa errores de TypeScript y contratos en archivos `.astro` y `.ts` |
| `npm run build` | Compila la web estática final en la carpeta `dist/` |
| `npm run preview` | Previsualiza localmente la carpeta `dist/` ya compilada |

---

## 3. Cómo Personalizar Antes de Subir a Producción

1. **Datos de contacto, redes y precios:** edita `src/shared/config.ts` (WhatsApp, correo, TikTok, Instagram, Facebook y tabla de formatos).
2. **Cambiar paleta de colores (3 temas incluidos):** edita `DEFAULT_THEME` en `src/shared/config.ts`:
   - `'impacto-rosado'` *(activo por defecto)*
   - `'candy-limpio'`
   - `'pop-dual'`
3. **Imágenes locales (solo logos a color):**
   - `public/images/brand/`: logo horizontal a color, isotipo `G&M` para favicon e imagen Open Graph.
   - `public/images/productos/calcomanias/`: stickers PNG de cada sabor (`imgCalcomania`).
   - `public/images/productos/fotos/`: fotos PNG/WebP del producto (`imgProducto`).

---

## 4. Cómo Subir `dist/` a HostGator Plan Negocios

1. Ejecuta la verificación y compilación final en tu PC:
   ```bash
   npm run check
   npm run build
   ```
2. Abre la carpeta **`dist/`** generada en la raíz del proyecto. Allí encontrarás:
   - `index.html`
   - `_astro/` (CSS y JS minificados)
   - `images/` (tus logos y fotos de productos)
   - `api/` (cuando completes el Paso 2, aquí estarán `catalogo.php` y `pedido.php`)
3. Comprime el **contenido interior de `dist/`** (selecciona todos los archivos dentro de `dist/`, no la carpeta `dist` en sí) en un archivo `deploy-gomania.zip`.
4. Entra a **cPanel de HostGator → Administrador de archivos (File Manager)**:
   - Si usas subdominio temporal: entra a la carpeta del subdominio (ej. `public_html/gomania/`).
   - Si usas dominio propio: entra a `public_html/`.
5. Sube `deploy-gomania.zip`, haz clic derecho → **Extract (Extraer)** y luego borra el `.zip` subido.
6. Verifica en tu navegador que cargue la portada y que `https://tu-dominio.cl/api/catalogo.php` responda JSON válido una vez configurado el Paso 2.
