<?php
/**
 * API REST: Módulo de Servicios y Catálogo de Eventos (RF03) + Administración Super Admin
 * Plataforma Web Recepciones Mishell - Quito 2026
 * 
 * Expone y permite administrar el catálogo de servicios, tarifas de banquete,
 * servicios incluidos, tipos de evento, mantelería y opciones de menú de buffet,
 * registrando cada acción en la tabla de auditoría historial_acciones.
 * Cumple con RNF04 (Seguridad / PDO preparado) y RNF05 (Integridad e Histórico).
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

/**
 * Helper para resolver el código hexadecimal de un color de mantelería
 */
function resolverColorHex(string $nombreColor, string $descripcion = ''): array {
    // Si la descripción contiene un código hex explícito (#RRGGBB), usarlo
    if (preg_match('/#([A-Fa-f0-9]{6})/', $descripcion, $matches)) {
        $hex = '#' . strtoupper($matches[1]);
        return [
            'color_hex'  => $hex,
            'bg_preview' => $hex . '20',
            'border'     => $hex
        ];
    }

    $mapaColores = [
        'rosado'   => ['color_hex' => '#EC4899', 'bg_preview' => '#FCE7F3', 'border' => '#F472B6'],
        'lila'     => ['color_hex' => '#A855F7', 'bg_preview' => '#F3E8FF', 'border' => '#C084FC'],
        'dorado'   => ['color_hex' => '#D4AF37', 'bg_preview' => '#FEF3C7', 'border' => '#F59E0B'],
        'fucsia'   => ['color_hex' => '#BE185D', 'bg_preview' => '#FDF2F8', 'border' => '#DB2777'],
        'azul'     => ['color_hex' => '#1D4ED8', 'bg_preview' => '#EFF6FF', 'border' => '#3B82F6'],
        'rojo'     => ['color_hex' => '#DC2626', 'bg_preview' => '#FEE2E2', 'border' => '#EF4444'],
        'verde'    => ['color_hex' => '#059669', 'bg_preview' => '#D1FAE5', 'border' => '#10B981'],
        'plateado' => ['color_hex' => '#64748B', 'bg_preview' => '#F1F5F9', 'border' => '#94A3B8'],
        'turquesa' => ['color_hex' => '#0D9488', 'bg_preview' => '#CCFBF1', 'border' => '#14B8A6'],
        'vino'     => ['color_hex' => '#881337', 'bg_preview' => '#FFE4E6', 'border' => '#BE123C'],
        'champagne'=> ['color_hex' => '#D97706', 'bg_preview' => '#FEF3C7', 'border' => '#FBBF24'],
        'coral'    => ['color_hex' => '#F97316', 'bg_preview' => '#FFEDD5', 'border' => '#FB923C'],
        'negro'    => ['color_hex' => '#1E293B', 'bg_preview' => '#F1F5F9', 'border' => '#475569'],
        'blanco'   => ['color_hex' => '#94A3B8', 'bg_preview' => '#F8FAFC', 'border' => '#CBD5E1']
    ];

    $clave = mb_strtolower(trim($nombreColor), 'UTF-8');
    foreach ($mapaColores as $k => $info) {
        if (mb_strpos($clave, $k) !== false) {
            return $info;
        }
    }

    return [
        'color_hex'  => '#C86D3B',
        'bg_preview' => '#FDF3EC',
        'border'     => '#E68545'
    ];
}

try {
    // =========================================================================
    // GET: Consultar Catálogo o Historial de Auditoría
    // =========================================================================
    if ($method === 'GET') {
        $accion = $_GET['action'] ?? 'catalogo_completo';

        // 1. Catálogo Estructurado para el Cotizador Inteligente (Figuras 9 y 10)
        if ($accion === 'catalogo_completo') {
            $stmt = $pdo->query("
                SELECT id_servicio, nombre_servicio, descripcion, precio_referencial, categoria, estado
                FROM servicios
                WHERE estado = 1
                ORDER BY id_servicio ASC
            ");
            $todos = $stmt->fetchAll();

            // Tarifas base desde la BD si existen
            $platoEstandar = 14.00;
            $platoConLomo  = 16.00;
            $horaExtraPrecio = 80.00;

            $catalogo = [
                'tarifas' => [
                    'plato_estandar' => $platoEstandar,
                    'plato_con_lomo' => $platoConLomo,
                    'hora_extra'     => $horaExtraPrecio,
                    'max_personas'   => 120,
                    'max_horas_extra'=> 5,
                    'max_horas_base' => 6
                ],
                'servicios_incluidos' => [],
                'tipos_evento'        => [],
                'tipos_evento_items'  => [],
                'colores_manteleria'  => [],
                'menu' => [
                    'carnes' => [
                        'chuletas' => [
                            'titulo'       => 'Chuletas',
                            'categoria_bd' => 'Carne - Chuletas',
                            'max_opciones' => 2,
                            'items'        => []
                        ],
                        'pollos' => [
                            'titulo'       => 'Pollos',
                            'categoria_bd' => 'Carne - Pollos',
                            'max_opciones' => 2,
                            'items'        => []
                        ],
                        'medallones' => [
                            'titulo'       => 'Medallones',
                            'categoria_bd' => 'Carne - Medallones',
                            'max_opciones' => 2,
                            'items'        => []
                        ],
                        'lomos' => [
                            'titulo'       => 'Lomos (Tarifa $16.00)',
                            'categoria_bd' => 'Carne - Lomos',
                            'es_lomo'      => true,
                            'max_opciones' => 2,
                            'items'        => []
                        ]
                    ],
                    'arroces' => [
                        'titulo'       => 'Arroz (Seleccione 1 opción)',
                        'categoria_bd' => 'Arroz',
                        'items'        => []
                    ],
                    'ensaladas' => [
                        'titulo'       => 'Ensalada (Seleccione 1 opción)',
                        'categoria_bd' => 'Ensalada',
                        'items'        => []
                    ],
                    'papas' => [
                        'titulo'       => 'Papas (Seleccione 1 opción)',
                        'categoria_bd' => 'Papas',
                        'items'        => []
                    ],
                    'arreglos_frutales' => [
                        'titulo'       => 'Arreglos Frutales (Seleccione 1 opción)',
                        'categoria_bd' => 'Arreglo Frutal',
                        'items'        => []
                    ]
                ]
            ];

            foreach ($todos as $s) {
                $cat = $s['categoria'];
                $nombre = $s['nombre_servicio'];
                $desc = (string)($s['descripcion'] ?? '');
                $id = (int)$s['id_servicio'];
                $precio = (float)$s['precio_referencial'];

                $itemObj = [
                    'id_servicio' => $id,
                    'nombre'      => $nombre,
                    'descripcion' => $desc,
                    'precio'      => $precio,
                    'categoria'   => $cat
                ];

                if ($cat === 'Tarifa Base') {
                    if (stripos($nombre, 'Lomo') !== false || stripos($nombre, 'Especial') !== false) {
                        $catalogo['tarifas']['plato_con_lomo'] = $precio > 0 ? $precio : 16.00;
                    } else {
                        $catalogo['tarifas']['plato_estandar'] = $precio > 0 ? $precio : 14.00;
                    }
                } elseif ($cat === 'Hora Extra') {
                    $catalogo['tarifas']['hora_extra'] = $precio > 0 ? $precio : 80.00;
                } elseif ($cat === 'Servicio Incluido') {
                    $catalogo['servicios_incluidos'][] = $itemObj;
                } elseif ($cat === 'Tipo Evento') {
                    $catalogo['tipos_evento'][] = $nombre;
                    $catalogo['tipos_evento_items'][] = $itemObj;
                } elseif ($cat === 'Color Mantelería') {
                    $nombreLimpioColor = trim(str_ireplace('Lazos y Cubre Manteles', '', $nombre));
                    if ($nombreLimpioColor === '') {
                        $nombreLimpioColor = $nombre;
                    }
                    $colorEstilos = resolverColorHex($nombreLimpioColor, $desc);
                    $catalogo['colores_manteleria'][] = [
                        'id_servicio' => $id,
                        'id'          => $nombreLimpioColor,
                        'nombre'      => $nombreLimpioColor,
                        'nombre_bd'   => $nombre,
                        'descripcion' => $desc,
                        'color_hex'   => $colorEstilos['color_hex'],
                        'bg_preview'  => $colorEstilos['bg_preview'],
                        'border'      => $colorEstilos['border']
                    ];
                } elseif ($cat === 'Carne - Chuletas') {
                    $itemObj['nombre_limpio'] = trim(preg_replace('/^Chuletas?:\s*/i', '', $nombre));
                    $catalogo['menu']['carnes']['chuletas']['items'][] = $itemObj;
                } elseif ($cat === 'Carne - Pollos') {
                    $itemObj['nombre_limpio'] = trim(preg_replace('/^Pollos?:\s*/i', '', $nombre));
                    $catalogo['menu']['carnes']['pollos']['items'][] = $itemObj;
                } elseif ($cat === 'Carne - Medallones') {
                    $itemObj['nombre_limpio'] = trim(preg_replace('/^Medall(ó|o)n(es)?:\s*/i', '', $nombre));
                    $catalogo['menu']['carnes']['medallones']['items'][] = $itemObj;
                } elseif ($cat === 'Carne - Lomos') {
                    $itemObj['nombre_limpio'] = trim(preg_replace('/^Lomos?:\s*/i', '', $nombre));
                    $itemObj['es_lomo'] = true;
                    $catalogo['menu']['carnes']['lomos']['items'][] = $itemObj;
                } elseif ($cat === 'Arroz') {
                    $itemObj['nombre_limpio'] = trim(preg_replace('/^Arroz\s+/i', '', $nombre));
                    $catalogo['menu']['arroces']['items'][] = $itemObj;
                } elseif ($cat === 'Ensalada') {
                    $itemObj['nombre_limpio'] = $nombre;
                    $catalogo['menu']['ensaladas']['items'][] = $itemObj;
                } elseif ($cat === 'Papas') {
                    $itemObj['nombre_limpio'] = trim(preg_replace('/^Papas:\s*/i', '', $nombre));
                    $catalogo['menu']['papas']['items'][] = $itemObj;
                } elseif ($cat === 'Arreglo Frutal') {
                    $itemObj['nombre_limpio'] = trim(preg_replace('/^Arreglo Frutal:\s*/i', '', $nombre));
                    $catalogo['menu']['arreglos_frutales']['items'][] = $itemObj;
                }
            }

            jsonResponse([
                'success'  => true,
                'catalogo' => $catalogo,
                'rol_usuario' => $_SESSION['rol'] ?? 'Administrador'
            ]);
        }

        // 2. Historial de Acciones Administrativas y Registros Eliminados (Auditoría BD)
        if ($accion === 'historial') {
            // Asegurar que la tabla historial_acciones exista
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

            $stmtHist = $pdo->query("
                SELECT id_historial, id_usuario, usuario_nombre, modulo, accion, detalle, id_referencia, fecha_hora
                FROM historial_acciones
                ORDER BY id_historial DESC
                LIMIT 100
            ");
            $historial = $stmtHist->fetchAll();

            $stmtInactivos = $pdo->query("
                SELECT id_servicio, nombre_servicio, descripcion, categoria, precio_referencial
                FROM servicios
                WHERE estado = 0
                ORDER BY id_servicio DESC
            ");
            $eliminados = $stmtInactivos->fetchAll();

            jsonResponse([
                'success'             => true,
                'historial'           => $historial,
                'servicios_inactivos' => $eliminados
            ]);
        }

        // 3. Listado plano de la tabla servicios
        if ($accion === 'listar') {
            $stmt = $pdo->query("SELECT * FROM servicios WHERE estado = 1 ORDER BY categoria, nombre_servicio");
            jsonResponse([
                'success'   => true,
                'servicios' => $stmt->fetchAll()
            ]);
        }

        jsonResponse(['success' => false, 'error' => 'Acción no válida'], 400);
    }

    // =========================================================================
    // POST: Administración del Catálogo por el Super Administrador (Aumentar / Eliminar)
    // =========================================================================
    if ($method === 'POST') {
        $rawInput = file_get_contents('php://input');
        $payload = json_decode($rawInput, true) ?? $_POST;
        $accion = $payload['action'] ?? '';

        // 1. AGREGAR NUEVO REGISTRO AL CATÁLOGO (Servicios, Tipos de Evento, Mantelería, Carnes, Guarniciones)
        if ($accion === 'crear_item') {
            $categoria = trim((string)($payload['categoria'] ?? ''));
            $nombreRaw = trim((string)($payload['nombre'] ?? ''));
            $descripcion = trim((string)($payload['descripcion'] ?? ''));
            $colorHex = trim((string)($payload['color_hex'] ?? ''));
            $precio = (float)($payload['precio'] ?? 0.00);

            if ($categoria === '' || $nombreRaw === '') {
                jsonResponse([
                    'success' => false,
                    'error'   => 'El nombre y la categoría del registro son obligatorios.'
                ], 400);
            }

            // Formatear el nombre oficial según la categoría para mantener consistencia en la BD
            $nombreFinal = $nombreRaw;
            if ($categoria === 'Color Mantelería') {
                if (stripos($nombreRaw, 'Lazos y Cubre Manteles') === false) {
                    $nombreFinal = 'Lazos y Cubre Manteles ' . $nombreRaw;
                }
                if ($colorHex !== '' && strpos($descripcion, $colorHex) === false) {
                    $descripcion = ($descripcion !== '' ? $descripcion . ' ' : 'Decoración para lazos y cubremanteles ') . "({$colorHex})";
                }
            } elseif ($categoria === 'Carne - Chuletas' && stripos($nombreRaw, 'Chuleta:') === false) {
                $nombreFinal = 'Chuleta: ' . $nombreRaw;
            } elseif ($categoria === 'Carne - Pollos' && stripos($nombreRaw, 'Pollo:') === false) {
                $nombreFinal = 'Pollo: ' . $nombreRaw;
            } elseif ($categoria === 'Carne - Medallones' && stripos($nombreRaw, 'Medallón:') === false && stripos($nombreRaw, 'Medallon:') === false) {
                $nombreFinal = 'Medallón: ' . $nombreRaw;
            } elseif ($categoria === 'Carne - Lomos' && stripos($nombreRaw, 'Lomo:') === false) {
                $nombreFinal = 'Lomo: ' . $nombreRaw;
            } elseif ($categoria === 'Arroz' && stripos($nombreRaw, 'Arroz') !== 0) {
                $nombreFinal = 'Arroz ' . $nombreRaw;
            } elseif ($categoria === 'Ensalada' && stripos($nombreRaw, 'Ensalada') !== 0) {
                $nombreFinal = 'Ensalada ' . $nombreRaw;
                if ($descripcion !== '' && strpos($nombreFinal, '(') === false) {
                    $nombreFinal .= ' (' . $descripcion . ')';
                }
            } elseif ($categoria === 'Papas' && stripos($nombreRaw, 'Papas:') === false) {
                $nombreFinal = 'Papas: ' . $nombreRaw;
            } elseif ($categoria === 'Arreglo Frutal' && stripos($nombreRaw, 'Arreglo Frutal:') === false) {
                $nombreFinal = 'Arreglo Frutal: ' . $nombreRaw;
            }

            if ($descripcion === '') {
                $descripcion = "Opción registrada por Super Administrador en {$categoria}: {$nombreRaw}.";
            }

            // Verificar si ya existe en la misma categoría
            $stmtCheck = $pdo->prepare("
                SELECT id_servicio, estado 
                FROM servicios 
                WHERE LOWER(nombre_servicio) = LOWER(:nombre) AND categoria = :cat
                LIMIT 1
            ");
            $stmtCheck->execute([':nombre' => $nombreFinal, ':cat' => $categoria]);
            $existente = $stmtCheck->fetch();

            if ($existente) {
                if ((int)$existente['estado'] === 1) {
                    jsonResponse([
                        'success' => false,
                        'error'   => "El registro «{$nombreRaw}» ya se encuentra activo en la categoría {$categoria}."
                    ], 409);
                } else {
                    // Reactivar si estaba dado de baja lógica
                    $idReactivado = (int)$existente['id_servicio'];
                    $stmtUp = $pdo->prepare("
                        UPDATE servicios 
                        SET estado = 1, descripcion = :desc, precio_referencial = :precio 
                        WHERE id_servicio = :id
                    ");
                    $stmtUp->execute([
                        ':desc'   => $descripcion,
                        ':precio' => $precio,
                        ':id'     => $idReactivado
                    ]);

                    registrarHistorialAccion(
                        $pdo,
                        'Cotizador / Catálogo RF03',
                        'REACTIVAR_REGISTRO',
                        "Se reactivó el registro «{$nombreFinal}» en la sección «{$categoria}» (ID #{$idReactivado}).",
                        $idReactivado
                    );

                    jsonResponse([
                        'success'     => true,
                        'mensaje'     => "Registro «{$nombreRaw}» habilitado nuevamente y guardado en el historial.",
                        'id_servicio' => $idReactivado,
                        'nombre'      => $nombreFinal
                    ]);
                }
            }

            $stmtIns = $pdo->prepare("
                INSERT INTO servicios (nombre_servicio, descripcion, precio_referencial, categoria, estado)
                VALUES (:nombre, :desc, :precio, :cat, 1)
            ");
            $stmtIns->execute([
                ':nombre' => $nombreFinal,
                ':desc'   => $descripcion,
                ':precio' => $precio,
                ':cat'    => $categoria
            ]);

            $nuevoId = (int)$pdo->lastInsertId();

            registrarHistorialAccion(
                $pdo,
                'Cotizador / Catálogo RF03',
                'AGREGAR_REGISTRO',
                "Super Administrador agregó «{$nombreFinal}» en la categoría «{$categoria}» (ID #{$nuevoId}).",
                $nuevoId
            );

            jsonResponse([
                'success'     => true,
                'mensaje'     => "Registro «{$nombreRaw}» agregado exitosamente y registrado en el historial de base de datos.",
                'id_servicio' => $nuevoId,
                'nombre'      => $nombreFinal
            ], 201);
        }

        // 2. ELIMINAR REGISTRO DEL CATÁLOGO (Baja lógica con preservación histórica + Auditoría)
        if ($accion === 'eliminar_item') {
            $idServicio = (int)($payload['id_servicio'] ?? 0);
            if ($idServicio <= 0) {
                jsonResponse(['success' => false, 'error' => 'Identificador de registro no válido.'], 400);
            }

            $stmtItem = $pdo->prepare("SELECT id_servicio, nombre_servicio, categoria, estado FROM servicios WHERE id_servicio = :id LIMIT 1");
            $stmtItem->execute([':id' => $idServicio]);
            $item = $stmtItem->fetch();

            if (!$item) {
                jsonResponse(['success' => false, 'error' => 'El registro solicitado no existe en la base de datos.'], 404);
            }

            // Baja lógica (estado = 0) para mantener la integridad referencial e histórico en la BD
            $stmtDel = $pdo->prepare("UPDATE servicios SET estado = 0 WHERE id_servicio = :id");
            $stmtDel->execute([':id' => $idServicio]);

            registrarHistorialAccion(
                $pdo,
                'Cotizador / Catálogo RF03',
                'ELIMINAR_REGISTRO',
                "Super Administrador eliminó «{$item['nombre_servicio']}» de la categoría «{$item['categoria']}» (ID #{$idServicio}).",
                $idServicio
            );

            jsonResponse([
                'success' => true,
                'mensaje' => "Registro «{$item['nombre_servicio']}» eliminado de la vista activa y respaldado en el histórico de auditoría."
            ]);
        }

        // 3. RESTAURAR REGISTRO DESDE EL HISTORIAL
        if ($accion === 'restaurar_item') {
            $idServicio = (int)($payload['id_servicio'] ?? 0);
            if ($idServicio <= 0) {
                jsonResponse(['success' => false, 'error' => 'ID de servicio no válido.'], 400);
            }

            $stmtItem = $pdo->prepare("SELECT id_servicio, nombre_servicio, categoria FROM servicios WHERE id_servicio = :id LIMIT 1");
            $stmtItem->execute([':id' => $idServicio]);
            $item = $stmtItem->fetch();

            if (!$item) {
                jsonResponse(['success' => false, 'error' => 'El registro no existe.'], 404);
            }

            $stmtRes = $pdo->prepare("UPDATE servicios SET estado = 1 WHERE id_servicio = :id");
            $stmtRes->execute([':id' => $idServicio]);

            registrarHistorialAccion(
                $pdo,
                'Cotizador / Catálogo RF03',
                'RESTAURAR_REGISTRO',
                "Super Administrador restauró el registro «{$item['nombre_servicio']}» en la categoría «{$item['categoria']}» (ID #{$idServicio}).",
                $idServicio
            );

            jsonResponse([
                'success' => true,
                'mensaje' => "Registro «{$item['nombre_servicio']}» restaurado al catálogo activo."
            ]);
        }

        jsonResponse(['success' => false, 'error' => 'Acción POST no reconocida.'], 400);
    }

    jsonResponse(['success' => false, 'error' => 'Método HTTP no soportado'], 405);

} catch (Throwable $e) {
    error_log("[Servicios API Error] " . $e->getMessage());
    jsonResponse([
        'success' => false,
        'error'   => 'Error interno al procesar el catálogo de servicios: ' . $e->getMessage()
    ], 500);
}
