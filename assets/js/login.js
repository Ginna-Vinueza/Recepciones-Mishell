/**
 * Lógica Cliente del Módulo de Autenticación
 * Recepciones Mishell - Quito 2026
 * Skills aplicados: frontend-design + ui-ux-pro-max + senior-backend
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elementos del DOM
  const form = document.getElementById('login-form');
  const inputIdentificador = document.getElementById('identificador');
  const inputPassword = document.getElementById('password');
  const btnTogglePass = document.getElementById('toggle-password');
  const iconEye = document.getElementById('icon-eye');
  const btnSubmit = document.getElementById('btn-submit');
  const btnSubmitText = document.getElementById('btn-submit-text');
  const alertBox = document.getElementById('login-alert');
  const alertText = document.getElementById('login-alert-text');

  // Tabs de Perfil
  const tabAdmin = document.getElementById('tab-admin');
  const tabRecepcion = document.getElementById('tab-recepcion');
  const roleInfoTitle = document.getElementById('role-info-title');
  const roleInfoDesc = document.getElementById('role-info-desc');

  // Tarjetas Demo
  const demoAdmin = document.getElementById('demo-user-admin');
  const demoRecepcion = document.getElementById('demo-user-recepcion');

  // Credenciales demo para autocompletar en un clic
  const CREDENCIALES_DEMO = {
    admin: {
      identificador: 'admin@recepcionesmishell.ec',
      password: 'Admin2026*',
      tabTitle: 'Perfil Administrador',
      tabDesc: 'Gestión financiera, contratos nupciales, cotizaciones y control total.',
      buttonText: 'Iniciar Sesión como Administrador'
    },
    recepcion: {
      identificador: 'elvia@recepcionesmishell.ec',
      password: 'Elvia2026*',
      tabTitle: 'Perfil Administrador de Sala',
      tabDesc: 'Atención a novios y quinceañeras, reservas de calendario y cotizaciones.',
      buttonText: 'Iniciar Sesión como Sala / Recepción'
    }
  };

  /**
   * Verifica si ya existe una sesión activa y redirige automáticamente
   */
  async function checkActiveSession() {
    try {
      const response = await fetch('config-backend/auth_check.php');
      if (response.ok) {
        const data = await response.json();
        if (data.authenticated) {
          window.location.href = 'index.html';
        }
      }
    } catch (e) {
      // Si falla la verificación, continuar en la pantalla de login
      console.log('Sin sesión previa.');
    }
  }
  checkActiveSession();

  /**
   * Muestra mensaje de alerta (error o éxito)
   */
  function showAlert(message, type = 'error') {
    alertBox.className = `alert-feedback alert-${type}`;
    alertText.textContent = message;
    alertBox.style.display = 'flex';
  }

  /**
   * Oculta mensaje de alerta
   */
  function hideAlert() {
    alertBox.style.display = 'none';
  }

  /**
   * Activa el modo Administrador
   */
  function setRoleAdmin() {
    tabAdmin.classList.add('active');
    tabAdmin.setAttribute('aria-selected', 'true');
    tabRecepcion.classList.remove('active');
    tabRecepcion.setAttribute('aria-selected', 'false');

    roleInfoTitle.textContent = CREDENCIALES_DEMO.admin.tabTitle;
    roleInfoDesc.textContent = CREDENCIALES_DEMO.admin.tabDesc;
    btnSubmitText.textContent = CREDENCIALES_DEMO.admin.buttonText;

    inputIdentificador.value = CREDENCIALES_DEMO.admin.identificador;
    inputPassword.value = CREDENCIALES_DEMO.admin.password;
    hideAlert();
  }

  /**
   * Activa el modo Sala / Recepción (Elvia Casagallo)
   */
  function setRoleRecepcion() {
    tabRecepcion.classList.add('active');
    tabRecepcion.setAttribute('aria-selected', 'true');
    tabAdmin.classList.remove('active');
    tabAdmin.setAttribute('aria-selected', 'false');

    roleInfoTitle.textContent = CREDENCIALES_DEMO.recepcion.tabTitle;
    roleInfoDesc.textContent = CREDENCIALES_DEMO.recepcion.tabDesc;
    btnSubmitText.textContent = CREDENCIALES_DEMO.recepcion.buttonText;

    inputIdentificador.value = CREDENCIALES_DEMO.recepcion.identificador;
    inputPassword.value = CREDENCIALES_DEMO.recepcion.password;
    hideAlert();
  }

  // Event Listeners de Tabs
  if (tabAdmin) tabAdmin.addEventListener('click', setRoleAdmin);
  if (tabRecepcion) tabRecepcion.addEventListener('click', setRoleRecepcion);

  // Event Listeners de Modo Demo (click en tarjetas)
  if (demoAdmin) {
    demoAdmin.addEventListener('click', () => {
      setRoleAdmin();
      inputPassword.focus();
    });
    demoAdmin.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setRoleAdmin();
      }
    });
  }

  if (demoRecepcion) {
    demoRecepcion.addEventListener('click', () => {
      setRoleRecepcion();
      inputPassword.focus();
    });
    demoRecepcion.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setRoleRecepcion();
      }
    });
  }

  /**
   * Alternar visibilidad de contraseña
   */
  if (btnTogglePass) {
    btnTogglePass.addEventListener('click', () => {
      const isPassword = inputPassword.type === 'password';
      inputPassword.type = isPassword ? 'text' : 'password';

      // Actualizar icono SVG
      if (isPassword) {
        // Icono Ojo tachado (ocultar)
        iconEye.innerHTML = `
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        `;
      } else {
        // Icono Ojo abierto (mostrar)
        iconEye.innerHTML = `
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        `;
      }
    });
  }

  /**
   * Procesar formulario con Fetch API
   */
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();

      const identificador = inputIdentificador.value.trim();
      const password = inputPassword.value;

      if (!identificador || !password) {
        showAlert('Por favor complete todos los campos requeridos.');
        return;
      }

      // Estado de carga en el botón (UI/UX Pro Max)
      btnSubmit.disabled = true;
      const originalText = btnSubmitText.textContent;
      btnSubmitText.innerHTML = '<span class="spinner" aria-hidden="true"></span> Validando acceso...';

      try {
        const response = await fetch('config-backend/login_api.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            usuario: identificador,
            password: password
          })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          showAlert('Acceso correcto. Redirigiendo al panel...', 'success');
          setTimeout(() => {
            window.location.href = data.redirect || 'index.html';
          }, 600);
        } else {
          showAlert(data.error || 'Credenciales incorrectas. Verifique sus datos.');
          btnSubmit.disabled = false;
          btnSubmitText.textContent = originalText;
        }
      } catch (err) {
        console.error('Error de conexión:', err);
        showAlert('No se pudo conectar con el servidor local. Verifique que Apache y MySQL estén activos.');
        btnSubmit.disabled = false;
        btnSubmitText.textContent = originalText;
      }
    });
  }

  // Enlace "¿Olvidaste tu contraseña?"
  const linkForgot = document.getElementById('link-forgot-pass');
  if (linkForgot) {
    linkForgot.addEventListener('click', (e) => {
      e.preventDefault();
      showAlert('Por políticas de seguridad interna, contacte al Super Administrador para restablecer su clave.', 'error');
    });
  }
});
