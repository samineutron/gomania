/**
 * ============================================================================
 * QUÉ HACE:
 * Backend gratuito en Google Apps Script conectado a un Google Sheet con
 * 2 pestañas (`Inventario` y `Pedidos`) para GoManía SpA:
 * 1. `setupHojasGomania()`: crea automáticamente las 2 pestañas, encabezados,
 *    listas desplegables y filas de ejemplo.
 * 2. `doGet()`: expone SOLO el inventario activo en JSON para `catalogo.php`.
 *    Nunca expone la pestaña privada `Pedidos`.
 * 3. `doPost()`: recibe pedidos nuevos desde `pedido.php`, genera folio
 *    correlativo `GM-0001`, guarda en `Pedidos` y envía correo automático #1.
 * 4. `onEditTrigger(e)`: activador instalable al editar `Pedidos`:
 *    - Al cambiar `estado` a `Pagado` (y `stock_descontado` = `NO`):
 *      descuenta UNA SOLA VEZ los gramos exactos de cada sabor en `Inventario`,
 *      marca `stock_descontado` = `SI` y envía correo automático #2.
 *    - Al pegar `codigo_blue_express` y marcar `estado` = `Enviado`:
 *      envía correo automático #3 con el número de seguimiento Blue Express.
 *
 * QUÉ PUEDES EDITAR AQUÍ:
 * - `CONFIG.API_TOKEN`: debe coincidir con `API_SHARED_TOKEN` en
 *   `public/api/catalogo.php` y `public/api/pedido.php`.
 * - `CONFIG.SEND_EMAILS`: pon `false` si luego activas SMTP en HostGator.
 * - `CONFIG.STORE_NAME`, `CONFIG.WHATSAPP_DISPLAY`, `CONFIG.BLUE_EXPRESS_URL`.
 *
 * CON QUÉ MÓDULO CONECTA:
 * - Recibe llamadas de `public/api/catalogo.php` y `public/api/pedido.php`.
 * - Sigue las reglas de `docs/features/gestion-datos.md`.
 * ============================================================================
 */

const CONFIG = {
  SHEET_INVENTARIO: 'Inventario',
  SHEET_PEDIDOS: 'Pedidos',
  API_TOKEN: 'GOMANIA_SECRET_2026', // Debe coincidir con catalogo.php y pedido.php
  STORE_NAME: 'GoManía SpA',
  WHATSAPP_DISPLAY: '+56 9 0000 0000', // Reemplazar por el WhatsApp real
  BLUE_EXPRESS_URL: 'https://www.blue.cl/seguimiento/',
  SEND_EMAILS: true, // Cambiar a false si migras los correos a SMTP de HostGator
};

// Índices de columnas (base 1) en la pestaña Pedidos
const PEDIDO_COL = {
  FOLIO: 1,
  FECHA: 2,
  CLIENTE: 3,
  CORREO: 4,
  TELEFONO: 5,
  ENTREGA: 6,
  DIRECCION: 7,
  DETALLE_JSON: 8,
  DETALLE_TEXTO: 9,
  TOTAL_CLP: 10,
  ESTADO: 11,
  CODIGO_BLUE_EXPRESS: 12,
  STOCK_DESCONTADO: 13,
};

// Índices de columnas (base 1) en la pestaña Inventario
const INV_COL = {
  ID: 1,
  NOMBRE: 2,
  TIPO: 3,
  CATEGORIA: 4,
  STOCK_GRAMOS: 5,
  ACTIVO: 6,
  IMG_CALCOMANIA: 7,
  IMG_PRODUCTO: 8,
};

/**
 * ============================================================================
 * 1. INSTALACIÓN INICIAL (EJECUTAR UNA SOLA VEZ DESDE EL EDITOR DE APPS SCRIPT)
 * ============================================================================
 * Crea las pestañas `Inventario` y `Pedidos` con sus encabezados exactos,
 * colores, filas congeladas y listas desplegables para la dueña.
 */
function setupHojasGomania() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // --- Pestaña Inventario ---
  let invSheet = ss.getSheetByName(CONFIG.SHEET_INVENTARIO);
  if (!invSheet) {
    invSheet = ss.insertSheet(CONFIG.SHEET_INVENTARIO);
  }
  if (invSheet.getLastRow() === 0) {
    const invHeaders = [
      'id',
      'nombre',
      'tipo',
      'categoria',
      'stock_gramos',
      'activo',
      'img_calcomania',
      'img_producto',
    ];
    invSheet.appendRow(invHeaders);
    invSheet.getRange(1, 1, 1, invHeaders.length)
      .setBackground('#F44870')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');
    invSheet.setFrozenRows(1);

    // 4 filas de ejemplo iniciales (puedes editarlas o borrarlas después)
    invSheet.getRange(2, 1, 4, 8).setValues([
      ['gom-ositos-clasicos', 'Ositos Clásicos', 'gomita', 'dulce', 2500, 'SI', '/images/productos/calcomanias/ositos.png', '/images/productos/fotos/ositos.png'],
      ['gom-tiburones-acidos', 'Tiburones Ácidos', 'gomita', 'acido', 1800, 'SI', '/images/productos/calcomanias/tiburones.png', '/images/productos/fotos/tiburones.png'],
      ['man-confitado-platano', 'Maní Confitado Plátano', 'mani', 'dulce', 2000, 'SI', '/images/productos/calcomanias/mani-platano.png', '/images/productos/fotos/mani-platano.png'],
      ['man-salado-merken', 'Maní Salado Merkén', 'mani', 'salado', 1500, 'SI', '/images/productos/calcomanias/mani-merken.png', '/images/productos/fotos/mani-merken.png'],
    ]);

    // Listas desplegables en Inventario (filas 2 a 500)
    const tipoRule = SpreadsheetApp.newDataValidation().requireValueInList(['gomita', 'mani'], true).build();
    const catRule = SpreadsheetApp.newDataValidation().requireValueInList(['dulce', 'acido', 'salado'], true).build();
    const siNoRule = SpreadsheetApp.newDataValidation().requireValueInList(['SI', 'NO'], true).build();

    invSheet.getRange(2, INV_COL.TIPO, 499, 1).setDataValidation(tipoRule);
    invSheet.getRange(2, INV_COL.CATEGORIA, 499, 1).setDataValidation(catRule);
    invSheet.getRange(2, INV_COL.ACTIVO, 499, 1).setDataValidation(siNoRule);
  }

  // --- Pestaña Pedidos ---
  let pedSheet = ss.getSheetByName(CONFIG.SHEET_PEDIDOS);
  if (!pedSheet) {
    pedSheet = ss.insertSheet(CONFIG.SHEET_PEDIDOS);
  }
  if (pedSheet.getLastRow() === 0) {
    const pedHeaders = [
      'folio',
      'fecha',
      'cliente',
      'correo',
      'telefono',
      'entrega',
      'direccion',
      'detalle_json',
      'detalle_texto',
      'total_clp',
      'estado',
      'codigo_blue_express',
      'stock_descontado',
    ];
    pedSheet.appendRow(pedHeaders);
    pedSheet.getRange(1, 1, 1, pedHeaders.length)
      .setBackground('#111827')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');
    pedSheet.setFrozenRows(1);

    const estadoRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Pendiente de pago', 'Pagado', 'Preparando', 'Enviado'], true)
      .build();
    const siNoRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['SI', 'NO'], true)
      .build();

    pedSheet.getRange(2, PEDIDO_COL.ESTADO, 999, 1).setDataValidation(estadoRule);
    pedSheet.getRange(2, PEDIDO_COL.STOCK_DESCONTADO, 999, 1).setDataValidation(siNoRule);
  }

  SpreadsheetApp.flush();
}

/**
 * ============================================================================
 * 2. LECTURA DE CATÁLOGO (GET) -> CONSUMIDO POR `public/api/catalogo.php`
 * ============================================================================
 * Devuelve ÚNICAMENTE las filas activas de la pestaña `Inventario`.
 */
function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    if (CONFIG.API_TOKEN && params.token !== CONFIG.API_TOKEN) {
      return jsonResponse({ ok: false, error: 'Token inválido.' });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_INVENTARIO);
    if (!sheet) {
      return jsonResponse({ ok: false, error: 'No existe la pestaña Inventario.' });
    }

    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) {
      return jsonResponse({ ok: true, updatedAt: new Date().toISOString(), products: [] });
    }

    const products = [];
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const id = String(row[INV_COL.ID - 1] || '').trim();
      const nombre = String(row[INV_COL.NOMBRE - 1] || '').trim();
      const activoRaw = String(row[INV_COL.ACTIVO - 1] || '').trim().toUpperCase();
      const esActivo = activoRaw === 'SI' || activoRaw === 'SÍ' || activoRaw === 'TRUE' || row[INV_COL.ACTIVO - 1] === true;

      if (!id || !nombre || !esActivo) continue;

      products.push({
        id: id,
        nombre: nombre,
        tipo: String(row[INV_COL.TIPO - 1] || '').trim().toLowerCase(),
        categoria: String(row[INV_COL.CATEGORIA - 1] || '').trim().toLowerCase(),
        stock_gramos: Math.max(0, Math.floor(Number(row[INV_COL.STOCK_GRAMOS - 1]) || 0)),
        activo: true,
        img_calcomania: String(row[INV_COL.IMG_CALCOMANIA - 1] || '').trim(),
        img_producto: String(row[INV_COL.IMG_PRODUCTO - 1] || '').trim(),
      });
    }

    return jsonResponse({
      ok: true,
      updatedAt: new Date().toISOString(),
      products: products,
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

/**
 * ============================================================================
 * 3. CREACIÓN DE PEDIDOS (POST) -> CONSUMIDO POR `public/api/pedido.php`
 * ============================================================================
 * Genera folio correlativo `GM-XXXX`, inserta la fila en `Pedidos` y envía
 * correo automático de confirmación de recepción (Pendiente de pago).
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    const data = JSON.parse(raw);

    if (CONFIG.API_TOKEN && data.token !== CONFIG.API_TOKEN) {
      return jsonResponse({ ok: false, error: 'Token inválido.' });
    }

    const cliente = data.cliente || {};
    const nombre = String(cliente.nombre || '').trim();
    const correo = String(cliente.correo || '').trim();
    if (!nombre || !correo) {
      return jsonResponse({ ok: false, error: 'Faltan datos obligatorios del cliente.' });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const pedSheet = ss.getSheetByName(CONFIG.SHEET_PEDIDOS);
    if (!pedSheet) {
      return jsonResponse({ ok: false, error: 'No existe la pestaña Pedidos.' });
    }

    const folio = generateNextFolio(pedSheet);
    const fechaStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    const detalleJson = JSON.stringify({
      items: data.items || [],
      consumoGramos: data.consumoGramos || {},
      notas: cliente.notas || '',
    });

    const totalClp = Math.max(0, Math.floor(Number(data.totalClp) || 0));
    const detalleTexto = String(data.detalleTexto || '');

    pedSheet.appendRow([
      folio,
      fechaStr,
      nombre,
      correo,
      String(cliente.telefono || ''),
      String(cliente.entrega || 'blue-express'),
      String(cliente.direccion || ''),
      detalleJson,
      detalleTexto,
      totalClp,
      'Pendiente de pago',
      '',
      'NO',
    ]);

    // Correo automático #1: Pedido recibido (pendiente de pago)
    sendOrderReceivedEmail(correo, nombre, folio, detalleTexto, totalClp);

    return jsonResponse({ ok: true, folio: folio });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/**
 * ============================================================================
 * 4. AUTOMATIZACIÓN AL EDITAR `Pedidos` (ACTIVADOR INSTALABLE `onEditTrigger`)
 * ============================================================================
 * IMPORTANTE: Debe configurarse como activador instalable "Al editarse" desde
 * el menú Reloj (Activadores) de Apps Script para tener permisos de MailApp.
 */
function onEditTrigger(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  if (sheet.getName() !== CONFIG.SHEET_PEDIDOS) return;

  const rowIndex = e.range.getRow();
  const colIndex = e.range.getColumn();
  if (rowIndex <= 1) return; // Ignorar encabezados

  // Solo reaccionamos cuando se edita la columna `estado` o `codigo_blue_express`
  if (colIndex !== PEDIDO_COL.ESTADO && colIndex !== PEDIDO_COL.CODIGO_BLUE_EXPRESS) {
    return;
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    const rowRange = sheet.getRange(rowIndex, 1, 1, PEDIDO_COL.STOCK_DESCONTADO);
    const row = rowRange.getValues()[0];

    const folio = String(row[PEDIDO_COL.FOLIO - 1] || '').trim();
    const cliente = String(row[PEDIDO_COL.CLIENTE - 1] || '').trim();
    const correo = String(row[PEDIDO_COL.CORREO - 1] || '').trim();
    const detalleJsonStr = String(row[PEDIDO_COL.DETALLE_JSON - 1] || '').trim();
    const detalleTexto = String(row[PEDIDO_COL.DETALLE_TEXTO - 1] || '').trim();
    const estado = String(row[PEDIDO_COL.ESTADO - 1] || '').trim();
    const codigoBlue = String(row[PEDIDO_COL.CODIGO_BLUE_EXPRESS - 1] || '').trim();
    const stockDescontado = String(row[PEDIDO_COL.STOCK_DESCONTADO - 1] || 'NO').trim().toUpperCase();

    if (!folio) return;

    // CASO A: Pasó a "Pagado" y todavía NO se ha descontado el stock
    if (estado === 'Pagado' && stockDescontado !== 'SI') {
      discountInventoryFromOrder(detalleJsonStr);
      // Marcamos bandera inmediatamente para garantizar descuento ÚNICO
      sheet.getRange(rowIndex, PEDIDO_COL.STOCK_DESCONTADO).setValue('SI');
      SpreadsheetApp.flush();

      // Correo automático #2: Pago confirmado
      sendPaymentConfirmedEmail(correo, cliente, folio, detalleTexto);
    }

    // CASO B: Estado "Enviado" con código Blue Express cargado
    if (estado === 'Enviado' && codigoBlue !== '') {
      const blueCell = sheet.getRange(rowIndex, PEDIDO_COL.CODIGO_BLUE_EXPRESS);
      const alreadySentNote = blueCell.getNote();
      if (!alreadySentNote || !alreadySentNote.includes('CORREO_ENVIADO:' + codigoBlue)) {
        sendShippedBlueExpressEmail(correo, cliente, folio, codigoBlue);
        blueCell.setNote('CORREO_ENVIADO:' + codigoBlue + ' (' + new Date().toISOString() + ')');
      }
    }
  } finally {
    lock.releaseLock();
  }
}

/**
 * Descuenta los gramos exactos de cada `productId` en la pestaña `Inventario`.
 */
function discountInventoryFromOrder(detalleJsonStr) {
  if (!detalleJsonStr) return;

  let parsed;
  try {
    parsed = JSON.parse(detalleJsonStr);
  } catch (e) {
    return;
  }

  // Preferimos el mapa precalculado `consumoGramos`; si no existe, lo calculamos desde `items`
  const gramsByProduct = {};
  if (parsed.consumoGramos && typeof parsed.consumoGramos === 'object') {
    Object.keys(parsed.consumoGramos).forEach(function (pid) {
      gramsByProduct[pid] = Math.max(0, Math.floor(Number(parsed.consumoGramos[pid]) || 0));
    });
  } else if (Array.isArray(parsed.items)) {
    parsed.items.forEach(function (bag) {
      const qty = Math.max(1, Math.floor(Number(bag.quantity) || 1));
      if (Array.isArray(bag.flavors)) {
        bag.flavors.forEach(function (f) {
          const pid = String(f.productId || '').trim();
          const g = Math.max(0, Math.floor(Number(f.grams) || 0)) * qty;
          if (pid && g > 0) {
            gramsByProduct[pid] = (gramsByProduct[pid] || 0) + g;
          }
        });
      }
    });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const invSheet = ss.getSheetByName(CONFIG.SHEET_INVENTARIO);
  if (!invSheet) return;

  const invData = invSheet.getDataRange().getValues();
  for (let i = 1; i < invData.length; i++) {
    const pid = String(invData[i][INV_COL.ID - 1] || '').trim();
    if (pid && gramsByProduct[pid] && gramsByProduct[pid] > 0) {
      const currentStock = Math.max(0, Math.floor(Number(invData[i][INV_COL.STOCK_GRAMOS - 1]) || 0));
      const newStock = Math.max(0, currentStock - gramsByProduct[pid]);
      invSheet.getRange(i + 1, INV_COL.STOCK_GRAMOS).setValue(newStock);
    }
  }
}

/**
 * Genera el siguiente folio correlativo `GM-0001`, `GM-0002`, etc.
 */
function generateNextFolio(pedSheet) {
  const lastRow = pedSheet.getLastRow();
  let maxNumber = 0;

  if (lastRow > 1) {
    const folios = pedSheet.getRange(2, PEDIDO_COL.FOLIO, lastRow - 1, 1).getValues();
    for (let i = 0; i < folios.length; i++) {
      const match = String(folios[i][0] || '').match(/^GM-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) maxNumber = num;
      }
    }
  }

  const nextNum = String(maxNumber + 1).padStart(4, '0');
  return 'GM-' + nextNum;
}

// ============================================================================
// 5. PLANTILLAS DE CORREOS AUTOMÁTICOS (COSTO $0 VÍA MAILAPP)
// ============================================================================

function formatClpSimple(amount) {
  return '$' + Math.floor(Number(amount) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function sendSafeHtmlEmail(to, subject, htmlBody) {
  if (!CONFIG.SEND_EMAILS || !to || to.indexOf('@') === -1) return;
  try {
    MailApp.sendEmail({
      to: to,
      subject: subject,
      htmlBody: htmlBody,
      name: CONFIG.STORE_NAME,
    });
  } catch (err) {
    Logger.log('No se pudo enviar correo a ' + to + ': ' + err);
  }
}

function sendOrderReceivedEmail(to, cliente, folio, detalleTexto, totalClp) {
  const subject = 'Recibimos tu pedido #' + folio + ' (pendiente de pago) - ' + CONFIG.STORE_NAME;
  const html =
    '<div style="font-family:Arial,sans-serif;color:#111827;max-width:560px;">' +
    '<h2 style="color:#F44870;">¡Hola ' + cliente + '! Recibimos tu pedido #' + folio + '</h2>' +
    '<p>Tu pedido quedó registrado con estado <strong>Pendiente de pago</strong>.</p>' +
    '<p><strong>Resumen:</strong><br/>' + detalleTexto + '</p>' +
    '<p><strong>Total productos:</strong> ' + formatClpSimple(totalClp) + ' <em>(envío Blue Express por pagar)</em></p>' +
    '<p>Te enviaremos tu link de pago de Mercado Pago por WhatsApp (' + CONFIG.WHATSAPP_DISPLAY + '). ' +
    'Una vez confirmado el pago comenzaremos a preparar tu pedido.</p>' +
    '<hr style="border:none;border-top:1px solid #E5E7EB;"/>' +
    '<small style="color:#4B5563;">' + CONFIG.STORE_NAME + ' · Más de 100 sabores</small>' +
    '</div>';
  sendSafeHtmlEmail(to, subject, html);
}

function sendPaymentConfirmedEmail(to, cliente, folio, detalleTexto) {
  const subject = '¡Pago confirmado! Estamos preparando tu pedido #' + folio + ' - ' + CONFIG.STORE_NAME;
  const html =
    '<div style="font-family:Arial,sans-serif;color:#111827;max-width:560px;">' +
    '<h2 style="color:#15803D;">¡Pago confirmado para tu pedido #' + folio + '!</h2>' +
    '<p>Hola ' + cliente + ', ya confirmamos tu pago y comenzamos a armar tus bolsitas con mucho cariño.</p>' +
    '<p><strong>Detalle:</strong><br/>' + detalleTexto + '</p>' +
    '<p>Apenas despachemos tu paquete por Blue Express te enviaremos un nuevo correo con tu número de seguimiento.</p>' +
    '<hr style="border:none;border-top:1px solid #E5E7EB;"/>' +
    '<small style="color:#4B5563;">' + CONFIG.STORE_NAME + ' · Más de 100 sabores</small>' +
    '</div>';
  sendSafeHtmlEmail(to, subject, html);
}

function sendShippedBlueExpressEmail(to, cliente, folio, codigoBlue) {
  const subject = '¡Tu pedido #' + folio + ' va en camino por Blue Express! - ' + CONFIG.STORE_NAME;
  const html =
    '<div style="font-family:Arial,sans-serif;color:#111827;max-width:560px;">' +
    '<h2 style="color:#28AAE1;">¡Tu pedido #' + folio + ' ya fue despachado!</h2>' +
    '<p>Hola ' + cliente + ', tu paquete ya está en camino vía <strong>Blue Express</strong> (envío por pagar).</p>' +
    '<p style="font-size:18px;background:#F4F8FB;padding:12px;border-radius:8px;">' +
    '<strong>Código de seguimiento:</strong> ' + codigoBlue +
    '</p>' +
    '<p>Puedes seguir tu envío aquí: <a href="' + CONFIG.BLUE_EXPRESS_URL + '">' + CONFIG.BLUE_EXPRESS_URL + '</a></p>' +
    '<hr style="border:none;border-top:1px solid #E5E7EB;"/>' +
    '<small style="color:#4B5563;">' + CONFIG.STORE_NAME + ' · Más de 100 sabores</small>' +
    '</div>';
  sendSafeHtmlEmail(to, subject, html);
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
