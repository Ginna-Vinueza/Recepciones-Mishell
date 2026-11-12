/**
 * Módulo de Gestión de Clientes (RF02) - Frontend
 * Plataforma Web Recepciones Mishell - Quito 2026
 * Skills: frontend-design + ui-ux-pro-max + senior-backend
 */

(() => {
  // Estado local del módulo
  let listaClientes = [];
  let clienteEnEdicion = null;

  /**
   * Inicialización del módulo cuando se activa la vista
   */
  function initClientesModule() {
    renderInterface();
    cargarClientes();
    bindEvents();
  }

  /**
   * Renderiza la estructura base de la vista de clientes dentro del contenedor
   */
  function renderInterface() {
    const container = document.getElementById('clientes-component-container');
    if (!container) return;

    container.innerHTML = `
      <!-- Encabezado y Acciones de Clientes (Figura 7) -->
      <div class="module-header-row">
        <div>
          <h2 class="module-title">Directorio de Clientes</h2>
          <p class="module-subtitle">Registro oficial de titulares y anfitriones de eventos.</p>
        </div>
        <button type="button" class="btn-primary-sm" id="btn-nuevo-cliente">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>Nuevo Cliente</span>
        </button>
      </div>

      <!-- Barra de Búsqueda Reactiva -->
      <div class="search-box-wrapper">
        <span class="search-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </span>
        <input 
          type="text" 
          id="input-buscar-cliente" 
          class="search-input" 
          placeholder="Buscar por cédula, RUC, nombres o apellidos..."
          autocomplete="off"
        >
        <button type="button" class="search-clear-btn" id="btn-limpiar-busqueda" aria-label="Limpiar búsqueda" style="display:none;">
          ✕
        </button>
      </div>

      <!-- Métricas Rápidas / Contador -->
      <div class="clients-stats-bar">
        <span class="clients-counter-badge">
          <strong id="contador-clientes">0</strong> clientes registrados
        </span>
        <span class="clients-filter-hint">Quito, Ecuador</span>
      </div>

      <!-- Lista / Grid de Tarjetas de Clientes (Figura 7 y 8) -->
      <div id="lista-clientes-container" class="clients-cards-list">
        <div class="clients-loading-skeleton">
          <div class="spinner-dark"></div>
          <p>Cargando información de clientes...</p>
        </div>
      </div>

      <!-- Modal para Registrar / Editar Cliente -->
      <div id="modal-cliente" class="modal-backdrop" aria-hidden="true" role="dialog" aria-labelledby="modal-cliente-title">
        <div class="modal-card">
          <div class="modal-header">
            <h3 class="modal-title" id="modal-cliente-title">Registrar Nuevo Cliente</h3>
            <button type="button" class="modal-close-btn" id="btn-cerrar-modal" aria-label="Cerrar ventana">
              ✕
            </button>
          </div>
          
          <form id="form-cliente" class="modal-body">
            <input type="hidden" id="cliente-id" value="">
            
            <div id="modal-alert" class="alert-feedback alert-error" style="display:none;"></div>

            <div class="form-group">
              <label for="cliente-cedula" class="form-label">
                Cédula de Identidad o RUC <span class="text-danger">*</span>
              </label>
              <input 
                type="text" 
                id="cliente-cedula" 
                name="cedula_ruc" 
                class="form-control" 
                placeholder="Ej. 1714589201" 
                maxlength="13" 
                required
              >
              <small class="form-helper-text">10 dígitos para personas naturales o 13 para RUC.</small>
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label for="cliente-nombres" class="form-label">Nombres <span class="text-danger">*</span></label>
                <input type="text" id="cliente-nombres" name="nombres" class="form-control" placeholder="Ej. Roberto Carlos" required>
              </div>
              <div class="form-group">
                <label for="cliente-apellidos" class="form-label">Apellidos <span class="text-danger">*</span></label>
                <input type="text" id="cliente-apellidos" name="apellidos" class="form-control" placeholder="Ej. Benítez" required>
              </div>
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label for="cliente-telefono" class="form-label">Teléfono Móvil</label>
                <input type="tel" id="cliente-telefono" name="telefono" class="form-control" placeholder="0984123890">
              </div>
              <div class="form-group">
                <label for="cliente-correo" class="form-label">Correo Electrónico</label>
                <input type="email" id="cliente-correo" name="correo" class="form-control" placeholder="cliente@correo.com">
              </div>
            </div>

            <div class="form-group">
              <label for="cliente-direccion" class="form-label">Dirección Domiciliaria / Sector</label>
              <input type="text" id="cliente-direccion" name="direccion" class="form-control" placeholder="Sector o calles de referencia en Quito">
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-secondary" id="btn-cancelar-modal">Cancelar</button>
              <button type="submit" class="btn-primary" id="btn-guardar-cliente">
                <span>Guardar Cliente</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  /**
   * Enlaza eventos de la interfaz
   */
  function bindEvents() {
    const inputBuscar = document.getElementById('input-buscar-cliente');
    const btnLimpiar = document.getElementById('btn-limpiar-busqueda');
    const btnNuevo = document.getElementById('btn-nuevo-cliente');
    const btnCerrar = document.getElementById('btn-cerrar-modal');
    const btnCancelar = document.getElementById('btn-cancelar-modal');
    const formCliente = document.getElementById('form-cliente');

    // Búsqueda en tiempo real
    if (inputBuscar) {
      let debounceTimeout = null;
      inputBuscar.addEventListener('input', () => {
        const query = inputBuscar.value.trim();
        if (btnLimpiar) btnLimpiar.style.display = query ? 'block' : 'none';

        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
          cargarClientes(query);
        }, 250);
      });
    }

    if (btnLimpiar && inputBuscar) {
      btnLimpiar.addEventListener('click', () => {
        inputBuscar.value = '';
        btnLimpiar.style.display = 'none';
        cargarClientes();
        inputBuscar.focus();
      });
    }

    // Modal nuevo cliente
    if (btnNuevo) {
      btnNuevo.addEventListener('click', () => {
        abrirModalCliente();
      });
    }

    if (btnCerrar) btnCerrar.addEventListener('click', cerrarModalCliente);
    if (btnCancelar) btnCancelar.addEventListener('click', cerrarModalCliente);

    // Enviar formulario
    if (formCliente) {
      formCliente.addEventListener('submit', guardarCliente);
    }
  }

  /**
   * Consulta clientes a la API
   */
  async function cargarClientes(termino = '') {
    const contenedor = document.getElementById('lista-clientes-container');
    const contadorEl = document.getElementById('contador-clientes');

    try {
      const url = termino 
        ? `modules/clientes/clientes_api.php?q=${encodeURIComponent(termino)}`
        : 'modules/clientes/clientes_api.php';

      const res = await fetch(url);
      const data = await res.json();

      if (res.ok && data.success) {
        listaClientes = data.clientes || [];
        if (contadorEl) contadorEl.textContent = data.total ?? listaClientes.length;
        renderizarTarjetasClientes(listaClientes);
      } else {
        if (contenedor) {
          contenedor.innerHTML = `<div class="empty-state-message">Error al cargar clientes: ${data.error || 'Intente nuevamente'}</div>`;
        }
      }
    } catch (e) {
      console.error('Error al obtener clientes:', e);
      if (contenedor) {
        contenedor.innerHTML = `<div class="empty-state-message">No se pudo conectar con el servicio de clientes.</div>`;
      }
    }
  }

  /**
   * Renderiza las tarjetas de clientes de acuerdo con la Figura 7 y 8
   */
  function renderizarTarjetasClientes(clientes) {
    const contenedor = document.getElementById('lista-clientes-container');
    if (!contenedor) return;

    if (clientes.length === 0) {
      contenedor.innerHTML = `
        <div class="empty-clients-state">
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <p>No se encontraron clientes registrados con ese criterio de búsqueda.</p>
        </div>
      `;
      return;
    }

    let html = '';
    clientes.forEach(c => {
      // Iniciales para el avatar
      const n = (c.nombres || '').trim();
      const a = (c.apellidos || '').trim();
      const iniciales = ((n[0] || 'C') + (a[0] || '')).toUpperCase();
      const esFrecuente = (parseInt(c.total_eventos, 10) || 0) > 0;

      html += `
        <div class="client-card" data-id="${c.id_cliente}">
          <div class="client-card-top">
            <div class="client-avatar" aria-hidden="true">${iniciales}</div>
            
            <div class="client-main-info">
              <div class="client-name-row">
                <h3 class="client-fullname">${escapeHTML(c.nombres)} ${escapeHTML(c.apellidos)}</h3>
                <span class="badge-verified">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Verificado
                </span>
              </div>
              <div class="client-ci-row">
                <span>C.I. / RUC: <strong>${escapeHTML(c.cedula_ruc)}</strong></span>
              </div>
            </div>
          </div>

          <div class="client-contact-details">
            ${c.telefono ? `
              <div class="client-contact-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
                <a href="tel:${escapeHTML(c.telefono)}">${escapeHTML(c.telefono)}</a>
              </div>
            ` : ''}

            ${c.correo ? `
              <div class="client-contact-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
                <span>${escapeHTML(c.correo)}</span>
              </div>
            ` : ''}

            ${c.direccion ? `
              <div class="client-contact-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span>${escapeHTML(c.direccion)}</span>
              </div>
            ` : ''}
          </div>

          ${esFrecuente ? `
            <div class="client-frequent-badge">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
              <span>Cliente Frecuente (${c.total_eventos} evento${c.total_eventos > 1 ? 's' : ''} registrado${c.total_eventos > 1 ? 's' : ''})</span>
            </div>
          ` : ''}

          <!-- Botones de Acción -->
          <div class="client-card-actions">
            <button type="button" class="btn-action-quote" data-action="cotizar" data-id="${c.id_cliente}" title="Generar cotización para este cliente">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              <span>Cotizar</span>
            </button>

            <button type="button" class="btn-action-edit" data-action="editar" data-id="${c.id_cliente}" title="Editar información">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              <span>Editar</span>
            </button>

            <button type="button" class="btn-action-delete" data-action="eliminar" data-id="${c.id_cliente}" title="Eliminar cliente">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>

        </div>
      `;
    });

    contenedor.innerHTML = html;

    // Vincular acciones de las tarjetas
    contenedor.querySelectorAll('[data-action="editar"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        const cli = listaClientes.find(item => parseInt(item.id_cliente, 10) === id);
        if (cli) abrirModalCliente(cli);
      });
    });

    contenedor.querySelectorAll('[data-action="eliminar"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        confirmarEliminarCliente(id);
      });
    });

    contenedor.querySelectorAll('[data-action="cotizar"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        const cli = listaClientes.find(item => parseInt(item.id_cliente, 10) === id);
        if (cli && window.navegarAModulo) {
          // Pre-guardar cliente en el estado de cotización y navegar al cotizador
          window.clienteSeleccionadoParaCotizar = cli;
          window.navegarAModulo('view-cotizador', 'COTIZADOR INTELIGENTE');
        }
      });
    });
  }

  /**
   * Modal: Abrir para Crear o Editar
   */
  function abrirModalCliente(cliente = null) {
    clienteEnEdicion = cliente;
    const modal = document.getElementById('modal-cliente');
    const modalTitle = document.getElementById('modal-cliente-title');
    const alertBox = document.getElementById('modal-alert');
    const form = document.getElementById('form-cliente');

    if (!modal) return;
    if (alertBox) alertBox.style.display = 'none';
    if (form) form.reset();

    if (cliente) {
      modalTitle.textContent = 'Editar Cliente';
      document.getElementById('cliente-id').value = cliente.id_cliente;
      document.getElementById('cliente-cedula').value = cliente.cedula_ruc || '';
      document.getElementById('cliente-nombres').value = cliente.nombres || '';
      document.getElementById('cliente-apellidos').value = cliente.apellidos || '';
      document.getElementById('cliente-telefono').value = cliente.telefono || '';
      document.getElementById('cliente-correo').value = cliente.correo || '';
      document.getElementById('cliente-direccion').value = cliente.direccion || '';
    } else {
      modalTitle.textContent = 'Registrar Nuevo Cliente';
      document.getElementById('cliente-id').value = '';
    }

    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.getElementById('cliente-cedula').focus();
  }

  /**
   * Modal: Cerrar
   */
  function cerrarModalCliente() {
    const modal = document.getElementById('modal-cliente');
    if (modal) {
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden', 'true');
    }
    clienteEnEdicion = null;
  }

  /**
   * Guardar (Crear o Editar) Cliente
   */
  async function guardarCliente(e) {
    e.preventDefault();
    const alertBox = document.getElementById('modal-alert');
    const btnGuardar = document.getElementById('btn-guardar-cliente');

    const id = document.getElementById('cliente-id').value;
    const cedula = document.getElementById('cliente-cedula').value.trim();
    const nombres = document.getElementById('cliente-nombres').value.trim();
    const apellidos = document.getElementById('cliente-apellidos').value.trim();
    const telefono = document.getElementById('cliente-telefono').value.trim();
    const correo = document.getElementById('cliente-correo').value.trim();
    const direccion = document.getElementById('cliente-direccion').value.trim();

    if (!cedula || !nombres || !apellidos) {
      mostrarModalError('Por favor complete todos los campos obligatorios (*).');
      return;
    }

    if (cedula.length !== 10 && cedula.length !== 13) {
      mostrarModalError('La identificación debe tener 10 dígitos (Cédula) o 13 dígitos (RUC).');
      return;
    }

    const accion = id ? 'editar' : 'crear';
    const payload = {
      action: accion,
      id_cliente: id ? parseInt(id, 10) : undefined,
      cedula_ruc: cedula,
      nombres: nombres,
      apellidos: apellidos,
      telefono: telefono,
      correo: correo,
      direccion: direccion
    };

    btnGuardar.disabled = true;
    const originalText = btnGuardar.innerHTML;
    btnGuardar.innerHTML = '<span>Guardando...</span>';

    try {
      const res = await fetch('modules/clientes/clientes_api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        cerrarModalCliente();
        cargarClientes();
      } else {
        mostrarModalError(data.error || 'Ocurrió un error al procesar los datos.');
      }
    } catch (err) {
      console.error('Error al guardar cliente:', err);
      mostrarModalError('No se pudo establecer conexión con el servidor.');
    } finally {
      btnGuardar.disabled = false;
      btnGuardar.innerHTML = originalText;
    }
  }

  /**
   * Eliminar Cliente
   */
  async function confirmarEliminarCliente(id) {
    const cli = listaClientes.find(c => parseInt(c.id_cliente, 10) === id);
    const nombre = cli ? `${cli.nombres} ${cli.apellidos}` : 'este cliente';

    if (!confirm(`¿Está seguro de eliminar a "${nombre}" del sistema? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const res = await fetch('modules/clientes/clientes_api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'eliminar', id_cliente: id })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        cargarClientes();
      } else {
        alert(data.error || 'No se pudo eliminar el cliente.');
      }
    } catch (e) {
      console.error('Error al eliminar cliente:', e);
      alert('Error de conexión al intentar eliminar el cliente.');
    }
  }

  function mostrarModalError(msg) {
    const alertBox = document.getElementById('modal-alert');
    if (alertBox) {
      alertBox.textContent = msg;
      alertBox.style.display = 'block';
    }
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  // Escuchar cuando el enrutador active el módulo de clientes
  window.addEventListener('module-activated', (e) => {
    if (e.detail && e.detail.moduleId === 'view-clientes') {
      initClientesModule();
    }
  });

  // Si la vista inicial al cargar fuera view-clientes
  document.addEventListener('DOMContentLoaded', () => {
    const viewClientes = document.getElementById('view-clientes');
    if (viewClientes && viewClientes.classList.contains('active')) {
      initClientesModule();
    }
  });

  // Exportar utilidad para buscar cliente desde el Cotizador
  window.ClientesService = {
    buscarPorCedula: async (cedula) => {
      const res = await fetch(`modules/clientes/clientes_api.php?action=buscar_cedula&cedula_ruc=${encodeURIComponent(cedula)}`);
      return await res.json();
    }
  };

})();
