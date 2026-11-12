<?php
/**
 * Script de inicialización y migración para el Catálogo de Servicios y Eventos (RF03)
 * Recepciones Mishell - Quito 2026
 * 
 * Modifica la tabla cotizaciones con los campos requeridos para el cotizador inteligente
 * y puebla la tabla servicios con todas las tarifas, opciones de buffet y servicios incluidos.
 */

declare(strict_types=1);

require_once __DIR__ . '/../../config-backend/conexion.php';

try {
    $pdo = getDBConnection();

    // 1. Agregar columnas a la tabla cotizaciones si no existen
    $columnasDeseadas = [
        'cantidad_personas'    => "INT(11) NOT NULL DEFAULT 50",
        'tipo_evento'          => "VARCHAR(255) NULL",
        'color_manteleria'     => "VARCHAR(255) NULL",
        'horas_evento'         => "INT(11) NOT NULL DEFAULT 4",
        'horas_extra'          => "INT(11) NOT NULL DEFAULT 0",
        'precio_plato'         => "DECIMAL(10,2) NOT NULL DEFAULT 14.00",
        'subtotal_menu'        => "DECIMAL(10,2) NOT NULL DEFAULT 0.00",
        'subtotal_horas_extra' => "DECIMAL(10,2) NOT NULL DEFAULT 0.00",
        'menu_seleccionado'    => "TEXT NULL",
        'observaciones'        => "TEXT NULL"
    ];

    // Obtener columnas existentes en cotizaciones
    $colsCot = $pdo->query("SHOW COLUMNS FROM cotizaciones")->fetchAll(PDO::FETCH_COLUMN);
    $columnasAgregadas = [];

    foreach ($columnasDeseadas as $colName => $colDef) {
        if (!in_array($colName, $colsCot, true)) {
            $pdo->exec("ALTER TABLE cotizaciones ADD COLUMN `$colName` $colDef");
            $columnasAgregadas[] = $colName;
        }
    }

    // 2. Definición del Catálogo Oficial de Servicios (RF03)
    $serviciosCatalogo = [
        // --- TARIFAS PRINCIPALES DEL COTIZADOR ---
        [
            'nombre' => 'Menú Buffet Estándar (2 Carnes sin Lomo)',
            'desc'   => 'Plato completo de buffet a elegir 2 carnes (chuletas, pollos, medallones), 1 arroz, 1 ensalada, 1 papas y 1 arreglo frutal. Incluye paquete integral de sala y banquete.',
            'precio' => 14.00,
            'cat'    => 'Tarifa Base'
        ],
        [
            'nombre' => 'Menú Buffet Especial (Incluye Lomo de Res / Cerdo)',
            'desc'   => 'Plato completo de buffet a elegir 2 carnes incluyendo al menos una opción de Lomos de res o cerdo a la BBQ, 1 arroz, 1 ensalada, 1 papas y 1 arreglo frutal. Incluye paquete integral de sala y banquete.',
            'precio' => 16.00,
            'cat'    => 'Tarifa Base'
        ],
        [
            'nombre' => 'Hora Extra de Salón y Servicios',
            'desc'   => 'Hora adicional de uso de instalaciones, servicio de meseros, luces y animación más allá del tiempo base contratado.',
            'precio' => 80.00,
            'cat'    => 'Hora Extra'
        ],

        // --- SERVICIOS INCLUIDOS EN EL PAQUETE (VALOR $0.00 DENTRO DEL MENÚ) ---
        [
            'nombre' => 'Mantelería',
            'desc'   => 'Vestidos de sillas y manteles de mesa blancos impecables con cubre manteles y lazos al color de su preferencia.',
            'precio' => 0.00,
            'cat'    => 'Servicio Incluido'
        ],
        [
            'nombre' => 'Cristalería',
            'desc'   => 'Copas de cristal para brindis y vasos de alta calidad para bebidas y cócteles.',
            'precio' => 0.00,
            'cat'    => 'Servicio Incluido'
        ],
        [
            'nombre' => 'Vajilla',
            'desc'   => 'Vajilla completa de cerámica de gala y cubertería de acero inoxidable pulido.',
            'precio' => 0.00,
            'cat'    => 'Servicio Incluido'
        ],
        [
            'nombre' => 'Sillas',
            'desc'   => 'Sillas de banquete cómodas con forro blanco y lazo decorativo.',
            'precio' => 0.00,
            'cat'    => 'Servicio Incluido'
        ],
        [
            'nombre' => 'Mesas',
            'desc'   => 'Mesas redondas para banquete con mantelería fina blanca.',
            'precio' => 0.00,
            'cat'    => 'Servicio Incluido'
        ],
        [
            'nombre' => 'Pastel',
            'desc'   => 'Pastel conmemorativo del evento con diseño alegórico a la celebración.',
            'precio' => 0.00,
            'cat'    => 'Servicio Incluido'
        ],
        [
            'nombre' => 'Postre',
            'desc'   => 'Deliciosa mesa de postres variados para todos los invitados.',
            'precio' => 0.00,
            'cat'    => 'Servicio Incluido'
        ],
        [
            'nombre' => 'Luces Robóticas',
            'desc'   => 'Sistema computarizado de cabezas móviles y luces robóticas para pista de baile.',
            'precio' => 0.00,
            'cat'    => 'Servicio Incluido'
        ],
        [
            'nombre' => 'Meseros Profesionales',
            'desc'   => 'Brigada de meseros uniformados con atención de gala para servicio a mesa.',
            'precio' => 0.00,
            'cat'    => 'Servicio Incluido'
        ],
        [
            'nombre' => 'Maestro de Ceremonias, DJ',
            'desc'   => 'Conducción protocolaria del evento y DJ profesional con cabina y mezcla en vivo.',
            'precio' => 0.00,
            'cat'    => 'Servicio Incluido'
        ],
        [
            'nombre' => 'Guardia y cámaras de video vigilancia en las instalaciones',
            'desc'   => 'Personal de seguridad privada en puertas y monitoreo continuo por circuito cerrado.',
            'precio' => 0.00,
            'cat'    => 'Servicio Incluido'
        ],

        // --- TIPOS DE EVENTO ---
        [
            'nombre' => 'Cumpleaños',
            'desc'   => 'Celebraciones de cumpleaños para todas las edades y quinceañeras.',
            'precio' => 0.00,
            'cat'    => 'Tipo Evento'
        ],
        [
            'nombre' => 'Boda',
            'desc'   => 'Matrimonios civiles y eclesiásticos con protocolo nupcial.',
            'precio' => 0.00,
            'cat'    => 'Tipo Evento'
        ],
        [
            'nombre' => 'Graduación',
            'desc'   => 'Cenas y fiestas de graduación de bachilleres o universitarios.',
            'precio' => 0.00,
            'cat'    => 'Tipo Evento'
        ],
        [
            'nombre' => 'Bautizo',
            'desc'   => 'Almuerzo o cena familiar para celebración de bautismo.',
            'precio' => 0.00,
            'cat'    => 'Tipo Evento'
        ],
        [
            'nombre' => 'Primera Comunión',
            'desc'   => 'Recepción conmemorativa religiosa de primera comunión.',
            'precio' => 0.00,
            'cat'    => 'Tipo Evento'
        ],
        [
            'nombre' => 'Reuniones Sociales',
            'desc'   => 'Aniversarios, agasajos corporativos, baby showers y reuniones.',
            'precio' => 0.00,
            'cat'    => 'Tipo Evento'
        ],

        // --- COLORES DE LAZOS Y CUBRE MANTELES ---
        [
            'nombre' => 'Lazos y Cubre Manteles Rosado',
            'desc'   => 'Decoración en tono Rosado suave para lazos de sillas y cubremanteles.',
            'precio' => 0.00,
            'cat'    => 'Color Mantelería'
        ],
        [
            'nombre' => 'Lazos y Cubre Manteles Lila',
            'desc'   => 'Decoración en tono Lila lavanda elegante para lazos de sillas y cubremanteles.',
            'precio' => 0.00,
            'cat'    => 'Color Mantelería'
        ],
        [
            'nombre' => 'Lazos y Cubre Manteles Dorado',
            'desc'   => 'Decoración en tono Dorado imperial para lazos de sillas y cubremanteles.',
            'precio' => 0.00,
            'cat'    => 'Color Mantelería'
        ],
        [
            'nombre' => 'Lazos y Cubre Manteles Fucsia',
            'desc'   => 'Decoración en tono Fucsia vibrante para lazos de sillas y cubremanteles.',
            'precio' => 0.00,
            'cat'    => 'Color Mantelería'
        ],
        [
            'nombre' => 'Lazos y Cubre Manteles Azul',
            'desc'   => 'Decoración en tono Azul rey sobrio y distinguido para sillas y mesas.',
            'precio' => 0.00,
            'cat'    => 'Color Mantelería'
        ],

        // --- OPCIONES DE MENÚ: CARNES - CHULETAS ---
        [
            'nombre' => 'Chuleta: Al horno',
            'desc'   => 'Corte de chuleta sazonada con hierbas finas y cocinada lentamente al horno.',
            'precio' => 0.00,
            'cat'    => 'Carne - Chuletas'
        ],
        [
            'nombre' => 'Chuleta: En salsa al curry',
            'desc'   => 'Chuleta bañada en una cremosa y suave salsa al curry especiada.',
            'precio' => 0.00,
            'cat'    => 'Carne - Chuletas'
        ],
        [
            'nombre' => 'Chuleta: En salsa al curry con naranja',
            'desc'   => 'Exquisita fusión agridulce de curry con reducción de zumo de naranja natural.',
            'precio' => 0.00,
            'cat'    => 'Carne - Chuletas'
        ],
        [
            'nombre' => 'Chuleta: En salsa de champiñones',
            'desc'   => 'Chuleta bañada con una reducción aterciopelada de champiñones frescos.',
            'precio' => 0.00,
            'cat'    => 'Carne - Chuletas'
        ],

        // --- OPCIONES DE MENÚ: CARNES - POLLOS ---
        [
            'nombre' => 'Pollo: Al horno',
            'desc'   => 'Filete o presa de pollo dorado y tierno aromatizado con especias al horno.',
            'precio' => 0.00,
            'cat'    => 'Carne - Pollos'
        ],
        [
            'nombre' => 'Pollo: Al vino',
            'desc'   => 'Pollo cocinado en reducción de vino blanco y toques de laurel.',
            'precio' => 0.00,
            'cat'    => 'Carne - Pollos'
        ],
        [
            'nombre' => 'Pollo: En salsa de durazno',
            'desc'   => 'Pechuga tierna glaseada con una delicada salsa de duraznos en almíbar.',
            'precio' => 0.00,
            'cat'    => 'Carne - Pollos'
        ],
        [
            'nombre' => 'Pollo: Al curry',
            'desc'   => 'Pechuga marinada y bañada en salsa dorada de curry clásico.',
            'precio' => 0.00,
            'cat'    => 'Carne - Pollos'
        ],
        [
            'nombre' => 'Pollo: Al ajillo (ajo, vinagre, aceite de oliva)',
            'desc'   => 'Preparación tradicional con láminas de ajo frito, toque de vinagre y aceite de oliva virgen extra.',
            'precio' => 0.00,
            'cat'    => 'Carne - Pollos'
        ],

        // --- OPCIONES DE MENÚ: CARNES - MEDALLONES ---
        [
            'nombre' => 'Medallón: Pollo (jamón y queso)',
            'desc'   => 'Medallón relleno con suave jamón york y queso fundido derretido.',
            'precio' => 0.00,
            'cat'    => 'Carne - Medallones'
        ],
        [
            'nombre' => 'Medallón: Pollo uruguayo en salsa de durazno',
            'desc'   => 'Receta estilo uruguayo cubierta de una sofisticada salsa agridulce de duraznos.',
            'precio' => 0.00,
            'cat'    => 'Carne - Medallones'
        ],
        [
            'nombre' => 'Medallón: Ternera',
            'desc'   => 'Suave y jugoso medallón de ternera seleccionada a punto.',
            'precio' => 0.00,
            'cat'    => 'Carne - Medallones'
        ],
        [
            'nombre' => 'Medallón: Pavo',
            'desc'   => 'Corte magro y delicado de pavo sazonado al estilo banquete.',
            'precio' => 0.00,
            'cat'    => 'Carne - Medallones'
        ],

        // --- OPCIONES DE MENÚ: CARNES - LOMOS (SUBE PLATO A $16.00) ---
        [
            'nombre' => 'Lomo: Res en salsa de champiñones',
            'desc'   => 'Fino corte de lomo de res cocinado a la perfección con salsa cremosa de champiñones.',
            'precio' => 0.00,
            'cat'    => 'Carne - Lomos'
        ],
        [
            'nombre' => 'Lomo: Res al vino de jerez',
            'desc'   => 'Lomo de res sellado y bañado con reducción aromática de vino de Jerez dulce.',
            'precio' => 0.00,
            'cat'    => 'Carne - Lomos'
        ],
        [
            'nombre' => 'Lomo: Cerdo (aceitunas, jamón, queso, tocino y vegetales)',
            'desc'   => 'Lomo de cerdo especial relleno de aceitunas, jamón, queso, crocante tocino y vegetales.',
            'precio' => 0.00,
            'cat'    => 'Carne - Lomos'
        ],
        [
            'nombre' => 'Lomo: Costillas de cerdo a la BBQ',
            'desc'   => 'Costillitas tiernas glaseadas con salsa barbacoa ahumada artesanal.',
            'precio' => 0.00,
            'cat'    => 'Carne - Lomos'
        ],

        // --- OPCIONES DE MENÚ: ARROCES (1 OPCIÓN) ---
        [
            'nombre' => 'Arroz Rosado',
            'desc'   => 'Arroz festivo elaborado con emulsión suave de remolacha y toques de mantequilla.',
            'precio' => 0.00,
            'cat'    => 'Arroz'
        ],
        [
            'nombre' => 'Arroz Verde (albahaca)',
            'desc'   => 'Arroz aromatizado con infusión fresca de albahaca y espinaca al dente.',
            'precio' => 0.00,
            'cat'    => 'Arroz'
        ],
        [
            'nombre' => 'Arroz Blanco con pasas',
            'desc'   => 'Clásico arroz blanco de grano largo salpicado con pasas rubias y morenas.',
            'precio' => 0.00,
            'cat'    => 'Arroz'
        ],
        [
            'nombre' => 'Arroz Blanco con alverjas',
            'desc'   => 'Arroz blanco ligero con tiernas alverjitas dulces al vapor.',
            'precio' => 0.00,
            'cat'    => 'Arroz'
        ],
        [
            'nombre' => 'Arroz Al curry con perejil',
            'desc'   => 'Arroz especiado con curry suave y finas hojas de perejil fresco picado.',
            'precio' => 0.00,
            'cat'    => 'Arroz'
        ],
        [
            'nombre' => 'Arroz Con champiñones',
            'desc'   => 'Arroz cremoso salteado con champiñones frescos y vino blanco.',
            'precio' => 0.00,
            'cat'    => 'Arroz'
        ],
        [
            'nombre' => 'Arroz Oriental (pimiento rojo, verde y amarillo)',
            'desc'   => 'Salteado estilo wok con pimientos tricolor, salsa de soya y ajonjolí.',
            'precio' => 0.00,
            'cat'    => 'Arroz'
        ],
        [
            'nombre' => 'Arroz Primavera (alverja, zanahoria y pimiento rojo)',
            'desc'   => 'Colorida combinación de alverjitas, cubitos de zanahoria y pimiento rojo.',
            'precio' => 0.00,
            'cat'    => 'Arroz'
        ],
        [
            'nombre' => 'Arroz Dorado (jamón y champiñones)',
            'desc'   => 'Arroz salteado dorado con dados de jamón especial y champiñones en mantequilla.',
            'precio' => 0.00,
            'cat'    => 'Arroz'
        ],

        // --- OPCIONES DE MENÚ: ENSALADAS (1 OPCIÓN) ---
        [
            'nombre' => 'Ensalada Rey (jamón, choclo, alverja y coliflor)',
            'desc'   => 'Ensalada festiva con jamón picado, granos de choclo tierno, alverjas y flores de coliflor al vapor.',
            'precio' => 0.00,
            'cat'    => 'Ensalada'
        ],
        [
            'nombre' => 'Ensalada Waldorf (zanahoria, choclo, alverja, piña, apio y manzana)',
            'desc'   => 'Famosa receta agridulce con manzana crujiente, piña, apio fresco, choclo, alverja y zanahoria.',
            'precio' => 0.00,
            'cat'    => 'Ensalada'
        ],
        [
            'nombre' => 'Ensalada Margarita (choclo, brócoli, zanahoria y tocino)',
            'desc'   => 'Nutritiva combinación de choclo dulce, ramitos de brócoli, zanahoria y crocantes trozos de tocino.',
            'precio' => 0.00,
            'cat'    => 'Ensalada'
        ],
        [
            'nombre' => 'Ensalada Fresca (tomate, lechuga y pepinillo)',
            'desc'   => 'Clásica y refrescante con rodajas de tomate maduro, lechuga crespa seleccionada y pepinillo fino.',
            'precio' => 0.00,
            'cat'    => 'Ensalada'
        ],
        [
            'nombre' => 'Ensalada Mediterránea (tomate cherry, lechuga, cebolla perla y vinagreta)',
            'desc'   => 'Selección mediterránea con tomates cherry jugosos, mix de lechugas, cebolla perla y vinagreta de la casa.',
            'precio' => 0.00,
            'cat'    => 'Ensalada'
        ],

        // --- OPCIONES DE MENÚ: PAPAS (1 OPCIÓN) ---
        [
            'nombre' => 'Papas: Al perejil salteadas en mantequilla',
            'desc'   => 'Papas cocidas salteadas en rica mantequilla fundida con lluvia de perejil picado.',
            'precio' => 0.00,
            'cat'    => 'Papas'
        ],
        [
            'nombre' => 'Papas: Al romero',
            'desc'   => 'Papas rústicas perfumadas con romero silvestre fresco y aceite de oliva.',
            'precio' => 0.00,
            'cat'    => 'Papas'
        ],
        [
            'nombre' => 'Papas: Al jamón con queso',
            'desc'   => 'Papas bañadas con trozos de jamón cocido y abundante queso fundido.',
            'precio' => 0.00,
            'cat'    => 'Papas'
        ],
        [
            'nombre' => 'Papas: Al horno (cocidas y terminadas al horno)',
            'desc'   => 'Papas previamente cocidas y doradas a alta temperatura con un toque crujiente.',
            'precio' => 0.00,
            'cat'    => 'Papas'
        ],
        [
            'nombre' => 'Papas: Salteadas con ajo y mantequilla',
            'desc'   => 'Papas tiernas salteadas con ajo finamente picado y mantequilla de campo.',
            'precio' => 0.00,
            'cat'    => 'Papas'
        ],
        [
            'nombre' => 'Papas: Gratinada con cáscara, bañada en ajo y mantequilla',
            'desc'   => 'Papas con cáscara dorada, gratinadas al horno y bañadas con infusión de ajo y mantequilla.',
            'precio' => 0.00,
            'cat'    => 'Papas'
        ],

        // --- OPCIONES DE MENÚ: ARREGLOS FRUTALES (1 OPCIÓN) ---
        [
            'nombre' => 'Arreglo Frutal: Cisne de Frutas',
            'desc'   => 'Elegante escultura artística tallada a mano en frutas de temporada formando un cisne ornamental para el buffet.',
            'precio' => 0.00,
            'cat'    => 'Arreglo Frutal'
        ],
        [
            'nombre' => 'Arreglo Frutal: Corazón de Frutas',
            'desc'   => 'Romántico arreglo tallado con brochetas y formas de corazón con variedad de frutas selectas.',
            'precio' => 0.00,
            'cat'    => 'Arreglo Frutal'
        ]
    ];

    // Limpiar tabla servicios para insertar el catálogo maestro limpio
    $pdo->exec("DELETE FROM servicios");
    $pdo->exec("ALTER TABLE servicios AUTO_INCREMENT = 1");

    $stmtInsert = $pdo->prepare("
        INSERT INTO servicios (nombre_servicio, descripcion, precio_referencial, categoria, estado)
        VALUES (:nombre, :desc, :precio, :cat, 1)
    ");

    $totalInsertados = 0;
    foreach ($serviciosCatalogo as $s) {
        $stmtInsert->execute([
            ':nombre' => $s['nombre'],
            ':desc'   => $s['desc'],
            ':precio' => $s['precio'],
            ':cat'    => $s['cat']
        ]);
        $totalInsertados++;
    }

    $response = [
        'success'             => true,
        'mensaje'             => "Catálogo de Servicios RF03 inicializado exitosamente. {$totalInsertados} servicios registrados.",
        'columnas_agregadas'  => $columnasAgregadas,
        'total_servicios'     => $totalInsertados
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
