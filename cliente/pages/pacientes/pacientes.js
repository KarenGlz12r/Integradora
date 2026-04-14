import { supabase } from "../../../auth.js";

/* ══════════════════════════════════════════════════════════════
   CONFIGURACIÓN DE SUPABASE STORAGE
   
   STORAGE_URL: URL base para construir URLs públicas de imágenes
   almacenadas en Supabase Storage.
   
   Si url_foto en la tabla usuario es solo un nombre de archivo
   (ej: "9a9ecd4b-...jpeg"), se construye la URL completa así:
   https://<project>.supabase.co/storage/v1/object/public/<bucket>/<filename>
   
   ⚠️ CAMBIA 'avatares' por el nombre real de tu bucket en Supabase.
══════════════════════════════════════════════════════════════ */
const SUPABASE_PROJECT_URL = 'https://qhrennyqjhngysortocu.supabase.co';
const STORAGE_BUCKET       = 'avatares'; // ← nombre real de tu bucket

/**
 * Construye la URL pública de una foto desde Supabase Storage.
 * Si el valor ya es una URL completa (http/https), la devuelve tal cual.
 * Si es solo un nombre de archivo, construye la URL pública del bucket.
 * Si es null/undefined, devuelve null.
 *
 * @param {string|null} valor - URL completa o nombre de archivo
 * @returns {string|null}
 */
function buildFotoUrl(valor) {
    if (!valor) return null;
    if (valor.startsWith('http://') || valor.startsWith('https://')) return valor;
    return `${SUPABASE_PROJECT_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${valor}`;
}

/**
 * Genera el HTML de un avatar circular.
 * Si hay foto, muestra <img>. Si no, muestra iniciales con color de fondo.
 * 
 * @param {string|null} fotoUrl  - URL completa de la foto (ya procesada)
 * @param {string}      nombre   - Nombre del paciente (para alt e iniciales)
 * @param {string}      cssClass - Clase CSS adicional para el contenedor
 * @returns {string} HTML del avatar
 */
function buildAvatarHTML(fotoUrl, nombre, cssClass = '') {
    const iniciales = getIniciales(nombre);
    if (fotoUrl) {
        return `
            <div class="paciente-avatar ${cssClass}">
                <img 
                    src="${fotoUrl}" 
                    alt="${nombre}"
                    onerror="this.parentElement.innerHTML='${iniciales}'; this.parentElement.style.background='var(--color-primary-lt)'; this.parentElement.style.color='var(--color-primary)';"
                >
            </div>`;
    }
    return `<div class="paciente-avatar ${cssClass}">${iniciales}</div>`;
}


/* ══════════════════════════════════════════════════════════════
   ESTADO GLOBAL DEL MÓDULO
   
   Variables compartidas entre las distintas funciones del módulo.
   Se inicializan en null y se van llenando conforme el usuario
   navega por la pantalla.
══════════════════════════════════════════════════════════════ */
let _fisioId           = null;  // ID interno del fisio (tabla fisioterapeutas)
let _fisioUserId       = null;  // ID de auth.users del fisio
let _pacienteActual    = null;  // Objeto completo del paciente seleccionado
let _citaIdNota        = null;  // ID de la cita de la nota en edición/creación
let _notaEditandoId    = null;  // ID de la nota en edición (null = nueva nota)
let _todosLosPacientes = [];    // Cache de pacientes para el buscador


/* ══════════════════════════════════════════════════════════════
   HELPER: obtener IDs del fisio logueado
   
   Consulta auth.users y la tabla fisioterapeutas para obtener
   el ID interno del fisio y el ID de autenticación.
   Guarda ambos en las variables globales _fisioId y _fisioUserId.
══════════════════════════════════════════════════════════════ */
async function getFisioData() {
    // Obtener usuario autenticado de Supabase Auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Buscar el registro del fisioterapeuta usando el user_id de auth
    const { data: fisio } = await supabase
        .from('fisioterapeutas')
        .select('id')
        .eq('user_id', user.id)
        .single();

    if (!fisio) return null;

    // Guardar ambos IDs globalmente para uso en el resto del módulo
    _fisioId     = fisio.id;
    _fisioUserId = user.id;
    return fisio.id;
}


/* ══════════════════════════════════════════════════════════════
   HELPER: iniciales del nombre para el avatar
   
   Toma hasta las primeras 2 palabras del nombre y extrae
   la primera letra de cada una en mayúscula.
   Ejemplo: "Karen Alejandra López" → "KA"
══════════════════════════════════════════════════════════════ */
function getIniciales(nombre = '') {
    return nombre.trim().split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(p => p[0].toUpperCase())
        .join('');
}


/* ══════════════════════════════════════════════════════════════
   HELPER: formatear fecha legible
   
   formatFecha: devuelve "12 abr 2025" a partir de "2025-04-12"
   formatFechaCorta: devuelve { dia: 12, mes: 'abr' } para la
   tarjeta de cita en el timeline.
══════════════════════════════════════════════════════════════ */
function formatFecha(fechaStr) {
    if (!fechaStr) return '—';
    // Se agrega T00:00:00 para evitar que el timezone desplace el día
    return new Date(fechaStr + 'T00:00:00').toLocaleDateString('es-MX', {
        day: 'numeric', month: 'short', year: 'numeric'
    });
}

function formatFechaCorta(fechaStr) {
    if (!fechaStr) return { dia: '—', mes: '' };
    const d = new Date(fechaStr + 'T00:00:00');
    return {
        dia: d.getDate(),
        mes: d.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')
    };
}


/* ══════════════════════════════════════════════════════════════
   TOAST — Notificaciones temporales
   
   Crea un div con el mensaje, lo agrega al contenedor de toasts
   y lo elimina automáticamente después de 3.5 segundos.
   
   @param {string} msg  - Texto del mensaje
   @param {string} tipo - 'success' | 'warning' | 'danger' | 'info'
══════════════════════════════════════════════════════════════ */
function toast(msg, tipo = 'success') {
    const container = document.getElementById('toastContainer');
    const icons = {
        success: 'check-circle-fill',
        warning: 'exclamation-triangle-fill',
        danger:  'x-circle-fill',
        info:    'info-circle-fill'
    };
    const el = document.createElement('div');
    el.className = `toast-msg toast-${tipo}`;
    el.innerHTML = `<i class="bi bi-${icons[tipo] || 'info-circle-fill'}"></i> ${msg}`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3500);
}


/* ══════════════════════════════════════════════════════════════
   ESTADÍSTICAS — TARJETAS SUPERIORES
   
   Carga 4 métricas del dashboard del fisio:
   1. Total de pacientes únicos con citas confirmadas y pago
   2. Pacientes nuevos en el mes actual
   3. Citas pendientes de pago (sin registro en tabla pagos)
   4. Próxima cita programada (o última si no hay futuras)
══════════════════════════════════════════════════════════════ */
async function cargarEstadisticas(fisioId) {

    // ── 1. Pacientes confirmados (tienen cita confirmada + pago) ──────────
    const { data: pagos } = await supabase.from('pagos').select('cita_id');
    const citasConPago = pagos?.map(p => p.cita_id) || [];

    const { data: citasConf } = await supabase
        .from('citas')
        .select('usuario_id')
        .eq('fisioterapeuta_id', fisioId)
        .eq('estado', 'confirmada')
        .in('id', citasConPago.length ? citasConPago : ['_none_']);

    // Usamos un Set para contar pacientes únicos (un paciente puede tener varias citas)
    const card1 = document.getElementById('card-pacientes-confirmados');
    const unicos = new Set(citasConf?.map(c => c.usuario_id));
    card1.querySelector('.card-stat-numero').textContent = unicos.size;
    card1.querySelector('.card-stat-label').textContent  = 'Pacientes confirmados';

    // ── 2. Pacientes nuevos este mes ──────────────────────────────────────
    const ahora     = new Date();
    const primerDia = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-01`;
    const ultimoDia = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0)
        .toISOString().split('T')[0];

    const { data: citasMes } = await supabase
        .from('citas').select('usuario_id')
        .eq('fisioterapeuta_id', fisioId)
        .gte('fecha', primerDia)
        .lte('fecha', ultimoDia);

    document.getElementById('card-nuevos-mes')
        .querySelector('.card-stat-numero').textContent =
        new Set(citasMes?.map(c => c.usuario_id)).size;

    // ── 3. Citas pendientes de pago ───────────────────────────────────────
    // Traemos las citas en estado 'pendiente_pago' y verificamos cuáles
    // ya tienen un pago procesado en la tabla pagos.
    const { data: citasPend } = await supabase
        .from('citas').select('id')
        .eq('fisioterapeuta_id', fisioId)
        .eq('estado', 'pendiente_pago');

    let pendientes = 0;
    if (citasPend?.length) {
        const ids = citasPend.map(c => c.id);
        const { data: pagosComp } = await supabase
            .from('pagos').select('cita_id')
            .in('cita_id', ids)
            .eq('estado_pago', 'procesado');
        const pagadas = new Set(pagosComp?.map(p => p.cita_id) || []);
        // Las pendientes son las que NO tienen pago procesado
        pendientes = ids.filter(id => !pagadas.has(id)).length;
    }
    document.getElementById('card-pendientes-pago')
        .querySelector('.card-stat-numero').textContent = pendientes;

    // ── 4. Próxima cita ───────────────────────────────────────────────────
    // Busca la siguiente cita futura. Si no hay, muestra la última pasada.
    const hoy = new Date().toISOString().split('T')[0];
    let { data: proximas } = await supabase
        .from('citas').select('fecha, hora_inicio, motivo')
        .eq('fisioterapeuta_id', fisioId)
        .gte('fecha', hoy)
        .order('fecha', { ascending: true })
        .order('hora_inicio', { ascending: true })
        .limit(1);

    if (!proximas?.length) {
        const { data: pasadas } = await supabase
            .from('citas').select('fecha, hora_inicio, motivo')
            .eq('fisioterapeuta_id', fisioId)
            .lt('fecha', hoy)
            .order('fecha', { ascending: false })
            .limit(1);
        proximas = pasadas;
    }

    const cardP = document.getElementById('card-proxima-cita');
    if (proximas?.length) {
        const c = proximas[0];
        cardP.querySelector('.card-stat-numero').textContent =
            new Date(c.fecha + 'T00:00:00').toLocaleDateString('es-MX', {
                day: 'numeric', month: 'short'
            });
        cardP.querySelector('.card-stat-label').textContent =
            `${c.fecha < hoy ? 'Última' : 'Próxima'} · ${c.hora_inicio} · ${c.motivo}`;
    } else {
        cardP.querySelector('.card-stat-numero').textContent = '—';
        cardP.querySelector('.card-stat-label').textContent  = 'Sin citas registradas';
    }
}


/* ══════════════════════════════════════════════════════════════
   LISTA LATERAL DE PACIENTES
   
   Trae todas las citas del fisio con join a la tabla usuario.
   Deduplica por paciente (nos quedamos con la cita más reciente).
   Guarda el resultado en _todosLosPacientes para el buscador.
   
   La foto (url_foto) se pasa por buildFotoUrl() para asegurar
   que sea siempre una URL completa antes de renderizar.
══════════════════════════════════════════════════════════════ */
async function cargarListaPacientes(fisioId) {

    // Join con tabla usuario para obtener datos y foto del paciente
    const { data: citas, error } = await supabase
        .from('citas')
        .select(`
            id,
            fecha,
            hora_inicio,
            estado,
            motivo,
            usuario:usuario_id (
                id_us,
                us_nom,
                us_correo,
                us_telefono,
                url_foto
            )
        `)
        .eq('fisioterapeuta_id', fisioId)
        .order('fecha', { ascending: false });

    if (error) {
        console.error('Error cargando pacientes:', error);
        return;
    }

    // Deduplicar: si un paciente tiene varias citas, conservamos
    // solo la primera que aparece (la más reciente por el order)
    const vistos = new Map();
    (citas || []).forEach(c => {
        if (!c.usuario?.id_us) return;
        if (!vistos.has(c.usuario.id_us)) {
            vistos.set(c.usuario.id_us, c);
        }
    });

    _todosLosPacientes = Array.from(vistos.values());
    renderListaPacientes(_todosLosPacientes);
}


/* ══════════════════════════════════════════════════════════════
   RENDERIZAR LISTA DE PACIENTES EN EL SIDEBAR
   
   Genera el HTML de cada ítem de paciente y lo inserta en el DOM.
   
   ✅ FIX FOTO: url_foto pasa por buildFotoUrl() antes de usarse
   en el <img>, así funciona tanto si es URL completa como si es
   solo nombre de archivo del bucket de Supabase Storage.
══════════════════════════════════════════════════════════════ */
function renderListaPacientes(lista) {
    const container = document.getElementById('listaPacientes');

    if (!lista.length) {
        container.innerHTML = `
            <div class="pacientes-empty">
                <i class="bi bi-person-slash"></i>
                <p>No tienes pacientes registrados aún.</p>
            </div>`;
        return;
    }

    container.innerHTML = lista.map(c => {
        const nom       = c.usuario?.us_nom || 'Sin nombre';
        const iniciales = getIniciales(nom);

        // ✅ Construir URL completa de la foto antes de renderizar
        const fotoUrl   = buildFotoUrl(c.usuario?.url_foto);

        // Badge de estado de la cita más reciente
        const badgeClass = c.estado === 'confirmada' ? 'badge-confirmada'
                         : c.estado === 'cancelada'  ? 'badge-cancelada'
                         : 'badge-pendiente';
        const badgeTxt = c.estado?.replace('_', ' ') || '—';

        return `
        <div class="paciente-item" data-id="${c.usuario?.id_us}" data-cita-id="${c.id}">

            <!-- Avatar: foto si existe, iniciales si no -->
            <div class="paciente-avatar">
                ${fotoUrl
                    ? `<img 
                            src="${fotoUrl}" 
                            alt="${nom}"
                            onerror="
                                this.parentElement.textContent='${iniciales}';
                                this.parentElement.removeAttribute('style');
                            "
                       >`
                    : iniciales
                }
            </div>

            <!-- Nombre y fecha de última cita -->
            <div class="paciente-item-info">
                <div class="paciente-item-nombre">${nom}</div>
                <div class="paciente-item-meta">
                    <i class="bi bi-calendar3" style="font-size:10px;"></i>
                    ${formatFecha(c.fecha)}
                </div>
            </div>

            <!-- Badge del estado de la cita -->
            <span class="paciente-item-badge ${badgeClass}">${badgeTxt}</span>
        </div>`;
    }).join('');

    // ── Eventos de clic en cada ítem ──────────────────────────────────────
    // Al hacer clic, se marca como activo y se abre el detalle del paciente
    container.querySelectorAll('.paciente-item').forEach(item => {
        item.addEventListener('click', () => {
            // Quitar activo de todos y activar el clickeado
            container.querySelectorAll('.paciente-item')
                .forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            // Encontrar la cita correspondiente al paciente clickeado
            const pacienteUserId = item.dataset.id;
            const cita = lista.find(c => c.usuario?.id_us === pacienteUserId);
            abrirDetallePaciente(cita);
        });
    });
}


/* ══════════════════════════════════════════════════════════════
   BUSCADOR DE PACIENTES
   
   Filtra la lista en tiempo real por nombre o correo del paciente.
   Usa el cache _todosLosPacientes para no hacer nuevas peticiones.
══════════════════════════════════════════════════════════════ */
document.getElementById('buscarPaciente').addEventListener('input', e => {
    const q = e.target.value.toLowerCase().trim();

    // Sin texto: mostrar todos
    if (!q) {
        renderListaPacientes(_todosLosPacientes);
        return;
    }

    // Filtrar por nombre o correo
    const filtrados = _todosLosPacientes.filter(c =>
        (c.usuario?.us_nom    || '').toLowerCase().includes(q) ||
        (c.usuario?.us_correo || '').toLowerCase().includes(q)
    );
    renderListaPacientes(filtrados);
});


/* ══════════════════════════════════════════════════════════════
   ABRIR DETALLE DE PACIENTE
   
   Muestra el panel derecho con toda la información del paciente
   seleccionado: datos de contacto, citas, historial y notas.
   
   ✅ FIX FOTO: url_foto pasa por buildFotoUrl() antes de usarse
   en el header del detalle y en las burbujas del chat.
   
   @param {object} cita - Objeto de cita con join a usuario
══════════════════════════════════════════════════════════════ */
async function abrirDetallePaciente(cita) {
    if (!cita?.usuario) return;

    // Guardar referencia global al paciente actual
    _pacienteActual = cita.usuario;

    // Mostrar panel de detalle (ocultar el placeholder vacío)
    document.getElementById('detailPlaceholder').style.display = 'none';
    const dc = document.getElementById('detailContent');
    dc.style.display = 'flex';

    // En móvil, agregar clase .show para que el panel deslice
    document.getElementById('panelDetalle').classList.add('show');

    // ── Header: avatar, nombre, contacto ──────────────────────────────────
    const nom       = cita.usuario.us_nom || 'Sin nombre';
    const iniciales = getIniciales(nom);

    // ✅ Construir URL completa de la foto del paciente
    const fotoUrl   = buildFotoUrl(cita.usuario.url_foto);

    const avatarEl  = document.getElementById('detailAvatar');
    avatarEl.innerHTML = '';

    if (fotoUrl) {
        // Foto disponible: insertar <img> con fallback a iniciales en onerror
        const img     = document.createElement('img');
        img.src       = fotoUrl;
        img.alt       = nom;
        img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;';
        img.onerror   = () => {
            // Si la imagen falla (URL rota, CORS, etc.), mostrar iniciales
            avatarEl.innerHTML        = iniciales;
            avatarEl.style.background = 'var(--color-primary-lt)';
            avatarEl.style.color      = 'var(--color-primary)';
        };
        avatarEl.appendChild(img);
        avatarEl.style.background = 'transparent';
    } else {
        // Sin foto: mostrar iniciales
        avatarEl.textContent      = iniciales;
        avatarEl.style.background = 'var(--color-primary-lt)';
        avatarEl.style.color      = 'var(--color-primary)';
    }

    document.getElementById('detailNombre').textContent = nom;
    document.getElementById('detailMeta').innerHTML = `
        ${cita.usuario.us_correo
            ? `<span><i class="bi bi-envelope"></i>${cita.usuario.us_correo}</span>`
            : ''}
        ${cita.usuario.us_telefono
            ? `<span><i class="bi bi-telephone"></i>${cita.usuario.us_telefono}</span>`
            : ''}
    `;

    // ── Botones del header ────────────────────────────────────────────────

    // Botón "Mensaje": redirige al chat con este paciente
    document.getElementById('btnMensaje').onclick = () => {
        if (!_pacienteActual?.id_us || _pacienteActual.id_us === 'undefined') {
            toast('Este paciente no tiene cuenta activa.', 'warning');
            return;
        }
        // Guardamos el ID en sessionStorage para que chat.html lo tome al cargar
        sessionStorage.setItem('chatPacienteId', _pacienteActual.id_us);
        sessionStorage.setItem('chatPacienteNombre', nom);
        window.location.href = '../Chat/chat.html';
    };

    // Botón "Asignar rutina": abre el modal de selección de rutina
    document.getElementById('btnAsignarRutina').onclick = () => {
        if (!_pacienteActual?.id_us) {
            toast('Sin cuenta activa.', 'warning');
            return;
        }
        abrirModalAsignarRutina(_pacienteActual.id_us, nom);
    };

    // Botón "Nueva nota" en el header
    document.getElementById('btnNuevaNotaHeader').onclick = () => abrirModalNota(null);

    // Resetear al tab de citas cada vez que se abre un paciente
    activarTab('citas');

    // Cargar los tres tabs en paralelo para mayor velocidad
    await Promise.all([
        cargarCitasPaciente(cita.usuario.id_us),
        cargarHistorialClinico(cita.usuario.id_us),
        cargarNotasEvolucion(cita.usuario.id_us)
    ]);
}


/* ══════════════════════════════════════════════════════════════
   TABS DEL PANEL DE DETALLE
   
   Tres tabs: 'citas' | 'historial' | 'notas'
   Activa el tab clickeado y muestra su panel correspondiente.
══════════════════════════════════════════════════════════════ */
function activarTab(nombre) {
    // Activar/desactivar botones de tab
    document.querySelectorAll('.detail-tab').forEach(t =>
        t.classList.toggle('active', t.dataset.tab === nombre)
    );
    // Mostrar/ocultar paneles de contenido
    document.querySelectorAll('.tab-panel').forEach(p =>
        p.classList.toggle('active', p.id === `tab-${nombre}`)
    );
}

document.querySelectorAll('.detail-tab').forEach(tab => {
    tab.addEventListener('click', () => activarTab(tab.dataset.tab));
});


/* ══════════════════════════════════════════════════════════════
   TAB 1: HISTORIAL DE CITAS DEL PACIENTE
   
   Muestra todas las citas de este paciente con este fisio.
   Para cada cita indica si ya tiene nota de evolución o no,
   y ofrece el botón para crear/editar la nota.
══════════════════════════════════════════════════════════════ */
async function cargarCitasPaciente(pacienteUserId) {
    const container = document.getElementById('citasTimeline');
    container.innerHTML = `<div style="color:var(--color-gray);font-size:13px;padding:10px;">Cargando…</div>`;

    // Traer todas las citas de este paciente con este fisio
    const { data: citas, error } = await supabase
        .from('citas')
        .select('id, fecha, hora_inicio, hora_fin, estado, motivo')
        .eq('fisioterapeuta_id', _fisioId)
        .eq('usuario_id', pacienteUserId)
        .order('fecha', { ascending: false });

    if (error || !citas?.length) {
        container.innerHTML = `
            <div class="pacientes-empty">
                <i class="bi bi-calendar-x"></i>
                <p>No hay citas registradas con este paciente.</p>
            </div>`;
        return;
    }

    // Verificar cuáles citas ya tienen nota de evolución guardada
    const idsCitas = citas.map(c => c.id);
    const { data: notasExistentes } = await supabase
        .from('notas_evolucion')
        .select('cita_id')
        .in('cita_id', idsCitas);

    // Set para O(1) de búsqueda: "¿esta cita tiene nota?"
    const citasConNota = new Set(notasExistentes?.map(n => n.cita_id) || []);

    container.innerHTML = citas.map(c => {
        const { dia, mes } = formatFechaCorta(c.fecha);
        const tieneNota    = citasConNota.has(c.id);
        const estadoClass  = `estado-${c.estado || 'pendiente'}`;
        const estadoTxt    = (c.estado || 'pendiente').replace('_', ' ');

        return `
        <div class="cita-card">

            <!-- Columna izquierda: día y mes -->
            <div class="cita-card-fecha">
                <span class="cita-dia">${dia}</span>
                <span class="cita-mes">${mes}</span>
            </div>

            <!-- Columna derecha: info de la cita + botón de nota -->
            <div class="cita-card-info">
                <div class="cita-card-top">
                    <span class="cita-card-motivo">${c.motivo || 'Sin motivo'}</span>
                    <span class="cita-card-hora">
                        <i class="bi bi-clock"></i> ${c.hora_inicio || '—'}
                    </span>
                </div>
                <span class="cita-card-estado ${estadoClass}">${estadoTxt}</span>
                <br>

                <!-- Botón nota: cambia de texto/icono según si ya existe la nota -->
                <button 
                    class="cita-nota-btn ${tieneNota ? '' : 'sin-nota'}"
                    data-cita-id="${c.id}" 
                    data-tiene-nota="${tieneNota}">
                    <i class="bi bi-journal-${tieneNota ? 'text' : 'plus'}"></i>
                    ${tieneNota ? 'Ver / editar nota' : 'Agregar nota de evolución'}
                </button>
            </div>
        </div>`;
    }).join('');

    // Eventos de los botones de nota en cada tarjeta de cita
    container.querySelectorAll('.cita-nota-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const citaId    = btn.dataset.citaId;
            const tieneNota = btn.dataset.tieneNota === 'true';
            abrirModalNota(citaId, tieneNota);
        });
    });
}


/* ══════════════════════════════════════════════════════════════
   TAB 2: HISTORIAL CLÍNICO
   
   El paciente llena su historial clínico desde la app móvil.
   El fisio solo puede leerlo, no editarlo.
   Si no existe, muestra un mensaje indicando que está pendiente.
══════════════════════════════════════════════════════════════ */
async function cargarHistorialClinico(pacienteUserId) {
    const container = document.getElementById('hcContent');
    container.innerHTML = `<div style="color:var(--color-gray);font-size:13px;padding:10px;">Cargando…</div>`;

    const { data: hc, error } = await supabase
        .from('historia_clinica')
        .select('*')
        .eq('paciente_id', pacienteUserId)
        .single();

    if (error || !hc) {
        container.innerHTML = `
            <div class="hc-empty">
                <i class="bi bi-clipboard2-x"></i>
                <p>El paciente aún no ha llenado su historial clínico.</p>
            </div>`;
        return;
    }

    // Helper: renderiza un valor del historial con manejo de vacíos y booleanos
    const val = (v) => {
        if (v === null || v === undefined || v === '')
            return `<span class="hc-value empty">No especificado</span>`;
        if (v === true  || v === 'true')
            return `<span class="hc-value bool-si">Sí</span>`;
        if (v === false || v === 'false')
            return `<span class="hc-value bool-no">No</span>`;
        return `<span class="hc-value">${v}</span>`;
    };

    container.innerHTML = `
    <div class="hc-grid">

        <!-- Motivo y lesión principal -->
        <div class="hc-section full-width">
            <div class="hc-section-header">
                <i class="bi bi-clipboard2-pulse"></i> Motivo de consulta
            </div>
            <div class="hc-rows">
                <div class="hc-row">
                    <span class="hc-label">Motivo de consulta</span>
                    ${val(hc.motivo_consulta)}
                </div>
                <div class="hc-row">
                    <span class="hc-label">Tiempo de padecimiento</span>
                    ${val(hc.tiempo_padecimiento)}
                </div>
                <div class="hc-row">
                    <span class="hc-label">Zona afectada</span>
                    ${val(hc.zona_afectada)}
                </div>
                <div class="hc-row">
                    <span class="hc-label">Nivel de dolor inicial</span>
                    ${val(hc.nivel_dolor_inicial !== null
                        ? hc.nivel_dolor_inicial + ' / 10'
                        : null)}
                </div>
            </div>
        </div>

        <!-- Antecedentes médicos relevantes -->
        <div class="hc-section">
            <div class="hc-section-header">
                <i class="bi bi-heart-pulse"></i> Antecedentes médicos
            </div>
            <div class="hc-rows">
                <div class="hc-row"><span class="hc-label">Enfermedades crónicas</span>${val(hc.enfermedades_cronicas)}</div>
                <div class="hc-row"><span class="hc-label">Cirugías previas</span>${val(hc.cirugias_previas)}</div>
                <div class="hc-row"><span class="hc-label">Traumatismos previos</span>${val(hc.traumatismos_previos)}</div>
                <div class="hc-row"><span class="hc-label">Medicamentos actuales</span>${val(hc.medicamentos_actuales)}</div>
                <div class="hc-row"><span class="hc-label">Alergias</span>${val(hc.alergias)}</div>
                <div class="hc-row"><span class="hc-label">Antecedentes familiares</span>${val(hc.antecedentes_familiares)}</div>
            </div>
        </div>

        <!-- Hábitos y estilo de vida -->
        <div class="hc-section">
            <div class="hc-section-header">
                <i class="bi bi-activity"></i> Estilo de vida
            </div>
            <div class="hc-rows">
                <div class="hc-row"><span class="hc-label">Actividad física</span>${val(hc.actividad_fisica)}</div>
                <div class="hc-row"><span class="hc-label">Ocupación</span>${val(hc.ocupacion)}</div>
                <div class="hc-row"><span class="hc-label">Fuma</span>${val(hc.fuma)}</div>
                <div class="hc-row"><span class="hc-label">Consume alcohol</span>${val(hc.consume_alcohol)}</div>
            </div>
        </div>

        <!-- Revisión por sistemas -->
        <div class="hc-section">
            <div class="hc-section-header">
                <i class="bi bi-lungs"></i> Revisión de sistemas
            </div>
            <div class="hc-rows">
                <div class="hc-row"><span class="hc-label">Cardiovascular</span>${val(hc.sistema_cardiovascular)}</div>
                <div class="hc-row"><span class="hc-label">Respiratorio</span>${val(hc.sistema_respiratorio)}</div>
                <div class="hc-row"><span class="hc-label">Nervioso</span>${val(hc.sistema_nervioso)}</div>
                <div class="hc-row"><span class="hc-label">Músculo-esquelético</span>${val(hc.sistema_musculo)}</div>
            </div>
        </div>

        <!-- Consentimientos firmados por el paciente -->
        <div class="hc-section">
            <div class="hc-section-header">
                <i class="bi bi-check2-square"></i> Consentimientos
            </div>
            <div class="hc-rows">
                <div class="hc-row"><span class="hc-label">Acepta tratamiento</span>${val(hc.acepta_tratamiento)}</div>
                <div class="hc-row"><span class="hc-label">Acepta uso de datos</span>${val(hc.acepta_datos)}</div>
                <div class="hc-row"><span class="hc-label">Firma</span>${val(hc.firma_paciente)}</div>
            </div>
        </div>

        <!-- Fechas de creación y actualización del historial -->
        <div class="hc-section">
            <div class="hc-section-header">
                <i class="bi bi-clock-history"></i> Registro
            </div>
            <div class="hc-rows">
                <div class="hc-row">
                    <span class="hc-label">Creado</span>
                    ${val(hc.creado_en
                        ? new Date(hc.creado_en).toLocaleDateString('es-MX')
                        : null)}
                </div>
                <div class="hc-row">
                    <span class="hc-label">Actualizado</span>
                    ${val(hc.actualizado_en
                        ? new Date(hc.actualizado_en).toLocaleDateString('es-MX')
                        : null)}
                </div>
            </div>
        </div>

    </div>`;
}


/* ══════════════════════════════════════════════════════════════
   TAB 3: NOTAS DE EVOLUCIÓN
   
   El fisio crea una nota por sesión/cita para registrar el
   progreso del paciente. Puede verlas y editarlas.
   Incluye: dolor (inicio/fin), técnicas, diagnóstico, plan, etc.
══════════════════════════════════════════════════════════════ */
async function cargarNotasEvolucion(pacienteUserId) {
    const container = document.getElementById('notasList');
    container.innerHTML = `<div style="color:var(--color-gray);font-size:13px;padding:10px;">Cargando…</div>`;

    // Traer notas con join a citas para mostrar fecha y motivo de la sesión
    const { data: notas, error } = await supabase
        .from('notas_evolucion')
        .select(`
            *,
            cita:cita_id ( fecha, hora_inicio, motivo )
        `)
        .eq('paciente_id', pacienteUserId)
        .eq('fisioterapeuta_id', _fisioId)
        .order('creado_en', { ascending: false });

    if (error || !notas?.length) {
        container.innerHTML = `
            <div class="notas-empty">
                <i class="bi bi-journal-x"></i>
                <p>No hay notas de evolución registradas para este paciente.</p>
                <p style="font-size:11px;color:var(--color-gray);">
                    Puedes agregar una nota desde el historial de citas
                    o con el botón "Nueva nota".
                </p>
            </div>`;
        return;
    }

    // Helper: muestra el valor o un span de "No registrado" si está vacío
    const val = v => v || '<span class="nota-field-value empty">No registrado</span>';

    container.innerHTML = notas.map(n => `
        <div class="nota-card">

            <!-- Encabezado: fecha de sesión y motivo -->
            <div class="nota-card-header">
                <span class="nota-card-fecha">
                    <i class="bi bi-calendar3"></i>
                    ${n.cita?.fecha
                        ? formatFecha(n.cita.fecha)
                        : formatFecha(n.creado_en?.split('T')[0])}
                    ${n.cita?.hora_inicio ? '· ' + n.cita.hora_inicio : ''}
                </span>
                <span class="nota-card-motivo">
                    ${n.motivo_sesion || n.cita?.motivo || '—'}
                </span>
            </div>

            <!-- Cuerpo: campos clínicos de la nota -->
            <div class="nota-card-body">
                <div class="nota-grid">

                    <!-- Escala de dolor inicio (barra visual) -->
                    <div class="nota-field">
                        <span class="nota-field-label">Dolor inicial</span>
                        <div class="nota-dolor-bar">
                            <div class="dolor-track">
                                <div class="dolor-fill" style="width:${(n.dolor_inicio || 0) * 10}%"></div>
                            </div>
                            <span class="dolor-num">${n.dolor_inicio ?? '—'}</span>
                        </div>
                    </div>

                    <!-- Escala de dolor al final de la sesión -->
                    <div class="nota-field">
                        <span class="nota-field-label">Dolor final</span>
                        <div class="nota-dolor-bar">
                            <div class="dolor-track">
                                <div class="dolor-fill" style="width:${(n.dolor_fin || 0) * 10}%"></div>
                            </div>
                            <span class="dolor-num">${n.dolor_fin ?? '—'}</span>
                        </div>
                    </div>

                    <div class="nota-field">
                        <span class="nota-field-label">Estado del paciente</span>
                        <span class="nota-field-value">${val(n.estado_paciente)}</span>
                    </div>

                    <div class="nota-field">
                        <span class="nota-field-label">Diagnóstico fisioterapéutico</span>
                        <span class="nota-field-value">${val(n.diagnostico_fisio)}</span>
                    </div>

                    <div class="nota-field">
                        <span class="nota-field-label">Técnicas utilizadas</span>
                        <span class="nota-field-value">${val(n.tecnicas_utilizadas)}</span>
                    </div>

                    <div class="nota-field">
                        <span class="nota-field-label">Duración</span>
                        <span class="nota-field-value">
                            ${n.duracion_minutos
                                ? n.duracion_minutos + ' min'
                                : '<span class="nota-field-value empty">No registrado</span>'}
                        </span>
                    </div>

                    <!-- Campos de texto largo: solo se muestran si tienen contenido -->
                    ${n.respuesta_tratamiento ? `
                    <div class="nota-field full">
                        <span class="nota-field-label">Respuesta al tratamiento</span>
                        <span class="nota-field-value">${n.respuesta_tratamiento}</span>
                    </div>` : ''}

                    ${n.plan_siguiente_sesion ? `
                    <div class="nota-field full">
                        <span class="nota-field-label">Plan siguiente sesión</span>
                        <span class="nota-field-value">${n.plan_siguiente_sesion}</span>
                    </div>` : ''}

                    ${n.observaciones ? `
                    <div class="nota-field full">
                        <span class="nota-field-label">Observaciones</span>
                        <span class="nota-field-value">${n.observaciones}</span>
                    </div>` : ''}

                </div>
            </div>

            <!-- Pie de la tarjeta: botón para editar la nota -->
            <div class="nota-card-actions">
                <button 
                    class="btn-nota-edit" 
                    data-nota-id="${n.id}" 
                    data-cita-id="${n.cita_id}">
                    <i class="bi bi-pencil"></i> Editar nota
                </button>
            </div>
        </div>
    `).join('');

    // Eventos del botón "Editar nota" en cada tarjeta
    container.querySelectorAll('.btn-nota-edit').forEach(btn => {
        btn.addEventListener('click', () => {
            // Abre el modal en modo edición pasando citaId y notaId
            abrirModalNota(btn.dataset.citaId, true, btn.dataset.notaId);
        });
    });
}


/* ══════════════════════════════════════════════════════════════
   MODAL — NOTA DE EVOLUCIÓN
   
   Maneja dos modos:
   • CREAR: abrirModalNota(citaId, false) — nota nueva para una cita
   • EDITAR: abrirModalNota(citaId, true, notaId) — editar nota existente
   • SIN CITA: abrirModalNota(null) — nota nueva sin cita específica
   
   El formulario incluye sliders de dolor (0–10), campos de texto
   para diagnóstico, técnicas, plan, observaciones, etc.
══════════════════════════════════════════════════════════════ */

// ── Sliders de dolor — actualizar el número mostrado al mover ──────────
const sliderInicio = document.getElementById('nf-dolor-inicio');
const sliderFin    = document.getElementById('nf-dolor-fin');

sliderInicio.addEventListener('input', () => {
    document.getElementById('nf-dolor-inicio-val').textContent = sliderInicio.value;
});
sliderFin.addEventListener('input', () => {
    document.getElementById('nf-dolor-fin-val').textContent = sliderFin.value;
});

/**
 * Abre el modal de nota de evolución.
 * 
 * @param {string|null} citaId    - ID de la cita (null = sin cita específica)
 * @param {boolean}     tieneNota - true si ya existe una nota para esta cita
 * @param {string|null} notaId    - ID de la nota a editar (solo en modo edición)
 */
async function abrirModalNota(citaId, tieneNota = false, notaId = null) {
    _citaIdNota     = citaId;
    _notaEditandoId = null;

    // Limpiar el formulario antes de llenar
    limpiarFormNota();

    const overlay   = document.getElementById('modalNotaOverlay');
    const titulo    = document.getElementById('modalNotaTitulo');
    const subtitulo = document.getElementById('modalNotaSubtitulo');

    if (tieneNota) {
        // Modo edición: buscar la nota existente por notaId o citaId
        let query = supabase.from('notas_evolucion').select('*');

        if (notaId) {
            query = query.eq('id', notaId);
        } else if (citaId) {
            query = query
                .eq('cita_id', citaId)
                .eq('fisioterapeuta_id', _fisioId);
        }

        const { data: notas } = await query.limit(1);
        const nota = notas?.[0];

        if (nota) {
            // Guardar el ID de la nota para el UPDATE posterior
            _notaEditandoId = nota.id;
            _citaIdNota     = nota.cita_id;
            llenarFormNota(nota);
            titulo.textContent = 'Editar nota de evolución';
        } else {
            titulo.textContent = 'Nueva nota de evolución';
        }
    } else {
        titulo.textContent = 'Nueva nota de evolución';
    }

    // Mostrar info de la cita en el subtítulo del modal
    if (citaId) {
        const { data: cita } = await supabase
            .from('citas')
            .select('fecha, hora_inicio, motivo')
            .eq('id', citaId)
            .single();

        if (cita) {
            subtitulo.textContent =
                `${_pacienteActual?.us_nom || ''} · ${formatFecha(cita.fecha)} · ${cita.hora_inicio || ''}`;

            // Pre-llenar el campo "motivo" si es una nota nueva y la cita tiene motivo
            if (!tieneNota && cita.motivo) {
                document.getElementById('nf-motivo').value = cita.motivo;
            }
        }
    } else {
        // Sin cita específica: solo mostrar el nombre del paciente
        subtitulo.textContent = _pacienteActual?.us_nom || '';
    }

    overlay.classList.add('active');
}

/**
 * Limpia todos los campos del formulario de nota.
 * Se llama siempre antes de abrir el modal.
 */
function limpiarFormNota() {
    const ids = [
        'nf-motivo', 'nf-estado-paciente', 'nf-reporte', 'nf-postura',
        'nf-rango', 'nf-fuerza', 'nf-pruebas', 'nf-signos', 'nf-diagnostico',
        'nf-objetivos', 'nf-tecnicas', 'nf-ejercicios', 'nf-equipo',
        'nf-duracion', 'nf-respuesta', 'nf-observaciones', 'nf-plan',
        'nf-frecuencia', 'nf-ejercicios-casa'
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    // Resetear sliders de dolor a 0
    sliderInicio.value = 0;
    sliderFin.value    = 0;
    document.getElementById('nf-dolor-inicio-val').textContent = '0';
    document.getElementById('nf-dolor-fin-val').textContent    = '0';
}

/**
 * Rellena el formulario con los datos de una nota existente.
 * Se usa en modo edición.
 * 
 * @param {object} n - Objeto nota de la tabla notas_evolucion
 */
function llenarFormNota(n) {
    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el && val != null) el.value = val;
    };

    set('nf-motivo',          n.motivo_sesion);
    set('nf-estado-paciente', n.estado_paciente);
    set('nf-reporte',         n.reporte_paciente);
    set('nf-postura',         n.postura);
    set('nf-rango',           n.rango_movimiento);
    set('nf-fuerza',          n.fuerza_muscular);
    set('nf-pruebas',         n.pruebas_especiales);
    // signos_vitales puede ser objeto JSON: convertir a string para el textarea
    set('nf-signos',          typeof n.signos_vitales === 'object'
        ? JSON.stringify(n.signos_vitales)
        : n.signos_vitales);
    set('nf-diagnostico',     n.diagnostico_fisio);
    set('nf-objetivos',       n.objetivos_sesion);
    set('nf-tecnicas',        n.tecnicas_utilizadas);
    set('nf-ejercicios',      n.ejercicios_realizados);
    set('nf-equipo',          n.equipo_utilizado);
    set('nf-duracion',        n.duracion_minutos);
    set('nf-respuesta',       n.respuesta_tratamiento);
    set('nf-observaciones',   n.observaciones);
    set('nf-plan',            n.plan_siguiente_sesion);
    set('nf-frecuencia',      n.frecuencia_recomendada);
    set('nf-ejercicios-casa', n.ejercicios_en_casa);

    // Sliders de dolor: actualizar valor y etiqueta visible
    if (n.dolor_inicio != null) {
        sliderInicio.value = n.dolor_inicio;
        document.getElementById('nf-dolor-inicio-val').textContent = n.dolor_inicio;
    }
    if (n.dolor_fin != null) {
        sliderFin.value = n.dolor_fin;
        document.getElementById('nf-dolor-fin-val').textContent = n.dolor_fin;
    }
}

/** Cierra el modal de nota y limpia las variables de estado. */
function cerrarModalNota() {
    document.getElementById('modalNotaOverlay').classList.remove('active');
    _citaIdNota     = null;
    _notaEditandoId = null;
}

// ── Cerrar modal con botones, overlay o tecla Escape ──────────────────
document.getElementById('btnCerrarModalNota').addEventListener('click', cerrarModalNota);
document.getElementById('btnCancelarNota').addEventListener('click', cerrarModalNota);
document.getElementById('modalNotaOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modalNotaOverlay')) cerrarModalNota();
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') cerrarModalNota();
});

// ── Guardar nota (INSERT o UPDATE según _notaEditandoId) ───────────────
document.getElementById('btnGuardarNota').addEventListener('click', async () => {
    if (!_pacienteActual?.id_us) {
        toast('No hay paciente seleccionado.', 'danger');
        return;
    }

    // Estado de carga en el botón
    const btn = document.getElementById('btnGuardarNota');
    btn.disabled  = true;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Guardando…';

    // Helper: obtener valor de un campo o null si está vacío
    const g = id => document.getElementById(id)?.value?.trim() || null;

    // Construir el payload con todos los campos del formulario
    const payload = {
        paciente_id:           _pacienteActual.id_us,
        fisioterapeuta_id:     _fisioId,
        cita_id:               _citaIdNota || null,
        motivo_sesion:         g('nf-motivo'),
        estado_paciente:       g('nf-estado-paciente'),
        dolor_inicio:          parseInt(sliderInicio.value),
        dolor_fin:             parseInt(sliderFin.value),
        reporte_paciente:      g('nf-reporte'),
        postura:               g('nf-postura'),
        rango_movimiento:      g('nf-rango'),
        fuerza_muscular:       g('nf-fuerza'),
        pruebas_especiales:    g('nf-pruebas'),
        signos_vitales:        g('nf-signos'),
        diagnostico_fisio:     g('nf-diagnostico'),
        objetivos_sesion:      g('nf-objetivos'),
        tecnicas_utilizadas:   g('nf-tecnicas'),
        ejercicios_realizados: g('nf-ejercicios'),
        equipo_utilizado:      g('nf-equipo'),
        duracion_minutos:      g('nf-duracion') ? parseInt(g('nf-duracion')) : null,
        respuesta_tratamiento: g('nf-respuesta'),
        observaciones:         g('nf-observaciones'),
        plan_siguiente_sesion: g('nf-plan'),
        frecuencia_recomendada:g('nf-frecuencia'),
        ejercicios_en_casa:    g('nf-ejercicios-casa'),
    };

    let error;

    if (_notaEditandoId) {
        // Modo edición: UPDATE de la nota existente
        ({ error } = await supabase
            .from('notas_evolucion')
            .update(payload)
            .eq('id', _notaEditandoId));
    } else {
        // Modo creación: INSERT de nota nueva
        ({ error } = await supabase
            .from('notas_evolucion')
            .insert(payload));
    }

    // Restaurar botón
    btn.disabled  = false;
    btn.innerHTML = '<i class="bi bi-check-lg"></i> Guardar nota';

    if (error) {
        console.error('Error guardando nota:', error);
        toast('Error al guardar la nota. Intenta de nuevo.', 'danger');
        return;
    }

    cerrarModalNota();
    toast(
        _notaEditandoId
            ? 'Nota actualizada exitosamente.'
            : 'Nota guardada exitosamente.',
        'success'
    );

    // Refrescar tabs de citas y notas para reflejar el cambio
    await Promise.all([
        cargarCitasPaciente(_pacienteActual.id_us),
        cargarNotasEvolucion(_pacienteActual.id_us)
    ]);
});


/* ══════════════════════════════════════════════════════════════
   MODAL — ASIGNAR RUTINA A PACIENTE
   
   Permite seleccionar una rutina del fisio (que tenga al menos
   un ejercicio asignado) y asignarla al paciente actual.
   
   Flujo:
   1. Abrir modal → cargar rutinas del fisio con ejercicios
   2. Seleccionar rutina en el <select>
   3. Confirmar → UPDATE en tabla rutina (usuario_id = pacienteId)
══════════════════════════════════════════════════════════════ */
let _pacienteIdAsignar     = null;
let _pacienteNombreAsignar = null;

/**
 * Abre el modal de asignación de rutina para un paciente.
 * 
 * @param {string} pacienteUserId  - id_us del paciente
 * @param {string} pacienteNombre  - Nombre del paciente (para el UI)
 */
async function abrirModalAsignarRutina(pacienteUserId, pacienteNombre) {
    _pacienteIdAsignar     = pacienteUserId;
    _pacienteNombreAsignar = pacienteNombre;

    document.getElementById('modalAsignarNombrePaciente').textContent = pacienteNombre;

    const select = document.getElementById('selectRutinaAsignar');
    select.innerHTML = '<option value="">Cargando rutinas…</option>';
    select.disabled  = true;
    document.getElementById('avisoSinRutinas').style.display     = 'none';
    document.getElementById('btnConfirmarAsignarRutina').disabled = true;

    const modal = new bootstrap.Modal(document.getElementById('modalAsignarRutina'));
    modal.show();

    // Cargar rutinas en el select
    await cargarRutinasConEjercicios(select);
}

/**
 * Carga las rutinas del fisio en el select del modal.
 * Solo incluye rutinas que tienen al menos 1 ejercicio asignado
 * (verificado con un count en rutina_eje).
 * 
 * @param {HTMLSelectElement} select - El elemento <select> del modal
 */
async function cargarRutinasConEjercicios(select) {
    const { data: rutinas, error } = await supabase
        .from('rutina')
        .select('id_rut, rut_nom')
        .eq('fisioterapeuta_id', _fisioId)
        .order('rut_nom', { ascending: true });

    if (error || !rutinas?.length) {
        select.innerHTML = '<option value="">Sin rutinas disponibles</option>';
        document.getElementById('avisoSinRutinas').style.display = 'block';
        return;
    }

    // Verificar en paralelo cuáles rutinas tienen ejercicios
    const checks = await Promise.all(
        rutinas.map(r =>
            supabase.from('rutina_eje')
                .select('*', { count: 'exact', head: true })
                .eq('id_rut', r.id_rut)
                .then(({ count }) => ({ ...r, tieneEjercicios: (count || 0) > 0 }))
        )
    );

    // Filtrar solo las que tienen ejercicios
    const validas = checks.filter(r => r.tieneEjercicios);

    if (!validas.length) {
        select.innerHTML = '<option value="">Sin rutinas con ejercicios</option>';
        document.getElementById('avisoSinRutinas').style.display     = 'block';
        document.getElementById('btnConfirmarAsignarRutina').disabled = true;
        return;
    }

    // Poblar el select con las rutinas válidas
    select.innerHTML = '<option value="">Selecciona una rutina…</option>';
    validas.forEach(r => {
        const opt       = document.createElement('option');
        opt.value       = r.id_rut;
        opt.textContent = r.rut_nom;
        select.appendChild(opt);
    });
    select.disabled = false;
    document.getElementById('btnConfirmarAsignarRutina').disabled = false;
}

// ── Confirmar asignación de rutina ────────────────────────────────────
document.getElementById('btnConfirmarAsignarRutina').addEventListener('click', async () => {
    const rutinaId = document.getElementById('selectRutinaAsignar').value;

    if (!rutinaId) {
        toast('Selecciona una rutina.', 'warning');
        return;
    }
    if (!_pacienteIdAsignar) {
        toast('Error: no se encontró el paciente.', 'danger');
        return;
    }

    const btn = document.getElementById('btnConfirmarAsignarRutina');
    btn.disabled    = true;
    btn.textContent = 'Asignando…';

    // Actualizar el campo usuario_id de la rutina con el paciente seleccionado
    const { error } = await supabase
        .from('rutina')
        .update({ usuario_id: _pacienteIdAsignar })
        .eq('id_rut', rutinaId);

    btn.disabled  = false;
    btn.innerHTML = '<i class="bi bi-person-check"></i> Asignar';

    if (error) {
        console.error('Error al asignar rutina:', error);
        toast('Error al asignar la rutina. Intenta de nuevo.', 'danger');
        return;
    }

    bootstrap.Modal.getInstance(document.getElementById('modalAsignarRutina')).hide();

    const nombrePaciente   = _pacienteNombreAsignar;
    _pacienteIdAsignar     = null;
    _pacienteNombreAsignar = null;

    toast(`Rutina asignada a ${nombrePaciente} exitosamente.`, 'success');
});

// Exponer para uso desde otros módulos si se necesita
window.abrirModalAsignarRutina = abrirModalAsignarRutina;


/* ══════════════════════════════════════════════════════════════
   TIEMPO REAL — SUPABASE REALTIME
   
   Escucha cambios en las tablas 'citas' y 'pagos' para
   actualizar automáticamente el dashboard sin recargar la página.
   
   Esto permite que si otro usuario (paciente) crea o modifica
   una cita, el fisio lo vea reflejado en tiempo real.
══════════════════════════════════════════════════════════════ */
function activarTiempoReal(fisioId) {
    // Canal para cambios en citas: actualiza estadísticas y lista de pacientes
    supabase.channel('citas-cambios')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'citas' },
            async () => {
                await cargarEstadisticas(fisioId);
                await cargarListaPacientes(fisioId);
            }
        )
        .subscribe();

    // Canal para cambios en pagos: solo actualiza estadísticas
    supabase.channel('pagos-cambios')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'pagos' },
            () => { cargarEstadisticas(fisioId); }
        )
        .subscribe();
}


/* ══════════════════════════════════════════════════════════════
   INICIALIZACIÓN
   
   Punto de entrada del módulo. Obtiene los datos del fisio logueado
   y carga el dashboard completo: estadísticas + lista de pacientes.
   Luego activa la escucha en tiempo real.
══════════════════════════════════════════════════════════════ */
async function inicializar() {
    const fisioId = await getFisioData();

    if (!fisioId) {
        toast('No se pudo obtener el perfil del fisioterapeuta.', 'danger');
        return;
    }

    // Cargar estadísticas y lista en paralelo para mayor velocidad
    await Promise.all([
        cargarEstadisticas(fisioId),
        cargarListaPacientes(fisioId)
    ]);

    activarTiempoReal(fisioId);
}

inicializar();