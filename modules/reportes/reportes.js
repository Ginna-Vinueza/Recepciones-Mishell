/**
 * Módulo de Reportes, Métricas y KPIs (RF07) (Figura 7)
 * Incluye Gráficos de Facturación, Efectividad Comercial, Preferencias del Catálogo,
 * Exportación CSV/Impresión y Bitácora Histórica para Super Administrador
 * Plataforma Web Recepciones Mishell - Quito 2026
 */

(() => {
  const NOMBRES_MESES = [
    'Todos los meses', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const TIPOS_EVENTO_FILTRO = [
    'Todos', 'Cumpleaños', 'Boda', 'Graduación', 'Bautizo', 'Primera Comunión', 'Reuniones Sociales'
  ];

  const estadoReportes = {
    anio: '2026',
    mes: 0,
    tipoEvento: 'Todos',
    busquedaTabla: '',
    filtroModuloAuditoria: 'Todos',
    datos: null,
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

  function formatMoney(val) {
    const num = parseFloat(val || 0);
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /**
   * Inicializa el módulo de Reportes y KPIs (RF07)
   */
  function initReportesModule() {
    cargarDatosReportes();
  }

  /**
   * Consulta `modules/reportes/reportes_api.php` con los filtros activos
   */
  async function cargarDatosReportes() {
    const container = document.getElementById('reportes-component-container');
    if (!container) return;

    try {
      estadoReportes.cargando = true;
      const params = new URLSearchParams({
        action: 'dashboard',
        anio: String(estadoReportes.anio),
        mes: String(estadoReportes.mes),
        tipo_evento: estadoReportes.tipoEvento
      });

      const res = await fetch(`modules/reportes/reportes_api.php?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        estadoReportes.datos = data;
        if (data.rol_usuario) {
          estadoReportes.esSuperAdmin = data.rol_usuario === 'Administrador';
        }
        renderVistaReportes();
      } else {
        container.innerHTML = `<div class="empty-state-message">Error al cargar reportes: ${escapeHtml(data.error || 'Intente nuevamente')}</div>`;
      }
    } catch (err) {
      console.error('Error al cargar reportes RF07:', err);
      container.innerHTML = `<div class="empty-state-message">No se pudo conectar con el servidor de reportes y métricas.</div>`;
    } finally {
      estadoReportes.cargando = false;
    }
  }

  /**
   * Renderiza toda la interfaz de la Figura 7 (Módulo de Reportes, Métricas y KPIs - RF07)
   */
  function renderVistaReportes() {
    const container = document.getElementById('reportes-component-container');
    if (!container || !estadoReportes.datos) return;

    const d = estadoReportes.datos;
    const k = d.kpis || {};
    const pref = d.preferencias_catalogo || {};
    const tarifasMenu = pref.tarifas_menu || {};
    const horasExtra = pref.horas_extra_stats || {};
    const coloresMant = pref.colores_manteleria || [];
    const tiposEv = d.por_tipo_evento || [];
    const evolucion = d.evolucion_mensual || [];
    const topCli = d.top_clientes || [];
    const etiquetaPeriodo = `${estadoReportes.mes > 0 ? NOMBRES_MESES[estadoReportes.mes] + ' ' : ''}${estadoReportes.anio === 'Todos' ? 'Histórico General' : estadoReportes.anio}`;

    container.innerHTML = `
      <!-- Encabezado Institucional del Módulo de Reportes y Análisis (RF07 - Figura 7) -->
      <div class="rep-header-bar">
        <div>
          <div class="cotizador-badge-rf">
            Módulo RF07 • Inteligencia de Negocio, Métricas y KPIs
          </div>
          <h2 class="cal-section-main-title">Reportes Gerenciales, Facturación y Efectividad Comercial</h2>
          <p class="cal-section-main-sub">
            Análisis estadístico en tiempo real de ingresos proyectados, tasa de conversión de cotizaciones a reservas y preferencias del catálogo.
          </p>
        </div>
        <div class="rep-header-actions no-print">
          <button type="button" class="btn-catalog-peek" id="btn-rep-exportar-csv" title="Descargar matriz de datos en formato CSV compatible con Excel">
            📥 Exportar CSV
          </button>
          <button type="button" class="btn-primary-sm" id="btn-rep-imprimir" title="Imprimir o guardar en PDF el reporte gerencial">
            🖨️ Imprimir Reporte
          </button>
        </div>
      </div>

      <!-- Barra de Filtros Dinámicos (Año, Mes y Tipo de Evento) -->
      <div class="rep-filters-card no-print">
        <div class="rep-filter-group">
          <label for="rep-select-anio">Año Fiscal</label>
          <select id="rep-select-anio" class="rep-filter-select">
            <option value="Todos" ${estadoReportes.anio === 'Todos' ? 'selected' : ''}>Todos los años</option>
            <option value="2026" ${String(estadoReportes.anio) === '2026' ? 'selected' : ''}>2026 (Actual)</option>
            <option value="2027" ${String(estadoReportes.anio) === '2027' ? 'selected' : ''}>2027</option>
            <option value="2025" ${String(estadoReportes.anio) === '2025' ? 'selected' : ''}>2025</option>
          </select>
        </div>

        <div class="rep-filter-group">
          <label for="rep-select-mes">Mes / Periodo</label>
          <select id="rep-select-mes" class="rep-filter-select">
            ${NOMBRES_MESES.map((m, idx) => `
              <option value="${idx}" ${Number(estadoReportes.mes) === idx ? 'selected' : ''}>${m}</option>
            `).join('')}
          </select>
        </div>

        <div class="rep-filter-group">
          <label for="rep-select-tipo">Tipo de Evento</label>
          <select id="rep-select-tipo" class="rep-filter-select">
            ${TIPOS_EVENTO_FILTRO.map(t => `
              <option value="${escapeHtml(t)}" ${estadoReportes.tipoEvento === t ? 'selected' : ''}>${escapeHtml(t)}</option>
            `).join('')}
          </select>
        </div>

        <div class="rep-filter-actions">
          <button type="button" class="btn-cal-today" id="btn-rep-limpiar-filtros">Restablecer</button>
          <span class="rep-period-pill">📊 Periodo: <strong>${escapeHtml(etiquetaPeriodo)}</strong></span>
        </div>
      </div>

      <!-- 1. TARJETAS DE KPIs EJECUTIVOS (FIGURA 7) -->
      <div class="rep-kpis-grid">
        <div class="rep-kpi-card kpi-accent-terracotta">
          <div class="rep-kpi-top">
            <span class="rep-kpi-title">Ingresos de Reservas Activas</span>
            <span class="rep-kpi-icon">💰</span>
          </div>
          <strong class="rep-kpi-big">${formatMoney(k.ingresos_comprometidos)}</strong>
          <div class="rep-kpi-meta">
            <span>Total Cotizado: <strong>${formatMoney(k.monto_total_cotizado)}</strong></span>
            <span>Ticket Promedio: <strong>${formatMoney(k.ticket_promedio)}</strong></span>
          </div>
        </div>

        <div class="rep-kpi-card kpi-accent-emerald">
          <div class="rep-kpi-top">
            <span class="rep-kpi-title">Efectividad / Conversión (RF07)</span>
            <span class="rep-kpi-icon">📈</span>
          </div>
          <strong class="rep-kpi-big">${k.tasa_conversion}%</strong>
          <div class="rep-kpi-meta">
            <span><strong>${k.cotizaciones_aprobadas}</strong> aprobadas de <strong>${k.total_cotizaciones}</strong> cotizaciones</span>
            <span>Pendientes de cierre: <strong>${k.cotizaciones_pendientes}</strong></span>
          </div>
        </div>

        <div class="rep-kpi-card kpi-accent-slate">
          <div class="rep-kpi-top">
            <span class="rep-kpi-title">Eventos Reservados y Aforo</span>
            <span class="rep-kpi-icon">🏛️</span>
          </div>
          <strong class="rep-kpi-big">${k.reservas_activas} ${k.reservas_activas === 1 ? 'Evento' : 'Eventos'}</strong>
          <div class="rep-kpi-meta">
            <span>Confirmados: <strong>${k.reservas_confirmadas}</strong> • En Proceso: <strong>${k.reservas_en_proceso}</strong></span>
            <span>Aforo promedio: <strong>${k.promedio_invitados} pers./evento</strong></span>
          </div>
        </div>

        <div class="rep-kpi-card kpi-accent-gold">
          <div class="rep-kpi-top">
            <span class="rep-kpi-title">Cartera y Fidelización</span>
            <span class="rep-kpi-icon">👥</span>
          </div>
          <strong class="rep-kpi-big">${k.total_clientes} Clientes</strong>
          <div class="rep-kpi-meta">
            <span>Clientes frecuentes: <strong>${k.clientes_frecuentes}</strong></span>
            <span>Total invitados proyectados: <strong>${k.total_invitados_cotizados}</strong></span>
          </div>
        </div>
      </div>

      <!-- 2. GRÁFICOS ESTADÍSTICOS PRINCIPALES (FIGURA 7) -->
      <div class="rep-charts-grid-2">
        
        <!-- Gráfico A: Evolución Mensual de Facturación y Cotizaciones -->
        <div class="rep-chart-card">
          <div class="rep-card-header">
            <div>
              <h3 class="rep-card-title">Evolución Mensual de Facturación y Cotizaciones (${d.filtros_aplicados?.anio_grafico || 2026})</h3>
              <p class="rep-card-sub">Comparativa mensual entre volumen cotizado ($) e ingresos asegurados por reservas ($).</p>
            </div>
            <div class="rep-chart-legend">
              <span><i class="rep-dot dot-cot"></i> Monto Cotizado</span>
              <span><i class="rep-dot dot-res"></i> Ingreso Reservado</span>
            </div>
          </div>

          <div class="rep-monthly-bars-wrapper">
            ${renderGraficoEvolucionMensualHtml(evolucion)}
          </div>
        </div>

        <!-- Gráfico B: Embudo de Efectividad Comercial y Preferencia de Menú -->
        <div class="rep-chart-card">
          <div class="rep-card-header">
            <div>
              <h3 class="rep-card-title">Embudo de Efectividad Comercial y Menú Buffet</h3>
              <p class="rep-card-sub">Conversión de proformas emitidas y distribución entre tarifa estándar ($14) y especial con lomo ($16).</p>
            </div>
          </div>

          <div class="rep-funnel-list">
            <div class="rep-funnel-item">
              <div class="rep-funnel-labels">
                <span>1. Proformas / Cotizaciones Emitidas</span>
                <strong>${k.total_cotizaciones} (${formatMoney(k.monto_total_cotizado)})</strong>
              </div>
              <div class="rep-progress-track">
                <div class="rep-progress-fill fill-slate" style="width: 100%;"></div>
              </div>
            </div>

            <div class="rep-funnel-item">
              <div class="rep-funnel-labels">
                <span>2. Convertidas en Reserva con Bloqueo (Efectividad: ${k.tasa_conversion}%)</span>
                <strong>${k.cotizaciones_aprobadas} (${formatMoney(k.ingresos_comprometidos)})</strong>
              </div>
              <div class="rep-progress-track">
                <div class="rep-progress-fill fill-emerald" style="width: ${Math.min(100, k.tasa_conversion || 0)}%;"></div>
              </div>
            </div>

            <div class="rep-funnel-item">
              <div class="rep-funnel-labels">
                <span>3. Cotizaciones Pendientes de Confirmación</span>
                <strong>${k.cotizaciones_pendientes} proformas</strong>
              </div>
              <div class="rep-progress-track">
                <div class="rep-progress-fill fill-amber" style="width: ${k.total_cotizaciones > 0 ? Math.round((k.cotizaciones_pendientes / k.total_cotizaciones) * 100) : 0}%;"></div>
              </div>
            </div>
          </div>

          <div class="rep-menu-split-box">
            <h4 class="rep-mini-heading">Preferencia de Tarifa de Menú Buffet (RF03 / RF04)</h4>
            <div class="rep-menu-cards-2">
              <div class="rep-menu-stat-pill">
                <span class="rep-msp-tag">Menú Estándar ($14.00)</span>
                <strong>${tarifasMenu.estandar_14 || 0} eventos (${tarifasMenu.pct_estandar || 0}%)</strong>
                <small>Acumulado: ${formatMoney(tarifasMenu.monto_estandar)}</small>
              </div>
              <div class="rep-menu-stat-pill pill-lomo">
                <span class="rep-msp-tag">★ Menú Especial Lomo ($16.00)</span>
                <strong>${tarifasMenu.especial_16 || 0} eventos (${tarifasMenu.pct_especial || 0}%)</strong>
                <small>Acumulado: ${formatMoney(tarifasMenu.monto_especial)}</small>
              </div>
            </div>
            <div class="rep-extra-hours-summary">
              <span>⏱️ <strong>Horas Extra ($80/h):</strong> ${horasExtra.eventos_con_extra || 0} eventos contrataron ${horasExtra.total_horas_extra || 0} h adicionales (${formatMoney(horasExtra.ingresos_extra)}).</span>
            </div>
          </div>
        </div>

      </div>

      <!-- 3. DEMANDA POR TIPO DE EVENTO, COLORES DE MANTELERÍA Y TOP CLIENTES -->
      <div class="rep-charts-grid-3">
        
        <!-- Demanda por Tipo de Evento -->
        <div class="rep-chart-card">
          <h3 class="rep-card-title">Demanda por Tipo de Evento</h3>
          <p class="rep-card-sub">Participación por categoría de evento social o corporativo.</p>
          <div class="rep-event-types-list">
            ${tiposEv.length === 0 ? `<p class="rep-empty-small">Sin registros en este filtro.</p>` : tiposEv.map(t => `
              <div class="rep-etype-row">
                <div class="rep-etype-top">
                  <strong>🎉 ${escapeHtml(t.tipo_evento)}</strong>
                  <span>${t.cotizaciones} cot. • ${t.reservas} res. (${t.porcentaje}%)</span>
                </div>
                <div class="rep-progress-track">
                  <div class="rep-progress-fill fill-terracotta" style="width: ${Math.max(6, t.porcentaje)}%;"></div>
                </div>
                <div class="rep-etype-sub">
                  <span>Invitados: ${t.invitados} pers.</span>
                  <span>Cotizado: <strong>${formatMoney(t.monto_cotizado)}</strong></span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Colores de Mantelería y Lazos más Solicitados -->
        <div class="rep-chart-card">
          <h3 class="rep-card-title">Tendencia en Mantelería y Lazos</h3>
          <p class="rep-card-sub">Colores decorativos preferidos para mesas y sillas de gala.</p>
          <div class="rep-event-types-list">
            ${coloresMant.length === 0 ? `<p class="rep-empty-small">Sin datos de mantelería.</p>` : coloresMant.map(c => `
              <div class="rep-etype-row">
                <div class="rep-etype-top">
                  <strong>🎨 ${escapeHtml(c.color)}</strong>
                  <span>${c.cantidad} ${c.cantidad === 1 ? 'evento' : 'eventos'} (${c.porcentaje}%)</span>
                </div>
                <div class="rep-progress-track">
                  <div class="rep-progress-fill fill-gold" style="width: ${Math.max(8, c.porcentaje)}%;"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Top Clientes Frecuentes -->
        <div class="rep-chart-card">
          <h3 class="rep-card-title">Top Clientes por Volumen</h3>
          <p class="rep-card-sub">Titulares con mayor inversión y eventos en Recepciones Mishell.</p>
          <div class="rep-top-clients-list">
            ${topCli.map((cli, idx) => `
              <div class="rep-top-cli-item">
                <div class="rep-top-cli-rank">#${idx + 1}</div>
                <div class="rep-top-cli-info">
                  <strong>${escapeHtml(cli.nombres)} ${escapeHtml(cli.apellidos)}</strong>
                  <span>C.I./RUC: <code>${escapeHtml(cli.cedula_ruc)}</code> • ${cli.total_cotizaciones} cot. / ${cli.total_reservas} res.</span>
                </div>
                <div class="rep-top-cli-amount">
                  <strong>${formatMoney(cli.monto_cotizado)}</strong>
                  ${Number(cli.monto_reservado) > 0 ? `<small class="text-success">Res: ${formatMoney(cli.monto_reservado)}</small>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

      </div>

      <!-- 4. MATRIZ CONSOLIDADA DE COTIZACIONES Y RESERVAS DEL PERIODO -->
      <div class="rep-table-card">
        <div class="cal-list-header">
          <div>
            <h3 class="rep-card-title">Matriz Consolidada de Cotizaciones y Eventos (${(d.detalle_eventos || []).length})</h3>
            <p class="rep-card-sub">Detalle operativo y financiero de todos los eventos del periodo seleccionado.</p>
          </div>
          <div class="no-print">
            <input
              type="text"
              id="rep-input-buscar-tabla"
              class="cal-search-input"
              placeholder="Filtrar por cliente, cédula, evento o fecha..."
              value="${escapeHtml(estadoReportes.busquedaTabla)}"
            >
          </div>
        </div>

        <div class="rep-table-responsive" id="rep-tabla-eventos-wrapper">
          ${renderTablaConsolidadaEventosHtml()}
        </div>
      </div>

      <!-- 5. BITÁCORA HISTÓRICA DE AUDITORÍA EN BASE DE DATOS (SUPER ADMINISTRADOR) -->
      ${estadoReportes.esSuperAdmin ? renderSeccionAuditoriaSuperAdminHtml(d.historial_auditoria || []) : ''}
    `;

    bindEventosReportes();
  }

  /**
   * Renderiza las barras interactivas de los 12 meses del año
   */
  function renderGraficoEvolucionMensualHtml(evolucion) {
    if (!evolucion || evolucion.length === 0) {
      return `<p class="rep-empty-small">No hay datos mensuales disponibles.</p>`;
    }

    const maxValor = Math.max(
      1000,
      ...evolucion.map(m => Math.max(parseFloat(m.monto_cotizado || 0), parseFloat(m.ingresos_reservados || 0)))
    );

    return `
      <div class="rep-bars-grid-12">
        ${evolucion.map(m => {
          const cot = parseFloat(m.monto_cotizado || 0);
          const res = parseFloat(m.ingresos_reservados || 0);
          const hCot = cot > 0 ? Math.max(8, Math.round((cot / maxValor) * 100)) : 3;
          const hRes = res > 0 ? Math.max(8, Math.round((res / maxValor) * 100)) : 3;
          const esMesActivo = Number(estadoReportes.mes) === Number(m.mes_num);

          return `
            <div class="rep-month-col ${esMesActivo ? 'is-active-month' : ''}" data-filter-month="${m.mes_num}" title="${m.mes_nombre}: Cotizado ${formatMoney(cot)} (${m.total_cotizaciones} cot.) | Reservado ${formatMoney(res)} (${m.total_reservas} res.)">
              <div class="rep-month-values-top">
                ${res > 0 ? `<span class="val-res">$${Math.round(res)}</span>` : (cot > 0 ? `<span class="val-cot">$${Math.round(cot)}</span>` : `<span class="val-zero">$0</span>`)}
              </div>
              <div class="rep-bars-pair">
                <div class="rep-bar bar-cot" style="height: ${hCot}%;"></div>
                <div class="rep-bar bar-res" style="height: ${hRes}%;"></div>
              </div>
              <span class="rep-month-label">${escapeHtml(m.mes_corto)}</span>
              <span class="rep-month-ev-count">${m.total_cotizaciones}c / ${m.total_reservas}r</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /**
   * Renderiza la tabla detallada de eventos con soporte de búsqueda instantánea
   */
  function renderTablaConsolidadaEventosHtml() {
    const lista = (estadoReportes.datos?.detalle_eventos || []).filter(item => {
      const q = estadoReportes.busquedaTabla.trim().toLowerCase();
      if (!q) return true;
      const txt = `#${item.id_cotizacion} #${item.id_reserva || ''} ${item.nombres} ${item.apellidos} ${item.cedula_ruc} ${item.tipo_evento} ${item.fecha_evento_propuesta}`.toLowerCase();
      return txt.includes(q);
    });

    if (lista.length === 0) {
      return `<div class="saved-quotes-empty">No se encontraron registros que coincidan con los criterios aplicados.</div>`;
    }

    return `
      <table class="rep-data-table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Fecha Evento</th>
            <th>Cliente / Cédula</th>
            <th>Tipo de Evento</th>
            <th>Invitados</th>
            <th>Tarifa Plato</th>
            <th>Horas Extra</th>
            <th>Total Evento</th>
            <th>Estado</th>
            <th class="no-print">Acción</th>
          </tr>
        </thead>
        <tbody>
          ${lista.map(r => {
            const tieneRes = !emptyId(r.id_reserva) && r.estado_reserva !== 'Cancelado';
            const badgeEstado = tieneRes
              ? `<span class="cal-res-status-badge ${r.estado_reserva === 'Confirmado' ? 'res-badge-confirmed' : 'res-badge-process'}">🔒 ${escapeHtml(r.estado_reserva)} (#${r.id_reserva})</span>`
              : `<span class="cal-res-status-badge res-badge-cancelled">${escapeHtml(r.estado_cotizacion || 'Pendiente')}</span>`;

            return `
              <tr>
                <td><strong>Cot. #${r.id_cotizacion}</strong></td>
                <td>${escapeHtml(r.fecha_reserva_oficial || r.fecha_evento_propuesta)} <small>${escapeHtml(r.hora_inicio_corta || '15:30')}</small></td>
                <td>
                  <strong>${escapeHtml(r.nombres)} ${escapeHtml(r.apellidos)}</strong><br>
                  <small><code>${escapeHtml(r.cedula_ruc)}</code></small>
                </td>
                <td>${escapeHtml(r.tipo_evento || 'Recepción')}</td>
                <td>${r.cantidad_personas} pers.</td>
                <td>$${parseFloat(r.precio_plato || 14).toFixed(2)}</td>
                <td>${Number(r.horas_extra) > 0 ? `+${r.horas_extra}h ($${parseFloat(r.subtotal_horas_extra).toFixed(2)})` : 'Sin extra'}</td>
                <td><strong>${formatMoney(r.monto_final_evento)}</strong></td>
                <td>${badgeEstado}</td>
                <td class="no-print">
                  <button type="button" class="btn-sq-action btn-sq-print" data-rep-ver-proforma="${r.id_cotizacion}">
                    🖨️ Proforma
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  function emptyId(val) {
    return val === null || val === undefined || val === '' || Number(val) === 0;
  }

  /**
   * Renderiza el panel de Bitácora Histórica en BD para el Super Administrador
   */
  function renderSeccionAuditoriaSuperAdminHtml(logs) {
    const logsFiltrados = logs.filter(l => {
      if (estadoReportes.filtroModuloAuditoria === 'Todos') return true;
      return String(l.modulo || '').toLowerCase().includes(estadoReportes.filtroModuloAuditoria.toLowerCase());
    });

    return `
      <div class="rep-table-card rep-audit-card no-print">
        <div class="cal-list-header">
          <div>
            <span class="cotizador-badge-rf">Exclusivo Super Administrador • Trazabilidad en BD</span>
            <h3 class="rep-card-title">Bitácora Histórica de Acciones Administrativas (historial_acciones)</h3>
            <p class="rep-card-sub">Registro inalterable de creaciones, actualizaciones, eliminaciones y exportaciones realizadas en el sistema.</p>
          </div>
          <div class="cal-filter-pills">
            ${['Todos', 'Cotizador', 'Reservas', 'Clientes', 'Servicios', 'Reportes'].map(m => `
              <button type="button" class="btn-cal-filter-pill ${estadoReportes.filtroModuloAuditoria === m ? 'active' : ''}" data-audit-mod="${m}">
                ${m === 'Todos' ? 'Todos los módulos' : m}
              </button>
            `).join('')}
          </div>
        </div>

        <form id="form-rep-nota-auditoria" class="rep-audit-note-form">
          <input
            type="text"
            id="input-rep-nota-auditoria"
            class="form-control"
            style="padding: 0 0.875rem;"
            placeholder="Registrar observación de revisión gerencial en la bitácora histórica de la base de datos..."
            required
          >
          <button type="submit" class="btn-primary-sm">+ Registrar en Bitácora BD</button>
        </form>

        <div class="rep-audit-list">
          ${logsFiltrados.length === 0 ? `<div class="saved-quotes-empty">No hay registros en la bitácora para este módulo.</div>` : logsFiltrados.map(log => `
            <div class="rep-audit-item">
              <div class="rep-audit-meta">
                <span class="saved-quote-badge-id">#${log.id_historial}</span>
                <span class="rep-audit-mod-tag">${escapeHtml(log.modulo)}</span>
                <strong>${escapeHtml(log.accion)}</strong>
                <span>por <em>${escapeHtml(log.nombre_usuario)}</em> (${escapeHtml(log.rol_usuario)})</span>
              </div>
              <div class="rep-audit-desc">${escapeHtml(log.descripcion)}</div>
              <div class="rep-audit-time">🕒 ${escapeHtml(log.fecha_hora)} • IP: ${escapeHtml(log.ip_cliente || '127.0.0.1')}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Enlaza eventos interactivos del módulo de Reportes y KPIs
   */
  function bindEventosReportes() {
    document.getElementById('rep-select-anio')?.addEventListener('change', (e) => {
      estadoReportes.anio = e.target.value;
      cargarDatosReportes();
    });

    document.getElementById('rep-select-mes')?.addEventListener('change', (e) => {
      estadoReportes.mes = parseInt(e.target.value, 10) || 0;
      cargarDatosReportes();
    });

    document.getElementById('rep-select-tipo')?.addEventListener('change', (e) => {
      estadoReportes.tipoEvento = e.target.value;
      cargarDatosReportes();
    });

    document.getElementById('btn-rep-limpiar-filtros')?.addEventListener('click', () => {
      estadoReportes.anio = '2026';
      estadoReportes.mes = 0;
      estadoReportes.tipoEvento = 'Todos';
      estadoReportes.busquedaTabla = '';
      cargarDatosReportes();
    });

    // Clic en una barra de mes para filtrar directamente ese mes
    document.querySelectorAll('.rep-month-col[data-filter-month]').forEach(col => {
      col.addEventListener('click', () => {
        const m = parseInt(col.getAttribute('data-filter-month'), 10);
        estadoReportes.mes = (estadoReportes.mes === m) ? 0 : m;
        cargarDatosReportes();
      });
    });

    // Búsqueda instantánea en la tabla consolidada
    document.getElementById('rep-input-buscar-tabla')?.addEventListener('input', (e) => {
      estadoReportes.busquedaTabla = e.target.value;
      const wrapper = document.getElementById('rep-tabla-eventos-wrapper');
      if (wrapper) {
        wrapper.innerHTML = renderTablaConsolidadaEventosHtml();
        bindBotonesProformaTabla();
      }
    });

    // Exportar CSV
    document.getElementById('btn-rep-exportar-csv')?.addEventListener('click', exportarReporteCSV);

    // Imprimir Reporte Gerencial
    document.getElementById('btn-rep-imprimir')?.addEventListener('click', async () => {
      try {
        await fetch('modules/reportes/reportes_api.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'registrar_exportacion',
            formato: 'Impresión PDF Gerencial',
            filtro: `Año:${estadoReportes.anio}, Mes:${estadoReportes.mes}, Evento:${estadoReportes.tipoEvento}`
          })
        });
      } catch (_) {}
      window.print();
    });

    // Filtros de bitácora de auditoría
    document.querySelectorAll('[data-audit-mod]').forEach(btn => {
      btn.addEventListener('click', () => {
        estadoReportes.filtroModuloAuditoria = btn.getAttribute('data-audit-mod') || 'Todos';
        renderVistaReportes();
      });
    });

    // Registrar observación en bitácora histórica
    document.getElementById('form-rep-nota-auditoria')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('input-rep-nota-auditoria');
      const nota = input ? input.value.trim() : '';
      if (!nota) return;

      try {
        const res = await fetch('modules/reportes/reportes_api.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'registrar_nota_auditoria',
            nota
          })
        });
        const data = await res.json();
        if (data.success) {
          cargarDatosReportes();
        } else {
          alert(data.error || 'No se pudo registrar en la bitácora.');
        }
      } catch (err) {
        console.error('Error registrando auditoría:', err);
      }
    });

    bindBotonesProformaTabla();
  }

  function bindBotonesProformaTabla() {
    document.querySelectorAll('[data-rep-ver-proforma]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idCot = parseInt(btn.getAttribute('data-rep-ver-proforma'), 10);
        if (window.abrirCotizacionEnProformaPorId) {
          window.abrirCotizacionEnProformaPorId(idCot);
        }
      });
    });
  }

  /**
   * Genera y descarga un archivo CSV compatible con Excel con los eventos y métricas filtradas
   */
  async function exportarReporteCSV() {
    const lista = estadoReportes.datos?.detalle_eventos || [];
    if (lista.length === 0) {
      alert('No hay registros en el periodo actual para exportar.');
      return;
    }

    const encabezados = [
      'ID Cotizacion', 'ID Reserva', 'Fecha Evento', 'Hora Inicio', 'Cedula/RUC',
      'Cliente', 'Tipo Evento', 'Invitados', 'Color Manteleria', 'Precio Plato',
      'Horas Extra', 'Total Evento USD', 'Estado'
    ];

    const filas = lista.map(r => [
      r.id_cotizacion,
      r.id_reserva || 'Sin Reserva',
      r.fecha_reserva_oficial || r.fecha_evento_propuesta,
      r.hora_inicio_corta || '15:30',
      `"${r.cedula_ruc}"`,
      `"${(r.nombres + ' ' + r.apellidos).replace(/"/g, '""')}"`,
      `"${(r.tipo_evento || '').replace(/"/g, '""')}"`,
      r.cantidad_personas,
      `"${(r.color_manteleria || '').replace(/"/g, '""')}"`,
      parseFloat(r.precio_plato || 14).toFixed(2),
      r.horas_extra || 0,
      parseFloat(r.monto_final_evento || 0).toFixed(2),
      r.id_reserva && r.estado_reserva !== 'Cancelado' ? r.estado_reserva : (r.estado_cotizacion || 'Pendiente')
    ]);

    const contenidoCsv = '\uFEFF' + [encabezados.join(';'), ...filas.map(f => f.join(';'))].join('\r\n');
    const blob = new Blob([contenidoCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Reporte_Recepciones_Mishell_${estadoReportes.anio}_Mes_${estadoReportes.mes}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    try {
      await fetch('modules/reportes/reportes_api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'registrar_exportacion',
          formato: 'CSV Excel',
          filtro: `Año:${estadoReportes.anio}, Mes:${estadoReportes.mes}, Evento:${estadoReportes.tipoEvento}`
        })
      });
      cargarDatosReportes();
    } catch (_) {}
  }

  // Recargar automáticamente cuando se activa la pestaña "Reportes"
  window.addEventListener('module-activated', (e) => {
    if (e.detail && e.detail.moduleId === 'view-reportes') {
      cargarDatosReportes();
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    initReportesModule();
  });
})();
