import { supabase } from "../../../auth.js";

/* ══════════════════════════════════════════════════════════════
   ESTADO GLOBAL DEL MÓDULO
══════════════════════════════════════════════════════════════ */
let _fisioId         = null;  // ID interno del fisio (tabla fisioterapeutas)
let _fisioUserId     = null;  // ID de auth.users del fisio
let _pacienteActual  = null;  // Objeto completo del paciente seleccionado
let _citaIdNota      = null;  // ID de la cita a la que pertenece la nota que se está editando/creando
let _notaEditandoId  = null;  // ID de la nota en edición (null = nueva nota)
let _todosLosPacientes = [];  // Cache de pacientes para el buscador


/* ══════════════════════════════════════════════════════════════
   HELPER: obtener IDs del fisio logueado
══════════════════════════════════════════════════════════════ */
async function getFisioData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: fisio } = await supabase
        .from('fisioterapeutas')
        .select('id')
        .eq('user_id', user.id)
        .single();

    if (!fisio) return null;

    _fisioId     = fisio.id;
    _fisioUserId = user.id;
    return fisio.id;
}


/* ══════════════════════════════════════════════════════════════
   HELPER: iniciales del nombre para el avatar
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
══════════════════════════════════════════════════════════════ */
function formatFecha(fechaStr) {
    if (!fechaStr) return '—';
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
   TOAST
══════════════════════════════════════════ */
function toast(msg, tipo = 'success') {
    const container = document.getElementById('toastContainer');
    const icons = { success: 'check-circle-fill', warning: 'exclamation-triangle-fill', danger: 'x-circle-fill', info: 'info-circle-fill' };
    const el = document.createElement('div');
    el.className = `toast-msg toast-${tipo}`;
    el.innerHTML = `<i class="bi bi-${icons[tipo] || 'info-circle-fill'}"></i> ${msg}`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3500);
}


/* ══════════════════════════════════════════════════════════════
   ESTADÍSTICAS — TARJETAS SUPERIORES
══════════════════════════════════════════════════════════════ */
async function cargarEstadisticas(fisioId) {
    // 1. Total pacientes confirmados (con pago)
    const { data: pagos } = await supabase.from('pagos').select('cita_id');
    const citasConPago = pagos?.map(p => p.cita_id) || [];

    const { data: citasConf } = await supabase
        .from('citas')
        .select('usuario_id')
        .eq('fisioterapeuta_id', fisioId)
        .eq('estado', 'confirmada')
        .in('id', citasConPago.length ? citasConPago : ['_none_']);

    const card1 = document.getElementById('card-pacientes-confirmados');
    const unicos = new Set(citasConf?.map(c => c.usuario_id));
    card1.querySelector('.card-stat-numero').textContent = unicos.size;
    card1.querySelector('.card-stat-label').textContent  = 'Pacientes confirmados';

    // 2. Pacientes nuevos este mes
    const ahora     = new Date();
    const primerDia = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-01`;
    const ultimoDia = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).toISOString().split('T')[0];

    const { data: citasMes } = await supabase
        .from('citas').select('usuario_id')
        .eq('fisioterapeuta_id', fisioId)
        .gte('fecha', primerDia).lte('fecha', ultimoDia);

    document.getElementById('card-nuevos-mes').querySelector('.card-stat-numero').textContent =
        new Set(citasMes?.map(c => c.usuario_id)).size;

    // 3. Citas pendientes de pago
    const { data: citasPend } = await supabase
        .from('citas').select('id')
        .eq('fisioterapeuta_id', fisioId)
        .eq('estado', 'pendiente_pago');

    let pendientes = 0;
    if (citasPend?.length) {
        const ids = citasPend.map(c => c.id);
        const { data: pagosComp } = await supabase
            .from('pagos').select('cita_id')
            .in('cita_id', ids).eq('estado_pago', 'procesado');
        const pagadas = new Set(pagosComp?.map(p => p.cita_id) || []);
        pendientes = ids.filter(id => !pagadas.has(id)).length;
    }
    document.getElementById('card-pendientes-pago').querySelector('.card-stat-numero').textContent = pendientes;

    // 4. Próxima cita
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
            new Date(c.fecha + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
        cardP.querySelector('.card-stat-label').textContent =
            `${c.fecha < hoy ? 'Última' : 'Próxima'} · ${c.hora_inicio} · ${c.motivo}`;
    } else {
        cardP.querySelector('.card-stat-numero').textContent = '—';
        cardP.querySelector('.card-stat-label').textContent  = 'Sin citas registradas';
    }
}


/* ══════════════════════════════════════════════════════════════
   LISTA LATERAL DE PACIENTES
   Un paciente = un registro único de usuario con al menos 1 cita
   con este fisio. Se muestra la cita más reciente como referencia.
══════════════════════════════════════════════════════════════ */
async function cargarListaPacientes(fisioId) {
    // Traer todas las citas del fisio con datos del usuario
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

    if (error) { console.error('Error cargando pacientes:', error); return; }

    // Deduplicar: un paciente puede tener varias citas.
    // Nos quedamos con la más reciente por paciente.
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
        const nom     = c.usuario?.us_nom || 'Sin nombre';
        const iniciales = getIniciales(nom);
        const badgeClass = c.estado === 'confirmada' ? 'badge-confirmada'
                         : c.estado === 'cancelada'  ? 'badge-cancelada'
                         : 'badge-pendiente';
        const badgeTxt = c.estado?.replace('_', ' ') || '—';

        return `
        <div class="paciente-item" data-id="${c.usuario?.id_us}" data-cita-id="${c.id}">
            <div class="paciente-avatar">
                ${c.usuario?.url_foto
                    ? `<img src="${c.usuario.url_foto}" alt="${nom}">`
                    : iniciales}
            </div>
            <div class="paciente-item-info">
                <div class="paciente-item-nombre">${nom}</div>
                <div class="paciente-item-meta">
                    <i class="bi bi-calendar3" style="font-size:10px;"></i> ${formatFecha(c.fecha)}
                </div>
            </div>
            <span class="paciente-item-badge ${badgeClass}">${badgeTxt}</span>
        </div>`;
    }).join('');

    // Eventos de clic en cada ítem
    container.querySelectorAll('.paciente-item').forEach(item => {
        item.addEventListener('click', () => {
            container.querySelectorAll('.paciente-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const pacienteUserId = item.dataset.id;
            const cita = lista.find(c => c.usuario?.id_us === pacienteUserId);
            abrirDetallePaciente(cita);
        });
    });
}


/* ══════════════════════════════════════════════════════════════
   BUSCADOR DE PACIENTES
══════════════════════════════════════════════════════════════ */
document.getElementById('buscarPaciente').addEventListener('input', e => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) {
        renderListaPacientes(_todosLosPacientes);
        return;
    }
    const filtrados = _todosLosPacientes.filter(c =>
        (c.usuario?.us_nom || '').toLowerCase().includes(q) ||
        (c.usuario?.us_correo || '').toLowerCase().includes(q)
    );
    renderListaPacientes(filtrados);
});


/* ══════════════════════════════════════════════════════════════
   ABRIR DETALLE DE PACIENTE
   Muestra el panel derecho con los datos del paciente seleccionado.
══════════════════════════════════════════════════════════════ */
async function abrirDetallePaciente(cita) {
    if (!cita?.usuario) return;

    _pacienteActual = cita.usuario;

    // Mostrar panel (ocultar placeholder)
    document.getElementById('detailPlaceholder').style.display = 'none';
    const dc = document.getElementById('detailContent');
    dc.style.display = 'flex';

    // En móvil, mostrar el panel de detalle
    document.getElementById('panelDetalle').classList.add('show');

    // ── Header ──
    const nom      = cita.usuario.us_nom || 'Sin nombre';
    const iniciales = getIniciales(nom);
    const avatarEl = document.getElementById('detailAvatar');
    avatarEl.innerHTML = cita.usuario.url_foto
        ? `<img src="${cita.usuario.url_foto}" alt="${nom}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
        : iniciales;

    document.getElementById('detailNombre').textContent = nom;
    document.getElementById('detailMeta').innerHTML = `
        ${cita.usuario.us_correo ? `<span><i class="bi bi-envelope"></i>${cita.usuario.us_correo}</span>` : ''}
        ${cita.usuario.us_telefono ? `<span><i class="bi bi-telephone"></i>${cita.usuario.us_telefono}</span>` : ''}
    `;

    // ── Botones del header ──
    document.getElementById('btnMensaje').onclick = () => {
        if (!_pacienteActual?.id_us || _pacienteActual.id_us === 'undefined') {
            toast('Este paciente no tiene cuenta activa.', 'warning'); return;
        }
        sessionStorage.setItem('chatPacienteId', _pacienteActual.id_us);
        sessionStorage.setItem('chatPacienteNombre', nom);
        window.location.href = '../Chat/chat.html';
    };

    document.getElementById('btnAsignarRutina').onclick = () => {
        if (!_pacienteActual?.id_us) { toast('Sin cuenta activa.', 'warning'); return; }
        abrirModalAsignarRutina(_pacienteActual.id_us, nom);
    };

    document.getElementById('btnNuevaNotaHeader').onclick = () => abrirModalNota(null);

    // Resetear al tab de citas
    activarTab('citas');

    // Cargar los tres contenidos en paralelo
    await Promise.all([
        cargarCitasPaciente(cita.usuario.id_us),
        cargarHistorialClinico(cita.usuario.id_us),
        cargarNotasEvolucion(cita.usuario.id_us)
    ]);
}


/* ══════════════════════════════════════════════════════════════
   TABS
══════════════════════════════════════════════════════════════ */
function activarTab(nombre) {
    document.querySelectorAll('.detail-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === nombre));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${nombre}`));
}

document.querySelectorAll('.detail-tab').forEach(tab => {
    tab.addEventListener('click', () => activarTab(tab.dataset.tab));
});


/* ══════════════════════════════════════════════════════════════
   TAB 1: HISTORIAL DE CITAS DEL PACIENTE
══════════════════════════════════════════════════════════════ */
async function cargarCitasPaciente(pacienteUserId) {
    const container = document.getElementById('citasTimeline');
    container.innerHTML = `<div style="color:var(--color-gray);font-size:13px;padding:10px;">Cargando…</div>`;

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

    // Verificar cuáles citas ya tienen nota de evolución
    const idsCitas = citas.map(c => c.id);
    const { data: notasExistentes } = await supabase
        .from('notas_evolucion')
        .select('cita_id')
        .in('cita_id', idsCitas);

    const citasConNota = new Set(notasExistentes?.map(n => n.cita_id) || []);

    container.innerHTML = citas.map(c => {
        const { dia, mes } = formatFechaCorta(c.fecha);
        const tieneNota    = citasConNota.has(c.id);
        const estadoClass  = `estado-${c.estado || 'pendiente'}`;
        const estadoTxt    = (c.estado || 'pendiente').replace('_', ' ');

        return `
        <div class="cita-card">
            <div class="cita-card-fecha">
                <span class="cita-dia">${dia}</span>
                <span class="cita-mes">${mes}</span>
            </div>
            <div class="cita-card-info">
                <div class="cita-card-top">
                    <span class="cita-card-motivo">${c.motivo || 'Sin motivo'}</span>
                    <span class="cita-card-hora"><i class="bi bi-clock"></i> ${c.hora_inicio || '—'}</span>
                </div>
                <span class="cita-card-estado ${estadoClass}">${estadoTxt}</span>
                <br>
                <button class="cita-nota-btn ${tieneNota ? '' : 'sin-nota'}"
                    data-cita-id="${c.id}" data-tiene-nota="${tieneNota}">
                    <i class="bi bi-journal-${tieneNota ? 'text' : 'plus'}"></i>
                    ${tieneNota ? 'Ver / editar nota' : 'Agregar nota de evolución'}
                </button>
            </div>
        </div>`;
    }).join('');

    // Eventos de los botones de nota en cada cita
    container.querySelectorAll('.cita-nota-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const citaId   = btn.dataset.citaId;
            const tieneNota = btn.dataset.tieneNota === 'true';
            abrirModalNota(citaId, tieneNota);
        });
    });
}


/* ══════════════════════════════════════════════════════════════
   TAB 2: HISTORIAL CLÍNICO
   El historial lo llena el paciente. El fisio solo lo lee.
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

    // Helper para mostrar valor o "No especificado"
    const val = (v) => {
        if (v === null || v === undefined || v === '') return `<span class="hc-value empty">No especificado</span>`;
        if (v === true  || v === 'true')  return `<span class="hc-value bool-si">Sí</span>`;
        if (v === false || v === 'false') return `<span class="hc-value bool-no">No</span>`;
        return `<span class="hc-value">${v}</span>`;
    };

    container.innerHTML = `
    <div class="hc-grid">

        <!-- Motivo y lesión -->
        <div class="hc-section full-width">
            <div class="hc-section-header"><i class="bi bi-clipboard2-pulse"></i> Motivo de consulta</div>
            <div class="hc-rows">
                <div class="hc-row"><span class="hc-label">Motivo de consulta</span>${val(hc.motivo_consulta)}</div>
                <div class="hc-row"><span class="hc-label">Tiempo de padecimiento</span>${val(hc.tiempo_padecimiento)}</div>
                <div class="hc-row"><span class="hc-label">Zona afectada</span>${val(hc.zona_afectada)}</div>
                <div class="hc-row"><span class="hc-label">Nivel de dolor inicial</span>${val(hc.nivel_dolor_inicial !== null ? hc.nivel_dolor_inicial + ' / 10' : null)}</div>
            </div>
        </div>

        <!-- Antecedentes médicos -->
        <div class="hc-section">
            <div class="hc-section-header"><i class="bi bi-heart-pulse"></i> Antecedentes médicos</div>
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
            <div class="hc-section-header"><i class="bi bi-activity"></i> Estilo de vida</div>
            <div class="hc-rows">
                <div class="hc-row"><span class="hc-label">Actividad física</span>${val(hc.actividad_fisica)}</div>
                <div class="hc-row"><span class="hc-label">Ocupación</span>${val(hc.ocupacion)}</div>
                <div class="hc-row"><span class="hc-label">Fuma</span>${val(hc.fuma)}</div>
                <div class="hc-row"><span class="hc-label">Consume alcohol</span>${val(hc.consume_alcohol)}</div>
            </div>
        </div>

        <!-- Sistemas -->
        <div class="hc-section">
            <div class="hc-section-header"><i class="bi bi-lungs"></i> Revisión de sistemas</div>
            <div class="hc-rows">
                <div class="hc-row"><span class="hc-label">Cardiovascular</span>${val(hc.sistema_cardiovascular)}</div>
                <div class="hc-row"><span class="hc-label">Respiratorio</span>${val(hc.sistema_respiratorio)}</div>
                <div class="hc-row"><span class="hc-label">Nervioso</span>${val(hc.sistema_nervioso)}</div>
                <div class="hc-row"><span class="hc-label">Músculo-esquelético</span>${val(hc.sistema_musculo)}</div>
            </div>
        </div>

        <!-- Consentimientos -->
        <div class="hc-section">
            <div class="hc-section-header"><i class="bi bi-check2-square"></i> Consentimientos</div>
            <div class="hc-rows">
                <div class="hc-row"><span class="hc-label">Acepta tratamiento</span>${val(hc.acepta_tratamiento)}</div>
                <div class="hc-row"><span class="hc-label">Acepta uso de datos</span>${val(hc.acepta_datos)}</div>
                <div class="hc-row"><span class="hc-label">Firma</span>${val(hc.firma_paciente)}</div>
            </div>
        </div>

        <!-- Fechas -->
        <div class="hc-section">
            <div class="hc-section-header"><i class="bi bi-clock-history"></i> Registro</div>
            <div class="hc-rows">
                <div class="hc-row"><span class="hc-label">Creado</span>${val(hc.creado_en ? new Date(hc.creado_en).toLocaleDateString('es-MX') : null)}</div>
                <div class="hc-row"><span class="hc-label">Actualizado</span>${val(hc.actualizado_en ? new Date(hc.actualizado_en).toLocaleDateString('es-MX') : null)}</div>
            </div>
        </div>

    </div>`;
}


/* ══════════════════════════════════════════════════════════════
   TAB 3: NOTAS DE EVOLUCIÓN
   El fisio crea una nota por cita. Puede verlas y editarlas.
══════════════════════════════════════════════════════════════ */
async function cargarNotasEvolucion(pacienteUserId) {
    const container = document.getElementById('notasList');
    container.innerHTML = `<div style="color:var(--color-gray);font-size:13px;padding:10px;">Cargando…</div>`;

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
                <p style="font-size:11px;color:var(--color-gray);">Puedes agregar una nota desde el historial de citas o con el botón "Nueva nota".</p>
            </div>`;
        return;
    }

    const val = v => v || '<span class="nota-field-value empty">No registrado</span>';

    container.innerHTML = notas.map(n => `
        <div class="nota-card">
            <div class="nota-card-header">
                <span class="nota-card-fecha">
                    <i class="bi bi-calendar3"></i>
                    ${n.cita?.fecha ? formatFecha(n.cita.fecha) : formatFecha(n.creado_en?.split('T')[0])}
                    ${n.cita?.hora_inicio ? '· ' + n.cita.hora_inicio : ''}
                </span>
                <span class="nota-card-motivo">${n.motivo_sesion || n.cita?.motivo || '—'}</span>
            </div>
            <div class="nota-card-body">
                <div class="nota-grid">
                    <!-- Dolor -->
                    <div class="nota-field">
                        <span class="nota-field-label">Dolor inicial</span>
                        <div class="nota-dolor-bar">
                            <div class="dolor-track">
                                <div class="dolor-fill" style="width:${(n.dolor_inicio || 0) * 10}%"></div>
                            </div>
                            <span class="dolor-num">${n.dolor_inicio ?? '—'}</span>
                        </div>
                    </div>
                    <div class="nota-field">
                        <span class="nota-field-label">Dolor final</span>
                        <div class="nota-dolor-bar">
                            <div class="dolor-track">
                                <div class="dolor-fill" style="width:${(n.dolor_fin || 0) * 10}%"></div>
                            </div>
                            <span class="dolor-num">${n.dolor_fin ?? '—'}</span>
                        </div>
                    </div>

                    <!-- Estado -->
                    <div class="nota-field">
                        <span class="nota-field-label">Estado del paciente</span>
                        <span class="nota-field-value">${val(n.estado_paciente)}</span>
                    </div>

                    <!-- Diagnóstico -->
                    <div class="nota-field">
                        <span class="nota-field-label">Diagnóstico fisioterapéutico</span>
                        <span class="nota-field-value">${val(n.diagnostico_fisio)}</span>
                    </div>

                    <!-- Técnicas -->
                    <div class="nota-field">
                        <span class="nota-field-label">Técnicas utilizadas</span>
                        <span class="nota-field-value">${val(n.tecnicas_utilizadas)}</span>
                    </div>

                    <!-- Duración -->
                    <div class="nota-field">
                        <span class="nota-field-label">Duración</span>
                        <span class="nota-field-value">${n.duracion_minutos ? n.duracion_minutos + ' min' : '<span class="nota-field-value empty">No registrado</span>'}</span>
                    </div>

                    <!-- Respuesta -->
                    ${n.respuesta_tratamiento ? `
                    <div class="nota-field full">
                        <span class="nota-field-label">Respuesta al tratamiento</span>
                        <span class="nota-field-value">${n.respuesta_tratamiento}</span>
                    </div>` : ''}

                    <!-- Plan siguiente -->
                    ${n.plan_siguiente_sesion ? `
                    <div class="nota-field full">
                        <span class="nota-field-label">Plan siguiente sesión</span>
                        <span class="nota-field-value">${n.plan_siguiente_sesion}</span>
                    </div>` : ''}

                    <!-- Observaciones -->
                    ${n.observaciones ? `
                    <div class="nota-field full">
                        <span class="nota-field-label">Observaciones</span>
                        <span class="nota-field-value">${n.observaciones}</span>
                    </div>` : ''}
                </div>
            </div>
            <div class="nota-card-actions">
                <button class="btn-nota-edit" data-nota-id="${n.id}" data-cita-id="${n.cita_id}">
                    <i class="bi bi-pencil"></i> Editar nota
                </button>
            </div>
        </div>
    `).join('');

    // Eventos de editar nota
    container.querySelectorAll('.btn-nota-edit').forEach(btn => {
        btn.addEventListener('click', () => {
            abrirModalNota(btn.dataset.citaId, true, btn.dataset.notaId);
        });
    });
}


/* ══════════════════════════════════════════════════════════════
   MODAL — NOTA DE EVOLUCIÓN
   Modo crear: abrirModalNota(citaId, false)
   Modo editar: abrirModalNota(citaId, true, notaId)
   Desde "Nueva nota" sin cita específica: abrirModalNota(null)
══════════════════════════════════════════════════════════════ */

// Sliders de dolor
const sliderInicio = document.getElementById('nf-dolor-inicio');
const sliderFin    = document.getElementById('nf-dolor-fin');
sliderInicio.addEventListener('input', () => {
    document.getElementById('nf-dolor-inicio-val').textContent = sliderInicio.value;
});
sliderFin.addEventListener('input', () => {
    document.getElementById('nf-dolor-fin-val').textContent = sliderFin.value;
});

async function abrirModalNota(citaId, tieneNota = false, notaId = null) {
    _citaIdNota     = citaId;
    _notaEditandoId = null;

    limpiarFormNota();

    const overlay  = document.getElementById('modalNotaOverlay');
    const titulo   = document.getElementById('modalNotaTitulo');
    const subtitulo = document.getElementById('modalNotaSubtitulo');

    if (tieneNota) {
        // Buscar la nota existente de esta cita
        let query = supabase.from('notas_evolucion').select('*');

        if (notaId) {
            query = query.eq('id', notaId);
        } else if (citaId) {
            query = query.eq('cita_id', citaId).eq('fisioterapeuta_id', _fisioId);
        }

        const { data: notas } = await query.limit(1);
        const nota = notas?.[0];

        if (nota) {
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

    // Mostrar info de la cita en el subtítulo
    if (citaId) {
        const { data: cita } = await supabase
            .from('citas')
            .select('fecha, hora_inicio, motivo')
            .eq('id', citaId)
            .single();
        if (cita) {
            subtitulo.textContent = `${_pacienteActual?.us_nom || ''} · ${formatFecha(cita.fecha)} · ${cita.hora_inicio || ''}`;
            // Pre-llenar motivo si es nota nueva
            if (!tieneNota && cita.motivo) {
                document.getElementById('nf-motivo').value = cita.motivo;
            }
        }
    } else {
        subtitulo.textContent = _pacienteActual?.us_nom || '';
    }

    overlay.classList.add('active');
}

function limpiarFormNota() {
    const ids = ['nf-motivo','nf-estado-paciente','nf-reporte','nf-postura','nf-rango','nf-fuerza',
                 'nf-pruebas','nf-signos','nf-diagnostico','nf-objetivos','nf-tecnicas',
                 'nf-ejercicios','nf-equipo','nf-duracion','nf-respuesta','nf-observaciones',
                 'nf-plan','nf-frecuencia','nf-ejercicios-casa'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    sliderInicio.value = 0;
    sliderFin.value    = 0;
    document.getElementById('nf-dolor-inicio-val').textContent = '0';
    document.getElementById('nf-dolor-fin-val').textContent    = '0';
}

function llenarFormNota(n) {
    const set = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
    set('nf-motivo',          n.motivo_sesion);
    set('nf-estado-paciente', n.estado_paciente);
    set('nf-reporte',         n.reporte_paciente);
    set('nf-postura',         n.postura);
    set('nf-rango',           n.rango_movimiento);
    set('nf-fuerza',          n.fuerza_muscular);
    set('nf-pruebas',         n.pruebas_especiales);
    set('nf-signos',          typeof n.signos_vitales === 'object' ? JSON.stringify(n.signos_vitales) : n.signos_vitales);
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

    if (n.dolor_inicio != null) {
        sliderInicio.value = n.dolor_inicio;
        document.getElementById('nf-dolor-inicio-val').textContent = n.dolor_inicio;
    }
    if (n.dolor_fin != null) {
        sliderFin.value = n.dolor_fin;
        document.getElementById('nf-dolor-fin-val').textContent = n.dolor_fin;
    }
}

function cerrarModalNota() {
    document.getElementById('modalNotaOverlay').classList.remove('active');
    _citaIdNota     = null;
    _notaEditandoId = null;
}

// Cerrar con botones / overlay
document.getElementById('btnCerrarModalNota').addEventListener('click', cerrarModalNota);
document.getElementById('btnCancelarNota').addEventListener('click', cerrarModalNota);
document.getElementById('modalNotaOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modalNotaOverlay')) cerrarModalNota();
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') cerrarModalNota();
});

// ── Guardar nota ──
document.getElementById('btnGuardarNota').addEventListener('click', async () => {
    if (!_pacienteActual?.id_us) { toast('No hay paciente seleccionado.', 'danger'); return; }

    const btn = document.getElementById('btnGuardarNota');
    btn.disabled  = true;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Guardando…';

    const g = id => document.getElementById(id)?.value?.trim() || null;

    const payload = {
        paciente_id:          _pacienteActual.id_us,
        fisioterapeuta_id:    _fisioId,
        cita_id:              _citaIdNota || null,
        motivo_sesion:        g('nf-motivo'),
        estado_paciente:      g('nf-estado-paciente'),
        dolor_inicio:         parseInt(sliderInicio.value),
        dolor_fin:            parseInt(sliderFin.value),
        reporte_paciente:     g('nf-reporte'),
        postura:              g('nf-postura'),
        rango_movimiento:     g('nf-rango'),
        fuerza_muscular:      g('nf-fuerza'),
        pruebas_especiales:   g('nf-pruebas'),
        signos_vitales:       g('nf-signos'),
        diagnostico_fisio:    g('nf-diagnostico'),
        objetivos_sesion:     g('nf-objetivos'),
        tecnicas_utilizadas:  g('nf-tecnicas'),
        ejercicios_realizados:g('nf-ejercicios'),
        equipo_utilizado:     g('nf-equipo'),
        duracion_minutos:     g('nf-duracion') ? parseInt(g('nf-duracion')) : null,
        respuesta_tratamiento:g('nf-respuesta'),
        observaciones:        g('nf-observaciones'),
        plan_siguiente_sesion:g('nf-plan'),
        frecuencia_recomendada:g('nf-frecuencia'),
        ejercicios_en_casa:   g('nf-ejercicios-casa'),
    };

    let error;
    if (_notaEditandoId) {
        // Actualizar nota existente
        ({ error } = await supabase
            .from('notas_evolucion')
            .update(payload)
            .eq('id', _notaEditandoId));
    } else {
        // Insertar nueva nota
        ({ error } = await supabase
            .from('notas_evolucion')
            .insert(payload));
    }

    btn.disabled  = false;
    btn.innerHTML = '<i class="bi bi-check-lg"></i> Guardar nota';

    if (error) {
        console.error('Error guardando nota:', error);
        toast('Error al guardar la nota. Intenta de nuevo.', 'danger');
        return;
    }

    cerrarModalNota();
    toast(_notaEditandoId ? 'Nota actualizada exitosamente.' : 'Nota guardada exitosamente.', 'success');

    // Refrescar los tabs afectados
    await Promise.all([
        cargarCitasPaciente(_pacienteActual.id_us),
        cargarNotasEvolucion(_pacienteActual.id_us)
    ]);
});


/* ══════════════════════════════════════════════════════════════
   MODAL — ASIGNAR RUTINA A PACIENTE
══════════════════════════════════════════════════════════════ */
let _pacienteIdAsignar     = null;
let _pacienteNombreAsignar = null;

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

    await cargarRutinasConEjercicios(select);
}

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

    const checks = await Promise.all(
        rutinas.map(r =>
            supabase.from('rutina_eje')
                .select('*', { count: 'exact', head: true })
                .eq('id_rut', r.id_rut)
                .then(({ count }) => ({ ...r, tieneEjercicios: (count || 0) > 0 }))
        )
    );

    const validas = checks.filter(r => r.tieneEjercicios);

    if (!validas.length) {
        select.innerHTML = '<option value="">Sin rutinas con ejercicios</option>';
        document.getElementById('avisoSinRutinas').style.display     = 'block';
        document.getElementById('btnConfirmarAsignarRutina').disabled = true;
        return;
    }

    select.innerHTML = '<option value="">Selecciona una rutina…</option>';
    validas.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id_rut;
        opt.textContent = r.rut_nom;
        select.appendChild(opt);
    });
    select.disabled = false;
    document.getElementById('btnConfirmarAsignarRutina').disabled = false;
}

document.getElementById('btnConfirmarAsignarRutina').addEventListener('click', async () => {
    const rutinaId = document.getElementById('selectRutinaAsignar').value;
    if (!rutinaId) { toast('Selecciona una rutina.', 'warning'); return; }
    if (!_pacienteIdAsignar) { toast('Error: no se encontró el paciente.', 'danger'); return; }

    const btn = document.getElementById('btnConfirmarAsignarRutina');
    btn.disabled    = true;
    btn.textContent = 'Asignando…';

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
    const nombrePaciente = _pacienteNombreAsignar;
    _pacienteIdAsignar     = null;
    _pacienteNombreAsignar = null;
    toast(`Rutina asignada a ${nombrePaciente} exitosamente.`, 'success');
});

// Exponer para uso desde otros módulos si se necesita
window.abrirModalAsignarRutina = abrirModalAsignarRutina;


/* ══════════════════════════════════════════════════════════════
   TIEMPO REAL
   Actualiza estadísticas y lista cuando cambian citas o pagos.
══════════════════════════════════════════════════════════════ */
function activarTiempoReal(fisioId) {
    supabase.channel('citas-cambios')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'citas' }, async () => {
            await cargarEstadisticas(fisioId);
            await cargarListaPacientes(fisioId);
        })
        .subscribe();

    supabase.channel('pagos-cambios')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos' }, () => {
            cargarEstadisticas(fisioId);
        })
        .subscribe();
}


/* ══════════════════════════════════════════════════════════════
   INICIALIZACIÓN
══════════════════════════════════════════════════════════════ */
async function inicializar() {
    const fisioId = await getFisioData();
    if (!fisioId) {
        toast('No se pudo obtener el perfil del fisioterapeuta.', 'danger');
        return;
    }

    await Promise.all([
        cargarEstadisticas(fisioId),
        cargarListaPacientes(fisioId)
    ]);

    activarTiempoReal(fisioId);
}

inicializar();