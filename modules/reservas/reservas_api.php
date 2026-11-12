<?php
/**
 * API REST: Módulo de Reservas y Calendario con Bloqueo Automático (RF05, RF06) (Figura 6)
 * Incluye Administración Integral para Super Administrador + Auditoría en BD (historial_acciones)
 * Plataforma Web Recepciones Mishell - Quito 2026
 */

declare(strict_types=1);

require_once __DIR__ . '/../../config-backend/conexion.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user_id'])) {
    jsonResponse([
        'success' => false,
        'error'   => 'Acceso no autorizado. Debe iniciar sesión.'
    ], 401);
}

$pdo = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];
$idUsuarioSesion = (int)$_SESSION['user_id'];
$rolUsuario = $_SESSION['user_role'] ?? 'Administrador';

try {
    // =========================================================================
    // GET: Consultar Calendario, Fechas Bloqueadas, KPIs y Verificación de Fecha
    // =========================================================================
    if ($method === 'GET') {
        $accion = $_GET['action'] ?? 'listar';

        // 1. Verificar disponibilidad en tiempo real de una fecha específica (RF06 Bloqueo Automático)
        if ($accion === 'verificar_fecha') {
            $fecha = trim($_GET['fecha'] ?? '');
            $excluirIdReserva = (int)($_GET['excluir_id_reserva'] ?? 0);

            if (empty($fecha) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) {
                jsonResponse(['success' => false, 'error' => 'Formato de fecha no válido (AAAA-MM-DD).'], 400);
            }

            $sqlVerif = "
                SELECT r.id_reserva, r.id_cotizacion, r.fecha_evento, r.hora_inicio, r.hora_fin,
                       r.tipo_evento, r.cantidad_personas, r.estado_reserva,
                       cli.nombres, cli.apellidos, cli.cedula_ruc
                FROM reservas r
                INNER JOIN clientes cli ON r.id_cliente = cli.id_cliente
                WHERE r.fecha_evento = :fecha
                  AND r.estado_reserva IN ('Confirmado', 'En Proceso')
            ";
            $paramsVerif = [':fecha' => $fecha];
            if ($excluirIdReserva > 0) {
                $sqlVerif .= " AND r.id_reserva != :excluir_id";
                $paramsVerif[':excluir_id'] = $excluirIdReserva;
            }
            $sqlVerif .= " LIMIT 1";

            $stmtV = $pdo->prepare($sqlVerif);
            $stmtV->execute($paramsVerif);
            $reservaOcupando = $stmtV->fetch();

            // También consultar si existen cotizaciones pendientes para esa misma fecha
            $stmtCotsFecha = $pdo->prepare("
                SELECT COUNT(*) FROM cotizaciones
                WHERE fecha_evento_propuesta = :fecha AND estado != 'Rechazada'
            ");
            $stmtCotsFecha->execute([':fecha' => $fecha]);
            $cotizacionesEnFecha = (int)$stmtCotsFecha->fetchColumn();

            jsonResponse([
                'success'              => true,
                'fecha'                => $fecha,
                'disponible'           => !$reservaOcupando,
                'bloqueada'            => (bool)$reservaOcupando,
                'reserva_bloqueante'   => $reservaOcupando ?: null,
                'cotizaciones_en_fecha'=> $cotizacionesEnFecha
            ]);
        }

        // 2. Listado completo para el Calendario Mensual, Tarjetas y Cotizaciones Disponibles
        $anio = (int)($_GET['anio'] ?? date('Y'));
        $mes  = (int)($_GET['mes'] ?? date('m'));
        $filtroEstado = trim($_GET['estado'] ?? '');
        $busqueda = trim($_GET['q'] ?? '');

        $stmtRes = $pdo->prepare("
            SELECT r.id_reserva, r.id_cotizacion, r.id_cliente, r.id_usuario,
                   r.fecha_evento, r.hora_inicio, r.hora_fin, r.tipo_evento,
                   r.cantidad_personas, r.color_manteleria, r.total_acordado,
                   r.monto_abonado, r.estado_reserva, r.observaciones, r.fecha_registro,
                   cli.cedula_ruc, cli.nombres, cli.apellidos, cli.telefono, cli.correo, cli.direccion,
                   c.horas_evento, c.horas_extra, c.precio_plato, c.subtotal_menu,
                   c.subtotal_horas_extra, c.total_estimado, c.menu_seleccionado, c.estado AS estado_cotizacion
            FROM reservas r
            INNER JOIN clientes cli ON r.id_cliente = cli.id_cliente
            LEFT JOIN cotizaciones c ON r.id_cotizacion = c.id_cotizacion
            ORDER BY r.fecha_evento ASC, r.hora_inicio ASC
        ");
        $stmtRes->execute();
        $todasReservas = $stmtRes->fetchAll();

        $fechasBloqueadas = [];
        $reservasFiltradas = [];

        $prefijoMes = sprintf('%04d-%02d', $anio, $mes);
        $kpis = [
            'total_reservas'       => 0,
            'confirmadas'          => 0,
            'en_proceso'           => 0,
            'canceladas'           => 0,
            'fechas_bloqueadas_mes'=> 0,
            'total_acordado_mes'   => 0.0,
            'total_abonado_mes'    => 0.0,
            'saldo_pendiente_mes'  => 0.0
        ];

        foreach ($todasReservas as &$res) {
            $totalAcordado = (float)($res['total_acordado'] > 0 ? $res['total_acordado'] : ($res['total_estimado'] ?? 0));
            $montoAbonado  = (float)($res['monto_abonado'] ?? 0);
            $saldoPendiente = max(0.0, $totalAcordado - $montoAbonado);

            $res['total_acordado']  = $totalAcordado;
            $res['monto_abonado']   = $montoAbonado;
            $res['saldo_pendiente'] = $saldoPendiente;
            $res['cantidad_personas'] = (int)($res['cantidad_personas'] ?: 60);
            $res['hora_inicio_corta'] = !empty($res['hora_inicio']) ? substr((string)$res['hora_inicio'], 0, 5) : '15:30';
            $res['hora_fin_corta']    = !empty($res['hora_fin']) ? substr((string)$res['hora_fin'], 0, 5) : '20:30';

            if (!empty($res['menu_seleccionado'])) {
                $res['menu_desglosado'] = json_decode((string)$res['menu_seleccionado'], true);
            }

            // Bloqueo automático: si está Confirmado o En Proceso, bloquea la fecha en Sede Única
            if (in_array($res['estado_reserva'], ['Confirmado', 'En Proceso'], true)) {
                $fechasBloqueadas[$res['fecha_evento']] = [
                    'id_reserva'        => (int)$res['id_reserva'],
                    'id_cotizacion'     => (int)$res['id_cotizacion'],
                    'fecha_evento'      => $res['fecha_evento'],
                    'estado_reserva'    => $res['estado_reserva'],
                    'tipo_evento'       => $res['tipo_evento'],
                    'cantidad_personas' => $res['cantidad_personas'],
                    'hora_inicio'       => $res['hora_inicio_corta'],
                    'hora_fin'          => $res['hora_fin_corta'],
                    'cliente'           => trim($res['nombres'] . ' ' . $res['apellidos']),
                    'cedula_ruc'        => $res['cedula_ruc'],
                    'total_acordado'    => $totalAcordado,
                    'monto_abonado'     => $montoAbonado,
                    'saldo_pendiente'   => $saldoPendiente
                ];
            }

            // Contabilizar KPIs globales y del mes seleccionado
            $kpis['total_reservas']++;
            if ($res['estado_reserva'] === 'Confirmado') $kpis['confirmadas']++;
            elseif ($res['estado_reserva'] === 'En Proceso') $kpis['en_proceso']++;
            elseif ($res['estado_reserva'] === 'Cancelado') $kpis['canceladas']++;

            if (strpos((string)$res['fecha_evento'], $prefijoMes) === 0 && $res['estado_reserva'] !== 'Cancelado') {
                $kpis['fechas_bloqueadas_mes']++;
                $kpis['total_acordado_mes']  += $totalAcordado;
                $kpis['total_abonado_mes']   += $montoAbonado;
                $kpis['saldo_pendiente_mes'] += $saldoPendiente;
            }

            // Aplicar filtros de listado si se enviaron
            $pasaEstado = ($filtroEstado === '' || $filtroEstado === 'Todas' || $res['estado_reserva'] === $filtroEstado);
            $pasaBusqueda = true;
            if ($busqueda !== '') {
                $qLower = mb_strtolower($busqueda, 'UTF-8');
                $textoFila = mb_strtolower(
                    "#{$res['id_reserva']} #{$res['id_cotizacion']} {$res['nombres']} {$res['apellidos']} {$res['cedula_ruc']} {$res['tipo_evento']} {$res['fecha_evento']}",
                    'UTF-8'
                );
                $pasaBusqueda = (mb_strpos($textoFila, $qLower) !== false);
            }

            if ($pasaEstado && $pasaBusqueda) {
                $reservasFiltradas[] = $res;
            }
        }
        unset($res);

        // Obtener cotizaciones realizadas que aún no tienen una reserva activa para agendarlas rápidamente
        $stmtCotsDisp = $pdo->query("
            SELECT c.id_cotizacion, c.id_cliente, c.fecha_evento_propuesta, c.hora_inicio, c.hora_fin,
                   c.cantidad_personas, c.tipo_evento, c.color_manteleria, c.horas_evento, c.horas_extra,
                   c.precio_plato, c.subtotal_menu, c.subtotal_horas_extra, c.total_estimado,
                   c.menu_seleccionado, c.estado,
                   cli.nombres, cli.apellidos, cli.cedula_ruc, cli.telefono, cli.correo,
                   (SELECT COUNT(*) FROM reservas r WHERE r.id_cotizacion = c.id_cotizacion AND r.estado_reserva != 'Cancelado') AS tiene_reserva_activa
            FROM cotizaciones c
            INNER JOIN clientes cli ON c.id_cliente = cli.id_cliente
            ORDER BY c.id_cotizacion DESC
            LIMIT 100
        ");
        $cotizacionesDisponibles = $stmtCotsDisp->fetchAll();

        jsonResponse([
            'success'                  => true,
            'rol_usuario'              => $rolUsuario,
            'anio_consultado'          => $anio,
            'mes_consultado'           => $mes,
            'kpis'                     => $kpis,
            'fechas_bloqueadas'        => $fechasBloqueadas,
            'reservas'                 => $reservasFiltradas,
            'todas_reservas'           => $todasReservas,
            'cotizaciones_disponibles' => $cotizacionesDisponibles
        ]);
    }

    // =========================================================================
    // POST: Crear Reserva (con Bloqueo Automático RF06), Actualizar o Eliminar
    // =========================================================================
    if ($method === 'POST') {
        $rawInput = file_get_contents('php://input');
        $payload = json_decode($rawInput, true) ?? $_POST;
        $accion = $payload['action'] ?? '';

        // ---------------------------------------------------------------------
        // 1. CREAR RESERVA DESDE COTIZACIÓN (RF05 / RF06 BLOQUEO AUTOMÁTICO)
        // ---------------------------------------------------------------------
        if ($accion === 'crear_reserva') {
            $idCotizacion = (int)($payload['id_cotizacion'] ?? 0);
            if ($idCotizacion <= 0) {
                jsonResponse(['success' => false, 'error' => 'Debe seleccionar una cotización válida para agendar la reserva.'], 422);
            }

            // Consultar datos de la cotización
            $stmtCot = $pdo->prepare("
                SELECT c.*, cli.nombres, cli.apellidos, cli.cedula_ruc
                FROM cotizaciones c
                INNER JOIN clientes cli ON c.id_cliente = cli.id_cliente
                WHERE c.id_cotizacion = :id
                LIMIT 1
            ");
            $stmtCot->execute([':id' => $idCotizacion]);
            $cot = $stmtCot->fetch();

            if (!$cot) {
                jsonResponse(['success' => false, 'error' => 'La cotización seleccionada no existe en la base de datos.'], 404);
            }

            // Verificar que esta cotización no tenga ya una reserva activa
            $stmtYaRes = $pdo->prepare("
                SELECT id_reserva, fecha_evento FROM reservas
                WHERE id_cotizacion = :id_cot AND estado_reserva IN ('Confirmado', 'En Proceso')
                LIMIT 1
            ");
            $stmtYaRes->execute([':id_cot' => $idCotizacion]);
            $resExistenteCot = $stmtYaRes->fetch();
            if ($resExistenteCot) {
                jsonResponse([
                    'success' => false,
                    'error'   => "La Cotización #{$idCotizacion} ya cuenta con la Reserva activa #{$resExistenteCot['id_reserva']} para la fecha {$resExistenteCot['fecha_evento']}."
                ], 409);
            }

            $fechaEvento = trim($payload['fecha_evento'] ?? $cot['fecha_evento_propuesta']);
            if (empty($fechaEvento) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $fechaEvento)) {
                jsonResponse(['success' => false, 'error' => 'Debe indicar una fecha de evento válida (AAAA-MM-DD).'], 422);
            }

            // VALIDACIÓN ESTRICTA RF06: BLOQUEO AUTOMÁTICO DE FECHA EN SEDE ÚNICA
            $stmtBloqueo = $pdo->prepare("
                SELECT r.id_reserva, r.tipo_evento, r.estado_reserva, cli.nombres, cli.apellidos
                FROM reservas r
                INNER JOIN clientes cli ON r.id_cliente = cli.id_cliente
                WHERE r.fecha_evento = :fecha
                  AND r.estado_reserva IN ('Confirmado', 'En Proceso')
                LIMIT 1
            ");
            $stmtBloqueo->execute([':fecha' => $fechaEvento]);
            $conflicto = $stmtBloqueo->fetch();

            if ($conflicto) {
                $clienteConflicto = trim($conflicto['nombres'] . ' ' . $conflicto['apellidos']);
                jsonResponse([
                    'success' => false,
                    'error'   => "BLOQUEO AUTOMÁTICO (RF06): La fecha {$fechaEvento} ya se encuentra reservada y bloqueada por la Reserva #{$conflicto['id_reserva']} ({$conflicto['tipo_evento']} - Cliente: {$clienteConflicto}). Por favor elija otra fecha disponible."
                ], 409);
            }

            $horaInicio = trim($payload['hora_inicio'] ?? ($cot['hora_inicio'] ?: '15:30:00'));
            if (strlen($horaInicio) === 5) $horaInicio .= ':00';

            $totalHoras = (int)($cot['horas_evento'] ?: 5) + (int)($cot['horas_extra'] ?: 0);
            $horaFin = $cot['hora_fin'];
            $dtIni = DateTime::createFromFormat('H:i:s', $horaInicio);
            if ($dtIni) {
                $dtFin = clone $dtIni;
                $dtFin->modify("+{$totalHoras} hours");
                $horaFin = $dtFin->format('H:i:s');
            }

            $estadoReserva = trim($payload['estado_reserva'] ?? 'Confirmado');
            if (!in_array($estadoReserva, ['Confirmado', 'En Proceso', 'Cancelado'], true)) {
                $estadoReserva = 'Confirmado';
            }

            $totalAcordado = (float)($cot['total_estimado'] ?? 0);
            $montoAbonado  = isset($payload['monto_abonado']) ? (float)$payload['monto_abonado'] : round($totalAcordado * 0.30, 2);
            if ($montoAbonado < 0) $montoAbonado = 0;
            if ($montoAbonado > $totalAcordado) $montoAbonado = $totalAcordado;

            $observaciones = trim($payload['observaciones'] ?? 'Reserva agendada con bloqueo automático de fecha en salón principal.');

            $pdo->beginTransaction();

            $stmtIns = $pdo->prepare("
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
            $stmtIns->execute([
                ':id_cot'     => $idCotizacion,
                ':id_cli'     => (int)$cot['id_cliente'],
                ':id_usu'     => $idUsuarioSesion,
                ':fecha'      => $fechaEvento,
                ':h_ini'      => $horaInicio,
                ':h_fin'      => $horaFin,
                ':tipo'       => $cot['tipo_evento'],
                ':personas'   => (int)$cot['cantidad_personas'],
                ':colores'    => $cot['color_manteleria'],
                ':total'      => $totalAcordado,
                ':abonado'    => $montoAbonado,
                ':estado_res' => $estadoReserva,
                ':obs'        => $observaciones
            ]);

            $idReservaNueva = (int)$pdo->lastInsertId();

            // Actualizar estado de la cotización a 'Aprobada' y sincronizar fecha/hora
            $stmtUpCot = $pdo->prepare("
                UPDATE cotizaciones
                SET estado = 'Aprobada',
                    fecha_evento_propuesta = :fecha,
                    hora_inicio = :h_ini,
                    hora_fin = :h_fin
                WHERE id_cotizacion = :id_cot
            ");
            $stmtUpCot->execute([
                ':fecha'  => $fechaEvento,
                ':h_ini'  => $horaInicio,
                ':h_fin'  => $horaFin,
                ':id_cot' => $idCotizacion
            ]);

            $pdo->commit();

            $nombreCli = trim($cot['nombres'] . ' ' . $cot['apellidos']);
            registrarHistorialAccion(
                $pdo,
                'Reservas y Calendario',
                'CREAR_RESERVA_BLOQUEO',
                "Se agendó la Reserva #{$idReservaNueva} (Cotización #{$idCotizacion}) para el cliente «{$nombreCli}» en la fecha {$fechaEvento} ({$horaInicio}) con bloqueo automático. Estado: {$estadoReserva}, Total: \${$totalAcordado}, Abono: \${$montoAbonado}.",
                $idReservaNueva
            );

            jsonResponse([
                'success'    => true,
                'id_reserva' => $idReservaNueva,
                'mensaje'    => "Reserva #{$idReservaNueva} registrada exitosamente. La fecha {$fechaEvento} ha quedado bloqueada automáticamente en el calendario."
            ], 201);
        }

        // ---------------------------------------------------------------------
        // 2. ACTUALIZAR ESTADO, FECHA, HORARIO O ABONO DE UNA RESERVA
        // ---------------------------------------------------------------------
        if ($accion === 'actualizar_reserva') {
            $idReserva = (int)($payload['id_reserva'] ?? 0);
            if ($idReserva <= 0) {
                jsonResponse(['success' => false, 'error' => 'ID de reserva inválido.'], 422);
            }

            $stmtAct = $pdo->prepare("
                SELECT r.*, cli.nombres, cli.apellidos
                FROM reservas r
                INNER JOIN clientes cli ON r.id_cliente = cli.id_cliente
                WHERE r.id_reserva = :id
                LIMIT 1
            ");
            $stmtAct->execute([':id' => $idReserva]);
            $resActual = $stmtAct->fetch();

            if (!$resActual) {
                jsonResponse(['success' => false, 'error' => 'La reserva indicada no existe.'], 404);
            }

            $nuevoEstado = trim($payload['estado_reserva'] ?? $resActual['estado_reserva']);
            if (!in_array($nuevoEstado, ['Confirmado', 'En Proceso', 'Cancelado'], true)) {
                jsonResponse(['success' => false, 'error' => 'Estado de reserva no válido.'], 422);
            }

            $nuevaFecha = trim($payload['fecha_evento'] ?? $resActual['fecha_evento']);
            $nuevaHoraIni = trim($payload['hora_inicio'] ?? $resActual['hora_inicio']);
            if (strlen($nuevaHoraIni) === 5) $nuevaHoraIni .= ':00';

            $nuevoAbono = isset($payload['monto_abonado']) ? (float)$payload['monto_abonado'] : (float)$resActual['monto_abonado'];
            $totalAcordado = (float)$resActual['total_acordado'];
            if ($nuevoAbono < 0) $nuevoAbono = 0;
            if ($totalAcordado > 0 && $nuevoAbono > $totalAcordado) {
                $nuevoAbono = $totalAcordado;
            }

            $nuevasObs = trim($payload['observaciones'] ?? ($resActual['observaciones'] ?? ''));

            // Si el nuevo estado es activo (Confirmado o En Proceso), validar que no choque con otra reserva en esa fecha (RF06)
            if (in_array($nuevoEstado, ['Confirmado', 'En Proceso'], true)) {
                $stmtChoque = $pdo->prepare("
                    SELECT r.id_reserva, r.tipo_evento, cli.nombres, cli.apellidos
                    FROM reservas r
                    INNER JOIN clientes cli ON r.id_cliente = cli.id_cliente
                    WHERE r.fecha_evento = :fecha
                      AND r.estado_reserva IN ('Confirmado', 'En Proceso')
                      AND r.id_reserva != :id_actual
                    LIMIT 1
                ");
                $stmtChoque->execute([
                    ':fecha'     => $nuevaFecha,
                    ':id_actual' => $idReserva
                ]);
                $choque = $stmtChoque->fetch();

                if ($choque) {
                    $cliChoque = trim($choque['nombres'] . ' ' . $choque['apellidos']);
                    jsonResponse([
                        'success' => false,
                        'error'   => "BLOQUEO AUTOMÁTICO: No se puede asignar la fecha {$nuevaFecha} porque está bloqueada por la Reserva #{$choque['id_reserva']} ({$cliChoque})."
                    ], 409);
                }
            }

            $pdo->beginTransaction();

            $stmtUp = $pdo->prepare("
                UPDATE reservas
                SET fecha_evento = :fecha,
                    hora_inicio = :h_ini,
                    estado_reserva = :estado,
                    monto_abonado = :abono,
                    observaciones = :obs
                WHERE id_reserva = :id
            ");
            $stmtUp->execute([
                ':fecha'  => $nuevaFecha,
                ':h_ini'  => $nuevaHoraIni,
                ':estado' => $nuevoEstado,
                ':abono'  => $nuevoAbono,
                ':obs'    => $nuevasObs,
                ':id'     => $idReserva
            ]);

            // Si se cancela la reserva, actualizar cotización a Pendiente; si sigue activa, mantener Aprobada
            if (!empty($resActual['id_cotizacion'])) {
                $estadoCot = ($nuevoEstado === 'Cancelado') ? 'Pendiente' : 'Aprobada';
                $stmtUpCot = $pdo->prepare("UPDATE cotizaciones SET estado = :est, fecha_evento_propuesta = :fecha WHERE id_cotizacion = :id_cot");
                $stmtUpCot->execute([
                    ':est'    => $estadoCot,
                    ':fecha'  => $nuevaFecha,
                    ':id_cot' => (int)$resActual['id_cotizacion']
                ]);
            }

            $pdo->commit();

            $nombreCli = trim($resActual['nombres'] . ' ' . $resActual['apellidos']);
            $accionHist = ($nuevoEstado === 'Cancelado') ? 'CANCELAR_LIBERAR_FECHA' : 'ACTUALIZAR_RESERVA';
            registrarHistorialAccion(
                $pdo,
                'Reservas y Calendario',
                $accionHist,
                "Se actualizó la Reserva #{$idReserva} del cliente «{$nombreCli}» (Fecha: {$nuevaFecha}, Estado: {$nuevoEstado}, Abono: \${$nuevoAbono}).",
                $idReserva
            );

            jsonResponse([
                'success' => true,
                'mensaje' => ($nuevoEstado === 'Cancelado')
                    ? "Reserva #{$idReserva} cancelada. La fecha {$nuevaFecha} ha sido liberada automáticamente en el calendario."
                    : "Reserva #{$idReserva} actualizada exitosamente."
            ]);
        }

        // ---------------------------------------------------------------------
        // 3. ELIMINAR RESERVA (SUPER ADMINISTRADOR CON RESPALDO EN AUDITORÍA)
        // ---------------------------------------------------------------------
        if ($accion === 'eliminar_reserva') {
            $idReserva = (int)($payload['id_reserva'] ?? 0);
            if ($idReserva <= 0) {
                jsonResponse(['success' => false, 'error' => 'ID de reserva no válido.'], 422);
            }

            $stmtInfo = $pdo->prepare("
                SELECT r.*, cli.nombres, cli.apellidos, cli.cedula_ruc
                FROM reservas r
                LEFT JOIN clientes cli ON r.id_cliente = cli.id_cliente
                WHERE r.id_reserva = :id
                LIMIT 1
            ");
            $stmtInfo->execute([':id' => $idReserva]);
            $info = $stmtInfo->fetch();

            if (!$info) {
                jsonResponse(['success' => false, 'error' => 'La reserva no existe.'], 404);
            }

            $pdo->beginTransaction();

            $stmtDel = $pdo->prepare("DELETE FROM reservas WHERE id_reserva = :id");
            $stmtDel->execute([':id' => $idReserva]);

            // Devolver la cotización vinculada a estado 'Pendiente' para que pueda reutilizarse si se desea
            if (!empty($info['id_cotizacion'])) {
                $stmtResetCot = $pdo->prepare("UPDATE cotizaciones SET estado = 'Pendiente' WHERE id_cotizacion = :id_cot");
                $stmtResetCot->execute([':id_cot' => (int)$info['id_cotizacion']]);
            }

            $pdo->commit();

            $titular = trim(($info['nombres'] ?? '') . ' ' . ($info['apellidos'] ?? ''));
            registrarHistorialAccion(
                $pdo,
                'Reservas y Calendario',
                'ELIMINAR_RESERVA',
                "Super Administrador eliminó la Reserva #{$idReserva} del cliente «{$titular}» (Fecha liberada: {$info['fecha_evento']}, Evento: {$info['tipo_evento']}, Total: \${$info['total_acordado']}).",
                $idReserva
            );

            jsonResponse([
                'success' => true,
                'mensaje' => "Reserva #{$idReserva} eliminada y fecha {$info['fecha_evento']} liberada en el calendario. Acción registrada en la bitácora de auditoría."
            ]);
        }

        jsonResponse(['success' => false, 'error' => 'Acción no reconocida en reservas_api.php.'], 400);
    }

} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Error en reservas_api.php: " . $e->getMessage());
    jsonResponse([
        'success' => false,
        'error'   => 'Error interno en el servidor de reservas: ' . $e->getMessage()
    ], 500);
}
