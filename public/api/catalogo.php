<?php
/**
 * ============================================================================
 * QUÉ HACE:
 * Proxy PHP 8 para HostGator Plan Negocios que consulta el catálogo activo
 * desde Google Apps Script (`Inventario`), guarda un caché JSON local por
 * 60 segundos para responder en milisegundos y oculta la URL interna de
 * Google Sheets al navegador del cliente.
 *
 * Si Google Apps Script falla o tarda demasiado, entrega automáticamente el
 * último caché válido disponible y registra el error en `cache/api-errors.log`.
 *
 * QUÉ PUEDES EDITAR AQUÍ:
 * - `APPS_SCRIPT_URL`: pega la URL `/exec` que te entrega Google Apps Script
 *   al publicar `scripts/Code.gs` como Aplicación Web.
 * - `API_SHARED_TOKEN`: clave compartida opcional (debe coincidir exactamente
 *   con `API_TOKEN` en `scripts/Code.gs`).
 * - `CACHE_TTL_SECONDS`: segundos de duración del caché (por defecto `60`).
 *
 * CON QUÉ MÓDULO CONECTA:
 * - Consumido por `src/features/gestion-datos/data/sheets-proxy.repository.ts`.
 * - Se conecta al método `doGet()` de `scripts/Code.gs` en Google Sheets.
 * ============================================================================
 */

declare(strict_types=1);

// ============================================================================
// CONFIGURACIÓN EDITABLE (REEMPLAZA ESTOS VALORES AL PUBLICAR EN HOSTGATOR)
// ============================================================================
const APPS_SCRIPT_URL   = 'REEMPLAZAR_CON_URL_WEB_APP_DE_APPS_SCRIPT';
const API_SHARED_TOKEN  = 'GOMANIA_SECRET_2026'; // Debe coincidir con Code.gs
const CACHE_TTL_SECONDS = 60;                    // Caché local de 60 segundos
const UPSTREAM_TIMEOUT  = 8;                     // Segundos máx. esperando a Google

const CACHE_DIR  = __DIR__ . '/cache';
const CACHE_FILE = CACHE_DIR . '/catalogo-cache.json';
const LOG_FILE   = CACHE_DIR . '/api-errors.log';

// Cabeceras estándar JSON + seguridad básica
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: public, max-age=30');

// Solo permitimos método GET
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Método no permitido. Usa GET.'], JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Asegura que exista la carpeta `cache/` y crea un `.htaccess` que impide
 * que alguien descargue los archivos de caché o logs desde el navegador.
 */
function ensureProtectedCacheDir(): void
{
    if (!is_dir(CACHE_DIR)) {
        @mkdir(CACHE_DIR, 0755, true);
    }
    $htaccess = CACHE_DIR . '/.htaccess';
    if (is_dir(CACHE_DIR) && !file_exists($htaccess)) {
        @file_put_contents($htaccess, "Order Allow,Deny\nDeny from all\n");
    }
}

/**
 * Registra errores internos en un log privado sin exponer detalles al cliente.
 */
function logApiError(string $message): void
{
    ensureProtectedCacheDir();
    $line = '[' . date('Y-m-d H:i:s') . '] [catalogo.php] ' . $message . PHP_EOL;
    @file_put_contents(LOG_FILE, $line, FILE_APPEND | LOCK_EX);
}

/**
 * Realiza petición GET a Google Apps Script siguiendo redirecciones 302
 * (Google siempre redirige las llamadas de Web App).
 */
function fetchFromAppsScript(string $url): array
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS      => 5,
            CURLOPT_TIMEOUT        => UPSTREAM_TIMEOUT,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_HTTPHEADER     => ['Accept: application/json'],
        ]);
        $body = curl_exec($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($body === false || $httpCode < 200 || $httpCode >= 300) {
            return ['ok' => false, 'error' => "cURL HTTP {$httpCode}: {$curlError}"];
        }
        return ['ok' => true, 'body' => (string) $body];
    }

    // Respaldo con file_get_contents si cURL estuviera deshabilitado
    $context = stream_context_create([
        'http' => [
            'method'  => 'GET',
            'timeout' => UPSTREAM_TIMEOUT,
            'header'  => "Accept: application/json\r\n",
        ],
    ]);
    $body = @file_get_contents($url, false, $context);
    if ($body === false) {
        return ['ok' => false, 'error' => 'file_get_contents falló al consultar Apps Script'];
    }
    return ['ok' => true, 'body' => $body];
}

// 1. Verificar si la URL aún no ha sido configurada
if (APPS_SCRIPT_URL === '' || str_starts_with(APPS_SCRIPT_URL, 'REEMPLAZAR_')) {
    http_response_code(503);
    echo json_encode([
        'ok'       => false,
        'error'    => 'Proxy catalogo.php pendiente de configuración (falta APPS_SCRIPT_URL).',
        'products' => [],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

ensureProtectedCacheDir();

// 2. Servir caché fresco si tiene menos de 60 segundos (carga < 200ms)
$hasCache = is_file(CACHE_FILE) && is_readable(CACHE_FILE);
if ($hasCache && (time() - (int) filemtime(CACHE_FILE)) < CACHE_TTL_SECONDS) {
    $cachedContent = @file_get_contents(CACHE_FILE);
    if ($cachedContent !== false && $cachedContent !== '') {
        header('X-Cache: HIT');
        echo $cachedContent;
        exit;
    }
}

// 3. Consultar Google Apps Script para refrescar el catálogo
$separator = str_contains(APPS_SCRIPT_URL, '?') ? '&' : '?';
$targetUrl = APPS_SCRIPT_URL
    . $separator
    . http_build_query([
        'action' => 'catalogo',
        'token'  => API_SHARED_TOKEN,
    ]);

$result = fetchFromAppsScript($targetUrl);

if ($result['ok']) {
    $decoded = json_decode($result['body'], true);
    if (is_array($decoded) && isset($decoded['products']) && is_array($decoded['products'])) {
        // Guardamos solo los campos públicos necesarios y escribimos de forma atómica
        $cleanJson = json_encode([
            'ok'        => true,
            'updatedAt' => $decoded['updatedAt'] ?? date('c'),
            'products'  => $decoded['products'],
        ], JSON_UNESCAPED_UNICODE);

        if ($cleanJson !== false) {
            @file_put_contents(CACHE_FILE . '.tmp', $cleanJson, LOCK_EX);
            @rename(CACHE_FILE . '.tmp', CACHE_FILE);
            header('X-Cache: MISS');
            echo $cleanJson;
            exit;
        }
    }
    logApiError('Respuesta JSON inesperada desde Apps Script: ' . substr($result['body'], 0, 200));
} else {
    logApiError($result['error']);
}

// 4. Respaldo ante error: devolver el último caché válido aunque esté vencido
if ($hasCache) {
    $staleContent = @file_get_contents(CACHE_FILE);
    if ($staleContent !== false && $staleContent !== '') {
        header('X-Cache: STALE-FALLBACK');
        echo $staleContent;
        exit;
    }
}

// 5. Si no existe caché previo y falló Google, devolver 502 (frontend usará mock)
http_response_code(502);
echo json_encode([
    'ok'       => false,
    'error'    => 'No se pudo obtener el inventario en este momento.',
    'products' => [],
], JSON_UNESCAPED_UNICODE);
