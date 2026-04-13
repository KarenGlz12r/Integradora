import { supabase } from "../../../auth.js";

/* ─────────────────────────────────────────────────────────────
   HELPER: obtener el ID interno del fisioterapeuta logueado
   Se usa en varias funciones, por eso se centraliza aquí.
───────────────────────────────────────────────────────────── */
async function getFisioId() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: fisio } = await supabase
        .from('fisioterapeutas')
        .select('id')
        .eq('user_id', user.id)
        .single();
    return fisio?.id || null;
}


/* ═══════════════════════════════════════════════════════════════
   ESTADÍSTICAS — TARJETAS SUPERIORES
═══════════════════════════════════════════════════════════════ */

// 1. Total de pacientes confirmados (con pago)
async function cargarTotalPacientesConfirmados(fisioId) {
    const { data: pagos } = await supabase.from('pagos').select('cita_id');
    const citasConPago = pagos?.map(p => p.cita_id) || [];

    const { data: citas } = await supabase
        .from('citas')
        .select('usuario_id')
        .eq('fisioterapeuta_id', fisioId)
        .eq('estado', 'confirmada')
        .in('id', citasConPago);

    const card = document.getElementById('card-pacientes-confirmados');
    const pacientesUnicos = new Set(citas?.map(c => c.usuario_id));

    card.innerHTML = `
        <div class="card-stat-icon"><i class="bi bi-people-fill"></i></div>
        <div class="card-stat-info">
            <span class="card-stat-numero">${pacientesUnicos.size}</span>
            <span class="card-stat-label">${pacientesUnicos.size === 0 ? 'No hay pacientes confirmados' : 'Pacientes confirmados'}</span>
        </div>`;
}

// 2. Pacientes nuevos este mes
async function cargarPacientesNuevosMes(fisioId) {
    const ahora    = new Date();
    const primerDia = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-01`;
    const ultimoDia = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).toISOString().split('T')[0];

    const { data: citas } = await supabase
        .from('citas')
        .select('usuario_id')
        .eq('fisioterapeuta_id', fisioId)
        .gte('fecha', primerDia)
        .lte('fecha', ultimoDia);

    const pacientesUnicos = new Set(citas?.map(c => c.usuario_id));
    document.getElementById('card-nuevos-mes').querySelector('.card-stat-numero').textContent = pacientesUnicos.size;
}

// 3. Citas pendientes de pago
async function cargarCitasPendientesPago(fisioId) {
    const { data: citas } = await supabase
        .from('citas')
        .select('id')
        .eq('fisioterapeuta_id', fisioId)
        .eq('estado', 'pendiente_pago');

    if (!citas || citas.length === 0) {
        document.getElementById('card-pendientes-pago').querySelector('.card-stat-numero').textContent = 0;
        return;
    }

    const idsCitas = citas.map(c => c.id);

    const { data: pagosCompletados } = await supabase
        .from('pagos')
        .select('cita_id')
        .in('cita_id', idsCitas)
        .eq('estado_pago', 'procesado');

    const citasPagadas = new Set(pagosCompletados?.map(p => p.cita_id) || []);
    const pendientes   = idsCitas.filter(id => !citasPagadas.has(id));

    document.getElementById('card-pendientes-pago').querySelector('.card-stat-numero').textContent = pendientes.length;
}

// 4. Próxima cita
async function cargarProximaCita(fisioId) {
    const hoy = new Date().toISOString().split('T')[0];

    let { data: citas } = await supabase
        .from('citas')
        .select('fecha, hora_inicio, motivo')
        .eq('fisioterapeuta_id', fisioId)
        .gte('fecha', hoy)
        .order('fecha',       { ascending: true })
        .order('hora_inicio', { ascending: true })
        .limit(1);

    // Si no hay futuras, mostrar la más reciente pasada
    if (!citas || citas.length === 0) {
        const { data: pasadas } = await supabase
            .from('citas')
            .select('fecha, hora_inicio, motivo')
            .eq('fisioterapeuta_id', fisioId)
            .lt('fecha', hoy)
            .order('fecha',       { ascending: false })
            .order('hora_inicio', { ascending: false })
            .limit(1);
        citas = pasadas;
    }

    const card = document.getElementById('card-proxima-cita');
    if (!card) return;

    const num = card.querySelector('.card-stat-numero');
    const el  = card.querySelector('.card-stat-label');

    if (!citas || citas.length === 0) {
        num.textContent = '—';
        el.textContent  = 'Sin citas registradas';
        return;
    }

    const fecha    = new Date(citas[0].fecha + 'T00:00:00');
    const esPassada = citas[0].fecha < hoy;

    num.textContent = fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    el.textContent  = `${esPassada ? 'Última' : 'Próxima'} · ${citas[0].hora_inicio} · ${citas[0].motivo}`;
}


/* ═══════════════════════════════════════════════════════════════
   LISTA DE PACIENTES
   Muestra tarjetas con info de cita + botones de acción.
   Cada tarjeta tiene: Mensaje (chat) y Asignar rutina.
═══════════════════════════════════════════════════════════════ */
async function cargarPacientes(fisioId) {
    const { data: citas, error } = await supabase
        .from('citas')
        .select(`
            id,
            fecha,
            hora_inicio,
            motivo,
            estado,
            usuario:usuario_id (
                id_us,
                us_nom,
                us_correo,
                us_telefono
            )
        `)
        .eq('fisioterapeuta_id', fisioId)
        .order('fecha', { ascending: false });

    if (error) { console.error('Error cargando pacientes:', error); return; }

    const seccion = document.getElementById('lista-pacientes');

    if (!citas || citas.length === 0) {
        seccion.innerHTML = `<p class="sin-pacientes">No tienes pacientes registrados aún.</p>`;
        return;
    }

    seccion.innerHTML = citas.map(cita => `
        <div class="paciente-card">
            <div class="paciente-avatar">
                <i class="bi bi-person-circle"></i>
            </div>
            <div class="paciente-info">
                <h4 class="paciente-nombre">${cita.usuario?.us_nom ?? 'Sin nombre'}</h4>
                <p class="paciente-correo">
                    <i class="bi bi-envelope"></i> ${cita.usuario?.us_correo ?? '—'}
                </p>
                <p class="paciente-telefono">
                    <i class="bi bi-telephone"></i> ${cita.usuario?.us_telefono ?? '—'}
                </p>
            </div>
            <div class="paciente-cita">
                <span class="cita-fecha">
                    <i class="bi bi-calendar3"></i>
                    ${new Date(cita.fecha + 'T00:00:00').toLocaleDateString('es-MX', {
                        day: 'numeric', month: 'short', year: 'numeric'
                    })}
                </span>
                <span class="cita-hora">
                    <i class="bi bi-clock"></i> ${cita.hora_inicio}
                </span>
                <span class="cita-motivo">
                    <i class="bi bi-clipboard2-pulse"></i> ${cita.motivo}
                </span>
                <span class="cita-estado estado-${cita.estado}">
                    ${cita.estado.replace('_', ' ')}
                </span>
            </div>
            <div class="paciente-acciones">
                <!-- Botón abrir chat con el paciente -->
                <button
                    class="btn-chat-paciente"
                    onclick="abrirChat('${cita.usuario?.id_us}', '${cita.usuario?.us_nom}')">
                    <i class="bi bi-chat-dots-fill"></i> Mensaje
                </button>
                <!-- Botón asignar rutina al paciente -->
                <button
                    class="btn-asignar-rutina"
                    onclick="abrirModalAsignarRutina('${cita.usuario?.id_us}', '${cita.usuario?.us_nom}')">
                    <i class="bi bi-list-check"></i> Asignar rutina
                </button>
            </div>
        </div>
    `).join('');
}


/* ═══════════════════════════════════════════════════════════════
   ABRIR CHAT CON UN PACIENTE
   Guarda el ID en sessionStorage y redirige al chat.
═══════════════════════════════════════════════════════════════ */
window.abrirChat = function (pacienteUserId, pacienteNombre) {
    if (!pacienteUserId || pacienteUserId === 'undefined') {
        alert('Este paciente no tiene cuenta activa en el sistema.');
        return;
    }
    sessionStorage.setItem('chatPacienteId',     pacienteUserId);
    sessionStorage.setItem('chatPacienteNombre', pacienteNombre);
    window.location.href = '../Chat/chat.html';
};


/* ═══════════════════════════════════════════════════════════════
   ASIGNAR RUTINA A PACIENTE
   
   FLUJO:
   1. El fisio hace clic en "Asignar rutina" en la tarjeta del paciente
   2. Se abre un modal con un select de rutinas disponibles
   3. Solo aparecen rutinas que tienen al menos 1 ejercicio en rutina_eje
   4. Al confirmar, se actualiza usuario_id en la tabla rutina
═══════════════════════════════════════════════════════════════ */

// Variables del módulo de asignación
let _pacienteIdAsignar     = null; // ID del paciente al que se le asignará la rutina
let _pacienteNombreAsignar = null; // Nombre para mostrarlo en el modal

/**
 * Abre el modal de asignar rutina para un paciente específico.
 * Carga las rutinas del fisio que tienen ejercicios.
 *
 * @param {string} pacienteUserId - ID del usuario (auth.users.id)
 * @param {string} pacienteNombre - Nombre para mostrar en el modal
 */
window.abrirModalAsignarRutina = async function (pacienteUserId, pacienteNombre) {
    if (!pacienteUserId || pacienteUserId === 'undefined') {
        mostrarAlerta('Este paciente no tiene cuenta activa.', 'warning');
        return;
    }

    // Guardar datos del paciente para usarlos al confirmar
    _pacienteIdAsignar     = pacienteUserId;
    _pacienteNombreAsignar = pacienteNombre;

    // Mostrar el nombre del paciente en el modal
    document.getElementById('modalAsignarNombrePaciente').textContent = pacienteNombre;

    // Limpiar y deshabilitar el select mientras carga
    const select = document.getElementById('selectRutinaAsignar');
    select.innerHTML = '<option value="">Cargando rutinas...</option>';
    select.disabled  = true;

    document.getElementById('avisoSinRutinas').style.display    = 'none';
    document.getElementById('btnConfirmarAsignarRutina').disabled = true;

    // Abrir el modal de inmediato (no esperar la carga)
    const modal = new bootstrap.Modal(document.getElementById('modalAsignarRutina'));
    modal.show();

    // Cargar rutinas con ejercicios en segundo plano
    await cargarRutinasConEjercicios(select);
};

/**
 * Consulta las rutinas del fisio logueado y filtra
 * solo las que tienen al menos un ejercicio en rutina_eje.
 * Luego rellena el select del modal.
 *
 * @param {HTMLSelectElement} select - El elemento select a rellenar
 */
async function cargarRutinasConEjercicios(select) {
    const { data: { user } } = await supabase.auth.getUser();

    const { data: fisio } = await supabase
        .from('fisioterapeutas')
        .select('id')
        .eq('user_id', user.id)
        .single();

    if (!fisio) {
        select.innerHTML = '<option value="">Error al cargar</option>';
        return;
    }

    // Traer todas las rutinas del fisio
    const { data: rutinas, error } = await supabase
        .from('rutina')
        .select('id_rut, rut_nom')
        .eq('fisioterapeuta_id', fisio.id)
        .order('rut_nom', { ascending: true });

    if (error || !rutinas?.length) {
        select.innerHTML = '<option value="">Sin rutinas disponibles</option>';
        document.getElementById('avisoSinRutinas').style.display = 'block';
        return;
    }

    // Para cada rutina, verificar si tiene ejercicios en rutina_eje
    // Se hacen en paralelo para no ir una por una
    const checks = await Promise.all(
        rutinas.map(r =>
            supabase
                .from('rutina_eje')
                .select('*', { count: 'exact', head: true })
                .eq('id_rut', r.id_rut)
                .then(({ count }) => ({ ...r, tieneEjercicios: (count || 0) > 0 }))
        )
    );

    // Filtrar solo las que tienen ejercicios
    const rutinasValidas = checks.filter(r => r.tieneEjercicios);

    if (rutinasValidas.length === 0) {
        select.innerHTML = '<option value="">Sin rutinas con ejercicios</option>';
        document.getElementById('avisoSinRutinas').style.display    = 'block';
        document.getElementById('btnConfirmarAsignarRutina').disabled = true;
        return;
    }

    // Rellenar el select con las rutinas válidas
    select.innerHTML = '<option value="">Selecciona una rutina...</option>';
    rutinasValidas.forEach(r => {
        const opt       = document.createElement('option');
        opt.value       = r.id_rut;
        opt.textContent = r.rut_nom;
        select.appendChild(opt);
    });

    // Habilitar el select y el botón de confirmar
    select.disabled = false;
    document.getElementById('btnConfirmarAsignarRutina').disabled = false;
}

/**
 * Listener del botón "Asignar" en el modal.
 * Actualiza el campo usuario_id en la tabla rutina
 * con el ID del paciente seleccionado.
 */
document.getElementById('btnConfirmarAsignarRutina').addEventListener('click', async () => {
    const rutinaId = document.getElementById('selectRutinaAsignar').value;

    if (!rutinaId) {
        mostrarAlerta('Selecciona una rutina para continuar.', 'warning');
        return;
    }

    if (!_pacienteIdAsignar) {
        mostrarAlerta('Error: no se encontró el paciente.', 'danger');
        return;
    }

    // Deshabilitar el botón mientras se procesa
    const btn = document.getElementById('btnConfirmarAsignarRutina');
    btn.disabled    = true;
    btn.textContent = 'Asignando...';

    const { error } = await supabase
        .from('rutina')
        .update({ usuario_id: _pacienteIdAsignar })
        .eq('id_rut', rutinaId);

    // Restaurar el botón
    btn.disabled   = false;
    btn.innerHTML  = '<i class="bi bi-person-check"></i> Asignar';

    if (error) {
        console.error('Error al asignar rutina:', error);
        mostrarAlerta('Error al asignar la rutina. Intenta de nuevo.', 'danger');
        return;
    }

    // Cerrar modal y limpiar estado
    bootstrap.Modal.getInstance(document.getElementById('modalAsignarRutina')).hide();
    _pacienteIdAsignar     = null;
    _pacienteNombreAsignar = null;

    mostrarAlerta(`Rutina asignada a ${_pacienteNombreAsignar || 'el paciente'} exitosamente.`, 'success');
});


/* ═══════════════════════════════════════════════════════════════
   TIEMPO REAL
   Recalcula las estadísticas cuando cambian citas o pagos.
═══════════════════════════════════════════════════════════════ */
function activarTiempoReal(fisioId) {
    supabase
        .channel('citas-cambios')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'citas' }, () => {
            cargarTotalPacientesConfirmados(fisioId);
            cargarPacientesNuevosMes(fisioId);
            cargarCitasPendientesPago(fisioId);
            cargarProximaCita(fisioId);
            cargarPacientes(fisioId);
        })
        .subscribe();

    supabase
        .channel('pagos-cambios')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos' }, () => {
            cargarTotalPacientesConfirmados(fisioId);
            cargarCitasPendientesPago(fisioId);
        })
        .subscribe();
}


/* ═══════════════════════════════════════════════════════════════
   ALERTA TEMPORAL
   Muestra un toast/alerta en la parte superior de la página.
═══════════════════════════════════════════════════════════════ */
function mostrarAlerta(mensaje, tipo = 'warning') {
    // Buscar o crear el contenedor de alertas
    let container = document.getElementById('alert-container-pacientes');
    if (!container) {
        container = document.createElement('div');
        container.id = 'alert-container-pacientes';
        container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;min-width:300px;';
        document.body.appendChild(container);
    }

    container.innerHTML = `
        <div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
            ${mensaje}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>`;

    setTimeout(() => { container.innerHTML = ''; }, 5000);
}


/* ═══════════════════════════════════════════════════════════════
   INICIALIZACIÓN
═══════════════════════════════════════════════════════════════ */
async function inicializar() {
    const fisioId = await getFisioId();
    if (!fisioId) return;

    // Cargar todo en paralelo
    await Promise.all([
        cargarTotalPacientesConfirmados(fisioId),
        cargarPacientesNuevosMes(fisioId),
        cargarCitasPendientesPago(fisioId),
        cargarProximaCita(fisioId),
        cargarPacientes(fisioId)
    ]);

    // Activar tiempo real después de la carga inicial
    activarTiempoReal(fisioId);
}

inicializar();