<?php
/**
 * Migración y Semilla Inicial para Fase 5 (Cotizaciones RF04) y Fase 6 (Reservas y Calendario con Bloqueo Automático RF05/RF06)
 * Plataforma Web Recepciones Mishell - Quito 2026
 */

declare(strict_types=1);

require_once __DIR__ . '/../../config-backend/conexion.php';

try {
    $pdo = getDBConnection();

    // 1. Ampliar y asegurar columnas necesarias en la tabla `reservas` para RF05 y RF06
    $columnasActuales = [];
    $stmtCols = $pdo->query("SHOW COLUMNS FROM reservas");
    foreach ($stmtCols->fetchAll() as $col) {
        $columnasActuales[$col['Field']] = $col;
    }

    // Ampliar tipo_evento a VARCHAR(255) para soportar múltiples tipos de evento
    $pdo->exec("ALTER TABLE reservas MODIFY COLUMN tipo_evento VARCHAR(255) DEFAULT NULL");

    if (!isset($columnasActuales['cantidad_personas'])) {
        $pdo->exec("ALTER TABLE reservas ADD COLUMN cantidad_personas INT(11) NOT NULL DEFAULT 60 AFTER tipo_evento");
    }
    if (!isset($columnasActuales['color_manteleria'])) {
        $pdo->exec("ALTER TABLE reservas ADD COLUMN color_manteleria VARCHAR(255) DEFAULT 'Dorado' AFTER cantidad_personas");
    }
    if (!isset($columnasActuales['total_acordado'])) {
        $pdo->exec("ALTER TABLE reservas ADD COLUMN total_acordado DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER color_manteleria");
    }
    if (!isset($columnasActuales['monto_abonado'])) {
        $pdo->exec("ALTER TABLE reservas ADD COLUMN monto_abonado DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER total_acordado");
    }
    if (!isset($columnasActuales['observaciones'])) {
        $pdo->exec("ALTER TABLE reservas ADD COLUMN observaciones TEXT DEFAULT NULL AFTER estado_reserva");
    }
    if (!isset($columnasActuales['fecha_registro'])) {
        $pdo->exec("ALTER TABLE reservas ADD COLUMN fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP AFTER observaciones");
    }

    echo "Estructura de la tabla 'reservas' actualizada exitosamente.\n";

    // 2. Verificar si existen clientes y usuario administrador
    $idUsuario = (int)($pdo->query("SELECT id_usuario FROM usuarios ORDER BY id_usuario ASC LIMIT 1")->fetchColumn() ?: 1);
    $clientes = $pdo->query("SELECT id_cliente, nombres, apellidos, cedula_ruc FROM clientes ORDER BY id_cliente ASC LIMIT 5")->fetchAll();

    if (empty($clientes)) {
        echo "No hay clientes registrados para sembrar reservas.\n";
        exit;
    }

    // 3. Verificar si ya existen reservas sembradas
    $totalReservas = (int)$pdo->query("SELECT COUNT(*) FROM reservas")->fetchColumn();
    if ($totalReservas === 0) {
        $anioActual = (int)date('Y');
        $mesActual  = (int)date('m');
        $ym = sprintf('%04d-%02d', $anioActual, $mesActual);

        $ejemplos = [
            [
                'cliente_idx' => 0,
                'fecha'       => "{$ym}-14",
                'hora_inicio' => '18:00:00',
                'hora_fin'    => '23:30:00',
                'personas'    => 100,
                'tipo_evento' => 'Boda',
                'colores'     => 'Dorado, Rosado',
                'horas_base'  => 5,
                'horas_extra' => 1,
                'precio_plato'=> 16.00,
                'subtotal_m'  => 1600.00,
                'subtotal_he' => 80.00,
                'total'       => 1680.00,
                'abonado'     => 840.00,
                'estado_cot'  => 'Aprobada',
                'estado_res'  => 'Confirmado',
                'menu'        => [
                    'carnes' => [
                        ['subcat' => 'lomos', 'nombre' => 'Lomo: Res en salsa de champiñones', 'esLomo' => true],
                        ['subcat' => 'pollos', 'nombre' => 'Pollo: Al vino', 'esLomo' => false]
                    ],
                    'arroz' => 'Arroz Dorado (jamón y champiñones)',
                    'ensalada' => 'Ensalada Waldorf (zanahoria, choclo, alverja, piña, apio y manzana)',
                    'papas' => 'Papas: Gratinada con cáscara, bañada en ajo y mantequilla',
                    'arreglo_frutal' => 'Cisne de Frutas',
                    'tiene_lomo' => true
                ],
                'obs' => 'Reserva oficial confirmada con el 50% de anticipo. Fecha bloqueada automáticamente.'
            ],
            [
                'cliente_idx' => isset($clientes[1]) ? 1 : 0,
                'fecha'       => "{$ym}-21",
                'hora_inicio' => '15:30:00',
                'hora_fin'    => '20:30:00',
                'personas'    => 80,
                'tipo_evento' => 'Cumpleaños, Reuniones Sociales',
                'colores'     => 'Lila, Fucsia',
                'horas_base'  => 5,
                'horas_extra' => 0,
                'precio_plato'=> 14.00,
                'subtotal_m'  => 1120.00,
                'subtotal_he' => 0.00,
                'total'       => 1120.00,
                'abonado'     => 350.00,
                'estado_cot'  => 'Aprobada',
                'estado_res'  => 'En Proceso',
                'menu'        => [
                    'carnes' => [
                        ['subcat' => 'chuletas', 'nombre' => 'Chuleta: En salsa de champiñones', 'esLomo' => false],
                        ['subcat' => 'medallones', 'nombre' => 'Medallón: Pollo (jamón y queso)', 'esLomo' => false]
                    ],
                    'arroz' => 'Arroz Verde (albahaca)',
                    'ensalada' => 'Ensalada Rey (jamón, choclo, alverja y coliflor)',
                    'papas' => 'Papas: Al perejil salteadas en mantequilla',
                    'arreglo_frutal' => 'Corazón de Frutas',
                    'tiene_lomo' => false
                ],
                'obs' => 'Abono inicial del 30% registrado. Pendiente liquidación final antes del evento.'
            ],
            [
                'cliente_idx' => isset($clientes[2]) ? 2 : 0,
                'fecha'       => "{$ym}-28",
                'hora_inicio' => '19:00:00',
                'hora_fin'    => '01:00:00',
                'personas'    => 120,
                'tipo_evento' => 'Graduación',
                'colores'     => 'Azul, Dorado',
                'horas_base'  => 6,
                'horas_extra' => 2,
                'precio_plato'=> 16.00,
                'subtotal_m'  => 1920.00,
                'subtotal_he' => 160.00,
                'total'       => 2080.00,
                'abonado'     => 2080.00,
                'estado_cot'  => 'Aprobada',
                'estado_res'  => 'Confirmado',
                'menu'        => [
                    'carnes' => [
                        ['subcat' => 'lomos', 'nombre' => 'Lomo: Costillas de cerdo a la BBQ', 'esLomo' => true],
                        ['subcat' => 'medallones', 'nombre' => 'Medallón: Pavo', 'esLomo' => false]
                    ],
                    'arroz' => 'Arroz Oriental (pimiento rojo, verde y amarillo)',
                    'ensalada' => 'Ensalada Mediterránea (tomate cherry, lechuga, cebolla perla y vinagreta)',
                    'papas' => 'Papas: Al romero',
                    'arreglo_frutal' => 'Cisne de Frutas',
                    'tiene_lomo' => true
                ],
                'obs' => 'Gala de graduación aforo completo (120 invitados). Cancelado 100%.'
            ]
        ];

        $stmtInsCot = $pdo->prepare("
            INSERT INTO cotizaciones (
                id_cliente, id_usuario, fecha_emision, fecha_evento_propuesta,
                hora_inicio, hora_fin, cantidad_personas, tipo_evento,
                color_manteleria, horas_evento, horas_extra, precio_plato,
                subtotal_menu, subtotal_horas_extra, total_estimado,
                menu_seleccionado, observaciones, estado
            ) VALUES (
                :id_cli, :id_usu, NOW(), :fecha,
                :h_ini, :h_fin, :personas, :tipo,
                :colores, :h_base, :h_extra, :precio_p,
                :sub_m, :sub_he, :total,
                :menu_json, :obs, :estado
            )
        ");

        $stmtInsRes = $pdo->prepare("
            INSERT INTO reservas (
                id_cotizacion, id_cliente, id_usuario, fecha_evento,
                hora_inicio, hora_fin, tipo_evento, cantidad_personas,
                color_manteleria, total_acordado, monto_abonado,
                estado_reserva, observaciones
            ) VALUES (
                :id_cot, :id_cli, :id_usu, :fecha,
                :h_ini, :h_fin, :tipo, :personas,
                :colores, :total, :abonado,
                :estado_res, :obs
            )
        ");

        foreach ($ejemplos as $ej) {
            $cli = $clientes[$ej['cliente_idx']];
            $stmtInsCot->execute([
                ':id_cli'    => $cli['id_cliente'],
                ':id_usu'    => $idUsuario,
                ':fecha'     => $ej['fecha'],
                ':h_ini'     => $ej['hora_inicio'],
                ':h_fin'     => $ej['hora_fin'],
                ':personas'  => $ej['personas'],
                ':tipo'      => $ej['tipo_evento'],
                ':colores'   => $ej['colores'],
                ':h_base'    => $ej['horas_base'],
                ':h_extra'   => $ej['horas_extra'],
                ':precio_p'  => $ej['precio_plato'],
                ':sub_m'     => $ej['subtotal_m'],
                ':sub_he'    => $ej['subtotal_he'],
                ':total'     => $ej['total'],
                ':menu_json' => json_encode($ej['menu'], JSON_UNESCAPED_UNICODE),
                ':obs'       => $ej['obs'],
                ':estado'    => $ej['estado_cot']
            ]);
            $idCotNueva = (int)$pdo->lastInsertId();

            $stmtInsRes->execute([
                ':id_cot'     => $idCotNueva,
                ':id_cli'     => $cli['id_cliente'],
                ':id_usu'     => $idUsuario,
                ':fecha'      => $ej['fecha'],
                ':h_ini'      => $ej['hora_inicio'],
                ':h_fin'      => $ej['hora_fin'],
                ':tipo'       => $ej['tipo_evento'],
                ':personas'   => $ej['personas'],
                ':colores'    => $ej['colores'],
                ':total'      => $ej['total'],
                ':abonado'    => $ej['abonado'],
                ':estado_res' => $ej['estado_res'],
                ':obs'        => $ej['obs']
            ]);
        }

        echo "Se sembraron 3 reservas y cotizaciones de demostración con bloqueo automático en el mes actual.\n";
    } else {
        echo "La tabla 'reservas' ya cuenta con {$totalReservas} registro(s).\n";
    }

} catch (Throwable $e) {
    echo "Error en seed_reservas.php: " . $e->getMessage() . "\n";
}
