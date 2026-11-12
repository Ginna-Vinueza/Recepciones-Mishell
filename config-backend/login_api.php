<?php
/**
 * API Endpoint: Inicio de Sesión (Login)
 * Plataforma Web Recepciones Mishell - Quito
 * 
 * Implementa autenticación segura (RNF04):
 * - Consultas preparadas contra inyección SQL
 * - Verificación de contraseñas mediante password_verify() (Bcrypt)
 * - Control de sesiones seguras con cookies HttpOnly y SameSite
 * - Soporte para inicio de sesión con correo o usuario 'Admin'
 */

declare(strict_types=1);

require_once __DIR__ . '/conexion.php';

// Iniciar sesión segura si no está iniciada
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

// Solo admitir método POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse([
        'success' => false,
        'error'   => 'Método no permitido. Utilice POST.'
    ], 405);
}

// Obtener datos (JSON o form-data)
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

if (!is_array($data)) {
    $data = $_POST;
}

$identificador = trim($data['correo'] ?? $data['usuario'] ?? '');
$password      = (string)($data['password'] ?? '');

// Validaciones preliminares
if ($identificador === '' || $password === '') {
    jsonResponse([
        'success' => false,
        'error'   => 'Por favor ingrese su usuario o correo institucional y su contraseña de acceso.'
    ], 400);
}

try {
    $pdo = getDBConnection();

    // Permitir autenticación tanto por correo electrónico como por nombre de usuario (ej. 'Admin')
    $stmt = $pdo->prepare("
        SELECT id_usuario, nombre_completo, correo, password, rol, estado
        FROM usuarios
        WHERE LOWER(correo) = LOWER(:identificador1) 
           OR LOWER(nombre_completo) = LOWER(:identificador2)
        LIMIT 1
    ");
    $stmt->execute([
        ':identificador1' => $identificador,
        ':identificador2' => $identificador
    ]);
    $usuario = $stmt->fetch();

    if (!$usuario) {
        // Mensaje genérico para no revelar si existe o no el usuario (RNF04)
        jsonResponse([
            'success' => false,
            'error'   => 'Las credenciales ingresadas son incorrectas. Verifique sus datos.'
        ], 401);
    }

    // Verificar estado activo
    if ((int)$usuario['estado'] !== 1) {
        jsonResponse([
            'success' => false,
            'error'   => 'Esta cuenta de usuario se encuentra inactiva. Comuníquese con la administración.'
        ], 403);
    }

    // Verificar hash de contraseña
    if (!password_verify($password, $usuario['password'])) {
        jsonResponse([
            'success' => false,
            'error'   => 'Las credenciales ingresadas son incorrectas. Verifique sus datos.'
        ], 401);
    }

    // Regenerar ID de sesión para prevenir fijación de sesión (Session Fixation Attack)
    session_regenerate_id(true);

    // Guardar datos en sesión
    $_SESSION['user_id']         = (int)$usuario['id_usuario'];
    $_SESSION['nombre_completo'] = $usuario['nombre_completo'];
    $_SESSION['correo']          = $usuario['correo'];
    $_SESSION['rol']             = $usuario['rol'];
    $_SESSION['logged_at']       = time();

    jsonResponse([
        'success'  => true,
        'mensaje'  => 'Acceso autorizado. Bienvenido a Recepciones Mishell.',
        'redirect' => 'index.html',
        'usuario'  => [
            'id_usuario'      => (int)$usuario['id_usuario'],
            'nombre_completo' => $usuario['nombre_completo'],
            'correo'          => $usuario['correo'],
            'rol'             => $usuario['rol']
        ]
    ]);

} catch (Throwable $e) {
    error_log("[Login Error] " . $e->getMessage());
    jsonResponse([
        'success' => false,
        'error'   => 'Ocurrió un error inesperado al procesar la solicitud. Intente nuevamente.'
    ], 500);
}
