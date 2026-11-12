<?php
/**
 * API Endpoint: Cierre de Sesión (Logout)
 * Plataforma Web Recepciones Mishell - Quito
 * 
 * Destruye la sesión de forma segura y elimina las cookies asociadas.
 */

declare(strict_types=1);

require_once __DIR__ . '/conexion.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Vaciar variables de sesión
$_SESSION = [];

// Destruir cookie de sesión
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(
        session_name(),
        '',
        time() - 42000,
        $params["path"],
        $params["domain"],
        $params["secure"],
        $params["httponly"]
    );
}

// Destruir la sesión en el servidor
session_destroy();

jsonResponse([
    'success'  => true,
    'mensaje'  => 'Sesión finalizada exitosamente.',
    'redirect' => 'login.html'
]);
