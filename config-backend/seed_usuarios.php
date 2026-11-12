<?php
/**
 * Script de inicialización de usuarios del sistema
 * Plataforma Web Recepciones Mishell - Quito
 * 
 * Usuarios oficiales del sistema:
 * 1. Super Administrador:
 *    - Nombre: Admin
 *    - Correo: admin@recepcionesmishell.ec (también admite login con usuario 'admin')
 *    - Contraseña: Admin2026*
 *    - Rol: Administrador
 * 
 * 2. Administrador de la Sala de Recepciones:
 *    - Nombre: Elvia Casagallo
 *    - Correo: elvia@recepcionesmishell.ec
 *    - Contraseña: Elvia2026*
 *    - Rol: Recepcion
 */

declare(strict_types=1);

require_once __DIR__ . '/conexion.php';

try {
    $pdo = getDBConnection();

    // Limpiamos la tabla usuarios para garantizar un estado limpio y exacto
    $pdo->exec("DELETE FROM usuarios");
    $pdo->exec("ALTER TABLE usuarios AUTO_INCREMENT = 1");

    $usuarios = [
        [
            'nombre_completo' => 'Admin',
            'correo'          => 'admin@recepcionesmishell.ec',
            'password_plano'  => 'Admin2026*',
            'rol'             => 'Administrador',
            'estado'          => 1
        ],
        [
            'nombre_completo' => 'Elvia Casagallo',
            'correo'          => 'elvia@recepcionesmishell.ec',
            'password_plano'  => 'Elvia2026*',
            'rol'             => 'Recepcion',
            'estado'          => 1
        ]
    ];

    $stmtInsert = $pdo->prepare("
        INSERT INTO usuarios (nombre_completo, correo, password, rol, estado)
        VALUES (:nombre, :correo, :password, :rol, :estado)
    ");

    $insertados = [];

    foreach ($usuarios as $u) {
        $hash = password_hash($u['password_plano'], PASSWORD_BCRYPT, ['cost' => 12]);
        
        $stmtInsert->execute([
            ':nombre'   => $u['nombre_completo'],
            ':correo'   => $u['correo'],
            ':password' => $hash,
            ':rol'      => $u['rol'],
            ':estado'   => $u['estado']
        ]);

        $insertados[] = [
            'nombre_completo' => $u['nombre_completo'],
            'correo'          => $u['correo'],
            'password_plano'  => $u['password_plano'],
            'rol'             => $u['rol']
        ];
    }

    $response = [
        'success'  => true,
        'mensaje'  => 'Usuarios creados exitosamente en MySQL.',
        'usuarios' => $insertados
    ];

    if (php_sapi_name() === 'cli') {
        echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL;
    } else {
        jsonResponse($response);
    }

} catch (Throwable $e) {
    if (php_sapi_name() === 'cli') {
        echo "Error: " . $e->getMessage() . PHP_EOL;
    } else {
        jsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
    }
}
