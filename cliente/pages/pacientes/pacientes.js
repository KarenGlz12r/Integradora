import { supabase } from "../../../auth.js";
// PACIENTES.JS
// ── Obtener fisioterapeuta una sola vez ──────────────────────────
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

// 1. PACIENTES CONFIRMADOS (con pago)
async function cargarTotalPacientesConfirmados(fisioId) {
    const { data: pagos } = await supabase.from('pagos').select('cita_id');
    const citasConPago = pagos?.map(p => p.cita_id) || [];

    const { data: citas, error } = await supabase
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

// 2. PACIENTES NUEVOS ESTE MES  
async function cargarPacientesNuevosMes(fisioId) {
    const ahora = new Date();
    const primerDia = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-01`;
    const ultimoDia = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0)
        .toISOString().split('T')[0];

    const { data: citas } = await supabase
        .from('citas')
        .select('usuario_id')
        .eq('fisioterapeuta_id', fisioId)
        .gte('fecha', primerDia)
        .lte('fecha', ultimoDia);

    const pacientesUnicos = new Set(citas?.map(c => c.usuario_id));
    document.getElementById('card-nuevos-mes').querySelector('.card-stat-numero').textContent = pacientesUnicos.size;
}

// 3. CITAS PENDIENTES DE PAGO
async function cargarCitasPendientesPago(fisioId) {
    // Trae citas con estado pendiente_pago del fisio
    const { data: citas } = await supabase
        .from('citas')
        .select('id')
        .eq('fisioterapeuta_id', fisioId)
        .eq('estado', 'pendiente_pago');

    if (!citas || citas.length === 0) {
        document.getElementById('card-pendientes-pago')
            .querySelector('.card-stat-numero').textContent = 0;
        return;
    }

    const idsCitas = citas.map(c => c.id);

    // De esas citas, busca cuáles tienen pago con estado 'procesado'
    const { data: pagosCompletados } = await supabase
        .from('pagos')
        .select('cita_id')
        .in('cita_id', idsCitas)
        .eq('estado_pago', 'procesado');

    const citasPagadas = new Set(pagosCompletados?.map(p => p.cita_id) || []);

    // Solo cuenta las que NO tienen pago procesado
    const pendientes = idsCitas.filter(id => !citasPagadas.has(id));

    document.getElementById('card-pendientes-pago')
        .querySelector('.card-stat-numero').textContent = pendientes.length;
}



async function cargarProximaCita(fisioId) {
    const hoy = new Date().toISOString().split('T')[0];

    // Busca próxima cita futura
    let { data: citas } = await supabase
        .from('citas')
        .select('fecha, hora_inicio, motivo')
        .eq('fisioterapeuta_id', fisioId)
        .gte('fecha', hoy)
        .order('fecha', { ascending: true })
        .order('hora_inicio', { ascending: true })
        .limit(1);

    // Si no hay futuras, trae la más reciente pasada
    if (!citas || citas.length === 0) {
        const { data: pasadas } = await supabase
            .from('citas')
            .select('fecha, hora_inicio, motivo')
            .eq('fisioterapeuta_id', fisioId)
            .lt('fecha', hoy)
            .order('fecha', { ascending: false })
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

    const fecha = new Date(citas[0].fecha + 'T00:00:00');
    const esPassada = citas[0].fecha < hoy;

    num.textContent = fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    el.textContent  = `${esPassada ? 'Última' : 'Próxima'} · ${citas[0].hora_inicio} · ${citas[0].motivo}`;
}

// CARGAR LOS PACIENTES Y SU INFORMACIÓN DE CITA
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
      <button
        class="btn-chat-paciente"
        onclick="abrirChat('${cita.usuario?.user_id}', '${cita.usuario?.us_nom}')">
        <i class="bi bi-chat-dots-fill"></i> Mensaje
      </button>
    </div>
  `).join('');
}


// FUNCION DE CARGAR EL CHAT
window.abrirChat = function(pacienteUserId, pacienteNombre) {
  if (!pacienteUserId || pacienteUserId === 'undefined') {
    alert('Este paciente no tiene cuenta activa en el sistema.');
    return;
  }
  // Guarda el user_id (uuid de auth.users) — es lo que el chat usa para la sala
  sessionStorage.setItem('chatPacienteId', pacienteUserId);
  sessionStorage.setItem('chatPacienteNombre', pacienteNombre);
  window.location.href = '../Chat/chat.html';
};

// ── TIEMPO REAL ──────────────────────────────────────────────────
function activarTiempoReal(fisioId) {
    // Escucha cambios en citas
    supabase
        .channel('citas-cambios')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'citas' },
            () => {
                cargarTotalPacientesConfirmados(fisioId);
                cargarPacientesNuevosMes(fisioId);
                cargarCitasPendientesPago(fisioId);
                cargarProximaCita(fisioId);
                cargarPacientes(fisioId);
            }
        )
        .subscribe();

    // Escucha cambios en pagos
    supabase
        .channel('pagos-cambios')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'pagos' },
            () => {
                cargarTotalPacientesConfirmados(fisioId);
                cargarCitasPendientesPago(fisioId);
            }
        )
        .subscribe();
}

// ── INICIALIZAR ──────────────────────────────────────────────────
async function inicializar() {
    const fisioId = await getFisioId();
    if (!fisioId) return;

    await Promise.all([
        cargarTotalPacientesConfirmados(fisioId),
        cargarPacientesNuevosMes(fisioId),
        cargarCitasPendientesPago(fisioId),
        cargarProximaCita(fisioId),
        cargarPacientes(fisioId)
    ]);

    activarTiempoReal(fisioId); // ← arranca después de la carga inicial
}

inicializar();