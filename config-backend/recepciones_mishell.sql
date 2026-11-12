-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 07-11-2026 a las 20:49:15
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `recepciones_mishell`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `clientes`
--

CREATE TABLE `clientes` (
  `id_cliente` int(11) NOT NULL,
  `cedula_ruc` varchar(13) NOT NULL,
  `nombres` varchar(100) NOT NULL,
  `apellidos` varchar(100) NOT NULL,
  `telefono` varchar(15) DEFAULT NULL,
  `correo` varchar(100) DEFAULT NULL,
  `direccion` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `cotizaciones`
--

CREATE TABLE `cotizaciones` (
  `id_cotizacion` int(11) NOT NULL,
  `id_cliente` int(11) NOT NULL,
  `id_usuario` int(11) NOT NULL,
  `fecha_emision` datetime DEFAULT current_timestamp(),
  `fecha_evento_propuesta` date NOT NULL,
  `hora_inicio` time DEFAULT NULL,
  `hora_fin` time DEFAULT NULL,
  `cantidad_personas` int(11) NOT NULL DEFAULT 50,
  `tipo_evento` varchar(255) DEFAULT NULL,
  `color_manteleria` varchar(255) DEFAULT NULL,
  `horas_evento` int(11) NOT NULL DEFAULT 4,
  `horas_extra` int(11) NOT NULL DEFAULT 0,
  `precio_plato` decimal(10,2) NOT NULL DEFAULT 14.00,
  `subtotal_menu` decimal(10,2) NOT NULL DEFAULT 0.00,
  `subtotal_horas_extra` decimal(10,2) NOT NULL DEFAULT 0.00,
  `total_estimado` decimal(10,2) NOT NULL,
  `menu_seleccionado` text DEFAULT NULL,
  `observaciones` text DEFAULT NULL,
  `estado` enum('Pendiente','Aprobada','Rechazada') DEFAULT 'Pendiente'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `detalle_cotizacion`
--

CREATE TABLE `detalle_cotizacion` (
  `id_detalle` int(11) NOT NULL,
  `id_cotizacion` int(11) NOT NULL,
  `id_servicio` int(11) NOT NULL,
  `cantidad` int(11) DEFAULT 1,
  `precio_unitario` decimal(10,2) NOT NULL,
  `subtotal` decimal(10,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `reservas`
--

CREATE TABLE `reservas` (
  `id_reserva` int(11) NOT NULL,
  `id_cotizacion` int(11) NOT NULL,
  `id_cliente` int(11) NOT NULL,
  `id_usuario` int(11) NOT NULL,
  `fecha_evento` date NOT NULL,
  `hora_inicio` time DEFAULT NULL,
  `hora_fin` time DEFAULT NULL,
  `tipo_evento` varchar(50) DEFAULT NULL,
  `estado_reserva` enum('Confirmado','En Proceso','Cancelado') DEFAULT 'Confirmado'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `servicios`
--

CREATE TABLE `servicios` (
  `id_servicio` int(11) NOT NULL,
  `nombre_servicio` varchar(100) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `precio_referencial` decimal(10,2) NOT NULL,
  `categoria` varchar(50) DEFAULT NULL,
  `estado` tinyint(4) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `servicios` (RF03 Catálogo Oficial de Eventos y Banquetes)
--

INSERT INTO `servicios` (`id_servicio`, `nombre_servicio`, `descripcion`, `precio_referencial`, `categoria`, `estado`) VALUES
(1, 'Menú Buffet Estándar (2 Carnes sin Lomo)', 'Plato completo de buffet a elegir 2 carnes (chuletas, pollos, medallones), 1 arroz, 1 ensalada, 1 papas y 1 arreglo frutal. Incluye paquete integral de sala y banquete.', 14.00, 'Tarifa Base', 1),
(2, 'Menú Buffet Especial (Incluye Lomo de Res / Cerdo)', 'Plato completo de buffet a elegir 2 carnes incluyendo al menos una opción de Lomos de res o cerdo a la BBQ, 1 arroz, 1 ensalada, 1 papas y 1 arreglo frutal. Incluye paquete integral de sala y banquete.', 16.00, 'Tarifa Base', 1),
(3, 'Hora Extra de Salón y Servicios', 'Hora adicional de uso de instalaciones, servicio de meseros, luces y animación más allá del tiempo base contratado.', 80.00, 'Hora Extra', 1),
(4, 'Mantelería', 'Vestidos de sillas y manteles de mesa blancos impecables con cubre manteles y lazos al color de su preferencia.', 0.00, 'Servicio Incluido', 1),
(5, 'Cristalería', 'Copas de cristal para brindis y vasos de alta calidad para bebidas y cócteles.', 0.00, 'Servicio Incluido', 1),
(6, 'Vajilla', 'Vajilla completa de cerámica de gala y cubertería de acero inoxidable pulido.', 0.00, 'Servicio Incluido', 1),
(7, 'Sillas', 'Sillas de banquete cómodas con forro blanco y lazo decorativo.', 0.00, 'Servicio Incluido', 1),
(8, 'Mesas', 'Mesas redondas para banquete con mantelería fina blanca.', 0.00, 'Servicio Incluido', 1),
(9, 'Pastel', 'Pastel conmemorativo del evento con diseño alegórico a la celebración.', 0.00, 'Servicio Incluido', 1),
(10, 'Postre', 'Deliciosa mesa de postres variados para todos los invitados.', 0.00, 'Servicio Incluido', 1),
(11, 'Luces Robóticas', 'Sistema computarizado de cabezas móviles y luces robóticas para pista de baile.', 0.00, 'Servicio Incluido', 1),
(12, 'Meseros Profesionales', 'Brigada de meseros uniformados con atención de gala para servicio a mesa.', 0.00, 'Servicio Incluido', 1),
(13, 'Maestro de Ceremonias, DJ', 'Conducción protocolaria del evento y DJ profesional con cabina y mezcla en vivo.', 0.00, 'Servicio Incluido', 1),
(14, 'Guardia y cámaras de video vigilancia en las instalaciones', 'Personal de seguridad privada en puertas y monitoreo continuo por circuito cerrado.', 0.00, 'Servicio Incluido', 1),
(15, 'Cumpleaños', 'Celebraciones de cumpleaños para todas las edades y quinceañeras.', 0.00, 'Tipo Evento', 1),
(16, 'Boda', 'Matrimonios civiles y eclesiásticos con protocolo nupcial.', 0.00, 'Tipo Evento', 1),
(17, 'Graduación', 'Cenas y fiestas de graduación de bachilleres o universitarios.', 0.00, 'Tipo Evento', 1),
(18, 'Bautizo', 'Almuerzo o cena familiar para celebración de bautismo.', 0.00, 'Tipo Evento', 1),
(19, 'Primera Comunión', 'Recepción conmemorativa religiosa de primera comunión.', 0.00, 'Tipo Evento', 1),
(20, 'Reuniones Sociales', 'Aniversarios, agasajos corporativos, baby showers y reuniones.', 0.00, 'Tipo Evento', 1),
(21, 'Lazos y Cubre Manteles Rosado', 'Decoración en tono Rosado suave para lazos de sillas y cubremanteles.', 0.00, 'Color Mantelería', 1),
(22, 'Lazos y Cubre Manteles Lila', 'Decoración en tono Lila lavanda elegante para lazos de sillas y cubremanteles.', 0.00, 'Color Mantelería', 1),
(23, 'Lazos y Cubre Manteles Dorado', 'Decoración en tono Dorado imperial para lazos de sillas y cubremanteles.', 0.00, 'Color Mantelería', 1),
(24, 'Lazos y Cubre Manteles Fucsia', 'Decoración en tono Fucsia vibrante para lazos de sillas y cubremanteles.', 0.00, 'Color Mantelería', 1),
(25, 'Lazos y Cubre Manteles Azul', 'Decoración en tono Azul rey sobrio y distinguido para sillas y mesas.', 0.00, 'Color Mantelería', 1),
(26, 'Chuleta: Al horno', 'Corte de chuleta sazonada con hierbas finas y cocinada lentamente al horno.', 0.00, 'Carne - Chuletas', 1),
(27, 'Chuleta: En salsa al curry', 'Chuleta bañada en una cremosa y suave salsa al curry especiada.', 0.00, 'Carne - Chuletas', 1),
(28, 'Chuleta: En salsa al curry con naranja', 'Exquisita fusión agridulce de curry con reducción de zumo de naranja natural.', 0.00, 'Carne - Chuletas', 1),
(29, 'Chuleta: En salsa de champiñones', 'Chuleta bañada con una reducción aterciopelada de champiñones frescos.', 0.00, 'Carne - Chuletas', 1),
(30, 'Pollo: Al horno', 'Filete o presa de pollo dorado y tierno aromatizado con especias al horno.', 0.00, 'Carne - Pollos', 1),
(31, 'Pollo: Al vino', 'Pollo cocinado en reducción de vino blanco y toques de laurel.', 0.00, 'Carne - Pollos', 1),
(32, 'Pollo: En salsa de durazno', 'Pechuga tierna glaseada con una delicada salsa de duraznos en almíbar.', 0.00, 'Carne - Pollos', 1),
(33, 'Pollo: Al curry', 'Pechuga marinada y bañada en salsa dorada de curry clásico.', 0.00, 'Carne - Pollos', 1),
(34, 'Pollo: Al ajillo (ajo, vinagre, aceite de oliva)', 'Preparación tradicional con láminas de ajo frito, toque de vinagre y aceite de oliva virgen extra.', 0.00, 'Carne - Pollos', 1),
(35, 'Medallón: Pollo (jamón y queso)', 'Medallón relleno con suave jamón york y queso fundido derretido.', 0.00, 'Carne - Medallones', 1),
(36, 'Medallón: Pollo uruguayo en salsa de durazno', 'Receta estilo uruguayo cubierta de una sofisticada salsa agridulce de duraznos.', 0.00, 'Carne - Medallones', 1),
(37, 'Medallón: Ternera', 'Suave y jugoso medallón de ternera seleccionada a punto.', 0.00, 'Carne - Medallones', 1),
(38, 'Medallón: Pavo', 'Corte magro y delicado de pavo sazonado al estilo banquete.', 0.00, 'Carne - Medallones', 1),
(39, 'Lomo: Res en salsa de champiñones', 'Fino corte de lomo de res cocinado a la perfección con salsa cremosa de champiñones.', 0.00, 'Carne - Lomos', 1),
(40, 'Lomo: Res al vino de jerez', 'Lomo de res sellado y bañado con reducción aromática de vino de Jerez dulce.', 0.00, 'Carne - Lomos', 1),
(41, 'Lomo: Cerdo (aceitunas, jamón, queso, tocino y vegetales)', 'Lomo de cerdo especial relleno de aceitunas, jamón, queso, crocante tocino y vegetales.', 0.00, 'Carne - Lomos', 1),
(42, 'Lomo: Costillas de cerdo a la BBQ', 'Costillitas tiernas glaseadas con salsa barbacoa ahumada artesanal.', 0.00, 'Carne - Lomos', 1),
(43, 'Arroz Rosado', 'Arroz festivo elaborado con emulsión suave de remolacha y toques de mantequilla.', 0.00, 'Arroz', 1),
(44, 'Arroz Verde (albahaca)', 'Arroz aromatizado con infusión fresca de albahaca y espinaca al dente.', 0.00, 'Arroz', 1),
(45, 'Arroz Blanco con pasas', 'Clásico arroz blanco de grano largo salpicado con pasas rubias y morenas.', 0.00, 'Arroz', 1),
(46, 'Arroz Blanco con alverjas', 'Arroz blanco ligero con tiernas alverjitas dulces al vapor.', 0.00, 'Arroz', 1),
(47, 'Arroz Al curry con perejil', 'Arroz especiado con curry suave y finas hojas de perejil fresco picado.', 0.00, 'Arroz', 1),
(48, 'Arroz Con champiñones', 'Arroz cremoso salteado con champiñones frescos y vino blanco.', 0.00, 'Arroz', 1),
(49, 'Arroz Oriental (pimiento rojo, verde y amarillo)', 'Salteado estilo wok con pimientos tricolor, salsa de soya y ajonjolí.', 0.00, 'Arroz', 1),
(50, 'Arroz Primavera (alverja, zanahoria y pimiento rojo)', 'Colorida combinación de alverjitas, cubitos de zanahoria y pimiento rojo.', 0.00, 'Arroz', 1),
(51, 'Arroz Dorado (jamón y champiñones)', 'Arroz salteado dorado con dados de jamón especial y champiñones en mantequilla.', 0.00, 'Arroz', 1),
(52, 'Ensalada Rey (jamón, choclo, alverja y coliflor)', 'Ensalada festiva con jamón picado, granos de choclo tierno, alverjas y flores de coliflor al vapor.', 0.00, 'Ensalada', 1),
(53, 'Ensalada Waldorf (zanahoria, choclo, alverja, piña, apio y manzana)', 'Famosa receta agridulce con manzana crujiente, piña, apio fresco, choclo, alverja y zanahoria.', 0.00, 'Ensalada', 1),
(54, 'Ensalada Margarita (choclo, brócoli, zanahoria y tocino)', 'Nutritiva combinación de choclo dulce, ramitos de brócoli, zanahoria y crocantes trozos de tocino.', 0.00, 'Ensalada', 1),
(55, 'Ensalada Fresca (tomate, lechuga y pepinillo)', 'Clásica y refrescante con rodajas de tomate maduro, lechuga crespa seleccionada y pepinillo fino.', 0.00, 'Ensalada', 1),
(56, 'Ensalada Mediterránea (tomate cherry, lechuga, cebolla perla y vinagreta)', 'Selección mediterránea con tomates cherry jugosos, mix de lechugas, cebolla perla y vinagreta de la casa.', 0.00, 'Ensalada', 1),
(57, 'Papas: Al perejil salteadas en mantequilla', 'Papas cocidas salteadas en rica mantequilla fundida con lluvia de perejil picado.', 0.00, 'Papas', 1),
(58, 'Papas: Al romero', 'Papas rústicas perfumadas con romero silvestre fresco y aceite de oliva.', 0.00, 'Papas', 1),
(59, 'Papas: Al jamón con queso', 'Papas bañadas con trozos de jamón cocido y abundante queso fundido.', 0.00, 'Papas', 1),
(60, 'Papas: Al horno (cocidas y terminadas al horno)', 'Papas previamente cocidas y doradas a alta temperatura con un toque crujiente.', 0.00, 'Papas', 1),
(61, 'Papas: Salteadas con ajo y mantequilla', 'Papas tiernas salteadas con ajo finamente picado y mantequilla de campo.', 0.00, 'Papas', 1),
(62, 'Papas: Gratinada con cáscara, bañada en ajo y mantequilla', 'Papas con cáscara dorada, gratinadas al horno y bañadas con infusión de ajo y mantequilla.', 0.00, 'Papas', 1),
(63, 'Arreglo Frutal: Cisne de Frutas', 'Elegante escultura artística tallada a mano en frutas de temporada formando un cisne ornamental para el buffet.', 0.00, 'Arreglo Frutal', 1),
(64, 'Arreglo Frutal: Corazón de Frutas', 'Romántico arreglo tallado con brochetas y formas de corazón con variedad de frutas selectas.', 0.00, 'Arreglo Frutal', 1);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuarios`
--

CREATE TABLE `usuarios` (
  `id_usuario` int(11) NOT NULL,
  `nombre_completo` varchar(100) NOT NULL,
  `correo` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `rol` enum('Administrador','Recepcion') NOT NULL,
  `estado` tinyint(4) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `clientes`
--
ALTER TABLE `clientes`
  ADD PRIMARY KEY (`id_cliente`),
  ADD UNIQUE KEY `cedula_ruc` (`cedula_ruc`);

--
-- Indices de la tabla `cotizaciones`
--
ALTER TABLE `cotizaciones`
  ADD PRIMARY KEY (`id_cotizacion`),
  ADD KEY `id_cliente` (`id_cliente`),
  ADD KEY `id_usuario` (`id_usuario`);

--
-- Indices de la tabla `detalle_cotizacion`
--
ALTER TABLE `detalle_cotizacion`
  ADD PRIMARY KEY (`id_detalle`),
  ADD KEY `id_cotizacion` (`id_cotizacion`),
  ADD KEY `id_servicio` (`id_servicio`);

--
-- Indices de la tabla `reservas`
--
ALTER TABLE `reservas`
  ADD PRIMARY KEY (`id_reserva`),
  ADD KEY `id_cotizacion` (`id_cotizacion`),
  ADD KEY `id_cliente` (`id_cliente`),
  ADD KEY `id_usuario` (`id_usuario`);

--
-- Indices de la tabla `servicios`
--
ALTER TABLE `servicios`
  ADD PRIMARY KEY (`id_servicio`);

--
-- Indices de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  ADD PRIMARY KEY (`id_usuario`),
  ADD UNIQUE KEY `correo` (`correo`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `clientes`
--
ALTER TABLE `clientes`
  MODIFY `id_cliente` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `cotizaciones`
--
ALTER TABLE `cotizaciones`
  MODIFY `id_cotizacion` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `detalle_cotizacion`
--
ALTER TABLE `detalle_cotizacion`
  MODIFY `id_detalle` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `reservas`
--
ALTER TABLE `reservas`
  MODIFY `id_reserva` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `servicios`
--
ALTER TABLE `servicios`
  MODIFY `id_servicio` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  MODIFY `id_usuario` int(11) NOT NULL AUTO_INCREMENT;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `cotizaciones`
--
ALTER TABLE `cotizaciones`
  ADD CONSTRAINT `cotizaciones_ibfk_1` FOREIGN KEY (`id_cliente`) REFERENCES `clientes` (`id_cliente`),
  ADD CONSTRAINT `cotizaciones_ibfk_2` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`);

--
-- Filtros para la tabla `detalle_cotizacion`
--
ALTER TABLE `detalle_cotizacion`
  ADD CONSTRAINT `detalle_cotizacion_ibfk_1` FOREIGN KEY (`id_cotizacion`) REFERENCES `cotizaciones` (`id_cotizacion`),
  ADD CONSTRAINT `detalle_cotizacion_ibfk_2` FOREIGN KEY (`id_servicio`) REFERENCES `servicios` (`id_servicio`);

--
-- Filtros para la tabla `reservas`
--
ALTER TABLE `reservas`
  ADD CONSTRAINT `reservas_ibfk_1` FOREIGN KEY (`id_cotizacion`) REFERENCES `cotizaciones` (`id_cotizacion`),
  ADD CONSTRAINT `reservas_ibfk_2` FOREIGN KEY (`id_cliente`) REFERENCES `clientes` (`id_cliente`),
  ADD CONSTRAINT `reservas_ibfk_3` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
