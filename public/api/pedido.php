<?php
/**
 * ============================================================================
 * QUÉ HACE:
 * Proxy PHP 8 para HostGator Plan Negocios que recibe un pedido nuevo en JSON,
 * aplica filtro anti-spam (honeypot), valida los datos obligatorios del cliente
 * y del carrito, y reenvía el pedido de forma segura a Google Apps Script para
 * registrarlo en la pestaña privada `Pedidos` y obtener un folio `GM-XXXX`.
 *
 * Incluye además un bloque comentado listo para activar envío de correos vía
 * SMTP corporativo de HostGator (ej. pedidos@gomania.cl) cuando tengan dominio.
 *
 * QUÉ PUEDES EDITAR AQUÍ:
 * - `APPS_SCRIPT_URL`: pega la misma URL `/exec` de `scripts/Code.gs`.
 * - `API_SHARED_TOKEN`: debe coincidir con `API_TOKEN` en `scripts/Code.gs`.
 * - Bloque `sendHostgatorSmtpEmail()` (al final): descomenta y configura tus
 *   credenciales SMTP de cPanel cuando actives el dominio propio.
 *
 * CON QUÉ MÓDULO CONECTA:
 * - Consumido por `src/features/gestion-datos/data/sheets-proxy.repository.ts`.
 * - Se conecta al método `doPost()` de `scripts/Code.gs` en Google Sheets.
 * ============================================================================
 */

declare(strict_types=1);

// ============================================================================
// CONFIGURACIÓN EDITABLE (REEMPLAZA ESTOS VALORES AL PUBLICAR EN HOSTGATOR)
// ============================================================================
const APPS_SCRIPT_URL  = 'REEMPLAZAR_CON_URL_WEB_APP_DE_APPS_SCRIPT';
const API_SHARED_TOKEN = 'GOMANIA_SECRET_2026'; // Debe coincidir con Code.gs
const UPSTREAM_TIMEOUT = 10;                    // Segundos máx. esperando a Google
const MAX_PAYLOAD_BYTES = 65536;                // Límite 64 KB anti-abuso

const CACHE_DIR = __DIR__ . '/cache';
const LOG_FILE  = CACHE_DIR . '/api-errors.log';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store, no-cache, must-revalidate');

// Solo aceptamos POST
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Método no permitido. Usa POST.'], JSON_UNESCAPED_UNICODE);
    exit;
}

function logOrderError(string $message): void
{
    if (!is_dir(CACHE_DIR)) {
        @mkdir(CACHE_DIR, 0755, true);
    }
    $line = '[' . date('Y-m-d H:i:s') . '] [pedido.php] ' . $message . PHP_EOL;
    @file_put_contents(LOG_FILE, $line, FILE_APPEND | LOCK_EX);
}

function cleanText(mixed $value, int $maxLength = 250): string
{
    if (!is_string($value)) {
        return '';
    }
    $clean = trim(strip_tags($value));
    $clean = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $clean) ?? $clean;
    return mb_substr($clean, 0, $maxLength, 'UTF-8');
}

function respondJson(int $statusCode, array $payload): never
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

// 1. Verificar configuración
if (APPS_SCRIPT_URL === '' || str_starts_with(APPS_SCRIPT_URL, 'REEMPLAZAR_')) {
    respondJson(503, [
        'ok'    => false,
        'folio' => '',
        'error' => 'Proxy pedido.php pendiente de configuración (falta APPS_SCRIPT_URL).',
    ]);
}

// 2. Leer y limitar tamaño del cuerpo JSON
$rawBody = file_get_contents('php://input');
if ($rawBody === false || strlen($rawBody) === 0 || strlen($rawBody) > MAX_PAYLOAD_BYTES) {
    respondJson(400, ['ok' => false, 'folio' => '', 'error' => 'Solicitud vacía o demasiado grande.']);
}

$input = json_decode($rawBody, true);
if (!is_array($input)) {
    respondJson(400, ['ok' => false, 'folio' => '', 'error' => 'El cuerpo de la solicitud no es JSON válido.']);
}

// 3. Filtro Honeypot anti-spam: si un bot llena este campo oculto, simulamos éxito
// sin ensuciar la hoja de Google Sheets ni enviar correos.
$clienteRaw = is_array($input['cliente'] ?? null) ? $input['cliente'] : [];
$honeypot = cleanText($clienteRaw['honeypot'] ?? ($input['honeypot'] ?? ''), 100);
if ($honeypot !== '') {
    respondJson(200, ['ok' => true, 'folio' => 'GM-0000']);
}

// 4. Validación estricta de datos del cliente y carrito
$nombre    = cleanText($clienteRaw['nombre'] ?? '', 120);
$correo    = cleanText($clienteRaw['correo'] ?? '', 160);
$telefono  = cleanText($clienteRaw['telefono'] ?? '', 40);
$entrega   = cleanText($clienteRaw['entrega'] ?? 'blue-express', 30);
$direccion = cleanText($clienteRaw['direccion'] ?? '', 250);
$comuna    = cleanText($clienteRaw['comuna'] ?? '', 80);
$region    = cleanText($clienteRaw['region'] ?? '', 80);
$notas     = cleanText($clienteRaw['notas'] ?? '', 300);

if (mb_strlen($nombre, 'UTF-8') < 2) {
    respondJson(422, ['ok' => false, 'folio' => '', 'error' => 'Ingresa tu nombre completo.']);
}
if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) {
    respondJson(422, ['ok' => false, 'folio' => '', 'error' => 'Ingresa un correo electrónico válido.']);
}
if (!in_array($entrega, ['blue-express', 'retiro'], true)) {
    respondJson(422, ['ok' => false, 'folio' => '', 'error' => 'Modalidad de entrega no válida.']);
}
if ($entrega === 'blue-express' && mb_strlen($direccion, 'UTF-8') < 5) {
    respondJson(422, ['ok' => false, 'folio' => '', 'error' => 'Ingresa tu dirección completa para despacho Blue Express.']);
}

$totalClp = (int) ($input['totalClp'] ?? 0);
$items    = is_array($input['items'] ?? null) ? $input['items'] : [];
$consumo  = is_array($input['consumoGramos'] ?? null) ? $input['consumoGramos'] : [];
$detalleTexto = cleanText($input['detalleTexto'] ?? '', 1500);

if ($totalClp <= 0 || count($items) === 0) {
    respondJson(422, ['ok' => false, 'folio' => '', 'error' => 'El pedido debe incluir al menos una bolsa válida.']);
}

// 5. Preparar payload limpio para enviar a Google Apps Script
$forwardPayload = [
    'token'        => API_SHARED_TOKEN,
    'action'       => 'crear_pedido',
    'cliente'      => [
        'nombre'    => $nombre,
        'correo'    => strtolower($correo),
        'telefono'  => $telefono,
        'entrega'   => $entrega,
        'direccion' => $direccion,
        'comuna'    => $comuna,
        'region'    => $region,
        'notas'     => $notas,
    ],
    'totalClp'      => $totalClp,
    'totalItems'    => (int) ($input['totalItems'] ?? count($items)),
    'detalleTexto'  => $detalleTexto,
    'items'         => $items,
    'consumoGramos' => $consumo,
];

// 6. Enviar POST a Google Apps Script (manejando redirección 302 de Google)
$jsonBody = json_encode($forwardPayload, JSON_UNESCAPED_UNICODE);
if ($jsonBody === false) {
    respondJson(500, ['ok' => false, 'folio' => '', 'error' => 'Error al codificar el pedido.']);
}

$ch = curl_init(APPS_SCRIPT_URL);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $jsonBody,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS      => 5,
    CURLOPT_TIMEOUT        => UPSTREAM_TIMEOUT,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json; charset=utf-8',
        'Accept: application/json',
    ],
]);

$responseBody = curl_exec($ch);
$httpCode     = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError    = curl_error($ch);
curl_close($ch);

if ($responseBody === false || $httpCode < 200 || $httpCode >= 300) {
    logOrderError("Error reenviando a Apps Script (HTTP {$httpCode}): {$curlError}");
    respondJson(502, [
        'ok'    => false,
        'folio' => '',
        'error' => 'No pudimos guardar tu pedido en línea. Puedes enviarlo directo por WhatsApp.',
    ]);
}

$decoded = json_decode((string) $responseBody, true);
if (!is_array($decoded) || ($decoded['ok'] ?? false) !== true) {
    logOrderError('Apps Script rechazó el pedido: ' . substr((string) $responseBody, 0, 250));
    respondJson(502, [
        'ok'    => false,
        'folio' => '',
        'error' => is_string($decoded['error'] ?? null)
            ? $decoded['error']
            : 'Error al registrar el pedido en el sistema.',
    ]);
}

$folio = (string) ($decoded['folio'] ?? '');

// ============================================================================
// BLOQUE OPCIONAL: CORREO CORPORATIVO VÍA SMTP DE HOSTGATOR (DOMINIO PROPIO)
// ============================================================================
// Cuando tengan dominio propio (ej. pedidos@gomania.cl) en HostGator Plan
// Negocios y quieran enviar correos sin límite diario de Gmail, pueden:
// 1. Poner `SEND_EMAILS_FROM_APPS_SCRIPT = false` en `scripts/Code.gs`.
// 2. Descomentar la llamada de abajo y completar las constantes SMTP.
//
// sendHostgatorConfirmationEmail($correo, $nombre, $folio, $detalleTexto, $totalClp);

respondJson(200, [
    'ok'    => true,
    'folio' => $folio,
]);

/*
// ----------------------------------------------------------------------------
// PLANTILLA LISTA PARA ACTIVAR SMTP / MAIL DE HOSTGATOR CON DOMINIO PROPIO
// ----------------------------------------------------------------------------
// En HostGator cPanel -> Cuentas de correo electrónico -> crea pedidos@gomania.cl
// Si usas PHPMailer (sin Composer, subiendo src/PHPMailer.php + SMTP.php a /api/lib/):
//   Host SMTP: mail.gomania.cl
//   Puerto: 465 (SMTPS / SSL)
//   Usuario: pedidos@gomania.cl
//   Contraseña: la clave de tu cuenta en cPanel
//
// Alternativa nativa sin librerías (funciona directo en servidores cPanel HostGator):
function sendHostgatorConfirmationEmail(
    string $toEmail,
    string $customerName,
    string $folio,
    string $detalleTexto,
    int $totalClp
): void {
    $fromEmail = 'pedidos@gomania.cl'; // Debe existir en tu cPanel HostGator
    $subject   = "=?UTF-8?B?" . base64_encode("Recibimos tu pedido #{$folio} - GoManía SpA") . "?=";
    $totalFmt  = '$' . number_format($totalClp, 0, ',', '.');

    $htmlBody = "
        <div style='font-family: Arial, sans-serif; color: #111827; max-width: 560px;'>
            <h2 style='color: #F44870;'>¡Hola {$customerName}! Recibimos tu pedido #{$folio}</h2>
            <p>Tu pedido está registrado con estado <strong>Pendiente de pago</strong>.</p>
            <p><strong>Detalle:</strong> {$detalleTexto}</p>
            <p><strong>Total productos:</strong> {$totalFmt} (envío Blue Express por pagar)</p>
            <p>Te enviaremos tu link de pago de Mercado Pago por WhatsApp. Una vez confirmado el pago comenzaremos a preparar tu bolsita.</p>
            <hr style='border: none; border-top: 1px solid #E5E7EB;' />
            <small style='color: #4B5563;'>GoManía SpA · Más de 100 sabores</small>
        </div>
    ";

    $headers = [
        'MIME-Version: 1.0',
        'Content-type: text/html; charset=UTF-8',
        "From: GoManía SpA <{$fromEmail}>",
        "Reply-To: {$fromEmail}",
    ];

    @mail($toEmail, $subject, $htmlBody, implode("\r\n", $headers), "-f{$fromEmail}");
}
*/
