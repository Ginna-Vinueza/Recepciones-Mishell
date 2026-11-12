/**
 * Módulo de Reservas y Calendario con Bloqueo Automático (RF05, RF06) (Figura 6)
 * Incluye Administración Integral para Super Administrador + Auditoría en BD (historial_acciones)
 * Plataforma Web Recepciones Mishell - Quito 2026
 */

(() => {
  const NOMBRES_MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  const hoyObj = new Date();
  const hoyIso = `${hoyObj.getFullYear()}-${String(hoyObj.getMonth() + 1).padStart(2, '0')}-${String(hoyObj.getDate()).padStart(2, '0')}`;

  function esFechaAnteriorAHoy(fechaIso) {
    if (!fechaIso) return false;
    return String(fechaIso) < hoyIso;
  }

  const estadoCalendario = {
    anio: hoyObj.getFullYear(),
    mes: hoyObj.getMonth() + 1, // 1 a 12
    fechaSeleccionada: hoyIso,
    filtroEstado: 'Todas',
    busquedaTexto: '',
    kpis: {
      total_reservas: 0,
      confirmadas: 0,
      en_proceso: 0,
      canceladas: 0,
      fechas_bloqueadas_mes: 0,
      total_acordado_mes: 0,
      total_abonado_mes: 0,
      saldo_pendiente_mes: 0
    },
    fechasBloqueadas: {},
    reservas: [],
    todasReservas: [],
    cotizacionesDisponibles: [],
    esSuperAdmin: true,
    cargando: false
  };

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
   * Inicializa el módulo de Calendario y Reservas
   */
  function initReservasModule() {
    cargarDatosCalendario();
  }

  /**
   * Consulta `reservas_api.php` para obtener reservas, fechas bloqueadas y KPIs
   */
  async function cargarDatosCalendario() {
    const container = document.getElementById('calendario-component-container');
    if (!container) return;

    try {
      estadoCalendario.cargando = true;
      const params = new URLSearchParams({
        action: 'listar',
        anio: String(estadoCalendario.anio),
        mes: String(estadoCalendario.mes),
        estado: estadoCalendario.filtroEstado,
        q: estadoCalendario.busquedaTexto
      });

      const res = await fetch(`modules/reservas/reservas_api.php?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        estadoCalendario.kpis = data.kpis || estadoCalendario.kpis;
        estadoCalendario.fechasBloqueadas = data.fechas_bloqueadas || {};
        estadoCalendario.reservas = data.reservas || [];
        estadoCalendario.todasReservas = data.todas_reservas || [];
        estadoCalendario.cotizacionesDisponibles = data.cotizaciones_disponibles || [];
        if (data.rol_usuario) {
          estadoCalendario.esSuperAdmin = data.rol_usuario === 'Administrador';
        }
        renderVistaCalendario();
      } else {
        console.error('Error al cargar reservas:', data.error);
      }
    } catch (err) {
      console.error('Error de red al cargar calendario RF05/RF06:', err);
    } finally {
      estadoCalendario.cargando = false;
    }
  }

  /**
   * Renderiza toda la interfaz de la Figura 6 (Calendario Mensual con Bloqueo Automático + Detalle de Fecha + Listado de Reservas)
   */
  function renderVistaCalendario() {
    const container = document.getElementById('calendario-component-container');
    if (!container) return;

    const k = estadoCalendario.kpis;
    const nombreMesActual = NOMBRES_MESES[estadoCalendario.mes - 1] || 'Mes';
    const totalDiasDelMes = new Date(estadoCalendario.anio, estadoCalendario.mes, 0).getDate();
    const diasDisponiblesMes = Math.max(0, totalDiasDelMes - (k.fechas_bloqueadas_mes || 0));

    container.innerHTML = `
      <!-- Encabezado de Acción Rápida del Módulo de Reservas (RF05 / RF06) -->
      <div class="cal-module-header-bar">
        <div>
          <div class="cotizador-badge-rf">
            Módulo RF05 & RF06 • Bloqueo Automático de Sede Única
          </div>
          <h3 class="cal-section-main-title">Calendario Oficial de Reservas y Disponibilidad</h3>
          <p class="cal-section-main-sub">
            Al confirmar o registrar una reserva, el sistema bloquea automáticamente la fecha para impedir duplicidad de eventos.
          </p>
        </div>
        <div class="cal-header-btns">
          <button type="button" class="btn-primary-sm" id="btn-abrir-modal-nueva-reserva">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
              <line x1="12" y1="14" x2="12" y2="18"/>
              <line x1="10" y1="16" x2="14" y2="16"/>
            </svg>
            <span>+ Agendar Reserva</span>
          </button>
          <button
            type="button"
            class="btn-catalog-peek ${esFechaAnteriorAHoy(estadoCalendario.fechaSeleccionada) ? 'btn-disabled-past' : ''}"
            id="btn-ir-cotizador-desde-cal"
            ${esFechaAnteriorAHoy(estadoCalendario.fechaSeleccionada) ? 'disabled title="Solo se habilita para la fecha actual o posterior"' : 'title="Cotizar evento para la fecha seleccionada"'}
          >
            ${esFechaAnteriorAHoy(estadoCalendario.fechaSeleccionada) ? '🚫 Cotizar Evento (Fecha Anterior)' : '✨ Cotizar Evento'}
          </button>
        </div>
      </div>

      <!-- Tarjetas KPI de Ocupación y Bloqueo Automático (Sin información de abono) -->
      <div class="cal-kpis-grid">
        <div class="cal-kpi-card kpi-blocked">
          <span class="cal-kpi-label">Fechas Bloqueadas (${nombreMesActual})</span>
          <strong class="cal-kpi-value">🔒 ${k.fechas_bloqueadas_mes} ${k.fechas_bloqueadas_mes === 1 ? 'fecha' : 'fechas'}</strong>
          <span class="cal-kpi-sub">Con bloqueo automático activo</span>
        </div>
        <div class="cal-kpi-card kpi-confirmed">
          <span class="cal-kpi-label">Fechas Disponibles (${nombreMesActual})</span>
          <strong class="cal-kpi-value">✅ ${diasDisponiblesMes} días</strong>
          <span class="cal-kpi-sub">Libres para cotizar y reservar</span>
        </div>
        <div class="cal-kpi-card kpi-revenue">
          <span class="cal-kpi-label">Reservas Confirmadas</span>
          <strong class="cal-kpi-value">${k.confirmadas}</strong>
          <span class="cal-kpi-sub">Eventos confirmados en agenda</span>
        </div>
        <div class="cal-kpi-card kpi-balance">
          <span class="cal-kpi-label">Reservas en Proceso</span>
          <strong class="cal-kpi-value">${k.en_proceso}</strong>
          <span class="cal-kpi-sub">Fechas con bloqueo preventivo</span>
        </div>
      </div>

      <!-- Layout Principal Responsivo: Calendario Mensual (Izquierda/Arriba) + Inspector de Fecha (Derecha/Abajo) -->
      <div class="cal-main-workspace">
        
        <!-- 1. Tarjeta del Calendario Mensual Interactivo (Figura 6) -->
        <div class="cal-board-card">
          <div class="cal-board-toolbar">
            <div class="cal-nav-group">
              <button type="button" class="btn-cal-nav" id="btn-cal-mes-prev" title="Mes Anterior">‹</button>
              <h4 class="cal-current-month-label">${nombreMesActual} ${estadoCalendario.anio}</h4>
              <button type="button" class="btn-cal-nav" id="btn-cal-mes-next" title="Mes Siguiente">›</button>
            </div>
            <div class="cal-Quick-controls">
              <select id="select-cal-mes" class="cal-select-sm" aria-label="Seleccionar mes">
                ${NOMBRES_MESES.map((m, i) => `<option value="${i + 1}" ${estadoCalendario.mes === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}
              </select>
              <select id="select-cal-anio" class="cal-select-sm" aria-label="Seleccionar año">
                ${[2025, 2026, 2027, 2028].map(a => `<option value="${a}" ${estadoCalendario.anio === a ? 'selected' : ''}>${a}</option>`).join('')}
              </select>
              <button type="button" class="btn-cal-today" id="btn-cal-hoy">Hoy</button>
            </div>
          </div>

          <!-- Leyenda Visual de Bloqueo Automático -->
          <div class="cal-legend-bar">
            <span class="cal-legend-item"><i class="dot-legend dot-free"></i> Disponible</span>
            <span class="cal-legend-item"><i class="dot-legend dot-confirmed"></i> 🔒 Bloqueado (Confirmado)</span>
            <span class="cal-legend-item"><i class="dot-legend dot-process"></i> 🔒 Bloqueado (En Proceso)</span>
          </div>

          <!-- Cabecera de Días de la Semana -->
          <div class="cal-weekdays-row">
            ${DIAS_SEMANA.map(d => `<div class="cal-weekday-cell">${d}</div>`).join('')}
          </div>

          <!-- Cuadrícula de Días del Mes -->
          <div class="cal-days-grid" id="cal-days-grid">
            ${renderCeldasMesHtml()}
          </div>
        </div>

        <!-- 2. Panel Inspector del Día Seleccionado (Figura 6) -->
        <div class="cal-day-inspector-card" id="cal-day-inspector-card">
          ${renderInspectorDiaSeleccionadoHtml()}
        </div>

      </div>

      <!-- 3. Listado y Administración de Reservas Registradas -->
      <div class="cal-reservations-list-card">
        <div class="cal-list-header">
          <div>
            <h4 class="cal-list-title">Agenda General de Eventos y Reservas (${estadoCalendario.reservas.length})</h4>
            <p class="cal-list-sub">Gestione estados de reserva, consulte proformas o libere fechas canceladas.</p>
          </div>
          <div class="cal-list-filters">
            <div class="cal-filter-pills">
              ${['Todas', 'Confirmado', 'En Proceso', 'Cancelado'].map(est => `
                <button type="button" class="btn-cal-filter-pill ${estadoCalendario.filtroEstado === est ? 'active' : ''}" data-filter-est="${est}">
                  ${est}
                </button>
              `).join('')}
            </div>
            <input
              type="text"
              id="input-cal-buscar-reserva"
              class="cal-search-input"
              placeholder="Buscar por cliente, cédula, evento o fecha..."
              value="${escapeHtml(estadoCalendario.busquedaTexto)}"
            >
          </div>
        </div>

        <div id="cal-reservas-cards-container">
          ${renderListaReservasHtml()}
        </div>
      </div>

      <!-- MODAL 1: Agendar Nueva Reserva con Bloqueo Automático (RF05 / RF06) -->
      <div id="modal-agendar-reserva" class="modal-backdrop" aria-hidden="true" role="dialog">
        <div class="modal-card modal-card-lg">
          <div class="modal-header">
            <div>
              <h3 class="modal-title">Agendar Reserva con Bloqueo Automático (RF05 / RF06)</h3>
              <p class="modal-subtitle-sm">Seleccione una cotización realizada para confirmar el evento y bloquear la fecha en el Salón Principal.</p>
            </div>
            <button type="button" class="modal-close-btn" id="btn-cerrar-modal-agendar-res">✕</button>
          </div>
          <form id="form-agendar-reserva" class="modal-body">
            <div id="alert-modal-agendar-res" class="alert-feedback alert-error" style="display:none;"></div>

            <div class="form-group">
              <label class="form-label" for="select-res-cotizacion">
                1. Seleccione la Cotización Guardada <span class="text-danger">*</span>
              </label>
              <select id="select-res-cotizacion" class="form-control" style="padding: 0 0.875rem;" required>
                <option value="">-- Seleccione una cotización para convertir en reserva --</option>
                ${estadoCalendario.cotizacionesDisponibles.map(c => {
                  const yaActiva = Number(c.tiene_reserva_activa) > 0;
                  const label = `#${c.id_cotizacion} • ${c.nombres} ${c.apellidos} (${c.cedula_ruc}) • Fecha: ${c.fecha_evento_propuesta} • ${c.tipo_evento || 'Evento'} (${c.cantidad_personas}p) • Total: $${ parseFloat(c.total_estimado || 0).toFixed(2) }${yaActiva ? ' [YA RESERVADA]' : ''}`;
                  return `<option value="${c.id_cotizacion}" data-fecha="${escapeHtml(c.fecha_evento_propuesta)}" data-hora="${escapeHtml(String(c.hora_inicio || '15:30').substring(0,5))}" data-total="${parseFloat(c.total_estimado || 0).toFixed(2)}" ${yaActiva ? 'disabled' : ''}>${escapeHtml(label)}</option>`;
                }).join('')}
              </select>
              <span class="form-helper-text">¿No encuentra la cotización? Puede crear una primero en la pestaña <strong>Cotizar</strong>.</span>
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label" for="input-res-fecha">
                  2. Fecha Oficial del Evento (Se bloqueará) <span class="text-danger">*</span>
                </label>
                <input type="date" id="input-res-fecha" class="form-control" style="padding: 0 0.875rem;" value="${escapeHtml(estadoCalendario.fechaSeleccionada)}" required>
                <div id="badge-verif-fecha-modal" class="res-date-check-hint"></div>
              </div>

              <div class="form-group">
                <label class="form-label" for="input-res-hora">
                  3. Hora de Inicio
                </label>
                <input type="time" id="input-res-hora" class="form-control" style="padding: 0 0.875rem;" value="15:30" step="1800" required>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="select-res-estado">
                4. Estado de la Reserva <span class="text-danger">*</span>
              </label>
              <select id="select-res-estado" class="form-control" style="padding: 0 0.875rem;">
                <option value="Confirmado">Confirmado (Bloqueo Firme de Fecha)</option>
                <option value="En Proceso">En Proceso (Bloqueo Preventivo de Fecha)</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="input-res-obs">Observaciones de la Reserva</label>
              <input type="text" id="input-res-obs" class="form-control" style="padding: 0 0.875rem;" placeholder="Ej. Reserva confirmada con el cliente...">
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-secondary" id="btn-cancelar-modal-agendar-res">Cancelar</button>
              <button type="submit" class="btn-primary" id="btn-submit-agendar-res">🔒 Confirmar y Bloquear Fecha</button>
            </div>
          </form>
        </div>
      </div>

      <!-- MODAL 2: Gestionar Reserva Existente (Estado, Fecha o Liberación) -->
      <div id="modal-editar-reserva" class="modal-backdrop" aria-hidden="true" role="dialog">
        <div class="modal-card">
          <div class="modal-header">
            <div>
              <h3 class="modal-title" id="title-modal-editar-res">Gestionar Reserva</h3>
              <p class="modal-subtitle-sm">Actualice el estado, fecha/horario o cancele para liberar la fecha en el calendario.</p>
            </div>
            <button type="button" class="modal-close-btn" id="btn-cerrar-modal-editar-res">✕</button>
          </div>
          <form id="form-editar-reserva" class="modal-body">
            <input type="hidden" id="edit-res-id" value="">
            <div id="alert-modal-editar-res" class="alert-feedback alert-error" style="display:none;"></div>

            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label" for="edit-res-fecha">Fecha del Evento</label>
                <input type="date" id="edit-res-fecha" class="form-control" style="padding: 0 0.875rem;" required>
              </div>
              <div class="form-group">
                <label class="form-label" for="edit-res-hora">Hora de Inicio</label>
                <input type="time" id="edit-res-hora" class="form-control" style="padding: 0 0.875rem;" step="1800" required>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="edit-res-estado">Estado de Reserva</label>
              <select id="edit-res-estado" class="form-control" style="padding: 0 0.875rem;">
                <option value="Confirmado">🔒 Confirmado (Fecha Bloqueada)</option>
                <option value="En Proceso">🔒 En Proceso (Fecha Bloqueada)</option>
                <option value="Cancelado">🔓 Cancelado (Liberar Fecha en Calendario)</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="edit-res-obs">Observaciones</label>
              <input type="text" id="edit-res-obs" class="form-control" style="padding: 0 0.875rem;">
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-secondary" id="btn-cancelar-modal-editar-res">Cerrar</button>
              <button type="submit" class="btn-primary">Guardar Cambios en BD</button>
            </div>
          </form>
        </div>
      </div>
    `;

    bindEventosCalendario();
  }

  /**
   * Construye las celdas de días para el mes y año seleccionados
   */
  function renderCeldasMesHtml() {
    const anio = estadoCalendario.anio;
    const mes = estadoCalendario.mes; // 1..12

    const primerDiaMes = new Date(anio, mes - 1, 1);
    const ultimoDiaMes = new Date(anio, mes, 0);
    const totalDiasMes = ultimoDiaMes.getDate();

    // Convertir getDay() (0=Dom..6=Sab) a índice Lunes=0..Domingo=6
    let offsetInicio = primerDiaMes.getDay() - 1;
    if (offsetInicio < 0) offsetInicio = 6;

    let html = '';

    // Celdas vacías previas al día 1
    for (let i = 0; i < offsetInicio; i++) {
      html += `<div class="cal-day-cell cal-day-empty" aria-hidden="true"></div>`;
    }

    for (let dia = 1; dia <= totalDiasMes; dia++) {
      const fechaIso = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      const infoBloqueo = estadoCalendario.fechasBloqueadas[fechaIso] || null;
      const esHoy = fechaIso === hoyIso;
      const esPasada = esFechaAnteriorAHoy(fechaIso);
      const esSeleccionada = fechaIso === estadoCalendario.fechaSeleccionada;

      let claseEstado = esPasada ? 'day-past' : 'day-free';
      let etiquetaEstado = esPasada
        ? '<span class="cal-day-status-pill pill-past">Pasada</span>'
        : '<span class="cal-day-status-pill pill-free">Libre</span>';
      let detalleCorto = '';

      if (infoBloqueo) {
        if (infoBloqueo.estado_reserva === 'Confirmado') {
          claseEstado = 'day-blocked-confirmed';
          etiquetaEstado = '<span class="cal-day-status-pill pill-blocked">🔒 Ocupado</span>';
        } else {
          claseEstado = 'day-blocked-process';
          etiquetaEstado = '<span class="cal-day-status-pill pill-process">🔒 En Proceso</span>';
        }
        detalleCorto = `
          <div class="cal-day-event-chip" title="${escapeHtml(infoBloqueo.tipo_evento)} • ${escapeHtml(infoBloqueo.cliente)}">
            <strong>${escapeHtml(infoBloqueo.hora_inicio)}</strong> ${escapeHtml(infoBloqueo.tipo_evento || 'Evento')}
          </div>
          <div class="cal-day-client-mini">${escapeHtml(infoBloqueo.cliente)}</div>
        `;
      }

      html += `
        <button
          type="button"
          class="cal-day-cell ${claseEstado} ${esHoy ? 'is-today' : ''} ${esSeleccionada ? 'is-selected' : ''}"
          data-date="${fechaIso}"
        >
          <div class="cal-day-top">
            <span class="cal-day-num">${dia}</span>
            ${etiquetaEstado}
          </div>
          <div class="cal-day-body">
            ${detalleCorto}
          </div>
        </button>
      `;
    }

    return html;
  }

  /**
   * Renderiza el panel lateral/inferior con el detalle de la fecha seleccionada en el calendario
   */
  function renderInspectorDiaSeleccionadoHtml() {
    const fecha = estadoCalendario.fechaSeleccionada;
    const esAnterior = esFechaAnteriorAHoy(fecha);
    const reservaActiva = estadoCalendario.todasReservas.find(
      r => r.fecha_evento === fecha && r.estado_reserva !== 'Cancelado'
    );

    if (!reservaActiva) {
      // Buscar si existen cotizaciones propuestas para ese día aunque aún no estén confirmadas como reserva
      const cotsDia = estadoCalendario.cotizacionesDisponibles.filter(
        c => c.fecha_evento_propuesta === fecha && Number(c.tiene_reserva_activa) === 0
      );

      if (esAnterior) {
        return `
          <div class="inspector-status-banner banner-past">
            <span class="inspector-status-icon">📅</span>
            <div>
              <h4 class="inspector-date-title">Fecha Anterior: ${escapeHtml(fecha)}</h4>
              <p class="inspector-date-sub">Solo se habilita cotizar eventos para la fecha actual (${hoyIso}) y posteriores.</p>
            </div>
          </div>

          <div class="inspector-body-content">
            <p class="inspector-helper-p">
              La fecha seleccionada (<strong>${escapeHtml(fecha)}</strong>) es anterior a la fecha actual (<strong>${hoyIso}</strong>). Seleccione la fecha de hoy o una fecha posterior en el calendario para habilitar la opción de cotizar un evento.
            </p>

            <div class="inspector-actions-stack">
              <button
                type="button"
                class="btn-action-primary btn-disabled-past"
                id="btn-inspector-cotizar-fecha"
                data-fecha="${escapeHtml(fecha)}"
                disabled
                title="El botón Cotizar Evento solo se habilita para la fecha actual o posterior"
              >
                🚫 Cotizar Evento (Deshabilitado para fechas anteriores)
              </button>
              <button
                type="button"
                class="btn-action-secondary btn-disabled-past"
                id="btn-inspector-agendar-fecha"
                data-fecha="${escapeHtml(fecha)}"
                disabled
                title="No disponible para fechas anteriores"
              >
                📅 Agendar Reserva (Solo fecha actual o posterior)
              </button>
            </div>
          </div>
        `;
      }

      return `
        <div class="inspector-status-banner banner-free">
          <span class="inspector-status-icon">✓</span>
          <div>
            <h4 class="inspector-date-title">Fecha Disponible: ${escapeHtml(fecha)}</h4>
            <p class="inspector-date-sub">El Salón Principal se encuentra libre en esta fecha para agendar un evento.</p>
          </div>
        </div>

        <div class="inspector-body-content">
          <p class="inspector-helper-p">
            Puede iniciar una cotización personalizada para el <strong>${escapeHtml(fecha)}</strong> o seleccionar una cotización ya guardada para reservar y bloquear automáticamente este día.
          </p>

          ${cotsDia.length > 0 ? `
            <div class="inspector-pending-quotes-box">
              <span class="inspector-pq-title">📋 Cotizaciones propuestas para esta fecha (${cotsDia.length}):</span>
              ${cotsDia.map(c => `
                <div class="inspector-pq-item">
                  <div>
                    <strong>#${c.id_cotizacion} - ${escapeHtml(c.nombres)} ${escapeHtml(c.apellidos)}</strong>
                    <span>${escapeHtml(c.tipo_evento || 'Evento')} (${c.cantidad_personas} pers.) • $${parseFloat(c.total_estimado || 0).toFixed(2)}</span>
                  </div>
                  <button type="button" class="btn-sq-action btn-sq-print" data-quick-reserve-cot="${c.id_cotizacion}">
                    🔒 Reservar Ahora
                  </button>
                </div>
              `).join('')}
            </div>
          ` : ''}

          <div class="inspector-actions-stack">
            <button type="button" class="btn-action-primary" id="btn-inspector-cotizar-fecha" data-fecha="${escapeHtml(fecha)}">
              ✨ Cotizar Evento para el ${escapeHtml(fecha)}
            </button>
            <button type="button" class="btn-action-secondary" id="btn-inspector-agendar-fecha" data-fecha="${escapeHtml(fecha)}">
              📅 Agendar Reserva desde Cotización Guardada
            </button>
          </div>
        </div>
      `;
    }

    // Si la fecha está BLOQUEADA por una reserva activa
    const total = parseFloat(reservaActiva.total_acordado || 0);

    return `
      <div class="inspector-status-banner banner-blocked">
        <span class="inspector-status-icon">🔒</span>
        <div>
          <h4 class="inspector-date-title">Fecha Bloqueada: ${escapeHtml(fecha)}</h4>
          <p class="inspector-date-sub">Reserva #${reservaActiva.id_reserva} (${escapeHtml(reservaActiva.estado_reserva)}) • Cotización #${reservaActiva.id_cotizacion}</p>
        </div>
      </div>

      <div class="inspector-body-content">
        <div class="inspector-detail-rows">
          <div><span>Cliente Titular:</span> <strong>${escapeHtml(reservaActiva.nombres)} ${escapeHtml(reservaActiva.apellidos)}</strong></div>
          <div><span>Cédula / RUC:</span> <code>${escapeHtml(reservaActiva.cedula_ruc)}</code></div>
          <div><span>Teléfono:</span> <strong>${escapeHtml(reservaActiva.telefono || 'N/A')}</strong></div>
          <div><span>Evento Contratado:</span> <strong>${escapeHtml(reservaActiva.tipo_evento || 'Recepción')} (${reservaActiva.cantidad_personas} invitados)</strong></div>
          <div><span>Horario Bloqueado:</span> <strong>${escapeHtml(reservaActiva.hora_inicio_corta)} a ${escapeHtml(reservaActiva.hora_fin_corta)} hrs</strong></div>
          <div><span>Mantelería / Lazos:</span> <strong>${escapeHtml(reservaActiva.color_manteleria || 'Dorado')}</strong></div>
          <div><span>Total Acordado:</span> <strong>$${total.toFixed(2)}</strong></div>
        </div>

        <div class="inspector-actions-stack">
          <button type="button" class="btn-action-primary" data-edit-res-id="${reservaActiva.id_reserva}">
            ⚙️ Gestionar Estado / Liberar Fecha
          </button>
          <button type="button" class="btn-action-secondary" data-view-proforma-cot="${reservaActiva.id_cotizacion}">
            🖨️ Ver / Imprimir Proforma #${reservaActiva.id_cotizacion}
          </button>
          ${estadoCalendario.esSuperAdmin ? `
            <button type="button" class="btn-client-delete-admin" style="width:100%; padding:0.5rem;" data-del-res-id="${reservaActiva.id_reserva}">
              🗑️ Eliminar Reserva y Liberar Fecha (Super Admin)
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Renderiza las tarjetas del listado inferior de reservas
   */
  function renderListaReservasHtml() {
    if (!estadoCalendario.reservas || estadoCalendario.reservas.length === 0) {
      return `
        <div class="saved-quotes-empty">
          No se encontraron reservas con los criterios seleccionados.
        </div>
      `;
    }

    return `
      <div class="cal-reservations-grid">
        ${estadoCalendario.reservas.map(r => {
          const total = parseFloat(r.total_acordado || 0);
          const badgeClass = r.estado_reserva === 'Confirmado'
            ? 'res-badge-confirmed'
            : (r.estado_reserva === 'En Proceso' ? 'res-badge-process' : 'res-badge-cancelled');

          return `
            <div class="cal-reservation-item-card">
              <div class="cal-res-card-top">
                <div class="cal-res-id-group">
                  <span class="saved-quote-badge-id">Reserva #${r.id_reserva}</span>
                  <span class="cal-res-cot-ref">Cotización #${r.id_cotizacion}</span>
                  <span class="cal-res-status-badge ${badgeClass}">
                    ${r.estado_reserva === 'Cancelado' ? '🔓 Cancelado (Fecha Libre)' : `🔒 ${escapeHtml(r.estado_reserva)}`}
                  </span>
                </div>
                <div class="cal-res-date-pill">
                  📅 <strong>${escapeHtml(r.fecha_evento)}</strong> • ${escapeHtml(r.hora_inicio_corta)} hrs
                </div>
              </div>

              <div class="cal-res-card-mid">
                <div class="cal-res-cli-col">
                  <strong>${escapeHtml(r.nombres)} ${escapeHtml(r.apellidos)}</strong>
                  <span>C.I./RUC: <code>${escapeHtml(r.cedula_ruc)}</code> • Tel: ${escapeHtml(r.telefono || 'N/A')}</span>
                </div>
                <div class="cal-res-ev-col">
                  <strong>🎉 ${escapeHtml(r.tipo_evento || 'Recepción')} (${r.cantidad_personas} pers.)</strong>
                  <span>🎨 Lazos: ${escapeHtml(r.color_manteleria || 'Dorado')}</span>
                </div>
                <div class="cal-res-money-col">
                  <span>Horario: <strong>${escapeHtml(r.hora_inicio_corta)} - ${escapeHtml(r.hora_fin_corta)}</strong></span>
                  <span>Total: <strong>$${total.toFixed(2)}</strong></span>
                </div>
              </div>

              <div class="cal-res-card-actions">
                <button type="button" class="btn-sq-action btn-sq-view" data-focus-cal-date="${escapeHtml(r.fecha_evento)}">
                  📍 Ver en Calendario
                </button>
                <button type="button" class="btn-sq-action btn-sq-view" data-edit-res-id="${r.id_reserva}">
                  ⚙️ Estado / Fecha
                </button>
                <button type="button" class="btn-sq-action btn-sq-print" data-view-proforma-cot="${r.id_cotizacion}">
                  🖨️ Proforma
                </button>
                ${estadoCalendario.esSuperAdmin ? `
                  <button type="button" class="btn-sq-action btn-sq-del" data-del-res-id="${r.id_reserva}" title="Eliminar Reserva y Liberar Fecha">
                    🗑️ Eliminar
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
   * Ajusta la fecha seleccionada al cambiar de mes/año para mantener consistencia en el inspector
   */
  function sincronizarFechaSeleccionadaConMes() {
    const prefijoMes = `${estadoCalendario.anio}-${String(estadoCalendario.mes).padStart(2, '0')}`;
    if (!estadoCalendario.fechaSeleccionada || !estadoCalendario.fechaSeleccionada.startsWith(prefijoMes)) {
      if (hoyIso.startsWith(prefijoMes)) {
        estadoCalendario.fechaSeleccionada = hoyIso;
      } else {
        estadoCalendario.fechaSeleccionada = `${prefijoMes}-01`;
      }
    }
  }

  /**
   * Actualiza el botón superior "Cotizar Evento" según si la fecha seleccionada es actual/posterior o anterior
   */
  function actualizarEstadoBotonCotizarHeader() {
    const btnHeaderCot = document.getElementById('btn-ir-cotizador-desde-cal');
    if (!btnHeaderCot) return;
    const esPasada = esFechaAnteriorAHoy(estadoCalendario.fechaSeleccionada);
    btnHeaderCot.disabled = esPasada;
    btnHeaderCot.classList.toggle('btn-disabled-past', esPasada);
    btnHeaderCot.textContent = esPasada ? '🚫 Cotizar Evento (Fecha Anterior)' : '✨ Cotizar Evento';
    btnHeaderCot.title = esPasada
      ? 'Solo se habilita para la fecha actual o posterior'
      : 'Cotizar evento para la fecha seleccionada';
  }

  /**
   * Vincula todos los eventos interactivos del Calendario, Inspector y Modales
   */
  function bindEventosCalendario() {
    // Navegación de meses
    document.getElementById('btn-cal-mes-prev')?.addEventListener('click', () => {
      estadoCalendario.mes--;
      if (estadoCalendario.mes < 1) {
        estadoCalendario.mes = 12;
        estadoCalendario.anio--;
      }
      sincronizarFechaSeleccionadaConMes();
      cargarDatosCalendario();
    });

    document.getElementById('btn-cal-mes-next')?.addEventListener('click', () => {
      estadoCalendario.mes++;
      if (estadoCalendario.mes > 12) {
        estadoCalendario.mes = 1;
        estadoCalendario.anio++;
      }
      sincronizarFechaSeleccionadaConMes();
      cargarDatosCalendario();
    });

    document.getElementById('btn-cal-hoy')?.addEventListener('click', () => {
      const h = new Date();
      estadoCalendario.anio = h.getFullYear();
      estadoCalendario.mes = h.getMonth() + 1;
      estadoCalendario.fechaSeleccionada = hoyIso;
      cargarDatosCalendario();
    });

    document.getElementById('select-cal-mes')?.addEventListener('change', (e) => {
      estadoCalendario.mes = parseInt(e.target.value, 10);
      sincronizarFechaSeleccionadaConMes();
      cargarDatosCalendario();
    });

    document.getElementById('select-cal-anio')?.addEventListener('change', (e) => {
      estadoCalendario.anio = parseInt(e.target.value, 10);
      sincronizarFechaSeleccionadaConMes();
      cargarDatosCalendario();
    });

    // Clic en un día del calendario
    document.querySelectorAll('.cal-day-cell[data-date]').forEach(cell => {
      cell.addEventListener('click', () => {
        const f = cell.getAttribute('data-date');
        if (!f) return;
        estadoCalendario.fechaSeleccionada = f;
        document.querySelectorAll('.cal-day-cell').forEach(c => c.classList.remove('is-selected'));
        cell.classList.add('is-selected');

        actualizarEstadoBotonCotizarHeader();

        const inspector = document.getElementById('cal-day-inspector-card');
        if (inspector) {
          inspector.innerHTML = renderInspectorDiaSeleccionadoHtml();
          bindEventosInspectorYAcciones();
        }
      });
    });

    // Botón superior "+ Agendar Reserva"
    document.getElementById('btn-abrir-modal-nueva-reserva')?.addEventListener('click', () => {
      const f = esFechaAnteriorAHoy(estadoCalendario.fechaSeleccionada) ? hoyIso : estadoCalendario.fechaSeleccionada;
      abrirModalAgendarReserva(f);
    });

    // Botón superior "Cotizar Evento"
    document.getElementById('btn-ir-cotizador-desde-cal')?.addEventListener('click', () => {
      irACotizarConFecha(estadoCalendario.fechaSeleccionada);
    });

    // Filtros del listado de reservas
    document.querySelectorAll('.btn-cal-filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        estadoCalendario.filtroEstado = btn.getAttribute('data-filter-est') || 'Todas';
        cargarDatosCalendario();
      });
    });

    const inputBuscar = document.getElementById('input-cal-buscar-reserva');
    if (inputBuscar) {
      inputBuscar.addEventListener('input', (e) => {
        estadoCalendario.busquedaTexto = e.target.value;
        // Filtrado local instantáneo sobre todasReservas
        const q = estadoCalendario.busquedaTexto.trim().toLowerCase();
        estadoCalendario.reservas = estadoCalendario.todasReservas.filter(r => {
          const pasaEst = estadoCalendario.filtroEstado === 'Todas' || r.estado_reserva === estadoCalendario.filtroEstado;
          if (!pasaEst) return false;
          if (!q) return true;
          const txt = `#${r.id_reserva} #${r.id_cotizacion} ${r.nombres} ${r.apellidos} ${r.cedula_ruc} ${r.tipo_evento} ${r.fecha_evento}`.toLowerCase();
          return txt.includes(q);
        });
        const cont = document.getElementById('cal-reservas-cards-container');
        if (cont) {
          cont.innerHTML = renderListaReservasHtml();
          bindEventosInspectorYAcciones();
        }
      });
    }

    // Eventos de los modales
    const modalAgendar = document.getElementById('modal-agendar-reserva');
    document.getElementById('btn-cerrar-modal-agendar-res')?.addEventListener('click', () => modalAgendar?.classList.remove('show'));
    document.getElementById('btn-cancelar-modal-agendar-res')?.addEventListener('click', () => modalAgendar?.classList.remove('show'));

    const selectCotModal = document.getElementById('select-res-cotizacion');
    if (selectCotModal) {
      selectCotModal.addEventListener('change', () => {
        const opt = selectCotModal.options[selectCotModal.selectedIndex];
        if (!opt || !opt.value) return;
        const f = opt.getAttribute('data-fecha');
        const h = opt.getAttribute('data-hora');

        const inputF = document.getElementById('input-res-fecha');
        const inputH = document.getElementById('input-res-hora');

        if (inputF && f) inputF.value = f;
        if (inputH && h) inputH.value = h;
        if (f) verificarDisponibilidadFechaModal(f);
      });
    }

    document.getElementById('input-res-fecha')?.addEventListener('change', (e) => {
      verificarDisponibilidadFechaModal(e.target.value);
    });

    document.getElementById('form-agendar-reserva')?.addEventListener('submit', guardarNuevaReserva);

    const modalEditar = document.getElementById('modal-editar-reserva');
    document.getElementById('btn-cerrar-modal-editar-res')?.addEventListener('click', () => modalEditar?.classList.remove('show'));
    document.getElementById('btn-cancelar-modal-editar-res')?.addEventListener('click', () => modalEditar?.classList.remove('show'));
    document.getElementById('form-editar-reserva')?.addEventListener('submit', guardarEdicionReserva);

    bindEventosInspectorYAcciones();
  }

  /**
   * Vincula acciones del inspector de fecha y tarjetas de reservas
   */
  function bindEventosInspectorYAcciones() {
    document.getElementById('btn-inspector-cotizar-fecha')?.addEventListener('click', (e) => {
      const f = e.currentTarget.getAttribute('data-fecha');
      irACotizarConFecha(f);
    });

    document.getElementById('btn-inspector-agendar-fecha')?.addEventListener('click', (e) => {
      const f = e.currentTarget.getAttribute('data-fecha');
      abrirModalAgendarReserva(f);
    });

    document.querySelectorAll('[data-quick-reserve-cot]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idCot = parseInt(btn.getAttribute('data-quick-reserve-cot'), 10);
        abrirModalAgendarReserva(estadoCalendario.fechaSeleccionada, idCot);
      });
    });

    document.querySelectorAll('[data-focus-cal-date]').forEach(btn => {
      btn.addEventListener('click', () => {
        const f = btn.getAttribute('data-focus-cal-date');
        if (!f) return;
        const partes = f.split('-');
        estadoCalendario.anio = parseInt(partes[0], 10);
        estadoCalendario.mes = parseInt(partes[1], 10);
        estadoCalendario.fechaSeleccionada = f;
        cargarDatosCalendario().then(() => {
          document.getElementById('cal-day-inspector-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      });
    });

    document.querySelectorAll('[data-edit-res-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idRes = parseInt(btn.getAttribute('data-edit-res-id'), 10);
        abrirModalEditarReserva(idRes);
      });
    });

    document.querySelectorAll('[data-view-proforma-cot]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idCot = parseInt(btn.getAttribute('data-view-proforma-cot'), 10);
        if (window.abrirCotizacionEnProformaPorId) {
          window.abrirCotizacionEnProformaPorId(idCot);
        } else if (window.navegarAModulo) {
          window.navegarAModulo('view-cotizador', 'COTIZADOR INTELIGENTE');
        }
      });
    });

    document.querySelectorAll('[data-del-res-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idRes = parseInt(btn.getAttribute('data-del-res-id'), 10);
        await eliminarReservaConfirmada(idRes);
      });
    });
  }

  /**
   * Navega al Cotizador preseleccionando una fecha disponible del calendario (solo fecha actual o posterior)
   */
  function irACotizarConFecha(fechaIso) {
    if (esFechaAnteriorAHoy(fechaIso)) {
      alert(`Solo se permite cotizar eventos para la fecha actual (${hoyIso}) o fechas posteriores. Por favor seleccione otra fecha en el calendario.`);
      return;
    }
    window.fechaPreseleccionadaParaCotizar = fechaIso;
    if (window.navegarAModulo) {
      window.navegarAModulo('view-cotizador', 'COTIZADOR INTELIGENTE');
    }
  }

  /**
   * Abre el modal para agendar una nueva reserva (opcionalmente preseleccionando fecha o cotización)
   */
  function abrirModalAgendarReserva(fechaPref = '', idCotPref = 0) {
    const modal = document.getElementById('modal-agendar-reserva');
    const alertBox = document.getElementById('alert-modal-agendar-res');
    const selectCot = document.getElementById('select-res-cotizacion');
    const inputFecha = document.getElementById('input-res-fecha');

    if (!modal) return;
    if (alertBox) alertBox.style.display = 'none';

    if (inputFecha && fechaPref) {
      inputFecha.value = fechaPref;
      verificarDisponibilidadFechaModal(fechaPref);
    }

    if (selectCot && idCotPref > 0) {
      selectCot.value = String(idCotPref);
      selectCot.dispatchEvent(new Event('change'));
    }

    modal.classList.add('show');
  }

  /**
   * Verifica en tiempo real si la fecha elegida en el modal está libre o bloqueada (RF06)
   */
  async function verificarDisponibilidadFechaModal(fechaIso) {
    const badge = document.getElementById('badge-verif-fecha-modal');
    if (!badge || !fechaIso) return;

    try {
      const res = await fetch(`modules/reservas/reservas_api.php?action=verificar_fecha&fecha=${encodeURIComponent(fechaIso)}`);
      const data = await res.json();
      if (data.success) {
        if (data.bloqueada && data.reserva_bloqueante) {
          const rb = data.reserva_bloqueante;
          badge.className = 'res-date-check-hint hint-blocked';
          badge.innerHTML = `🔒 <strong>Fecha Bloqueada (RF06):</strong> Ocupada por Reserva #${rb.id_reserva} (${escapeHtml(rb.nombres)} ${escapeHtml(rb.apellidos)} - ${escapeHtml(rb.tipo_evento)}).`;
        } else {
          badge.className = 'res-date-check-hint hint-free';
          badge.innerHTML = `✅ <strong>Fecha Disponible:</strong> Libre para agendar y aplicar bloqueo automático.`;
        }
      }
    } catch (e) {
      console.error('Error verificando fecha:', e);
    }
  }

  /**
   * Envía la creación de la reserva a `reservas_api.php`
   */
  async function guardarNuevaReserva(e) {
    e.preventDefault();
    const idCot = parseInt(document.getElementById('select-res-cotizacion')?.value || '0', 10);
    const fecha = document.getElementById('input-res-fecha')?.value || '';
    const hora = document.getElementById('input-res-hora')?.value || '15:30';
    const estado = document.getElementById('select-res-estado')?.value || 'Confirmado';
    const obs = document.getElementById('input-res-obs')?.value || '';
    const alertBox = document.getElementById('alert-modal-agendar-res');
    const btnSubmit = document.getElementById('btn-submit-agendar-res');

    if (!idCot) {
      if (alertBox) {
        alertBox.textContent = 'Debe seleccionar una cotización guardada.';
        alertBox.style.display = 'flex';
      }
      return;
    }

    try {
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Bloqueando fecha y guardando...';
      }

      const res = await fetch('modules/reservas/reservas_api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'crear_reserva',
          id_cotizacion: idCot,
          fecha_evento: fecha,
          hora_inicio: hora,
          estado_reserva: estado,
          observaciones: obs
        })
      });

      const data = await res.json();
      if (data.success) {
        document.getElementById('modal-agendar-reserva')?.classList.remove('show');
        const partes = fecha.split('-');
        if (partes.length === 3) {
          estadoCalendario.anio = parseInt(partes[0], 10);
          estadoCalendario.mes = parseInt(partes[1], 10);
          estadoCalendario.fechaSeleccionada = fecha;
        }
        await cargarDatosCalendario();
        alert(data.mensaje);
      } else {
        if (alertBox) {
          alertBox.textContent = data.error || 'No se pudo registrar la reserva.';
          alertBox.style.display = 'flex';
        }
      }
    } catch (err) {
      console.error('Error creando reserva:', err);
      if (alertBox) {
        alertBox.textContent = 'Error de conexión con el servidor.';
        alertBox.style.display = 'flex';
      }
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = '🔒 Confirmar y Bloquear Fecha';
      }
    }
  }

  /**
   * Abre el modal para editar estado, fecha u horario de una reserva existente
   */
  function abrirModalEditarReserva(idReserva) {
    const r = estadoCalendario.todasReservas.find(x => Number(x.id_reserva) === Number(idReserva));
    if (!r) return;

    const modal = document.getElementById('modal-editar-reserva');
    const alertBox = document.getElementById('alert-modal-editar-res');
    if (!modal) return;
    if (alertBox) alertBox.style.display = 'none';

    document.getElementById('title-modal-editar-res').textContent = `Gestionar Reserva #${r.id_reserva} (${r.nombres} ${r.apellidos})`;
    document.getElementById('edit-res-id').value = r.id_reserva;
    document.getElementById('edit-res-fecha').value = r.fecha_evento;
    document.getElementById('edit-res-hora').value = r.hora_inicio_corta || '15:30';
    document.getElementById('edit-res-estado').value = r.estado_reserva;
    document.getElementById('edit-res-obs').value = r.observaciones || '';

    modal.classList.add('show');
  }

  /**
   * Guarda los cambios de una reserva existente
   */
  async function guardarEdicionReserva(e) {
    e.preventDefault();
    const idReserva = parseInt(document.getElementById('edit-res-id').value, 10);
    const fecha = document.getElementById('edit-res-fecha').value;
    const hora = document.getElementById('edit-res-hora').value;
    const estado = document.getElementById('edit-res-estado').value;
    const obs = document.getElementById('edit-res-obs').value;
    const alertBox = document.getElementById('alert-modal-editar-res');

    try {
      const res = await fetch('modules/reservas/reservas_api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'actualizar_reserva',
          id_reserva: idReserva,
          fecha_evento: fecha,
          hora_inicio: hora,
          estado_reserva: estado,
          observaciones: obs
        })
      });

      const data = await res.json();
      if (data.success) {
        document.getElementById('modal-editar-reserva')?.classList.remove('show');
        estadoCalendario.fechaSeleccionada = fecha;
        await cargarDatosCalendario();
        alert(data.mensaje);
      } else {
        if (alertBox) {
          alertBox.textContent = data.error || 'Error al actualizar la reserva.';
          alertBox.style.display = 'flex';
        }
      }
    } catch (err) {
      console.error('Error editando reserva:', err);
    }
  }

  /**
   * Elimina una reserva (Super Administrador) liberando la fecha y dejando registro en auditoría
   */
  async function eliminarReservaConfirmada(idReserva) {
    if (!confirm(`¿Desea eliminar la Reserva #${idReserva} y liberar automáticamente su fecha en el calendario?\n\nEsta acción quedará registrada en la bitácora histórica de la base de datos.`)) {
      return;
    }

    try {
      const res = await fetch('modules/reservas/reservas_api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'eliminar_reserva',
          id_reserva: idReserva
        })
      });
      const data = await res.json();
      if (data.success) {
        await cargarDatosCalendario();
        alert(data.mensaje);
      } else {
        alert(data.error || 'No se pudo eliminar la reserva.');
      }
    } catch (err) {
      console.error('Error eliminando reserva:', err);
    }
  }

  // Exponer función global para agendar una cotización directamente desde el módulo Cotizador (Fase 5 -> Fase 6)
  window.agendarCotizacionEnCalendario = (idCotizacion, fechaEvento) => {
    if (window.navegarAModulo) {
      window.navegarAModulo('view-calendario', 'CALENDARIO');
    }
    const partes = (fechaEvento || hoyIso).split('-');
    if (partes.length === 3) {
      estadoCalendario.anio = parseInt(partes[0], 10);
      estadoCalendario.mes = parseInt(partes[1], 10);
      estadoCalendario.fechaSeleccionada = fechaEvento;
    }
    cargarDatosCalendario().then(() => {
      abrirModalAgendarReserva(fechaEvento, idCotizacion);
    });
  };

  window.addEventListener('module-activated', (e) => {
    if (e.detail && e.detail.moduleId === 'view-calendario') {
      cargarDatosCalendario();
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    initReservasModule();
  });

})();
