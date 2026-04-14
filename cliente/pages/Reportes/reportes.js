import { protegerRuta } from "../../../proteger.js";
await protegerRuta("fisioterapeuta");

import { supabase } from "../../../auth.js";

/* ═══════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════ */
function fechaLocalISO(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function formatFecha(str) {
    if (!str) return '—';
    return new Date(str + 'T00:00:00').toLocaleDateString('es-MX', { day:'numeric', month:'short', year:'numeric' });
}

function getIniciales(nombre = '') {
    return nombre.trim().split(' ').filter(Boolean).slice(0,2).map(p => p[0].toUpperCase()).join('');
}

function toast(msg, tipo = 'success') {
    const c = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast-msg toast-${tipo}`;
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => el.remove(), 3500);
}

/* ═══════════════════════════════════════════════════════
   ESTADO GLOBAL
═══════════════════════════════════════════════════════ */
let _fisioId     = null;
let _fisioUserId = null;
let _periodo     = 'mes';

/* ═══════════════════════════════════════════════════════
   RANGO DE FECHAS SEGÚN PERÍODO
═══════════════════════════════════════════════════════ */
function getRango(periodo) {
    const hoy    = new Date();
    const fin    = fechaLocalISO(hoy);
    let   inicio = fin;

    if (periodo === 'mes') {
        inicio = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-01`;
    } else if (periodo === 'trimestre') {
        const d = new Date(hoy);
        d.setMonth(d.getMonth() - 3);
        inicio = fechaLocalISO(d);
    } else if (periodo === 'año') {
        inicio = `${hoy.getFullYear()}-01-01`;
    } else {
        inicio = '2000-01-01';
    }
    return { inicio, fin };
}

/* ═══════════════════════════════════════════════════════
   INICIALIZACIÓN
═══════════════════════════════════════════════════════ */
async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    _fisioUserId = user.id;

    const { data: fisio } = await supabase
        .from('fisioterapeutas')
        .select('id')
        .eq('user_id', user.id)
        .single();

    if (!fisio) { toast('No se encontró el perfil del fisioterapeuta.', 'danger'); return; }
    _fisioId = fisio.id;

    // Filtros de período
    document.querySelectorAll('.btn-filtro').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn-filtro').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            _periodo = btn.dataset.periodo;
            cargarTodo();
        });
    });

    await cargarTodo();
}

/* ═══════════════════════════════════════════════════════
   CARGAR TODO
═══════════════════════════════════════════════════════ */
async function cargarTodo() {
    const { inicio, fin } = getRango(_periodo);
    await Promise.all([
        cargarKPIs(inicio, fin),
        cargarGraficaCitas(inicio, fin),
        cargarEstadosPacientes(inicio, fin),
        cargarDolorEvolucion(inicio, fin),
        cargarRutinas(),
        cargarTablaPacientes(inicio, fin),
    ]);
}

/* ═══════════════════════════════════════════════════════
   KPIs
═══════════════════════════════════════════════════════ */
async function cargarKPIs(inicio, fin) {
    // Citas confirmadas en el rango
    const { data: citas } = await supabase
        .from('citas')
        .select('id, usuario_id, fecha')
        .eq('fisioterapeuta_id', _fisioId)
        .eq('estado', 'confirmada')
        .gte('fecha', inicio)
        .lte('fecha', fin);

    const pacientesUnicos = new Set(citas?.map(c => c.usuario_id) || []);
    document.getElementById('kpi-pacientes').textContent = pacientesUnicos.size;
    document.getElementById('kpi-citas').textContent     = citas?.length || 0;

    // Notas de evolución en el rango
    const { data: notas } = await supabase
        .from('notas_evolucion')
        .select('id, dolor_inicio, dolor_fin, duracion_minutos, estado_paciente')
        .eq('fisioterapeuta_id', _fisioId)
        .gte('creado_en', inicio + 'T00:00:00')
        .lte('creado_en', fin + 'T23:59:59');

    document.getElementById('kpi-notas').textContent = notas?.length || 0;

    // Reducción de dolor promedio
    const notasConDolor = (notas || []).filter(n => n.dolor_inicio != null && n.dolor_fin != null);
    if (notasConDolor.length) {
        const avg = notasConDolor.reduce((s, n) => s + (n.dolor_inicio - n.dolor_fin), 0) / notasConDolor.length;
        document.getElementById('kpi-dolor').textContent = avg >= 0
            ? `↓ ${avg.toFixed(1)} pts`
            : `↑ ${Math.abs(avg).toFixed(1)} pts`;
    } else {
        document.getElementById('kpi-dolor').textContent = '—';
    }

    // Pacientes con alta definitiva
    const { data: altas } = await supabase
        .from('notas_evolucion')
        .select('paciente_id')
        .eq('fisioterapeuta_id', _fisioId)
        .eq('estado_paciente', 'alta_definitiva');
    const altasUnicas = new Set(altas?.map(n => n.paciente_id) || []);
    document.getElementById('kpi-alta').textContent = altasUnicas.size;

    // Duración promedio
    const notasConDur = (notas || []).filter(n => n.duracion_minutos);
    if (notasConDur.length) {
        const avgDur = notasConDur.reduce((s, n) => s + n.duracion_minutos, 0) / notasConDur.length;
        document.getElementById('kpi-duracion').textContent = `${Math.round(avgDur)} min`;
    } else {
        document.getElementById('kpi-duracion').textContent = '—';
    }
}

/* ═══════════════════════════════════════════════════════
   GRÁFICA DE CITAS POR SEMANA
═══════════════════════════════════════════════════════ */
async function cargarGraficaCitas(inicio, fin) {
    const el = document.getElementById('graficaCitas');

    const { data: citas } = await supabase
        .from('citas')
        .select('fecha, estado')
        .eq('fisioterapeuta_id', _fisioId)
        .gte('fecha', inicio)
        .lte('fecha', fin)
        .order('fecha', { ascending: true });

    if (!citas?.length) { el.innerHTML = '<div class="sin-datos">Sin citas en este período</div>'; return; }

    // Agrupar por semana (lunes de cada semana)
    const semanas = {};
    citas.forEach(c => {
        const d = new Date(c.fecha + 'T00:00:00');
        const lunes = new Date(d);
        lunes.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        const key = fechaLocalISO(lunes);
        semanas[key] = (semanas[key] || 0) + 1;
    });

    const keys  = Object.keys(semanas).sort();
    const vals  = keys.map(k => semanas[k]);
    const maxi  = Math.max(...vals, 1);
    const hoyKey = fechaLocalISO(new Date());

    el.innerHTML = keys.map((k, i) => {
        const altura = Math.max(8, Math.round((vals[i] / maxi) * 140));
        const label  = new Date(k + 'T00:00:00').toLocaleDateString('es-MX', { day:'numeric', month:'short' });
        const esActual = k <= hoyKey && (i === keys.length - 1);
        return `
        <div class="barra-grupo">
            <div class="barra-contenedor" style="height:${altura}px">
                <div class="barra-fill" style="height:100%"></div>
            </div>
            <span class="barra-monto">${vals[i]}</span>
            <span class="barra-etiqueta ${esActual ? 'activo' : ''}">${label}</span>
        </div>`;
    }).join('');
}

/* ═══════════════════════════════════════════════════════
   ESTADOS DE PACIENTES (ÚLTIMO ESTADO POR PACIENTE)
═══════════════════════════════════════════════════════ */
async function cargarEstadosPacientes(inicio, fin) {
    const el = document.getElementById('estadosWrap');

    const { data: notas } = await supabase
        .from('notas_evolucion')
        .select('paciente_id, estado_paciente, creado_en')
        .eq('fisioterapeuta_id', _fisioId)
        .not('estado_paciente', 'is', null)
        .order('creado_en', { ascending: false });

    if (!notas?.length) { el.innerHTML = '<div class="sin-datos">Sin datos de estado</div>'; return; }

    // Último estado por paciente
    const ultimoEstado = {};
    notas.forEach(n => {
        if (!ultimoEstado[n.paciente_id]) ultimoEstado[n.paciente_id] = n.estado_paciente;
    });

    const conteo = {};
    Object.values(ultimoEstado).forEach(e => { conteo[e] = (conteo[e] || 0) + 1; });

    const colores = {
        en_tratamiento:  '#1565c0',
        alta_temporal:   '#e65100',
        alta_definitiva: '#2e7d32',
        referido:        '#4527a0',
    };
    const labels = {
        en_tratamiento:  'En tratamiento',
        alta_temporal:   'Alta temporal',
        alta_definitiva: 'Alta definitiva',
        referido:        'Referido',
    };

    const total = Object.values(conteo).reduce((a, b) => a + b, 0);

    el.innerHTML = Object.entries(conteo)
        .sort((a, b) => b[1] - a[1])
        .map(([estado, n]) => `
        <div class="estado-item">
            <div class="estado-dot" style="background:${colores[estado] || '#888'}"></div>
            <div class="estado-nombre">${labels[estado] || estado}</div>
            <div class="estado-barra-wrap">
                <div class="estado-barra">
                    <div class="estado-barra-fill" style="width:${Math.round(n/total*100)}%;background:${colores[estado] || '#888'}"></div>
                </div>
            </div>
            <div class="estado-count">${n}</div>
        </div>`).join('');
}

/* ═══════════════════════════════════════════════════════
   EVOLUCIÓN DEL DOLOR POR PACIENTE
═══════════════════════════════════════════════════════ */
async function cargarDolorEvolucion(inicio, fin) {
    const el = document.getElementById('dolorWrap');

    // Traer notas con nombre del paciente
    const { data: notas } = await supabase
        .from('notas_evolucion')
        .select('paciente_id, dolor_inicio, dolor_fin, creado_en')
        .eq('fisioterapeuta_id', _fisioId)
        .not('dolor_inicio', 'is', null)
        .not('dolor_fin',    'is', null)
        .gte('creado_en', inicio + 'T00:00:00')
        .lte('creado_en', fin + 'T23:59:59')
        .order('creado_en', { ascending: false });

    if (!notas?.length) { el.innerHTML = '<div class="sin-datos">Sin datos de dolor en este período</div>'; return; }

    // Promedios por paciente
    const porPaciente = {};
    notas.forEach(n => {
        if (!porPaciente[n.paciente_id]) porPaciente[n.paciente_id] = { inicio: [], fin: [] };
        porPaciente[n.paciente_id].inicio.push(n.dolor_inicio);
        porPaciente[n.paciente_id].fin.push(n.dolor_fin);
    });

    // Traer nombres
    const ids = Object.keys(porPaciente);
    const { data: usuarios } = await supabase
        .from('usuario')
        .select('id_us, us_nom')
        .in('id_us', ids);

    const nombreMap = {};
    (usuarios || []).forEach(u => { nombreMap[u.id_us] = u.us_nom; });

    const rows = Object.entries(porPaciente).map(([pid, d]) => {
        const avgInicio = d.inicio.reduce((a, b) => a + b, 0) / d.inicio.length;
        const avgFin    = d.fin.reduce((a, b) => a + b, 0) / d.fin.length;
        const delta     = avgInicio - avgFin;
        return { nombre: nombreMap[pid] || 'Paciente', avgInicio, avgFin, delta };
    }).sort((a, b) => b.delta - a.delta).slice(0, 10);

    el.innerHTML = `
        <div style="display:flex;gap:1rem;font-size:11px;color:#888;margin-bottom:8px;">
            <span style="display:flex;align-items:center;gap:4px;"><span style="display:inline-block;width:12px;height:6px;background:#f755d4;opacity:0.5;border-radius:3px;"></span>Inicial</span>
            <span style="display:flex;align-items:center;gap:4px;"><span style="display:inline-block;width:12px;height:6px;background:#a81f91;border-radius:3px;"></span>Final</span>
        </div>
        ${rows.map(r => {
            const maxVal = 10;
            const anchoInicio = Math.round((r.avgInicio / maxVal) * 100);
            const anchoFin    = Math.round((r.avgFin    / maxVal) * 100);
            const cls = r.delta > 0 ? 'baja' : r.delta < 0 ? 'sube' : 'igual';
            const sym = r.delta > 0 ? '↓' : r.delta < 0 ? '↑' : '=';
            return `
            <div class="dolor-row">
                <div class="dolor-nombre" title="${r.nombre}">${r.nombre}</div>
                <div class="dolor-barra-doble">
                    <div class="dolor-seg-inicio" style="width:${anchoInicio}%"></div>
                    <div class="dolor-seg-final"  style="width:${anchoFin}%"></div>
                </div>
                <div class="dolor-delta ${cls}">${sym} ${Math.abs(r.delta).toFixed(1)}</div>
            </div>`;
        }).join('')}`;
}

/* ═══════════════════════════════════════════════════════
   RUTINAS ASIGNADAS CON PROGRESO
═══════════════════════════════════════════════════════ */
async function cargarRutinas() {
    const el = document.getElementById('rutinasWrap');

    const { data: rutinas } = await supabase
        .from('rutina')
        .select('id_rut, rut_nom, rut_zona, usuario_id')
        .eq('fisioterapeuta_id', _fisioId)
        .not('usuario_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(8);

    if (!rutinas?.length) { el.innerHTML = '<div class="sin-datos">Sin rutinas asignadas</div>'; return; }

    // Buscar progreso de cada rutina
    const progresos = await Promise.all(rutinas.map(async r => {
        const { data: prog } = await supabase
            .from('progreso_rutina')
            .select('prog_porcentaje, prog_completada')
            .eq('id_rut', r.id_rut)
            .eq('id_us',  r.usuario_id)
            .order('prog_fecha', { ascending: false })
            .limit(1)
            .maybeSingle();
        return { ...r, porcentaje: prog?.prog_porcentaje ?? 0, completada: prog?.prog_completada ?? false };
    }));

    // Nombre del paciente asignado
    const usuarioIds = [...new Set(progresos.map(r => r.usuario_id))];
    const { data: usuarios } = await supabase
        .from('usuario')
        .select('id_us, us_nom')
        .in('id_us', usuarioIds);
    const nombreMap = {};
    (usuarios || []).forEach(u => { nombreMap[u.id_us] = u.us_nom; });

    el.innerHTML = progresos.map(r => `
        <div class="rutina-item">
            <div class="rutina-icon"><i class="bi bi-list-check"></i></div>
            <div class="rutina-info">
                <div class="rutina-nom">${r.rut_nom}</div>
                <div class="rutina-meta">${nombreMap[r.usuario_id] || '—'} · ${r.rut_zona || 'Sin zona'}</div>
                <div class="rutina-prog-wrap">
                    <div class="rutina-prog-bar">
                        <div class="rutina-prog-fill" style="width:${r.porcentaje}%"></div>
                    </div>
                    <span class="rutina-pct">${Math.round(r.porcentaje)}%</span>
                </div>
            </div>
        </div>`).join('');
}

/* ═══════════════════════════════════════════════════════
   TABLA DE PACIENTES
═══════════════════════════════════════════════════════ */
async function cargarTablaPacientes(inicio, fin) {
    const tbody = document.getElementById('tablaPacientes');

    // Citas del período
    const { data: citas } = await supabase
        .from('citas')
        .select('usuario_id, fecha, estado')
        .eq('fisioterapeuta_id', _fisioId)
        .gte('fecha', inicio)
        .lte('fecha', fin);

    if (!citas?.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="sin-datos">Sin datos en este período</td></tr>';
        document.getElementById('badge-pacientes-tabla').textContent = '0';
        return;
    }

    // Agrupar por paciente
    const pacMap = {};
    citas.forEach(c => {
        if (!pacMap[c.usuario_id]) pacMap[c.usuario_id] = { citas: 0, ultima: null };
        pacMap[c.usuario_id].citas++;
        if (!pacMap[c.usuario_id].ultima || c.fecha > pacMap[c.usuario_id].ultima)
            pacMap[c.usuario_id].ultima = c.fecha;
    });

    const ids = Object.keys(pacMap);
    document.getElementById('badge-pacientes-tabla').textContent = ids.length;

    // Datos de usuario
    const { data: usuarios } = await supabase
        .from('usuario')
        .select('id_us, us_nom')
        .in('id_us', ids);
    const uMap = {};
    (usuarios || []).forEach(u => { uMap[u.id_us] = u.us_nom; });

    // Última nota por paciente
    const { data: notas } = await supabase
        .from('notas_evolucion')
        .select('paciente_id, dolor_inicio, dolor_fin, estado_paciente, creado_en')
        .eq('fisioterapeuta_id', _fisioId)
        .in('paciente_id', ids)
        .order('creado_en', { ascending: false });

    const ultimaNota = {};
    const conteoNotas = {};
    (notas || []).forEach(n => {
        conteoNotas[n.paciente_id] = (conteoNotas[n.paciente_id] || 0) + 1;
        if (!ultimaNota[n.paciente_id]) ultimaNota[n.paciente_id] = n;
    });

    tbody.innerHTML = ids.map(id => {
        const nom    = uMap[id] || 'Paciente';
        const ini    = getIniciales(nom);
        const p      = pacMap[id];
        const nota   = ultimaNota[id];
        const nNotas = conteoNotas[id] || 0;

        const di  = nota?.dolor_inicio ?? null;
        const df  = nota?.dolor_fin    ?? null;
        const red = (di != null && df != null) ? (di - df) : null;

        const estado  = nota?.estado_paciente || null;
        const badgeCls = estado ? `badge-${estado}` : 'badge-sin_nota';
        const badgeTxt = estado
            ? { en_tratamiento:'En tratamiento', alta_temporal:'Alta temporal', alta_definitiva:'Alta definitiva', referido:'Referido' }[estado]
            : 'Sin nota';

        const dolorInicio = di != null
            ? `<div class="mini-dolor"><div class="mini-dolor-bar"><div class="mini-dolor-fill" style="width:${di*10}%"></div></div><span style="font-size:11px;color:#888;">${di}</span></div>`
            : '—';
        const dolorFinal = df != null
            ? `<div class="mini-dolor"><div class="mini-dolor-bar"><div class="mini-dolor-fill" style="width:${df*10}%"></div></div><span style="font-size:11px;color:#888;">${df}</span></div>`
            : '—';
        const redTxt = red != null
            ? `<span style="font-weight:700;color:${red>=0?'#2e7d32':'#c62828'}">${red>=0?'↓':'↑'} ${Math.abs(red)}</span>`
            : '—';

        return `<tr>
            <td>
                <div style="display:flex;align-items:center;gap:8px;">
                    <div style="width:30px;height:30px;border-radius:50%;background:#f3e8fd;color:#9b1b6e;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">${ini}</div>
                    <span style="font-weight:500;color:#40001a;">${nom}</span>
                </div>
            </td>
            <td style="text-align:center;font-weight:600;color:#a81f68;">${p.citas}</td>
            <td style="font-size:12px;color:#666;">${formatFecha(p.ultima)}</td>
            <td>${dolorInicio}</td>
            <td>${dolorFinal}</td>
            <td>${redTxt}</td>
            <td><span class="badge-estado ${badgeCls}">${badgeTxt}</span></td>
            <td style="text-align:center;color:#888;">${nNotas}</td>
        </tr>`;
    }).join('');
}

/* ═══════════════════════════════════════════════════════
   ARRANQUE
═══════════════════════════════════════════════════════ */
init();