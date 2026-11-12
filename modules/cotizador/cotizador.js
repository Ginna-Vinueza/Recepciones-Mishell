/**
 * Módulo de Servicios, Catálogo de Eventos (RF03) y Cotizador Inteligente (RF04)
 * Incluye Administración Integral para Super Administrador + Auditoría en BD (historial_acciones)
 * Plataforma Web Recepciones Mishell - Quito 2026
 */

(() => {
  // Generador de las 48 franjas horarias del día (00:00 a 23:30)
  function generarOpciones24Horas() {
    const lista = [];
    for (let h = 0; h < 24; h++) {
      for (const m of [0, 30]) {
        const hh = String(h).padStart(2, '0');
        const mm = String(m).padStart(2, '0');
        const valor24 = `${hh}:${mm}`;
        const sufijo = h < 12 ? 'AM' : 'PM';
        const h12 = h % 12 === 0 ? 12 : h % 12;
        const hh12 = String(h12).padStart(2, '0');
        let periodo = 'Madrugada';
        if (h >= 6 && h < 12) periodo = 'Mañana';
        else if (h >= 12 && h < 18) periodo = 'Tarde';
        else if (h >= 18) periodo = 'Noche';

        lista.push({
          valor: valor24,
          etiqueta: `${valor24} hrs (${hh12}:${mm} ${sufijo})`,
          corta: `${valor24}`,
          sub: `${hh12}:${mm} ${sufijo}`,
          periodo
        });
      }
    }
    return lista;
  }

  const HORARIOS_24H = generarOpciones24Horas();

  // Estado local reactivo de la cotización
  const estadoCotizador = {
    pasoActual: 1,
    cliente: null,
    busquedaClienteTexto: '',
    mensajeBusquedaError: '',
    mensajeBusquedaExito: '',
    fechaEvento: '',
    fechaBloqueadaEnCalendario: false,
    detalleReservaBloqueante: null,
    horaInicio: '15:30',
    filtroPeriodoHora: 'Todas',
    cantidadPersonas: 60,
    tiposEvento: ['Cumpleaños'],
    coloresManteleria: ['Dorado'],
    horasEvento: 5,
    horasExtra: 0,
    menu: {
      carnes: [], // Exactamente 2 opciones obligatorias
      arroz: 'Arroz Verde (albahaca)',
      ensalada: 'Ensalada Waldorf (zanahoria, choclo, alverja, piña, apio y manzana)',
      papas: 'Papas: Gratinada con cáscara, bañada en ajo y mantequilla',
      arregloFrutal: 'Cisne de Frutas'
    },
    observaciones: '',
    cotizacionGuardada: null,
    cotizacionesGuardadasLista: [],
    filtroCotizacionesGuardadas: '',
    catalogo: null,
    esSuperAdmin: true
  };

  /**
   * Inicialización del módulo
   */
  function initCotizadorModule() {
    if (!estadoCotizador.fechaEvento) {
      const fechaDef = new Date();
      fechaDef.setDate(fechaDef.getDate() + 15);
      estadoCotizador.fechaEvento = fechaDef.toISOString().split('T')[0];
    }

    Promise.all([
      cargarCatalogoServicios(),
      cargarListaCotizacionesGuardadas()
    ]).then(() => {
      sincronizarSeleccionInicialConCatalogo();
      renderEstructuraPrincipal();
      verificarClientePreseleccionado();
    });
  }

  /**
   * Carga las cotizaciones realizadas y guardadas en la base de datos para poder verlas e imprimirlas
   */
  async function cargarListaCotizacionesGuardadas() {
    try {
      const res = await fetch('modules/cotizador/cotizaciones_api.php?action=listar&limit=100');
      const data = await res.json();
      if (data.success && Array.isArray(data.cotizaciones)) {
        estadoCotizador.cotizacionesGuardadasLista = data.cotizaciones;
        const badgeCount = document.getElementById('badge-count-cotiz-guardadas');
        if (badgeCount) {
          badgeCount.textContent = String(estadoCotizador.cotizacionesGuardadasLista.length);
        }
      }
    } catch (err) {
      console.error('Error al cargar cotizaciones guardadas:', err);
    }
  }

  /**
   * Carga el catálogo maestro oficial desde servicios_api.php (RF03)
   */
  async function cargarCatalogoServicios() {
    try {
      const res = await fetch('modules/servicios/servicios_api.php?action=catalogo_completo');
      const data = await res.json();
      if (data.success && data.catalogo) {
        estadoCotizador.catalogo = data.catalogo;
        if (data.rol_usuario) {
          estadoCotizador.esSuperAdmin = data.rol_usuario === 'Administrador';
        }
      } else {
        console.error('Error al cargar catálogo:', data.error);
      }
    } catch (err) {
      console.error('Error de red al consultar catálogo RF03:', err);
    }
  }

  /**
   * Garantiza que las opciones por defecto de arroz, ensalada, papas y frutas coincidan con el catálogo activo
   */
  function sincronizarSeleccionInicialConCatalogo() {
    const cat = estadoCotizador.catalogo;
    if (!cat || !cat.menu) return;

    const arroces = cat.menu.arroces?.items || [];
    if (arroces.length > 0 && !arroces.some(a => a.nombre === estadoCotizador.menu.arroz)) {
      estadoCotizador.menu.arroz = arroces[0].nombre;
    }

    const ensaladas = cat.menu.ensaladas?.items || [];
    if (ensaladas.length > 0 && !ensaladas.some(e => e.nombre === estadoCotizador.menu.ensalada)) {
      estadoCotizador.menu.ensalada = ensaladas[0].nombre;
    }

    const papas = cat.menu.papas?.items || [];
    if (papas.length > 0 && !papas.some(p => p.nombre === estadoCotizador.menu.papas)) {
      estadoCotizador.menu.papas = papas[0].nombre;
    }

    const frutas = cat.menu.arreglos_frutales?.items || [];
    if (frutas.length > 0) {
      const nombresFrutas = frutas.map(f => f.nombre_limpio || f.nombre);
      if (!nombresFrutas.includes(estadoCotizador.menu.arregloFrutal)) {
        estadoCotizador.menu.arregloFrutal = nombresFrutas[0];
      }
    }
  }

  /**
   * Verifica si el usuario vino de la vista de Clientes o del Calendario con cliente/fecha preseleccionados
   */
  function verificarClientePreseleccionado() {
    if (window.clienteSeleccionadoParaCotizar) {
      seleccionarCliente(window.clienteSeleccionadoParaCotizar);
      window.clienteSeleccionadoParaCotizar = null;
    }
    if (window.fechaPreseleccionadaParaCotizar) {
      estadoCotizador.fechaEvento = window.fechaPreseleccionadaParaCotizar;
      window.fechaPreseleccionadaParaCotizar = null;
      const inputF = document.getElementById('cotiz-fecha-evento');
      if (inputF) {
        inputF.value = estadoCotizador.fechaEvento;
      }
      verificarDisponibilidadFechaEnPaso1(estadoCotizador.fechaEvento);
      if (estadoCotizador.pasoActual !== 1) {
        cambiarPasoVisual(1);
      }
    }
  }

  /**
   * Escape HTML seguro
   */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

  /**
   * Renderiza el contenedor principal y el esqueleto del wizard
   */
  function renderEstructuraPrincipal() {
    const container = document.getElementById('cotizador-component-container');
    if (!container) return;

    const p = estadoCotizador.pasoActual;

    container.innerHTML = `
      <!-- Encabezado del Cotizador Inteligente -->
      <div class="cotizador-header-row">
        <div>
          <div class="cotizador-badge-rf">
            Módulo RF03 & RF04 • ${estadoCotizador.esSuperAdmin ? 'Modo Super Administrador Activo' : 'Catálogo & Cotizador'}
          </div>
          <h2 class="cotizador-title">Cotizador Inteligente de Eventos</h2>
          <p class="cotizador-subtitle">Cálculo automatizado de proformas, administración de catálogo e historial en base de datos.</p>
        </div>
        <div class="cotizador-header-actions">
          <button type="button" class="btn-catalog-peek btn-saved-quotes-header" id="btn-ver-cotizaciones-guardadas" title="Ver cotizaciones realizadas y guardadas para imprimirlas las veces que sean necesarias">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            <span>Cotizaciones Guardadas</span>
            <span class="saved-quotes-count-pill" id="badge-count-cotiz-guardadas">${estadoCotizador.cotizacionesGuardadasLista.length}</span>
          </button>
          <button type="button" class="btn-catalog-peek btn-audit-history" id="btn-ver-historial-bd" title="Ver Historial de Acciones y Cotizaciones en Base de Datos">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 8v4l3 3"/>
              <circle cx="12" cy="12" r="9"/>
            </svg>
            <span>Historial & Auditoría BD</span>
          </button>
          <button type="button" class="btn-catalog-peek" id="btn-ver-catalogo-rf03" title="Consultar Catálogo de Servicios RF03">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
            <span>Catálogo Oficial (RF03)</span>
          </button>
        </div>
      </div>

      <!-- Barra de Progreso / Stepper Visual (Figuras 8, 9, 10 y 11) -->
      <div class="cotizador-stepper-container" role="tablist">
        <button type="button" class="step-node ${p === 1 ? 'active' : (p > 1 ? 'completed' : '')}" id="step-node-1" data-step="1">
          <span class="step-num">1</span>
          <span class="step-label">Cliente & Fecha</span>
          <span class="step-sublabel">Figura 8</span>
        </button>

        <button type="button" class="step-node ${p === 2 ? 'active' : (p > 2 ? 'completed' : '')}" id="step-node-2" data-step="2">
          <span class="step-num">2</span>
          <span class="step-label">Servicios & Evento</span>
          <span class="step-sublabel">Figura 9</span>
        </button>

        <button type="button" class="step-node ${p === 3 ? 'active' : (p > 3 ? 'completed' : '')}" id="step-node-3" data-step="3">
          <span class="step-num">3</span>
          <span class="step-label">Menú de Buffet</span>
          <span class="step-sublabel">Figura 10</span>
        </button>

        <button type="button" class="step-node ${p === 4 ? 'active' : ''}" id="step-node-4" data-step="4">
          <span class="step-num">4</span>
          <span class="step-label">Resumen & Proforma</span>
          <span class="step-sublabel">Figura 11</span>
        </button>
      </div>

      <!-- Alerta global de validación -->
      <div id="cotizador-validation-alert" class="alert-feedback alert-error" style="display:none; margin-bottom: 1rem;"></div>

      <!-- Contenedor Dinámico de Pasos -->
      <div class="cotizador-step-viewport">
        <!-- PASO 1 (FIGURA 8) -->
        <div class="step-pane ${p === 1 ? 'active' : ''}" id="step-pane-1">
          ${renderPaso1Html()}
        </div>

        <!-- PASO 2 (FIGURA 9 - RF03) -->
        <div class="step-pane ${p === 2 ? 'active' : ''}" id="step-pane-2">
          ${renderPaso2Html()}
        </div>

        <!-- PASO 3 (FIGURA 10 - RF03) -->
        <div class="step-pane ${p === 3 ? 'active' : ''}" id="step-pane-3">
          ${renderPaso3Html()}
        </div>

        <!-- PASO 4 (FIGURA 11 - LIQUIDACIÓN Y PROFORMA) -->
        <div class="step-pane ${p === 4 ? 'active' : ''}" id="step-pane-4">
          <div id="resumen-final-wrapper">
            ${p === 4 ? renderPaso4Html() : ''}
          </div>
        </div>

        <!-- Navegación Inferior en la misma pantalla (Solo botones Atrás y Siguiente según corresponda) -->
        <div class="cotizador-bottom-nav-inline no-print" id="cotizador-bottom-nav-inline">
          <div class="bottom-nav-left">
            <button type="button" class="btn-step-prev" id="btn-step-prev" style="${p === 1 ? 'display:none;' : 'display:inline-flex;'}">
              ← Atrás
            </button>
          </div>
          <div class="bottom-nav-right">
            <button type="button" class="btn-step-next" id="btn-step-next" style="${p === 4 ? 'display:none;' : 'display:inline-flex;'}">
              Siguiente →
            </button>
          </div>
        </div>
      </div>

      <!-- Modal de Consulta: Catálogo Oficial de Servicios (RF03) -->
      <div id="modal-catalogo-rf03" class="modal-backdrop" aria-hidden="true" role="dialog">
        <div class="modal-card modal-card-lg">
          <div class="modal-header">
            <div>
              <h3 class="modal-title">Catálogo Oficial de Servicios y Eventos (RF03)</h3>
              <p class="modal-subtitle-sm">Especificaciones técnicas de banquete, mobiliario y menú para Recepciones Mishell.</p>
            </div>
            <button type="button" class="modal-close-btn" id="btn-cerrar-modal-catalogo">✕</button>
          </div>
          <div class="modal-body" id="modal-catalogo-body"></div>
        </div>
      </div>

      <!-- Modal Super Administrador: Agregar Registro al Catálogo -->
      <div id="modal-admin-catalogo" class="modal-backdrop" aria-hidden="true" role="dialog">
        <div class="modal-card">
          <div class="modal-header">
            <div>
              <h3 class="modal-title" id="modal-admin-cat-title">Agregar Nuevo Registro</h3>
              <p class="modal-subtitle-sm">La acción quedará registrada en el historial de auditoría de la base de datos.</p>
            </div>
            <button type="button" class="modal-close-btn" id="btn-cerrar-modal-admin-cat">✕</button>
          </div>
          <form id="form-admin-catalogo" class="modal-body">
            <input type="hidden" id="admin-item-categoria" value="">
            <div id="admin-item-alert" class="alert-feedback alert-error" style="display:none;"></div>

            <div class="form-group">
              <label for="admin-item-nombre" class="form-label">
                Nombre de la Opción / Registro <span class="text-danger">*</span>
              </label>
              <input type="text" id="admin-item-nombre" class="form-control" style="padding: 0 0.875rem;" placeholder="Ej. Aniversario de Bodas / Lomo Fino en Salsa..." required>
            </div>

            <div class="form-group" id="group-admin-color-hex" style="display:none;">
              <label for="admin-item-color-hex" class="form-label">Color Representativo (Selector)</label>
              <div style="display:flex; align-items:center; gap:0.75rem;">
                <input type="color" id="admin-item-color-hex" value="#C86D3B" style="width:52px; height:42px; border:1px solid #CBD5E1; border-radius:8px; cursor:pointer; padding:2px;">
                <span class="form-helper-text" style="margin:0;">Seleccione el tono para la vista previa del lazo y cubremantel.</span>
              </div>
            </div>

            <div class="form-group">
              <label for="admin-item-desc" class="form-label">Descripción / Ingredientes / Detalles</label>
              <input type="text" id="admin-item-desc" class="form-control" style="padding: 0 0.875rem;" placeholder="Descripción breve para el catálogo oficial...">
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-secondary" id="btn-cancelar-modal-admin-cat">Cancelar</button>
              <button type="submit" class="btn-primary" id="btn-guardar-admin-cat">Guardar en Base de Datos</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Modal Super Administrador: Registrar Cliente Rápido desde Cotizador -->
      <div id="modal-cotiz-nuevo-cliente" class="modal-backdrop" aria-hidden="true" role="dialog">
        <div class="modal-card">
          <div class="modal-header">
            <div>
              <h3 class="modal-title">Registrar Nuevo Cliente</h3>
              <p class="modal-subtitle-sm">Se guardará en el directorio de clientes y en el historial de auditoría.</p>
            </div>
            <button type="button" class="modal-close-btn" id="btn-cerrar-modal-cotiz-cli">✕</button>
          </div>
          <form id="form-cotiz-nuevo-cliente" class="modal-body">
            <div id="cotiz-cli-modal-alert" class="alert-feedback alert-error" style="display:none;"></div>
            <div class="form-group">
              <label class="form-label">Cédula o RUC (10 o 13 dígitos) <span class="text-danger">*</span></label>
              <input type="text" id="cotiz-nuevo-cli-cedula" class="form-control" style="padding: 0 0.875rem;" maxlength="13" placeholder="Ej. 1714589201" required>
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Nombres <span class="text-danger">*</span></label>
                <input type="text" id="cotiz-nuevo-cli-nombres" class="form-control" style="padding: 0 0.875rem;" placeholder="Ej. María Fernanda" required>
              </div>
              <div class="form-group">
                <label class="form-label">Apellidos <span class="text-danger">*</span></label>
                <input type="text" id="cotiz-nuevo-cli-apellidos" class="form-control" style="padding: 0 0.875rem;" placeholder="Ej. Gómez Castro" required>
              </div>
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Teléfono Móvil</label>
                <input type="tel" id="cotiz-nuevo-cli-telefono" class="form-control" style="padding: 0 0.875rem;" placeholder="0991234567">
              </div>
              <div class="form-group">
                <label class="form-label">Correo Electrónico</label>
                <input type="email" id="cotiz-nuevo-cli-correo" class="form-control" style="padding: 0 0.875rem;" placeholder="cliente@correo.com">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Dirección / Sector</label>
              <input type="text" id="cotiz-nuevo-cli-direccion" class="form-control" style="padding: 0 0.875rem;" placeholder="Quito, Pichincha">
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" id="btn-cancelar-modal-cotiz-cli">Cancelar</button>
              <button type="submit" class="btn-primary" id="btn-guardar-cotiz-cli">Registrar y Seleccionar</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Modal Super Administrador: Historial de Acciones (Auditoría BD) y Gestión de Cotizaciones -->
      <div id="modal-historial-bd" class="modal-backdrop" aria-hidden="true" role="dialog">
        <div class="modal-card modal-card-lg" style="max-width: 780px !important;">
          <div class="modal-header">
            <div>
              <h3 class="modal-title">Bitácora de Auditoría e Historial en Base de Datos</h3>
              <p class="modal-subtitle-sm">Registro histórico de altas, bajas y cotizaciones realizadas por el Super Administrador.</p>
            </div>
            <button type="button" class="modal-close-btn" id="btn-cerrar-modal-historial">✕</button>
          </div>
          <div class="modal-body" id="modal-historial-body">
            <p>Cargando registros históricos...</p>
          </div>
        </div>
      </div>

      <!-- Modal de Cotizaciones Realizadas y Guardadas (Listas para Ver e Imprimir las veces que sean necesarias) -->
      <div id="modal-cotizaciones-guardadas" class="modal-backdrop" aria-hidden="true" role="dialog">
        <div class="modal-card modal-card-lg" style="max-width: 820px !important;">
          <div class="modal-header">
            <div>
              <h3 class="modal-title">Cotizaciones Realizadas y Guardadas</h3>
              <p class="modal-subtitle-sm">Seleccione cualquier cotización guardada para visualizar su proforma o imprimirla las veces que sean necesarias.</p>
            </div>
            <button type="button" class="modal-close-btn" id="btn-cerrar-modal-cotiz-guardadas">✕</button>
          </div>
          <div class="modal-body" id="modal-cotiz-guardadas-body">
            <p>Cargando cotizaciones guardadas...</p>
          </div>
        </div>
      </div>
    `;

    bindGlobalEvents();
    bindStep1Events();
    bindStep2Events();
    bindStep3Events();
    if (p === 4) {
      bindStep4Events();
    }
    calcularTotales();
  }

  /**
   * =========================================================================
   * PASO 1 (FIGURA 8): BÚSQUEDA Y SELECCIÓN DE CLIENTE, FECHA Y HORA 24H
   * =========================================================================
   */
  function renderPaso1Html() {
    const cli = estadoCotizador.cliente;
    let iniciales = '--';
    let nombreCompleto = '';
    if (cli) {
      nombreCompleto = `${cli.nombres || ''} ${cli.apellidos || ''}`.trim();
      const partes = nombreCompleto.split(' ').filter(Boolean);
      if (partes.length >= 2) {
        iniciales = (partes[0][0] + partes[1][0]).toUpperCase();
      } else if (partes.length === 1) {
        iniciales = partes[0].substring(0, 2).toUpperCase();
      }
    }

    const infoHoraActual = HORARIOS_24H.find(h => h.valor === estadoCotizador.horaInicio) || {
      valor: estadoCotizador.horaInicio,
      etiqueta: `${estadoCotizador.horaInicio} hrs`
    };

    const horariosFiltrados = estadoCotizador.filtroPeriodoHora === 'Todas'
      ? HORARIOS_24H
      : HORARIOS_24H.filter(h => h.periodo === estadoCotizador.filtroPeriodoHora);

    return `
      <div class="step-card">
        <div class="step-card-header" style="justify-content: space-between; flex-wrap: wrap;">
          <div style="display:flex; align-items:center; gap:0.875rem;">
            <div class="step-icon-badge">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/>
                <line x1="22" y1="11" x2="16" y2="11"/>
              </svg>
            </div>
            <div>
              <h3 class="step-card-title">Paso 1: Titular del Evento y Fecha Propuesta</h3>
              <p class="step-card-desc">Busque al cliente por número de cédula/RUC y defina la fecha y hora de inicio del evento.</p>
            </div>
          </div>
          ${estadoCotizador.esSuperAdmin ? `
            <button type="button" class="btn-admin-add-inline" id="btn-abrir-nuevo-cliente-paso1" title="Registrar un nuevo cliente en la base de datos">
              + Nuevo Cliente
            </button>
          ` : ''}
        </div>

        <div class="step-form-grid">
          <!-- Búsqueda reactiva de cliente por Cédula, RUC o Nombre -->
          <div class="form-group full-width">
            <label for="cotiz-buscar-cliente-input" class="form-label">
              Buscar Cliente Registrado (Ingrese Número de Cédula, RUC o Nombre) <span class="text-danger">*</span>
            </label>
            <div class="search-input-group">
              <input 
                type="text" 
                id="cotiz-buscar-cliente-input" 
                class="form-control" 
                style="padding: 0 1rem;"
                placeholder="Ingrese el número de cédula (ej. 1714589201) o nombre del cliente..."
                value="${escapeHtml(estadoCotizador.busquedaClienteTexto)}"
                autocomplete="off"
              >
              <button type="button" class="btn-inline-search" id="btn-buscar-cliente-action">
                Buscar
              </button>
            </div>
            <div id="cotiz-search-results" class="cotiz-search-dropdown" style="display:none;"></div>

            <!-- Mensaje cuando el cliente NO se encuentra registrado -->
            <div id="cotiz-cliente-not-found-msg" class="alert-feedback alert-error" style="${estadoCotizador.mensajeBusquedaError ? 'display:flex;' : 'display:none;'} margin-top: 0.75rem; justify-content: space-between; flex-wrap: wrap;">
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span id="cotiz-cliente-not-found-text">${escapeHtml(estadoCotizador.mensajeBusquedaError)}</span>
              </div>
              <button type="button" class="btn-admin-add-inline" id="btn-registrar-cliente-desde-alerta" style="background:#991B1B; color:#FFF; border:none;">
                + Registrar Cliente
              </button>
            </div>

            <!-- Mensaje de confirmación cuando se localiza al cliente -->
            <div id="cotiz-cliente-found-msg" class="alert-feedback alert-success" style="${estadoCotizador.mensajeBusquedaExito ? 'display:flex;' : 'display:none;'} margin-top: 0.75rem;">
              <span id="cotiz-cliente-found-text">${escapeHtml(estadoCotizador.mensajeBusquedaExito)}</span>
            </div>
          </div>

          <!-- Tarjeta del Cliente Seleccionado -->
          <div class="form-group full-width" id="cliente-seleccionado-card" style="${cli ? 'display:block;' : 'display:none;'}">
            <div class="client-selected-banner">
              <div class="client-selected-avatar">
                <span id="cs-iniciales">${escapeHtml(iniciales)}</span>
              </div>
              <div class="client-selected-info">
                <div class="client-selected-top">
                  <h4 class="client-selected-name" id="cs-nombre">${escapeHtml(nombreCompleto || 'Nombre de Cliente')}</h4>
                  <span class="badge-frecuente-pill" id="cs-badge-frecuente" style="${cli && cli.total_eventos > 0 ? 'display:inline-flex;' : 'display:none;'}">★ Cliente Frecuente</span>
                  <span class="badge-verified" style="font-size:0.65rem; background:#DCFCE7; color:#166534; padding:0.1rem 0.45rem; border-radius:999px; font-weight:700;">✓ Registrado</span>
                </div>
                <div class="client-selected-meta">
                  <span><strong>C.I./RUC:</strong> <code id="cs-cedula">${escapeHtml(cli?.cedula_ruc || '--')}</code></span>
                  <span><strong>Teléfono:</strong> <span id="cs-telefono">${escapeHtml(cli?.telefono || 'Sin teléfono')}</span></span>
                  <span><strong>Correo:</strong> <span id="cs-correo">${escapeHtml(cli?.correo || 'Sin correo')}</span></span>
                  ${cli?.direccion ? `<span><strong>Dirección:</strong> <span id="cs-direccion">${escapeHtml(cli.direccion)}</span></span>` : ''}
                </div>
              </div>
              <div style="display:flex; flex-direction:column; gap:0.35rem;">
                <button type="button" class="btn-client-remove" id="btn-cambiar-cliente" title="Limpiar selección y buscar otro cliente">
                  Cambiar
                </button>
                ${estadoCotizador.esSuperAdmin && cli ? `
                  <button type="button" class="btn-client-delete-admin" id="btn-eliminar-cliente-actual" data-id="${cli.id_cliente}" title="Eliminar cliente de la base de datos">
                    Eliminar BD
                  </button>
                ` : ''}
              </div>
            </div>
          </div>

          <!-- Fecha propuesta con verificación de disponibilidad en Calendario (RF05 / RF06) -->
          <div class="form-group full-width">
            <label for="cotiz-fecha-evento" class="form-label">
              Fecha Propuesta del Evento <span class="text-danger">*</span>
            </label>
            <input 
              type="date" 
              id="cotiz-fecha-evento" 
              class="form-control" 
              style="padding: 0 1rem;"
              value="${escapeHtml(estadoCotizador.fechaEvento)}"
              min="${new Date().toISOString().split('T')[0]}"
            >
            <div id="cotiz-fecha-disponibilidad-badge" class="res-date-check-hint" style="margin-top:0.35rem;">
              Consultando disponibilidad en el Calendario de Reservas...
            </div>
          </div>

          <!-- Hora de inicio (Selector interactivo de 24 horas con medias horas, ej. 15:30) -->
          <div class="form-group full-width">
            <div class="time-picker-24h-card">
              <div class="time-picker-24h-header">
                <div>
                  <label for="cotiz-hora-inicio" class="form-label" style="margin-bottom:0.15rem; display:block;">
                    Hora de Inicio Sugerida (Formato 24 Horas + Medias Horas) <span class="text-danger">*</span>
                  </label>
                  <small class="form-helper-text" style="margin-top:0;">
                    Seleccione cualquier hora de las 24 horas del día incluyendo medias horas (ej. <strong>15:30</strong>).
                  </small>
                </div>
                <div class="time-selected-badge" id="badge-hora-seleccionada">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <span id="texto-hora-seleccionada">${escapeHtml(infoHoraActual.etiqueta)}</span>
                </div>
              </div>

              <!-- Selector desplegable directo con las 48 opciones (00:00 a 23:30) -->
              <div style="margin-bottom: 0.75rem;">
                <select id="cotiz-hora-inicio" class="form-control" style="padding: 0 0.875rem; font-weight: 700;">
                  ${HORARIOS_24H.map(item => `
                    <option value="${item.valor}" ${estadoCotizador.horaInicio === item.valor ? 'selected' : ''}>
                      ${item.etiqueta} — ${item.periodo}
                    </option>
                  `).join('')}
                </select>
              </div>

              <!-- Pestañas por franja del día para selección visual rápida -->
              <div class="time-period-tabs" role="tablist" aria-label="Filtrar por periodo del día">
                ${['Todas', 'Madrugada', 'Mañana', 'Tarde', 'Noche'].map(per => `
                  <button 
                    type="button" 
                    class="time-period-tab ${estadoCotizador.filtroPeriodoHora === per ? 'active' : ''}" 
                    data-periodo="${per}"
                  >
                    ${per === 'Todas' ? '24 Horas (Todas)' : per}
                  </button>
                `).join('')}
              </div>

              <!-- Cuadrícula interactiva de horas y medias horas (00:00, 00:30 ... 15:30 ... 23:30) -->
              <div class="time-slots-grid-24h" id="grid-horas-24h">
                ${horariosFiltrados.map(item => `
                  <button 
                    type="button" 
                    class="btn-time-slot-24h ${estadoCotizador.horaInicio === item.valor ? 'active' : ''}" 
                    data-time="${item.valor}"
                    title="${item.etiqueta}"
                  >
                    <span class="slot-24h-main">${item.corta}</span>
                    <span class="slot-24h-sub">${item.sub}</span>
                  </button>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * =========================================================================
   * PASO 2 (FIGURA 9 - RF03): SERVICIOS Y CATÁLOGO DE EVENTOS
   * =========================================================================
   */
  function renderPaso2Html() {
    const cat = estadoCotizador.catalogo;

    // 1. Servicios incluidos desde BD (o respaldo por defecto)
    const serviciosIncluidos = (cat && Array.isArray(cat.servicios_incluidos) && cat.servicios_incluidos.length > 0)
      ? cat.servicios_incluidos
      : [
          { id_servicio: 4, nombre: 'Mantelería', descripcion: 'Vestidos de sillas y manteles blancos impecables con lazos al gusto.' },
          { id_servicio: 5, nombre: 'Cristalería', descripcion: 'Copas de cristal para brindis y vasos de gala.' },
          { id_servicio: 6, nombre: 'Vajilla', descripcion: 'Vajilla completa de cerámica y cubertería de acero inoxidable.' },
          { id_servicio: 7, nombre: 'Sillas', descripcion: 'Sillas confortables vestidas de blanco para todos los asistentes.' },
          { id_servicio: 8, nombre: 'Mesas', descripcion: 'Mesas redondas amplias de banquete para 10 comensales.' },
          { id_servicio: 9, nombre: 'Pastel', descripcion: 'Pastel conmemorativo del evento incluido en el paquete.' },
          { id_servicio: 10, nombre: 'Postre', descripcion: 'Mesa de postres finos variados para degustación.' },
          { id_servicio: 11, nombre: 'Luces Robóticas', descripcion: 'Cabezas móviles inteligentes DMX y efectos de pista de baile.' },
          { id_servicio: 12, nombre: 'Meseros Profesionales', descripcion: 'Personal uniformado para servicio de banquete y bebidas a mesa.' },
          { id_servicio: 13, nombre: 'Maestro de Ceremonias, DJ', descripcion: 'Animación protocolaria, sonido profesional y mezcla en vivo.' },
          { id_servicio: 14, nombre: 'Guardia y cámaras de video vigilancia en las instalaciones', descripcion: 'Seguridad física y monitoreo permanente en las instalaciones.' }
        ];

    // 2. Tipos de evento desde BD (o respaldo por defecto)
    const tiposEventoItems = (cat && Array.isArray(cat.tipos_evento_items) && cat.tipos_evento_items.length > 0)
      ? cat.tipos_evento_items
      : [
          { id_servicio: 15, nombre: 'Cumpleaños' },
          { id_servicio: 16, nombre: 'Boda' },
          { id_servicio: 17, nombre: 'Graduación' },
          { id_servicio: 18, nombre: 'Bautizo' },
          { id_servicio: 19, nombre: 'Primera Comunión' },
          { id_servicio: 20, nombre: 'Reuniones Sociales' }
        ];

    // 3. Colores de mantelería desde BD (o respaldo por defecto)
    const colores = (cat && Array.isArray(cat.colores_manteleria) && cat.colores_manteleria.length > 0)
      ? cat.colores_manteleria
      : [
          { id_servicio: 21, id: 'Rosado', nombre: 'Rosado', color_hex: '#EC4899', bg_preview: '#FCE7F3' },
          { id_servicio: 22, id: 'Lila', nombre: 'Lila', color_hex: '#A855F7', bg_preview: '#F3E8FF' },
          { id_servicio: 23, id: 'Dorado', nombre: 'Dorado', color_hex: '#D4AF37', bg_preview: '#FEF3C7' },
          { id_servicio: 24, id: 'Fucsia', nombre: 'Fucsia', color_hex: '#BE185D', bg_preview: '#FDF2F8' },
          { id_servicio: 25, id: 'Azul', nombre: 'Azul', color_hex: '#1D4ED8', bg_preview: '#EFF6FF' }
        ];

    // Orden solicitado para Horas Extra: primero +1h a +5h y "Sin extra" (0) al final del listado
    const ordenHorasExtra = [1, 2, 3, 4, 5, 0];

    return `
      <div class="step-card">
        <div class="step-card-header">
          <div class="step-icon-badge">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
          </div>
          <div>
            <h3 class="step-card-title">Paso 2: Parámetros del Evento y Servicios de Gala (RF03)</h3>
            <p class="step-card-desc">Defina la cantidad de invitados (máx 120), tipos de celebración, mantelería y duración.</p>
          </div>
        </div>

        <!-- 1. CANTIDAD DE PERSONAS (OBLIGATORIO, MÁXIMO 120 PERSONAS) -->
        <div class="capacity-selector-card">
          <div class="capacity-top-row">
            <div>
              <label for="cotiz-personas-slider" class="capacity-title">
                Cantidad de Personas <span class="text-danger">*</span>
              </label>
              <p class="capacity-desc">
                Obligatorio de seleccionar. Salón con capacidad máxima autorizada de <strong>120 personas</strong>.
              </p>
            </div>
            <div class="capacity-display-box">
              <span class="capacity-number" id="capacity-number-val">${estadoCotizador.cantidadPersonas}</span>
              <span class="capacity-unit">invitados</span>
            </div>
          </div>

          <div class="capacity-slider-wrapper">
            <input 
              type="range" 
              id="cotiz-personas-slider" 
              class="capacity-range-slider" 
              min="1" 
              max="120" 
              value="${estadoCotizador.cantidadPersonas}"
            >
            <div class="capacity-range-labels">
              <span>1 persona (Mín)</span>
              <span>60 pers.</span>
              <span class="capacity-max-label">120 personas (Máx)</span>
            </div>
          </div>

          <div class="capacity-pills-row">
            <span class="pills-title">Acceso rápido:</span>
            ${[30, 50, 60, 80, 100, 120].map(num => `
              <button type="button" class="btn-preset-pill ${estadoCotizador.cantidadPersonas === num ? 'active' : ''}" data-persons="${num}">
                ${num === 120 ? '120 pers. (Lleno Total)' : `${num} pers.`}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- 2. SERVICIOS INCLUIDOS EN EL PAQUETE -->
        <div class="included-services-section">
          <div class="section-title-with-badge">
            <div>
              <h4 class="section-heading">Servicios Incluidos en el Paquete Base</h4>
              <span class="badge-included-all">${serviciosIncluidos.length} Servicios Garantizados • $0.00 Adicional</span>
            </div>
            ${estadoCotizador.esSuperAdmin ? `
              <button type="button" class="btn-admin-add-inline" data-admin-add="Servicio Incluido" data-admin-title="Agregar Servicio Incluido al Paquete">
                + Agregar Servicio
              </button>
            ` : ''}
          </div>
          <p class="section-description">
            Al seleccionar la cantidad de personas, su cotización incluye de manera integral y sin costos ocultos:
          </p>

          <div class="included-services-grid">
            ${serviciosIncluidos.map(s => `
              <div class="included-service-item" style="position:relative;">
                <div class="included-check-icon" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <div class="included-service-text" style="flex:1; padding-right: ${estadoCotizador.esSuperAdmin ? '1.25rem' : '0'};">
                  <strong class="included-name">${escapeHtml(s.nombre)}</strong>
                  <span class="included-desc">${escapeHtml(s.descripcion || s.desc || '')}</span>
                </div>
                ${estadoCotizador.esSuperAdmin && s.id_servicio ? `
                  <button type="button" class="btn-admin-delete-chip" data-admin-del="${s.id_servicio}" data-admin-name="${escapeHtml(s.nombre)}" title="Eliminar servicio del catálogo">✕</button>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>

        <!-- 3. TIPO DE EVENTO (CAMBIO LIBRE Y MULTISELECCIÓN OBLIGATORIA) -->
        <div class="form-section-box">
          <div class="section-title-with-badge">
            <div>
              <h4 class="section-heading">Tipo de Evento <span class="text-danger">*</span></h4>
              <span class="badge-rule">Haga clic para seleccionar o cambiar • Permite uno o varios tipos de evento</span>
            </div>
            ${estadoCotizador.esSuperAdmin ? `
              <button type="button" class="btn-admin-add-inline" data-admin-add="Tipo Evento" data-admin-title="Agregar Nuevo Tipo de Evento">
                + Agregar Tipo de Evento
              </button>
            ` : ''}
          </div>
          <p class="section-description">
            Seleccione uno o más tipos de celebración (puede marcar o desmarcar libremente cualquier opción):
          </p>

          <div class="event-types-grid" id="container-tipos-evento">
            ${tiposEventoItems.map(item => {
              const nombreTipo = item.nombre;
              const isSelected = estadoCotizador.tiposEvento.includes(nombreTipo);
              const activeClass = isSelected ? 'selected' : '';
              return `
                <div class="event-type-card ${activeClass}" data-type="${escapeHtml(nombreTipo)}" role="checkbox" aria-checked="${isSelected}" tabindex="0">
                  <div class="event-type-custom-box" style="position:relative;">
                    <span class="event-type-check-mark">✓</span>
                    <span class="event-type-label" style="flex:1;">${escapeHtml(nombreTipo)}</span>
                    ${estadoCotizador.esSuperAdmin && item.id_servicio ? `
                      <button type="button" class="btn-admin-delete-chip" data-admin-del="${item.id_servicio}" data-admin-name="${escapeHtml(nombreTipo)}" title="Eliminar tipo de evento">✕</button>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 4. MANTELERÍA Y LAZOS DE COLORES (CAMBIO LIBRE Y MULTISELECCIÓN OBLIGATORIA) -->
        <div class="form-section-box">
          <div class="section-title-with-badge">
            <div>
              <h4 class="section-heading">Mantelería y Lazos Decorativos <span class="text-danger">*</span></h4>
              <span class="badge-rule">Haga clic para cambiar o elegir varios colores • Obligatorio al menos un color</span>
            </div>
            ${estadoCotizador.esSuperAdmin ? `
              <button type="button" class="btn-admin-add-inline" data-admin-add="Color Mantelería" data-admin-title="Agregar Nuevo Color de Mantelería y Lazos">
                + Agregar Color
              </button>
            ` : ''}
          </div>
          <div class="manteleria-notice-callout">
            <div class="notice-icon">ℹ</div>
            <p>
              <strong>Regla de gala:</strong> Los vestidos de las sillas y los manteles de las mesas 
              <strong>siempre son blancos</strong>. Contamos con elegantes lazos y cubremanteles 
              como decoración en los siguientes colores:
            </p>
          </div>

          <div class="manteleria-colors-grid" id="container-colores-manteleria">
            ${colores.map(c => {
              const colorName = c.nombre || c.id;
              const hex = c.color_hex || c.hex || '#C86D3B';
              const isSelected = estadoCotizador.coloresManteleria.includes(colorName);
              const activeClass = isSelected ? 'selected' : '';
              return `
                <div class="color-swatch-card ${activeClass}" data-color="${escapeHtml(colorName)}" role="checkbox" aria-checked="${isSelected}" tabindex="0">
                  <div class="color-swatch-content">
                    <span class="color-circle-preview" style="background-color: ${escapeHtml(hex)}; border-color: ${escapeHtml(hex)};"></span>
                    <div class="color-swatch-info">
                      <span class="color-swatch-name">${escapeHtml(colorName)}</span>
                      <span class="color-swatch-role">Lazos y Cubremantel</span>
                    </div>
                    <span class="color-check-icon">✓</span>
                    ${estadoCotizador.esSuperAdmin && c.id_servicio ? `
                      <button type="button" class="btn-admin-delete-chip" data-admin-del="${c.id_servicio}" data-admin-name="Color ${escapeHtml(colorName)}" title="Eliminar color de mantelería">✕</button>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 5. HORAS DE EVENTO & HORAS EXTRA ("Sin extra" al final del listado) -->
        <div class="form-row-2">
          <!-- Horas de evento (1 a 6 horas máximo) -->
          <div class="form-section-box">
            <div class="section-title-with-badge">
              <h4 class="section-heading">Horas de Evento</h4>
              <span class="badge-rule">De 1 a 6 horas máximo</span>
            </div>
            <p class="section-description">Duración base incluida en la reservación del salón:</p>
            <div class="hours-pills-selector" id="selector-horas-evento">
              ${[1, 2, 3, 4, 5, 6].map(h => `
                <button 
                  type="button" 
                  class="btn-hour-pill ${estadoCotizador.horasEvento === h ? 'active' : ''}" 
                  data-hours="${h}"
                >
                  ${h} ${h === 1 ? 'Hora' : 'Horas'}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Horas extra (1 a 5 horas extra a $80.00 c/u, y "Sin extra" al final) -->
          <div class="form-section-box">
            <div class="section-title-with-badge">
              <h4 class="section-heading">Horas Extra Adicionales</h4>
              <span class="badge-price-extra">$80.00 c/u</span>
            </div>
            <p class="section-description">Extensión de fiesta con sonido y meseros (máx 5 horas extra):</p>
            <div class="hours-pills-selector" id="selector-horas-extra">
              ${ordenHorasExtra.map(h => `
                <button 
                  type="button" 
                  class="btn-extra-pill ${estadoCotizador.horasExtra === h ? 'active' : ''}" 
                  data-extra="${h}"
                >
                  ${h === 0 ? 'Sin extra' : `+${h} h ($${h * 80})`}
                </button>
              `).join('')}
            </div>
          </div>
        </div>

      </div>
    `;
  }

  /**
   * =========================================================================
   * PASO 3 (FIGURA 10 - RF03): PERSONALIZACIÓN DE MENÚ BUFFET
   * =========================================================================
   */
  function renderPaso3Html() {
    const cat = estadoCotizador.catalogo;

    const chuletasItems = cat?.menu?.carnes?.chuletas?.items || [
      { id_servicio: 26, nombre: 'Chuleta: Al horno', nombre_limpio: 'Al horno' },
      { id_servicio: 27, nombre: 'Chuleta: En salsa al curry', nombre_limpio: 'En salsa al curry' },
      { id_servicio: 28, nombre: 'Chuleta: En salsa al curry con naranja', nombre_limpio: 'En salsa al curry con naranja' },
      { id_servicio: 29, nombre: 'Chuleta: En salsa de champiñones', nombre_limpio: 'En salsa de champiñones' }
    ];

    const pollosItems = cat?.menu?.carnes?.pollos?.items || [
      { id_servicio: 30, nombre: 'Pollo: Al horno', nombre_limpio: 'Al horno' },
      { id_servicio: 31, nombre: 'Pollo: Al vino', nombre_limpio: 'Al vino' },
      { id_servicio: 32, nombre: 'Pollo: En salsa de durazno', nombre_limpio: 'En salsa de durazno' },
      { id_servicio: 33, nombre: 'Pollo: Al curry', nombre_limpio: 'Al curry' },
      { id_servicio: 34, nombre: 'Pollo: Al ajillo (ajo, vinagre, aceite de oliva)', nombre_limpio: 'Al ajillo (ajo, vinagre, aceite de oliva)' }
    ];

    const medallonesItems = cat?.menu?.carnes?.medallones?.items || [
      { id_servicio: 35, nombre: 'Medallón: Pollo (jamón y queso)', nombre_limpio: 'Pollo (jamón y queso)' },
      { id_servicio: 36, nombre: 'Medallón: Pollo uruguayo en salsa de durazno', nombre_limpio: 'Pollo uruguayo en salsa de durazno' },
      { id_servicio: 37, nombre: 'Medallón: Ternera', nombre_limpio: 'Ternera' },
      { id_servicio: 38, nombre: 'Medallón: Pavo', nombre_limpio: 'Pavo' }
    ];

    const lomosItems = cat?.menu?.carnes?.lomos?.items || [
      { id_servicio: 39, nombre: 'Lomo: Res en salsa de champiñones', nombre_limpio: 'Res en salsa de champiñones', es_lomo: true },
      { id_servicio: 40, nombre: 'Lomo: Res al vino de jerez', nombre_limpio: 'Res al vino de jerez', es_lomo: true },
      { id_servicio: 41, nombre: 'Lomo: Cerdo (aceitunas, jamón, queso, tocino y vegetales)', nombre_limpio: 'Cerdo (aceitunas, jamón, queso, tocino y vegetales)', es_lomo: true },
      { id_servicio: 42, nombre: 'Lomo: Costillas de cerdo a la BBQ', nombre_limpio: 'Costillas de cerdo a la BBQ', es_lomo: true }
    ];

    const arrocesItems = cat?.menu?.arroces?.items || [
      { id_servicio: 43, nombre: 'Arroz Rosado', nombre_limpio: 'Rosado' },
      { id_servicio: 44, nombre: 'Arroz Verde (albahaca)', nombre_limpio: 'Verde (albahaca)' },
      { id_servicio: 45, nombre: 'Arroz Blanco con pasas', nombre_limpio: 'Blanco con pasas' },
      { id_servicio: 46, nombre: 'Arroz Blanco con alverjas', nombre_limpio: 'Blanco con alverjas' },
      { id_servicio: 47, nombre: 'Arroz Al curry con perejil', nombre_limpio: 'Al curry con perejil' },
      { id_servicio: 48, nombre: 'Arroz Con champiñones', nombre_limpio: 'Con champiñones' },
      { id_servicio: 49, nombre: 'Arroz Oriental (pimiento rojo, verde y amarillo)', nombre_limpio: 'Oriental (pimiento rojo, verde y amarillo)' },
      { id_servicio: 50, nombre: 'Arroz Primavera (alverja, zanahoria y pimiento rojo)', nombre_limpio: 'Primavera (alverja, zanahoria y pimiento rojo)' },
      { id_servicio: 51, nombre: 'Arroz Dorado (jamón y champiñones)', nombre_limpio: 'Dorado (jamón y champiñones)' }
    ];

    const ensaladasItems = cat?.menu?.ensaladas?.items || [
      { id_servicio: 52, nombre: 'Ensalada Rey (jamón, choclo, alverja y coliflor)', descripcion: 'jamón, choclo, alverja y coliflor' },
      { id_servicio: 53, nombre: 'Ensalada Waldorf (zanahoria, choclo, alverja, piña, apio y manzana)', descripcion: 'zanahoria, choclo, alverja, piña, apio y manzana' },
      { id_servicio: 54, nombre: 'Ensalada Margarita (choclo, brócoli, zanahoria y tocino)', descripcion: 'choclo, brócoli, zanahoria y tocino' },
      { id_servicio: 55, nombre: 'Ensalada Fresca (tomate, lechuga y pepinillo)', descripcion: 'tomate, lechuga y pepinillo' },
      { id_servicio: 56, nombre: 'Ensalada Mediterránea (tomate cherry, lechuga, cebolla perla y vinagreta)', descripcion: 'tomate cherry, lechuga, cebolla perla y vinagreta' }
    ];

    const papasItems = cat?.menu?.papas?.items || [
      { id_servicio: 57, nombre: 'Papas: Al perejil salteadas en mantequilla', nombre_limpio: 'Al perejil salteadas en mantequilla' },
      { id_servicio: 58, nombre: 'Papas: Al romero', nombre_limpio: 'Al romero' },
      { id_servicio: 59, nombre: 'Papas: Al jamón con queso', nombre_limpio: 'Al jamón con queso' },
      { id_servicio: 60, nombre: 'Papas: Al horno (cocidas y terminadas al horno)', nombre_limpio: 'Al horno (cocidas y terminadas al horno)' },
      { id_servicio: 61, nombre: 'Papas: Salteadas con ajo y mantequilla', nombre_limpio: 'Salteadas con ajo y mantequilla' },
      { id_servicio: 62, nombre: 'Papas: Gratinada con cáscara, bañada en ajo y mantequilla', nombre_limpio: 'Gratinada con cáscara, bañada en ajo y mantequilla' }
    ];

    const frutasItems = cat?.menu?.arreglos_frutales?.items || [
      { id_servicio: 63, nombre: 'Arreglo Frutal: Cisne de Frutas', nombre_limpio: 'Cisne de Frutas', descripcion: 'Escultura ornamental tallada en frutas frescas de temporada.' },
      { id_servicio: 64, nombre: 'Arreglo Frutal: Corazón de Frutas', nombre_limpio: 'Corazón de Frutas', descripcion: 'Brochetas y arreglo temático con variedad de frutas selectas.' }
    ];

    return `
      <div class="step-card">
        <div class="step-card-header">
          <div class="step-icon-badge">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
              <line x1="6" y1="1" x2="6" y2="4"/>
              <line x1="10" y1="1" x2="10" y2="4"/>
              <line x1="14" y1="1" x2="14" y2="4"/>
            </svg>
          </div>
          <div>
            <h3 class="step-card-title">Paso 3: Personalización del Menú de Buffet (Figura 10)</h3>
            <p class="step-card-desc">Cree la combinación perfecta para el plato de gala de sus comensales.</p>
          </div>
        </div>

        <!-- Tarjeta Informativa de Reglas de Carnes y Precios -->
        <div class="menu-price-banner" id="menu-price-banner">
          <div class="price-banner-indicator">
            <span class="price-tag-big" id="display-plato-banner">$14.00</span>
            <span class="price-tag-unit">por plato / invitado</span>
          </div>
          <div class="price-banner-text">
            <div class="price-banner-status">
              <span class="badge-meat-counter" id="badge-meat-counter">${estadoCotizador.menu.carnes.length} / 2 carnes seleccionadas</span>
              <span class="badge-meat-tier" id="badge-meat-tier">Tarifa Estándar ($14.00)</span>
            </div>
            <p class="price-banner-rule">
              <strong>Regla obligatoria de carnes:</strong> Se deben seleccionar exactamente <strong>dos (2) opciones de carnes</strong> en total.
              Si dentro de las 2 opciones escoge alguna de <strong>Lomos</strong>, la tarifa es de <strong>$16.00 por plato</strong>; caso contrario se mantiene en <strong>$14.00</strong>.
            </p>
          </div>
        </div>

        <!-- 1. SECCIÓN CARNES (CHULETAS, POLLOS, MEDALLONES, LOMOS) -->
        <div class="menu-category-wrapper">
          <div class="menu-category-header">
            <div class="category-title-group">
              <h4 class="category-heading">1. Opciones de Carnes (Seleccione exactamente 2 opciones) <span class="text-danger">*</span></h4>
              <span class="category-hint">Haga clic sobre las opciones deseadas para marcarlas o desmarcarlas (Chuletas • Pollos • Medallones • Lomos)</span>
            </div>
          </div>

          <!-- Subcategoría 1.1: Chuletas -->
          <div class="meat-subcategory-card">
            <div class="meat-sub-header">
              <span class="meat-sub-title">🥩 Chuletas</span>
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <span class="meat-sub-rule">Máximo 2 opciones</span>
                ${estadoCotizador.esSuperAdmin ? `
                  <button type="button" class="btn-admin-add-inline" data-admin-add="Carne - Chuletas" data-admin-title="Agregar Opción de Chuletas">+ Agregar</button>
                ` : ''}
              </div>
            </div>
            <div class="meat-options-grid">
              ${chuletasItems.map(item => renderMeatCheckboxHtml('chuletas', item.nombre_limpio || item.nombre, item.nombre, false, item.id_servicio)).join('')}
            </div>
          </div>

          <!-- Subcategoría 1.2: Pollos -->
          <div class="meat-subcategory-card">
            <div class="meat-sub-header">
              <span class="meat-sub-title">🍗 Pollos</span>
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <span class="meat-sub-rule">Máximo 2 opciones</span>
                ${estadoCotizador.esSuperAdmin ? `
                  <button type="button" class="btn-admin-add-inline" data-admin-add="Carne - Pollos" data-admin-title="Agregar Opción de Pollo">+ Agregar</button>
                ` : ''}
              </div>
            </div>
            <div class="meat-options-grid">
              ${pollosItems.map(item => renderMeatCheckboxHtml('pollos', item.nombre_limpio || item.nombre, item.nombre, false, item.id_servicio)).join('')}
            </div>
          </div>

          <!-- Subcategoría 1.3: Medallones -->
          <div class="meat-subcategory-card">
            <div class="meat-sub-header">
              <span class="meat-sub-title">🏅 Medallones</span>
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <span class="meat-sub-rule">Máximo 2 opciones</span>
                ${estadoCotizador.esSuperAdmin ? `
                  <button type="button" class="btn-admin-add-inline" data-admin-add="Carne - Medallones" data-admin-title="Agregar Opción de Medallones">+ Agregar</button>
                ` : ''}
              </div>
            </div>
            <div class="meat-options-grid">
              ${medallonesItems.map(item => renderMeatCheckboxHtml('medallones', item.nombre_limpio || item.nombre, item.nombre, false, item.id_servicio)).join('')}
            </div>
          </div>

          <!-- Subcategoría 1.4: Lomos (activa $16.00) -->
          <div class="meat-subcategory-card lomos-highlight-card">
            <div class="meat-sub-header">
              <div class="lomos-header-title">
                <span class="meat-sub-title">👑 Lomos de Res & Cerdo</span>
                <span class="badge-premium-meat">★ Activa Tarifa Especial $16.00</span>
              </div>
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <span class="meat-sub-rule">Máximo 2 opciones</span>
                ${estadoCotizador.esSuperAdmin ? `
                  <button type="button" class="btn-admin-add-inline" data-admin-add="Carne - Lomos" data-admin-title="Agregar Opción de Lomo ($16.00)">+ Agregar</button>
                ` : ''}
              </div>
            </div>
            <p class="lomos-sub-hint">
              Cortes selectos gourmet. Al seleccionar cualquiera de estas opciones de lomo, el menú completo se calcula a $16.00 por plato.
            </p>
            <div class="meat-options-grid">
              ${lomosItems.map(item => renderMeatCheckboxHtml('lomos', item.nombre_limpio || item.nombre, item.nombre, true, item.id_servicio)).join('')}
            </div>
          </div>
        </div>

        <!-- 2. SECCIÓN ARROZ (1 OPCIÓN OBLIGATORIA) -->
        <div class="menu-category-wrapper">
          <div class="menu-category-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <div class="category-title-group">
              <h4 class="category-heading">2. Arroz <span class="text-danger">*</span></h4>
              <span class="badge-rule">Seleccione una (1) opción</span>
            </div>
            ${estadoCotizador.esSuperAdmin ? `
              <button type="button" class="btn-admin-add-inline" data-admin-add="Arroz" data-admin-title="Agregar Opción de Arroz">+ Agregar Arroz</button>
            ` : ''}
          </div>
          <div class="radio-options-grid" id="container-menu-arroz">
            ${arrocesItems.map(item => {
              const fullVal = item.nombre;
              const label = item.nombre_limpio || item.nombre.replace(/^Arroz\s+/i, '');
              const isSelected = estadoCotizador.menu.arroz === fullVal;
              return renderMenuRadioHtml('arroz', fullVal, label, '', isSelected, item.id_servicio);
            }).join('')}
          </div>
        </div>

        <!-- 3. SECCIÓN ENSALADA (1 OPCIÓN OBLIGATORIA) -->
        <div class="menu-category-wrapper">
          <div class="menu-category-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <div class="category-title-group">
              <h4 class="category-heading">3. Ensalada <span class="text-danger">*</span></h4>
              <span class="badge-rule">Seleccione una (1) opción</span>
            </div>
            ${estadoCotizador.esSuperAdmin ? `
              <button type="button" class="btn-admin-add-inline" data-admin-add="Ensalada" data-admin-title="Agregar Opción de Ensalada">+ Agregar Ensalada</button>
            ` : ''}
          </div>
          <div class="radio-options-grid" id="container-menu-ensalada">
            ${ensaladasItems.map(item => {
              const fullVal = item.nombre;
              let titulo = item.nombre;
              let ing = item.descripcion || '';
              const match = item.nombre.match(/^([^(]+)\(([^)]+)\)/);
              if (match) {
                titulo = match[1].trim();
                ing = match[2].trim();
              }
              const isSelected = estadoCotizador.menu.ensalada === fullVal;
              return renderMenuRadioHtml('ensalada', fullVal, titulo, ing, isSelected, item.id_servicio);
            }).join('')}
          </div>
        </div>

        <!-- 4. SECCIÓN PAPAS (1 OPCIÓN OBLIGATORIA) -->
        <div class="menu-category-wrapper">
          <div class="menu-category-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <div class="category-title-group">
              <h4 class="category-heading">4. Papas <span class="text-danger">*</span></h4>
              <span class="badge-rule">Seleccione una (1) opción</span>
            </div>
            ${estadoCotizador.esSuperAdmin ? `
              <button type="button" class="btn-admin-add-inline" data-admin-add="Papas" data-admin-title="Agregar Opción de Papas">+ Agregar Papas</button>
            ` : ''}
          </div>
          <div class="radio-options-grid" id="container-menu-papas">
            ${papasItems.map(item => {
              const fullVal = item.nombre;
              const label = item.nombre_limpio || item.nombre.replace(/^Papas:\s*/i, '');
              const isSelected = estadoCotizador.menu.papas === fullVal;
              return renderMenuRadioHtml('papas', fullVal, label, '', isSelected, item.id_servicio);
            }).join('')}
          </div>
        </div>

        <!-- 5. SECCIÓN ARREGLOS FRUTALES (1 OPCIÓN OBLIGATORIA) -->
        <div class="menu-category-wrapper" style="margin-bottom:0; border-bottom:none; padding-bottom:0;">
          <div class="menu-category-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <div class="category-title-group">
              <h4 class="category-heading">5. Arreglos Frutales <span class="text-danger">*</span></h4>
              <span class="badge-rule">Seleccione una (1) opción</span>
            </div>
            ${estadoCotizador.esSuperAdmin ? `
              <button type="button" class="btn-admin-add-inline" data-admin-add="Arreglo Frutal" data-admin-title="Agregar Opción de Arreglo Frutal">+ Agregar Arreglo Frutal</button>
            ` : ''}
          </div>
          <div class="radio-options-grid-2" id="container-menu-frutas">
            ${frutasItems.map(item => {
              const fullVal = item.nombre_limpio || item.nombre.replace(/^Arreglo Frutal:\s*/i, '');
              const desc = item.descripcion || '';
              const isSelected = estadoCotizador.menu.arregloFrutal === fullVal;
              return renderMenuRadioHtml('arregloFrutal', fullVal, fullVal, desc, isSelected, item.id_servicio);
            }).join('')}
          </div>
        </div>

      </div>
    `;
  }

  /**
   * Helper para renderizar tarjeta de selección de carnes (usando div para evitar doble toggle de label)
   */
  function renderMeatCheckboxHtml(subcat, label, fullVal, esLomo, idServicio) {
    const isSelected = estadoCotizador.menu.carnes.some(c => c.nombre === fullVal);
    const selectedClass = isSelected ? 'selected' : '';
    return `
      <div class="meat-check-card ${selectedClass}" data-subcat="${escapeHtml(subcat)}" data-name="${escapeHtml(fullVal)}" data-lomo="${esLomo ? '1' : '0'}" role="checkbox" aria-checked="${isSelected}" tabindex="0">
        <div class="meat-check-body" style="position:relative;">
          <span class="meat-check-box">✓</span>
          <span class="meat-check-label" style="flex:1;">${escapeHtml(label)}</span>
          ${estadoCotizador.esSuperAdmin && idServicio ? `
            <button type="button" class="btn-admin-delete-chip" data-admin-del="${idServicio}" data-admin-name="${escapeHtml(fullVal)}" title="Eliminar opción de carne">✕</button>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Helper para renderizar opción única de menú (Arroz, Ensalada, Papas, Frutas)
   */
  function renderMenuRadioHtml(menuField, fullVal, title, desc, isSelected, idServicio) {
    return `
      <div class="menu-radio-card ${isSelected ? 'selected' : ''}" data-menu-field="${escapeHtml(menuField)}" data-value="${escapeHtml(fullVal)}" role="radio" aria-checked="${isSelected}" tabindex="0">
        <div class="menu-radio-content" style="position:relative;">
          <span class="radio-circle"></span>
          <div class="menu-radio-info" style="flex:1;">
            <strong class="menu-item-title">${escapeHtml(title)}</strong>
            ${desc ? `<span class="menu-item-desc">${escapeHtml(desc)}</span>` : ''}
          </div>
          ${estadoCotizador.esSuperAdmin && idServicio ? `
            <button type="button" class="btn-admin-delete-chip" data-admin-del="${idServicio}" data-admin-name="${escapeHtml(fullVal)}" title="Eliminar opción del menú">✕</button>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * =========================================================================
   * PASO 4 (FIGURA 11): RESUMEN INTELIGENTE, GUARDADO Y PROFORMA FORMAL
   * =========================================================================
   */
  function renderPaso4Html() {
    const cli = estadoCotizador.cliente || {
      nombres: 'Consumidor',
      apellidos: 'Final',
      cedula_ruc: '9999999999',
      telefono: 'N/A',
      correo: 'N/A',
      direccion: 'Quito, Pichincha'
    };

    const tieneLomo = estadoCotizador.menu.carnes.some(c => c.esLomo);
    const precioPlato = tieneLomo ? 16.00 : 14.00;
    const subtotalMenu = estadoCotizador.cantidadPersonas * precioPlato;
    const subtotalHorasExtra = estadoCotizador.horasExtra * 80.00;
    const totalEstimado = subtotalMenu + subtotalHorasExtra;

    return `
      <div class="proforma-preview-card" id="proforma-document">
        
        <!-- Membrete Oficial para Impresión y Pantalla -->
        <div class="proforma-header">
          <div class="proforma-brand">
            <div class="proforma-logo-box">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M5.8 11.3 2 22l10.7-3.79"/>
                <path d="M4 3h.01"/>
                <path d="M22 8h.01"/>
                <path d="M15 2h.01"/>
                <path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12v0c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/>
              </svg>
            </div>
            <div>
              <h2 class="proforma-salon-name">Recepciones Mishell</h2>
              <p class="proforma-salon-meta">Salón Exclusivo de Banquetes & Recepciones de Gala</p>
              <p class="proforma-salon-location">Quito, Ecuador • Capacidad Garantizada 120 Invitados</p>
            </div>
          </div>

          <div class="proforma-meta-box">
            <span class="proforma-doc-title">COTIZACIÓN ESTIMADA</span>
            <span class="proforma-doc-number" id="proforma-doc-number">
              ${estadoCotizador.cotizacionGuardada ? '#' + estadoCotizador.cotizacionGuardada.id_cotizacion : 'BORRADOR'}
            </span>
            <span class="proforma-date-emit">Fecha de Emisión: <strong>${new Date().toLocaleDateString('es-EC')}</strong></span>
            <span class="badge-status-proforma ${estadoCotizador.cotizacionGuardada ? 'badge-aprobada' : 'badge-calculada'}">
              ${estadoCotizador.cotizacionGuardada ? 'Registrada Oficialmente' : 'Cálculo Inteligente Activo'}
            </span>
          </div>
        </div>

        <!-- Ficha de Datos del Cliente y Celebración -->
        <div class="proforma-info-grid">
          <div class="proforma-info-block">
            <h4 class="proforma-block-title">Datos del Anfitrión / Cliente</h4>
            <div class="proforma-data-rows">
              <div><span>Titular:</span> <strong>${escapeHtml(cli.nombres)} ${escapeHtml(cli.apellidos)}</strong></div>
              <div><span>Cédula / RUC:</span> <code>${escapeHtml(cli.cedula_ruc)}</code></div>
              <div><span>Teléfono:</span> <strong>${escapeHtml(cli.telefono || 'N/A')}</strong></div>
              <div><span>Correo Electrónico:</span> <strong>${escapeHtml(cli.correo || 'N/A')}</strong></div>
            </div>
          </div>

          <div class="proforma-info-block">
            <h4 class="proforma-block-title">Especificaciones del Evento</h4>
            <div class="proforma-data-rows">
              <div><span>Fecha Propuesta:</span> <strong>${escapeHtml(estadoCotizador.fechaEvento)} (Inicio: ${escapeHtml(estadoCotizador.horaInicio)} hrs)</strong></div>
              <div><span>Tipo(s) de Evento:</span> <strong>${escapeHtml(estadoCotizador.tiposEvento.join(', '))}</strong></div>
              <div><span>Duración Contratada:</span> <strong>${estadoCotizador.horasEvento} horas base ${estadoCotizador.horasExtra > 0 ? `+ ${estadoCotizador.horasExtra} horas extra` : '(Sin horas extra)'}</strong></div>
              <div><span>Decoración Lazos:</span> <strong>${escapeHtml(estadoCotizador.coloresManteleria.join(', '))}</strong></div>
            </div>
          </div>
        </div>

        <!-- Desglose de Menú Buffet de Gala Escogido -->
        <div class="proforma-menu-summary-box">
          <h4 class="proforma-block-title">Menú Buffet de Gala Seleccionado</h4>
          <div class="proforma-menu-chips-grid">
            <div class="menu-chip-item">
              <span class="menu-chip-label">Carnes (2 Opciones):</span>
              <strong class="menu-chip-val">${escapeHtml(estadoCotizador.menu.carnes.map(c => c.nombre).join(' • '))}</strong>
            </div>
            <div class="menu-chip-item">
              <span class="menu-chip-label">Arroz:</span>
              <strong class="menu-chip-val">${escapeHtml(estadoCotizador.menu.arroz)}</strong>
            </div>
            <div class="menu-chip-item">
              <span class="menu-chip-label">Ensalada:</span>
              <strong class="menu-chip-val">${escapeHtml(estadoCotizador.menu.ensalada)}</strong>
            </div>
            <div class="menu-chip-item">
              <span class="menu-chip-label">Papas:</span>
              <strong class="menu-chip-val">${escapeHtml(estadoCotizador.menu.papas)}</strong>
            </div>
            <div class="menu-chip-item">
              <span class="menu-chip-label">Arreglo Frutal:</span>
              <strong class="menu-chip-val">${escapeHtml(estadoCotizador.menu.arregloFrutal)}</strong>
            </div>
          </div>
        </div>

        <!-- Tabla Financiera de Liquidación Automática -->
        <div class="proforma-table-wrapper">
          <table class="proforma-table">
            <thead>
              <tr>
                <th style="width: 50%;">Concepto / Servicio</th>
                <th style="text-align:center;">Cantidad</th>
                <th style="text-align:right;">Precio Unitario</th>
                <th style="text-align:right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>Menú Buffet Completo de Gala</strong>
                  <span class="table-item-desc">
                    Incluye 2 carnes (${tieneLomo ? 'Gourmet con opción de lomo' : 'Estándar'}), guarniciones, arroz, ensalada, papas y arreglo frutal.
                  </span>
                </td>
                <td style="text-align:center;">${estadoCotizador.cantidadPersonas} pers.</td>
                <td style="text-align:right;">$${precioPlato.toFixed(2)}</td>
                <td style="text-align:right;"><strong>$${subtotalMenu.toFixed(2)}</strong></td>
              </tr>

              ${estadoCotizador.horasExtra > 0 ? `
                <tr>
                  <td>
                    <strong>Horas Extra de Servicio de Salón & Atención</strong>
                    <span class="table-item-desc">Extensión de música, barra, servicio de meseros y pista.</span>
                  </td>
                  <td style="text-align:center;">${estadoCotizador.horasExtra} h</td>
                  <td style="text-align:right;">$80.00</td>
                  <td style="text-align:right;"><strong>$${subtotalHorasExtra.toFixed(2)}</strong></td>
                </tr>
              ` : ''}

              <!-- Fila resumen de servicios incluidos -->
              <tr class="table-row-included">
                <td>
                  <strong>Paquete Integral de Sala Garantizado (Servicios Incluidos)</strong>
                  <span class="table-item-desc">
                    Mantelería y vestidos blancos, cristalería fina, vajilla completa, sillas y mesas redondas, pastel, mesa de postre, luces robóticas DMX, meseros profesionales de gala, maestro de ceremonias/DJ, y seguridad con CCTV.
                  </span>
                </td>
                <td style="text-align:center;">1 Paq.</td>
                <td style="text-align:right;">$0.00</td>
                <td style="text-align:right;"><span class="badge-tag-gratis">INCLUIDO</span></td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" class="tfoot-label">Subtotal Menú y Banquete:</td>
                <td class="tfoot-amount">$${subtotalMenu.toFixed(2)}</td>
              </tr>
              ${estadoCotizador.horasExtra > 0 ? `
                <tr>
                  <td colspan="3" class="tfoot-label">Subtotal Horas Extra (${estadoCotizador.horasExtra} h):</td>
                  <td class="tfoot-amount">$${subtotalHorasExtra.toFixed(2)}</td>
                </tr>
              ` : ''}
              <tr class="tfoot-total-row">
                <td colspan="3" class="tfoot-total-label">VALOR TOTAL ESTIMADO:</td>
                <td class="tfoot-total-amount">$${totalEstimado.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Condiciones comerciales y notas -->
        <div class="proforma-legal-notes">
          <p>
            <strong>Términos & Condiciones Comerciales:</strong> Esta cotización es válida por 15 días calendario. 
            La reserva de la fecha se formaliza con el 30% del valor total estimado mediante contrato suscrito. 
            La capacidad máxima permitida es de 120 personas según aforo y normativa de seguridad.
          </p>
        </div>

        <!-- Acciones de la Proforma (Guardar en BD / Imprimir / Ver Guardadas / Nueva) -->
        <div class="proforma-actions-bar no-print">
          <button type="button" class="btn-action-primary ${estadoCotizador.cotizacionGuardada ? 'btn-saved-success' : ''}" id="btn-guardar-cotizacion-db" ${estadoCotizador.cotizacionGuardada ? 'disabled' : ''}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            <span>${estadoCotizador.cotizacionGuardada ? 'Cotización Guardada en BD ✓' : 'Guardar Cotización Oficial'}</span>
          </button>

          <button type="button" class="btn-action-secondary" id="btn-imprimir-proforma">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            <span>Imprimir / Descargar Proforma (PDF)</span>
          </button>

          ${estadoCotizador.cotizacionGuardada ? `
            <button type="button" class="btn-action-primary" style="background:linear-gradient(135deg,#0284C7 0%,#0369A1 100%);" id="btn-agendar-reserva-desde-step4" data-cot-id="${estadoCotizador.cotizacionGuardada.id_cotizacion}" data-fecha="${escapeHtml(estadoCotizador.fechaEvento)}">
              📅 Agendar Reserva en Calendario (Bloquear Fecha)
            </button>
          ` : ''}

          <button type="button" class="btn-action-outline btn-action-saved-list" id="btn-step4-ver-guardadas">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            <span>Cotizaciones Guardadas (${estadoCotizador.cotizacionesGuardadasLista.length})</span>
          </button>

          <button type="button" class="btn-action-outline" id="btn-nueva-cotizacion">
            + Nueva Cotización
          </button>
        </div>

      </div>

      <!-- Sección en la misma pantalla de Item 4: Cotizaciones Realizadas y Guardadas para Imprimir las veces necesarias -->
      <div class="saved-quotes-inline-panel no-print" id="panel-cotizaciones-guardadas-step4">
        <div class="saved-quotes-panel-header">
          <div>
            <h4 class="saved-quotes-panel-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 6 2 18 2 18 9"/>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              <span>Cotizaciones Realizadas y Guardadas (${estadoCotizador.cotizacionesGuardadasLista.length})</span>
            </h4>
            <p class="saved-quotes-panel-sub">
              Si guardó una cotización y no la envió a imprimir en ese momento, selecciónela aquí para visualizarla e imprimirla las veces que sean necesarias.
            </p>
          </div>
        </div>
        ${renderTablaCotizacionesGuardadasHtml(estadoCotizador.cotizacionesGuardadasLista, 'inline')}
      </div>
    `;
  }

  /**
   * Renderiza el listado responsivo de cotizaciones guardadas con botones para Cargar/Ver e Imprimir
   */
  function renderTablaCotizacionesGuardadasHtml(lista, contexto = 'modal') {
    if (!lista || lista.length === 0) {
      return `
        <div class="saved-quotes-empty">
          No hay cotizaciones guardadas que coincidan con la búsqueda. Cuando presione <strong>"Guardar Cotización Oficial"</strong>, aparecerán aquí listas para imprimirse en cualquier momento.
        </div>
      `;
    }

    const idActiva = estadoCotizador.cotizacionGuardada ? Number(estadoCotizador.cotizacionGuardada.id_cotizacion) : 0;

    return `
      <div class="saved-quotes-cards-list">
        ${lista.map(c => {
          const idCot = Number(c.id_cotizacion);
          const esActiva = idCot === idActiva;
          const totalNum = parseFloat(c.total_estimado || 0).toFixed(2);
          const nombreCli = `${c.nombres || ''} ${c.apellidos || ''}`.trim();
          return `
            <div class="saved-quote-item-card ${esActiva ? 'active-loaded' : ''}">
              <div class="saved-quote-item-info">
                <div class="saved-quote-item-top">
                  <span class="saved-quote-badge-id">#${idCot}</span>
                  <strong class="saved-quote-cli-name">${escapeHtml(nombreCli)}</strong>
                  <span class="saved-quote-cli-doc">(${escapeHtml(c.cedula_ruc || 'N/A')})</span>
                  ${esActiva ? '<span class="saved-quote-badge-current">En pantalla</span>' : ''}
                </div>
                <div class="saved-quote-item-meta">
                  <span>📅 Evento: <strong>${escapeHtml(c.fecha_evento_propuesta || 'N/A')}</strong> (${escapeHtml(c.hora_inicio || '15:30')} hrs)</span>
                  <span>🎉 ${escapeHtml(c.tipo_evento || 'Recepción')} • <strong>${c.cantidad_personas} pers.</strong></span>
                  <span>💰 Total: <strong class="saved-quote-total">$${totalNum}</strong></span>
                </div>
              </div>
              <div class="saved-quote-item-actions">
                <button type="button" class="btn-sq-action btn-sq-view" data-load-cot-id="${idCot}" data-print-now="0" title="Cargar esta cotización en la vista de Resumen & Proforma">
                  👁️ Ver Proforma
                </button>
                <button type="button" class="btn-sq-action btn-sq-print" data-load-cot-id="${idCot}" data-print-now="1" title="Cargar e imprimir esta cotización inmediatamente">
                  🖨️ Imprimir
                </button>
                <button type="button" class="btn-sq-action" style="background:#EFF6FF; border-color:#BFDBFE; color:#1D4ED8;" data-schedule-cot-id="${idCot}" data-schedule-fecha="${escapeHtml(c.fecha_evento_propuesta || '')}" title="Convertir esta cotización en Reserva de Calendario con bloqueo automático">
                  📅 Reservar Fecha
                </button>
                ${estadoCotizador.esSuperAdmin && contexto === 'modal' ? `
                  <button type="button" class="btn-sq-action btn-sq-del" data-del-saved-cot-id="${idCot}" title="Eliminar cotización">
                    🗑️
                  </button>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /**
   * =========================================================================
   * EVENT BINDINGS GLOBALES, ADMINISTRACIÓN SUPER ADMIN Y NAVEGACIÓN
   * =========================================================================
   */
  function bindGlobalEvents() {
    // Stepper navigation buttons
    document.querySelectorAll('.step-node').forEach(node => {
      node.addEventListener('click', () => {
        const targetStep = parseInt(node.getAttribute('data-step'), 10);
        intentarIrAlPaso(targetStep);
      });
    });

    // Botón Siguiente (en la parte inferior de la pantalla)
    const btnNext = document.getElementById('btn-step-next');
    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (estadoCotizador.pasoActual < 4) {
          intentarIrAlPaso(estadoCotizador.pasoActual + 1);
        }
      });
    }

    // Botón Atrás (en la parte inferior de la pantalla)
    const btnPrev = document.getElementById('btn-step-prev');
    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (estadoCotizador.pasoActual > 1) {
          cambiarPasoVisual(estadoCotizador.pasoActual - 1);
        }
      });
    }

    // Botón para ver catálogo oficial RF03
    const btnPeek = document.getElementById('btn-ver-catalogo-rf03');
    const modalCatalogo = document.getElementById('modal-catalogo-rf03');
    const btnCloseCatalogo = document.getElementById('btn-cerrar-modal-catalogo');

    if (btnPeek && modalCatalogo) {
      btnPeek.addEventListener('click', () => {
        mostrarModalCatalogo();
      });
    }

    if (btnCloseCatalogo && modalCatalogo) {
      btnCloseCatalogo.addEventListener('click', () => {
        modalCatalogo.classList.remove('show');
      });
    }

    // Botón para ver Cotizaciones Guardadas (Ver / Imprimir las veces que sean necesarias)
    const btnCotizGuardadas = document.getElementById('btn-ver-cotizaciones-guardadas');
    const modalCotizGuardadas = document.getElementById('modal-cotizaciones-guardadas');
    const btnCloseCotizGuardadas = document.getElementById('btn-cerrar-modal-cotiz-guardadas');

    if (btnCotizGuardadas && modalCotizGuardadas) {
      btnCotizGuardadas.addEventListener('click', () => {
        mostrarModalCotizacionesGuardadas();
      });
    }

    if (btnCloseCotizGuardadas && modalCotizGuardadas) {
      btnCloseCotizGuardadas.addEventListener('click', () => {
        modalCotizGuardadas.classList.remove('show');
      });
    }

    // Botón para ver Historial & Auditoría BD
    const btnHistorial = document.getElementById('btn-ver-historial-bd');
    const modalHistorial = document.getElementById('modal-historial-bd');
    const btnCloseHistorial = document.getElementById('btn-cerrar-modal-historial');

    if (btnHistorial && modalHistorial) {
      btnHistorial.addEventListener('click', () => {
        mostrarModalHistorialBD();
      });
    }

    if (btnCloseHistorial && modalHistorial) {
      btnCloseHistorial.addEventListener('click', () => {
        modalHistorial.classList.remove('show');
      });
    }

    // Botones Super Admin para agregar registros al catálogo (+ Agregar ...)
    document.querySelectorAll('[data-admin-add]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cat = btn.getAttribute('data-admin-add');
        const titulo = btn.getAttribute('data-admin-title') || `Agregar a ${cat}`;
        abrirModalAdminCatalogo(cat, titulo);
      });
    });

    // Botones Super Admin para eliminar registros del catálogo (✕)
    document.querySelectorAll('[data-admin-del]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        const idServ = parseInt(btn.getAttribute('data-admin-del'), 10);
        const nombre = btn.getAttribute('data-admin-name') || 'este registro';
        await eliminarRegistroCatalogoAdmin(idServ, nombre);
      });
    });

    // Eventos del Modal Admin Catálogo
    const modalAdminCat = document.getElementById('modal-admin-catalogo');
    const btnCloseAdminCat = document.getElementById('btn-cerrar-modal-admin-cat');
    const btnCancelAdminCat = document.getElementById('btn-cancelar-modal-admin-cat');
    const formAdminCat = document.getElementById('form-admin-catalogo');

    if (btnCloseAdminCat && modalAdminCat) {
      btnCloseAdminCat.addEventListener('click', () => modalAdminCat.classList.remove('show'));
    }
    if (btnCancelAdminCat && modalAdminCat) {
      btnCancelAdminCat.addEventListener('click', () => modalAdminCat.classList.remove('show'));
    }
    if (formAdminCat) {
      formAdminCat.addEventListener('submit', guardarNuevoRegistroCatalogoAdmin);
    }
  }

  /**
   * Abre el modal de Super Administrador para agregar una nueva opción al catálogo
   */
  function abrirModalAdminCatalogo(categoria, titulo) {
    const modal = document.getElementById('modal-admin-catalogo');
    const titleEl = document.getElementById('modal-admin-cat-title');
    const inputCat = document.getElementById('admin-item-categoria');
    const inputNombre = document.getElementById('admin-item-nombre');
    const inputDesc = document.getElementById('admin-item-desc');
    const groupColor = document.getElementById('group-admin-color-hex');
    const alertBox = document.getElementById('admin-item-alert');

    if (!modal) return;
    if (titleEl) titleEl.textContent = titulo;
    if (inputCat) inputCat.value = categoria;
    if (inputNombre) inputNombre.value = '';
    if (inputDesc) inputDesc.value = '';
    if (alertBox) alertBox.style.display = 'none';
    if (groupColor) {
      groupColor.style.display = categoria === 'Color Mantelería' ? 'block' : 'none';
    }

    modal.classList.add('show');
    if (inputNombre) inputNombre.focus();
  }

  /**
   * Envía a servicios_api.php el nuevo registro creado por el Super Administrador
   */
  async function guardarNuevoRegistroCatalogoAdmin(e) {
    e.preventDefault();
    const categoria = document.getElementById('admin-item-categoria').value;
    const nombre = document.getElementById('admin-item-nombre').value.trim();
    const descripcion = document.getElementById('admin-item-desc').value.trim();
    const colorHex = document.getElementById('admin-item-color-hex')?.value || '';
    const alertBox = document.getElementById('admin-item-alert');
    const btnGuardar = document.getElementById('btn-guardar-admin-cat');

    if (!nombre) return;

    try {
      if (btnGuardar) {
        btnGuardar.disabled = true;
        btnGuardar.textContent = 'Guardando...';
      }

      const res = await fetch('modules/servicios/servicios_api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'crear_item',
          categoria,
          nombre,
          descripcion,
          color_hex: categoria === 'Color Mantelería' ? colorHex : ''
        })
      });

      const data = await res.json();
      if (data.success) {
        document.getElementById('modal-admin-catalogo')?.classList.remove('show');
        await cargarCatalogoServicios();
        renderEstructuraPrincipal();
      } else {
        if (alertBox) {
          alertBox.textContent = data.error || 'No se pudo guardar el registro.';
          alertBox.style.display = 'flex';
        }
      }
    } catch (err) {
      console.error('Error guardando registro de catálogo:', err);
      if (alertBox) {
        alertBox.textContent = 'Error de conexión con el servidor.';
        alertBox.style.display = 'flex';
      }
    } finally {
      if (btnGuardar) {
        btnGuardar.disabled = false;
        btnGuardar.textContent = 'Guardar en Base de Datos';
      }
    }
  }

  /**
   * Elimina (baja lógica con respaldo histórico) un registro del catálogo
   */
  async function eliminarRegistroCatalogoAdmin(idServicio, nombre) {
    if (!confirm(`¿Desea eliminar «${nombre}» del catálogo activo?\n\nLa acción quedará registrada en el historial de auditoría de la base de datos.`)) {
      return;
    }

    try {
      const res = await fetch('modules/servicios/servicios_api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'eliminar_item',
          id_servicio: idServicio
        })
      });
      const data = await res.json();
      if (data.success) {
        // Limpiar de las selecciones activas si estaba seleccionado
        estadoCotizador.tiposEvento = estadoCotizador.tiposEvento.filter(t => t !== nombre);
        const colorLimpio = nombre.replace(/^Color\s+/i, '').trim();
        estadoCotizador.coloresManteleria = estadoCotizador.coloresManteleria.filter(c => c !== colorLimpio && c !== nombre);
        estadoCotizador.menu.carnes = estadoCotizador.menu.carnes.filter(c => c.nombre !== nombre);

        await cargarCatalogoServicios();
        sincronizarSeleccionInicialConCatalogo();
        renderEstructuraPrincipal();
      } else {
        alert(data.error || 'No se pudo eliminar el registro.');
      }
    } catch (err) {
      console.error('Error al eliminar registro del catálogo:', err);
      alert('Error de conexión al eliminar el registro.');
    }
  }

  /**
   * Validación estricta antes de avanzar de paso (incluye bloqueo si la fecha ya está reservada)
   */
  async function intentarIrAlPaso(targetStep) {
    ocultarAlertaValidacion();

    // Validar paso 1
    if (targetStep > 1) {
      if (!estadoCotizador.cliente) {
        mostrarAlertaValidacion('Paso 1: Debe buscar y seleccionar un cliente registrado para poder continuar.');
        cambiarPasoVisual(1);
        return;
      }
      if (!estadoCotizador.fechaEvento) {
        mostrarAlertaValidacion('Paso 1: Debe definir una fecha de evento propuesta válida.');
        cambiarPasoVisual(1);
        return;
      }

      // Verificar que la fecha seleccionada NO esté ya reservada en el calendario
      const fechaDisponible = await verificarDisponibilidadFechaEnPaso1(estadoCotizador.fechaEvento, true);
      if (!fechaDisponible || estadoCotizador.fechaBloqueadaEnCalendario) {
        mostrarAlertaValidacion(`Paso 1: La fecha seleccionada (${estadoCotizador.fechaEvento}) ya se encuentra reservada. Por favor seleccione otra fecha disponible para poder continuar.`);
        cambiarPasoVisual(1);
        const inputF = document.getElementById('cotiz-fecha-evento');
        if (inputF) inputF.focus();
        return;
      }
    }

    // Validar paso 2
    if (targetStep > 2) {
      if (!estadoCotizador.cantidadPersonas || estadoCotizador.cantidadPersonas < 1 || estadoCotizador.cantidadPersonas > 120) {
        mostrarAlertaValidacion('Paso 2: La cantidad de personas es obligatoria y debe ser entre 1 y 120 personas.');
        cambiarPasoVisual(2);
        return;
      }
      if (!estadoCotizador.tiposEvento || estadoCotizador.tiposEvento.length === 0) {
        mostrarAlertaValidacion('Paso 2: Es obligatorio seleccionar al menos un tipo de evento.');
        cambiarPasoVisual(2);
        return;
      }
      if (!estadoCotizador.coloresManteleria || estadoCotizador.coloresManteleria.length === 0) {
        mostrarAlertaValidacion('Paso 2: Es obligatorio seleccionar al menos un color para Mantelería y Lazos Decorativos.');
        cambiarPasoVisual(2);
        return;
      }
    }

    // Validar paso 3 (Menú)
    if (targetStep > 3) {
      if (!estadoCotizador.menu.carnes || estadoCotizador.menu.carnes.length !== 2) {
        mostrarAlertaValidacion('Paso 3: Para el menú buffet es obligatorio seleccionar exactamente dos (2) opciones de carnes.');
        cambiarPasoVisual(3);
        return;
      }
      if (!estadoCotizador.menu.arroz) {
        mostrarAlertaValidacion('Paso 3: Debe seleccionar una opción de arroz.');
        cambiarPasoVisual(3);
        return;
      }
      if (!estadoCotizador.menu.ensalada) {
        mostrarAlertaValidacion('Paso 3: Debe seleccionar una opción de ensalada.');
        cambiarPasoVisual(3);
        return;
      }
      if (!estadoCotizador.menu.papas) {
        mostrarAlertaValidacion('Paso 3: Debe seleccionar una opción de papas.');
        cambiarPasoVisual(3);
        return;
      }
      if (!estadoCotizador.menu.arregloFrutal) {
        mostrarAlertaValidacion('Paso 3: Debe seleccionar una opción de arreglos frutales.');
        cambiarPasoVisual(3);
        return;
      }
    }

    cambiarPasoVisual(targetStep);
  }

  /**
   * Cambia visualmente el paso activo
   */
  function cambiarPasoVisual(paso) {
    estadoCotizador.pasoActual = paso;

    // Actualizar nodos del stepper
    document.querySelectorAll('.step-node').forEach(node => {
      const p = parseInt(node.getAttribute('data-step'), 10);
      if (p === paso) {
        node.classList.add('active');
        node.classList.remove('completed');
      } else if (p < paso) {
        node.classList.remove('active');
        node.classList.add('completed');
      } else {
        node.classList.remove('active');
        node.classList.remove('completed');
      }
    });

    // Actualizar paneles de contenido
    document.querySelectorAll('.step-pane').forEach((pane, idx) => {
      if (idx + 1 === paso) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });

    // Botones de navegación inferiores (solo Siguiente y Atrás de ser el caso)
    const btnPrev = document.getElementById('btn-step-prev');
    const btnNext = document.getElementById('btn-step-next');

    if (btnPrev) {
      btnPrev.style.display = paso === 1 ? 'none' : 'inline-flex';
    }

    if (btnNext) {
      if (paso === 4) {
        btnNext.style.display = 'none';
      } else {
        btnNext.style.display = 'inline-flex';
        btnNext.innerHTML = `<span>Siguiente →</span>`;
      }
    }

    // Si entra al paso 4, renderizar la proforma actualizada
    if (paso === 4) {
      const resumenWrapper = document.getElementById('resumen-final-wrapper');
      if (resumenWrapper) {
        resumenWrapper.innerHTML = renderPaso4Html();
        bindStep4Events();
      }
    }

    calcularTotales();

    // Scroll suave al inicio del cotizador
    const container = document.getElementById('cotizador-component-container');
    if (container) {
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /**
   * =========================================================================
   * EVENTOS DEL PASO 1 (BÚSQUEDA DE CLIENTE POR CÉDULA, FECHA Y HORA 24H)
   * =========================================================================
   */
  function bindStep1Events() {
    const inputBuscar = document.getElementById('cotiz-buscar-cliente-input');
    const btnBuscar = document.getElementById('btn-buscar-cliente-action');
    const dropdownResults = document.getElementById('cotiz-search-results');
    const msgNotFound = document.getElementById('cotiz-cliente-not-found-msg');
    const msgNotFoundText = document.getElementById('cotiz-cliente-not-found-text');
    const msgFound = document.getElementById('cotiz-cliente-found-msg');
    const msgFoundText = document.getElementById('cotiz-cliente-found-text');
    const btnCambiarCli = document.getElementById('btn-cambiar-cliente');
    const btnEliminarCli = document.getElementById('btn-eliminar-cliente-actual');
    const inputFecha = document.getElementById('cotiz-fecha-evento');
    const selectHora = document.getElementById('cotiz-hora-inicio');

    const ejecutarBusqueda = async () => {
      const q = (inputBuscar?.value || '').trim();
      estadoCotizador.busquedaClienteTexto = q;

      if (msgNotFound) msgNotFound.style.display = 'none';
      if (msgFound) msgFound.style.display = 'none';
      ocultarAlertaValidacion();

      if (!q) {
        estadoCotizador.mensajeBusquedaError = 'Por favor ingrese un número de cédula, RUC o nombre para realizar la búsqueda.';
        if (msgNotFoundText) msgNotFoundText.textContent = estadoCotizador.mensajeBusquedaError;
        if (msgNotFound) msgNotFound.style.display = 'flex';
        return;
      }

      try {
        if (btnBuscar) {
          btnBuscar.disabled = true;
          btnBuscar.textContent = 'Buscando...';
        }

        // 1. Si es numérico (cédula/RUC), intentar primero búsqueda exacta por cédula y también búsqueda general
        const res = await fetch(`modules/clientes/clientes_api.php?action=listar&q=${encodeURIComponent(q)}`);
        const data = await res.json();

        if (data.success && Array.isArray(data.clientes) && data.clientes.length > 0) {
          // Verificar si hay coincidencia exacta por cédula/RUC o un único cliente encontrado
          const exactoCedula = data.clientes.find(c => String(c.cedula_ruc).trim() === q);
          const clienteDirecto = exactoCedula || (data.clientes.length === 1 ? data.clientes[0] : null);

          if (clienteDirecto) {
            // Mostrar inmediatamente la información del cliente en pantalla
            seleccionarCliente(clienteDirecto);
            if (dropdownResults) dropdownResults.style.display = 'none';
            estadoCotizador.mensajeBusquedaError = '';
            estadoCotizador.mensajeBusquedaExito = `✓ Cliente localizado: ${clienteDirecto.nombres} ${clienteDirecto.apellidos} (C.I./RUC: ${clienteDirecto.cedula_ruc}).`;
            if (msgFoundText) msgFoundText.textContent = estadoCotizador.mensajeBusquedaExito;
            if (msgFound) msgFound.style.display = 'flex';
          } else {
            // Varios clientes coinciden con el nombre: mostrar desplegable para elegir
            if (dropdownResults) {
              dropdownResults.innerHTML = data.clientes.map(c => `
                <div class="cotiz-search-item" data-id="${c.id_cliente}">
                  <div class="search-item-top">
                    <strong>${escapeHtml(c.nombres)} ${escapeHtml(c.apellidos)}</strong>
                    <code>${escapeHtml(c.cedula_ruc)}</code>
                  </div>
                  <div class="search-item-sub">
                    <span>📞 ${escapeHtml(c.telefono || 'Sin teléfono')}</span>
                    <span>✉ ${escapeHtml(c.correo || 'Sin correo')}</span>
                  </div>
                </div>
              `).join('');
              dropdownResults.style.display = 'block';

              dropdownResults.querySelectorAll('.cotiz-search-item').forEach(item => {
                item.addEventListener('click', () => {
                  const id = parseInt(item.getAttribute('data-id'), 10);
                  const cli = data.clientes.find(x => parseInt(x.id_cliente, 10) === id);
                  if (cli) {
                    seleccionarCliente(cli);
                    dropdownResults.style.display = 'none';
                    estadoCotizador.mensajeBusquedaError = '';
                    estadoCotizador.mensajeBusquedaExito = `✓ Cliente seleccionado: ${cli.nombres} ${cli.apellidos}.`;
                    if (msgFoundText) msgFoundText.textContent = estadoCotizador.mensajeBusquedaExito;
                    if (msgFound) msgFound.style.display = 'flex';
                  }
                });
              });
            }
          }
        } else {
          // El cliente NO se encuentra registrado
          estadoCotizador.cliente = null;
          const cardCli = document.getElementById('cliente-seleccionado-card');
          if (cardCli) cardCli.style.display = 'none';
          if (dropdownResults) dropdownResults.style.display = 'none';

          estadoCotizador.mensajeBusquedaExito = '';
          estadoCotizador.mensajeBusquedaError = `El cliente con identificación o criterio «${q}» no se encuentra registrado en el sistema.`;
          if (msgNotFoundText) msgNotFoundText.textContent = estadoCotizador.mensajeBusquedaError;
          if (msgNotFound) msgNotFound.style.display = 'flex';
        }
      } catch (err) {
        console.error('Error buscando cliente:', err);
        estadoCotizador.mensajeBusquedaError = 'Error al consultar la base de datos de clientes.';
        if (msgNotFoundText) msgNotFoundText.textContent = estadoCotizador.mensajeBusquedaError;
        if (msgNotFound) msgNotFound.style.display = 'flex';
      } finally {
        if (btnBuscar) {
          btnBuscar.disabled = false;
          btnBuscar.textContent = 'Buscar';
        }
      }
    };

    if (btnBuscar) {
      btnBuscar.addEventListener('click', ejecutarBusqueda);
    }

    if (inputBuscar) {
      inputBuscar.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          ejecutarBusqueda();
        }
      });
      inputBuscar.addEventListener('input', (e) => {
        estadoCotizador.busquedaClienteTexto = e.target.value;
      });
    }

    if (btnCambiarCli) {
      btnCambiarCli.addEventListener('click', () => {
        estadoCotizador.cliente = null;
        estadoCotizador.mensajeBusquedaExito = '';
        estadoCotizador.mensajeBusquedaError = '';
        const card = document.getElementById('cliente-seleccionado-card');
        if (card) card.style.display = 'none';
        if (msgFound) msgFound.style.display = 'none';
        if (msgNotFound) msgNotFound.style.display = 'none';
        if (inputBuscar) {
          inputBuscar.value = '';
          inputBuscar.focus();
        }
      });
    }

    if (btnEliminarCli) {
      btnEliminarCli.addEventListener('click', async () => {
        if (!estadoCotizador.cliente) return;
        const cli = estadoCotizador.cliente;
        if (!confirm(`¿Está seguro de eliminar al cliente «${cli.nombres} ${cli.apellidos}» (C.I. ${cli.cedula_ruc}) de la base de datos?\n\nSe guardará el respaldo histórico en la tabla de auditoría.`)) {
          return;
        }
        try {
          const res = await fetch('modules/clientes/clientes_api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'eliminar', id_cliente: cli.id_cliente })
          });
          const data = await res.json();
          if (data.success) {
            estadoCotizador.cliente = null;
            estadoCotizador.mensajeBusquedaExito = '';
            estadoCotizador.mensajeBusquedaError = '';
            renderEstructuraPrincipal();
            alert('Cliente eliminado y registrado en el historial de auditoría.');
          } else {
            alert(data.error || 'No se pudo eliminar el cliente.');
          }
        } catch (err) {
          console.error(err);
          alert('Error de red al intentar eliminar el cliente.');
        }
      });
    }

    // Modal de registro rápido de cliente desde Paso 1
    const btnAbrirNuevoCli1 = document.getElementById('btn-abrir-nuevo-cliente-paso1');
    const btnAbrirNuevoCliAlerta = document.getElementById('btn-registrar-cliente-desde-alerta');
    const modalNuevoCli = document.getElementById('modal-cotiz-nuevo-cliente');
    const btnCerrarNuevoCli = document.getElementById('btn-cerrar-modal-cotiz-cli');
    const btnCancelarNuevoCli = document.getElementById('btn-cancelar-modal-cotiz-cli');
    const formNuevoCli = document.getElementById('form-cotiz-nuevo-cliente');

    const abrirModalNuevoCli = () => {
      if (!modalNuevoCli) return;
      const alertCli = document.getElementById('cotiz-cli-modal-alert');
      if (alertCli) alertCli.style.display = 'none';
      if (formNuevoCli) formNuevoCli.reset();
      const qVal = (inputBuscar?.value || '').trim();
      if (/^\d+$/.test(qVal)) {
        const inputCed = document.getElementById('cotiz-nuevo-cli-cedula');
        if (inputCed) inputCed.value = qVal;
      }
      modalNuevoCli.classList.add('show');
    };

    if (btnAbrirNuevoCli1) btnAbrirNuevoCli1.addEventListener('click', abrirModalNuevoCli);
    if (btnAbrirNuevoCliAlerta) btnAbrirNuevoCliAlerta.addEventListener('click', abrirModalNuevoCli);
    if (btnCerrarNuevoCli && modalNuevoCli) btnCerrarNuevoCli.addEventListener('click', () => modalNuevoCli.classList.remove('show'));
    if (btnCancelarNuevoCli && modalNuevoCli) btnCancelarNuevoCli.addEventListener('click', () => modalNuevoCli.classList.remove('show'));

    if (formNuevoCli) {
      formNuevoCli.addEventListener('submit', async (e) => {
        e.preventDefault();
        const cedula_ruc = document.getElementById('cotiz-nuevo-cli-cedula').value.trim();
        const nombres = document.getElementById('cotiz-nuevo-cli-nombres').value.trim();
        const apellidos = document.getElementById('cotiz-nuevo-cli-apellidos').value.trim();
        const telefono = document.getElementById('cotiz-nuevo-cli-telefono').value.trim();
        const correo = document.getElementById('cotiz-nuevo-cli-correo').value.trim();
        const direccion = document.getElementById('cotiz-nuevo-cli-direccion').value.trim();
        const alertCli = document.getElementById('cotiz-cli-modal-alert');

        try {
          const res = await fetch('modules/clientes/clientes_api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'crear',
              cedula_ruc,
              nombres,
              apellidos,
              telefono,
              correo,
              direccion
            })
          });
          const data = await res.json();
          if (data.success && data.cliente) {
            modalNuevoCli?.classList.remove('show');
            estadoCotizador.mensajeBusquedaError = '';
            estadoCotizador.mensajeBusquedaExito = `✓ Cliente registrado y seleccionado: ${data.cliente.nombres} ${data.cliente.apellidos}.`;
            seleccionarCliente(data.cliente);
            renderEstructuraPrincipal();
          } else {
            if (alertCli) {
              alertCli.textContent = data.error || 'Error al registrar el cliente.';
              alertCli.style.display = 'flex';
            }
          }
        } catch (err) {
          if (alertCli) {
            alertCli.textContent = 'Error de conexión al registrar el cliente.';
            alertCli.style.display = 'flex';
          }
        }
      });
    }

    // Fecha de evento con verificación en tiempo real contra el Calendario de Reservas (RF06)
    if (inputFecha) {
      inputFecha.addEventListener('change', (e) => {
        estadoCotizador.fechaEvento = e.target.value;
        verificarDisponibilidadFechaEnPaso1(estadoCotizador.fechaEvento, true);
      });
      verificarDisponibilidadFechaEnPaso1(estadoCotizador.fechaEvento, false);
    }

    // Selector de 24 horas (dropdown + pestañas de periodo + botones de cada media hora)
    const actualizarHoraSeleccionada = (nuevaHora) => {
      estadoCotizador.horaInicio = nuevaHora;
      if (selectHora) selectHora.value = nuevaHora;

      const info = HORARIOS_24H.find(h => h.valor === nuevaHora);
      const badgeTxt = document.getElementById('texto-hora-seleccionada');
      if (badgeTxt && info) {
        badgeTxt.textContent = info.etiqueta;
      }

      document.querySelectorAll('.btn-time-slot-24h').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-time') === nuevaHora);
      });
    };

    if (selectHora) {
      selectHora.addEventListener('change', (e) => {
        actualizarHoraSeleccionada(e.target.value);
      });
    }

    document.querySelectorAll('.time-period-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        estadoCotizador.filtroPeriodoHora = tab.getAttribute('data-periodo') || 'Todas';
        const stepPane1 = document.getElementById('step-pane-1');
        if (stepPane1) {
          stepPane1.innerHTML = renderPaso1Html();
          bindStep1Events();
        }
      });
    });

    document.querySelectorAll('.btn-time-slot-24h').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-time');
        if (val) actualizarHoraSeleccionada(val);
      });
    });
  }

  /**
   * Asigna un cliente al estado y actualiza su tarjeta en pantalla
   */
  function seleccionarCliente(cli) {
    estadoCotizador.cliente = cli;
    estadoCotizador.busquedaClienteTexto = cli.cedula_ruc || '';

    const card = document.getElementById('cliente-seleccionado-card');
    if (!card) return;

    const nombre = `${cli.nombres || ''} ${cli.apellidos || ''}`.trim();
    const partes = nombre.split(' ').filter(Boolean);
    let iniciales = 'CL';
    if (partes.length >= 2) {
      iniciales = (partes[0][0] + partes[1][0]).toUpperCase();
    } else if (partes.length === 1) {
      iniciales = partes[0].substring(0, 2).toUpperCase();
    }

    const elIni = document.getElementById('cs-iniciales');
    const elNom = document.getElementById('cs-nombre');
    const elCed = document.getElementById('cs-cedula');
    const elTel = document.getElementById('cs-telefono');
    const elCor = document.getElementById('cs-correo');

    if (elIni) elIni.textContent = iniciales;
    if (elNom) elNom.textContent = nombre;
    if (elCed) elCed.textContent = cli.cedula_ruc || 'N/A';
    if (elTel) elTel.textContent = cli.telefono || 'Sin teléfono';
    if (elCor) elCor.textContent = cli.correo || 'Sin correo';

    const badgeFrec = document.getElementById('cs-badge-frecuente');
    if (badgeFrec) {
      badgeFrec.style.display = (cli.total_eventos && cli.total_eventos > 0) ? 'inline-flex' : 'none';
    }

    card.style.display = 'block';
    ocultarAlertaValidacion();
  }

  /**
   * =========================================================================
   * EVENTOS DEL PASO 2 (SERVICIOS, TIPOS DE EVENTO, MANTELERÍA Y HORAS)
   * =========================================================================
   */
  function bindStep2Events() {
    const sliderPersonas = document.getElementById('cotiz-personas-slider');
    const displayNum = document.getElementById('capacity-number-val');
    const pillsPersonas = document.querySelectorAll('.btn-preset-pill');
    const containerTipos = document.getElementById('container-tipos-evento');
    const containerColores = document.getElementById('container-colores-manteleria');
    const containerHorasEvento = document.getElementById('selector-horas-evento');
    const containerHorasExtra = document.getElementById('selector-horas-extra');

    // 1. Slider de Personas (1 a 120 máx)
    if (sliderPersonas) {
      sliderPersonas.addEventListener('input', (e) => {
        let val = parseInt(e.target.value, 10);
        if (val < 1) val = 1;
        if (val > 120) val = 120;
        estadoCotizador.cantidadPersonas = val;
        if (displayNum) displayNum.textContent = val;

        pillsPersonas.forEach(p => {
          const pVal = parseInt(p.getAttribute('data-persons'), 10);
          p.classList.toggle('active', pVal === val);
        });

        calcularTotales();
      });
    }

    // Presets rápidos de personas
    pillsPersonas.forEach(p => {
      p.addEventListener('click', () => {
        const val = parseInt(p.getAttribute('data-persons'), 10);
        estadoCotizador.cantidadPersonas = val;
        if (sliderPersonas) sliderPersonas.value = val;
        if (displayNum) displayNum.textContent = val;

        pillsPersonas.forEach(x => x.classList.remove('active'));
        p.classList.add('active');

        calcularTotales();
      });
    });

    // 2. Tipos de Evento (Permite cambiar y seleccionar uno o más tipos de evento sin bloqueo)
    if (containerTipos) {
      containerTipos.querySelectorAll('.event-type-card').forEach(card => {
        card.addEventListener('click', (e) => {
          // Si hizo clic en el botón de eliminar de admin, ignorar
          if (e.target.closest('[data-admin-del]')) return;

          const val = card.getAttribute('data-type');
          if (!val) return;

          const yaEsta = estadoCotizador.tiposEvento.includes(val);
          if (yaEsta) {
            estadoCotizador.tiposEvento = estadoCotizador.tiposEvento.filter(t => t !== val);
            card.classList.remove('selected');
            card.setAttribute('aria-checked', 'false');
          } else {
            estadoCotizador.tiposEvento.push(val);
            card.classList.add('selected');
            card.setAttribute('aria-checked', 'true');
          }
          ocultarAlertaValidacion();
        });
      });
    }

    // 3. Mantelería y Lazos Decorativos (Permite cambiar y seleccionar uno o más colores sin bloqueo)
    if (containerColores) {
      containerColores.querySelectorAll('.color-swatch-card').forEach(card => {
        card.addEventListener('click', (e) => {
          if (e.target.closest('[data-admin-del]')) return;

          const val = card.getAttribute('data-color');
          if (!val) return;

          const yaEsta = estadoCotizador.coloresManteleria.includes(val);
          if (yaEsta) {
            estadoCotizador.coloresManteleria = estadoCotizador.coloresManteleria.filter(c => c !== val);
            card.classList.remove('selected');
            card.setAttribute('aria-checked', 'false');
          } else {
            estadoCotizador.coloresManteleria.push(val);
            card.classList.add('selected');
            card.setAttribute('aria-checked', 'true');
          }
          ocultarAlertaValidacion();
        });
      });
    }

    // 4. Horas de Evento (1 a 6)
    if (containerHorasEvento) {
      containerHorasEvento.querySelectorAll('.btn-hour-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          const h = parseInt(btn.getAttribute('data-hours'), 10);
          estadoCotizador.horasEvento = h;
          containerHorasEvento.querySelectorAll('.btn-hour-pill').forEach(x => x.classList.remove('active'));
          btn.classList.add('active');
          calcularTotales();
        });
      });
    }

    // 5. Horas Extra (1 a 5 a $80 c/u y "Sin extra" al final)
    if (containerHorasExtra) {
      containerHorasExtra.querySelectorAll('.btn-extra-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          const h = parseInt(btn.getAttribute('data-extra'), 10);
          estadoCotizador.horasExtra = h;
          containerHorasExtra.querySelectorAll('.btn-extra-pill').forEach(x => x.classList.remove('active'));
          btn.classList.add('active');
          calcularTotales();
        });
      });
    }
  }

  /**
   * =========================================================================
   * EVENTOS DEL PASO 3 (PERSONALIZACIÓN DE MENÚ BUFFET)
   * =========================================================================
   */
  function bindStep3Events() {
    // 1. CARNES (SELECCIÓN DE 2 CARNES TOTALES; DETECTA LOMO AUTOMÁTICAMENTE)
    document.querySelectorAll('.meat-check-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-admin-del]')) return;

        const subcat = card.getAttribute('data-subcat');
        const nombre = card.getAttribute('data-name');
        const esLomo = card.getAttribute('data-lomo') === '1';

        const yaSeleccionado = estadoCotizador.menu.carnes.some(c => c.nombre === nombre);

        if (yaSeleccionado) {
          // Desmarcar opción
          estadoCotizador.menu.carnes = estadoCotizador.menu.carnes.filter(c => c.nombre !== nombre);
          card.classList.remove('selected');
          card.setAttribute('aria-checked', 'false');
        } else {
          // Verificar límite de 2 carnes
          if (estadoCotizador.menu.carnes.length >= 2) {
            mostrarAlertaValidacion('Ya ha seleccionado 2 opciones de carnes. Si desea cambiar una, desmarque primero una de las carnes seleccionadas.');
            return;
          }

          estadoCotizador.menu.carnes.push({
            subcat,
            nombre,
            esLomo
          });
          card.classList.add('selected');
          card.setAttribute('aria-checked', 'true');
        }

        ocultarAlertaValidacion();
        actualizarIndicadoresCarnes();
        calcularTotales();
      });
    });

    // 2. OPCIONES DE SELECCIÓN ÚNICA (ARROZ, ENSALADA, PAPAS, ARREGLO FRUTAL)
    document.querySelectorAll('.menu-radio-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-admin-del]')) return;

        const field = card.getAttribute('data-menu-field');
        const val = card.getAttribute('data-value');
        if (!field || !val) return;

        estadoCotizador.menu[field] = val;

        const parentGrid = card.parentElement;
        if (parentGrid) {
          parentGrid.querySelectorAll('.menu-radio-card').forEach(c => {
            c.classList.remove('selected');
            c.setAttribute('aria-checked', 'false');
          });
        }
        card.classList.add('selected');
        card.setAttribute('aria-checked', 'true');
        ocultarAlertaValidacion();
      });
    });
  }

  /**
   * Actualiza el badge dinámico de precio de plato ($14 o $16) según carnes
   */
  function actualizarIndicadoresCarnes() {
    const bannerPlato = document.getElementById('display-plato-banner');
    const badgeCounter = document.getElementById('badge-meat-counter');
    const badgeTier = document.getElementById('badge-meat-tier');
    const bannerBox = document.getElementById('menu-price-banner');

    const totalCarnes = estadoCotizador.menu.carnes.length;
    const tieneLomo = estadoCotizador.menu.carnes.some(c => c.esLomo);

    if (badgeCounter) {
      badgeCounter.textContent = `${totalCarnes} / 2 carnes seleccionadas`;
      badgeCounter.classList.toggle('ready', totalCarnes === 2);
    }

    if (bannerPlato) {
      bannerPlato.textContent = tieneLomo ? '$16.00' : '$14.00';
    }

    if (badgeTier) {
      if (tieneLomo) {
        badgeTier.textContent = '★ Tarifa Especial con Lomo ($16.00)';
        badgeTier.className = 'badge-meat-tier tier-lomo';
      } else {
        badgeTier.textContent = 'Tarifa Estándar ($14.00)';
        badgeTier.className = 'badge-meat-tier tier-standard';
      }
    }

    if (bannerBox) {
      bannerBox.classList.toggle('has-lomo', tieneLomo);
    }
  }

  /**
   * =========================================================================
   * EVENTOS DEL PASO 4 (GUARDAR EN MYSQL, IMPRESIÓN Y NUEVA COTIZACIÓN)
   * =========================================================================
   */
  function bindStep4Events() {
    const btnGuardar = document.getElementById('btn-guardar-cotizacion-db');
    const btnImprimir = document.getElementById('btn-imprimir-proforma');
    const btnVerGuardadasStep4 = document.getElementById('btn-step4-ver-guardadas');
    const btnNueva = document.getElementById('btn-nueva-cotizacion');
    const panelInline = document.getElementById('panel-cotizaciones-guardadas-step4');

    if (btnGuardar) {
      btnGuardar.addEventListener('click', async () => {
        try {
          btnGuardar.disabled = true;
          btnGuardar.innerHTML = 'Guardando cotización en el servidor...';

          const payload = {
            action: 'crear',
            id_cliente: estadoCotizador.cliente ? estadoCotizador.cliente.id_cliente : 0,
            cantidad_personas: estadoCotizador.cantidadPersonas,
            tipo_evento: estadoCotizador.tiposEvento,
            color_manteleria: estadoCotizador.coloresManteleria,
            horas_evento: estadoCotizador.horasEvento,
            horas_extra: estadoCotizador.horasExtra,
            fecha_evento_propuesta: estadoCotizador.fechaEvento,
            hora_inicio: estadoCotizador.horaInicio,
            menu: {
              carnes: estadoCotizador.menu.carnes,
              arroz: estadoCotizador.menu.arroz,
              ensalada: estadoCotizador.menu.ensalada,
              papas: estadoCotizador.menu.papas,
              arreglo_frutal: estadoCotizador.menu.arregloFrutal
            },
            observaciones: 'Cotización generada desde el Cotizador Inteligente RF04'
          };

          const res = await fetch('modules/cotizador/cotizaciones_api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const data = await res.json();

          if (data.success) {
            estadoCotizador.cotizacionGuardada = data.resumen;

            await cargarListaCotizacionesGuardadas();

            // Re-renderizar el Paso 4 para actualizar el listado de cotizaciones guardadas en la misma pantalla
            const resumenWrapper = document.getElementById('resumen-final-wrapper');
            if (resumenWrapper) {
              resumenWrapper.innerHTML = renderPaso4Html();
              bindStep4Events();
            }

            alert(`¡Cotización #${data.id_cotizacion} guardada exitosamente!\n\nCliente: ${data.resumen.cliente}\nTotal: $${data.resumen.total_estimado.toFixed(2)}\n\nQueda almacenada en "Cotizaciones Guardadas" para que pueda verla e imprimirla las veces que sean necesarias.`);
          } else {
            alert('Error al guardar cotización: ' + data.error);
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = 'Reintentar Guardar Cotización';
          }
        } catch (err) {
          console.error('Error guardando cotización:', err);
          alert('Error de conexión al guardar la cotización.');
          btnGuardar.disabled = false;
          btnGuardar.innerHTML = 'Reintentar Guardar Cotización';
        }
      });
    }

    if (btnImprimir) {
      btnImprimir.addEventListener('click', () => {
        window.print();
      });
    }

    const btnAgendarStep4 = document.getElementById('btn-agendar-reserva-desde-step4');
    if (btnAgendarStep4) {
      btnAgendarStep4.addEventListener('click', () => {
        const idCot = parseInt(btnAgendarStep4.getAttribute('data-cot-id'), 10);
        const fecha = btnAgendarStep4.getAttribute('data-fecha') || estadoCotizador.fechaEvento;
        if (window.agendarCotizacionEnCalendario) {
          window.agendarCotizacionEnCalendario(idCot, fecha);
        }
      });
    }

    if (btnVerGuardadasStep4) {
      btnVerGuardadasStep4.addEventListener('click', () => {
        mostrarModalCotizacionesGuardadas();
      });
    }

    if (btnNueva) {
      btnNueva.addEventListener('click', () => {
        if (confirm('¿Desea iniciar una nueva cotización desde cero?')) {
          reiniciarCotizador();
        }
      });
    }

    if (panelInline) {
      bindEventosAccionesCotizacionesGuardadas(panelInline);
    }
  }

  /**
   * Vincula los botones "Ver Proforma" e "Imprimir" de una lista de cotizaciones guardadas
   */
  function bindEventosAccionesCotizacionesGuardadas(container) {
    if (!container) return;

    container.querySelectorAll('[data-load-cot-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idCot = parseInt(btn.getAttribute('data-load-cot-id'), 10);
        const imprimirAhora = btn.getAttribute('data-print-now') === '1';
        const cot = estadoCotizador.cotizacionesGuardadasLista.find(x => Number(x.id_cotizacion) === idCot);
        if (cot) {
          cargarCotizacionGuardadaEnProforma(cot, imprimirAhora);
        }
      });
    });

    container.querySelectorAll('[data-schedule-cot-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idCot = parseInt(btn.getAttribute('data-schedule-cot-id'), 10);
        const fecha = btn.getAttribute('data-schedule-fecha') || estadoCotizador.fechaEvento;
        document.getElementById('modal-cotizaciones-guardadas')?.classList.remove('show');
        if (window.agendarCotizacionEnCalendario) {
          window.agendarCotizacionEnCalendario(idCot, fecha);
        }
      });
    });

    container.querySelectorAll('[data-del-saved-cot-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idCot = parseInt(btn.getAttribute('data-del-saved-cot-id'), 10);
        if (!confirm(`¿Confirma eliminar la cotización #${idCot}? Quedará constancia en el historial de auditoría.`)) return;
        const r = await fetch('modules/cotizador/cotizaciones_api.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'eliminar', id_cotizacion: idCot })
        });
        const d = await r.json();
        if (d.success) {
          if (estadoCotizador.cotizacionGuardada && Number(estadoCotizador.cotizacionGuardada.id_cotizacion) === idCot) {
            estadoCotizador.cotizacionGuardada = null;
          }
          await cargarListaCotizacionesGuardadas();
          mostrarModalCotizacionesGuardadas();
          if (estadoCotizador.pasoActual === 4) {
            const resumenWrapper = document.getElementById('resumen-final-wrapper');
            if (resumenWrapper) {
              resumenWrapper.innerHTML = renderPaso4Html();
              bindStep4Events();
            }
          }
        } else {
          alert(d.error || 'No se pudo eliminar la cotización.');
        }
      });
    });
  }

  /**
   * Carga todos los datos de una cotización guardada en el Paso 4 (Resumen & Proforma)
   * y opcionalmente dispara la impresión inmediata las veces que sean necesarias
   */
  function cargarCotizacionGuardadaEnProforma(cot, imprimirDirecto = false) {
    if (!cot) return;

    // 1. Reconstruir cliente
    estadoCotizador.cliente = {
      id_cliente: cot.id_cliente,
      nombres: cot.nombres || 'Cliente',
      apellidos: cot.apellidos || '',
      cedula_ruc: cot.cedula_ruc || 'N/A',
      telefono: cot.telefono || 'N/A',
      correo: cot.correo || 'N/A',
      direccion: cot.direccion || 'Quito, Pichincha'
    };
    estadoCotizador.busquedaClienteTexto = cot.cedula_ruc || '';

    // 2. Reconstruir fecha, hora, personas, tipo de evento, mantelería y horas
    estadoCotizador.fechaEvento = cot.fecha_evento_propuesta || estadoCotizador.fechaEvento;
    estadoCotizador.horaInicio = cot.hora_inicio || '15:30';
    estadoCotizador.cantidadPersonas = parseInt(cot.cantidad_personas, 10) || 60;

    const tiposArr = String(cot.tipo_evento || 'Cumpleaños')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    estadoCotizador.tiposEvento = tiposArr.length > 0 ? tiposArr : ['Cumpleaños'];

    const coloresArr = String(cot.color_manteleria || 'Dorado')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    estadoCotizador.coloresManteleria = coloresArr.length > 0 ? coloresArr : ['Dorado'];

    estadoCotizador.horasEvento = parseInt(cot.horas_evento, 10) || 5;
    estadoCotizador.horasExtra = parseInt(cot.horas_extra, 10) || 0;

    // 3. Reconstruir menú desglosado
    const md = cot.menu_desglosado || {};
    let carnesReconstruidas = [];
    if (Array.isArray(md.carnes) && md.carnes.length > 0) {
      carnesReconstruidas = md.carnes.map(c => {
        if (typeof c === 'string') {
          return {
            subcat: /lomo/i.test(c) ? 'lomos' : 'carnes',
            nombre: c,
            esLomo: /lomo/i.test(c)
          };
        }
        return {
          subcat: c.subcat || (/lomo/i.test(c.nombre || '') ? 'lomos' : 'carnes'),
          nombre: c.nombre || 'Carne seleccionada',
          esLomo: Boolean(c.esLomo || /lomo/i.test(c.nombre || ''))
        };
      });
    } else {
      const esTarifaLomo = parseFloat(cot.precio_plato || 14) >= 16;
      carnesReconstruidas = [
        { subcat: 'pollos', nombre: 'Pollo: Al vino', esLomo: false },
        { subcat: esTarifaLomo ? 'lomos' : 'medallones', nombre: esTarifaLomo ? 'Lomo: Res en salsa de champiñones' : 'Medallón: Pavo', esLomo: esTarifaLomo }
      ];
    }

    estadoCotizador.menu = {
      carnes: carnesReconstruidas,
      arroz: md.arroz || estadoCotizador.menu.arroz || 'Arroz Verde (albahaca)',
      ensalada: md.ensalada || estadoCotizador.menu.ensalada || 'Ensalada Waldorf (zanahoria, choclo, alverja, piña, apio y manzana)',
      papas: md.papas || estadoCotizador.menu.papas || 'Papas: Gratinada con cáscara, bañada en ajo y mantequilla',
      arregloFrutal: md.arreglo_frutal || md.arregloFrutal || estadoCotizador.menu.arregloFrutal || 'Cisne de Frutas'
    };

    // 4. Marcar como cotización guardada activa
    estadoCotizador.cotizacionGuardada = {
      id_cotizacion: cot.id_cotizacion,
      cliente: `${cot.nombres || ''} ${cot.apellidos || ''}`.trim(),
      cedula_ruc: cot.cedula_ruc,
      fecha_evento: cot.fecha_evento_propuesta,
      hora_inicio: cot.hora_inicio || '15:30',
      cantidad_personas: estadoCotizador.cantidadPersonas,
      precio_plato: parseFloat(cot.precio_plato || 14),
      subtotal_menu: parseFloat(cot.subtotal_menu || 0),
      horas_evento: estadoCotizador.horasEvento,
      horas_extra: estadoCotizador.horasExtra,
      subtotal_horas_extra: parseFloat(cot.subtotal_horas_extra || 0),
      total_estimado: parseFloat(cot.total_estimado || 0)
    };

    // Cerrar modales si estaban abiertos
    document.getElementById('modal-cotizaciones-guardadas')?.classList.remove('show');
    document.getElementById('modal-historial-bd')?.classList.remove('show');

    // Renderizar y mostrar directamente el Paso 4 (Resumen & Proforma)
    estadoCotizador.pasoActual = 4;
    renderEstructuraPrincipal();
    cambiarPasoVisual(4);

    if (imprimirDirecto) {
      setTimeout(() => {
        window.print();
      }, 200);
    }
  }

  /**
   * Abre el modal con todas las cotizaciones realizadas y guardadas para verlas o imprimirlas
   */
  async function mostrarModalCotizacionesGuardadas() {
    const modal = document.getElementById('modal-cotizaciones-guardadas');
    const modalBody = document.getElementById('modal-cotiz-guardadas-body');
    if (!modal || !modalBody) return;

    modalBody.innerHTML = '<div class="clients-loading-skeleton"><div class="spinner-dark"></div><p>Consultando cotizaciones guardadas...</p></div>';
    modal.classList.add('show');

    await cargarListaCotizacionesGuardadas();

    const renderizarContenidoModal = (filtro = '') => {
      const q = filtro.trim().toLowerCase();
      const filtradas = estadoCotizador.cotizacionesGuardadasLista.filter(c => {
        if (!q) return true;
        const texto = `#${c.id_cotizacion} ${c.nombres || ''} ${c.apellidos || ''} ${c.cedula_ruc || ''} ${c.tipo_evento || ''} ${c.fecha_evento_propuesta || ''}`.toLowerCase();
        return texto.includes(q);
      });

      modalBody.innerHTML = `
        <div class="saved-quotes-modal-toolbar">
          <input
            type="text"
            id="input-buscar-cotiz-guardada"
            class="form-control"
            style="padding: 0 0.875rem;"
            placeholder="Filtrar por #ID, nombre de cliente, cédula, tipo de evento o fecha..."
            value="${escapeHtml(filtro)}"
          >
        </div>
        <div id="contenedor-lista-modal-guardadas">
          ${renderTablaCotizacionesGuardadasHtml(filtradas, 'modal')}
        </div>
      `;

      const inputFiltro = document.getElementById('input-buscar-cotiz-guardada');
      if (inputFiltro) {
        inputFiltro.addEventListener('input', (e) => {
          const val = e.target.value;
          const q2 = val.trim().toLowerCase();
          const subLista = estadoCotizador.cotizacionesGuardadasLista.filter(c => {
            if (!q2) return true;
            const texto = `#${c.id_cotizacion} ${c.nombres || ''} ${c.apellidos || ''} ${c.cedula_ruc || ''} ${c.tipo_evento || ''} ${c.fecha_evento_propuesta || ''}`.toLowerCase();
            return texto.includes(q2);
          });
          const cont = document.getElementById('contenedor-lista-modal-guardadas');
          if (cont) {
            cont.innerHTML = renderTablaCotizacionesGuardadasHtml(subLista, 'modal');
            bindEventosAccionesCotizacionesGuardadas(cont);
          }
        });
      }

      const cont = document.getElementById('contenedor-lista-modal-guardadas');
      if (cont) {
        bindEventosAccionesCotizacionesGuardadas(cont);
      }
    };

    renderizarContenidoModal('');
  }

  /**
   * Resetea el estado a los valores iniciales y regresa al paso 1
   */
  function reiniciarCotizador() {
    estadoCotizador.pasoActual = 1;
    estadoCotizador.cliente = null;
    estadoCotizador.busquedaClienteTexto = '';
    estadoCotizador.mensajeBusquedaError = '';
    estadoCotizador.mensajeBusquedaExito = '';
    estadoCotizador.horaInicio = '15:30';
    estadoCotizador.cantidadPersonas = 60;
    estadoCotizador.tiposEvento = ['Cumpleaños'];
    estadoCotizador.coloresManteleria = ['Dorado'];
    estadoCotizador.horasEvento = 5;
    estadoCotizador.horasExtra = 0;
    estadoCotizador.menu = {
      carnes: [],
      arroz: 'Arroz Verde (albahaca)',
      ensalada: 'Ensalada Waldorf (zanahoria, choclo, alverja, piña, apio y manzana)',
      papas: 'Papas: Gratinada con cáscara, bañada en ajo y mantequilla',
      arregloFrutal: 'Cisne de Frutas'
    };
    estadoCotizador.cotizacionGuardada = null;

    sincronizarSeleccionInicialConCatalogo();
    renderEstructuraPrincipal();
    cambiarPasoVisual(1);
  }

  /**
   * Actualiza los indicadores de precio
   */
  function calcularTotales() {
    actualizarIndicadoresCarnes();
  }

  function mostrarAlertaValidacion(mensaje) {
    const alertBox = document.getElementById('cotizador-validation-alert');
    if (alertBox) {
      alertBox.textContent = mensaje;
      alertBox.style.display = 'flex';
      alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function ocultarAlertaValidacion() {
    const alertBox = document.getElementById('cotizador-validation-alert');
    if (alertBox) {
      alertBox.style.display = 'none';
      alertBox.textContent = '';
    }
  }

  /**
   * Modal del Catálogo Oficial de Servicios (RF03)
   */
  function mostrarModalCatalogo() {
    const modal = document.getElementById('modal-catalogo-rf03');
    const modalBody = document.getElementById('modal-catalogo-body');
    if (!modal || !modalBody) return;

    if (!estadoCotizador.catalogo) {
      modalBody.innerHTML = '<p>Cargando información del catálogo...</p>';
      modal.classList.add('show');
      return;
    }

    const cat = estadoCotizador.catalogo;

    modalBody.innerHTML = `
      <div class="cat-modal-section">
        <h4 class="cat-modal-heading">1. Tarifas Oficiales de Banquete y Capacidad</h4>
        <div class="cat-rates-grid">
          <div class="cat-rate-box">
            <span class="cat-rate-title">Menú Buffet Estándar</span>
            <span class="cat-rate-val">$14.00</span>
            <span class="cat-rate-sub">por persona (2 carnes sin lomo + guarniciones + servicios)</span>
          </div>
          <div class="cat-rate-box highlight">
            <span class="cat-rate-title">Menú Buffet Especial</span>
            <span class="cat-rate-val">$16.00</span>
            <span class="cat-rate-sub">por persona (incluye lomo de res o cerdo + servicios)</span>
          </div>
          <div class="cat-rate-box">
            <span class="cat-rate-title">Hora Extra de Salón</span>
            <span class="cat-rate-val">$80.00</span>
            <span class="cat-rate-sub">por hora adicional de atención y música</span>
          </div>
          <div class="cat-rate-box">
            <span class="cat-rate-title">Aforo Máximo Autorizado</span>
            <span class="cat-rate-val">120 pers.</span>
            <span class="cat-rate-sub">capacidad total de comensales sentados</span>
          </div>
        </div>
      </div>

      <div class="cat-modal-section">
        <h4 class="cat-modal-heading">2. Servicios Incluidos en el Paquete Base ($0.00 Adicional)</h4>
        <ul class="cat-included-list">
          ${cat.servicios_incluidos.map(s => `
            <li>
              <strong>${escapeHtml(s.nombre)}:</strong> <span>${escapeHtml(s.descripcion)}</span>
            </li>
          `).join('')}
        </ul>
      </div>

      <div class="cat-modal-section">
        <h4 class="cat-modal-heading">3. Opciones de Decoración y Mantelería</h4>
        <p class="cat-desc-text">
          Los manteles de las mesas y los vestidos de las sillas siempre son blancos. 
          Lazos y cubre manteles disponibles en: 
          <strong>${cat.colores_manteleria.map(c => escapeHtml(c.nombre)).join(', ')}</strong>.
        </p>
      </div>

      <div class="cat-modal-section">
        <h4 class="cat-modal-heading">4. Tipos de Eventos Gestionados</h4>
        <p class="cat-desc-text">
          ${cat.tipos_evento.map(t => escapeHtml(t)).join(' • ')}
        </p>
      </div>
    `;

    modal.classList.add('show');
  }

  /**
   * Modal de Historial de Auditoría en Base de Datos (`historial_acciones`), Papelera y Cotizaciones
   */
  async function mostrarModalHistorialBD() {
    const modal = document.getElementById('modal-historial-bd');
    const modalBody = document.getElementById('modal-historial-body');
    if (!modal || !modalBody) return;

    modalBody.innerHTML = '<div class="clients-loading-skeleton"><div class="spinner-dark"></div><p>Consultando historial en la base de datos...</p></div>';
    modal.classList.add('show');

    try {
      const [resHist, resCots] = await Promise.all([
        fetch('modules/servicios/servicios_api.php?action=historial'),
        fetch('modules/cotizador/cotizaciones_api.php?action=listar&limit=30')
      ]);

      const dataHist = await resHist.json();
      const dataCots = await resCots.json();

      const historial = dataHist.historial || [];
      const inactivos = dataHist.servicios_inactivos || [];
      const cotizaciones = dataCots.cotizaciones || [];
      estadoCotizador.cotizacionesGuardadasLista = cotizaciones;

      modalBody.innerHTML = `
        <!-- Sección 1: Cotizaciones Registradas (Con opción de ver, imprimir y eliminar) -->
        <div class="cat-modal-section">
          <h4 class="cat-modal-heading">1. Cotizaciones Registradas en Base de Datos (${cotizaciones.length})</h4>
          ${cotizaciones.length === 0 ? `<p class="cat-desc-text">Aún no hay cotizaciones guardadas.</p>` : `
            <div style="max-height: 220px; overflow-y: auto; border: 1px solid #E2E8F0; border-radius: 8px;">
              <table class="proforma-table" style="font-size: 0.75rem;">
                <thead>
                  <tr>
                    <th>#ID</th>
                    <th>Cliente</th>
                    <th>Fecha / Hora</th>
                    <th>Evento</th>
                    <th>Total</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  ${cotizaciones.map(c => `
                    <tr>
                      <td><strong>#${c.id_cotizacion}</strong></td>
                      <td>${escapeHtml(c.nombres)} ${escapeHtml(c.apellidos)}<br><small>${escapeHtml(c.cedula_ruc)}</small></td>
                      <td>${escapeHtml(c.fecha_evento_propuesta)}<br><small>${escapeHtml(c.hora_inicio || '')}</small></td>
                      <td>${escapeHtml(c.tipo_evento || '')} (${c.cantidad_personas}p)</td>
                      <td><strong>$${parseFloat(c.total_estimado || 0).toFixed(2)}</strong></td>
                      <td style="display:flex; flex-wrap:wrap; gap:0.25rem;">
                        <button type="button" class="btn-sq-action btn-sq-view" style="padding:0.2rem 0.45rem; font-size:0.7rem;" data-hist-load-cot="${c.id_cotizacion}" data-hist-print="0">👁️ Ver</button>
                        <button type="button" class="btn-sq-action btn-sq-print" style="padding:0.2rem 0.45rem; font-size:0.7rem;" data-hist-load-cot="${c.id_cotizacion}" data-hist-print="1">🖨️ Imprimir</button>
                        <button type="button" class="btn-admin-delete-row" data-del-cot="${c.id_cotizacion}">Eliminar</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>

        <!-- Sección 2: Registros de Catálogo Eliminados (Con opción de restaurar) -->
        ${inactivos.length > 0 ? `
          <div class="cat-modal-section">
            <h4 class="cat-modal-heading">2. Registros del Catálogo Dados de Baja (${inactivos.length})</h4>
            <div style="display:flex; flex-wrap:wrap; gap:0.5rem;">
              ${inactivos.map(item => `
                <div style="display:inline-flex; align-items:center; gap:0.5rem; background:#FEF2F2; border:1px solid #FECACA; padding:0.35rem 0.65rem; border-radius:8px; font-size:0.75rem;">
                  <span><strong>${escapeHtml(item.nombre_servicio)}</strong> <small>(${escapeHtml(item.categoria)})</small></span>
                  <button type="button" class="btn-admin-restore-row" data-restore-serv="${item.id_servicio}" style="background:#059669; color:#FFF; border:none; border-radius:4px; padding:0.15rem 0.45rem; cursor:pointer; font-weight:700;">↺ Restaurar</button>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Sección 3: Bitácora Histórica de Acciones (Tabla historial_acciones) -->
        <div class="cat-modal-section">
          <h4 class="cat-modal-heading">3. Bitácora Histórica de Auditoría en BD (Tabla <code>historial_acciones</code>)</h4>
          ${historial.length === 0 ? `<p class="cat-desc-text">No se registran acciones aún en la bitácora.</p>` : `
            <div style="max-height: 260px; overflow-y: auto; border: 1px solid #E2E8F0; border-radius: 8px;">
              <table class="proforma-table" style="font-size: 0.75rem;">
                <thead>
                  <tr>
                    <th>Fecha / Hora</th>
                    <th>Usuario</th>
                    <th>Módulo</th>
                    <th>Acción</th>
                    <th>Detalle Histórico</th>
                  </tr>
                </thead>
                <tbody>
                  ${historial.map(h => `
                    <tr>
                      <td style="white-space:nowrap;">${escapeHtml(h.fecha_hora)}</td>
                      <td><strong>${escapeHtml(h.usuario_nombre)}</strong></td>
                      <td>${escapeHtml(h.modulo)}</td>
                      <td><code style="background:#F1F5F9; padding:0.1rem 0.35rem; border-radius:4px; font-weight:700;">${escapeHtml(h.accion)}</code></td>
                      <td>${escapeHtml(h.detalle)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      `;

      // Eventos para ver o imprimir cotización desde el historial
      modalBody.querySelectorAll('[data-hist-load-cot]').forEach(btn => {
        btn.addEventListener('click', () => {
          const idCot = parseInt(btn.getAttribute('data-hist-load-cot'), 10);
          const printNow = btn.getAttribute('data-hist-print') === '1';
          const cot = cotizaciones.find(x => Number(x.id_cotizacion) === idCot);
          if (cot) {
            cargarCotizacionGuardadaEnProforma(cot, printNow);
          }
        });
      });

      // Eventos para eliminar cotización desde el historial
      modalBody.querySelectorAll('[data-del-cot]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const idCot = parseInt(btn.getAttribute('data-del-cot'), 10);
          if (!confirm(`¿Confirma eliminar la cotización #${idCot}? Quedará constancia en el historial de auditoría.`)) return;
          const r = await fetch('modules/cotizador/cotizaciones_api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'eliminar', id_cotizacion: idCot })
          });
          const d = await r.json();
          if (d.success) {
            await cargarListaCotizacionesGuardadas();
            mostrarModalHistorialBD();
          } else {
            alert(d.error || 'No se pudo eliminar la cotización.');
          }
        });
      });

      // Eventos para restaurar servicio eliminado
      modalBody.querySelectorAll('[data-restore-serv]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const idServ = parseInt(btn.getAttribute('data-restore-serv'), 10);
          const r = await fetch('modules/servicios/servicios_api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'restaurar_item', id_servicio: idServ })
          });
          const d = await r.json();
          if (d.success) {
            await cargarCatalogoServicios();
            renderEstructuraPrincipal();
            mostrarModalHistorialBD();
          } else {
            alert(d.error || 'No se pudo restaurar el registro.');
          }
        });
      });

    } catch (err) {
      console.error('Error cargando historial BD:', err);
      modalBody.innerHTML = '<p class="text-danger">Error al consultar el historial de auditoría.</p>';
    }
  }

  /**
   * Consulta en tiempo real si la fecha elegida en el Paso 1 está disponible o bloqueada en el Calendario (RF06)
   * Si está reservada, bloquea el avance y solicita seleccionar otra fecha.
   */
  async function verificarDisponibilidadFechaEnPaso1(fechaIso, mostrarAlertaGlobal = false) {
    const badge = document.getElementById('cotiz-fecha-disponibilidad-badge');
    const inputFecha = document.getElementById('cotiz-fecha-evento');
    if (!fechaIso) return false;

    try {
      const res = await fetch(`modules/reservas/reservas_api.php?action=verificar_fecha&fecha=${encodeURIComponent(fechaIso)}`);
      const data = await res.json();
      if (data.success) {
        if (data.bloqueada && data.reserva_bloqueante) {
          const rb = data.reserva_bloqueante;
          estadoCotizador.fechaBloqueadaEnCalendario = true;
          estadoCotizador.detalleReservaBloqueante = rb;

          if (inputFecha) {
            inputFecha.style.borderColor = '#DC2626';
            inputFecha.style.backgroundColor = '#FEF2F2';
          }

          if (badge) {
            badge.className = 'res-date-check-hint hint-blocked';
            badge.innerHTML = `🔒 <strong>Fecha No Disponible:</strong> La fecha <strong>${escapeHtml(fechaIso)}</strong> ya se encuentra reservada (${escapeHtml(rb.tipo_evento || 'Evento')} - Cliente: ${escapeHtml(rb.nombres)} ${escapeHtml(rb.apellidos)}). <strong>Por favor seleccione otra fecha para poder continuar.</strong>`;
          }

          if (mostrarAlertaGlobal) {
            mostrarAlertaValidacion(`La fecha seleccionada (${fechaIso}) ya se encuentra reservada. Por favor seleccione otra fecha disponible para continuar.`);
          }
          return false;
        } else {
          estadoCotizador.fechaBloqueadaEnCalendario = false;
          estadoCotizador.detalleReservaBloqueante = null;

          if (inputFecha) {
            inputFecha.style.borderColor = '';
            inputFecha.style.backgroundColor = '';
          }

          if (badge) {
            badge.className = 'res-date-check-hint hint-free';
            badge.innerHTML = `✅ <strong>Fecha Disponible:</strong> El Salón Principal está libre en esta fecha para realizar la cotización.`;
          }

          if (mostrarAlertaGlobal) {
            ocultarAlertaValidacion();
          }
          return true;
        }
      }
      return true;
    } catch (e) {
      if (badge) {
        badge.className = 'res-date-check-hint';
        badge.textContent = 'Sujeto a disponibilidad del Salón Principal.';
      }
      return !estadoCotizador.fechaBloqueadaEnCalendario;
    }
  }

  // Exponer función global para abrir la Proforma de una cotización directamente desde el Calendario de Reservas
  window.abrirCotizacionEnProformaPorId = async (idCotizacion) => {
    if (window.navegarAModulo) {
      window.navegarAModulo('view-cotizador', 'COTIZADOR INTELIGENTE');
    }
    await cargarListaCotizacionesGuardadas();
    const cot = estadoCotizador.cotizacionesGuardadasLista.find(x => Number(x.id_cotizacion) === Number(idCotizacion));
    if (cot) {
      cargarCotizacionGuardadaEnProforma(cot, false);
    }
  };

  // Escuchar cuando el usuario navega al módulo del cotizador
  window.addEventListener('module-activated', (e) => {
    if (e.detail && e.detail.moduleId === 'view-cotizador') {
      verificarClientePreseleccionado();
    }
  });

  // Inicializar al cargar el DOM
  document.addEventListener('DOMContentLoaded', () => {
    initCotizadorModule();
  });

})();
