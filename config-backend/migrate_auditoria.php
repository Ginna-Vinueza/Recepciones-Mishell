<?php
/**
 * Migración: Tabla de Auditoría e Historial de Acciones
 * Plataforma Web Recepciones Mishell - Quito 2026
 */

declare(strict_types=1);

require_once __DIR__ . '/conexion.php';

try {
    $pdo = getDBConnection();

    $sql = "
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
    ";

    $pdo->exec($sql);

    echo "Tabla historial_acciones creada o verificada exitosamente.\n";

} catch (Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
