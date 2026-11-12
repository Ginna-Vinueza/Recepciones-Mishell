/**
 * Script Principal del Panel Administrativo (Shell & Enrutador)
 * Recepciones Mishell - Quito 2026
 * Skills aplicados: frontend-design + ui-ux-pro-max + senior-backend + senior-architect
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elementos de la interfaz
  const currentModuleTitle = document.getElementById('current-module-title');
  const navItems = document.querySelectorAll('.nav-item');
  const moduleViews = document.querySelectorAll('.module-view');

  // Menú y perfil de usuario
  const userAvatarBtn = document.getElementById('user-avatar-btn');
  const userDropdown = document.getElementById('user-dropdown');
  const btnLogout = document.getElementById('btn-logout');
  const btnNotifications = document.getElementById('btn-notifications');

  // Campos de información de usuario
  const userAvatarInitials = document.getElementById('user-avatar-initials');
  const dropdownAvatarInitials = document.getElementById('dropdown-avatar-initials');
  const dropdownUserName = document.getElementById('dropdown-user-name');
  const dropdownUserRole = document.getElementById('dropdown-user-role');
  const dropdownUserEmail = document.getElementById('dropdown-user-email');

  // Objeto global de estado de la aplicación
  window.AppRecepciones = {
    currentUser: null,
    activeModule: 'view-calendario'
  };

  /**
   * 1. Verificación de Seguridad y Sesión Activa (RNF04)
   */
  async function verificarSesion() {
    try {
      const response = await fetch('config-backend/auth_check.php', {
        headers: { 'Accept': 'application/json' }
      });
      const data = await response.json();

      if (!response.ok || !data.authenticated) {
        // Redirigir a login si no está autenticado
        window.location.href = 'login.html';
        return;
      }

      // Guardar usuario en el estado
      window.AppRecepciones.currentUser = data.usuario;

      // Actualizar información visual del perfil
      const nombre = data.usuario.nombre_completo || 'Admin';
      const rol = data.usuario.rol === 'Administrador' ? 'Super Administrador' : 'Administrador de Sala';
      const email = data.usuario.correo || '';

      // Generar iniciales (ej: 'AD' para Admin, 'EC' para Elvia Casagallo)
      const partes = nombre.split(' ');
      let iniciales = 'AD';
      if (partes.length >= 2) {
        iniciales = (partes[0][0] + partes[1][0]).toUpperCase();
      } else if (partes.length === 1 && partes[0].length >= 2) {
        iniciales = partes[0].substring(0, 2).toUpperCase();
      }

      if (userAvatarInitials) userAvatarInitials.textContent = iniciales;
      if (dropdownAvatarInitials) dropdownAvatarInitials.textContent = iniciales;
      if (dropdownUserName) dropdownUserName.textContent = nombre;
      if (dropdownUserRole) dropdownUserRole.textContent = rol;
      if (dropdownUserEmail) dropdownUserEmail.textContent = email;

      // Disparar evento de sesión lista
      window.dispatchEvent(new CustomEvent('session-ready', { detail: data.usuario }));

    } catch (error) {
      console.error('Error al validar la sesión:', error);
      window.location.href = 'login.html';
    }
  }

  verificarSesion();

  /**
   * 2. Toggle del Menú Desplegable de Usuario
   */
  if (userAvatarBtn && userDropdown) {
    userAvatarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle('show');
    });

    // Cerrar menú al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (!userDropdown.contains(e.target) && !userAvatarBtn.contains(e.target)) {
        userDropdown.classList.remove('show');
      }
    });
  }

  /**
   * 3. Cierre de Sesión (Logout)
   */
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      try {
        const response = await fetch('config-backend/logout_api.php', { method: 'POST' });
        const data = await response.json();
        window.location.href = data.redirect || 'login.html';
      } catch (err) {
        console.error('Error al cerrar sesión:', err);
        window.location.href = 'login.html';
      }
    });
  }

  /**
   * 4. Enrutador de Módulos (Navegación sin recarga)
   */
  function cambiarModulo(targetViewId, moduleTitle) {
    // 1. Actualizar estado de los tabs
    navItems.forEach(item => {
      if (item.getAttribute('data-target') === targetViewId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // 2. Mostrar la vista seleccionada y ocultar las demás
    moduleViews.forEach(view => {
      if (view.id === targetViewId) {
        view.classList.add('active');
      } else {
        view.classList.remove('active');
      }
    });

    // 3. Actualizar título en la cabecera
    if (currentModuleTitle && moduleTitle) {
      currentModuleTitle.textContent = moduleTitle;
    }

    // 4. Actualizar estado y emitir evento para que el módulo cargue sus datos
    window.AppRecepciones.activeModule = targetViewId;
    window.dispatchEvent(new CustomEvent('module-activated', {
      detail: {
        moduleId: targetViewId,
        title: moduleTitle
      }
    }));

    // Scroll hacia el inicio del contenido
    const mainContent = document.getElementById('main-content');
    if (mainContent) mainContent.scrollTop = 0;
  }

  // Event Listeners en la barra de navegación inferior
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.getAttribute('data-target');
      const title = item.getAttribute('data-title');
      if (target) {
        cambiarModulo(target, title);
      }
    });
  });

  // Exponer la función de cambio de módulo globalmente (para enlazar botones internos como "Ir a Cotizar")
  window.navegarAModulo = (targetViewId, moduleTitle) => {
    cambiarModulo(targetViewId, moduleTitle);
  };

  // Soporte de enlace directo mediante hash (ej. #calendario, #cotizar, #clientes, #reportes)
  function sincronizarRutaPorHash() {
    const h = window.location.hash;
    if (h === '#cotizar' || h === '#view-cotizador') {
      cambiarModulo('view-cotizador', 'COTIZADOR INTELIGENTE');
    } else if (h === '#calendario' || h === '#view-calendario') {
      cambiarModulo('view-calendario', 'CALENDARIO');
    } else if (h === '#clientes' || h === '#view-clientes') {
      cambiarModulo('view-clientes', 'CLIENTES');
    } else if (h === '#reportes' || h === '#view-reportes') {
      cambiarModulo('view-reportes', 'REPORTES Y MÉTRICAS (RF07)');
    }
  }
  sincronizarRutaPorHash();
  window.addEventListener('hashchange', sincronizarRutaPorHash);

  /**
   * 5. Botón de Notificaciones
   */
  if (btnNotifications) {
    btnNotifications.addEventListener('click', () => {
      alert('Sistema Recepciones Mishell: Todos los servicios y bases de datos locales están sincronizados.');
    });
  }
});
