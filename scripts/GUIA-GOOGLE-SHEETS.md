# Guía Paso a Paso: Conectar Google Sheets + HostGator ($0)

Esta guía explica cómo dejar funcionando el inventario por gramos, el registro de pedidos, el descuento automático de stock y los correos de seguimiento Blue Express para **GoManía SpA**.

---

## Paso 1: Crear el Google Sheet y pegar `Code.gs`

1. Entra a [sheets.google.com](https://sheets.google.com) con la cuenta de Google del negocio y crea una hoja nueva llamada **`GoManía - Inventario y Pedidos`**.
2. En el menú superior ve a **Extensiones → Apps Script**.
3. Borra el código vacío que aparece por defecto en `Código.gs` y pega todo el contenido de **`scripts/Code.gs`**.
4. En la parte superior de `Code.gs`, revisa el bloque `CONFIG`:
   - `API_TOKEN`: inventa una clave secreta sin espacios (ej. `GOMANIA_2026_X9K2`). Usarás esta misma clave en HostGator.
   - `WHATSAPP_DISPLAY`: escribe el número de WhatsApp real del negocio.
5. Presiona **Guardar** (ícono de disquete o `Ctrl + S`).

---

## Paso 2: Crear las pestañas `Inventario` y `Pedidos` automáticamente

1. En la barra superior del editor de Apps Script, selecciona la función **`setupHojasGomania`** en el selector de funciones.
2. Haz clic en **Ejecutar**.
3. Google pedirá autorización la primera vez: haz clic en **Revisar permisos → tu cuenta → Configuración avanzada → Ir a... (no seguro) → Permitir**.
4. Vuelve a tu Google Sheet: verás creadas automáticamente las 2 pestañas con sus colores, encabezados y listas desplegables:
   - **`Inventario`**: `id`, `nombre`, `tipo`, `categoria`, `stock_gramos`, `activo`, `img_calcomania`, `img_producto`.
   - **`Pedidos`**: `folio`, `fecha`, `cliente`, `correo`, `telefono`, `entrega`, `direccion`, `detalle_json`, `detalle_texto`, `total_clp`, `estado`, `codigo_blue_express`, `stock_descontado`.

---

## Paso 3: Activar el disparador automático de stock y correos (`onEditTrigger`)

> **Importante:** Este paso es obligatorio para que Google autorice el envío automático de correos cuando la dueña cambie el estado de un pedido.

1. En el menú izquierdo de Apps Script, haz clic en el ícono de **Reloj (Activadores / Triggers)**.
2. Haz clic en **+ Añadir activador** (abajo a la derecha) y configura:
   - **Función que se ejecutará:** `onEditTrigger`
   - **Implementación:** `Principal (Head)`
   - **Fuente del evento:** `De una hoja de cálculo`
   - **Tipo de evento:** `Al editarse`
3. Haz clic en **Guardar** y acepta los permisos si los vuelve a solicitar.

---

## Paso 4: Publicar como Aplicación Web (Web App)

1. Arriba a la derecha en Apps Script, haz clic en **Implementar → Nueva implementación**.
2. En el ícono de engranaje selecciona **Aplicación web**.
3. Configura exactamente así:
   - **Descripción:** `API GoManía v1`
   - **Ejecutar como:** `Yo (tu correo)`
   - **Quién tiene acceso:** `Cualquier persona`
4. Haz clic en **Implementar** y **copia la URL de la aplicación web** (termina en `/exec`).

---

## Paso 5: Conectar los archivos PHP en HostGator Plan Negocios

1. Abre **`public/api/catalogo.php`** y **`public/api/pedido.php`** en tu proyecto local.
2. En ambos archivos reemplaza:
   - `APPS_SCRIPT_URL`: pega la URL `/exec` que copiaste en el Paso 4.
   - `API_SHARED_TOKEN`: pega la misma clave exacta que pusiste en `CONFIG.API_TOKEN` de `Code.gs`.
3. Compila el proyecto con `npm run build`. Astro copiará automáticamente `public/api/*.php` dentro de `dist/api/`.
4. Sube el contenido de `dist/` a tu `public_html/` (o carpeta del subdominio) en el **File Manager de HostGator**.
5. Prueba en tu navegador entrando a `https://tu-dominio.cl/api/catalogo.php`: deberías ver el JSON con tus productos activos de `Inventario`.

---

## Paso 6: Operación diaria para la dueña (3 pasos simples)

1. **Actualizar stock o precios/sabores:** Edita directamente la columna `stock_gramos` en la pestaña **`Inventario`** (desde el PC o la app de Google Sheets en el celular). El cambio se refleja en la web en máximo 60 segundos. Para ocultar un sabor sin borrarlo, cambia `activo` de `SI` a `NO`.
2. **Cuando el cliente paga el link de Mercado Pago:** Abre la pestaña **`Pedidos`**, busca su folio (`GM-0001`) y cambia `estado` a **`Pagado`**.
   - El script descontará automáticamente los gramos en `Inventario`, marcará `stock_descontado = SI` (nunca descuenta dos veces) y enviará el correo *"Pago confirmado, estamos preparando tu pedido"*.
3. **Al despachar por Blue Express:** Pega el número de seguimiento en la columna **`codigo_blue_express`** y cambia `estado` a **`Enviado`**.
   - El cliente recibirá automáticamente el correo con su código y enlace de seguimiento de Blue Express.

---

## Nota sobre correos corporativos con dominio propio (HostGator SMTP)

- Google Apps Script permite hasta **100 correos diarios gratis** con cuentas Gmail estándar (ideal para empezar).
- Cuando tengan dominio propio (ej. `pedidos@gomania.cl`) en HostGator Plan Negocios:
  1. Crea la casilla `pedidos@gomania.cl` en cPanel.
  2. En `public/api/pedido.php`, descomenta la función `sendHostgatorConfirmationEmail(...)` al final del archivo.
  3. En `scripts/Code.gs`, cambia `SEND_EMAILS: false` si deseas que todos los correos de recepción salgan exclusivamente desde HostGator.
