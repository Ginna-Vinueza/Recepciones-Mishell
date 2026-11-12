<?php
/**
 * Script de inicialización de clientes prototipo (Capítulo III)
 * Plataforma Web Recepciones Mishell - Quito
 */

declare(strict_types=1);

require_once __DIR__ . '/../../config-backend/conexion.php';

try {
    $pdo = getDBConnection();

    $clientes = [
        [
            'cedula_ruc' => '1714589201',
            'nombres'    => 'Roberto Carlos',
            'apellidos'  => 'Benítez',
            'telefono'   => '0984123890',
            'correo'     => 'rbenitez@gmail.com',
            'direccion'  => 'Av. Mariscal Sucre y Fernández Salvador, Quito'
        ],
        [
            'cedula_ruc' => '1723456789',
            'nombres'    => 'Christian Patricio',
            'apellidos'  => 'Andrade Ortiz (Fam. Andrade)',
            'telefono'   => '0998765432',
            'correo'     => 'fam.andrade@gmail.com',
            'direccion'  => 'La Villaflora, Calle Alonso de Angulo, Quito Sur'
        ],
        [
            'cedula_ruc' => '1709876543',
            'nombres'    => 'Estefanía Valeria',
            'apellidos'  => 'Paredes Morales',
            'telefono'   => '0987123456',
            'correo'     => 'estefania.paredes@hotmail.com',
            'direccion'  => 'Av. Interoceánica km 7, Cumbayá'
        ],
        [
            'cedula_ruc' => '1792345678001',
            'nombres'    => 'Marcelo Fabián',
            'apellidos'  => 'Salazar Cobo',
            'telefono'   => '0991234567',
            'correo'     => 'contacto@corporativo-salazar.ec',
            'direccion'  => 'Av. Amazonas y Eloy Alfaro, Quito'
        ],
        [
            'cedula_ruc' => '1718293041',
            'nombres'    => 'Mónica Alexandra',
            'apellidos'  => 'Zambrano Vélez',
            'telefono'   => '0982345678',
            'correo'     => 'monica.zambrano@gmail.com',
            'direccion'  => 'Sector El Batán, Gaspar de Villarroel, Quito'
        ]
    ];

    $stmtCheck = $pdo->prepare("SELECT id_cliente FROM clientes WHERE cedula_ruc = :cedula");
    $stmtInsert = $pdo->prepare("
        INSERT INTO clientes (cedula_ruc, nombres, apellidos, telefono, correo, direccion)
        VALUES (:cedula, :nombres, :apellidos, :telefono, :correo, :direccion)
    ");

    $insertados = 0;
    foreach ($clientes as $c) {
        $stmtCheck->execute([':cedula' => $c['cedula_ruc']]);
        if (!$stmtCheck->fetch()) {
            $stmtInsert->execute([
                ':cedula'    => $c['cedula_ruc'],
                ':nombres'   => $c['nombres'],
                ':apellidos' => $c['apellidos'],
                ':telefono'  => $c['telefono'],
                ':correo'    => $c['correo'],
                ':direccion' => $c['direccion']
            ]);
            $insertados++;
        }
    }

    $total = (int)$pdo->query("SELECT COUNT(*) FROM clientes")->fetchColumn();

    $response = [
        'success'    => true,
        'mensaje'    => "Poblado de clientes completado exitosamente. {$insertados} nuevos clientes agregados.",
        'total_bd'   => $total
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
