<?php
/**
 * API REST: Cotizador Inteligente y Gestión de Cotizaciones (RF04)
 * Plataforma Web Recepciones Mishell - Quito 2026
 * 
 * Permite calcular, validar, guardar y consultar proformas de eventos.
 * Implementa las reglas de negocio de RF03 (servicios, menú buffet, horas extra, capacidad).
 * Cumple con RNF04 (Seguridad / Transacciones PDO) y RNF05 (Integridad referencial).
 */

declare(strict_types=1);

require_once __DIR__ . '/../../config-backend/conexion.php';

// Iniciar sesión para validar usuario autenticado
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Control de acceso: requiere sesión activa
if (!isset($_SESSION['user_id'])) {
    jsonResponse([
        'success' => false,
        'error'   => 'Acceso no autorizado. Debe iniciar sesión.'
    ], 401);
}

$pdo = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];
$idUsuarioSesion = (int)$_SESSION['user_id'];

try {
    // -------------------------------------------------------------
    // GET: Listar o Consultar Detalle de Cotizaciones
    // -------------------------------------------------------------
    if ($method === 'GET') {
        $accion = $_GET['action'] ?? 'listar';

        // Detalle de una cotización específica
        if ($accion === 'detalle' || isset($_GET['id'])) {
            $idCot = (int)($_GET['id'] ?? 0);
            if ($idCot <= 0) {
                jsonResponse(['success' => false, 'error' => 'ID de cotización no válido.'], 400);
            }

            $stmt = $pdo->prepare("
                SELECT c.*, 
                       cli.cedula_ruc, cli.nombres, cli.apellidos, cli.telefono, cli.correo, cli.direccion,
                       u.nombre_completo AS asesor_comercial
                FROM cotizaciones c
                INNER JOIN clientes cli ON c.id_cliente = cli.id_cliente
                INNER JOIN usuarios u ON c.id_usuario = u.id_usuario
                WHERE c.id_cotizacion = :id
                LIMIT 1
            ");
            $stmt->execute([':id' => $idCot]);
            $cotizacion = $stmt->fetch();

            if (!$cotizacion) {
                jsonResponse(['success' => false, 'error' => 'Cotización no encontrada.'], 404);
            }

            // Decodificar menú seleccionado si viene en JSON
            if (!empty($cotizacion['menu_seleccionado'])) {
                $cotizacion['menu_desglosado'] = json_decode($cotizacion['menu_seleccionado'], true);
            }

            // Obtener ítems del detalle_cotizacion
            $stmtDet = $pdo->prepare("
                SELECT dc.*, s.nombre_servicio, s.categoria, s.descripcion
                FROM detalle_cotizacion dc
                LEFT JOIN servicios s ON dc.id_servicio = s.id_servicio
                WHERE dc.id_cotizacion = :id
                ORDER BY dc.id_detalle ASC
            ");
            $stmtDet->execute([':id' => $idCot]);
            $cotizacion['detalles'] = $stmtDet->fetchAll();

            jsonResponse([
                'success'    => true,
                'cotizacion' => $cotizacion
            ]);
        }

        // Listado de cotizaciones con todos los datos para visualización y reimpresión ilimitada
        $limite = max(1, min(200, (int)($_GET['limit'] ?? 100)));
        $stmtList = $pdo->prepare("
            SELECT c.id_cotizacion, c.fecha_emision, c.fecha_evento_propuesta, c.hora_inicio, c.hora_fin,
                   c.cantidad_personas, c.tipo_evento, c.color_manteleria, c.horas_evento, c.horas_extra,
                   c.precio_plato, c.subtotal_menu, c.subtotal_horas_extra, c.total_estimado,
                   c.menu_seleccionado, c.observaciones, c.estado,
                   cli.id_cliente, cli.cedula_ruc, cli.nombres, cli.apellidos, cli.telefono, cli.correo, cli.direccion
            FROM cotizaciones c
            INNER JOIN clientes cli ON c.id_cliente = cli.id_cliente
            ORDER BY c.id_cotizacion DESC
            LIMIT :limite
        ");
        $stmtList->bindValue(':limite', $limite, PDO::PARAM_INT);
        $stmtList->execute();
        $lista = $stmtList->fetchAll();

        foreach ($lista as &$fila) {
            if (!empty($fila['menu_seleccionado'])) {
                $fila['menu_desglosado'] = json_decode($fila['menu_seleccionado'], true);
            }
        }
        unset($fila);

        jsonResponse([
            'success'      => true,
            'cotizaciones' => $lista,
            'total'        => count($lista)
        ]);
    }

    // -------------------------------------------------------------
    // POST: Registrar Nueva Cotización o Cambiar Estado
    // -------------------------------------------------------------
    if ($method === 'POST') {
        $rawInput = file_get_contents('php://input');
        $payload = json_decode($rawInput, true) ?? $_POST;
        $accion = $payload['action'] ?? 'crear';

        // 1. Cambiar estado (Pendiente -> Aprobada / Rechazada)
        if ($accion === 'cambiar_estado') {
            $idCot = (int)($payload['id_cotizacion'] ?? 0);
            $nuevoEstado = trim($payload['estado'] ?? '');

            if (!in_array($nuevoEstado, ['Pendiente', 'Aprobada', 'Rechazada'], true)) {
                jsonResponse(['success' => false, 'error' => 'Estado no válido. Permite: Pendiente, Aprobada, Rechazada.'], 400);
            }

            $stmtUp = $pdo->prepare("UPDATE cotizaciones SET estado = :estado WHERE id_cotizacion = :id");
            $stmtUp->execute([':estado' => $nuevoEstado, ':id' => $idCot]);

            registrarHistorialAccion(
                $pdo,
                'Cotizador (RF04)',
                'ESTADO_COTIZACION',
                "Se cambió el estado de la cotización #{$idCot} a «{$nuevoEstado}».",
                $idCot
            );

            jsonResponse(['success' => true, 'mensaje' => "Estado de cotización #{$idCot} actualizado a '{$nuevoEstado}'."]);
        }

        // 1.B Eliminar cotización (Super Administrador con respaldo histórico en BD)
        if ($accion === 'eliminar') {
            $idCot = (int)($payload['id_cotizacion'] ?? 0);
            if ($idCot <= 0) {
                jsonResponse(['success' => false, 'error' => 'ID de cotización no válido.'], 400);
            }

            $stmtCot = $pdo->prepare("
                SELECT c.*, cli.nombres, cli.apellidos, cli.cedula_ruc
                FROM cotizaciones c
                LEFT JOIN clientes cli ON c.id_cliente = cli.id_cliente
                WHERE c.id_cotizacion = :id
                LIMIT 1
            ");
            $stmtCot->execute([':id' => $idCot]);
            $cotInfo = $stmtCot->fetch();

            if (!$cotInfo) {
                jsonResponse(['success' => false, 'error' => 'La cotización no existe.'], 404);
            }

            // Verificar si tiene reserva vinculada
            $stmtRes = $pdo->prepare("SELECT COUNT(*) FROM reservas WHERE id_cotizacion = :id");
            $stmtRes->execute([':id' => $idCot]);
            if ((int)$stmtRes->fetchColumn() > 0) {
                jsonResponse([
                    'success' => false,
                    'error'   => 'No se puede eliminar la cotización porque ya tiene una reserva confirmada en el calendario.'
                ], 409);
            }

            $pdo->beginTransaction();
            $stmtDelDet = $pdo->prepare("DELETE FROM detalle_cotizacion WHERE id_cotizacion = :id");
            $stmtDelDet->execute([':id' => $idCot]);

            $stmtDelCot = $pdo->prepare("DELETE FROM cotizaciones WHERE id_cotizacion = :id");
            $stmtDelCot->execute([':id' => $idCot]);
            $pdo->commit();

            $titular = trim(($cotInfo['nombres'] ?? '') . ' ' . ($cotInfo['apellidos'] ?? ''));
            registrarHistorialAccion(
                $pdo,
                'Cotizador (RF04)',
                'ELIMINAR_COTIZACION',
                "Super Administrador eliminó la cotización #{$idCot} del titular «{$titular}» (Fecha evento: {$cotInfo['fecha_evento_propuesta']}, Total: \${$cotInfo['total_estimado']}).",
                $idCot
            );

            jsonResponse([
                'success' => true,
                'mensaje' => "Cotización #{$idCot} eliminada y registrada en el historial de auditoría."
            ]);
        }

        // 2. CREACIÓN DE COTIZACIÓN INTELIGENTE (RF03 / RF04)
        $idCliente = (int)($payload['id_cliente'] ?? 0);
        if ($idCliente <= 0) {
            jsonResponse(['success' => false, 'error' => 'Debe seleccionar un cliente registrado de forma obligatoria.'], 422);
        }

        // Validar existencia de cliente
        $stmtCli = $pdo->prepare("SELECT id_cliente, nombres, apellidos, correo FROM clientes WHERE id_cliente = :id");
        $stmtCli->execute([':id' => $idCliente]);
        $clienteDb = $stmtCli->fetch();
        if (!$clienteDb) {
            jsonResponse(['success' => false, 'error' => 'El cliente seleccionado no existe en el sistema.'], 404);
        }

        // Cantidad de personas (obligatorio, máx 120)
        $cantidadPersonas = (int)($payload['cantidad_personas'] ?? 0);
        if ($cantidadPersonas < 1 || $cantidadPersonas > 120) {
            jsonResponse(['success' => false, 'error' => 'La cantidad de personas es obligatoria y debe ser entre 1 y 120 invitados.'], 422);
        }

        // Tipo de evento (multiselección permitida, obligatorio al menos 1)
        $tipoEvento = $payload['tipo_evento'] ?? '';
        if (is_array($tipoEvento)) {
            $tipoEvento = implode(', ', array_filter(array_map('trim', $tipoEvento)));
        } else {
            $tipoEvento = trim((string)$tipoEvento);
        }
        if (empty($tipoEvento)) {
            jsonResponse(['success' => false, 'error' => 'Debe seleccionar al menos un tipo de evento.'], 422);
        }

        // Mantelería / Colores de lazos (multiselección permitida, obligatorio al menos 1 color)
        $colorManteleria = $payload['color_manteleria'] ?? '';
        if (is_array($colorManteleria)) {
            $colorManteleria = implode(', ', array_filter(array_map('trim', $colorManteleria)));
        } else {
            $colorManteleria = trim((string)$colorManteleria);
        }
        if (empty($colorManteleria)) {
            jsonResponse(['success' => false, 'error' => 'Debe seleccionar al menos un color de lazos y cubre manteles.'], 422);
        }

        // Horas de evento (de 1 a 6 horas máximo)
        $horasEvento = (int)($payload['horas_evento'] ?? 4);
        if ($horasEvento < 1 || $horasEvento > 6) {
            jsonResponse(['success' => false, 'error' => 'Las horas del evento deben ser entre 1 y 6 horas máximo.'], 422);
        }

        // Horas extra (máximo 5 horas extra, a $80.00 c/u)
        $horasExtra = (int)($payload['horas_extra'] ?? 0);
        if ($horasExtra < 0 || $horasExtra > 5) {
            jsonResponse(['success' => false, 'error' => 'Las horas extra permitidas son de 0 a 5 horas máximo.'], 422);
        }

        // Fecha de evento propuesta
        $fechaPropuesta = trim($payload['fecha_evento_propuesta'] ?? '');
        if (empty($fechaPropuesta) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $fechaPropuesta)) {
            jsonResponse(['success' => false, 'error' => 'Debe especificar una fecha de evento válida (AAAA-MM-DD).'], 422);
        }

        // Validar que la fecha seleccionada NO se encuentre ya reservada en el calendario (RF06)
        $stmtFechaOcupada = $pdo->prepare("
            SELECT id_reserva, tipo_evento FROM reservas
            WHERE fecha_evento = :fecha AND estado_reserva IN ('Confirmado', 'En Proceso')
            LIMIT 1
        ");
        $stmtFechaOcupada->execute([':fecha' => $fechaPropuesta]);
        $reservaOcupando = $stmtFechaOcupada->fetch();
        if ($reservaOcupando) {
            jsonResponse([
                'success' => false,
                'error'   => "La fecha seleccionada ({$fechaPropuesta}) ya se encuentra reservada (Reserva #{$reservaOcupando['id_reserva']}). Por favor seleccione otra fecha disponible."
            ], 409);
        }

        $horaInicio = !empty($payload['hora_inicio']) ? trim($payload['hora_inicio']) : '18:00:00';
        $horaFin    = !empty($payload['hora_fin']) ? trim($payload['hora_fin']) : null;
        if (!$horaFin) {
            // Calcular hora de fin aproximada según horas totales (base + extra)
            $totalHorasDuracion = $horasEvento + $horasExtra;
            $dtInicio = DateTime::createFromFormat('H:i:s', strlen($horaInicio) === 5 ? $horaInicio . ':00' : $horaInicio);
            if ($dtInicio) {
                $dtFin = clone $dtInicio;
                $dtFin->modify("+{$totalHorasDuracion} hours");
                $horaFin = $dtFin->format('H:i:s');
            }
        }

        // -------------------------------------------------------------
        // VALIDACIÓN DE MENÚ BUFFET (FIGURA 10 - RF03)
        // -------------------------------------------------------------
        $menu = $payload['menu'] ?? [];
        $carnesSeleccionadas = $menu['carnes'] ?? []; // array de nombres o IDs
        $arrozSeleccionado   = trim((string)($menu['arroz'] ?? ''));
        $ensaladaSeleccionada= trim((string)($menu['ensalada'] ?? ''));
        $papasSeleccionada   = trim((string)($menu['papas'] ?? ''));
        $arregloFrutal       = trim((string)($menu['arreglo_frutal'] ?? ''));

        // Regla: Para las carnes obligatoriamente son dos (2) opciones de carnes
        if (!is_array($carnesSeleccionadas) || count($carnesSeleccionadas) !== 2) {
            jsonResponse([
                'success' => false,
                'error'   => 'Para el menú es obligatorio seleccionar exactamente dos (2) opciones de carnes.'
            ], 422);
        }

        // Regla: Arroz, Ensalada, Papas y Arreglos Frutales son 1 opción obligatoria cada uno
        if (empty($arrozSeleccionado)) {
            jsonResponse(['success' => false, 'error' => 'Debe seleccionar una (1) opción de arroz para el menú buffet.'], 422);
        }
        if (empty($ensaladaSeleccionada)) {
            jsonResponse(['success' => false, 'error' => 'Debe seleccionar una (1) opción de ensalada para el menú buffet.'], 422);
        }
        if (empty($papasSeleccionada)) {
            jsonResponse(['success' => false, 'error' => 'Debe seleccionar una (1) opción de papas para el menú buffet.'], 422);
        }
        if (empty($arregloFrutal)) {
            jsonResponse(['success' => false, 'error' => 'Debe seleccionar una (1) opción de arreglos frutales (Cisne o Corazón de Frutas).'], 422);
        }

        // Determinar precio por plato:
        // "si dentro de la selección se escogió alguna de las opciones de lomos el valor sería de $16.00, caso contrario $14.00"
        $tieneLomo = false;
        $lomosKeywords = ['Lomo', 'lomo', 'Costillas', 'costillas'];
        
        foreach ($carnesSeleccionadas as $carne) {
            $nombreCarne = is_array($carne) ? ($carne['nombre'] ?? '') : (string)$carne;
            $esLomoCarne = is_array($carne) && !empty($carne['es_lomo']);
            if ($esLomoCarne) {
                $tieneLomo = true;
                break;
            }
            foreach ($lomosKeywords as $kw) {
                if (stripos($nombreCarne, $kw) !== false) {
                    $tieneLomo = true;
                    break 2;
                }
            }
        }

        $precioPlato = $tieneLomo ? 16.00 : 14.00;

        // CÁLCULO AUTOMÁTICO INTELIGENTE
        $subtotalMenu = round($cantidadPersonas * $precioPlato, 2);
        $subtotalHorasExtra = round($horasExtra * 80.00, 2);
        $totalEstimado = round($subtotalMenu + $subtotalHorasExtra, 2);

        $menuJson = json_encode([
            'carnes'         => $carnesSeleccionadas,
            'arroz'          => $arrozSeleccionado,
            'ensalada'       => $ensaladaSeleccionada,
            'papas'          => $papasSeleccionada,
            'arreglo_frutal' => $arregloFrutal,
            'tiene_lomo'     => $tieneLomo,
            'precio_plato'   => $precioPlato
        ], JSON_UNESCAPED_UNICODE);

        $observaciones = trim((string)($payload['observaciones'] ?? ''));

        // TRANSACCIÓN DE BASE DE DATOS (RNF04 / RNF05)
        $pdo->beginTransaction();

        $stmtInsCot = $pdo->prepare("
            INSERT INTO cotizaciones (
                id_cliente, id_usuario, fecha_evento_propuesta, hora_inicio, hora_fin,
                cantidad_personas, tipo_evento, color_manteleria, horas_evento, horas_extra,
                precio_plato, subtotal_menu, subtotal_horas_extra, total_estimado,
                menu_seleccionado, observaciones, estado
            ) VALUES (
                :id_cliente, :id_usuario, :fecha_propuesta, :hora_inicio, :hora_fin,
                :cant_personas, :tipo_evento, :color_manteleria, :horas_evento, :horas_extra,
                :precio_plato, :subtotal_menu, :subtotal_horas_extra, :total_estimado,
                :menu_seleccionado, :observaciones, 'Pendiente'
            )
        ");

        $stmtInsCot->execute([
            ':id_cliente'          => $idCliente,
            ':id_usuario'          => $idUsuarioSesion,
            ':fecha_propuesta'     => $fechaPropuesta,
            ':hora_inicio'         => $horaInicio,
            ':hora_fin'            => $horaFin,
            ':cant_personas'       => $cantidadPersonas,
            ':tipo_evento'         => $tipoEvento,
            ':color_manteleria'    => $colorManteleria,
            ':horas_evento'        => $horasEvento,
            ':horas_extra'         => $horasExtra,
            ':precio_plato'        => $precioPlato,
            ':subtotal_menu'       => $subtotalMenu,
            ':subtotal_horas_extra'=> $subtotalHorasExtra,
            ':total_estimado'      => $totalEstimado,
            ':menu_seleccionado'   => $menuJson,
            ':observaciones'       => $observaciones
        ]);

        $idCotizacionCreada = (int)$pdo->lastInsertId();

        // 3. REGISTRAR DETALLE DE COTIZACIÓN (tabla detalle_cotizacion)
        // Buscar el id_servicio correspondiente al Menú Buffet
        $nombreServicioMenu = $tieneLomo ? 'Menú Buffet Especial (Incluye Lomo de Res / Cerdo)' : 'Menú Buffet Estándar (2 Carnes sin Lomo)';
        $stmtServMenu = $pdo->prepare("SELECT id_servicio FROM servicios WHERE nombre_servicio = :nombre LIMIT 1");
        $stmtServMenu->execute([':nombre' => $nombreServicioMenu]);
        $idServMenu = (int)$stmtServMenu->fetchColumn();
        if ($idServMenu <= 0) {
            $idServMenu = 1; // Fallback
        }

        $stmtInsDetalle = $pdo->prepare("
            INSERT INTO detalle_cotizacion (id_cotizacion, id_servicio, cantidad, precio_unitario, subtotal)
            VALUES (:id_cotizacion, :id_servicio, :cantidad, :precio_unitario, :subtotal)
        ");

        // Fila 1: Menú Buffet por persona
        $stmtInsDetalle->execute([
            ':id_cotizacion'   => $idCotizacionCreada,
            ':id_servicio'     => $idServMenu,
            ':cantidad'        => $cantidadPersonas,
            ':precio_unitario' => $precioPlato,
            ':subtotal'        => $subtotalMenu
        ]);

        // Fila 2: Horas Extra (si aplica)
        if ($horasExtra > 0) {
            $stmtServHora = $pdo->prepare("SELECT id_servicio FROM servicios WHERE categoria = 'Hora Extra' LIMIT 1");
            $stmtServHora->execute();
            $idServHora = (int)$stmtServHora->fetchColumn();
            if ($idServHora <= 0) $idServHora = 3;

            $stmtInsDetalle->execute([
                ':id_cotizacion'   => $idCotizacionCreada,
                ':id_servicio'     => $idServHora,
                ':cantidad'        => $horasExtra,
                ':precio_unitario' => 80.00,
                ':subtotal'        => $subtotalHorasExtra
            ]);
        }

        // Fila 3..N: Servicios Incluidos de Paquete (Precio $0.00)
        $stmtServIncluidos = $pdo->query("SELECT id_servicio, nombre_servicio FROM servicios WHERE categoria = 'Servicio Incluido'");
        $incluidos = $stmtServIncluidos->fetchAll();
        foreach ($incluidos as $si) {
            $stmtInsDetalle->execute([
                ':id_cotizacion'   => $idCotizacionCreada,
                ':id_servicio'     => (int)$si['id_servicio'],
                ':cantidad'        => 1,
                ':precio_unitario' => 0.00,
                ':subtotal'        => 0.00
            ]);
        }

        $pdo->commit();

        registrarHistorialAccion(
            $pdo,
            'Cotizador (RF04)',
            'CREAR_COTIZACION',
            "Se creó la cotización #{$idCotizacionCreada} para «{$clienteDb['nombres']} {$clienteDb['apellidos']}» ({$cantidadPersonas} pers., Evento: {$tipoEvento}, Hora: {$horaInicio}, Total: \${$totalEstimado}).",
            $idCotizacionCreada
        );

        jsonResponse([
            'success'       => true,
            'mensaje'       => "Cotización #{$idCotizacionCreada} calculada y guardada con éxito.",
            'id_cotizacion' => $idCotizacionCreada,
            'resumen'       => [
                'id_cotizacion'        => $idCotizacionCreada,
                'cliente'              => "{$clienteDb['nombres']} {$clienteDb['apellidos']}",
                'cantidad_personas'    => $cantidadPersonas,
                'tipo_evento'          => $tipoEvento,
                'color_manteleria'     => $colorManteleria,
                'horas_evento'         => $horasEvento,
                'horas_extra'          => $horasExtra,
                'tiene_lomo'           => $tieneLomo,
                'precio_plato'         => $precioPlato,
                'subtotal_menu'        => $subtotalMenu,
                'subtotal_horas_extra' => $subtotalHorasExtra,
                'total_estimado'       => $totalEstimado,
                'fecha_evento'         => $fechaPropuesta
            ]
        ], 201);
    }

    jsonResponse(['success' => false, 'error' => 'Método no soportado.'], 405);

} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("[Cotizaciones API Error] " . $e->getMessage());
    jsonResponse([
        'success' => false,
        'error'   => 'Error interno al procesar la cotización: ' . $e->getMessage()
    ], 500);
}
