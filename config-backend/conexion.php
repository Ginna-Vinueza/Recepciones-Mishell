<?php
/**
 * Conexión centralizada a la base de datos MySQL (PDO)
 * Plataforma Web Recepciones Mishell - Quito
 * 
 * Diseñado con soporte para entorno local (XAMPP) y despliegue en la nube
 * siguiendo principios de seguridad (RNF04) y arquitectura modular.
 */

declare(strict_types=1);

// Configuración de cabeceras para API REST JSON si es invocado directamente o vía API
if (!function_exists('jsonResponse')) {
    function jsonResponse(array $data, int $statusCode = 200): void {
        if (!headers_sent()) {
            http_response_code($statusCode);
            header('Content-Type: application/json; charset=utf-8');
            header('X-Content-Type-Options: nosniff');
        }
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }
}

// Parámetros de conexión con variables de entorno para portabilidad a la nube
define('DB_HOST', getenv('DB_HOST') ?: '127.0.0.1');
define('DB_PORT', getenv('DB_PORT') ?: '3306');
define('DB_NAME', getenv('DB_NAME') ?: 'recepciones_mishell');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') !== false ? getenv('DB_PASS') : '');
define('DB_CHARSET', 'utf8mb4');

/**
 * Retorna la instancia activa de PDO
 * @return PDO
 * @throws PDOException
 */
function getDBConnection(): PDO {
    static $pdo = null;

    if ($pdo === null) {
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=%s',
            DB_HOST,
            DB_PORT,
            DB_NAME,
            DB_CHARSET
        );

        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false, // Consultas preparadas reales nativas (RNF04)
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES " . DB_CHARSET . " COLLATE utf8mb4_unicode_ci"
        ];

        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            error_log("[DB Error] " . $e->getMessage());
            // En caso de fallo, nunca exponer credenciales ni stack traces al cliente
            if (php_sapi_name() === 'cli') {
                throw new PDOException("Error al conectar con la base de datos MySQL: " . $e->getMessage());
            } else {
                jsonResponse([
                    'success' => false,
                    'error'   => 'Error interno de conexión a la base de datos. Verifique que MySQL esté activo en el servidor.'
                ], 500);
            }
        }
    }

    return $pdo;
}

/**
 * Registra una acción administrativa en la tabla de auditoría historial_acciones
 */
if (!function_exists('registrarHistorialAccion')) {
    function registrarHistorialAccion(
        PDO $pdo,
        string $modulo,
        string $accion,
        string $detalle,
        ?int $idReferencia = null
    ): void {
        try {
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

            $idUsuario = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 1;
            $nombreUsuario = $_SESSION['nombre_completo'] ?? 'Super Administrador';

            $stmt = $pdo->prepare("
                INSERT INTO historial_acciones (id_usuario, usuario_nombre, modulo, accion, detalle, id_referencia)
                VALUES (:id_usuario, :usuario_nombre, :modulo, :accion, :detalle, :id_referencia)
            ");
            $stmt->execute([
                ':id_usuario'     => $idUsuario,
                ':usuario_nombre' => $nombreUsuario,
                ':modulo'         => $modulo,
                ':accion'         => $accion,
                ':detalle'        => $detalle,
                ':id_referencia'  => $idReferencia
            ]);
        } catch (Throwable $e) {
            error_log("[Auditoría Error] " . $e->getMessage());
        }
    }
}
