<?php
/**
 * API REST: Módulo de Clientes (RF02)
 * Plataforma Web Recepciones Mishell - Quito
 * 
 * Permite registrar, buscar, editar y consultar clientes.
 * Cumple con RNF04 (Seguridad / Consultas preparadas PDO) y RNF05 (Integridad referencial).
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

// Función de validación de Cédula o RUC ecuatoriano
function validarCedulaRUC(string $num): bool {
    $num = trim($num);
    $len = strlen($num);
    // Debe tener 10 dígitos (cédula) o 13 dígitos (RUC personas naturales / jurídicas)
    if (!ctype_digit($num) || ($len !== 10 && $len !== 13)) {
        return false;
    }
    // Validación de código de provincia (01 a 24 o 30)
    $prov = (int)substr($num, 0, 2);
    if (($prov < 1 || $prov > 24) && $prov !== 30) {
        return false;
    }
    return true;
}

try {
    // -------------------------------------------------------------
    // GET: Listar clientes o buscar por término / cédula
    // -------------------------------------------------------------
    if ($method === 'GET') {
        $accion = $_GET['action'] ?? 'listar';

        // Búsqueda específica por cédula o RUC (para el cotizador inteligente RF04 / Fig. 8)
        if ($accion === 'buscar_cedula' || isset($_GET['cedula_ruc'])) {
            $cedula = trim($_GET['cedula_ruc'] ?? '');
            
            $stmt = $pdo->prepare("
                SELECT id_cliente, cedula_ruc, nombres, apellidos, telefono, correo, direccion
                FROM clientes
                WHERE cedula_ruc = :cedula
                LIMIT 1
            ");
            $stmt->execute([':cedula' => $cedula]);
            $cliente = $stmt->fetch();

            if ($cliente) {
                // Contar cotizaciones/reservas previas para calcular si es "Cliente Frecuente" (Figura 8)
                $stmtPrev = $pdo->prepare("
                    SELECT COUNT(*) as total_eventos 
                    FROM reservas 
                    WHERE id_cliente = :id_cliente
                ");
                $stmtPrev->execute([':id_cliente' => $cliente['id_cliente']]);
                $historial = $stmtPrev->fetch();
                
                $cliente['total_eventos'] = (int)($historial['total_eventos'] ?? 0);
                $cliente['es_frecuente'] = $cliente['total_eventos'] > 0;

                jsonResponse([
                    'success' => true,
                    'cliente' => $cliente
                ]);
            } else {
                jsonResponse([
                    'success' => false,
                    'error'   => 'No se encontró ningún cliente registrado con esa identificación.'
                ], 404);
            }
        }

        // Búsqueda general o listado completo
        $busqueda = trim($_GET['q'] ?? '');
        
        if ($busqueda !== '') {
            $termino = "%{$busqueda}%";
            $stmt = $pdo->prepare("
                SELECT c.id_cliente, c.cedula_ruc, c.nombres, c.apellidos, c.telefono, c.correo, c.direccion,
                       (SELECT COUNT(*) FROM reservas r WHERE r.id_cliente = c.id_cliente) as total_eventos
                FROM clientes c
                WHERE c.cedula_ruc LIKE :t1
                   OR c.nombres LIKE :t2
                   OR c.apellidos LIKE :t3
                   OR CONCAT(c.nombres, ' ', c.apellidos) LIKE :t4
                ORDER BY c.id_cliente DESC
            ");
            $stmt->execute([
                ':t1' => $termino,
                ':t2' => $termino,
                ':t3' => $termino,
                ':t4' => $termino
            ]);
        } else {
            $stmt = $pdo->query("
                SELECT c.id_cliente, c.cedula_ruc, c.nombres, c.apellidos, c.telefono, c.correo, c.direccion,
                       (SELECT COUNT(*) FROM reservas r WHERE r.id_cliente = c.id_cliente) as total_eventos
                FROM clientes c
                ORDER BY c.id_cliente DESC
            ");
        }

        $clientes = $stmt->fetchAll();

        // Total de clientes registrados para el contador de la pestaña (ej. "Clientes 48" de la Figura 7)
        $totalClientes = count($clientes);

        jsonResponse([
            'success'        => true,
            'total'          => $totalClientes,
            'clientes'       => $clientes
        ]);
    }

    // -------------------------------------------------------------
    // POST: Crear, Editar o Eliminar cliente
    // -------------------------------------------------------------
    if ($method === 'POST') {
        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);
        if (!is_array($data)) {
            $data = $_POST;
        }

        $accion = $data['action'] ?? 'crear';

        // 1. CREAR CLIENTE
        if ($accion === 'crear') {
            $cedulaRuc = trim((string)($data['cedula_ruc'] ?? ''));
            $nombres   = trim((string)($data['nombres'] ?? ''));
            $apellidos = trim((string)($data['apellidos'] ?? ''));
            $telefono  = trim((string)($data['telefono'] ?? ''));
            $correo    = trim((string)($data['correo'] ?? ''));
            $direccion = trim((string)($data['direccion'] ?? ''));

            if ($cedulaRuc === '' || $nombres === '' || $apellidos === '') {
                jsonResponse([
                    'success' => false,
                    'error'   => 'La cédula/RUC, nombres y apellidos son campos obligatorios.'
                ], 400);
            }

            if (!validarCedulaRUC($cedulaRuc)) {
                jsonResponse([
                    'success' => false,
                    'error'   => 'La identificación ingresada no es una cédula (10 dígitos) o RUC ecuatoriano válido.'
                ], 400);
            }

            // Comprobar si ya existe la cédula/RUC
            $stmtExiste = $pdo->prepare("SELECT id_cliente FROM clientes WHERE cedula_ruc = :cedula");
            $stmtExiste->execute([':cedula' => $cedulaRuc]);
            if ($stmtExiste->fetch()) {
                jsonResponse([
                    'success' => false,
                    'error'   => 'Ya existe un cliente registrado con esta identificación (Cédula/RUC).'
                ], 409);
            }

            $stmtInsert = $pdo->prepare("
                INSERT INTO clientes (cedula_ruc, nombres, apellidos, telefono, correo, direccion)
                VALUES (:cedula, :nombres, :apellidos, :telefono, :correo, :direccion)
            ");
            $stmtInsert->execute([
                ':cedula'    => $cedulaRuc,
                ':nombres'   => $nombres,
                ':apellidos' => $apellidos,
                ':telefono'  => $telefono ?: null,
                ':correo'    => $correo ?: null,
                ':direccion' => $direccion ?: null
            ]);

            $nuevoId = (int)$pdo->lastInsertId();

            registrarHistorialAccion(
                $pdo,
                'Clientes (RF02)',
                'CREAR_CLIENTE',
                "Se registró al cliente «{$nombres} {$apellidos}» con C.I./RUC {$cedulaRuc} (ID #{$nuevoId}).",
                $nuevoId
            );

            jsonResponse([
                'success' => true,
                'mensaje' => 'Cliente registrado exitosamente.',
                'cliente' => [
                    'id_cliente'    => $nuevoId,
                    'cedula_ruc'    => $cedulaRuc,
                    'nombres'       => $nombres,
                    'apellidos'     => $apellidos,
                    'telefono'      => $telefono,
                    'correo'        => $correo,
                    'direccion'     => $direccion,
                    'total_eventos' => 0
                ]
            ], 201);
        }

        // 2. EDITAR CLIENTE
        if ($accion === 'editar') {
            $idCliente = (int)($data['id_cliente'] ?? 0);
            $cedulaRuc = trim((string)($data['cedula_ruc'] ?? ''));
            $nombres   = trim((string)($data['nombres'] ?? ''));
            $apellidos = trim((string)($data['apellidos'] ?? ''));
            $telefono  = trim((string)($data['telefono'] ?? ''));
            $correo    = trim((string)($data['correo'] ?? ''));
            $direccion = trim((string)($data['direccion'] ?? ''));

            if ($idCliente <= 0 || $cedulaRuc === '' || $nombres === '' || $apellidos === '') {
                jsonResponse([
                    'success' => false,
                    'error'   => 'Faltan datos obligatorios para actualizar el cliente.'
                ], 400);
            }

            // Validar que no choque con otra cédula
            $stmtExiste = $pdo->prepare("
                SELECT id_cliente FROM clientes 
                WHERE cedula_ruc = :cedula AND id_cliente != :id
            ");
            $stmtExiste->execute([':cedula' => $cedulaRuc, ':id' => $idCliente]);
            if ($stmtExiste->fetch()) {
                jsonResponse([
                    'success' => false,
                    'error'   => 'El número de identificación ya pertenece a otro cliente registrado.'
                ], 409);
            }

            $stmtUpdate = $pdo->prepare("
                UPDATE clientes
                SET cedula_ruc = :cedula, nombres = :nombres, apellidos = :apellidos,
                    telefono = :telefono, correo = :correo, direccion = :direccion
                WHERE id_cliente = :id
            ");
            $stmtUpdate->execute([
                ':cedula'    => $cedulaRuc,
                ':nombres'   => $nombres,
                ':apellidos' => $apellidos,
                ':telefono'  => $telefono ?: null,
                ':correo'    => $correo ?: null,
                ':direccion' => $direccion ?: null,
                ':id'        => $idCliente
            ]);

            registrarHistorialAccion(
                $pdo,
                'Clientes (RF02)',
                'EDITAR_CLIENTE',
                "Se actualizó la información del cliente «{$nombres} {$apellidos}» con C.I./RUC {$cedulaRuc} (ID #{$idCliente}).",
                $idCliente
            );

            jsonResponse([
                'success' => true,
                'mensaje' => 'Información del cliente actualizada con éxito.'
            ]);
        }

        // 3. ELIMINAR CLIENTE (RNF05: Integridad referencial e Histórico)
        if ($accion === 'eliminar') {
            $idCliente = (int)($data['id_cliente'] ?? 0);

            if ($idCliente <= 0) {
                jsonResponse(['success' => false, 'error' => 'Identificador de cliente no válido.'], 400);
            }

            $stmtInfo = $pdo->prepare("SELECT * FROM clientes WHERE id_cliente = :id LIMIT 1");
            $stmtInfo->execute([':id' => $idCliente]);
            $cliInfo = $stmtInfo->fetch();

            if (!$cliInfo) {
                jsonResponse(['success' => false, 'error' => 'El cliente no existe.'], 404);
            }

            // Comprobar si tiene cotizaciones o reservas vinculadas
            $stmtCheck = $pdo->prepare("
                SELECT 
                    (SELECT COUNT(*) FROM cotizaciones WHERE id_cliente = :c1) as total_cots,
                    (SELECT COUNT(*) FROM reservas WHERE id_cliente = :c2) as total_res
            ");
            $stmtCheck->execute([':c1' => $idCliente, ':c2' => $idCliente]);
            $relaciones = $stmtCheck->fetch();

            if (($relaciones['total_cots'] ?? 0) > 0 || ($relaciones['total_res'] ?? 0) > 0) {
                jsonResponse([
                    'success' => false,
                    'error'   => 'No se puede eliminar el cliente porque tiene cotizaciones o reservas vinculadas en el salón.'
                ], 409);
            }

            $stmtDel = $pdo->prepare("DELETE FROM clientes WHERE id_cliente = :id");
            $stmtDel->execute([':id' => $idCliente]);

            registrarHistorialAccion(
                $pdo,
                'Clientes (RF02)',
                'ELIMINAR_CLIENTE',
                "Se eliminó al cliente «{$cliInfo['nombres']} {$cliInfo['apellidos']}» con C.I./RUC {$cliInfo['cedula_ruc']} (ID #{$idCliente}).",
                $idCliente
            );

            jsonResponse([
                'success' => true,
                'mensaje' => 'Cliente eliminado del sistema y registrado en el historial.'
            ]);
        }
    }

    jsonResponse(['success' => false, 'error' => 'Método no soportado.'], 405);

} catch (Throwable $e) {
    error_log("[Clientes API Error] " . $e->getMessage());
    jsonResponse([
        'success' => false,
        'error'   => 'Error interno al procesar los datos de clientes: ' . $e->getMessage()
    ], 500);
}
