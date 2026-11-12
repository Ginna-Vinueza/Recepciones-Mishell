<?php
/**
 * API Endpoint: Verificación de Sesión Activa
 * Plataforma Web Recepciones Mishell - Quito
 * 
 * Permite a las vistas frontend comprobar si el usuario está autenticado,
 * consultar su rol (Administrador / Recepción) y evitar accesos no autorizados.
 */

declare(strict_types=1);

require_once __DIR__ . '/conexion.php';

if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'domain'   => '',
        'secure'   => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on',
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
    session_start();
}

$autenticado = isset($_SESSION['user_id']) && !empty($_SESSION['user_id']);

if (!$autenticado) {
    jsonResponse([
        'authenticated' => false,
        'message'       => 'No hay una sesión activa.'
    ], 200);
}

jsonResponse([
    'authenticated' => true,
    'usuario' => [
        'id_usuario'      => (int)$_SESSION['user_id'],
        'nombre_completo' => $_SESSION['nombre_completo'] ?? 'Usuario',
        'correo'          => $_SESSION['correo'] ?? '',
        'rol'             => $_SESSION['rol'] ?? 'Recepcion'
    ]
], 200);
