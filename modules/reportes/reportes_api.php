<?php
/**
 * API REST: Módulo de Reportes, Métricas y KPIs (RF07) (Figura 7)
 * Plataforma Web Recepciones Mishell - Quito 2026
 *
 * Calcula en tiempo real desde MySQL:
 * - KPIs ejecutivos de facturación, efectividad comercial (conversión de cotizaciones a reservas),
 *   ocupación del salón principal, ticket promedio y cartera de clientes.
 * - Evolución mensual de facturación y eventos (Enero a Diciembre).
 * - Distribución de demanda por Tipo de Evento, Tarifa de Menú ($14 vs $16), Mantelería y Horas Extra.
 * - Ranking de Top Clientes frecuentes y tabla consolidada exportable/imprimible.
 * - Bitácora histórica de auditoría en BD (`historial_acciones`) para el Super Administrador.
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
$nombreUsuarioSesion = (string)($_SESSION['user_name'] ?? 'Super Administrador');
$rolUsuarioSesion = (string)($_SESSION['user_role'] ?? 'Administrador');

/**
 * Asegura la existencia de la tabla de auditoría histórica
 */
function ensureHistorialReportes(PDO $pdo): void {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `historial_acciones` (
          `id_historial` int(11) NOT NULL AUTO_INCREMENT,
          `id_usuario` int(11) NOT NULL,
          `usuario_nombre` varchar(100) NOT NULL,
          `modulo` varchar(50) NOT NULL,
          `accion` varchar(50) NOT NULL,
          `detalle` text NOT NULL,
          `id_referencia` int(11) DEFAULT NULL,
          `fecha_hora` datetime DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id_historial`),
          KEY `idx_usuario` (`id_usuario`),
          KEY `idx_modulo` (`modulo`),
          KEY `idx_fecha` (`fecha_hora`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
}

function registrarAuditoriaReportes(
    PDO $pdo,
    int $idUsuario,
    string $nombreUsuario,
    string $rolUsuario,
    string $accion,
    ?int $idAfectado,
    string $descripcion,
    $previos = null,
    $nuevos = null
): void {
    ensureHistorialReportes($pdo);
    $stmt = $pdo->prepare("
        INSERT INTO historial_acciones
            (id_usuario, usuario_nombre, modulo, accion, detalle, id_referencia)
        VALUES
            (:id_u, :nom_u, 'Reportes (RF07)', :accion, :desc, :id_reg)
    ");
    $stmt->execute([
        ':id_u'   => $idUsuario,
        ':nom_u'  => $nombreUsuario,
        ':accion' => $accion,
        ':desc'   => $descripcion,
        ':id_reg' => $idAfectado
    ]);
}

try {
    ensureHistorialReportes($pdo);

    if ($method === 'GET') {
        $accion = $_GET['action'] ?? 'dashboard';

        if ($accion === 'dashboard') {
            $anioFiltro = isset($_GET['anio']) && $_GET['anio'] !== 'Todos' ? (int)$_GET['anio'] : 0;
            $mesFiltro  = isset($_GET['mes']) ? (int)$_GET['mes'] : 0;
            $tipoFiltro = trim((string)($_GET['tipo_evento'] ?? 'Todos'));

            // Obtener todas las cotizaciones junto con su reserva vinculada (si existe) y datos del cliente
            $sqlCot = "
                SELECT 
                    c.id_cotizacion,
                    c.id_cliente,
                    c.id_usuario,
                    c.fecha_emision,
                    c.fecha_evento_propuesta,
                    TIME_FORMAT(c.hora_inicio, '%H:%i') AS hora_inicio_corta,
                    TIME_FORMAT(c.hora_fin, '%H:%i') AS hora_fin_corta,
                    c.cantidad_personas,
                    c.tipo_evento,
                    c.color_manteleria,
                    c.horas_evento,
                    c.horas_extra,
                    c.precio_plato,
                    c.subtotal_menu,
                    c.subtotal_horas_extra,
                    c.total_estimado,
                    c.estado AS estado_cotizacion,
                    cli.cedula_ruc,
                    cli.nombres,
                    cli.apellidos,
                    cli.telefono,
                    cli.correo,
                    r.id_reserva,
                    r.fecha_evento AS fecha_reserva_oficial,
                    r.estado_reserva,
                    COALESCE(r.total_acordado, c.total_estimado) AS monto_final_evento
                FROM cotizaciones c
                INNER JOIN clientes cli ON cli.id_cliente = c.id_cliente
                LEFT JOIN reservas r ON r.id_cotizacion = c.id_cotizacion AND r.estado_reserva != 'Cancelado'
                ORDER BY c.fecha_evento_propuesta DESC, c.id_cotizacion DESC
            ";
            $todasCotizaciones = $pdo->query($sqlCot)->fetchAll();

            // Filtrado dinámico en memoria para coherencia entre KPIs, gráficos y tabla
            $cotizacionesFiltradas = array_values(array_filter($todasCotizaciones, function ($row) use ($anioFiltro, $mesFiltro, $tipoFiltro) {
                $fechaRef = $row['fecha_reserva_oficial'] ?: $row['fecha_evento_propuesta'];
                if ($anioFiltro > 0 && strpos((string)$fechaRef, (string)$anioFiltro . '-') !== 0) {
                    return false;
                }
                if ($mesFiltro >= 1 && $mesFiltro <= 12) {
                    $partes = explode('-', (string)$fechaRef);
                    $mesRow = isset($partes[1]) ? (int)$partes[1] : 0;
                    if ($mesRow !== $mesFiltro) {
                        return false;
                    }
                }
                if ($tipoFiltro !== '' && $tipoFiltro !== 'Todos') {
                    if (stripos((string)($row['tipo_evento'] ?? ''), $tipoFiltro) === false) {
                        return false;
                    }
                }
                return true;
            }));

            // Consultar reservas totales (incluyendo canceladas para métricas de efectividad)
            $todasReservasRaw = $pdo->query("
                SELECT r.*, c.total_estimado, c.cantidad_personas, c.precio_plato, c.horas_extra
                FROM reservas r
                LEFT JOIN cotizaciones c ON c.id_cotizacion = r.id_cotizacion
                ORDER BY r.fecha_evento DESC
            ")->fetchAll();

            $reservasFiltradas = array_values(array_filter($todasReservasRaw, function ($r) use ($anioFiltro, $mesFiltro, $tipoFiltro) {
                $f = (string)$r['fecha_evento'];
                if ($anioFiltro > 0 && strpos($f, (string)$anioFiltro . '-') !== 0) {
                    return false;
                }
                if ($mesFiltro >= 1 && $mesFiltro <= 12) {
                    $partes = explode('-', $f);
                    $mesR = isset($partes[1]) ? (int)$partes[1] : 0;
                    if ($mesR !== $mesFiltro) {
                        return false;
                    }
                }
                if ($tipoFiltro !== '' && $tipoFiltro !== 'Todos') {
                    if (stripos((string)($r['tipo_evento'] ?? ''), $tipoFiltro) === false) {
                        return false;
                    }
                }
                return true;
            }));

            // 1. CÁLCULO DE KPIs EJECUTIVOS (RF07 - Figura 7)
            $totalCotizaciones = count($cotizacionesFiltradas);
            $cotAprobadas = 0;
            $cotPendientes = 0;
            $cotRechazadas = 0;
            $montoTotalCotizado = 0.0;
            $ingresosConfirmados = 0.0;
            $ingresosEnProceso = 0.0;
            $totalInvitadosReservados = 0;
            $totalInvitadosCotizados = 0;
            $eventosConLomo = 0;
            $eventosEstandar = 0;
            $montoMenuLomo = 0.0;
            $montoMenuEstandar = 0.0;
            $eventosConHorasExtra = 0;
            $totalHorasExtraSum = 0;
            $ingresosHorasExtraSum = 0.0;

            foreach ($cotizacionesFiltradas as $c) {
                $totEst = (float)$c['total_estimado'];
                $montoTotalCotizado += $totEst;
                $inv = (int)$c['cantidad_personas'];
                $totalInvitadosCotizados += $inv;

                $tieneReservaActiva = !empty($c['id_reserva']) && $c['estado_reserva'] !== 'Cancelado';
                if ($tieneReservaActiva || $c['estado_cotizacion'] === 'Aprobada') {
                    $cotAprobadas++;
                } elseif ($c['estado_cotizacion'] === 'Rechazada') {
                    $cotRechazadas++;
                } else {
                    $cotPendientes++;
                }

                if ((float)$c['precio_plato'] >= 15.50) {
                    $eventosConLomo++;
                    $montoMenuLomo += $totEst;
                } else {
                    $eventosEstandar++;
                    $montoMenuEstandar += $totEst;
                }

                $he = (int)$c['horas_extra'];
                if ($he > 0) {
                    $eventosConHorasExtra++;
                    $totalHorasExtraSum += $he;
                    $ingresosHorasExtraSum += (float)$c['subtotal_horas_extra'];
                }
            }

            $resConfirmadas = 0;
            $resEnProceso = 0;
            $resCanceladas = 0;
            foreach ($reservasFiltradas as $r) {
                $montoR = (float)($r['total_acordado'] ?? $r['total_estimado'] ?? 0);
                if ($r['estado_reserva'] === 'Confirmado') {
                    $resConfirmadas++;
                    $ingresosConfirmados += $montoR;
                    $totalInvitadosReservados += (int)($r['cantidad_personas'] ?? 0);
                } elseif ($r['estado_reserva'] === 'En Proceso') {
                    $resEnProceso++;
                    $ingresosEnProceso += $montoR;
                    $totalInvitadosReservados += (int)($r['cantidad_personas'] ?? 0);
                } else {
                    $resCanceladas++;
                }
            }

            $reservasActivasTotal = $resConfirmadas + $resEnProceso;
            $ingresosTotalescomprometidos = $ingresosConfirmados + $ingresosEnProceso;

            $tasaConversion = $totalCotizaciones > 0
                ? round(($cotAprobadas / $totalCotizaciones) * 100, 1)
                : 0.0;

            $ticketPromedio = $reservasActivasTotal > 0
                ? round($ingresosTotalescomprometidos / $reservasActivasTotal, 2)
                : ($totalCotizaciones > 0 ? round($montoTotalCotizado / $totalCotizaciones, 2) : 0.0);

            $promedioInvitados = $reservasActivasTotal > 0
                ? (int)round($totalInvitadosReservados / $reservasActivasTotal)
                : ($totalCotizaciones > 0 ? (int)round($totalInvitadosCotizados / $totalCotizaciones) : 0);

            // Capacidad operativa de referencia (8 fechas prime de fin de semana por mes)
            $fechasMetaPeriodo = ($mesFiltro >= 1 && $mesFiltro <= 12) ? 8 : 36;
            $tasaOcupacionSalon = min(100.0, round(($reservasActivasTotal / max(1, $fechasMetaPeriodo)) * 100, 1));

            // Cartera de clientes y fidelización
            $totalClientes = (int)$pdo->query("SELECT COUNT(*) FROM clientes")->fetchColumn();
            $clientesFrecuentes = (int)$pdo->query("
                SELECT COUNT(*) FROM (
                    SELECT id_cliente FROM cotizaciones GROUP BY id_cliente HAVING COUNT(*) >= 2
                ) AS sub
            ")->fetchColumn();

            // 2. EVOLUCIÓN MENSUAL (ENERO A DICIEMBRE DEL AÑO SELECCIONADO O ACTUAL)
            $anioGrafico = $anioFiltro > 0 ? $anioFiltro : (int)date('Y');
            $nombresMeses = [
                1 => ['Enero', 'Ene'], 2 => ['Febrero', 'Feb'], 3 => ['Marzo', 'Mar'],
                4 => ['Abril', 'Abr'], 5 => ['Mayo', 'May'], 6 => ['Junio', 'Jun'],
                7 => ['Julio', 'Jul'], 8 => ['Agosto', 'Ago'], 9 => ['Septiembre', 'Sep'],
                10 => ['Octubre', 'Oct'], 11 => ['Noviembre', 'Nov'], 12 => ['Diciembre', 'Dic']
            ];

            $evolucionMensual = [];
            for ($m = 1; $m <= 12; $m++) {
                $evolucionMensual[$m] = [
                    'mes_num'             => $m,
                    'mes_nombre'          => $nombresMeses[$m][0],
                    'mes_corto'           => $nombresMeses[$m][1],
                    'total_cotizaciones'  => 0,
                    'monto_cotizado'      => 0.0,
                    'total_reservas'      => 0,
                    'ingresos_reservados' => 0.0,
                    'invitados_mes'       => 0
                ];
            }

            foreach ($todasCotizaciones as $c) {
                $fRef = (string)($c['fecha_reserva_oficial'] ?: $c['fecha_evento_propuesta']);
                if (strpos($fRef, (string)$anioGrafico . '-') !== 0) {
                    continue;
                }
                if ($tipoFiltro !== '' && $tipoFiltro !== 'Todos' && stripos((string)($c['tipo_evento'] ?? ''), $tipoFiltro) === false) {
                    continue;
                }
                $partes = explode('-', $fRef);
                $mNum = isset($partes[1]) ? (int)$partes[1] : 0;
                if ($mNum >= 1 && $mNum <= 12) {
                    $evolucionMensual[$mNum]['total_cotizaciones']++;
                    $evolucionMensual[$mNum]['monto_cotizado'] += (float)$c['total_estimado'];
                    if (!empty($c['id_reserva']) && $c['estado_reserva'] !== 'Cancelado') {
                        $evolucionMensual[$mNum]['total_reservas']++;
                        $evolucionMensual[$mNum]['ingresos_reservados'] += (float)$c['monto_final_evento'];
                        $evolucionMensual[$mNum]['invitados_mes'] += (int)$c['cantidad_personas'];
                    }
                }
            }

            // 3. DISTRIBUCIÓN POR TIPO DE EVENTO (RF03 / RF07)
            $mapaTipos = [];
            foreach ($cotizacionesFiltradas as $c) {
                $tiposRaw = explode(',', (string)($c['tipo_evento'] ?: 'Recepción Social'));
                $tipoPrincipal = trim($tiposRaw[0]) ?: 'Recepción Social';
                if (!isset($mapaTipos[$tipoPrincipal])) {
                    $mapaTipos[$tipoPrincipal] = [
                        'tipo_evento'   => $tipoPrincipal,
                        'cotizaciones'  => 0,
                        'reservas'      => 0,
                        'monto_cotizado'=> 0.0,
                        'ingresos_res'  => 0.0,
                        'invitados'     => 0
                    ];
                }
                $mapaTipos[$tipoPrincipal]['cotizaciones']++;
                $mapaTipos[$tipoPrincipal]['monto_cotizado'] += (float)$c['total_estimado'];
                $mapaTipos[$tipoPrincipal]['invitados'] += (int)$c['cantidad_personas'];

                if (!empty($c['id_reserva']) && $c['estado_reserva'] !== 'Cancelado') {
                    $mapaTipos[$tipoPrincipal]['reservas']++;
                    $mapaTipos[$tipoPrincipal]['ingresos_res'] += (float)$c['monto_final_evento'];
                }
            }

            usort($mapaTipos, fn($a, $b) => $b['monto_cotizado'] <=> $a['monto_cotizado']);
            foreach ($mapaTipos as &$itemT) {
                $itemT['porcentaje'] = $totalCotizaciones > 0
                    ? round(($itemT['cotizaciones'] / $totalCotizaciones) * 100, 1)
                    : 0.0;
            }
            unset($itemT);

            // 4. PREFERENCIAS DE MANTELERÍA Y LAZOS DECORATIVOS
            $mapaColores = [];
            foreach ($cotizacionesFiltradas as $c) {
                $col = trim((string)($c['color_manteleria'] ?: 'Dorado'));
                if (!isset($mapaColores[$col])) {
                    $mapaColores[$col] = ['color' => $col, 'cantidad' => 0];
                }
                $mapaColores[$col]['cantidad']++;
            }
            $listaColores = array_values($mapaColores);
            usort($listaColores, fn($a, $b) => $b['cantidad'] <=> $a['cantidad']);
            foreach ($listaColores as &$itemCol) {
                $itemCol['porcentaje'] = $totalCotizaciones > 0
                    ? round(($itemCol['cantidad'] / $totalCotizaciones) * 100, 1)
                    : 0.0;
            }
            unset($itemCol);

            // 5. TOP CLIENTES POR VOLUMEN CONTRATADO Y FIDELIDAD
            $sqlTopCli = "
                SELECT 
                    cli.id_cliente,
                    cli.cedula_ruc,
                    cli.nombres,
                    cli.apellidos,
                    cli.telefono,
                    cli.correo,
                    COUNT(DISTINCT c.id_cotizacion) AS total_cotizaciones,
                    COUNT(DISTINCT CASE WHEN r.estado_reserva IN ('Confirmado','En Proceso') THEN r.id_reserva END) AS total_reservas,
                    COALESCE(SUM(c.total_estimado), 0) AS monto_cotizado,
                    COALESCE(SUM(CASE WHEN r.estado_reserva IN ('Confirmado','En Proceso') THEN COALESCE(r.total_acordado, c.total_estimado) ELSE 0 END), 0) AS monto_reservado
                FROM clientes cli
                LEFT JOIN cotizaciones c ON c.id_cliente = cli.id_cliente
                LEFT JOIN reservas r ON r.id_cotizacion = c.id_cotizacion
                GROUP BY cli.id_cliente
                ORDER BY monto_reservado DESC, monto_cotizado DESC, total_cotizaciones DESC
                LIMIT 8
            ";
            $topClientes = $pdo->query($sqlTopCli)->fetchAll();

            // 6. BITÁCORA HISTÓRICA DE AUDITORÍA (Super Administrador)
            $stmtAud = $pdo->query("
                SELECT 
                    id_historial,
                    usuario_nombre AS nombre_usuario,
                    'Super Administrador' AS rol_usuario,
                    modulo,
                    accion,
                    id_referencia AS id_registro_afectado,
                    detalle AS descripcion,
                    fecha_hora,
                    '127.0.0.1' AS ip_cliente
                FROM historial_acciones
                ORDER BY id_historial DESC
                LIMIT 35
            ");
            $historialAuditoria = $stmtAud->fetchAll();

            jsonResponse([
                'success'     => true,
                'rol_usuario' => $rolUsuarioSesion,
                'filtros_aplicados' => [
                    'anio'        => $anioFiltro > 0 ? $anioFiltro : 'Todos',
                    'anio_grafico'=> $anioGrafico,
                    'mes'         => $mesFiltro,
                    'tipo_evento' => $tipoFiltro
                ],
                'kpis' => [
                    'ingresos_confirmados'      => round($ingresosConfirmados, 2),
                    'ingresos_en_proceso'       => round($ingresosEnProceso, 2),
                    'ingresos_comprometidos'    => round($ingresosTotalescomprometidos, 2),
                    'monto_total_cotizado'      => round($montoTotalCotizado, 2),
                    'ticket_promedio'           => $ticketPromedio,
                    'total_cotizaciones'        => $totalCotizaciones,
                    'cotizaciones_aprobadas'    => $cotAprobadas,
                    'cotizaciones_pendientes'   => $cotPendientes,
                    'cotizaciones_rechazadas'   => $cotRechazadas,
                    'tasa_conversion'           => $tasaConversion,
                    'reservas_activas'          => $reservasActivasTotal,
                    'reservas_confirmadas'      => $resConfirmadas,
                    'reservas_en_proceso'       => $resEnProceso,
                    'reservas_canceladas'       => $resCanceladas,
                    'total_invitados_reservados'=> $totalInvitadosReservados,
                    'total_invitados_cotizados' => $totalInvitadosCotizados,
                    'promedio_invitados'        => $promedioInvitados,
                    'tasa_ocupacion_salon'      => $tasaOcupacionSalon,
                    'total_clientes'            => $totalClientes,
                    'clientes_frecuentes'       => $clientesFrecuentes
                ],
                'evolucion_mensual' => array_values($evolucionMensual),
                'por_tipo_evento'   => $mapaTipos,
                'preferencias_catalogo' => [
                    'tarifas_menu' => [
                        'estandar_14'     => $eventosEstandar,
                        'especial_16'     => $eventosConLomo,
                        'monto_estandar'  => round($montoMenuEstandar, 2),
                        'monto_especial'  => round($montoMenuLomo, 2),
                        'pct_especial'    => $totalCotizaciones > 0 ? round(($eventosConLomo / $totalCotizaciones) * 100, 1) : 0.0,
                        'pct_estandar'    => $totalCotizaciones > 0 ? round(($eventosEstandar / $totalCotizaciones) * 100, 1) : 0.0
                    ],
                    'colores_manteleria' => $listaColores,
                    'horas_extra_stats'  => [
                        'eventos_con_extra' => $eventosConHorasExtra,
                        'eventos_sin_extra' => max(0, $totalCotizaciones - $eventosConHorasExtra),
                        'total_horas_extra' => $totalHorasExtraSum,
                        'ingresos_extra'    => round($ingresosHorasExtraSum, 2)
                    ]
                ],
                'top_clientes'        => $topClientes,
                'detalle_eventos'     => $cotizacionesFiltradas,
                'historial_auditoria' => $historialAuditoria
            ]);
        }

        jsonResponse(['success' => false, 'error' => 'Acción GET no reconocida en reportes_api.'], 400);
    }

    // -------------------------------------------------------------
    // POST: Acciones Administrativas y Registro de Exportación (Super Admin)
    // -------------------------------------------------------------
    if ($method === 'POST') {
        $rawBody = file_get_contents('php://input');
        $data = json_decode($rawBody ?: '{}', true);
        if (!is_array($data)) {
            $data = $_POST;
        }

        $accion = $data['action'] ?? '';

        if ($accion === 'registrar_exportacion') {
            $formato = trim((string)($data['formato'] ?? 'CSV/Impresión'));
            $detalleFiltro = trim((string)($data['filtro'] ?? 'General'));

            registrarAuditoriaReportes(
                $pdo,
                $idUsuarioSesion,
                $nombreUsuarioSesion,
                $rolUsuarioSesion,
                'EXPORTAR_REPORTE',
                null,
                "Generación/exportación de Reporte Gerencial RF07 en formato {$formato} (Filtro: {$detalleFiltro})"
            );

            jsonResponse([
                'success' => true,
                'mensaje' => 'Exportación registrada en la bitácora de auditoría.'
            ]);
        }

        if ($accion === 'registrar_nota_auditoria') {
            if ($rolUsuarioSesion !== 'Administrador') {
                jsonResponse(['success' => false, 'error' => 'Acción reservada para el Super Administrador.'], 403);
            }
            $nota = trim((string)($data['nota'] ?? ''));
            if ($nota === '') {
                jsonResponse(['success' => false, 'error' => 'Ingrese una observación para registrar en la bitácora.'], 400);
            }

            registrarAuditoriaReportes(
                $pdo,
                $idUsuarioSesion,
                $nombreUsuarioSesion,
                $rolUsuarioSesion,
                'CONTROL_GERENCIAL',
                null,
                "Observación gerencial de Super Administrador: {$nota}"
            );

            jsonResponse([
                'success' => true,
                'mensaje' => 'Registro de control gerencial guardado en la bitácora histórica.'
            ]);
        }

        jsonResponse(['success' => false, 'error' => 'Acción POST no válida en reportes_api.'], 400);
    }

    jsonResponse(['success' => false, 'error' => 'Método HTTP no soportado.'], 405);

} catch (Throwable $e) {
    error_log("[Reportes API Error] " . $e->getMessage());
    jsonResponse([
        'success' => false,
        'error'   => 'Error interno en el módulo de reportes RF07: ' . $e->getMessage()
    ], 500);
}
